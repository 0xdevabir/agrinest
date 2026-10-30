<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Scan extends Model
{
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
}
