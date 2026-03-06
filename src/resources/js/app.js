import './bootstrap';
import { marked } from "marked";
import DOMPurify from "dompurify";

const els = {
    list:              document.getElementById("noteList"),
    search:            document.getElementById("search"),
    btnNew:            document.getElementById("btnNew"),
    btnSave:           document.getElementById("btnSave"),
    title:             document.getElementById("title"),
    content:           document.getElementById("content"),
    preview:           document.getElementById("preview"),
    tabEdit:           document.getElementById("tabEdit"),
    tabPreview:        document.getElementById("tabPreview"),
    status:            document.getElementById("status"),
    btnSummarize:      document.getElementById("btnSummarize"),
    btnTranslateToEng: document.getElementById("btnTranslateEng"),
    summaryBox:        document.getElementById("summaryBox"),
    summaryText:       document.getElementById("summaryText"),
    btnApplySummary:   document.getElementById("btnApplySummary"),
    btnDelete:         document.getElementById("btnDelete"),
};

let notes        = [];
let currentId    = null;
let lastResult   = "";   // testo riassunto o traduzione
let lastOriginal = "";   // testo originale selezionato
let lastAction   = "";   // "summary" | "translate"
let savedRange   = null; // posizione cursore nell'editor

// ── Helpers contenteditable ──────────────────────────────────────────────────

function getEditorMarkdown() {
    const children = els.content.childNodes;
    const parts = [];
    for (const node of children) {
        if (node.nodeType === Node.ELEMENT_NODE) {
            const type = node.dataset.blockType;
            if (type) {
                const text = node.querySelector('.block-body')?.innerText?.trim() ?? "";
                parts.push(`<!-- original: ${text} -->`);
            } else {
                parts.push(node.innerText ?? "");
            }
        } else if (node.nodeType === Node.TEXT_NODE) {
            parts.push(node.textContent ?? "");
        }
    }
    return parts.join("\n");
}

function setEditorMarkdown(md) {
    els.content.innerHTML = "";
    if (!md) {
        const div = document.createElement("div");
        div.innerHTML = "<br>";
        els.content.appendChild(div);
        return;
    }
    const blockRe = /<!--\s*original:\s*([\s\S]*?)\s*-->/g;
    let lastIndex = 0;
    let match;
    while ((match = blockRe.exec(md)) !== null) {
        const before = md.slice(lastIndex, match.index).trim();
        if (before) appendTextLines(before);
        const text = (match[1] ?? "").trim();
        appendBlock(text);
        lastIndex = match.index + match[0].length;
    }
    const after = md.slice(lastIndex).trim();
    if (after) appendTextLines(after);
    const lastChild = els.content.lastElementChild;
    if (!lastChild || lastChild.dataset.blockType) {
        const div = document.createElement("div");
        div.innerHTML = "<br>";
        els.content.appendChild(div);
    }
}

function appendTextLines(text) {
    const lines = text.split("\n");
    for (const line of lines) {
        const div = document.createElement("div");
        div.textContent = line || "";
        if (!line) div.innerHTML = "<br>";
        els.content.appendChild(div);
    }
}

function createBlock(text) {
    const wrapper = document.createElement("div");
    wrapper.dataset.blockType = "original";
    wrapper.contentEditable  = "false";
    wrapper.className = "bg-gray-50 rounded my-2 overflow-hidden select-none";
    wrapper.style.borderLeft = "4px solid #111";

    const header = document.createElement("div");
    header.className = "flex items-center justify-between px-3 py-1 text-xs font-bold uppercase tracking-wide text-gray-500 bg-gray-100";

    const labelEl = document.createElement("span");
    labelEl.textContent = "Testo originale";

    const btnDel = document.createElement("button");
    btnDel.textContent = "✕";
    btnDel.title = "Elimina blocco";
    btnDel.className = "text-gray-400 hover:text-gray-600 leading-none";
    btnDel.addEventListener("mousedown", (e) => {
        e.preventDefault();
        const placeholder = document.createElement("div");
        placeholder.innerHTML = "<br>";
        wrapper.replaceWith(placeholder);
        const s = window.getSelection();
        const r = document.createRange();
        r.setStart(placeholder, 0);
        r.collapse(true);
        s.removeAllRanges();
        s.addRange(r);
    });

    header.appendChild(labelEl);
    header.appendChild(btnDel);

    const body = document.createElement("div");
    body.className = "block-body px-3 pb-2 text-sm leading-relaxed text-gray-800";
    body.textContent = text;

    wrapper.appendChild(header);
    wrapper.appendChild(body);
    return wrapper;
}

function appendBlock(text) {
    els.content.appendChild(createBlock(text));
}

