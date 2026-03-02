<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\NoteController;
use App\Services\LlmService;
use Illuminate\Http\Request;

Route::prefix('notes')->group(function () {
    Route::get('/', [NoteController::class, 'index']);      // lista
    Route::get('/{id}', [NoteController::class, 'show']);   // dettaglio
    Route::post('/', [NoteController::class, 'store']);     // crea
    Route::put('/{id}', [NoteController::class, 'update']); // aggiorna
    Route::delete('/{id}', [NoteController::class, 'destroy']);
});

Route::post('/ai/summarize', function (Request $request, \App\Services\LlmService $llm) {

    $text = $request->input('text');

    if (!$text) {
        return response()->json(['error' => 'Missing text'], 422);
    }

    return response()->json([
        'summary' => $llm->summarize($text)
    ]);
});