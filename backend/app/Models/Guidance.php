<?php

namespace App\Models;

use App\Models\Concerns\Audited;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Guidance extends Model
{
    use Audited;

    protected $table = 'guidance';

    protected $fillable = ['field_id', 'officer_id', 'scan_id', 'priority', 'title', 'body', 'due_on', 'done_at'];

    protected function casts(): array
    {
        return ['due_on' => 'date', 'done_at' => 'datetime'];
    }

    public function field(): BelongsTo
    {
        return $this->belongsTo(Field::class);
    }

    public function officer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'officer_id');
    }
}
