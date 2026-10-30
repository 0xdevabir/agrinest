<?php

namespace App\Http\Controllers;

use App\Models\BuyPost;
use App\Models\Field;
use App\Models\Listing;
use App\Models\Offer;
use App\Services\Game;
use App\Services\Presenter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class MarketController extends Controller
{
    public function __construct(private Presenter $present) {}

    public function board(Request $request): JsonResponse
    {
        $user = $request->user();
        $crop = $request->string('crop')->toString();

        $listings = Listing::where('status', 'open')
            ->when($crop, fn ($q) => $q->where('crop', $crop))
            ->with('farmer', 'field')->withCount(['offers' => fn ($q) => $q->where('status', 'pending')])
            ->latest()->take(60)->get();
        $posts = BuyPost::where('status', 'open')
            ->when($crop, fn ($q) => $q->where('crop', $crop))
            ->with('buyer')->withCount(['offers' => fn ($q) => $q->where('status', 'pending')])
            ->latest()->take(60)->get();
        $offers = Offer::where(fn ($q) => $q->where('buyer_id', $user->id)->orWhere('farmer_id', $user->id))
            ->latest('updated_at')->take(60)->get();

        return response()->json([
            'listings' => $listings->map(fn ($l) => $this->listing($l, $user->id)),
            'buy_posts' => $posts->map(fn ($p) => $this->buyPost($p, $user->id)),
            'offers' => $offers->map(fn ($o) => $this->present->offer($o, $user->id)),
        ]);
    }

    public function storeListing(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->isRole('farmer'), 403, 'Only farmers can list produce.');

        $data = $request->validate([
            'crop' => ['required', Rule::in(array_keys(config('agri.crops')))],
            'quantity_kg' => 'required|numeric|min:1|max:100000000',
            'price_per_kg' => 'required|numeric|min:1|max:100000',
            'field_id' => ['nullable', 'integer', Rule::exists('fields', 'id')->where('farmer_id', $user->id)],
            'note' => 'nullable|string|max:500',
        ]);
        $listing = Listing::create($data + ['farmer_id' => $user->id, 'district' => $user->district]);

        return response()->json(['listing' => $this->listing($listing->load('farmer', 'field'), $user->id)], 201);
    }

    public function closeListing(Request $request, Listing $listing): JsonResponse
    {
        abort_unless($listing->farmer_id === $request->user()->id, 403);
        $listing->update(['status' => 'closed']);
        $listing->offers()->where('status', 'pending')->update(['status' => 'rejected']);

        return response()->json(['ok' => true]);
    }

    public function storeBuyPost(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->isRole('buyer'), 403, 'Only buyers can post a buy request.');

        $data = $request->validate([
            'crop' => ['required', Rule::in(array_keys(config('agri.crops')))],
            'quantity_kg' => 'required|numeric|min:1|max:100000000',
            'price_per_kg' => 'required|numeric|min:1|max:100000',
            'district' => 'nullable|string|max:80',
            'needed_by' => 'nullable|date|after_or_equal:today',
            'note' => 'nullable|string|max:500',
        ]);
        $post = BuyPost::create($data + ['buyer_id' => $user->id, 'district' => $data['district'] ?? $user->district]);

        return response()->json(['buy_post' => $this->buyPost($post->load('buyer'), $user->id)], 201);
    }

    public function closeBuyPost(Request $request, BuyPost $post): JsonResponse
    {
        abort_unless($post->buyer_id === $request->user()->id, 403);
        $post->update(['status' => 'closed']);
        $post->offers()->where('status', 'pending')->update(['status' => 'rejected']);

        return response()->json(['ok' => true]);
    }

    /** A buyer bids on a farmer's listing. */
    public function bid(Request $request, Listing $listing): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->isRole('buyer'), 403, 'Only buyers can bid.');
        abort_unless($listing->status === 'open', 409, 'This listing is closed.');
        $data = $this->validateTerms($request, $listing->quantity_kg);
        abort_if(
            Offer::where('listing_id', $listing->id)->where('buyer_id', $user->id)->where('status', 'pending')->exists(),
            409,
            'You already have an active bid here.',
        );

        return $this->openOffer(['listing_id' => $listing->id, 'buyer_id' => $user->id, 'farmer_id' => $listing->farmer_id, 'turn_user_id' => $listing->farmer_id], $data, $user->id);
    }

    /** A farmer offers produce against a buyer's post. */
    public function sellToPost(Request $request, BuyPost $post): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->isRole('farmer'), 403, 'Only farmers can sell to a buy post.');
        abort_unless($post->status === 'open', 409, 'This buy post is closed.');
        $data = $this->validateTerms($request, $post->quantity_kg);
        abort_if(
            Offer::where('buy_post_id', $post->id)->where('farmer_id', $user->id)->where('status', 'pending')->exists(),
            409,
            'You already have an active offer here.',
        );

        return $this->openOffer(['buy_post_id' => $post->id, 'buyer_id' => $post->buyer_id, 'farmer_id' => $user->id, 'turn_user_id' => $post->buyer_id], $data, $user->id);
    }

    public function counter(Request $request, Offer $offer): JsonResponse
    {
        $user = $request->user();
        $this->assertTurn($offer, $user->id);
        $limit = $offer->listing?->quantity_kg ?? $offer->buyPost?->quantity_kg;
        $data = $this->validateTerms($request, $limit);

        DB::transaction(function () use ($offer, $user, $data) {
            $offer->rounds()->create($data + ['user_id' => $user->id]);
            $offer->update([
                'quantity_kg' => $data['quantity_kg'],
                'price_per_kg' => $data['price_per_kg'],
                'turn_user_id' => $user->id === $offer->buyer_id ? $offer->farmer_id : $offer->buyer_id,
            ]);
        });

        return response()->json(['offer' => $this->present->offer($offer->fresh(), $user->id)]);
    }

    public function accept(Request $request, Offer $offer, Game $game): JsonResponse
    {
        $user = $request->user();
        $this->assertTurn($offer, $user->id);

        DB::transaction(function () use ($offer) {
            // Lock the shared stock so two simultaneous accepts cannot oversell it.
            $target = $offer->listing_id
                ? Listing::lockForUpdate()->findOrFail($offer->listing_id)
                : BuyPost::lockForUpdate()->findOrFail($offer->buy_post_id);
            abort_unless($target->status === 'open', 409, 'This deal is no longer open.');
            abort_if($offer->quantity_kg > $target->quantity_kg, 409, 'Not enough quantity left for this deal.');

            $remaining = round($target->quantity_kg - $offer->quantity_kg, 2);
            $target->update(['quantity_kg' => max($remaining, 0)] + ($remaining <= 0 ? ['status' => $offer->listing_id ? 'sold' : 'filled'] : []));
            $offer->update(['status' => 'accepted']);

            if ($remaining <= 0) {
                $target->offers()->where('status', 'pending')->whereKeyNot($offer->id)->update(['status' => 'rejected']);
            }
        });
        $game->award($offer->farmer, 'first_sale', 'first');

        return response()->json(['offer' => $this->present->offer($offer->fresh(), $user->id)]);
    }

    public function reject(Request $request, Offer $offer): JsonResponse
    {
        $user = $request->user();
        abort_unless(in_array($user->id, [$offer->buyer_id, $offer->farmer_id], true), 403);
        abort_unless($offer->status === 'pending', 409, 'This offer is already closed.');
        $offer->update(['status' => 'rejected']);

        return response()->json(['offer' => $this->present->offer($offer->fresh(), $user->id)]);
    }

    private function openOffer(array $parties, array $terms, int $userId): JsonResponse
    {
        $offer = DB::transaction(function () use ($parties, $terms, $userId) {
            $offer = Offer::create($parties + ['quantity_kg' => $terms['quantity_kg'], 'price_per_kg' => $terms['price_per_kg']]);
            $offer->rounds()->create($terms + ['user_id' => $userId]);

            return $offer;
        });

        return response()->json(['offer' => $this->present->offer($offer, $userId)], 201);
    }

    private function validateTerms(Request $request, ?float $maxQuantity): array
    {
        return $request->validate([
            'quantity_kg' => 'required|numeric|min:1|max:'.($maxQuantity ?? 100000000),
            'price_per_kg' => 'required|numeric|min:1|max:100000',
            'note' => 'nullable|string|max:500',
        ]);
    }

    private function assertTurn(Offer $offer, int $userId): void
    {
        abort_unless(in_array($userId, [$offer->buyer_id, $offer->farmer_id], true), 403);
        abort_unless($offer->status === 'pending', 409, 'This offer is already closed.');
        abort_unless($offer->turn_user_id === $userId, 409, 'Waiting for the other side to answer.');
    }

    private function listing(Listing $l, int $viewerId): array
    {
        $crop = config("agri.crops.{$l->crop}");

        return [
            'id' => $l->id,
            'crop' => $l->crop,
            'en' => $crop['en'],
            'bn' => $crop['bn'],
            'emoji' => $crop['emoji'],
            'quantity_kg' => $l->quantity_kg,
            'price_per_kg' => $l->price_per_kg,
            'reference_price' => $crop['price'],
            'district' => $l->district,
            'note' => $l->note,
            'farmer' => $l->farmer->name,
            'mine' => $l->farmer_id === $viewerId,
            'health_status' => $l->field?->health_status,
            'offers_count' => $l->offers_count ?? 0,
            'created_at' => $l->created_at->toIso8601String(),
        ];
    }

    private function buyPost(BuyPost $p, int $viewerId): array
    {
        $crop = config("agri.crops.{$p->crop}");

        return [
            'id' => $p->id,
            'crop' => $p->crop,
            'en' => $crop['en'],
            'bn' => $crop['bn'],
            'emoji' => $crop['emoji'],
            'quantity_kg' => $p->quantity_kg,
            'price_per_kg' => $p->price_per_kg,
            'reference_price' => $crop['price'],
            'district' => $p->district,
            'needed_by' => $p->needed_by?->toDateString(),
            'note' => $p->note,
            'buyer' => $p->buyer->organization ?: $p->buyer->name,
            'buyer_type' => $p->buyer->buyer_type,
            'mine' => $p->buyer_id === $viewerId,
            'offers_count' => $p->offers_count ?? 0,
            'created_at' => $p->created_at->toIso8601String(),
        ];
    }
}
