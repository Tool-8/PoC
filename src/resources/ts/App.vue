<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

type Note = {
    id: string;
    title: string;
    content_md: string;
    updated_at?: string;
};

type ApiError = Error & {
    status?: number;
};

type SelectionRange = {
    start: number;
    end: number;
};

const notes = ref<Note[]>([]);
const currentId = ref<string | null>(null);

const title = ref('');
const content = ref('');
const search = ref('');

const status = ref('');
const activeTab = ref<'edit' | 'preview'>('edit');

const previewHtml = ref('');
const lastSummary = ref('');
const isSummarizing = ref(false);
const isSaving = ref(false);
const isDeleting = ref(false);

const contentEl = ref<HTMLTextAreaElement | null>(null);
const savedSelection = ref<SelectionRange | null>(null);

const filteredNotes = computed(() => {
    const q = search.value.toLowerCase().trim();
    if (!q) return notes.value;

    return notes.value.filter((n) =>
        (n.title || '').toLowerCase().includes(q)
    );
});

const canDelete = computed(() => Boolean(currentId.value));
const summaryVisible = computed(() => lastSummary.value.trim().length > 0);

function setStatus(message = '') {
    status.value = message;
}

function resetSummary() {
    lastSummary.value = '';
}

function setActiveTab(tab: 'edit' | 'preview') {
    activeTab.value = tab;
}

function rememberSelection(forceOnlyIfSelected = false) {
    const el = contentEl.value;
    if (!el) return;

    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;

    if (forceOnlyIfSelected && end <= start) return;

    savedSelection.value = { start, end };
}

async function restoreSelection() {
    const el = contentEl.value;
    const sel = savedSelection.value;

    if (!el || !sel) return;

    await nextTick();
    el.focus();
    el.setSelectionRange(sel.start, sel.end);
}

async function renderPreview() {
    const markdown = content.value || '';
    const html = await marked.parse(markdown);
    previewHtml.value = DOMPurify.sanitize(html);
}

watch(
    [content, activeTab],
    async ([, tab]) => {
        if (tab === 'preview') {
        await renderPreview();
        }
    },
    { immediate: true }
);

async function api<T>(path: string, opts: RequestInit = {}): Promise<T> {
    const res = await fetch(path, {
        headers: {
        Accept: 'application/json',
        ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
        ...(opts.headers || {}),
        },
        ...opts,
    });

    const text = await res.text();
    let data: unknown = null;

    try {
        data = text ? JSON.parse(text) : null;
    } catch {
        data = { raw: text };
    }

    if (!res.ok) {
        const err = new Error(
        (data as { message?: string; error?: string } | null)?.message ||
        (data as { message?: string; error?: string } | null)?.error ||
        `HTTP ${res.status}`
        ) as ApiError;

        err.status = res.status;
        throw err;
    }

    return data as T;
}

async function loadList() {
    setStatus('Caricamento...');
    notes.value = await api<Note[]>('/api/notes');
    setStatus('');
}

async function openNote(id: string) {
    setStatus('Apertura...');

    const note = await api<Note>(`/api/notes/${id}`);
    currentId.value = note.id;
    title.value = note.title || '';
    content.value = note.content_md || '';
    resetSummary();
    savedSelection.value = null;

    setStatus(`Aperta ${note.id.slice(0, 8)}…`);
    setActiveTab('edit');
}

function newNote() {
    currentId.value = null;
    title.value = '';
    content.value = '';
    previewHtml.value = '';
    savedSelection.value = null;
    resetSummary();

    setStatus('Nuova nota (non salvata)');
    setActiveTab('edit');
}

