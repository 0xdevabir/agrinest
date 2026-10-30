<?php

namespace App\Models;

use App\Models\Concerns\Audited;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Scan extends Model
{
    use Audited;

    protected $fillable = ['field_id', 'crop_cycle_id', 'submitted_by', 'note', 'ai', 'status', 'reviewed_by', 'reviewed_at', 'verdict'];

    protected function casts(): array
    {
        return ['ai' => 'array', 'reviewed_at' => 'datetime'];
    }

    public function field(): BelongsTo
    {
        return $this->belongsTo(Field::class);
    }

    public function cycle(): BelongsTo
    {
        return $this->belongsTo(CropCycle::class, 'crop_cycle_id');
    }

    public function submitter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'submitted_by');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function photos(): HasMany
    {
        return $this->hasMany(ScanPhoto::class);
    }

    public function guidance(): HasOne
    {
        return $this->hasOne(Guidance::class);
    }

    /** The verdict the AI's severity suggests; the same mapping pre-fills the officer's review form. */
    public function aiVerdict(): string
    {
        return ['none' => 'healthy', 'low' => 'watch', 'medium' => 'treat', 'high' => 'urgent'][$this->ai['severity'] ?? ''] ?? 'watch';
    }
}
