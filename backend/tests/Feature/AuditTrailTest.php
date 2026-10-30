<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Field;
use App\Models\Guidance;
use App\Models\Scan;
use App\Models\User;
use App\Services\Audit;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use LogicException;
use Tests\TestCase;

class AuditTrailTest extends TestCase
{
    use RefreshDatabase;

    private int $n = 0;

    private function user(string $role, array $attrs = []): User
    {
        return User::create($attrs + ['name' => ucfirst($role), 'phone' => '0190000'.str_pad((string) ++$this->n, 4, '0', STR_PAD_LEFT), 'password' => 'secret-pass', 'role' => $role, 'district' => 'Mymensingh']);
    }

    private function scan(User $farmer): Scan
    {
        $field = Field::create(['farmer_id' => $farmer->id, 'created_by' => $farmer->id, 'name' => 'North plot', 'boundary' => ['type' => 'Polygon', 'coordinates' => []], 'lat' => 24.7, 'lng' => 90.4, 'area_acres' => 1, 'district' => 'Mymensingh']);

        return Scan::create(['field_id' => $field->id, 'submitted_by' => $farmer->id, 'ai' => ['severity' => 'high', 'label' => 'blast'], 'status' => 'pending']);
    }

    public function test_changes_are_logged_with_actor_and_passwords_never_are(): void
    {
        $officer = $this->user('officer');
        $scan = $this->scan($this->user('farmer'));

        Sanctum::actingAs($officer);
        $this->postJson("/api/scans/{$scan->id}/review", ['verdict' => 'watch', 'title' => 'Check', 'body' => 'Look again'])->assertOk();

        $entry = AuditLog::where('action', 'scan.reviewed')->firstOrFail();
        $this->assertSame($officer->id, $entry->actor_id);
        $this->assertSame('Officer', $entry->actor_name);
        $this->assertSame('Mymensingh', $entry->district);
        $this->assertSame('pending', $entry->changes['before']['status']);
        $this->assertSame('watch', $entry->changes['after']['verdict']);
        $this->assertDatabaseHas('audit_logs', ['action' => 'guidance.created', 'actor_id' => $officer->id]);
        $this->assertFalse(AuditLog::where('changes', 'like', '%password%')->orWhere('changes', 'like', '%secret-pass%')->exists());
    }

