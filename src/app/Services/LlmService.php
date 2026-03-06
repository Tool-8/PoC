<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;

class LlmService
{
    public function summarize(string $text): string
    {
        $response = Http::withHeaders([
            'Authorization' => 'Bearer ' . config('services.llm.api_key'),
            'Content-Type'  => 'application/json',
        ])->post(config('services.llm.base_url') . '/v1/chat/completions', [
            'model' => config('services.llm.model'),
            'messages' => [
                ['role' => 'system', 'content' => 'Riassumi il testo in modo chiaro e sintetico.'],
                ['role' => 'user', 'content' => $text],
            ],
            'temperature' => 0.2,
            'max_tokens' => 300,
        ]);

        if (!$response->ok()) {
            return 'Errore LLM: ' . $response->body();
        }

        return $response['choices'][0]['message']['content'] ?? 'Risposta vuota';
    }

    public function translateToEng(string $text): string
    {
        $response = Http::withHeaders([
            'Authorization' => 'Bearer ' . config('services.llm.api_key'),
            'Content-Type'  => 'application/json',
        ])->post(config('services.llm.base_url') . '/v1/chat/completions', [
            'model' => config('services.llm.model'),
            'messages' => [
                ['role' => 'system', 'content' => "Traduci il seguente testo dall’italiano all’inglese. Mantieni il significato originale ma rendilo naturale per un madrelingua inglese. Conserva il tono e lo stile del testo."],
                ['role' => 'user', 'content' => $text],
            ],
            'temperature' => 0.2,
            'max_tokens' => 300,
        ]);

        if (!$response->ok()) {
            return 'Errore LLM: ' . $response->body();
        }

        return $response['choices'][0]['message']['content'] ?? 'Risposta vuota';
    }
}