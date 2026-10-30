<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CropCycle extends Model
{
    protected $fillable = ['field_id', 'crop', 'variety', 'sown_on', 'expected_harvest_on', 'status', 'harvested_on', 'actual_yield_kg'];

    protected function casts(): array
    {
        return [
            'sown_on' => 'date',
            'expected_harvest_on' => 'date',
            'harvested_on' => 'date',
            'actual_yield_kg' => 'float',
        ];
    }

    public function field(): BelongsTo
    {
        return $this->belongsTo(Field::class);
    }
}
