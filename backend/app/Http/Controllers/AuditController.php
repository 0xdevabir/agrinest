<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\Guidance;
use App\Models\Scan;
use App\Models\User;
use App\Services\Audit;
use App\Services\Presenter;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

/** Reading the audit trail, and the review record and officer performance built on it. */
class AuditController extends Controller
{
    private const OVERDUE_DAYS = 3;

    private const ENTITIES = ['auth', 'user', 'field', 'crop_cycle', 'scan', 'guidance', 'listing', 'buy_post', 'offer', 'offer_round', 'audit'];

    public function __construct(private Presenter $present) {}

    public function index(Request $request): JsonResponse
    {
        abort_unless($request->user()->isRole('admin'), 403);
        $page = $this->filtered($request)->orderByDesc('id')->paginate(50);

        return response()->json([
            'entries' => collect($page->items())->map(fn ($e) => $this->entry($e, true)),
            'page' => $page->currentPage(),
            'pages' => $page->lastPage(),
            'total' => $page->total(),
            'districts' => AuditLog::query()->whereNotNull('district')->distinct()->orderBy('district')->pluck('district'),
        ]);
    }

    public function export(Request $request, Audit $audit): StreamedResponse
    {
        abort_unless($request->user()->isRole('admin'), 403);
        $query = $this->filtered($request);
        // Taking a copy of the record is itself on the record.
        $audit->record('audit.exported', null, ['after' => array_filter($request->only('q', 'entity', 'district', 'from', 'to'))]);

        return response()->streamDownload(function () use ($query) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF"); // Lets Excel read Bangla as UTF-8.
            fputcsv($out, ['id', 'time', 'actor_id', 'actor', 'role', 'action', 'subject_type', 'subject_id', 'subject', 'district', 'changes', 'ip', 'user_agent', 'hash']);
            foreach ($query->lazyById(500) as $e) {
                fputcsv($out, array_map($this->csvCell(...), [
                    $e->id, $e->created_at->toIso8601String(), $e->actor_id, $e->actor_name, $e->actor_role, $e->action, $e->subject_type, $e->subject_id,
                    $e->subject_label, $e->district, $e->changes ? json_encode($e->changes, JSON_UNESCAPED_UNICODE) : null, $e->ip, $e->user_agent, $e->hash,
                ]));
            }
            fclose($out);
        }, 'agrinest-audit-'.now()->format('Y-m-d-His').'.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    public function verify(Request $request, Audit $audit): JsonResponse
    {
        abort_unless($request->user()->isRole('admin'), 403);

        return response()->json($audit->verify());
    }

    /** What the signed-in person did. Network details are only shown to admins. */
    public function mine(Request $request): JsonResponse
    {
        $entries = AuditLog::query()->where('actor_id', $request->user()->id)->orderByDesc('id')->take(30)->get();

        return response()->json(['entries' => $entries->map(fn ($e) => $this->entry($e, $request->user()->isRole('admin')))]);
    }

    /** Every scan already reviewed in the officer's district. */
    public function history(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->isRole('officer'), 403);
        $data = $request->validate([
            'verdict' => ['nullable', Rule::in(['healthy', 'watch', 'treat', 'urgent'])],
            'q' => 'nullable|string|max:80',
            'mine' => 'nullable|boolean',
        ]);

        $page = Scan::where('status', 'reviewed')
            ->whereHas('field', fn ($q) => $q->where('district', $user->district))
            ->when($data['verdict'] ?? null, fn ($q, $v) => $q->where('verdict', $v))
            ->when($data['mine'] ?? false, fn ($q) => $q->where('reviewed_by', $user->id))
            ->when($data['q'] ?? null, fn ($q, $term) => $q->whereHas('field', function ($f) use ($term) {
                $like = '%'.mb_strtolower($term).'%';
                $f->where(fn ($w) => $w->whereRaw('LOWER(name) LIKE ?', [$like])
                    ->orWhereHas('farmer', fn ($u) => $u->whereRaw('LOWER(name) LIKE ?', [$like])));
            }))
            ->with('photos', 'submitter', 'reviewer', 'guidance', 'field.farmer', 'field.activeCycle')
            ->orderByDesc('reviewed_at')->paginate(25);

        return response()->json([
            'scans' => collect($page->items())->map(fn ($s) => $this->reviewed($s)),
            'page' => $page->currentPage(),
            'pages' => $page->lastPage(),
            'total' => $page->total(),
        ]);
    }

