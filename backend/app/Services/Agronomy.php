<?php

namespace App\Services;

use App\Models\CropCycle;
use App\Models\Field;
use App\Models\Scan;

/** Rule engines for Precision Farm, Climate Smart and YieldMax. */
class Agronomy
{
    private const SEVERITY_TO_STATUS = ['none' => 'healthy', 'low' => 'watch', 'medium' => 'treat', 'high' => 'urgent'];

    private const STATUS_SCORE = ['healthy' => 90, 'watch' => 65, 'treat' => 40, 'urgent' => 20];

    private const ACRES_PER_HA = 2.47105;

    public function crop(string $id): array
    {
        return config("agri.crops.$id") ?? abort(422, 'Unknown crop');
    }

    /** Where a cycle is in its season. */
    public function progress(CropCycle $cycle): array
    {
        $crop = $this->crop($cycle->crop);
        $total = max(1, (int) $cycle->sown_on->diffInDays($cycle->expected_harvest_on));
        $day = max(0, (int) $cycle->sown_on->startOfDay()->diffInDays(today(), false));
        $pct = min(1, $day / $total);
        $stage = collect($crop['stages'])->first(fn ($s) => $pct < $s['until']) ?? end($crop['stages']);

        return [
            'day' => $day,
            'total_days' => $total,
            'pct' => round($pct * 100),
            'stage' => $stage,
            'harvest_in_days' => (int) today()->diffInDays($cycle->expected_harvest_on, false),
            'ready' => $pct >= 0.95,
        ];
    }

    /** Field health from one scan: the officer's verdict always outranks the AI. */
    public function applyScan(Field $field, Scan $scan): void
    {
        $status = $scan->verdict ?? (self::SEVERITY_TO_STATUS[$scan->ai['severity'] ?? 'low'] ?? 'watch');
        $field->forceFill([
            'health_status' => $status,
            'health_score' => self::STATUS_SCORE[$status],
            'last_scan_at' => $scan->created_at,
        ])->save();
    }

    /** Field-level risks from Atlas's daily forecast. */
    public function assessWeather(?array $weather): array
    {
        if (! $weather || empty($weather['daily'])) {
            return ['risk' => 'none', 'alerts' => []];
        }
        $days = array_slice($weather['daily'], 0, 5);
        $next = array_slice($days, 0, 3);
        $alerts = [];

        $wetDays = count(array_filter($next, fn ($d) => ($d['rain_chance'] ?? 0) >= 75));
        if ($wetDays >= 2) {
            $alerts[] = ['code' => 'heavy_rain', 'level' => 'high', 'en' => 'Rain likely on most of the next 3 days. Clear the drains and do not spray or fertilize.', 'bn' => 'আগামী ৩ দিনের বেশিরভাগ সময় বৃষ্টির সম্ভাবনা। নালা পরিষ্কার রাখুন, স্প্রে বা সার দেবেন না।'];
        }
        if (collect($next)->contains(fn ($d) => ($d['wind_kph'] ?? 0) >= 40)) {
            $alerts[] = ['code' => 'storm', 'level' => 'high', 'en' => 'Strong wind expected. Support tall plants and harvest anything that is ready.', 'bn' => 'প্রবল বাতাসের সম্ভাবনা। লম্বা গাছে ঠেকা দিন, পাকা ফসল কেটে ফেলুন।'];
        }
        if (collect($next)->contains(fn ($d) => ($d['high_c'] ?? 0) >= 36)) {
            $alerts[] = ['code' => 'heat', 'level' => 'medium', 'en' => 'Very hot days ahead. Water early morning or late afternoon.', 'bn' => 'সামনে খুব গরম। ভোরে বা বিকেলে সেচ দিন।'];
        }
        if (collect($next)->contains(fn ($d) => ($d['humidity'] ?? 0) >= 85 && ($d['rain_chance'] ?? 0) >= 50)) {
            $alerts[] = ['code' => 'fungal', 'level' => 'medium', 'en' => 'Warm and damp weather can spread fungal disease. Check your leaves and send a scan.', 'bn' => 'আর্দ্র আবহাওয়ায় ছত্রাক রোগ ছড়াতে পারে। পাতা দেখে একটি স্ক্যান পাঠান।'];
        }
        if (count($days) >= 5 && collect($days)->every(fn ($d) => ($d['rain_chance'] ?? 0) < 20)) {
            $alerts[] = ['code' => 'dry', 'level' => 'low', 'en' => 'No rain likely for 5 days. Plan your irrigation.', 'bn' => '৫ দিন বৃষ্টির সম্ভাবনা কম। সেচের পরিকল্পনা করুন।'];
        }

        $risk = 'none';
        foreach (['low', 'medium', 'high'] as $level) {
            if (collect($alerts)->contains('level', $level)) {
                $risk = $level;
            }
        }

        return ['risk' => $risk, 'alerts' => $alerts];
    }

