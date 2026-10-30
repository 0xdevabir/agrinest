<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use LogicException;

/** One entry in the append-only audit trail. Rows are written by App\Services\Audit and never change. */
class AuditLog extends Model
{
    public const UPDATED_AT = null;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['changes' => 'array', 'created_at' => 'datetime'];
    }

    protected static function booted(): void
    {
        $refuse = fn () => throw new LogicException('Audit entries cannot be changed or deleted.');
        static::updating($refuse);
        static::deleting($refuse);
    }
}
