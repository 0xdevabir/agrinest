<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class BuyPost extends Model
{
    protected $fillable = ['buyer_id', 'crop', 'quantity_kg', 'price_per_kg', 'district', 'needed_by', 'note', 'status'];

    protected function casts(): array
    {
        return ['quantity_kg' => 'float', 'price_per_kg' => 'float', 'needed_by' => 'date'];
    }

    public function buyer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'buyer_id');
    }

    public function offers(): HasMany
    {
        return $this->hasMany(Offer::class);
    }
}
