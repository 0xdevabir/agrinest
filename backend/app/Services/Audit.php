<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

/**
 * The append-only audit trail. Each entry is signed with the app key and with the
 * signature of the entry before it, so editing or removing a row breaks the chain.
 * Rolling back a transaction also removes its entries: only what happened is recorded.
 */
class Audit
{
    private const CHAIN_LOCK = 727001;

    public function record(string $action, ?Model $subject = null, array $changes = [], array $context = []): AuditLog
    {
        // A new sign-up acts for itself; outside a request (seeders, artisan) the actor is the system.
        $actor = array_key_exists('actor', $context) ? $context['actor'] : (Auth::user() ?? (! app()->runningInConsole() && $subject instanceof User ? $subject : null));
        $at = ($context['at'] ?? now())->copy();
        $seeded = isset($context['at']);

        $row = [
            'actor_id' => $actor?->id,
            'actor_name' => $actor?->name,
            'actor_role' => $actor?->role,
            'action' => $action,
            'subject_type' => $subject ? class_basename($subject) : null,
            'subject_id' => $subject?->getKey(),
            'subject_label' => $context['label'] ?? ($subject && method_exists($subject, 'auditLabel') ? $subject->auditLabel() : null),
            'district' => $context['district'] ?? ($subject && method_exists($subject, 'auditDistrict') ? $subject->auditDistrict() : $actor?->district),
            'changes' => $changes ? json_encode($changes) : null,
            'ip' => $seeded ? null : request()->ip(),
            'user_agent' => $seeded ? null : substr((string) request()->userAgent(), 0, 255),
            'created_at' => $at->format('Y-m-d H:i:s'),
        ];

        return DB::transaction(function () use ($row) {
            // A row lock can't stop two writers reading the same tail, so serialise them on Postgres.
            if (DB::getDriverName() === 'pgsql') {
                DB::statement('SELECT pg_advisory_xact_lock(?)', [self::CHAIN_LOCK]);
            }
            $previous = DB::table('audit_logs')->orderByDesc('id')->value('hash');
            $row['prev_hash'] = $previous;
            $row['hash'] = $this->sign($row);

            $id = DB::table('audit_logs')->insertGetId($row);

            return AuditLog::query()->findOrFail($id);
        });
    }

    /** @return array{ok: bool, entries: int, broken_id: int|null} */
    public function verify(): array
    {
        $previous = null;
        $entries = 0;
        foreach (DB::table('audit_logs')->lazyById(500) as $row) {
            $values = (array) $row;
            unset($values['id'], $values['hash']);
            if ($row->prev_hash !== $previous || ! hash_equals($this->sign($values), (string) $row->hash)) {
                return ['ok' => false, 'entries' => $entries, 'broken_id' => $row->id];
            }
            $previous = $row->hash;
            $entries++;
        }

        return ['ok' => true, 'entries' => $entries, 'broken_id' => null];
    }

    private function sign(array $row): string
    {
        $fields = ['actor_id', 'actor_name', 'actor_role', 'action', 'subject_type', 'subject_id', 'subject_label', 'district', 'changes', 'ip', 'user_agent', 'created_at', 'prev_hash'];

        return hash_hmac('sha256', implode("\x1f", array_map(fn ($f) => (string) ($row[$f] ?? ''), $fields)), (string) config('app.key'));
    }
}
