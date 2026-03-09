import './bootstrap';
import { marked } from "marked";
import DOMPurify from "dompurify";

const els = {
    list: document.getElementById("noteList"),
    search: document.getElementById("search"),
    btnNew: document.getElementById("btnNew"),
    btnSave: document.getElementById("btnSave"),
    title: document.getElementById("title"),
    content: document.getElementById("content"),
    preview: document.getElementById("preview"),
    tabEdit: document.getElementById("tabEdit"),
    tabPreview: document.getElementById("tabPreview"),
    status: document.getElementById("status"),
    btnSummarize: document.getElementById("btnSummarize"),
    summaryBox: document.getElementById("summaryBox"),
    summaryText: document.getElementById("summaryText"),
    btnApplySummary: document.getElementById("btnApplySummary"),
    btnDelete: document.getElementById("btnDelete"),
};

let notes = [];
let currentId = null;

function setStatus(msg) {
    els.status.textContent = msg || "";
}

function setActiveTab(tab) {
    const isEdit = tab === "edit";
    els.content.classList.toggle("hidden", !isEdit);
    els.preview.classList.toggle("hidden", isEdit);

    els.tabEdit.className = isEdit
        ? "px-2 py-1 rounded bg-gray-900 text-white"
        : "px-2 py-1 rounded border";

    els.tabPreview.className = !isEdit
        ? "px-2 py-1 rounded bg-gray-900 text-white"
        : "px-2 py-1 rounded border";

    els.btnSummarize.classList.toggle("hidden", !isEdit);    

    if (!isEdit) renderPreview();
}

function renderPreview() {
    const md = els.content.value || "";
    const html = marked.parse(md);
    els.preview.innerHTML = DOMPurify.sanitize(html);
}

async function api(path, opts = {}) {
    const res = await fetch(path, {
        headers: {
        Accept: "application/json",
        ...(opts.body ? { "Content-Type": "application/json" } : {}),
        ...(opts.headers || {}),
        },
        ...opts,
    });

    // Gestione risposta
    const text = await res.text();
    let data = null;
    try {
        data = text ? JSON.parse(text) : null;
    } catch {
        data = { raw: text };
    }

    if (!res.ok) {
        console.error("API error", res.status, data);
        const err = new Error(data?.message || `HTTP ${res.status}`);
        err.status = res.status;
        throw err;
    }
    return data;
}

async function loadList() {
    setStatus("Caricamento...");
    notes = await api("/api/notes");
    renderList();
    setStatus("");
}

function renderList() {
    const q = (els.search.value || "").toLowerCase().trim();
    const filtered = q
        ? notes.filter((n) => (n.title || "").toLowerCase().includes(q))
        : notes;

    els.list.innerHTML = "";

    if (filtered.length === 0) {
        const li = document.createElement("li");
        li.className = "text-sm text-gray-500";
        li.textContent = "Nessuna nota";
        els.list.appendChild(li);
        return;
    }

    for (const n of filtered) {
        const li = document.createElement("li");
        li.className =
        "border rounded p-2 cursor-pointer hover:bg-gray-50 transition";

        li.innerHTML = `
        <div class="font-medium text-sm">${escapeHtml(n.title || "(senza titolo)")}</div>
        <div class="text-xs text-gray-500">${escapeHtml(n.updated_at || "")}</div>
        `;

        li.addEventListener("click", () => openNote(n.id));
        els.list.appendChild(li);
    }
}

