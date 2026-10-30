<?php

namespace App\Http\Controllers;

use App\Models\CropCycle;
use App\Models\Field;
use App\Models\User;
use App\Services\Agronomy;
use App\Services\AtlasClient;
use App\Services\Game;
use App\Services\Geo;
use App\Services\Presenter;
use App\Services\WeatherSync;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;

class FieldController extends Controller
{
    public function __construct(private Presenter $present) {}

    public function index(Request $request): JsonResponse
    {
        $fields = Field::query()->visibleTo($request->user())
            ->with('activeCycle', 'farmer')
            ->when($request->integer('farmer_id'), fn ($q, $id) => $q->where('farmer_id', $id))
            ->orderBy('id')
            ->get();

        return response()->json(['fields' => $fields->map(fn ($f) => $this->present->field($f))]);
    }

    public function show(Request $request, Field $field, WeatherSync $weather): JsonResponse
    {
        abort_unless($field->isVisibleTo($request->user()), 403);
        if (! $field->weather_synced_at || $field->weather_synced_at->lt(now()->subHour())) {
            $weather->sync($field);
        }

        return response()->json(['field' => $this->present->fieldDetail($field)]);
    }

    public function store(Request $request, AtlasClient $atlas, WeatherSync $weather, Game $game): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->isRole('farmer', 'agent'), 403);

        $data = $request->validate([
            'name' => 'required|string|max:80',
            'points' => 'required|array|min:3|max:200',
            'farmer_id' => [Rule::requiredIf($user->role === 'agent'), 'integer', 'exists:users,id'],
        ]);

        $farmer = $user;
        if ($user->role === 'agent') {
            $farmer = User::where('role', 'farmer')->where('agent_id', $user->id)->find($data['farmer_id']);
            abort_unless($farmer, 403, 'This farmer is not assigned to you.');
        }

        $polygon = Geo::polygon($data['points']);
        abort_unless($polygon, 422, 'Boundary must be at least 3 points inside Bangladesh.');
        $ring = array_slice($polygon['coordinates'][0], 0, -1);
        $acres = Geo::acres($ring);
        abort_if($acres < 0.005 || $acres > 2000, 422, 'That land size does not look right. Please redraw it.');
        [$lat, $lng] = Geo::center($ring);

        $place = $atlas->locate($lat, $lng);
        $field = Field::create([
            'farmer_id' => $farmer->id,
            'created_by' => $user->id,
            'name' => $data['name'],
            'boundary' => $polygon,
            'lat' => $lat,
            'lng' => $lng,
            'area_acres' => $acres,
            // The farmer's profile district is the canonical one officers are assigned by.
            'district' => $farmer->district ?? $place['district'],
            'upazila' => $farmer->upazila ?? $place['upazila'],
            'village' => $farmer->village ?? $place['village'],
        ]);
        $weather->sync($field);
        $game->award($farmer, 'add_land', $field->id);

        return response()->json(['field' => $this->present->field($field->load('activeCycle', 'farmer'))], 201);
    }

    public function update(Request $request, Field $field): JsonResponse
    {
        abort_unless($field->isManagedBy($request->user()), 403);
        $field->update($request->validate(['name' => 'required|string|max:80']));

        return response()->json(['field' => $this->present->field($field->load('activeCycle', 'farmer'))]);
    }

    public function destroy(Request $request, Field $field): JsonResponse
    {
        abort_unless($field->isManagedBy($request->user()), 403);
        $field->delete();

        return response()->json(['ok' => true]);
    }

    public function plant(Request $request, Field $field, Agronomy $agronomy, Game $game): JsonResponse
    {
        abort_unless($field->isManagedBy($request->user()), 403);
        abort_if($field->activeCycle()->exists(), 409, 'This land already has a growing crop. Harvest it first.');

        $data = $request->validate([
            'crop' => ['required', Rule::in(array_keys(config('agri.crops')))],
            'variety' => 'nullable|string|max:80',
            'sown_on' => 'required|date|before_or_equal:today|after:-1 year',
        ]);
        $sown = Carbon::parse($data['sown_on']);

        $field->cycles()->create($data + [
            'expected_harvest_on' => $sown->copy()->addDays($agronomy->crop($data['crop'])['days']),
        ]);
        // A new crop starts with a clean slate; the last crop's health no longer applies.
        $field->forceFill(['health_status' => 'unknown', 'health_score' => null])->save();
        $game->award($field->farmer, 'plant_crop', $field->id.'-'.$sown->toDateString());

        return response()->json(['field' => $this->present->fieldDetail($field->fresh())], 201);
    }

    public function harvest(Request $request, CropCycle $cycle, Game $game): JsonResponse
    {
        $field = $cycle->field;
        abort_unless($field->isManagedBy($request->user()), 403);
        abort_unless($cycle->status === 'active', 409, 'This crop was already harvested.');

        $data = $request->validate(['actual_yield_kg' => 'required|numeric|min:0|max:100000000']);
        $cycle->update(['status' => 'harvested', 'harvested_on' => today(), 'actual_yield_kg' => $data['actual_yield_kg']]);
        $field->forceFill(['health_status' => 'unknown', 'health_score' => null])->save();
        $game->award($field->farmer, 'harvest', $cycle->id);

        return response()->json(['field' => $this->present->fieldDetail($field->fresh())]);
    }
}
