<?php

namespace App\Services;

use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;

class NoteStore
{
    private const DIR = 'notes'; // dentro storage/app/notes
    private const EXT = 'md';

    /**
     * Ritorna elenco note (metadati) ordinato per updated_at desc.
     * output: [{id, title, updated_at}, ...]
     */
    public function list(): array
    {
        $this->ensureDir();

        $files = Storage::disk('local')->files(self::DIR);
        $notes = [];

        foreach ($files as $file) {
            if (!str_ends_with($file, '.' . self::EXT)) {
                continue;
            }

            $raw = Storage::disk('local')->get($file);
            [$meta, $_content] = $this->parseFile($raw);

            $id = $meta['id'] ?? $this->idFromPath($file);
            $title = $meta['title'] ?? $this->fallbackTitle($raw, $id);
            $updatedAt = $meta['updated_at'] ?? null;

            $notes[] = [
                'id' => $id,
                'title' => $title,
                'updated_at' => $updatedAt,
            ];
        }

        usort($notes, function ($a, $b) {
            return strcmp($b['updated_at'] ?? '', $a['updated_at'] ?? '');
        });

        return $notes;
    }

    /**
     * Ritorna una singola nota completa.
     * output: {id, title, updated_at, content_md}
     */
    public function get(string $id): array
    {
        $this->assertValidId($id);
        $this->ensureDir();

        $path = $this->pathForId($id);
        if (!Storage::disk('local')->exists($path)) {
            throw new RuntimeException('NOT_FOUND');
        }

        $raw = Storage::disk('local')->get($path);
        [$meta, $content] = $this->parseFile($raw);

        return [
            'id' => $meta['id'] ?? $id,
            'title' => $meta['title'] ?? $this->fallbackTitle($raw, $id),
            'updated_at' => $meta['updated_at'] ?? null,
            'content_md' => $content,
        ];
    }

    /**
     * Crea una nota nuova e la salva su file.
     */
    public function create(string $title, string $contentMd): array
    {
        $this->ensureDir();

        $id = (string) Str::uuid();
        $now = now()->toIso8601String();

        $meta = [
            'id' => $id,
            'title' => $title,
            'updated_at' => $now,
        ];

        $raw = $this->buildFile($meta, $contentMd);
        Storage::disk('local')->put($this->pathForId($id), $raw);

        return [
            'id' => $id,
            'title' => $title,
            'updated_at' => $now,
            'content_md' => $contentMd,
        ];
    }

    /**
     * Aggiorna una nota esistente.
     */
    public function update(string $id, string $title, string $contentMd): array
    {
        $this->assertValidId($id);
        $this->ensureDir();

        $path = $this->pathForId($id);
        if (!Storage::disk('local')->exists($path)) {
            throw new RuntimeException('NOT_FOUND');
        }

        $now = now()->toIso8601String();

        $meta = [
            'id' => $id,
            'title' => $title,
            'updated_at' => $now,
        ];

        $raw = $this->buildFile($meta, $contentMd);
        Storage::disk('local')->put($path, $raw);

        return [
            'id' => $id,
            'title' => $title,
            'updated_at' => $now,
            'content_md' => $contentMd,
        ];
    }

    public function delete (string $id) : void {
        $this->assertValidId($id);
        $this->ensureDir();

         $path = $this->pathForId($id);
        if (!Storage::disk('local')->exists($path)) {
            throw new RuntimeException('NOT_FOUND');
        }

        Storage::disk('local')->delete($path);
    }

    private function ensureDir(): void
    {
        if (!Storage::disk('local')->exists(self::DIR)) {
            Storage::disk('local')->makeDirectory(self::DIR);
        }
    }

    private function pathForId(string $id): string
    {
        return self::DIR . '/' . $id . '.' . self::EXT;
    }

    private function idFromPath(string $path): string
    {
        $base = basename($path);
        return preg_replace('/\.' . preg_quote(self::EXT, '/') . '$/', '', $base) ?: $base;
    }

    private function assertValidId(string $id): void
    {
        // Accettiamo UUID v4/v7 ecc (pattern UUID generico)
        if (!preg_match('/^[0-9a-fA-F-]{36}$/', $id)) {
            throw new RuntimeException('INVALID_ID');
        }
    }

    /**
     * Parse del file:
     * - se c'è front matter tra --- e ---: estrai meta
     * - il resto è content markdown
     */
    private function parseFile(string $raw): array
    {
        $raw = ltrim($raw, "\xEF\xBB\xBF"); // rimuove eventuale BOM

        if (!str_starts_with($raw, "---\n")) {
            return [[], $raw];
        }

        $end = strpos($raw, "\n---\n", 4);
        if ($end === false) {
            return [[], $raw];
        }

        $front = substr($raw, 4, $end - 4);
        $content = substr($raw, $end + 5); // salta "\n---\n"

        $meta = $this->parseFrontMatter($front);

        // pulizia: rimuovi eventuale newline iniziale
        $content = ltrim($content, "\n");

        return [$meta, $content];
    }

    private function parseFrontMatter(string $front): array
    {
        $meta = [];
        $lines = preg_split("/\r\n|\n|\r/", trim($front)) ?: [];

        foreach ($lines as $line) {
            $line = trim($line);
            if ($line === '' || str_starts_with($line, '#')) {
                continue;
            }

            $pos = strpos($line, ':');
            if ($pos === false) {
                continue;
            }

            $key = trim(substr($line, 0, $pos));
            $val = trim(substr($line, $pos + 1));

            // rimuove virgolette se presenti
            $val = trim($val, "\"'");

            if ($key !== '') {
                $meta[$key] = $val;
            }
        }

        return $meta;
    }

    private function buildFile(array $meta, string $contentMd): string
    {
        // front matter YAML minimale
        $front = "---\n";
        $front .= "id: " . ($meta['id'] ?? '') . "\n";
        $front .= "title: \"" . ($meta['title'] ?? '') . "\"\n";
        $front .= "updated_at: \"" . ($meta['updated_at'] ?? '') . "\"\n";
        $front .= "---\n\n";

        return $front . $contentMd . "\n";
    }

    private function fallbackTitle(string $raw, string $id): string
    {
        // prova a prendere la prima riga tipo "# Titolo"
        foreach (preg_split("/\r\n|\n|\r/", $raw) as $line) {
            $line = trim($line);
            if (preg_match('/^#\s+(.+)$/', $line, $m)) {
                return trim($m[1]);
            }
        }
        return 'Note ' . substr($id, 0, 8);
    }
}