    public function test_sign_ins_and_failures_are_logged(): void
    {
        $user = $this->user('farmer');
        $this->postJson('/api/auth/login', ['phone' => $user->phone, 'password' => 'wrong'])->assertStatus(422);
        $this->postJson('/api/auth/login', ['phone' => $user->phone, 'password' => 'secret-pass'])->assertOk();

        $this->assertDatabaseHas('audit_logs', ['action' => 'auth.login_failed', 'subject_label' => $user->phone, 'actor_id' => null]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'auth.login', 'actor_id' => $user->id]);
    }

    public function test_entries_cannot_be_changed_through_the_model(): void
    {
        $entry = app(Audit::class)->record('test.event');
        $this->expectException(LogicException::class);
        $entry->update(['action' => 'test.other']);
    }

    public function test_entries_cannot_be_deleted_through_the_model(): void
    {
        $entry = app(Audit::class)->record('test.event');
        $this->expectException(LogicException::class);
        $entry->delete();
    }

    public function test_verify_finds_the_first_tampered_entry(): void
    {
        $audit = app(Audit::class);
        $first = $audit->record('test.one');
        $second = $audit->record('test.two');
        $audit->record('test.three');
        $this->assertTrue($audit->verify()['ok']);
        $this->assertSame($first->hash, $second->prev_hash);

        DB::table('audit_logs')->where('id', $second->id)->update(['actor_name' => 'Someone else']);

        $this->assertSame(['ok' => false, 'entries' => 1, 'broken_id' => $second->id], $audit->verify());
    }

    public function test_verify_notices_a_removed_entry(): void
    {
        $audit = app(Audit::class);
        $audit->record('test.one');
        $middle = $audit->record('test.two');
        $last = $audit->record('test.three');

        DB::table('audit_logs')->where('id', $middle->id)->delete();

        $this->assertSame($last->id, $audit->verify()['broken_id']);
    }

    public function test_only_admins_read_the_trail(): void
    {
        foreach (['farmer', 'agent', 'officer', 'buyer'] as $role) {
            Sanctum::actingAs($this->user($role));
            $this->getJson('/api/audit')->assertForbidden();
            $this->getJson('/api/audit/export')->assertForbidden();
            $this->getJson('/api/audit/verify')->assertForbidden();
        }
        Sanctum::actingAs($this->user('admin', ['district' => null]));
        $this->getJson('/api/audit?entity=user')->assertOk()->assertJsonPath('total', 5);
    }

    public function test_export_is_itself_logged_and_defuses_formulas(): void
    {
        $this->user('farmer', ['name' => '=cmd()']);
        $admin = $this->user('admin', ['district' => null]);
        Sanctum::actingAs($admin);

        $csv = $this->get('/api/audit/export')->assertOk()->streamedContent();

        $this->assertStringContainsString("'=cmd()", $csv);
        $this->assertDatabaseHas('audit_logs', ['action' => 'audit.exported', 'actor_id' => $admin->id]);
    }

    public function test_scan_trail_stays_in_the_district(): void
    {
        $scan = $this->scan($this->user('farmer'));

        Sanctum::actingAs($this->user('officer', ['district' => 'Rajshahi']));
        $this->getJson("/api/scans/{$scan->id}/trail")->assertForbidden();
        Sanctum::actingAs($this->user('farmer'));
        $this->getJson("/api/scans/{$scan->id}/trail")->assertForbidden();

        Sanctum::actingAs($this->user('officer'));
        $res = $this->getJson("/api/scans/{$scan->id}/trail")->assertOk()->assertJsonPath('entries.0.action', 'scan.created');
        $this->assertArrayNotHasKey('ip', $res->json('entries.0'));
        $this->assertArrayNotHasKey('ai', $res->json('entries.0.changes.after'));
    }

    public function test_history_only_shows_the_officers_district(): void
    {
        $officer = $this->user('officer');
        $farmer = $this->user('farmer');
        $mine = $this->scan($farmer);
        $mine->update(['status' => 'reviewed', 'verdict' => 'urgent', 'reviewed_by' => $officer->id, 'reviewed_at' => now()]);
        $other = $this->scan($farmer);
        $other->field->update(['district' => 'Sylhet']);
        $other->update(['status' => 'reviewed', 'verdict' => 'urgent', 'reviewed_at' => now()]);

        Sanctum::actingAs($officer);
        $this->getJson('/api/scans/history')->assertOk()->assertJsonPath('total', 1)->assertJsonPath('scans.0.id', $mine->id)->assertJsonPath('scans.0.ai_verdict', 'urgent');
        $this->getJson('/api/scans/history?verdict=healthy')->assertJsonPath('total', 0);
    }

    public function test_performance_is_for_the_officer_or_an_admin(): void
    {
        $officer = $this->user('officer');
        $scan = $this->scan($this->user('farmer'));
        $scan->update(['status' => 'reviewed', 'verdict' => 'urgent', 'reviewed_by' => $officer->id, 'reviewed_at' => now()]);
        Guidance::create(['field_id' => $scan->field_id, 'officer_id' => $officer->id, 'scan_id' => $scan->id, 'title' => 'x', 'body' => 'y', 'done_at' => now()]);

        Sanctum::actingAs($this->user('officer'));
        $this->getJson("/api/officers/{$officer->id}/performance")->assertForbidden();

        Sanctum::actingAs($officer);
        $this->getJson("/api/officers/{$officer->id}/performance")->assertOk()
            ->assertJsonPath('stats.reviewed_total', 1)
            ->assertJsonPath('stats.ai_agreement_pct', 100)
            ->assertJsonPath('stats.guidance_done_pct', 100)
            ->assertJsonPath('verdicts.urgent', 1);

        Sanctum::actingAs($this->user('admin', ['district' => null]));
        $this->getJson("/api/officers/{$officer->id}/performance")->assertOk();
    }

    public function test_deleting_land_keeps_a_record_of_its_history(): void
    {
        $farmer = $this->user('farmer');
        $scan = $this->scan($farmer);
        Sanctum::actingAs($farmer);

        $this->deleteJson("/api/fields/{$scan->field_id}")->assertOk();

        $this->assertDatabaseMissing('scans', ['id' => $scan->id]);
        $entry = AuditLog::where('action', 'field.history_removed')->firstOrFail();
        $this->assertSame([$scan->id], $entry->changes['before']['scan_ids']);
        $this->assertDatabaseHas('audit_logs', ['action' => 'field.deleted', 'subject_label' => 'North plot']);
    }
}