// Inserisce blocco originale + testo sotto (per traduzioni)
function insertBlockInEditor(originalText, resultText) {
    const sel = window.getSelection();

    if (savedRange && els.content.contains(savedRange.startContainer)) {
        sel.removeAllRanges();
        sel.addRange(savedRange);
    }
    savedRange = null;

    let anchor = null;
    let insertBefore = false;

    if (sel && sel.rangeCount > 0 && els.content.contains(sel.anchorNode)) {
        let refNode = sel.getRangeAt(0).startContainer;
        while (refNode.parentElement && refNode.parentElement !== els.content) {
            refNode = refNode.parentElement;
        }
        anchor = refNode;
        insertBefore = anchor.innerText?.trim() === "" || !sel.isCollapsed;
        if (!sel.isCollapsed) {
            sel.deleteFromDocument();
        }
    }

    const block = createBlock(originalText);
    const resultDiv = document.createElement("div");
    resultDiv.textContent = resultText;

    if (anchor && els.content.contains(anchor)) {
        if (insertBefore) {
            anchor.before(block, resultDiv);
        } else {
            anchor.after(block, resultDiv);
        }
    } else {
        els.content.appendChild(block);
        els.content.appendChild(resultDiv);
    }

    const r = document.createRange();
    r.selectNodeContents(resultDiv);
    r.collapse(false);
    sel.removeAllRanges();
    sel.addRange(r);
    els.content.focus();
}

// Inserisce solo testo (per riassunti) - sostituisce la selezione o inserisce al cursore
function insertTextInEditor(text) {
    const sel = window.getSelection();

    if (savedRange && els.content.contains(savedRange.startContainer)) {
        sel.removeAllRanges();
        sel.addRange(savedRange);
    }
    savedRange = null;

    if (!sel || sel.rangeCount === 0 || !els.content.contains(sel.anchorNode)) {
        // Nessun cursore nell'editor, appendi in fondo
        const div = document.createElement("div");
        div.textContent = text;
        els.content.appendChild(div);
        els.content.focus();
        return;
    }

    // Trova l'anchor PRIMA di cancellare (deleteFromDocument può rimuovere nodi)
    let refNode = sel.getRangeAt(0).startContainer;
    while (refNode.parentElement && refNode.parentElement !== els.content) {
        refNode = refNode.parentElement;
    }

    // Crea il div con il testo e usalo come placeholder prima della cancellazione
    const div = document.createElement("div");
    div.textContent = text;

    // Inserisci il div al posto giusto
    const isEmpty = !sel.isCollapsed || refNode.innerText?.trim() === "";
    if (isEmpty) {
        refNode.before(div);
    } else {
        refNode.after(div);
    }

    // Ora cancella la selezione se presente
    if (!sel.isCollapsed) {
        sel.deleteFromDocument();
    }

    const r = document.createRange();
    r.selectNodeContents(div);
    r.collapse(false);
    sel.removeAllRanges();
    sel.addRange(r);
    els.content.focus();
}

// ── Funzioni app ─────────────────────────────────────────────────────────────

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
    els.btnSummarize?.classList.toggle("hidden", !isEdit);
    els.btnTranslateToEng?.classList.toggle("hidden", !isEdit);
    if (!isEdit) renderPreview();
}