async function saveNote() {
    const payload = {
        title: title.value.trim() || 'Senza titolo',
        content_md: content.value || '',
    };

    isSaving.value = true;
    setStatus('Salvataggio...');

    try {
        if (!currentId.value) {
        const created = await api<Note>('/api/notes', {
            method: 'POST',
            body: JSON.stringify(payload),
        });

        currentId.value = created.id;
        setStatus(`Salvata ${created.id.slice(0, 8)}…`);
        } else {
        const updated = await api<Note>(`/api/notes/${currentId.value}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
        });

        currentId.value = updated.id;
        setStatus(`Aggiornata ${updated.id.slice(0, 8)}…`);
        }

        await loadList();
    } catch (error) {
        const err = error as ApiError;

        if (err.status === 409) {
        setStatus('Titolo nota già utilizzato');
        } else {
        setStatus('Errore nel salvataggio');
        }
    } finally {
        isSaving.value = false;
    }
}

async function deleteCurrentNote() {
    if (!currentId.value) return;

    const confirmed = window.confirm('Sei sicuro di voler eliminare questa nota?');
    if (!confirmed) return;

    isDeleting.value = true;
    setStatus('Eliminazione...');

    try {
        await api<void>(`/api/notes/${currentId.value}`, {
        method: 'DELETE',
        });

        currentId.value = null;
        title.value = '';
        content.value = '';
        previewHtml.value = '';
        savedSelection.value = null;
        resetSummary();

        setStatus('Nota eliminata.');
        await loadList();
    } finally {
        isDeleting.value = false;
    }
}

async function summarizeCurrentNote() {
    const fullText = content.value || '';
    const selStart = savedSelection.value?.start ?? 0;
    const selEnd = savedSelection.value?.end ?? 0;

    const text = (
        selEnd > selStart
        ? fullText.slice(selStart, selEnd)
        : fullText
    ).trim();

    if (!text) {
        setStatus('Niente da riassumere (contenuto vuoto).');
        return;
    }

    isSummarizing.value = true;
    setStatus('Riassunto in corso...');

    try {
        const data = await api<{
            summary?: string;
            content?: string;
            result?: string;
            text?: string;
        }>('/api/ai/summarize', {
            method: 'POST',
            body: JSON.stringify({ text }),
        });

        const summary =
        data.summary ??
        data.content ??
        data.result ??
        data.text ??
        '';

        if (!summary) {
            resetSummary();
            setStatus('Nessun riassunto ricevuto.');
            return;
        }

        lastSummary.value = summary;
        setStatus('Riassunto pronto.');
    } catch (error) {
        const err = error as ApiError;
        setStatus(`Errore riassunto: ${err.message}`);
    } finally {
        isSummarizing.value = false;
        await restoreSelection();
    }
}

function applySummaryToNote() {
    if (!lastSummary.value) return;

    const full = content.value || '';
    const selStart = savedSelection.value?.start ?? 0;
    const selEnd = savedSelection.value?.end ?? 0;

    if (selEnd > selStart) {
        content.value =
        full.slice(0, selStart) +
        lastSummary.value +
        full.slice(selEnd);
    } else {
        content.value = lastSummary.value;
    }

    savedSelection.value = null;
    resetSummary();
    setActiveTab('edit');
    setStatus('Riassunto inserito nella nota (non ancora salvato).');
}

onMounted(async () => {
    try {
        await loadList();
    } catch (error) {
        const err = error as ApiError;
        setStatus(`Error: ${err.message}`);
    }
});
</script>

<template>
<div class="max-w-6xl mx-auto p-4">
    <div class="flex items-center justify-between">
    <h1 class="text-2xl font-bold">PoC Second Brain</h1>
    <div class="text-sm text-gray-600">API: <code>/api/notes</code></div>
    </div>

    <div class="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
    <aside class="md:col-span-1 bg-white rounded-lg shadow p-3">
        <div class="flex items-center justify-between">
        <h2 class="font-semibold">Note</h2>
        <button
            class="px-3 py-1 rounded bg-black text-white text-sm"
            @click="newNote"
        >
            New
        </button>
        </div>

        <div class="mt-3">
        <input
            v-model="search"
            class="w-full border rounded px-2 py-1 text-sm"
            placeholder="Cerca (client-side)..."
        />
        </div>

        <ul class="mt-3 space-y-2">
        <li
            v-if="filteredNotes.length === 0"
            class="text-sm text-gray-500"
        >
            Nessuna nota
        </li>

        <li
            v-for="note in filteredNotes"
            :key="note.id"
            class="border rounded p-2 cursor-pointer transition hover:bg-gray-50"
            :class="{
            'ring-2 ring-blue-500 bg-blue-50': currentId === note.id
            }"
            @click="openNote(note.id)"
        >
            <div class="font-medium break-words">
            {{ note.title || '(senza titolo)' }}
            </div>
            <div class="text-xs text-gray-500 mt-1">
            {{ note.updated_at || '' }}
            </div>
        </li>
        </ul>
    </aside>

    <main class="md:col-span-2 bg-white rounded-lg shadow p-3">
        <div class="flex items-center gap-2">
        <input
            v-model="title"
            class="flex-1 border rounded px-3 py-2"
            placeholder="Titolo..."
        />

        <button
            class="px-3 py-2 rounded bg-blue-600 text-white text-sm disabled:opacity-60"
            :disabled="isSaving"
            @click="saveNote"
        >
            {{ isSaving ? 'Salvo…' : 'Save' }}
        </button>

        <button
            class="px-3 py-2 rounded bg-red-600 text-white text-sm disabled:opacity-60"
            :disabled="!canDelete || isDeleting"
            @click="deleteCurrentNote"
        >
            {{ isDeleting ? 'Elimino…' : 'Delete' }}
        </button>
        </div>

        <div class="mt-3 flex items-center gap-2 text-sm">
        <button
            class="px-2 py-1 rounded"
            :class="activeTab === 'edit'
            ? 'bg-gray-900 text-white'
            : 'border'"
            @click="setActiveTab('edit')"
        >
            Edit
        </button>

        <button
            class="px-2 py-1 rounded"
            :class="activeTab === 'preview'
            ? 'bg-gray-900 text-white'
            : 'border'"
            @click="setActiveTab('preview')"
        >
            Preview
        </button>

        <button
            v-show="activeTab === 'edit'"
            class="px-2 py-1 rounded bg-emerald-600 text-white disabled:opacity-60"
            :disabled="isSummarizing"
            @click="summarizeCurrentNote"
        >
            {{ isSummarizing ? 'Riassumo…' : 'Riassumi' }}
        </button>

        <span class="ml-auto text-gray-600">{{ status }}</span>
        </div>

        <div
        v-if="summaryVisible"
        class="mt-3 border rounded p-3 bg-emerald-50"
        >
        <div class="flex items-center justify-between">
            <div class="font-semibold text-sm">Riassunto</div>
            <button
            class="text-xs px-2 py-1 rounded bg-emerald-700 text-white"
            @click="applySummaryToNote"
            >
            Inserisci in nota
            </button>
        </div>

        <pre class="mt-2 text-sm whitespace-pre-wrap">{{ lastSummary }}</pre>
        </div>

        <div class="mt-3">
        <textarea
            v-show="activeTab === 'edit'"
            ref="contentEl"
            v-model="content"
            class="w-full h-[55vh] border rounded p-3 font-mono text-sm"
            placeholder="Scrivi in Markdown..."
            @mouseup="rememberSelection()"
            @keyup="rememberSelection()"
            @select="rememberSelection()"
            @blur="rememberSelection(true)"
        />

        <div
            v-show="activeTab === 'preview'"
            class="w-full min-h-[55vh] border rounded p-3 prose max-w-none"
            v-html="previewHtml"
        />
        </div>
    </main>
    </div>
</div>
</template>