    /** A scan's whole story: what was submitted, what was decided, by whom and when. */
    public function trail(Request $request, Scan $scan): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->isRole('admin') || ($user->isRole('officer') && $scan->field->district === $user->district), 403);
        $scan->load('photos', 'submitter', 'reviewer', 'guidance', 'field.farmer', 'field.activeCycle');

        $guidance = Guidance::where('scan_id', $scan->id)->pluck('id');
        $entries = AuditLog::query()
            ->where(fn ($q) => $q->where(['subject_type' => 'Scan', 'subject_id' => $scan->id])
                ->orWhere(fn ($g) => $g->where('subject_type', 'Guidance')->whereIn('subject_id', $guidance)))
            ->orderBy('id')->get();

        return response()->json([
            'scan' => $this->reviewed($scan),
            'entries' => $entries->map(fn ($e) => $this->entry($e, $user->isRole('admin'))),
        ]);
    }

    /** An officer's record, for themselves or for the admins who oversee them. */
    public function performance(Request $request, User $officer): JsonResponse
    {
        $viewer = $request->user();
        abort_unless($viewer->isRole('admin') || $viewer->id === $officer->id, 403);
        abort_unless($officer->isRole('officer'), 404);

        $reviews = Scan::where('reviewed_by', $officer->id)->whereNotNull('reviewed_at')->get(['id', 'ai', 'verdict', 'created_at', 'reviewed_at']);
        $hours = fn ($s) => $s->created_at->diffInMinutes($s->reviewed_at) / 60;
        $recent = $reviews->filter(fn ($s) => $s->reviewed_at->gte(now()->subDays(30)));
        $pending = Scan::where('status', 'pending')->whereHas('field', fn ($q) => $q->where('district', $officer->district));
        $guidance = Guidance::where('officer_id', $officer->id);

        $weeks = collect(range(7, 0))->map(function ($ago) use ($reviews) {
            $start = now()->subWeeks($ago)->startOfWeek();

            return [
                'start' => $start->toDateString(),
                'value' => $reviews->filter(fn ($s) => $s->reviewed_at->betweenIncluded($start, $start->copy()->endOfWeek()))->count(),
            ];
        })->values();

        return response()->json([
            'officer' => $officer->only(['id', 'name', 'phone', 'organization', 'district', 'upazila']) + ['since' => $officer->created_at?->toIso8601String()],
            'overdue_days' => self::OVERDUE_DAYS,
            'stats' => [
                'pending' => (clone $pending)->count(),
                'overdue' => (clone $pending)->where('created_at', '<', now()->subDays(self::OVERDUE_DAYS))->count(),
                'reviewed_today' => $reviews->filter(fn ($s) => $s->reviewed_at->isToday())->count(),
                'reviewed_30d' => $recent->count(),
                'reviewed_total' => $reviews->count(),
                'avg_hours_30d' => $recent->isEmpty() ? null : round($recent->avg($hours), 1),
                'on_time_pct' => $this->pct($reviews->filter(fn ($s) => $hours($s) <= self::OVERDUE_DAYS * 24)->count(), $reviews->count()),
                'ai_agreement_pct' => $this->pct($reviews->filter(fn ($s) => $s->verdict === $s->aiVerdict())->count(), $reviews->count()),
                'guidance_sent' => (clone $guidance)->count(),
                'guidance_done_pct' => $this->pct((clone $guidance)->whereNotNull('done_at')->count(), (clone $guidance)->count()),
            ],
            'verdicts' => $reviews->countBy('verdict')->all() + ['healthy' => 0, 'watch' => 0, 'treat' => 0, 'urgent' => 0, 'unknown' => 0],
            'weeks' => $weeks,
            'activity' => AuditLog::query()->where('actor_id', $officer->id)->orderByDesc('id')->take(25)->get()->map(fn ($e) => $this->entry($e, $viewer->isRole('admin'))),
        ]);
    }

    private function filtered(Request $request): Builder
    {
        $data = $request->validate([
            'q' => 'nullable|string|max:80',
            'entity' => ['nullable', Rule::in(self::ENTITIES)],
            'district' => 'nullable|string|max:80',
            'actor_id' => 'nullable|integer',
            'from' => 'nullable|date',
            'to' => 'nullable|date',
        ]);

        return AuditLog::query()
            ->when($data['q'] ?? null, function ($query, $term) {
                $like = '%'.mb_strtolower($term).'%';
                $query->where(fn ($q) => $q->whereRaw('LOWER(actor_name) LIKE ?', [$like])
                    ->orWhereRaw('LOWER(subject_label) LIKE ?', [$like])
                    ->orWhereRaw('LOWER(action) LIKE ?', [$like]));
            })
            ->when($data['entity'] ?? null, fn ($q, $entity) => $q->where('action', 'like', $entity.'.%'))
            ->when($data['district'] ?? null, fn ($q, $district) => $q->where('district', $district))
            ->when($data['actor_id'] ?? null, fn ($q, $id) => $q->where('actor_id', $id))
            ->when($data['from'] ?? null, fn ($q, $from) => $q->where('created_at', '>=', $from.' 00:00:00'))
            ->when($data['to'] ?? null, fn ($q, $to) => $q->where('created_at', '<=', $to.' 23:59:59'));
    }

    private function entry(AuditLog $e, bool $withNetwork): array
    {
        return [
            'id' => $e->id,
            'at' => $e->created_at->toIso8601String(),
            'actor' => $e->actor_name,
            'actor_id' => $e->actor_id,
            'role' => $e->actor_role,
            'action' => $e->action,
            'subject_type' => $e->subject_type,
            'subject_id' => $e->subject_id,
            'subject' => $e->subject_label,
            'district' => $e->district,
            'changes' => $this->readable($e->changes),
        ] + ($withNetwork ? ['ip' => $e->ip, 'user_agent' => $e->user_agent, 'hash' => $e->hash] : []);
    }

    /** The full AI response stays in the database and the CSV; screens only need the finding. */
    private function readable(?array $changes): ?array
    {
        return $changes ? Arr::map($changes, fn ($side) => Arr::except($side, ['ai'])) : null;
    }

    private function reviewed(Scan $scan): array
    {
        return $this->present->scan($scan) + [
            'field' => $this->present->field($scan->field),
            'ai_verdict' => $scan->aiVerdict(),
            'response_hours' => $scan->reviewed_at ? round($scan->created_at->diffInMinutes($scan->reviewed_at) / 60, 1) : null,
            'guidance' => $scan->guidance ? $this->present->guidance($scan->guidance) : null,
        ];
    }

    /** Stops a spreadsheet running a value (a farm named "=cmd()") as a formula. */
    private function csvCell(mixed $value): mixed
    {
        return is_string($value) && preg_match('/^[=+\-@\t\r]/', $value) ? "'".$value : $value;
    }

    private function pct(int $part, int $whole): ?int
    {
        return $whole ? (int) round($part / $whole * 100) : null;
    }
}
