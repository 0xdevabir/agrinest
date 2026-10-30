<?php

use App\Models\Field;
use App\Models\User;
use App\Services\WeatherSync;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('agrinest:sync-weather', function (WeatherSync $weather) {
    Field::query()->chunkById(100, fn ($fields) => $fields->each(fn ($field) => $weather->sync($field)));
    $this->info('Weather synced for '.Field::count().' fields.');
})->purpose('Refresh Atlas weather and risk for every field');

// Government accounts are never self-registered; this is how they are created.
Artisan::command('agrinest:provision {role : admin, officer or agent} {phone} {name} {--district=} {--organization=}', function () {
    $role = $this->argument('role');
    if (! in_array($role, ['admin', 'officer', 'agent'], true)) {
        $this->error('Role must be admin, officer or agent.');

        return 1;
    }
    if ($role !== 'admin' && ! $this->option('district')) {
        $this->error('Officers and agents need --district.');

        return 1;
    }
    if (User::where('phone', $this->argument('phone'))->exists()) {
        $this->error('This phone number already has an account.');

        return 1;
    }
    $password = $this->secret('Password (at least 8 characters)');
    if (strlen((string) $password) < 8) {
        $this->error('Password must be at least 8 characters.');

        return 1;
    }

    User::create(['role' => $role, 'phone' => $this->argument('phone'), 'name' => $this->argument('name'), 'password' => $password, 'district' => $this->option('district'), 'organization' => $this->option('organization')]);
    $this->info("Created $role account for ".$this->argument('phone').'.');
})->purpose('Create an admin, officer or agent account');

Schedule::command('agrinest:sync-weather')->hourly()->withoutOverlapping();
