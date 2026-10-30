<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Listing extends Model
{
    protected $fillable = ['farmer_id', 'field_id', 'crop', 'quantity_kg', 'price_per_kg', 'district', 'note', 'status'];

    protected function casts(): array
    {
        return ['quantity_kg' => 'float', 'price_per_kg' => 'float'];
    }

    public function farmer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'farmer_id');
    }

    public function field(): BelongsTo
    {
        return $this->belongsTo(Field::class);
    }

    public function offers(): HasMany
    {
        return $this->hasMany(Offer::class);
    }
}
