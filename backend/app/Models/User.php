<?php

namespace App\Models;

use App\Models\Concerns\Audited;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use Audited, HasApiTokens;

    protected array $auditHidden = ['xp'];

    protected $fillable = ['name', 'phone', 'password', 'role', 'buyer_type', 'organization', 'district', 'upazila', 'village', 'agent_id'];

    protected $hidden = ['password', 'remember_token'];

    protected function casts(): array
    {
        return ['password' => 'hashed', 'xp' => 'integer'];
    }

    public function fields(): HasMany
    {
        return $this->hasMany(Field::class, 'farmer_id');
    }

    public function isRole(string ...$roles): bool
    {
        return in_array($this->role, $roles, true);
    }
}
