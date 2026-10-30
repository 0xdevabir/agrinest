<?php

namespace App\Services;

class Geo
{
    private const ACRE_M2 = 4046.8564224;

    private const EARTH_RADIUS_M = 6371008.8;

    /** @param array<array{0: float, 1: float}> $ring [lng, lat] points */
    public static function acres(array $ring): float
    {
        $sum = 0.0;
        $n = count($ring);
        for ($i = 0; $i < $n; $i++) {
            [$lng1, $lat1] = $ring[$i];
            [$lng2, $lat2] = $ring[($i + 1) % $n];
            $sum += deg2rad($lng2 - $lng1) * (2 + sin(deg2rad($lat1)) + sin(deg2rad($lat2)));
        }

        return abs($sum) * self::EARTH_RADIUS_M ** 2 / 2 / self::ACRE_M2;
    }

    /** @return array{0: float, 1: float} [lat, lng] */
    public static function center(array $ring): array
    {
        return [array_sum(array_column($ring, 1)) / count($ring), array_sum(array_column($ring, 0)) / count($ring)];
    }

    /** @param array<array{0: float, 1: float}> $ring [lng, lat] points, unclosed */
    public static function selfIntersects(array $ring): bool
    {
        $n = count($ring);
        for ($i = 0; $i < $n; $i++) {
            for ($j = $i + 2; $j < $n; $j++) {
                if ($i === 0 && $j === $n - 1) {
                    continue;
                }
                if (self::segmentsCross($ring[$i], $ring[($i + 1) % $n], $ring[$j], $ring[($j + 1) % $n])) {
                    return true;
                }
            }
        }

        return false;
    }

    private static function segmentsCross(array $a, array $b, array $c, array $d): bool
    {
        $side = fn (array $p, array $q, array $r) => ($q[0] - $p[0]) * ($r[1] - $p[1]) - ($q[1] - $p[1]) * ($r[0] - $p[0]);

        return $side($c, $d, $a) * $side($c, $d, $b) < 0 && $side($a, $b, $c) * $side($a, $b, $d) < 0;
    }

    /** Turns submitted [lng, lat] points into a closed GeoJSON polygon, or null if unusable. */
    public static function polygon(array $points): ?array
    {
        if (count($points) > 1 && $points[0] == end($points)) {
            array_pop($points);
        }
        if (count($points) < 3) {
            return null;
        }
        foreach ($points as $p) {
            if (! is_array($p) || count($p) !== 2 || ! is_numeric($p[0]) || ! is_numeric($p[1])) {
                return null;
            }
            // Bangladesh bounding box with a small margin.
            if ($p[0] < 87.9 || $p[0] > 92.8 || $p[1] < 20.5 || $p[1] > 26.8) {
                return null;
            }
        }
        $ring = array_map(fn ($p) => [(float) $p[0], (float) $p[1]], array_values($points));

        return ['type' => 'Polygon', 'coordinates' => [[...$ring, $ring[0]]]];
    }
}
