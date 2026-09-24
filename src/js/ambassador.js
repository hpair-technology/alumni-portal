/* Alumni Ambassador programme: an admin-built application form, one
   submission per alum, and a review list with statuses. */
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase.js";
import { state, AmbConfig, Submissions, myName } from "./state.js";
import { QUESTION_TYPES, LIMITS } from "./config.js";
import {
  $, $$, esc, avatarHtml, formatDate, openModal, closeModal, toast, busy, confirmDialog, csvCell, downloadText, plural,
} from "./util.js";
import { uploadFile, safeName } from "./uploads.js";

const STATUS = { new: "New", reviewing: "Under review", accepted: "Accepted", declined: "Declined" };
const STATUS_TAG = { new: "tag-info", reviewing: "tag-warn", accepted: "tag-ok", declined: "" };

export function initAmbassador() {
  $("q-type").innerHTML = Object.entries(QUESTION_TYPES).map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join("");
  $("q-type").addEventListener("change", (e) => { $("q-options-section").hidden = !(e.target.value === "select" || e.target.value === "checkbox"); });
  $("add-question-btn").addEventListener("click", () => openModal("question-modal"));
  $("question-form").addEventListener("submit", addQuestion);
  $("amb-open-toggle").addEventListener("change", async (e) => {
    const cfg = AmbConfig.data || { open: false, questions: [] };
    try {
      await AmbConfig.write({ ...cfg, open: e.target.checked });
      toast(e.target.checked ? "Applications open." : "Applications closed.", "info");
    } catch (err) { toast(err.message, "error"); e.target.checked = !e.target.checked; }
  });
  $("view-applications-btn").addEventListener("click", () => { renderSubmissions(); openModal("submissions-modal"); });
  $("export-submissions").addEventListener("click", exportSubmissions);

  $("ambassador-form-container").addEventListener("click", onBuilderClick);
  $("submissions-list").addEventListener("change", async (e) => {
    const sel = e.target.closest("[data-status-for]");
    if (!sel) return;
    try { await Submissions.update(sel.dataset.statusFor, { status: sel.value }); toast("Status updated.", "ok"); }
    catch (err) { toast(err.message, "error"); }
  });
  $("submissions-list").addEventListener("click", async (e) => {
    const del = e.target.closest("[data-del-sub]");
    if (!del) return;
    const ok = await confirmDialog("This deletes the application. The applicant can apply again.", { title: "Delete?", confirmLabel: "Delete" });
    if (!ok) return;
    try { await Submissions.remove(del.dataset.delSub); toast("Deleted.", "info"); }
    catch (err) { toast(err.message, "error"); }
  });
}

let mySubUnsub = null;
/** Watch the signed-in alum's own application so a status change shows live. */
export function loadMySubmission() {
  stopMySubmission();
  if (!state.user) return;
  try {
    mySubUnsub = onSnapshot(doc(db, "ambassador_submissions", state.user.uid),
      (snap) => { state.mySubmission = snap.exists() ? snap.data() : null; renderAmbassador(); },
      () => { state.mySubmission = null; renderAmbassador(); });
  } catch { state.mySubmission = null; renderAmbassador(); }
}
export function stopMySubmission() {
  if (mySubUnsub) { mySubUnsub(); mySubUnsub = null; }
}

async function addQuestion(e) {
  e.preventDefault();
  const type = $("q-type").value;
  const cfg = AmbConfig.data || { open: false, questions: [] };
  const needsOptions = type === "select" || type === "checkbox";
  const options = needsOptions ? $("q-options").value.split("\n").map((s) => s.trim()).filter(Boolean) : [];
  if (needsOptions && !options.length) { toast("Add at least one option.", "error"); return; }
  const label = $("q-label").value.trim();
  if (!label) { toast("Question text is required.", "error"); return; }
  try {
    await AmbConfig.write({ ...cfg, questions: [...(cfg.questions || []), { id: `q${Date.now().toString(36)}`, label, type, required: $("q-required").checked, options }] });
    closeModal("question-modal");
    $("question-form").reset();
    $("q-required").checked = true;
    $("q-options-section").hidden = true;
    toast("Added.", "ok");
  } catch (err) { toast(err.message, "error"); }
}

