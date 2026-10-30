<?php

namespace Database\Seeders;

use App\Models\BuyPost;
use App\Models\CropCycle;
use App\Models\Field;
use App\Models\Guidance;
use App\Models\Listing;
use App\Models\Offer;
use App\Models\Scan;
use App\Models\User;
use App\Services\Geo;
use Illuminate\Database\Seeder;

/** Demo world around Mymensingh. All demo accounts use the password "password". */
class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        if (User::where('phone', '01700000001')->exists()) {
            return;
        }

        $base = ['password' => 'password', 'district' => 'Mymensingh', 'upazila' => 'Trishal', 'village' => 'Boira'];
        $agent = User::create($base + ['name' => 'Karim Agent', 'phone' => '01700000002', 'role' => 'agent', 'xp' => 0]);
        $officer = User::create($base + ['name' => 'Nasrin Sultana', 'phone' => '01700000003', 'role' => 'officer', 'organization' => 'DAE Mymensingh']);
        $abir = User::create($base + ['name' => 'Abir Hossain', 'phone' => '01700000001', 'role' => 'farmer', 'agent_id' => $agent->id]);
        $rahim = User::create($base + ['name' => 'Rahim Mia', 'phone' => '01700000005', 'role' => 'farmer', 'agent_id' => $agent->id, 'village' => 'Dhanikhola']);
        $buyer = User::create($base + ['name' => 'Food Directorate', 'phone' => '01700000004', 'role' => 'buyer', 'buyer_type' => 'government', 'organization' => 'Directorate General of Food']);
        $broker = User::create($base + ['name' => 'Salam Traders', 'phone' => '01700000006', 'role' => 'buyer', 'buyer_type' => 'broker', 'organization' => 'Salam Traders']);

        $north = $this->field($abir, $agent, 'North Plot', [[90.4190, 24.7490], [90.4228, 24.7492], [90.4230, 24.7468], [90.4192, 24.7466]], 'rice', 70, 'BRRI dhan87');
        $river = $this->field($abir, $agent, 'River Plot', [[90.4234, 24.7490], [90.4262, 24.7488], [90.4264, 24.7470], [90.4236, 24.7470]], 'potato', 30);
        $east = $this->field($abir, $agent, 'East Plot', [[90.4192, 24.7462], [90.4226, 24.7462], [90.4228, 24.7444], [90.4194, 24.7442]], 'mustard', 82);
        $home = $this->field($abir, $agent, 'Home Plot', [[90.4232, 24.7465], [90.4258, 24.7465], [90.4256, 24.7448], [90.4232, 24.7449]], 'tomato', 45);
        $rahimPlot = $this->field($rahim, $agent, 'Rahim Paddy', [[90.4295, 24.7490], [90.4330, 24.7492], [90.4332, 24.7470], [90.4297, 24.7468]], 'rice', 55, 'BRRI dhan49');

        // A past harvest gives YieldMax something to learn from.
        $north->cycles()->create(['crop' => 'wheat', 'status' => 'harvested', 'sown_on' => now()->subMonths(11), 'expected_harvest_on' => now()->subMonths(7), 'harvested_on' => now()->subMonths(7), 'actual_yield_kg' => 3100]);

        $this->scan($river, $agent, 'medium', 'brown_spot', null);
        $this->scan($rahimPlot, $agent, 'high', 'rice_blast', null);
        $reviewed = $this->scan($north, $abir, 'none', 'healthy', $officer);
        $treated = $this->scan($home, $agent, 'medium', 'leaf_yellowing', $officer, 'watch');

        Guidance::create(['field_id' => $north->id, 'officer_id' => $officer->id, 'scan_id' => $reviewed->id, 'title' => 'ফসল ভালো আছে, পানি ৩–৫ সেমি রাখুন', 'body' => 'আপনার ধান ভালো আছে। থোড় আসা পর্যন্ত জমিতে ৩–৫ সেমি পানি রাখুন।', 'due_on' => today()->addDays(3)]);
        Guidance::create(['field_id' => $home->id, 'officer_id' => $officer->id, 'scan_id' => $treated->id, 'title' => '৩ দিন পর আবার পাতার হলুদ ভাব দেখুন', 'body' => 'পাতার নিচের দিক দেখুন। হলুদ বাড়লে নতুন ছবি পাঠান, এখনই সার বাড়াবেন না।', 'due_on' => today()->addDays(3)]);

        $abir->forceFill(['xp' => 280])->save();

        $listing = Listing::create(['farmer_id' => $abir->id, 'field_id' => $east->id, 'crop' => 'mustard', 'quantity_kg' => 450, 'price_per_kg' => 82, 'district' => 'Mymensingh', 'note' => 'Harvest in about two weeks']);
        Listing::create(['farmer_id' => $rahim->id, 'field_id' => $rahimPlot->id, 'crop' => 'rice', 'quantity_kg' => 1500, 'price_per_kg' => 31, 'district' => 'Mymensingh']);
        $post = BuyPost::create(['buyer_id' => $buyer->id, 'crop' => 'rice', 'quantity_kg' => 20000, 'price_per_kg' => 32, 'district' => 'Mymensingh', 'needed_by' => today()->addDays(30), 'note' => 'Government procurement. Moisture below 14%.']);
        BuyPost::create(['buyer_id' => $broker->id, 'crop' => 'potato', 'quantity_kg' => 5000, 'price_per_kg' => 24, 'district' => 'Mymensingh', 'needed_by' => today()->addDays(45)]);

        $offer = Offer::create(['listing_id' => $listing->id, 'buyer_id' => $broker->id, 'farmer_id' => $abir->id, 'turn_user_id' => $abir->id, 'quantity_kg' => 450, 'price_per_kg' => 76]);
        $offer->rounds()->create(['user_id' => $broker->id, 'quantity_kg' => 450, 'price_per_kg' => 76, 'note' => 'I can collect from your field.']);
    }

    private function field(User $farmer, User $by, string $name, array $points, string $crop, int $sownDaysAgo, ?string $variety = null): Field
    {
        // Shrink each plot around its middle so Abir's land totals about 20 acres.
        $cx = array_sum(array_column($points, 0)) / count($points);
        $cy = array_sum(array_column($points, 1)) / count($points);
        // The offset moves the demo from the town onto the paddy land east of the river.
        $points = array_map(fn ($p) => [$cx + ($p[0] - $cx) * 0.54 + 0.0105, $cy + ($p[1] - $cy) * 0.54], $points);

        $polygon = Geo::polygon($points);
        $ring = array_slice($polygon['coordinates'][0], 0, -1);
        [$lat, $lng] = Geo::center($ring);

        $field = Field::create([
            'farmer_id' => $farmer->id, 'created_by' => $by->id, 'name' => $name, 'boundary' => $polygon,
            'lat' => $lat, 'lng' => $lng, 'area_acres' => Geo::acres($ring),
            'district' => $farmer->district, 'upazila' => $farmer->upazila, 'village' => $farmer->village,
        ]);
        CropCycle::create([
            'field_id' => $field->id, 'crop' => $crop, 'variety' => $variety,
            'sown_on' => today()->subDays($sownDaysAgo),
            'expected_harvest_on' => today()->subDays($sownDaysAgo)->addDays(config("agri.crops.$crop.days")),
        ]);

        return $field;
    }

    private function scan(Field $field, User $by, string $severity, string $label, ?User $officer, ?string $verdict = null): Scan
    {
        $d = config("agri.diseases.$label") ?? config('agri.diseases.unknown');
        $scan = Scan::create([
            'field_id' => $field->id,
            'crop_cycle_id' => $field->activeCycle?->id,
            'submitted_by' => $by->id,
            'ai' => [
                'label' => $label, 'name_en' => $d['en'], 'name_bn' => $d['bn'], 'confidence' => 0.5, 'severity' => $severity,
                'summary_en' => 'Demo data: seeded example, not a real analysis.', 'summary_bn' => 'ডেমো তথ্য: নমুনা, প্রকৃত বিশ্লেষণ নয়।',
                'steps_en' => $d['steps_en'], 'steps_bn' => $d['steps_bn'], 'source' => 'demo-seed',
                'chemical_note_en' => config('agri.chemical_note.en'), 'chemical_note_bn' => config('agri.chemical_note.bn'),
            ],
            'status' => $officer ? 'reviewed' : 'pending',
            'reviewed_by' => $officer?->id,
            'reviewed_at' => $officer ? now() : null,
            'verdict' => $officer ? ($verdict ?? 'healthy') : null,
        ]);

        $status = $scan->verdict ?? ['none' => 'healthy', 'low' => 'watch', 'medium' => 'treat', 'high' => 'urgent'][$severity];
        $field->forceFill(['health_status' => $status, 'health_score' => ['healthy' => 90, 'watch' => 65, 'treat' => 40, 'urgent' => 20][$status], 'last_scan_at' => now()])->save();

        return $scan;
    }
}
