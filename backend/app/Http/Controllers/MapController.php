<?php

namespace App\Http\Controllers;

use App\Services\AtlasClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/** Keeps the Atlas key on the server: the browser only ever talks to these routes. */
class MapController extends Controller
{
    public function tile(Request $request, AtlasClient $atlas, string $style, int $z, int $x, int $y): Response
    {
        abort_unless($z <= 21 && $x >= 0 && $y >= 0 && $x < 2 ** $z && $y < 2 ** $z, 404);
        $tile = $atlas->tile($style, $z, $x, $y, $request->query('lang') === 'en' ? 'en' : 'bn');
        abort_unless($tile, 502, 'Map tile unavailable');

        return response(base64_decode($tile['body']), 200, [
            'Content-Type' => $tile['type'],
            'Cache-Control' => 'private, max-age=604800',
        ]);
    }

    public function search(Request $request, AtlasClient $atlas): JsonResponse
    {
        $data = $request->validate(['q' => 'required|string|min:2|max:120']);

        return response()->json(['results' => $atlas->search($data['q'])]);
    }

    public function route(Request $request, AtlasClient $atlas): JsonResponse
    {
        $data = $request->validate([
            'from.lat' => 'required|numeric|between:-90,90',
            'from.lng' => 'required|numeric|between:-180,180',
            'to.lat' => 'required|numeric|between:-90,90',
            'to.lng' => 'required|numeric|between:-180,180',
            'mode' => 'required|in:driving,walking',
        ]);
        $route = $atlas->route($data['from'], $data['to'], $data['mode']);
        abort_unless($route, 502, 'Route unavailable');

        return response()->json(['route' => $route]);
    }
}
