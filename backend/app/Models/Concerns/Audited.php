<?php

namespace App\Models\Concerns;

use App\Services\Audit;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;

/** Writes every create, change and delete of the model to the audit trail. */
trait Audited
{
    protected static function bootAudited(): void
    {
        static::created(fn ($m) => $m->audit('created', [], $m->auditable($m->getAttributes())));
        static::deleted(fn ($m) => $m->audit('deleted', $m->auditable($m->getAttributes()), []));
        static::updated(function ($m) {
            $after = $m->auditable($m->getChanges());
            if ($after) {
                $event = $after['status'] ?? (isset($after['done_at']) ? 'done' : 'updated');
                $m->audit($event, Arr::only($m->auditable($m->getRawOriginal()), array_keys($after)), $after);
            }
        });
    }

    /** Columns that are noise or secrets; the model adds its own with $auditHidden. */
    private function auditable(array $values): array
    {
        return Arr::except($values, ['password', 'remember_token', 'created_at', 'updated_at', ...($this->auditHidden ?? [])]);
    }

    private function audit(string $event, array $before, array $after): void
    {
        app(Audit::class)->record(
            Str::snake(class_basename($this)).'.'.$event,
            $this,
            array_filter(['before' => $before, 'after' => $after]),
        );
    }

    public function auditLabel(): ?string
    {
        return $this->name ?? $this->title ?? $this->field?->name ?? $this->crop ?? null;
    }

    public function auditDistrict(): ?string
    {
        return $this->district ?? $this->field?->district ?? $this->farmer?->district ?? $this->offer?->farmer?->district ?? null;
    }
}
