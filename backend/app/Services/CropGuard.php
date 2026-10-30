<?php

namespace App\Services;

class CropGuard
{
    private const SEVERITIES = ['none', 'low', 'medium', 'high'];

    public function __construct(private NovaClient $nova) {}

    /** @param string[] $paths absolute paths of the submitted photos */
    public function analyze(array $paths, ?string $crop): array
    {
        return $this->withVision($paths, $crop) ?? $this->withColorRules($paths);
    }

    private function withVision(array $paths, ?string $crop): ?array
    {
        $cropName = $crop ? config("agri.crops.$crop.en", $crop) : 'unknown crop';
        $content = [['type' => 'text', 'text' => "You help agriculture officers in Bangladesh triage crop photos. Crop: {$cropName}. "
            .'Look at the photos and reply with JSON only: {"label": snake_case issue or "healthy" or "unknown", "name_en": string, "name_bn": string, '
            .'"confidence": 0-1, "severity": "none"|"low"|"medium"|"high", "summary_en": one sentence, "summary_bn": one sentence in Bangla, '
            .'"steps_en": up to 3 short actions, "steps_bn": same actions in Bangla}. Follow BRRI/DAE practice. Never give chemical doses. '
            .'If the photos are unclear or not a crop, use label "unknown" with low confidence.']];
        foreach (array_slice($paths, 0, 4) as $path) {
            $mime = mime_content_type($path) ?: 'image/jpeg';
            $content[] = ['type' => 'image_url', 'image_url' => ['url' => "data:$mime;base64,".base64_encode(file_get_contents($path))]];
        }

        $reply = $this->nova->json([['role' => 'user', 'content' => $content]], 'nova_g', 60);
        if (! $reply || empty($reply['label'])) {
            return null;
        }

        $known = config('agri.diseases.unknown');

        return $this->finish([
            'label' => (string) $reply['label'],
            'name_en' => (string) ($reply['name_en'] ?? $known['en']),
            'name_bn' => (string) ($reply['name_bn'] ?? $known['bn']),
            'confidence' => min(1, max(0, (float) ($reply['confidence'] ?? 0))),
            'severity' => in_array($reply['severity'] ?? null, self::SEVERITIES, true) ? $reply['severity'] : 'low',
            'summary_en' => (string) ($reply['summary_en'] ?? ''),
            'summary_bn' => (string) ($reply['summary_bn'] ?? ''),
            'steps_en' => array_values(array_slice((array) ($reply['steps_en'] ?? []), 0, 3)),
            'steps_bn' => array_values(array_slice((array) ($reply['steps_bn'] ?? []), 0, 3)),
        ], 'nova');
    }

    /** Pixel-colour triage used when vision AI is unavailable. It is only a hint for the officer. */
    private function withColorRules(array $paths): array
    {
        $totals = ['green' => 0, 'yellow' => 0, 'brown' => 0, 'n' => 0];
        foreach ($paths as $path) {
            $raw = @file_get_contents($path);
            $image = $raw ? @imagecreatefromstring($raw) : false;
            if (! $image) {
                continue;
            }
            $small = imagescale($image, 48, 48);
            for ($x = 0; $x < 48; $x++) {
                for ($y = 0; $y < 48; $y++) {
                    $c = imagecolorat($small, $x, $y);
                    [$r, $g, $b] = [($c >> 16) & 255, ($c >> 8) & 255, $c & 255];
                    $totals['n']++;
                    if ($g > $r * 1.05 && $g > $b * 1.1) {
                        $totals['green']++;
                    } elseif ($r > 150 && $g > 130 && $b < $g * 0.7) {
                        $totals['yellow']++;
                    } elseif ($r > $g * 1.15 && $r > $b * 1.3) {
                        $totals['brown']++;
                    }
                }
            }
        }

        $n = max(1, $totals['n']);
        [$green, $yellow, $brown] = [$totals['green'] / $n, $totals['yellow'] / $n, $totals['brown'] / $n];
        $plant = $green + $yellow + $brown;

        [$label, $confidence] = match (true) {
            $plant < 0.35 => ['unknown', 0.2],
            $brown > 0.18 => ['brown_spot', 0.45],
            $yellow > 0.2 => ['leaf_yellowing', 0.45],
            $green > 0.5 => ['healthy', 0.55],
            default => ['unknown', 0.3],
        };
        $d = config("agri.diseases.$label");

        return $this->finish([
            'label' => $label,
            'name_en' => $d['en'],
            'name_bn' => $d['bn'],
            'confidence' => $confidence,
            'severity' => $d['severity'],
            'summary_en' => 'Quick colour check only. An officer will confirm.',
            'summary_bn' => 'শুধু রঙ দেখে প্রাথমিক ধারণা। কর্মকর্তা নিশ্চিত করবেন।',
            'steps_en' => $d['steps_en'],
            'steps_bn' => $d['steps_bn'],
        ], 'color-rules');
    }

    private function finish(array $result, string $source): array
    {
        return $result + [
            'source' => $source,
            'chemical_note_en' => config('agri.chemical_note.en'),
            'chemical_note_bn' => config('agri.chemical_note.bn'),
        ];
    }
}
