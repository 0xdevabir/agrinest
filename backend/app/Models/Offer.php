<?php

namespace App\Models;

use App\Models\Concerns\Audited;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Offer extends Model
{
    use Audited;

    protected $fillable = ['listing_id', 'buy_post_id', 'buyer_id', 'farmer_id', 'turn_user_id', 'quantity_kg', 'price_per_kg', 'status'];

    protected function casts(): array
    {
        return ['quantity_kg' => 'float', 'price_per_kg' => 'float'];
    }

    public function listing(): BelongsTo
    {
        return $this->belongsTo(Listing::class);
    }

    public function buyPost(): BelongsTo
    {
        return $this->belongsTo(BuyPost::class);
    }

    public function buyer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'buyer_id');
    }

    public function farmer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'farmer_id');
    }

    public function rounds(): HasMany
    {
        return $this->hasMany(OfferRound::class);
    }
}
