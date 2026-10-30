<?php

namespace App\Services;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class AtlasClient
{
    private function http(int $timeout = 10): PendingRequest
    {
        return Http::baseUrl(config('services.atlas.url'))
            ->withHeaders(['x-api-key' => (string) config('services.atlas.key')])
            ->timeout($timeout);
    }

    /** Daily forecast for a point, cached on a ~1 km grid. Null when Atlas is unreachable. */
    public function forecast(float $lat, float $lng): ?array
    {
        $key = sprintf('atlas:forecast:%.2f:%.2f', $lat, $lng);
        if ($cached = Cache::get($key)) {
            return $cached;
        }

        try {
            $response = $this->http()->get('/v1/weather/forecast', ['lat' => $lat, 'lng' => $lng]);
        } catch (ConnectionException) {
            return null;
        }
        $data = $response->successful() ? $response->json('data') : null;
        if (! is_array($data) || empty($data['daily'])) {
            return null;
        }

        $weather = [
            'place' => $data['place'] ?? null,
            'current' => [
                'condition' => $data['current']['condition'] ?? null,
                'temp_c' => $data['current']['temperatureC'] ?? null,
                'humidity' => $data['current']['humidity'] ?? null,
                'rain_chance' => $data['current']['precipitationChance'] ?? null,
                'wind_kph' => $data['current']['windKph'] ?? null,
                'icon' => $data['current']['iconUrl'] ?? null,
            ],
            'daily' => array_map(fn ($d) => [
                'day' => $d['day'] ?? null,
                'condition' => $d['condition'] ?? null,
                'high_c' => $d['highC'] ?? null,
                'humidity' => $d['humidity'] ?? null,
                'rain_chance' => $d['precipitationChance'] ?? null,
                'wind_kph' => $d['windKph'] ?? null,
                'icon' => $d['iconUrl'] ?? null,
            ], $data['daily']),
        ];
        Cache::put($key, $weather, now()->addMinutes(30));

        return $weather;
    }

    /** @return array{district: ?string, upazila: ?string, village: ?string, address: ?string} */
    public function locate(float $lat, float $lng): array
    {
        $empty = ['district' => null, 'upazila' => null, 'village' => null, 'address' => null];
        try {
            $response = $this->http()->get('/v1/reverse-geocode', ['lat' => $lat, 'lng' => $lng]);
            $first = $response->successful() ? $response->json('data.0') : null;
        } catch (ConnectionException) {
            return $empty;
        }
        if (! $first) {
            return $empty;
        }

        $byType = [];
        foreach ($first['addressComponents'] ?? [] as $c) {
            foreach ($c['types'] ?? [] as $type) {
                $byType[$type] ??= $c['longName'] ?? null;
            }
        }

        return [
            'district' => $byType['administrative_area_level_2'] ?? $byType['locality'] ?? null,
            'upazila' => $byType['administrative_area_level_3'] ?? $byType['sublocality'] ?? null,
            'village' => $byType['neighborhood'] ?? $byType['sublocality_level_1'] ?? null,
            'address' => $first['formattedAddress'] ?? null,
        ];
    }

    public function search(string $query): array
    {
        try {
            $response = $this->http()->get('/v1/geocode', ['address' => $query.', Bangladesh']);
        } catch (ConnectionException) {
            return [];
        }

        return collect($response->successful() ? $response->json('data', []) : [])
            ->map(fn ($r) => ['label' => $r['formattedAddress'] ?? $query, 'lat' => $r['location']['lat'] ?? null, 'lng' => $r['location']['lng'] ?? null])
            ->filter(fn ($r) => $r['lat'] !== null)
            ->values()->all();
    }

    /** @return array{body: string, type: string}|null */
    public function tile(string $style, int $z, int $x, int $y): ?array
    {
        return Cache::store('file')->remember("atlas:tile:$style:$z:$x:$y", now()->addDays(7), function () use ($style, $z, $x, $y) {
            [$path, $query] = $style === 'satellite'
                ? ["/v1/maps/tiles/$z/$x/$y", ['type' => 'satellite']]
                : ["/v1/maps/atlas/$style/$z/$x/$y", []];
            try {
                $response = $this->http(15)->get($path, $query);
            } catch (ConnectionException) {
                return null;
            }

            return $response->successful()
                ? ['body' => base64_encode($response->body()), 'type' => $response->header('Content-Type') ?: 'image/png']
                : null;
        });
    }
}
