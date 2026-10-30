<?php

namespace Tests\Feature;

use App\Models\Field;
use App\Models\Listing;
use App\Models\Offer;
use App\Models\Scan;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AgrinestFlowTest extends TestCase
{
    use RefreshDatabase;

    private const POINTS = [[90.419, 24.749], [90.4228, 24.7492], [90.423, 24.7468], [90.4192, 24.7466]];

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
        Http::fake([
            '*/v1/weather/forecast*' => Http::response(['data' => [
                'place' => 'Mymensingh',
                'current' => ['condition' => 'Rain', 'temperatureC' => 29, 'humidity' => 80, 'precipitationChance' => 80, 'windKph' => 5],
                'daily' => array_fill(0, 5, ['day' => 'Friday', 'condition' => 'Rain', 'highC' => 30, 'humidity' => 90, 'precipitationChance' => 85, 'windKph' => 8]),
            ]]),
            '*/v1/maps/tiles/*' => Http::response('tile', 200, ['Content-Type' => 'image/jpeg']),
            '*/v1/reverse-geocode*' => Http::response(['data' => []]),
            '*/chat/completions' => Http::response(['error' => ['code' => 'invalid_api_key']], 401),
        ]);
    }

    public function test_national_admin_sees_totals_and_officer_performance_but_cannot_be_self_registered(): void
    {
        $this->postJson('/api/auth/register', ['name' => 'X', 'phone' => '0198', 'password' => 'secret12', 'role' => 'admin', 'district' => 'Dhaka'])
            ->assertStatus(422);

        $farmer = $this->user('farmer');
        $buyer = $this->user('buyer', ['buyer_type' => 'government']);
        $officer = $this->user('officer');
        $vacant = $this->user('farmer', ['district' => 'Barishal']);

        Sanctum::actingAs($farmer);
        $fieldId = $this->postJson('/api/fields', ['name' => 'Plot', 'points' => self::POINTS])->assertSuccessful()->json('field.id');
        $this->postJson("/api/fields/$fieldId/plant", ['crop' => 'rice', 'sown_on' => today()->subDays(10)->toDateString()])->assertSuccessful();

        $listing = Listing::create(['farmer_id' => $farmer->id, 'crop' => 'rice', 'quantity_kg' => 100, 'price_per_kg' => 30, 'district' => 'Mymensingh']);
        Offer::create(['listing_id' => $listing->id, 'buyer_id' => $buyer->id, 'farmer_id' => $farmer->id, 'turn_user_id' => $farmer->id, 'quantity_kg' => 100, 'price_per_kg' => 30, 'status' => 'accepted']);

        $late = Scan::create(['field_id' => $fieldId, 'submitted_by' => $farmer->id, 'ai' => []]);
        $late->forceFill(['created_at' => now()->subDays(5)])->save();

        foreach ([$farmer, $officer, $buyer] as $notAdmin) {
            Sanctum::actingAs($notAdmin);
            $this->getJson('/api/dashboard/national')->assertForbidden();
        }

        $admin = $this->user('admin', ['district' => null]);
        Sanctum::actingAs($admin);
        $data = $this->getJson('/api/dashboard/national')->assertOk()->json();

        $this->assertSame(3000, (int) $data['totals']['sold_value']);
        $this->assertSame(3000, (int) $data['totals']['government_value']);
        $this->assertSame(1, $data['totals']['overdue']);
        $this->assertSame(1, $data['totals']['uncovered_districts']);
        $this->assertSame('rice', $data['crops'][0]['id']);
        $this->assertSame(30, (int) $data['crops'][0]['avg_price']);
        $this->assertSame($officer->id, $data['officers'][0]['id']);
        $this->assertTrue($data['officers'][0]['behind']);
        $this->assertStringNotContainsString($vacant->phone, json_encode($data));

        // Monitoring only: no access to an individual farmer's land.
        $this->getJson("/api/fields/$fieldId")->assertForbidden();
    }

    private function user(string $role, array $extra = []): User
    {
        static $n = 0;
        $n++;

        return User::create($extra + ['name' => "$role $n", 'phone' => "0170000{$n}", 'password' => 'password', 'role' => $role, 'district' => 'Mymensingh']);
    }

    private function farmerField(User $farmer): Field
    {
        Sanctum::actingAs($farmer);
        $id = $this->postJson('/api/fields', ['name' => 'North', 'points' => self::POINTS])->assertCreated()->json('field.id');

        return Field::findOrFail($id);
    }

    public function test_public_registration_cannot_create_an_officer(): void
    {
        $this->postJson('/api/auth/register', ['name' => 'X', 'phone' => '0199', 'password' => 'secret12', 'role' => 'officer', 'district' => 'Dhaka'])
            ->assertUnprocessable();
    }

    public function test_field_area_is_computed_on_the_server_and_weather_alerts_apply(): void
    {
        $field = $this->farmerField($this->user('farmer'));

        $this->assertEqualsWithDelta(23, $field->area_acres, 3);
        $this->assertSame('high', $field->fresh()->weather_risk);
        $this->assertSame(50, $field->farmer->fresh()->xp);
    }

    public function test_farmer_can_rename_and_redraw_land(): void
    {
        $field = $this->farmerField($this->user('farmer'));
        $smaller = [[90.419, 24.749], [90.42, 24.749], [90.42, 24.748], [90.419, 24.748]];

        $this->patchJson("/api/fields/{$field->id}", ['name' => 'Pond side'])->assertOk()->assertJsonPath('field.name', 'Pond side');
        $this->assertEqualsWithDelta(23, $field->fresh()->area_acres, 3);

        $this->patchJson("/api/fields/{$field->id}", ['points' => $smaller])->assertOk()->assertJsonPath('field.name', 'Pond side');
        $this->assertLessThan(10, $field->fresh()->area_acres);

        $this->patchJson("/api/fields/{$field->id}", ['points' => [[10, 10], [11, 10], [11, 11]]])->assertUnprocessable();

        Sanctum::actingAs($this->user('farmer'));
        $this->patchJson("/api/fields/{$field->id}", ['name' => 'Mine now'])->assertForbidden();
    }

    public function test_farmer_can_correct_or_remove_a_growing_crop(): void
    {
        $farmer = $this->user('farmer');
        $field = $this->farmerField($farmer);
        $sown = today()->subDays(10);
        $cycleId = $this->postJson("/api/fields/{$field->id}/plant", ['crop' => 'rice', 'sown_on' => $sown->toDateString()])->assertCreated()->json('field.cycle.id');
        $this->assertSame(80, $farmer->fresh()->xp);
        $field->forceFill(['health_status' => 'treat'])->save();

        // Fixing only the variety keeps what the scans said about this crop.
        $this->patchJson("/api/cycles/$cycleId", ['crop' => 'rice', 'variety' => 'BRRI dhan28', 'sown_on' => $sown->toDateString()])
            ->assertOk()->assertJsonPath('field.cycle.variety', 'BRRI dhan28')->assertJsonPath('field.health_status', 'treat');

        $days = config('agri.crops.wheat.days');
        $this->patchJson("/api/cycles/$cycleId", ['crop' => 'wheat', 'variety' => null, 'sown_on' => $sown->toDateString()])
            ->assertOk()->assertJsonPath('field.cycle.crop', 'wheat')->assertJsonPath('field.health_status', 'unknown')
            ->assertJsonPath('field.cycle.expected_harvest_on', $sown->copy()->addDays($days)->toDateString());

        $this->deleteJson("/api/cycles/$cycleId")->assertOk()->assertJsonPath('field.cycle', null);
        $this->assertSame(50, $farmer->fresh()->xp);

        // Undoing and planting again cannot earn more than the one award.
        $next = $this->postJson("/api/fields/{$field->id}/plant", ['crop' => 'rice', 'sown_on' => today()->toDateString()])->json('field.cycle.id');
        $this->assertSame(80, $farmer->fresh()->xp);

        $this->postJson("/api/cycles/$next/harvest", ['actual_yield_kg' => 100])->assertOk();
        $this->deleteJson("/api/cycles/$next")->assertConflict();
        $this->patchJson("/api/cycles/$next", ['crop' => 'rice', 'sown_on' => today()->toDateString()])->assertConflict();
    }

    public function test_boundary_outside_bangladesh_is_rejected(): void
    {
        Sanctum::actingAs($this->user('farmer'));
        $this->postJson('/api/fields', ['name' => 'Far', 'points' => [[10, 10], [11, 10], [11, 11]]])->assertUnprocessable();
    }

    public function test_boundary_that_crosses_itself_is_rejected(): void
    {
        Sanctum::actingAs($this->user('farmer'));
        $this->postJson('/api/fields', ['name' => 'Bowtie', 'points' => [[90.40, 24.75], [90.41, 24.76], [90.41, 24.75], [90.40, 24.76]]])->assertUnprocessable();
    }

    public function test_land_is_private_between_farmers_and_districts(): void
    {
        $field = $this->farmerField($this->user('farmer'));

        Sanctum::actingAs($this->user('farmer'));
        $this->getJson("/api/fields/{$field->id}")->assertForbidden();

        Sanctum::actingAs($this->user('officer', ['district' => 'Dhaka']));
        $this->getJson("/api/fields/{$field->id}")->assertForbidden();

        Sanctum::actingAs($this->user('officer'));
        $this->getJson("/api/fields/{$field->id}")->assertOk()->assertJsonPath('field.farmer.name', $field->farmer->name);
    }

    public function test_scan_falls_back_when_nova_rejects_the_key_and_officer_verdict_wins(): void
    {
        config(['services.nova.key' => 'bad']);
        $farmer = $this->user('farmer');
        $field = $this->farmerField($farmer);
        $this->postJson("/api/fields/{$field->id}/plant", ['crop' => 'rice', 'sown_on' => today()->subDays(40)->toDateString()])->assertCreated();

        $scan = $this->post("/api/fields/{$field->id}/scans", ['photos' => [UploadedFile::fake()->image('leaf.jpg', 100, 100)]], ['Accept' => 'application/json'])
            ->assertCreated()->assertJsonPath('scan.ai.source', 'color-rules')->assertJsonPath('scan.status', 'pending')->json('scan');

        $officer = $this->user('officer');
        Sanctum::actingAs($officer);
        $this->getJson('/api/scans/queue')->assertOk()->assertJsonCount(1, 'scans');
        $this->postJson("/api/scans/{$scan['id']}/review", ['verdict' => 'urgent', 'title' => 'Spray check', 'body' => 'Visit soon'])->assertOk();
        $this->assertSame('urgent', $field->fresh()->health_status);
        $this->postJson("/api/scans/{$scan['id']}/review", ['verdict' => 'healthy', 'title' => 'x', 'body' => 'y'])->assertConflict();

        Sanctum::actingAs($farmer);
        $id = $this->getJson('/api/guidance')->assertOk()->json('guidance.0.id');
        $before = $farmer->fresh()->xp;
        $this->postJson("/api/guidance/$id/done")->assertOk();
        $this->postJson("/api/guidance/$id/done")->assertOk();
        $this->assertSame($before + 40, $farmer->fresh()->xp);
    }

    public function test_agent_only_manages_assigned_farmers(): void
    {
        $agent = $this->user('agent');
        Sanctum::actingAs($agent);
        $farmerId = $this->postJson('/api/agent/farmers', ['name' => 'No Phone', 'phone' => '01999'])->assertCreated()->json('farmer.id');
        $this->postJson('/api/fields', ['name' => 'Agent plot', 'points' => self::POINTS, 'farmer_id' => $farmerId])->assertCreated();

        $stranger = $this->user('farmer');
        $this->postJson('/api/fields', ['name' => 'Nope', 'points' => self::POINTS, 'farmer_id' => $stranger->id])->assertForbidden();
    }

    public function test_negotiation_takes_turns_and_cannot_oversell(): void
    {
        $farmer = $this->user('farmer');
        $buyer = $this->user('buyer', ['buyer_type' => 'broker']);
        $other = $this->user('buyer', ['buyer_type' => 'government']);

        Sanctum::actingAs($farmer);
        $listing = $this->postJson('/api/listings', ['crop' => 'rice', 'quantity_kg' => 100, 'price_per_kg' => 30])->assertCreated()->json('listing.id');
        $this->postJson("/api/listings/$listing/bid", ['quantity_kg' => 10, 'price_per_kg' => 28])->assertForbidden();

        Sanctum::actingAs($buyer);
        $offer = $this->postJson("/api/listings/$listing/bid", ['quantity_kg' => 100, 'price_per_kg' => 27])->assertCreated()->json('offer.id');
        $this->postJson("/api/offers/$offer/accept")->assertConflict();
        $this->postJson("/api/listings/$listing/bid", ['quantity_kg' => 100, 'price_per_kg' => 28])->assertConflict();

        Sanctum::actingAs($other);
        $rival = $this->postJson("/api/listings/$listing/bid", ['quantity_kg' => 80, 'price_per_kg' => 29])->assertCreated()->json('offer.id');
        $this->postJson("/api/offers/$offer/counter", ['quantity_kg' => 100, 'price_per_kg' => 40])->assertForbidden();

        Sanctum::actingAs($farmer);
        $this->postJson("/api/offers/$offer/counter", ['quantity_kg' => 100, 'price_per_kg' => 29])->assertOk();

        Sanctum::actingAs($buyer);
        $this->postJson("/api/offers/$offer/accept")->assertOk()->assertJsonPath('offer.status', 'accepted');

        $this->assertDatabaseHas('listings', ['id' => $listing, 'status' => 'sold']);
        $this->assertDatabaseHas('offers', ['id' => $rival, 'status' => 'rejected']);
    }

    public function test_harvest_results_teach_yieldmax(): void
    {
        $field = $this->farmerField($this->user('farmer'));
        $before = null;
        foreach ([1, 2] as $season) {
            $this->postJson("/api/fields/{$field->id}/plant", ['crop' => 'rice', 'sown_on' => today()->subDays(100)->toDateString()])->assertCreated();
            $detail = $this->getJson("/api/fields/{$field->id}")->json('field');
            $before ??= $detail['yield'];
            $this->postJson("/api/cycles/{$detail['cycle']['id']}/harvest", ['actual_yield_kg' => $before['potential_kg'] * 2])->assertOk();
        }
        $this->postJson("/api/fields/{$field->id}/plant", ['crop' => 'rice', 'sown_on' => today()->toDateString()])->assertCreated();
        $after = $this->getJson("/api/fields/{$field->id}")->json('field.yield');

        $this->assertGreaterThan($before['potential_kg'], $after['potential_kg']);
        $this->assertSame(2, $after['seasons_learned']);
    }

    public function test_loading_map_tiles_does_not_use_up_the_scan_allowance(): void
    {
        $farmer = $this->user('farmer');
        Sanctum::actingAs($farmer);
        $fieldId = $this->postJson('/api/fields', ['name' => 'Plot', 'points' => self::POINTS])->assertSuccessful()->json('field.id');

        foreach (range(1, 31) as $x) {
            $this->get("/api/map/tiles/satellite/17/$x/1")->assertOk();
        }

        $this->post("/api/fields/$fieldId/scans", ['photos' => [UploadedFile::fake()->image('leaf.jpg')]], ['Accept' => 'application/json'])
            ->assertSuccessful();
    }
}
