<!doctype html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Second Brain PoC</title>
  @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>

<body class="min-h-screen bg-gray-50">
    <div class="max-w-6xl mx-auto p-4">
        <div class="flex items-center justify-between">
            <h1 class="text-2xl font-bold">PoC Second Brain</h1>
            <div class="text-sm text-gray-600">API: <code>/api/notes</code></div>
        </div>

        <div class="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <!-- LISTA -->
            <aside class="md:col-span-1 bg-white rounded-lg shadow p-3">
                <div class="flex items-center justify-between">
                    <h2 class="font-semibold">Note</h2>
                    <button id="btnNew" class="px-3 py-1 rounded bg-black text-white text-sm">New</button>
                </div>

                <div class="mt-3">
                    <input id="search" class="w-full border rounded px-2 py-1 text-sm" placeholder="Cerca (client-side)..." />
                </div>

                <ul id="noteList" class="mt-3 space-y-2"></ul>
            </aside>

            <!-- EDITOR / PREVIEW -->
            <main class="md:col-span-2 bg-white rounded-lg shadow p-3">
                <div class="flex items-center gap-2">
                    <input id="title" class="flex-1 border rounded px-3 py-2" placeholder="Titolo..." />
                    <button id="btnSave" class="px-3 py-2 rounded bg-blue-600 text-white text-sm">Save</button>
                    <button id="btnDelete" class="px-3 py-2 rounded bg-red-600 text-white text-sm">Delete</button>
                </div>

                <div class="mt-3 flex items-center gap-2 text-sm">
                    <button id="tabEdit" class="px-2 py-1 rounded bg-gray-900 text-white">Edit</button>
                    <button id="tabPreview" class="px-2 py-1 rounded border">Preview</button>

                    <button id="btnSummarize" class="px-2 py-1 rounded bg-emerald-600 text-white">
                        Riassumi
                    </button>
                    <button id="btnTranslateEng" class="px-2 py-1 rounded bg-yellow-600 text-white">
                        Traduci in Inglese
                    </button>

                    <span id="status" class="ml-auto text-gray-600"></span>
                    </div>

                    <!-- Output riassunto (opzionale ma utile) -->
                    <div id="summaryBox" class="hidden mt-3 border rounded p-3 bg-emerald-50">
                    <div class="flex items-center justify-between">
                        <div class="font-semibold text-sm">Riassunto</div>
                        <button id="btnApplySummary" class="text-xs px-2 py-1 rounded bg-emerald-700 text-white">
                        Inserisci in nota
                        </button>
                    </div>
                    <pre id="summaryText" class="mt-2 text-sm whitespace-pre-wrap"></pre>
                </div>

                <div class="mt-3">
                    <div id="content" contenteditable="true" class="w-full min-h-[55vh] border rounded p-3 font-mono text-sm outline-none overflow-y-auto" style="white-space: pre-wrap;"></div>
                    <div id="preview" class="hidden w-full min-h-[55vh] border rounded p-3 prose max-w-none"></div>
                </div>
            </main>
        </div>
    </div>
</body>
</html>