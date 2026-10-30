<?php

use App\Models\Field;
use App\Services\WeatherSync;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('agrinest:sync-weather', function (WeatherSync $weather) {
    Field::query()->chunkById(100, fn ($fields) => $fields->each(fn ($field) => $weather->sync($field)));
    $this->info('Weather synced for '.Field::count().' fields.');
})->purpose('Refresh Atlas weather and risk for every field');

Schedule::command('agrinest:sync-weather')->hourly()->withoutOverlapping();