function renderPreview() {
    const md   = getEditorMarkdown();
    const html = marked.parse(md);
    els.preview.innerHTML = DOMPurify.sanitize(html, { ADD_TAGS: ['div'] });
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
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
    if (!res.ok) {
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
        li.className = "border rounded p-2 cursor-pointer hover:bg-gray-50 transition";
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
        .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;").replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

async function openNote(id) {
    setStatus("Apertura...");
    const note = await api(`/api/notes/${id}`);
    currentId = note.id;
    els.title.value = note.title || "";
    setEditorMarkdown(note.content_md || "");
    lastResult   = "";
    lastOriginal = "";
    lastAction   = "";
    savedRange   = null;
    els.summaryBox?.classList.add("hidden");
    setStatus(`Aperta ${currentId.slice(0, 8)}…`);
    setActiveTab("edit");
}

function newNote() {
    currentId = null;
    els.title.value = "";
    setEditorMarkdown("");
    lastResult   = "";
    lastOriginal = "";
    lastAction   = "";
    savedRange   = null;
    els.summaryBox?.classList.add("hidden");
    setStatus("Nuova nota (non salvata)");
    setActiveTab("edit");
}

async function saveNote() {
    const payload = {
        title:      els.title.value.trim() || "Senza titolo",
        content_md: getEditorMarkdown(),
    };
    setStatus("Salvataggio...");
    try {
        if (!currentId) {
            const created = await api("/api/notes", { method: "POST", body: JSON.stringify(payload) });
            currentId = created.id;
            setStatus(`Salvata ${currentId.slice(0, 8)}…`);
        } else {
            await api(`/api/notes/${currentId}`, { method: "PUT", body: JSON.stringify(payload) });
            setStatus(`Aggiornata ${currentId.slice(0, 8)}…`);
        }
        await loadList();
    } catch (error) {
        setStatus(error.status === 409 ? "Titolo nota già utilizzato" : "Errore nel salvataggio");
    }
}

async function deleteNote(id) {
    if (!confirm("Sei sicuro di voler eliminare questa nota?")) return;
    setStatus("Eliminazione...");
    await api(`/api/notes/${id}`, { method: "DELETE" });
    currentId = null;
    els.title.value       = "";
    setEditorMarkdown("");
    els.preview.innerHTML = "";
    els.summaryBox?.classList.add("hidden");
    setStatus("Nota eliminata.");
    await loadList();
}

els.btnNew?.addEventListener("click", newNote);
els.btnSave?.addEventListener("click", saveNote);
els.search?.addEventListener("input", renderList);
els.tabEdit?.addEventListener("click",    () => setActiveTab("edit"));
els.tabPreview?.addEventListener("click", () => setActiveTab("preview"));
els.content?.addEventListener("input", () => {
    if (!els.preview.classList.contains("hidden")) renderPreview();
});

// Salva il cursore PRIMA che il click tolga il focus dall'editor
els.btnApplySummary?.addEventListener("mousedown", (e) => {
    e.preventDefault();
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && els.content.contains(sel.anchorNode)) {
        savedRange = sel.getRangeAt(0).cloneRange();
    }
});

loadList().catch((e) => setStatus(`Error: ${e.message}`));

// ── AI actions ────────────────────────────────────────────────────────────────

function setBusy(btn, isBusy, labelBusy = "…") {
    if (!btn) return;
    btn.disabled = isBusy;
    btn.classList.toggle("opacity-60", isBusy);
    btn.classList.toggle("cursor-not-allowed", isBusy);
    if (btn.dataset.label == null) btn.dataset.label = btn.textContent;
    btn.textContent = isBusy ? labelBusy : btn.dataset.label;
}

async function summarizeCurrentNote() {
    const selection = window.getSelection();
    const selectedText = selection?.toString().trim() ?? "";
    const text = selectedText || getEditorMarkdown().trim();

    if (!text) {
        setStatus("Niente da riassumere (contenuto vuoto).");
        return;
    }

    lastOriginal = text;
    lastAction   = "summary";

    setStatus("Riassunto in corso...");
    setBusy(els.btnSummarize, true, "Riassumo…");

    try {
        // const data = await api("/api/ai/summarize", {
        //     method: "POST",
        //     body: JSON.stringify({ text }),
        // });
        // const summary = data?.summary ?? data?.content ?? data?.result ?? data?.text ?? "";
        const summary = "Riassunto."; // mock

        if (!summary) {
            lastResult   = "";
            lastOriginal = "";
            lastAction   = "";
            els.summaryBox?.classList.add("hidden");
            setStatus("Nessun riassunto ricevuto.");
            return;
        }

        lastResult = summary;
        if (els.summaryText) els.summaryText.textContent = summary;
        els.summaryBox?.classList.remove("hidden");
        setStatus("Riassunto pronto.");
    } catch (e) {
        setStatus(`Errore riassunto: ${e.message}`);
    } finally {
        setBusy(els.btnSummarize, false);
    }
}

async function translateSelectionToEng() {
    const selection = window.getSelection();
    const selectedText = selection?.toString().trim() ?? "";
    const text = selectedText || getEditorMarkdown().trim();

    if (!text) {
        setStatus("Niente da tradurre (contenuto vuoto).");
        return;
    }

    lastOriginal = text;
    lastAction   = "translate";

    setStatus("Traduzione in corso...");
    setBusy(els.btnTranslateToEng, true, "Traduco…");

    try {
        // const data = await api("/api/ai/translateToEng", {
        //     method: "POST",
        //     body: JSON.stringify({ text }),
        // });
        // const translation = data?.summary ?? data?.content ?? data?.result ?? data?.text ?? "";
        const translation = "Translation."; // mock

        if (!translation) {
            lastResult   = "";
            lastOriginal = "";
            lastAction   = "";
            els.summaryBox?.classList.add("hidden");
            setStatus("Nessuna traduzione ricevuta.");
            return;
        }

        lastResult = translation;
        if (els.summaryText) els.summaryText.textContent = translation;
        els.summaryBox?.classList.remove("hidden");
        setStatus("Traduzione pronta.");
    } catch (e) {
        setStatus(`Errore traduzione: ${e.message}`);
    } finally {
        setBusy(els.btnTranslateToEng, false);
    }
}

function applyResult() {
    if (!lastResult) return;

    if (lastAction === "translate") {
        // Traduzione: sostituisce la selezione con blocco originale + traduzione
        insertBlockInEditor(lastOriginal, lastResult);
        setStatus("Traduzione inserita (non ancora salvata).");
    } else {
        // Riassunto: sostituisce la selezione con solo il testo del riassunto
        insertTextInEditor(lastResult);
        setStatus("Riassunto inserito (non ancora salvata).");
    }

    els.summaryBox?.classList.add("hidden");
    lastResult   = "";
    lastOriginal = "";
    lastAction   = "";
}

els.btnSummarize?.addEventListener("click", summarizeCurrentNote);
els.btnTranslateToEng?.addEventListener("click", translateSelectionToEng);
els.btnApplySummary?.addEventListener("click", applyResult);
els.btnDelete?.addEventListener("click", () => {
    if (currentId) deleteNote(currentId);
});