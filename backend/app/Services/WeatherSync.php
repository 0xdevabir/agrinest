<?php

namespace App\Services;

use App\Models\Field;

class WeatherSync
{
    public function __construct(private AtlasClient $atlas, private Agronomy $agronomy) {}

    /** Keeps the last good snapshot when Atlas is down, so the UI can show it as stale. */
    public function sync(Field $field): void
    {
        $weather = $this->atlas->forecast($field->lat, $field->lng);
        if (! $weather) {
            return;
        }

        $field->forceFill([
            'weather' => $weather,
            'weather_risk' => $this->agronomy->assessWeather($weather)['risk'],
            'weather_synced_at' => now(),
        ])->save();
    }
}