async function onBuilderClick(e) {
  const cfg = AmbConfig.data || { open: false, questions: [] };
  const questions = [...(cfg.questions || [])];
  const move = e.target.closest("[data-move]");
  if (move) {
    const i = Number(move.dataset.move), j = i + Number(move.dataset.dir);
    if (j < 0 || j >= questions.length) return;
    [questions[i], questions[j]] = [questions[j], questions[i]];
    try { await AmbConfig.write({ ...cfg, questions }); } catch (err) { toast(err.message, "error"); }
    return;
  }
  const del = e.target.closest("[data-del-q]");
  if (del) {
    const ok = await confirmDialog("Existing answers are kept.", { title: "Remove question?", confirmLabel: "Remove" });
    if (!ok) return;
    questions.splice(Number(del.dataset.delQ), 1);
    try { await AmbConfig.write({ ...cfg, questions }); toast("Removed.", "info"); } catch (err) { toast(err.message, "error"); }
  }
}

export function renderAmbassador() {
  const box = $("ambassador-form-container");
  if (!box) return;
  const cfg = AmbConfig.data || { open: false, questions: [] };
  const questions = cfg.questions || [];
  $("amb-open-toggle").checked = cfg.open === true;

  /* Admin: the question builder */
  if (state.isAdmin) {
    box.innerHTML = `
      <p class="help" style="margin-bottom:14px">${questions.length
        ? `${plural(questions.length, "question")}${cfg.open ? "" : ". Applications closed"}.`
        : "No questions yet."}</p>
      ${questions.length ? `<div class="q-list">${questions.map((q, i) => `
        <div class="q-item">
          <span class="q-num">${i + 1}</span>
          <span class="q-info">
            <b>${esc(q.label)}${q.required ? ' <span style="color:var(--crimson)" title="Required">*</span>' : ""}</b>
            <span>${esc(QUESTION_TYPES[q.type] || q.type)}${q.required ? " · required" : ""}${q.options?.length ? ` · ${q.options.map(esc).join(", ")}` : ""}</span>
          </span>
          <span class="q-tools">
            <button type="button" class="btn btn-quiet btn-sm" data-move="${i}" data-dir="-1" ${i === 0 ? "disabled" : ""} aria-label="Move up">↑</button>
            <button type="button" class="btn btn-quiet btn-sm" data-move="${i}" data-dir="1" ${i === questions.length - 1 ? "disabled" : ""} aria-label="Move down">↓</button>
            <button type="button" class="btn btn-quiet btn-sm" data-del-q="${i}">Remove</button>
          </span>
        </div>`).join("")}</div>` : ""}`;
    return;
  }

  /* Alum: already applied */
  if (state.mySubmission) {
    const s = state.mySubmission;
    const st = Submissions.items.find((x) => x.id === state.user.uid)?.status || s.status || "new";
    box.innerHTML = `<div class="empty" style="border-style:solid;text-align:left">
      <h4>Application submitted ${esc(formatDate(s.submittedAt))}.</h4>
      <p>Status: <span class="tag ${STATUS_TAG[st] || ""}">${esc(STATUS[st] || st)}</span></p>
    </div>`;
    return;
  }

  /* Alum: closed */
  if (!questions.length || cfg.open !== true) {
    box.innerHTML = `<div class="empty"><h4>Applications are closed.</h4></div>`;
    return;
  }

  /* Alum: the form */
  box.innerHTML = `
    <p class="help" style="margin-bottom:22px">Ambassadors represent HPAIR in their city or region for one year. One application per person.</p>
    <form id="apply-form" class="apply-form">
      ${questions.map((q, i) => renderQuestion(q, i)).join("")}
      <div class="form-actions" style="justify-content:flex-start">
        <button type="submit" class="btn btn-primary btn-lg" id="apply-submit">Submit application</button>
      </div>
    </form>`;
  $("apply-form").addEventListener("submit", submitApplication);
}

function renderQuestion(q, i) {
  const name = `q_${i}`;
  const req = q.required ? "required" : "";
  const head = `<label class="label" for="${name}">${esc(q.label)} ${q.required ? '<span class="req">*</span>' : ""}</label>`;
  let body;
  switch (q.type) {
    case "long": body = `<textarea class="textarea" id="${name}" name="${name}" rows="5" ${req}></textarea>`; break;
    case "select": body = `<select class="select" id="${name}" name="${name}" ${req}><option value="">Choose one…</option>${(q.options || []).map((o) => `<option value="${esc(o)}">${esc(o)}</option>`).join("")}</select>`; break;
    case "checkbox": body = `<div class="check-grid" id="${name}">${(q.options || []).map((o) => `<label class="check"><input type="checkbox" name="${name}" value="${esc(o)}"> ${esc(o)}</label>`).join("")}</div>`; break;
    case "file": body = `<div class="filedrop"><div class="filedrop-text"><b>Choose a file</b><span>PDF, image or document, up to ${LIMITS.attachmentMB} MB</span></div><input type="file" id="${name}" name="${name}" ${req}></div>`; break;
    default: body = `<input class="input" type="text" id="${name}" name="${name}" ${req} maxlength="500">`;
  }
  return `<div class="apply-q">${head}${body}</div>`;
}

