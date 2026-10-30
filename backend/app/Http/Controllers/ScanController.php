<?php

namespace App\Http\Controllers;

use App\Models\Field;
use App\Models\Guidance;
use App\Models\Scan;
use App\Services\Agronomy;
use App\Services\CropGuard;
use App\Services\Game;
use App\Services\Presenter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class ScanController extends Controller
{
    public function __construct(private Presenter $present, private Agronomy $agronomy) {}

    public function store(Request $request, Field $field, CropGuard $guard, Game $game): JsonResponse
    {
        abort_unless($field->isManagedBy($request->user()), 403);
        $data = $request->validate([
            'photos' => 'required|array|min:1|max:6',
            'photos.*' => 'required|image|mimes:jpg,jpeg,png,webp|max:8192',
            'note' => 'nullable|string|max:1000',
        ]);

        $cycle = $field->activeCycle;
        $stored = collect($request->file('photos'))->map(fn ($file) => $file->store("scans/{$field->id}", 'public'));
        $ai = $guard->analyze(
            $stored->map(fn ($path) => Storage::disk('public')->path($path))->all(),
            $cycle?->crop,
        );

        $scan = DB::transaction(function () use ($request, $field, $cycle, $data, $ai, $stored) {
            $scan = Scan::create([
                'field_id' => $field->id,
                'crop_cycle_id' => $cycle?->id,
                'submitted_by' => $request->user()->id,
                'note' => $data['note'] ?? null,
                'ai' => $ai,
                'status' => 'pending',
            ]);
            $scan->photos()->createMany($stored->map(fn ($path) => ['path' => $path])->all());
            $this->agronomy->applyScan($field, $scan);

            return $scan;
        });
        $game->award($field->farmer, 'scan', $field->id.'-'.today()->toDateString());

        return response()->json(['scan' => $this->present->scan($scan->load('photos', 'submitter'))], 201);
    }

    /** The officer's review queue, most severe AI findings first. */
    public function queue(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->isRole('officer'), 403);

        $rank = ['high' => 0, 'medium' => 1, 'low' => 2, 'none' => 3];
        $scans = Scan::where('status', 'pending')
            ->whereHas('field', fn ($q) => $q->where('district', $user->district))
            ->with('photos', 'submitter', 'field.farmer', 'field.activeCycle')
            ->oldest()->take(100)->get()
            ->sortBy(fn ($s) => $rank[$s->ai['severity'] ?? 'low'] ?? 2)->values();

        return response()->json(['scans' => $scans->map(fn ($s) => $this->present->scan($s) + ['field' => $this->present->field($s->field)])]);
    }

    public function review(Request $request, Scan $scan): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->isRole('officer') && $scan->field->district === $user->district, 403);
        abort_unless($scan->status === 'pending', 409, 'This scan was already reviewed.');

        $data = $request->validate([
            'verdict' => ['required', Rule::in(['healthy', 'watch', 'treat', 'urgent'])],
            'title' => 'required|string|max:120',
            'body' => 'required|string|max:2000',
            'due_on' => 'nullable|date|after_or_equal:today',
        ]);

        DB::transaction(function () use ($scan, $user, $data) {
            $scan->update([
                'status' => 'reviewed',
                'verdict' => $data['verdict'],
                'reviewed_by' => $user->id,
                'reviewed_at' => now(),
            ]);
            Guidance::create([
                'field_id' => $scan->field_id,
                'officer_id' => $user->id,
                'scan_id' => $scan->id,
                'priority' => $data['verdict'] === 'urgent' ? 'urgent' : 'normal',
                'title' => $data['title'],
                'body' => $data['body'],
                'due_on' => $data['due_on'] ?? null,
            ]);
            // Only the latest scan decides how the land looks on the map.
            if ($scan->field->scans()->latest('id')->value('id') === $scan->id) {
                $this->agronomy->applyScan($scan->field, $scan);
            }
        });

        return response()->json(['scan' => $this->present->scan($scan->fresh(['photos', 'submitter', 'reviewer']))]);
    }
}
