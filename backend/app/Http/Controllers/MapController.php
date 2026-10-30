<?php

namespace App\Http\Controllers;

use App\Services\AtlasClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/** Keeps the Atlas key on the server: the browser only ever talks to these routes. */
class MapController extends Controller
{
    public function tile(AtlasClient $atlas, string $style, int $z, int $x, int $y): Response
    {
        abort_unless($z <= 21 && $x >= 0 && $y >= 0 && $x < 2 ** $z && $y < 2 ** $z, 404);
        $tile = $atlas->tile($style, $z, $x, $y);
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
}
