<?php

namespace App\Models;

use App\Models\Concerns\Audited;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Field extends Model
{
    use Audited;

    /** Recomputed by the system, not decisions anyone made. */
    protected array $auditHidden = ['boundary', 'weather', 'weather_risk', 'weather_synced_at', 'health_status', 'health_score', 'last_scan_at'];

    protected $fillable = ['farmer_id', 'created_by', 'name', 'boundary', 'lat', 'lng', 'area_acres', 'district', 'upazila', 'village'];

    protected function casts(): array
    {
        return [
            'boundary' => 'array',
            'weather' => 'array',
            'lat' => 'float',
            'lng' => 'float',
            'area_acres' => 'float',
            'last_scan_at' => 'datetime',
            'weather_synced_at' => 'datetime',
        ];
    }

    public function farmer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'farmer_id');
    }

    public function cycles(): HasMany
    {
        return $this->hasMany(CropCycle::class);
    }

    public function activeCycle(): HasOne
    {
        return $this->hasOne(CropCycle::class)->ofMany(['id' => 'max'], fn ($q) => $q->where('status', 'active'));
    }

    public function scans(): HasMany
    {
        return $this->hasMany(Scan::class);
    }

    public function guidance(): HasMany
    {
        return $this->hasMany(Guidance::class);
    }

    /** Farmers see their own land, agents their farmers' land, officers their district. */
    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        return match ($user->role) {
            'farmer' => $query->where('farmer_id', $user->id),
            'agent' => $query->whereIn('farmer_id', User::where('agent_id', $user->id)->select('id')),
            'officer' => $query->where('district', $user->district),
            default => $query->whereRaw('1 = 0'),
        };
    }

    public function isVisibleTo(User $user): bool
    {
        return self::query()->visibleTo($user)->whereKey($this->id)->exists();
    }

    public function isManagedBy(User $user): bool
    {
        return $user->isRole('farmer', 'agent') && $this->isVisibleTo($user);
    }
}
