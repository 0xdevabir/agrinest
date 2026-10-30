<?php

namespace App\Http\Controllers;

use App\Models\Field;
use App\Models\Guidance;
use App\Services\Game;
use App\Services\Presenter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class GuidanceController extends Controller
{
    public function __construct(private Presenter $present) {}

    public function index(Request $request): JsonResponse
    {
        $items = Guidance::whereIn('field_id', Field::query()->visibleTo($request->user())->select('id'))
            ->with('field', 'officer')->latest()->take(50)->get();

        return response()->json(['guidance' => $items->map(fn ($g) => $this->present->guidance($g))]);
    }

    public function store(Request $request, Field $field): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->isRole('officer') && $field->district === $user->district, 403);

        $data = $request->validate([
            'title' => 'required|string|max:120',
            'body' => 'required|string|max:2000',
            'priority' => ['nullable', Rule::in(['normal', 'urgent'])],
            'due_on' => 'nullable|date|after_or_equal:today',
        ]);
        $guidance = $field->guidance()->create($data + ['officer_id' => $user->id]);

        return response()->json(['guidance' => $this->present->guidance($guidance->load('field', 'officer'))], 201);
    }

    public function done(Request $request, Guidance $guidance, Game $game): JsonResponse
    {
        abort_unless($guidance->field->isManagedBy($request->user()), 403);
        if (! $guidance->done_at) {
            $guidance->update(['done_at' => now()]);
            $game->award($guidance->field->farmer, 'guidance_done', $guidance->id);
        }

        return response()->json(['guidance' => $this->present->guidance($guidance->load('field', 'officer'))]);
    }
}
