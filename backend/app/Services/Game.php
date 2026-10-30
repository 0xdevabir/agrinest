<?php

namespace App\Services;

use App\Models\Field;
use App\Models\Guidance;
use App\Models\Scan;
use App\Models\User;
use App\Models\XpEvent;
use Illuminate\Database\UniqueConstraintViolationException;

class Game
{
    public const POINTS = ['add_land' => 50, 'plant_crop' => 30, 'scan' => 20, 'guidance_done' => 40, 'harvest' => 100, 'first_sale' => 60];

    public function __construct(private Agronomy $agronomy) {}

    /** Award once per (reason, ref), so repeating an action cannot farm points. */
    public function award(User $user, string $reason, string|int $ref): void
    {
        try {
            XpEvent::create(['user_id' => $user->id, 'reason' => $reason, 'ref' => (string) $ref, 'points' => self::POINTS[$reason]]);
            $user->increment('xp', self::POINTS[$reason]);
        } catch (UniqueConstraintViolationException) {
            // Already awarded.
        }
    }

    /** Takes back an award when its action is undone, so undo and redo cannot farm points. */
    public function revoke(User $user, string $reason, string|int $ref): void
    {
        if (XpEvent::where(['user_id' => $user->id, 'reason' => $reason, 'ref' => (string) $ref])->delete()) {
            $user->decrement('xp', self::POINTS[$reason]);
        }
    }

    public function level(int $xp): array
    {
        $level = (int) floor(sqrt($xp / 50)) + 1;
        $floor = 50 * ($level - 1) ** 2;
        $next = 50 * $level ** 2;

        return ['level' => $level, 'xp' => $xp, 'floor' => $floor, 'next' => $next, 'pct' => (int) round(100 * ($xp - $floor) / max(1, $next - $floor))];
    }

    /** Real jobs from the farmer's land, shown as today's quests. */
    public function quests(User $farmer): array
    {
        $quests = [];
        $fields = $farmer->fields()->with('activeCycle')->get();

        if ($fields->isEmpty()) {
            $quests[] = ['id' => 'add_land', 'type' => 'add_land', 'points' => self::POINTS['add_land'], 'en' => 'Draw your first land on the map', 'bn' => 'ম্যাপে আপনার প্রথম জমি আঁকুন', 'field_id' => null];
        }

        foreach (Guidance::whereIn('field_id', $fields->pluck('id'))->whereNull('done_at')->with('field')->latest()->take(3)->get() as $g) {
            $quests[] = ['id' => "guidance-{$g->id}", 'type' => 'guidance', 'guidance_id' => $g->id, 'points' => self::POINTS['guidance_done'], 'en' => $g->title, 'bn' => $g->title, 'field_id' => $g->field_id, 'urgent' => $g->priority === 'urgent'];
        }

        foreach ($fields as $field) {
            if (! $field->activeCycle) {
                $quests[] = ['id' => "plant-{$field->id}", 'type' => 'plant', 'points' => self::POINTS['plant_crop'], 'en' => "Choose a crop for {$field->name}", 'bn' => "{$field->name} জমির ফসল বাছুন", 'field_id' => $field->id];
            } elseif ($this->agronomy->progress($field->activeCycle)['ready']) {
                $quests[] = ['id' => "harvest-{$field->id}", 'type' => 'harvest', 'points' => self::POINTS['harvest'], 'en' => "Harvest {$field->name}", 'bn' => "{$field->name} জমির ফসল তুলুন", 'field_id' => $field->id];
            } elseif (! $field->last_scan_at || $field->last_scan_at->lt(now()->subDays(7))) {
                $quests[] = ['id' => "scan-{$field->id}", 'type' => 'scan', 'points' => self::POINTS['scan'], 'en' => "Scan {$field->name}", 'bn' => "{$field->name} জমি স্ক্যান করুন", 'field_id' => $field->id];
            }
        }

        return array_slice($quests, 0, 5);
    }

    public function badges(User $farmer): array
    {
        $fieldIds = Field::where('farmer_id', $farmer->id)->pluck('id');
        $earned = fn (string $reason) => XpEvent::where('user_id', $farmer->id)->where('reason', $reason)->exists();

        return [
            ['id' => 'landowner', 'emoji' => '🗺️', 'en' => 'Mapped my land', 'bn' => 'জমি ম্যাপে', 'earned' => $fieldIds->isNotEmpty()],
            ['id' => 'watchful', 'emoji' => '🔍', 'en' => '5 scans sent', 'bn' => '৫টি স্ক্যান', 'earned' => Scan::whereIn('field_id', $fieldIds)->count() >= 5],
            ['id' => 'listener', 'emoji' => '🤝', 'en' => 'Followed officer advice', 'bn' => 'পরামর্শ মেনেছি', 'earned' => $earned('guidance_done')],
            ['id' => 'harvester', 'emoji' => '🌾', 'en' => 'First harvest', 'bn' => 'প্রথম ফসল তোলা', 'earned' => $earned('harvest')],
            ['id' => 'trader', 'emoji' => '💰', 'en' => 'First sale', 'bn' => 'প্রথম বিক্রি', 'earned' => $earned('first_sale')],
        ];
    }
}
