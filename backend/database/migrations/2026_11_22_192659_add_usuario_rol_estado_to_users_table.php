<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('usuario', 50)->unique();

            $table->foreignId('id_rol')
                ->constrained('roles')
                ->restrictOnDelete();

            $table->enum('estado', ['activo', 'inactivo'])
                ->default('activo');

            $table->string('email')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['id_rol']);
            $table->dropColumn(['usuario', 'id_rol', 'estado']);
            $table->string('email')->nullable(false)->change();
        });
    }
};