function escapeHtml(s) {
    return String(s)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

async function openNote(id) {
    setStatus("Apertura...");
    const note = await api(`/api/notes/${id}`);
    currentId = note.id;
    els.title.value = note.title || "";
    els.content.value = note.content_md || "";
    lastSummary = "";
    els.summaryBox?.classList.add("hidden");
    setStatus(`Aperta ${currentId.slice(0, 8)}…`);
    setActiveTab("edit");
}

function newNote() {
    currentId = null;
    els.title.value = "";
    els.content.value = "";
    lastSummary = "";
    els.summaryBox?.classList.add("hidden");
    setStatus("Nuova nota (non salvata)");
    setActiveTab("edit");
}

async function saveNote() {
    const payload = {
        title: els.title.value.trim() || "Senza titolo",
        content_md: els.content.value || "",
    };

    setStatus("Salvataggio...");

    try {
        if (!currentId) {
        const created = await api("/api/notes", {
        method: "POST",
        body: JSON.stringify(payload),
        });
        currentId = created.id;
        setStatus(`Salvata ${currentId.slice(0, 8)}…`);
        } else {
            await api(`/api/notes/${currentId}`, {
            method: "PUT",
            body: JSON.stringify(payload),
            });
            setStatus(`Aggiornata ${currentId.slice(0, 8)}…`);
        }
        await loadList();
    } catch (error) {
        if (error.status === 409) {
            setStatus("Titolo nota già utilizzato")
        } else {
            setStatus("Errore nel salvataggio");
        }
    }
    

    
}

async function deleteNote(id) {
    if (!confirm("Sei sicuro di voler eliminare questa nota?")) return;
    setStatus("Eliminazione...");
    await api(`/api/notes/${id}`, { method: "DELETE" });
    currentId = null;
    els.title.value = "";
    els.content.value = "";
    els.preview.innerHTML = "";
    els.summaryBox?.classList.add("hidden");
    setStatus("Nota eliminata.");
    await loadList();
}

els.btnNew?.addEventListener("click", newNote);
els.btnSave?.addEventListener("click", saveNote);
els.search?.addEventListener("input", renderList);

els.tabEdit?.addEventListener("click", () => setActiveTab("edit"));
els.tabPreview?.addEventListener("click", () => setActiveTab("preview"));
els.content?.addEventListener("input", () => {
    if (!els.preview.classList.contains("hidden")) renderPreview();
});

loadList().catch((e) => setStatus(`Error: ${e.message}`));

// -- Summarize

let lastSummary = "";

function setBusy(btn, isBusy, labelBusy = "…") {
  if (!btn) return;
  btn.disabled = isBusy;
  btn.classList.toggle("opacity-60", isBusy);
  btn.classList.toggle("cursor-not-allowed", isBusy);
  if (btn.dataset.label == null) btn.dataset.label = btn.textContent;
  btn.textContent = isBusy ? labelBusy : btn.dataset.label;
}

// gestione corretta della selezione
let savedSelection = null;
els.content?.addEventListener("mouseup", () => {
    savedSelection = {
        start: els.content.selectionStart,
        end: els.content.selectionEnd,
    };
});

async function summarizeCurrentNote() {

    // viene inviato solo il testo selezionato, se non c'è nulla selezionato invia l'intero testo
    const selStart = savedSelection?.start ?? 0;
    const selEnd = savedSelection?.end ?? 0;
    const fullText = els.content.value || "";
    const text = (selEnd > selStart ? fullText.slice(selStart, selEnd) : fullText).trim();

  if (!text) {
    setStatus("Niente da riassumere (contenuto vuoto).");
    return;
  }
  setStatus("Riassunto in corso...");
  setBusy(els.btnSummarize, true, "Riassumo…");
  try {
    const data = await api("/api/ai/summarize", {
      method: "POST",
      body: JSON.stringify({ text }),
    });
    const summary =
      data?.summary ?? data?.content ?? data?.result ?? data?.text ?? "";
    if (!summary) {
      lastSummary = "";
      els.summaryBox?.classList.add("hidden");
      setStatus("Nessun riassunto ricevuto.");
      return;
    }
    lastSummary = summary;
    if (els.summaryText) els.summaryText.textContent = summary;
    els.summaryBox?.classList.remove("hidden");
    setStatus("Riassunto pronto.");
  } catch (e) {
    setStatus(`Errore riassunto: ${e.message}`);
  } finally {
    // Ripristina la selezione
    els.content.focus();
    els.content.setSelectionRange(selStart, selEnd);
    setBusy(els.btnSummarize, false);
  }
}

function applySummaryToNote() {
  if (!lastSummary) return;

  const stamp = new Date().toISOString().slice(0, 10);
  const block = `## Riassunto (${stamp})\n\n${lastSummary}\n\n---\n\n`;

  els.content.value = block + (els.content.value || "");
  setActiveTab("edit");

  // aggiorna preview se è aperta
  if (els.preview && !els.preview.classList.contains("hidden")) renderPreview();

  setStatus("Riassunto inserito nella nota (non ancora salvato).");
}

els.btnSummarize?.addEventListener("click", summarizeCurrentNote);
els.btnApplySummary?.addEventListener("click", applySummaryToNote);

els.btnDelete?.addEventListener("click", () => {
    if (currentId) deleteNote(currentId);
});