async function submitApplication(e) {
  e.preventDefault();
  const form = e.target;
  const cfg = AmbConfig.data || { questions: [] };
  const questions = cfg.questions || [];
  const restore = busy($("apply-submit"), "Submitting…");
  try {
    const answers = {};
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i], name = `q_${i}`;
      if (q.type === "checkbox") answers[name] = $$(`input[name="${name}"]:checked`, form).map((el) => el.value);
      else if (q.type === "file") {
        const file = form.elements[name]?.files?.[0];
        if (file) {
          if (file.size > LIMITS.attachmentMB * 1024 * 1024) throw new Error(`“${q.label}”: files must be under ${LIMITS.attachmentMB} MB.`);
          answers[name] = await uploadFile(`ambassador/${state.user.uid}/${Date.now()}_${safeName(file.name)}`, file);
        } else answers[name] = "";
      } else answers[name] = form.elements[name]?.value?.trim() || "";
      if (q.required && (!answers[name] || (Array.isArray(answers[name]) && !answers[name].length))) throw new Error(`Please answer “${q.label}”.`);
    }
    const payload = { uid: state.user.uid, email: state.user.email, name: myName(), answers, questions: questions.map((q) => q.label), submittedAt: Date.now(), status: "new" };
    await Submissions.add(payload, state.user.uid);
    state.mySubmission = payload;
    renderAmbassador();
    toast("Submitted.", "ok");
  } catch (err) {
    toast(err.message || "Could not submit.", "error");
  } finally { restore(); }
}

export function renderSubmissions() {
  const box = $("submissions-list");
  if (!box || !state.isAdmin) return;
  const rows = Submissions.items;
  $("count-submissions").textContent = String(rows.length);
  if (!rows.length) { box.innerHTML = `<div class="empty"><h4>No applications yet.</h4></div>`; return; }
  box.innerHTML = rows.map((s) => {
    const pairs = s.questions?.length ? s.questions.map((label, i) => [label, (s.answers || {})[`q_${i}`]]) : Object.entries(s.answers || {});
    const st = s.status || "new";
    return `<div class="submission">
      <div class="sb-head">
        ${avatarHtml({ name: s.name, email: s.email }, "avatar avatar-sm")}
        <b>${esc(s.name || s.email || "…")}</b>
        <a class="small" href="mailto:${esc(s.email || "")}">${esc(s.email || "")}</a>
        <span class="when num">${esc(formatDate(s.submittedAt || s.createdAt))}</span>
        <label class="sb-status small">Status
          <select class="select" style="padding:4px 30px 4px 8px;width:auto" data-status-for="${esc(s.id)}">
            ${Object.entries(STATUS).map(([v, l]) => `<option value="${v}" ${v === st ? "selected" : ""}>${l}</option>`).join("")}
          </select>
        </label>
        <button type="button" class="btn btn-quiet btn-sm" data-del-sub="${esc(s.id)}">Delete</button>
      </div>
      ${pairs.map(([q, val]) => {
        const isUrl = typeof val === "string" && /^https?:\/\//i.test(val);
        const shown = Array.isArray(val) ? val.join(", ") : String(val || "—");
        return `<div class="sb-a"><p class="sb-q">${esc(q)}</p><p class="sb-v">${isUrl ? `<a href="${esc(val)}" target="_blank" rel="noopener">Open attachment</a>` : esc(shown)}</p></div>`;
      }).join("")}
    </div>`;
  }).join("");
}

function exportSubmissions() {
  const rows = Submissions.items;
  if (!rows.length) { toast("There's nothing to export yet.", "info"); return; }
  const labels = [...new Set(rows.flatMap((s) => s.questions || []))];
  const headers = ["Name", "Email", "Submitted", "Status", ...labels];
  const answerFor = (s, label) => { const i = (s.questions || []).indexOf(label); return i === -1 ? "" : (s.answers || {})[`q_${i}`] ?? ""; };
  const csv = [
    headers.map(csvCell).join(","),
    ...rows.map((s) => [s.name, s.email, formatDate(s.submittedAt || s.createdAt), STATUS[s.status] || s.status || "New", ...labels.map((l) => answerFor(s, l))].map(csvCell).join(",")),
  ].join("\n");
  downloadText(`hpair-ambassador-applications-${new Date().toISOString().slice(0, 10)}.csv`, `﻿${csv}`, "text/csv;charset=utf-8");
  toast(`Exported ${plural(rows.length, "application")}.`, "ok");
}
