<?php

namespace App\Services;

use App\Models\Field;
use App\Models\Guidance;
use App\Models\Offer;
use App\Models\Scan;

class Presenter
{
    public function __construct(private Agronomy $agronomy) {}

    public function field(Field $field): array
    {
        $cycle = $field->activeCycle;
        $crop = $cycle ? config("agri.crops.{$cycle->crop}") : null;
        $assessment = $this->agronomy->assessWeather($field->weather);

        return [
            'id' => $field->id,
            'name' => $field->name,
            'boundary' => $field->boundary,
            'lat' => $field->lat,
            'lng' => $field->lng,
            'area_acres' => round($field->area_acres, 2),
            'district' => $field->district,
            'upazila' => $field->upazila,
            'village' => $field->village,
            'health_status' => $field->health_status,
            'health_score' => $field->health_score,
            'last_scan_at' => $field->last_scan_at?->toIso8601String(),
            'weather_risk' => $assessment['risk'],
            'farmer' => $field->relationLoaded('farmer') && $field->farmer ? [
                'id' => $field->farmer->id,
                'name' => $field->farmer->name,
                'phone' => $field->farmer->phone,
                'village' => $field->farmer->village,
            ] : null,
            'cycle' => $cycle ? [
                'id' => $cycle->id,
                'crop' => $cycle->crop,
                'variety' => $cycle->variety,
                'en' => $crop['en'],
                'bn' => $crop['bn'],
                'emoji' => $crop['emoji'],
                'sown_on' => $cycle->sown_on->toDateString(),
                'expected_harvest_on' => $cycle->expected_harvest_on->toDateString(),
                'progress' => $this->agronomy->progress($cycle),
            ] : null,
        ];
    }

    public function fieldDetail(Field $field): array
    {
        $field->loadMissing('farmer', 'activeCycle');
        $cycle = $field->activeCycle;
        $assessment = $this->agronomy->assessWeather($field->weather);

        return $this->field($field) + [
            'weather' => $field->weather,
            'weather_synced_at' => $field->weather_synced_at?->toIso8601String(),
            'alerts' => $assessment['alerts'],
            'advice' => $this->agronomy->todayAdvice($field, $cycle),
            'yield' => $cycle ? $this->agronomy->estimateYield($field, $cycle) : null,
            'next_crops' => $this->agronomy->nextCrops($field),
            'scans' => $field->scans()->with('photos', 'submitter', 'reviewer')->latest()->take(10)->get()->map(fn ($s) => $this->scan($s))->all(),
            'guidance' => $field->guidance()->with('officer')->latest()->take(20)->get()->map(fn ($g) => $this->guidance($g))->all(),
            'history' => $field->cycles()->where('status', 'harvested')->latest('harvested_on')->take(10)->get()->map(fn ($c) => [
                'id' => $c->id,
                'crop' => $c->crop,
                'en' => config("agri.crops.{$c->crop}.en"),
                'bn' => config("agri.crops.{$c->crop}.bn"),
                'emoji' => config("agri.crops.{$c->crop}.emoji"),
                'harvested_on' => $c->harvested_on?->toDateString(),
                'actual_yield_kg' => $c->actual_yield_kg,
            ])->all(),
        ];
    }

    public function scan(Scan $scan): array
    {
        return [
            'id' => $scan->id,
            'field_id' => $scan->field_id,
            'note' => $scan->note,
            'ai' => $scan->ai,
            'status' => $scan->status,
            'verdict' => $scan->verdict,
            'reviewed_at' => $scan->reviewed_at?->toIso8601String(),
            'reviewer' => $scan->reviewer?->name,
            'submitted_by' => $scan->submitter?->name,
            'created_at' => $scan->created_at->toIso8601String(),
            'photos' => $scan->photos->map(fn ($p) => '/storage/'.$p->path)->all(),
        ];
    }

    public function guidance(Guidance $g): array
    {
        return [
            'id' => $g->id,
            'field_id' => $g->field_id,
            'field_name' => $g->relationLoaded('field') ? $g->field?->name : null,
            'scan_id' => $g->scan_id,
            'priority' => $g->priority,
            'title' => $g->title,
            'body' => $g->body,
            'due_on' => $g->due_on?->toDateString(),
            'done_at' => $g->done_at?->toIso8601String(),
            'officer' => $g->officer?->name,
            'created_at' => $g->created_at->toIso8601String(),
        ];
    }

    public function offer(Offer $offer, int $viewerId): array
    {
        $offer->loadMissing('rounds.user', 'buyer', 'farmer', 'listing', 'buyPost');
        $crop = $offer->listing?->crop ?? $offer->buyPost?->crop;

        return [
            'id' => $offer->id,
            'source' => $offer->listing_id ? 'listing' : 'buy_post',
            'listing_id' => $offer->listing_id,
            'buy_post_id' => $offer->buy_post_id,
            'crop' => $crop,
            'crop_en' => config("agri.crops.$crop.en"),
            'crop_bn' => config("agri.crops.$crop.bn"),
            'emoji' => config("agri.crops.$crop.emoji"),
            'status' => $offer->status,
            'quantity_kg' => $offer->quantity_kg,
            'price_per_kg' => $offer->price_per_kg,
            'buyer' => ['name' => $offer->buyer->name, 'organization' => $offer->buyer->organization, 'type' => $offer->buyer->buyer_type],
            'farmer' => ['name' => $offer->farmer->name, 'district' => $offer->farmer->district],
            'my_turn' => $offer->status === 'pending' && $offer->turn_user_id === $viewerId,
            'rounds' => $offer->rounds->map(fn ($r) => [
                'mine' => $r->user_id === $viewerId,
                'by' => $r->user->name,
                'quantity_kg' => $r->quantity_kg,
                'price_per_kg' => $r->price_per_kg,
                'note' => $r->note,
                'at' => $r->created_at->toIso8601String(),
            ])->all(),
            'updated_at' => $offer->updated_at->toIso8601String(),
        ];
    }
}
