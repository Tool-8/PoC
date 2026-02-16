<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\NoteController;

Route::prefix('notes')->group(function () {
    Route::get('/', [NoteController::class, 'index']);      // lista
    Route::get('/{id}', [NoteController::class, 'show']);   // dettaglio
    Route::post('/', [NoteController::class, 'store']);     // crea
    Route::put('/{id}', [NoteController::class, 'update']); // aggiorna
});
