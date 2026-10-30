<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\Game;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function register(Request $request): JsonResponse
    {
        // Agents and officers are provisioned by the administration, never self-registered.
        $data = $request->validate([
            'name' => 'required|string|max:120',
            'phone' => 'required|string|max:20|unique:users,phone',
            'password' => 'required|string|min:6|max:100',
            'role' => ['required', Rule::in(['farmer', 'buyer'])],
            'buyer_type' => ['nullable', 'required_if:role,buyer', Rule::in(['broker', 'government', 'company'])],
            'organization' => 'nullable|string|max:160',
            'district' => 'required|string|max:80',
            'upazila' => 'nullable|string|max:80',
            'village' => 'nullable|string|max:120',
        ]);

        $user = User::create($data);

        return response()->json($this->session($user), 201);
    }

    public function login(Request $request): JsonResponse
    {
        $data = $request->validate(['phone' => 'required|string', 'password' => 'required|string']);
        $user = User::where('phone', $data['phone'])->first();

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages(['phone' => ['ফোন নম্বর বা পাসওয়ার্ড ভুল।']]);
        }

        return response()->json($this->session($user));
    }

    public function me(Request $request, Game $game): JsonResponse
    {
        $user = $request->user();

        return response()->json(['user' => $this->userOut($user), 'level' => $game->level($user->xp)]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['ok' => true]);
    }

    private function session(User $user): array
    {
        return ['token' => $user->createToken('app')->plainTextToken, 'user' => $this->userOut($user)];
    }

    private function userOut(User $user): array
    {
        return $user->only(['id', 'name', 'phone', 'role', 'buyer_type', 'organization', 'district', 'upazila', 'village', 'xp']);
    }
}
