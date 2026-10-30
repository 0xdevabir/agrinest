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
use App\Services\Audit;
use App\Services\Geo;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Seeder;

/** Demo world: Mymensingh in detail, plus other districts for the national view. All demo accounts use the password "password". */
class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // Only a brand-new demo gets a sample trail: an existing database's history must never be invented.
        $fresh = ! User::query()->exists();

        // The demo world backdates its records, so its trail is written afterwards in time order.
        Model::withoutEvents(function () {
            if (! User::where('phone', '01700000001')->exists()) {
                $this->mymensingh();
            }
            if (! User::where('phone', '01700000007')->exists()) {
                $this->nation();
            }
        });
        if ($fresh) {
            $this->auditTrail();
        }
    }

    /** Sample trail derived from the demo records. These rows carry no IP, which marks them as seeded. */
    private function auditTrail(): void
    {
        $rows = [];
        $add = function ($at, string $action, ?Model $subject, ?User $actor, array $changes = [], array $extra = []) use (&$rows) {
            $rows[] = [$at, $action, $subject, $changes, ['actor' => $actor, 'at' => $at] + $extra];
        };

        Scan::with('field', 'submitter', 'reviewer')->get()->each(function (Scan $s) use ($add) {
            $add($s->created_at, 'scan.created', $s, $s->submitter, ['after' => ['field_id' => $s->field_id, 'status' => 'pending', 'note' => $s->note]]);
            if ($s->reviewed_at) {
                $add($s->reviewed_at, 'scan.reviewed', $s, $s->reviewer, ['before' => ['status' => 'pending'], 'after' => ['status' => 'reviewed', 'verdict' => $s->verdict]]);
            }
        });
        Guidance::with('field', 'officer')->get()->each(function (Guidance $g) use ($add) {
            // Sent in the same moment as its review, when it has one.
            $at = $g->scan_id ? (Scan::find($g->scan_id)?->reviewed_at ?? $g->created_at) : $g->created_at;
            $add($at, 'guidance.created', $g, $g->officer, ['after' => ['title' => $g->title, 'priority' => $g->priority]]);
        });
        Field::with('farmer')->get()->each(fn (Field $f) => $add($f->created_at->copy()->subDays(45), 'field.created', $f, $f->farmer, ['after' => ['name' => $f->name, 'area_acres' => $f->area_acres]]));
        Offer::where('status', 'accepted')->with('buyer', 'farmer')->get()->each(fn (Offer $o) => $add($o->updated_at, 'offer.accepted', $o, $o->farmer, ['before' => ['status' => 'pending'], 'after' => ['status' => 'accepted', 'quantity_kg' => $o->quantity_kg, 'price_per_kg' => $o->price_per_kg]], ['label' => "{$o->farmer->name} / {$o->buyer->name}"]));
        User::whereIn('role', ['officer', 'admin'])->get()->each(function (User $u) use ($add) {
            foreach ([1, 4, 9] as $days) {
                $add(now()->subDays($days)->setTime(9, 5 + $u->id % 40), 'auth.login', $u, $u);
            }
        });
        $officer = User::where('phone', '01700000003')->first();
        $add(now()->subDays(2)->setTime(23, 41), 'auth.login_failed', null, null, [], ['label' => $officer->phone, 'district' => $officer->district]);

        usort($rows, fn ($a, $b) => $a[0] <=> $b[0]);
        foreach ($rows as [$at, $action, $subject, $changes, $context]) {
            app(Audit::class)->record($action, $subject, $changes, $context);
        }
    }

    /** A national admin, and districts whose officers are ahead, behind or missing. */
    private function nation(): void
    {
        User::create(['name' => 'Farhana Rahman', 'phone' => '01700000007', 'password' => 'password', 'role' => 'admin', 'organization' => 'Ministry of Agriculture']);

        $buyer = User::where('phone', '01700000004')->first();
        $broker = User::where('phone', '01700000006')->first();
        $mymensinghOfficer = User::where('phone', '01700000003')->first();

        // district, officer (null = post vacant), lng, lat, crop, overdue scans, deals as [crop, kg, price, days ago, buyer]
        $places = [
            ['Rajshahi', 'Tanvir Ahmed', 88.60, 24.37, 'wheat', 0, [['potato', 6000, 26, 4, $broker], ['rice', 12000, 31, 12, $buyer], ['potato', 3000, 24, 33, $broker]]],
            ['Rangpur', 'Shirin Akter', 89.25, 25.74, 'potato', 3, [['potato', 15000, 23, 8, $broker], ['maize', 8000, 27, 22, $broker]]],
            ['Jashore', 'Mahmud Hasan', 89.21, 23.17, 'rice', 1, [['rice', 18000, 32, 2, $buyer], ['jute', 2500, 58, 18, $broker], ['rice', 9000, 30, 40, $buyer]]],
            ['Sylhet', 'Rumana Begum', 91.87, 24.89, 'rice', 0, [['rice', 5000, 33, 26, $buyer]]],
            ['Barishal', null, 90.35, 22.70, 'rice', 2, [['rice', 4000, 29, 15, $broker]]],
        ];

        foreach ($places as $i => [$district, $officerName, $lng, $lat, $crop, $overdue, $deals]) {
            $n = 10 + $i * 3;
            $base = ['password' => 'password', 'district' => $district];
            $officer = $officerName ? User::create($base + ['name' => $officerName, 'phone' => '017000000'.$n, 'role' => 'officer', 'organization' => "DAE $district"]) : null;
            $farmer = User::create($base + ['name' => "$district Farmer", 'phone' => '017000000'.($n + 1), 'role' => 'farmer']);
            $by = $farmer;

            $plots = [];
            foreach ([0, 1] as $p) {
                $x = $lng + $p * 0.006;
                $plots[] = $this->field($farmer, $by, "$district Plot ".($p + 1), [[$x, $lat + 0.004], [$x + 0.004, $lat + 0.004], [$x + 0.004, $lat], [$x, $lat]], $crop, 40 + $p * 20);
            }

            if ($officer) {
                $done = $this->scan($plots[0], $by, 'none', 'healthy', $officer);
                $done->forceFill(['created_at' => now()->subHours(6 + $i * 9), 'reviewed_at' => now()->subHours($i)])->save();
                Guidance::create(['field_id' => $plots[0]->id, 'officer_id' => $officer->id, 'scan_id' => $done->id, 'title' => 'নিয়মিত জমি দেখুন', 'body' => 'ফসল ভালো আছে। সপ্তাহে একবার পাতা পরীক্ষা করুন।']);
            }
            for ($k = 1; $k <= $overdue; $k++) {
                $this->scan($plots[1], $by, $k === 1 ? 'high' : 'medium', 'unknown', null)->forceFill(['created_at' => now()->subDays(3 + $k * 2)])->save();
            }

            foreach ($deals as [$dealCrop, $kg, $price, $daysAgo, $dealBuyer]) {
                $this->sale($farmer, $dealBuyer, $dealCrop, $kg, $price, $daysAgo);
            }
        }

        $abir = User::where('phone', '01700000001')->first();
        $this->sale($abir, $buyer, 'rice', 2000, 31, 6);
        $this->sale($abir, $broker, 'mustard', 300, 80, 20);
        $this->scan(Field::where('name', 'East Plot')->first(), $abir, 'none', 'healthy', $mymensinghOfficer)->forceFill(['created_at' => now()->subHours(20), 'reviewed_at' => now()->subHours(3)])->save();
    }

    private function sale(User $farmer, User $buyer, string $crop, int $kg, int $price, int $daysAgo): void
    {
        $listing = Listing::create(['farmer_id' => $farmer->id, 'crop' => $crop, 'quantity_kg' => 0, 'price_per_kg' => $price, 'district' => $farmer->district]);
        $listing->forceFill(['status' => 'sold'])->save();
        $offer = Offer::create(['listing_id' => $listing->id, 'buyer_id' => $buyer->id, 'farmer_id' => $farmer->id, 'turn_user_id' => $farmer->id, 'quantity_kg' => $kg, 'price_per_kg' => $price, 'status' => 'accepted']);
        $offer->forceFill(['updated_at' => now()->subDays($daysAgo)])->saveQuietly();
    }

    private function mymensingh(): void
    {

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
