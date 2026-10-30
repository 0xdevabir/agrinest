<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('users', function (Blueprint $t) {
            $t->id();
            $t->string('name');
            $t->string('phone')->unique();
            $t->string('password');
            $t->string('role')->index(); // farmer | agent | officer | buyer
            $t->string('buyer_type')->nullable(); // broker | government | company
            $t->string('organization')->nullable();
            $t->string('district')->nullable()->index();
            $t->string('upazila')->nullable();
            $t->string('village')->nullable();
            $t->foreignId('agent_id')->nullable()->constrained('users')->nullOnDelete();
            $t->unsignedInteger('xp')->default(0);
            $t->rememberToken();
            $t->timestamps();
        });

        Schema::create('sessions', function (Blueprint $t) {
            $t->string('id')->primary();
            $t->foreignId('user_id')->nullable()->index();
            $t->string('ip_address', 45)->nullable();
            $t->text('user_agent')->nullable();
            $t->longText('payload');
            $t->integer('last_activity')->index();
        });

        Schema::create('fields', function (Blueprint $t) {
            $t->id();
            $t->foreignId('farmer_id')->constrained('users')->cascadeOnDelete();
            $t->foreignId('created_by')->constrained('users');
            $t->string('name');
            $t->json('boundary'); // GeoJSON Polygon
            $t->decimal('lat', 10, 7);
            $t->decimal('lng', 10, 7);
            $t->decimal('area_acres', 10, 3);
            $t->string('district')->nullable()->index();
            $t->string('upazila')->nullable();
            $t->string('village')->nullable();
            $t->string('health_status')->default('unknown')->index(); // unknown | healthy | watch | treat | urgent
            $t->unsignedTinyInteger('health_score')->nullable();
            $t->timestamp('last_scan_at')->nullable();
            $t->json('weather')->nullable();
            $t->string('weather_risk')->default('none')->index(); // none | low | medium | high
            $t->timestamp('weather_synced_at')->nullable();
            $t->timestamps();
        });

        Schema::create('crop_cycles', function (Blueprint $t) {
            $t->id();
            $t->foreignId('field_id')->constrained()->cascadeOnDelete();
            $t->string('crop');
            $t->string('variety')->nullable();
            $t->date('sown_on');
            $t->date('expected_harvest_on');
            $t->string('status')->default('active')->index(); // active | harvested
            $t->date('harvested_on')->nullable();
            $t->decimal('actual_yield_kg', 12, 2)->nullable();
            $t->timestamps();
        });

        Schema::create('scans', function (Blueprint $t) {
            $t->id();
            $t->foreignId('field_id')->constrained()->cascadeOnDelete();
            $t->foreignId('crop_cycle_id')->nullable()->constrained()->nullOnDelete();
            $t->foreignId('submitted_by')->constrained('users');
            $t->text('note')->nullable();
            $t->json('ai');
            $t->string('status')->default('pending')->index(); // pending | reviewed
            $t->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamp('reviewed_at')->nullable();
            $t->string('verdict')->nullable(); // healthy | watch | treat | urgent
            $t->timestamps();
        });

        Schema::create('scan_photos', function (Blueprint $t) {
            $t->id();
            $t->foreignId('scan_id')->constrained()->cascadeOnDelete();
            $t->string('path');
            $t->timestamps();
        });

        Schema::create('guidance', function (Blueprint $t) {
            $t->id();
            $t->foreignId('field_id')->constrained()->cascadeOnDelete();
            $t->foreignId('officer_id')->constrained('users');
            $t->foreignId('scan_id')->nullable()->constrained()->nullOnDelete();
            $t->string('priority')->default('normal'); // normal | urgent
            $t->string('title');
            $t->text('body');
            $t->date('due_on')->nullable();
            $t->timestamp('done_at')->nullable();
            $t->timestamps();
        });

        Schema::create('xp_events', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->constrained()->cascadeOnDelete();
            $t->string('reason');
            $t->string('ref');
            $t->unsignedInteger('points');
            $t->timestamps();
            $t->unique(['user_id', 'reason', 'ref']);
        });

        Schema::create('listings', function (Blueprint $t) {
            $t->id();
            $t->foreignId('farmer_id')->constrained('users')->cascadeOnDelete();
            $t->foreignId('field_id')->nullable()->constrained()->nullOnDelete();
            $t->string('crop')->index();
            $t->decimal('quantity_kg', 12, 2);
            $t->decimal('price_per_kg', 10, 2);
            $t->string('district')->nullable();
            $t->text('note')->nullable();
            $t->string('status')->default('open')->index(); // open | sold | closed
            $t->timestamps();
        });

        Schema::create('buy_posts', function (Blueprint $t) {
            $t->id();
            $t->foreignId('buyer_id')->constrained('users')->cascadeOnDelete();
            $t->string('crop')->index();
            $t->decimal('quantity_kg', 12, 2);
            $t->decimal('price_per_kg', 10, 2);
            $t->string('district')->nullable();
            $t->date('needed_by')->nullable();
            $t->text('note')->nullable();
            $t->string('status')->default('open')->index(); // open | filled | closed
            $t->timestamps();
        });

        Schema::create('offers', function (Blueprint $t) {
            $t->id();
            $t->foreignId('listing_id')->nullable()->constrained()->cascadeOnDelete();
            $t->foreignId('buy_post_id')->nullable()->constrained()->cascadeOnDelete();
            $t->foreignId('buyer_id')->constrained('users');
            $t->foreignId('farmer_id')->constrained('users');
            $t->foreignId('turn_user_id')->constrained('users'); // who must answer next
            $t->decimal('quantity_kg', 12, 2);
            $t->decimal('price_per_kg', 10, 2);
            $t->string('status')->default('pending')->index(); // pending | accepted | rejected
            $t->timestamps();
        });

        Schema::create('offer_rounds', function (Blueprint $t) {
            $t->id();
            $t->foreignId('offer_id')->constrained()->cascadeOnDelete();
            $t->foreignId('user_id')->constrained('users');
            $t->decimal('quantity_kg', 12, 2);
            $t->decimal('price_per_kg', 10, 2);
            $t->text('note')->nullable();
            $t->timestamps();
        });
    }

    public function down(): void
    {
        foreach (['offer_rounds', 'offers', 'buy_posts', 'listings', 'xp_events', 'guidance', 'scan_photos', 'scans', 'crop_cycles', 'fields', 'sessions', 'users'] as $table) {
            Schema::dropIfExists($table);
        }
    }
};