    /** Today's plain-language to-do list for a field. */
    public function todayAdvice(Field $field, ?CropCycle $cycle): array
    {
        if (! $cycle) {
            return [];
        }
        $crop = $this->crop($cycle->crop);
        $progress = $this->progress($cycle);
        $rainSoon = collect(array_slice($field->weather['daily'] ?? [], 0, 2))->max('rain_chance') ?? 0;
        $hasForecast = ! empty($field->weather['daily']);
        $advice = [];

        if ($progress['ready']) {
            $advice[] = ['icon' => 'harvest', 'en' => 'Your crop is ready. Plan the harvest'.($rainSoon >= 60 ? ' before the rain comes.' : '.'), 'bn' => 'ফসল তোলার সময় হয়েছে।'.($rainSoon >= 60 ? ' বৃষ্টির আগেই কেটে ফেলুন।' : ' কাটার পরিকল্পনা করুন।')];

            return $advice;
        }

        if (! $hasForecast) {
            $advice[] = ['icon' => 'water', 'en' => 'Forecast is unavailable, so check the soil before watering.', 'bn' => 'পূর্বাভাস পাওয়া যায়নি, সেচের আগে মাটি দেখে নিন।'];
        } elseif ($rainSoon >= 60) {
            $advice[] = ['icon' => 'water', 'en' => "Skip watering. {$rainSoon}% chance of rain soon.", 'bn' => "সেচ দেবেন না। শিগগিরই {$rainSoon}% বৃষ্টির সম্ভাবনা।"];
        } elseif ($crop['water'] === 'high' || $progress['stage']['id'] === 'flowering') {
            $advice[] = ['icon' => 'water', 'en' => 'Water today. This stage needs steady moisture.', 'bn' => 'আজ সেচ দিন। এই পর্যায়ে নিয়মিত পানি দরকার।'];
        } else {
            $advice[] = ['icon' => 'water', 'en' => 'Check the soil and water only if it feels dry.', 'bn' => 'মাটি দেখুন, শুকনো হলে তবেই সেচ দিন।'];
        }

        if (in_array($progress['stage']['id'], $crop['fertilize_at'], true)) {
            $advice[] = $rainSoon >= 60
                ? ['icon' => 'fertilizer', 'en' => 'Fertilizer is due, but wait until the rain passes.', 'bn' => 'সারের সময় হয়েছে, তবে বৃষ্টি থামা পর্যন্ত অপেক্ষা করুন।']
                : ['icon' => 'fertilizer', 'en' => 'Good time for the fertilizer top-up. Ask your officer for the amount.', 'bn' => 'উপরি সার দেওয়ার ভালো সময়। পরিমাণ কর্মকর্তার কাছে জেনে নিন।'];
        }

        if (! $field->last_scan_at || $field->last_scan_at->lt(now()->subDays(7))) {
            $advice[] = ['icon' => 'scan', 'en' => 'Take new photos so the officer can check this land.', 'bn' => 'কর্মকর্তা যেন দেখতে পারেন, নতুন ছবি পাঠান।'];
        }

        return $advice;
    }

