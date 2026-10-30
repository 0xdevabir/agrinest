<?php

namespace App\Http\Controllers;

use App\Models\CropCycle;
use App\Models\Field;
use App\Models\Guidance;
use App\Models\Offer;
use App\Models\Scan;
use App\Models\User;
use App\Services\Agronomy;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Read-only national monitoring for ministry-level admins: totals only, never a farmer's land or phone. */
class OversightController extends Controller
{
    /** A scan waiting longer than this counts against the district's officers. */
    private const OVERDUE_DAYS = 3;

    public function national(Request $request, Agronomy $agronomy): JsonResponse
    {
        abort_unless($request->user()->isRole('admin'), 403);

        $health = ['healthy' => 0, 'watch' => 0, 'treat' => 0, 'urgent' => 0, 'unknown' => 0];
        $crops = [];
        $districts = [];
        $totals = ['lands' => 0, 'acres' => 0.0, 'growing_acres' => 0.0, 'expected_kg' => 0, 'weather_risk' => 0];

        $crop = function (string $id) use (&$crops) {
            $c = config("agri.crops.$id");
            $crops[$id] ??= [
                'id' => $id, 'en' => $c['en'] ?? $id, 'bn' => $c['bn'] ?? $id, 'emoji' => $c['emoji'] ?? '🌱', 'reference_price' => $c['price'] ?? null,
                'plots' => 0, 'acres' => 0.0, 'expected_kg' => 0, 'harvested_kg' => 0.0, 'sold_kg' => 0.0, 'sold_value' => 0.0,
            ];
        };
        $district = function (?string $name) use (&$districts) {
            $key = $name ?: '—';
            $districts[$key] ??= ['district' => $key, 'farmers' => 0, 'officers' => 0, 'acres' => 0.0, 'at_risk' => 0, 'pending' => 0, 'overdue' => 0, 'sold_value' => 0.0];

            return $key;
        };

        Field::query()->with('activeCycle')->chunkById(500, function ($fields) use (&$health, &$crops, &$districts, &$totals, $crop, $district, $agronomy) {
            foreach ($fields as $f) {
                $key = $district($f->district);
                $districts[$key]['acres'] += $f->area_acres;
                $districts[$key]['at_risk'] += in_array($f->health_status, ['urgent', 'treat'], true) ? 1 : 0;
                $health[$f->health_status] = ($health[$f->health_status] ?? 0) + 1;
                $totals['lands']++;
                $totals['acres'] += $f->area_acres;
                $totals['weather_risk'] += $f->weather_risk === 'high' ? 1 : 0;

                if ($cycle = $f->activeCycle) {
                    $expected = $agronomy->estimateYield($f, $cycle)['mid_kg'];
                    $crop($cycle->crop);
                    $crops[$cycle->crop]['plots']++;
                    $crops[$cycle->crop]['acres'] += $f->area_acres;
                    $crops[$cycle->crop]['expected_kg'] += $expected;
                    $totals['growing_acres'] += $f->area_acres;
                    $totals['expected_kg'] += $expected;
                }
            }
        });

        CropCycle::where('status', 'harvested')->selectRaw('crop, SUM(actual_yield_kg) as kg')->groupBy('crop')->get()
            ->each(function ($row) use (&$crops, $crop) {
                $crop($row->crop);
                $crops[$row->crop]['harvested_kg'] = (float) $row->kg;
            });

        // Eight weekly buckets, oldest first, for the sales trend.
        $firstWeek = now()->startOfWeek()->subWeeks(7);
        $weeks = [];
        foreach (range(0, 7) as $i) {
            $weeks[$firstWeek->copy()->addWeeks($i)->toDateString()] = ['start' => $firstWeek->copy()->addWeeks($i)->toDateString(), 'kg' => 0.0, 'value' => 0.0];
        }

        $sales = ['deals' => 0, 'sold_kg' => 0.0, 'sold_value' => 0.0, 'sold_value_30d' => 0.0, 'government_value' => 0.0];
        $monthAgo = now()->subDays(30);
        Offer::where('status', 'accepted')->with('listing:id,crop', 'buyPost:id,crop', 'farmer:id,district', 'buyer:id,buyer_type')
            ->chunkById(500, function ($offers) use (&$sales, &$crops, &$districts, &$weeks, $crop, $district, $monthAgo) {
                foreach ($offers as $o) {
                    $value = $o->quantity_kg * $o->price_per_kg;
                    $sales['deals']++;
                    $sales['sold_kg'] += $o->quantity_kg;
                    $sales['sold_value'] += $value;
                    $sales['sold_value_30d'] += $o->updated_at->gte($monthAgo) ? $value : 0;
                    $sales['government_value'] += $o->buyer?->buyer_type === 'government' ? $value : 0;

                    if ($id = $o->listing?->crop ?? $o->buyPost?->crop) {
                        $crop($id);
                        $crops[$id]['sold_kg'] += $o->quantity_kg;
                        $crops[$id]['sold_value'] += $value;
                    }
                    $districts[$district($o->farmer?->district)]['sold_value'] += $value;

                    $week = $o->updated_at->copy()->startOfWeek()->toDateString();
                    if (isset($weeks[$week])) {
                        $weeks[$week]['kg'] += $o->quantity_kg;
                        $weeks[$week]['value'] += $value;
                    }
                }
            });

        User::where('role', 'farmer')->selectRaw('district, COUNT(*) as n')->groupBy('district')->get()
            ->each(function ($row) use (&$districts, $district) { $districts[$district($row->district)]['farmers'] = (int) $row->n; });

        // Backlog belongs to a district, and every officer posted there shares it.
        $cutoff = now()->subDays(self::OVERDUE_DAYS);
        $backlog = [];
        Scan::where('scans.status', 'pending')->join('fields', 'fields.id', '=', 'scans.field_id')
            ->select('fields.district', 'scans.created_at')->get()
            ->each(function ($scan) use (&$districts, &$backlog, $district, $cutoff) {
                $key = $district($scan->district);
                $districts[$key]['pending']++;
                $districts[$key]['overdue'] += $scan->created_at->lt($cutoff) ? 1 : 0;
                $backlog[$key] = min($backlog[$key] ?? PHP_INT_MAX, $scan->created_at->timestamp);
            });

        $reviews = Scan::whereNotNull('reviewed_by')->where('reviewed_at', '>=', $monthAgo)->get(['reviewed_by', 'created_at', 'reviewed_at'])->groupBy('reviewed_by');
        $lastReview = Scan::whereNotNull('reviewed_by')->selectRaw('reviewed_by, MAX(reviewed_at) as at')->groupBy('reviewed_by')->pluck('at', 'reviewed_by');
        $guidance = Guidance::where('created_at', '>=', $monthAgo)->selectRaw('officer_id, COUNT(*) as n')->groupBy('officer_id')->pluck('n', 'officer_id');

        $officers = User::where('role', 'officer')->orderBy('name')->get(['id', 'name', 'phone', 'organization', 'district'])
            ->map(function ($officer) use (&$districts, $district, $backlog, $reviews, $lastReview, $guidance, $cutoff) {
                $key = $district($officer->district);
                $districts[$key]['officers']++;
                $done = $reviews->get($officer->id, collect());
                $oldest = $backlog[$key] ?? null;

                return [
                    'id' => $officer->id,
                    'name' => $officer->name,
                    'phone' => $officer->phone,
                    'organization' => $officer->organization,
                    'district' => $officer->district,
                    'pending' => $districts[$key]['pending'],
                    'overdue' => $districts[$key]['overdue'],
                    'oldest_pending_at' => $oldest ? date(DATE_ATOM, $oldest) : null,
                    'reviewed_7d' => $done->filter(fn ($s) => $s->reviewed_at->gte(now()->subDays(7)))->count(),
                    'reviewed_30d' => $done->count(),
                    'avg_review_hours' => $done->isEmpty() ? null : round($done->avg(fn ($s) => $s->created_at->diffInMinutes($s->reviewed_at)) / 60, 1),
                    'guidance_30d' => (int) ($guidance[$officer->id] ?? 0),
                    'last_review_at' => $lastReview[$officer->id] ?? null,
                    'behind' => $oldest !== null && $oldest < $cutoff->timestamp,
                ];
            })
            ->sortByDesc(fn ($o) => [$o['behind'], $o['overdue'], $o['pending']])->values();

        $districtRows = collect($districts)->sortByDesc('sold_value')->values();

        return response()->json([
            'overdue_days' => self::OVERDUE_DAYS,
            'totals' => $totals + $sales + [
                'farmers' => User::where('role', 'farmer')->count(),
                'officers' => $officers->count(),
                'agents' => User::where('role', 'agent')->count(),
                'districts' => $districtRows->count(),
                'pending' => $districtRows->sum('pending'),
                'overdue' => $districtRows->sum('overdue'),
                'uncovered_districts' => $districtRows->where('officers', 0)->count(),
            ],
            'health' => $health,
            'crops' => collect($crops)->map(fn ($c) => $c + ['avg_price' => $c['sold_kg'] > 0 ? round($c['sold_value'] / $c['sold_kg'], 2) : null])->sortByDesc('acres')->values(),
            'weeks' => array_values($weeks),
            'districts' => $districtRows,
            'officers' => $officers,
        ]);
    }
}
