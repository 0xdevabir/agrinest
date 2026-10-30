<?php

namespace App\Http\Controllers;

use App\Models\Field;
use App\Models\Scan;
use App\Models\User;
use App\Services\Agronomy;
use App\Services\Game;
use App\Services\Presenter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function __construct(private Presenter $present) {}

    /** The farmer's game home: level, quests, land and everything they should notice. */
    public function farm(Request $request, Game $game, Agronomy $agronomy): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->isRole('farmer'), 403);

        $fields = $user->fields()->with('activeCycle', 'farmer')->orderBy('id')->get();
        $alerts = $fields->flatMap(fn ($f) => collect($agronomy->assessWeather($f->weather)['alerts'])
            ->map(fn ($a) => $a + ['field_id' => $f->id, 'field_name' => $f->name]))
            ->sortBy(fn ($a) => ['high' => 0, 'medium' => 1, 'low' => 2][$a['level']])
            ->values()->take(3);

        return response()->json([
            'level' => $game->level($user->xp),
            'quests' => $game->quests($user),
            'badges' => $game->badges($user),
            'fields' => $fields->map(fn ($f) => $this->present->field($f)),
            'alerts' => $alerts,
            'totals' => [
                'acres' => round($fields->sum('area_acres'), 2),
                'growing' => $fields->filter(fn ($f) => $f->activeCycle)->count(),
                'expected_kg' => $fields->filter(fn ($f) => $f->activeCycle)->sum(fn ($f) => $agronomy->estimateYield($f, $f->activeCycle)['mid_kg']),
            ],
        ]);
    }

    public function officer(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->isRole('officer'), 403);

        $fields = Field::query()->visibleTo($user)->with('activeCycle', 'farmer')->orderBy('id')->get();
        $inDistrict = fn ($q) => $q->where('district', $user->district);

        return response()->json([
            'district' => $user->district,
            'fields' => $fields->map(fn ($f) => $this->present->field($f)),
            'stats' => [
                'lands' => $fields->count(),
                'farmers' => $fields->pluck('farmer_id')->unique()->count(),
                'pending' => Scan::where('status', 'pending')->whereHas('field', $inDistrict)->count(),
                'urgent' => $fields->whereIn('health_status', ['urgent', 'treat'])->count(),
                'weather_risk' => $fields->where('weather_risk', 'high')->count(),
                'reviewed_today' => Scan::where('reviewed_by', $user->id)->whereDate('reviewed_at', today())->count(),
                'reviewed_week' => Scan::where('reviewed_by', $user->id)->where('reviewed_at', '>=', now()->subWeek())->count(),
            ],
        ]);
    }

    public function agent(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->isRole('agent'), 403);

        $fields = Field::query()->visibleTo($user)->with('activeCycle', 'farmer')->orderBy('id')->get();
        $due = $fields->filter(fn ($f) => ! $f->last_scan_at || $f->last_scan_at->lt(now()->subDays(7)))->values();

        return response()->json([
            'fields' => $fields->map(fn ($f) => $this->present->field($f)),
            'visit_queue' => $due->map(fn ($f) => $this->present->field($f)),
            'farmers' => User::where('agent_id', $user->id)->withCount('fields')->orderBy('name')->get(['id', 'name', 'phone', 'village', 'district']),
            'stats' => [
                'farmers' => User::where('agent_id', $user->id)->count(),
                'lands' => $fields->count(),
                'due' => $due->count(),
                'scans_today' => Scan::where('submitted_by', $user->id)->whereDate('created_at', today())->count(),
            ],
        ]);
    }

    /** Agents register farmers who have no smartphone, or link an unassigned one by phone. */
    public function addFarmer(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->isRole('agent'), 403);

        $data = $request->validate([
            'name' => 'required|string|max:120',
            'phone' => 'required|string|max:20',
            'village' => 'nullable|string|max:120',
            'upazila' => 'nullable|string|max:80',
        ]);

        $existing = User::where('phone', $data['phone'])->first();
        if ($existing) {
            abort_unless(
                $existing->role === 'farmer' && $existing->district === $user->district && in_array($existing->agent_id, [null, $user->id]),
                409,
                'This phone number belongs to another account.',
            );
            $existing->update(['agent_id' => $user->id]);

            return response()->json(['farmer' => $existing->only(['id', 'name', 'phone', 'village', 'district']), 'linked' => true]);
        }

        // The farmer cannot sign in until a password is reset; the agent acts on their behalf.
        $farmer = User::create($data + [
            'role' => 'farmer',
            'district' => $user->district,
            'agent_id' => $user->id,
            'password' => bin2hex(random_bytes(16)),
        ]);

        return response()->json(['farmer' => $farmer->only(['id', 'name', 'phone', 'village', 'district']), 'linked' => false], 201);
    }

    public function catalog(): JsonResponse
    {
        $crops = collect(config('agri.crops'))->map(fn ($c, $id) => [
            'id' => $id,
            'en' => $c['en'],
            'bn' => $c['bn'],
            'emoji' => $c['emoji'],
            'days' => $c['days'],
            'reference_price' => $c['price'],
        ])->values();

        return response()->json(['crops' => $crops]);
    }
}
