<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OfferRound extends Model
{
    protected $fillable = ['offer_id', 'user_id', 'quantity_kg', 'price_per_kg', 'note'];

    protected function casts(): array
    {
        return ['quantity_kg' => 'float', 'price_per_kg' => 'float'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
