<?php

namespace App\Services;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/** OpenAI-compatible Nova chat client. Every failure returns null so callers use their rule-based result. */
class NovaClient
{
    private const AUTH_FAILED = 'nova:auth-failed';

    public function json(array $messages, string $model = 'nova_c', int $timeout = 45): ?array
    {
        $key = (string) config('services.nova.key');
        if ($key === '' || Cache::has(self::AUTH_FAILED)) {
            return null;
        }

        try {
            $response = Http::baseUrl(config('services.nova.url'))
                ->withToken($key)
                ->timeout($timeout)
                ->post('/chat/completions', ['model' => $model, 'messages' => $messages]);
        } catch (ConnectionException $e) {
            Log::warning('Nova unreachable', ['error' => $e->getMessage()]);

            return null;
        }

        if ($response->status() === 401) {
            // A bad key cannot recover by itself; avoid paying the round trip on every scan.
            Cache::put(self::AUTH_FAILED, true, now()->addMinutes(10));
            Log::warning('Nova rejected the API key');

            return null;
        }
        if (! $response->successful()) {
            Log::warning('Nova request failed', ['status' => $response->status()]);

            return null;
        }

        return $this->decode((string) $response->json('choices.0.message.content'));
    }

    private function decode(string $content): ?array
    {
        $start = strpos($content, '{');
        $end = strrpos($content, '}');
        if ($start === false || $end === false) {
            return null;
        }
        $decoded = json_decode(substr($content, $start, $end - $start + 1), true);

        return is_array($decoded) ? $decoded : null;
    }
}
