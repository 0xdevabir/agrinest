<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // No foreign keys: the record must outlive the people and land it describes.
        Schema::create('audit_logs', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('actor_id')->nullable()->index();
            $t->string('actor_name')->nullable();
            $t->string('actor_role')->nullable();
            $t->string('action')->index();
            $t->string('subject_type')->nullable();
            $t->unsignedBigInteger('subject_id')->nullable();
            $t->string('subject_label')->nullable();
            $t->string('district')->nullable()->index();
            $t->text('changes')->nullable();
            $t->string('ip', 45)->nullable();
            $t->string('user_agent')->nullable();
            $t->timestamp('created_at')->index();
            $t->string('prev_hash', 64)->nullable();
            $t->string('hash', 64);
            $t->index(['subject_type', 'subject_id']);
        });

        // Even a direct SQL session can't quietly edit the record on Postgres.
        if (DB::getDriverName() === 'pgsql') {
            DB::unprepared("CREATE FUNCTION audit_logs_refuse() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'audit_logs is append-only'; END; $$ LANGUAGE plpgsql;
                CREATE TRIGGER audit_logs_append_only BEFORE UPDATE OR DELETE ON audit_logs FOR EACH ROW EXECUTE FUNCTION audit_logs_refuse();");
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
        if (DB::getDriverName() === 'pgsql') {
            DB::unprepared('DROP FUNCTION IF EXISTS audit_logs_refuse()');
        }
    }
};
