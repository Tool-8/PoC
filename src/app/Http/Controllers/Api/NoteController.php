<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\NoteStore;
use Illuminate\Http\Request;
use RuntimeException;

class NoteController extends Controller
{
    public function __construct(private readonly NoteStore $store)
    {
    }

    // GET /api/notes
    public function index()
    {
        return response()->json($this->store->list());
    }

    // GET /api/notes/{id}
    public function show(string $id)
    {
        try {
            return response()->json($this->store->get($id));
        } catch (RuntimeException $e) {
            return $this->mapError($e);
        }
    }

    // POST /api/notes
    public function store(Request $request)
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:200'],
            'content_md' => ['nullable', 'string'],
        ]);

        $note = $this->store->create(
            $data['title'],
            $data['content_md'] ?? ''
        );

        return response()->json($note, 201);
    }

    // PUT /api/notes/{id}
    public function update(Request $request, string $id)
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:200'],
            'content_md' => ['nullable', 'string'],
        ]);

        try {
            $note = $this->store->update(
                $id,
                $data['title'],
                $data['content_md'] ?? ''
            );

            return response()->json($note);
        } catch (RuntimeException $e) {
            return $this->mapError($e);
        }
    }

    // DELETE /api/notes/{id}
    public function destroy(string $id) {
        try {
            $this->store->delete($id);
            return response()->json(null, 204);
        } catch (RuntimeException $e) {
            return $this->mapError($e);
        }
    }

    private function mapError(RuntimeException $e)
    {
        return match ($e->getMessage()) {
            'NOT_FOUND' => response()->json(['message' => 'Note not found'], 404),
            'INVALID_ID' => response()->json(['message' => 'Invalid note id'], 400),
            default => response()->json(['message' => 'Server error'], 500),
        };
    }
}
