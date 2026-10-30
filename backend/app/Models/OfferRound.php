<?php

namespace App\Models;

use App\Models\Concerns\Audited;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OfferRound extends Model
{
    use Audited;

    protected $fillable = ['offer_id', 'user_id', 'quantity_kg', 'price_per_kg', 'note'];

    protected function casts(): array
    {
        return ['quantity_kg' => 'float', 'price_per_kg' => 'float'];
    }

    public function offer(): BelongsTo
    {
        return $this->belongsTo(Offer::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
