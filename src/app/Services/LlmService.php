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
                ['role' => 'system', 'content' => 'Riassumi il seguente testo in modo chiaro e conciso mantenendo solo le informazioni più importanti. Non aggiungere introduzioni, commenti o frasi come “Ecco il riassunto”. Restituisci esclusivamente il riassunto.'],
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