    /** YieldMax: baseline × health × weather, corrected by this field's own past harvests. */
    public function estimateYield(Field $field, CropCycle $cycle): array
    {
        $crop = $this->crop($cycle->crop);
        $baselineKg = $crop['t_per_ha'] * 1000 * ($field->area_acres / self::ACRES_PER_HA);
        $health = ['healthy' => 1.0, 'watch' => 0.92, 'treat' => 0.8, 'urgent' => 0.65, 'unknown' => 0.95][$field->health_status] ?? 0.95;
        $weather = ['none' => 1.0, 'low' => 0.98, 'medium' => 0.95, 'high' => 0.9][$field->weather_risk] ?? 1.0;

        $past = $field->cycles()->where('status', 'harvested')->where('crop', $cycle->crop)->whereNotNull('actual_yield_kg')->get();
        $learned = 1.0;
        if ($past->isNotEmpty()) {
            $ratio = $past->avg(fn ($c) => $c->actual_yield_kg / max(1, $baselineKg));
            $weight = $past->count() / ($past->count() + 2);
            $learned = (1 - $weight) * 1.0 + $weight * $ratio;
        }

        $mid = $baselineKg * $health * $weather * $learned;
        $spread = max(0.08, 0.25 - 0.05 * $past->count());

        return [
            'low_kg' => (int) round($mid * (1 - $spread)),
            'mid_kg' => (int) round($mid),
            'high_kg' => (int) round($mid * (1 + $spread)),
            'potential_kg' => (int) round($baselineKg * $learned),
            'confidence' => $past->count() >= 3 ? 'high' : ($past->isNotEmpty() ? 'medium' : 'starter'),
            'seasons_learned' => $past->count(),
        ];
    }

    /** YieldMax: rank what to plant next from season, rotation and this field's own results. */
    public function nextCrops(Field $field): array
    {
        $history = $field->cycles()->where('status', 'harvested')->latest('harvested_on')->get();
        $last = $history->first();
        $lastFamily = $last ? config("agri.crops.{$last->crop}.family") : null;
        $month = (int) today()->month;
        $soon = [$month, $month % 12 + 1];
        $flooded = $field->weather_risk === 'high';

        return collect(config('agri.crops'))->map(function ($crop, $id) use ($history, $lastFamily, $soon, $flooded, $field) {
            $score = 40;
            $reasons = [];

            if (array_intersect($soon, $crop['sow_months'])) {
                $score += 30;
                $reasons[] = ['en' => 'Right sowing time', 'bn' => 'বপনের উপযুক্ত সময়'];
            } else {
                $score -= 30;
            }
            if ($lastFamily && $crop['family'] === $lastFamily) {
                $score -= 15;
                $reasons[] = ['en' => 'Same family as last crop', 'bn' => 'আগের ফসলের একই পরিবার'];
            } elseif ($lastFamily) {
                $score += 10;
                $reasons[] = ['en' => 'Good rotation', 'bn' => 'ভালো ফসল পরিক্রমা'];
            }
            if ($crop['family'] === 'legume' && $lastFamily === 'cereal') {
                $score += 8;
                $reasons[] = ['en' => 'Restores soil nitrogen', 'bn' => 'মাটিতে নাইট্রোজেন ফেরায়'];
            }
            if ($flooded && $crop['water'] === 'low') {
                $score -= 8;
            }

            $own = $history->where('crop', $id)->whereNotNull('actual_yield_kg');
            if ($own->isNotEmpty()) {
                $baseline = $crop['t_per_ha'] * 1000 * ($field->area_acres / self::ACRES_PER_HA);
                $ratio = $own->avg('actual_yield_kg') / max(1, $baseline);
                $score += (int) max(-15, min(15, ($ratio - 1) * 30));
                if ($ratio >= 1) {
                    $reasons[] = ['en' => 'Did well on this land before', 'bn' => 'এই জমিতে আগে ভালো ফলন হয়েছে'];
                }
            }

            $kg = $crop['t_per_ha'] * 1000 * ($field->area_acres / self::ACRES_PER_HA);

            return [
                'crop' => $id,
                'en' => $crop['en'],
                'bn' => $crop['bn'],
                'emoji' => $crop['emoji'],
                'score' => max(0, min(100, $score)),
                'expected_kg' => (int) round($kg),
                'expected_value_bdt' => (int) round($kg * $crop['price']),
                'reasons' => $reasons,
            ];
        })->sortByDesc('score')->values()->take(3)->all();
    }
}
