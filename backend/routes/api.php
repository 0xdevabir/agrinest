<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\FieldController;
use App\Http\Controllers\GuidanceController;
use App\Http\Controllers\MapController;
use App\Http\Controllers\MarketController;
use App\Http\Controllers\OversightController;
use App\Http\Controllers\ScanController;
use Illuminate\Support\Facades\Route;

Route::get('/health', fn () => ['status' => 'ok']);

Route::middleware('throttle:auth')->group(function () {
    Route::post('/auth/register', [AuthController::class, 'register']);
    Route::post('/auth/login', [AuthController::class, 'login']);
});

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);

    Route::get('/catalog', [DashboardController::class, 'catalog']);
    Route::get('/dashboard/farm', [DashboardController::class, 'farm']);
    Route::get('/dashboard/officer', [DashboardController::class, 'officer']);
    Route::get('/dashboard/agent', [DashboardController::class, 'agent']);
    Route::get('/dashboard/national', [OversightController::class, 'national']);
    Route::post('/agent/farmers', [DashboardController::class, 'addFarmer']);

    Route::get('/map/tiles/{style}/{z}/{x}/{y}', [MapController::class, 'tile'])
        ->whereIn('style', ['satellite', 'light', 'dark'])
        ->whereNumber(['z', 'x', 'y'])
        ->middleware('throttle:tiles');
    Route::get('/map/search', [MapController::class, 'search'])->middleware('throttle:map-search');

    Route::get('/fields', [FieldController::class, 'index']);
    Route::post('/fields', [FieldController::class, 'store']);
    Route::get('/fields/{field}', [FieldController::class, 'show']);
    Route::patch('/fields/{field}', [FieldController::class, 'update']);
    Route::delete('/fields/{field}', [FieldController::class, 'destroy']);
    Route::post('/fields/{field}/plant', [FieldController::class, 'plant']);
    Route::patch('/cycles/{cycle}', [FieldController::class, 'updateCycle']);
    Route::delete('/cycles/{cycle}', [FieldController::class, 'destroyCycle']);
    Route::post('/cycles/{cycle}/harvest', [FieldController::class, 'harvest']);

    Route::post('/fields/{field}/scans', [ScanController::class, 'store'])->middleware('throttle:scans');
    Route::get('/scans/queue', [ScanController::class, 'queue']);
    Route::post('/scans/{scan}/review', [ScanController::class, 'review']);

    Route::get('/guidance', [GuidanceController::class, 'index']);
    Route::post('/fields/{field}/guidance', [GuidanceController::class, 'store']);
    Route::post('/guidance/{guidance}/done', [GuidanceController::class, 'done']);

    Route::get('/market', [MarketController::class, 'board']);
    Route::post('/listings', [MarketController::class, 'storeListing']);
    Route::post('/listings/{listing}/close', [MarketController::class, 'closeListing']);
    Route::post('/listings/{listing}/bid', [MarketController::class, 'bid']);
    Route::post('/buy-posts', [MarketController::class, 'storeBuyPost']);
    Route::post('/buy-posts/{post}/close', [MarketController::class, 'closeBuyPost']);
    Route::post('/buy-posts/{post}/offer', [MarketController::class, 'sellToPost']);
    Route::post('/offers/{offer}/counter', [MarketController::class, 'counter']);
    Route::post('/offers/{offer}/accept', [MarketController::class, 'accept']);
    Route::post('/offers/{offer}/reject', [MarketController::class, 'reject']);
});
