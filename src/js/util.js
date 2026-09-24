/* ============================================================================
   Small DOM and formatting helpers shared by both pages
   ========================================================================== */

export const $  = (id) => document.getElementById(id);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Only navigable schemes; blocks javascript: and friends. */
export function safeUrl(u) {
  const s = String(u ?? "").trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s) || /^mailto:/i.test(s) || /^tel:/i.test(s)) return s;
  return "";
}
/** Accepts a bare domain and normalises it to https://. */
export function normaliseUrl(u) {
  const s = String(u ?? "").trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(s)) return `https://${s}`;
  return "";
}
export function safeImg(u) {
  const s = String(u ?? "").trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s) || /^data:image\//i.test(s) || /^blob:/i.test(s)) return s;
  return "";
}

/** Only Google Forms are ever framed; anything else is offered as a link. */
export function googleFormEmbedUrl(raw) {
  const s = safeUrl(raw);
  if (!s) return "";
  try {
    const url = new URL(s);
    if (url.protocol !== "https:" || url.hostname !== "docs.google.com" || !url.pathname.startsWith("/forms/")) return "";
    url.searchParams.set("embedded", "true");
    return url.toString();
  } catch { return ""; }
}

export function toMillis(ts) {
  if (!ts) return 0;
  if (typeof ts === "number") return ts;
  if (typeof ts.toMillis === "function") return ts.toMillis();
  if (typeof ts.toDate === "function") return ts.toDate().getTime();
  const p = Date.parse(ts);
  return Number.isNaN(p) ? 0 : p;
}
export function formatDate(ts, opts = { year: "numeric", month: "long", day: "numeric" }) {
  const ms = toMillis(ts);
  if (!ms) return "";
  return new Date(ms).toLocaleDateString("en-US", opts);
}
/** ISO date string -> "14 October 2026", in local time. */
export function formatIsoDate(iso, opts = { year: "numeric", month: "long", day: "numeric" }) {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", opts);
}
/** "12–15 February 2027" or "28 August – 2 September 2026". */
export function formatDateRange(startIso, endIso) {
  const s = startIso ? new Date(`${startIso}T00:00:00`) : null;
  const e = endIso ? new Date(`${endIso}T00:00:00`) : null;
  if (!s || Number.isNaN(s.getTime())) return "";
  const day = (d) => d.getDate();
  const mon = (d) => d.toLocaleDateString("en-US", { month: "long" });
  if (!e || Number.isNaN(e.getTime()) || e.getTime() === s.getTime()) return `${day(s)} ${mon(s)} ${s.getFullYear()}`;
  if (s.getFullYear() !== e.getFullYear()) return `${day(s)} ${mon(s)} ${s.getFullYear()} – ${day(e)} ${mon(e)} ${e.getFullYear()}`;
  if (s.getMonth() !== e.getMonth()) return `${day(s)} ${mon(s)} – ${day(e)} ${mon(e)} ${s.getFullYear()}`;
  return `${day(s)}–${day(e)} ${mon(s)} ${s.getFullYear()}`;
}
export function timeAgo(ts) {
  const ms = toMillis(ts);
  if (!ms) return "";
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60); if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60); if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24); if (d < 7) return d === 1 ? "yesterday" : `${d} days ago`;
  return formatDate(ms, { month: "short", day: "numeric", year: "numeric" });
}
/** Today as YYYY-MM-DD in local time (toISOString would use UTC). */
export function todayLocal() {
  const t = new Date(), p = (n) => String(n).padStart(2, "0");
  return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`;
}
export function debounce(fn, ms = 200) {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}
export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function initials(name, email) {
  const src = String(name || "").trim() || String(email || "").split("@")[0] || "?";
  const parts = src.split(/[\s._-]+/).filter(Boolean);
  const a = parts[0]?.[0] || "?";
  const b = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (a + b).toUpperCase();
}
/** Avatar markup: the photo if there is one, otherwise typeset initials. */
export function avatarHtml(user, cls = "avatar", extra = "") {
  const url = safeImg(user?.headshotUrl);
  if (url) return `<span class="${cls}" ${extra}><img src="${esc(url)}" alt="" loading="lazy"></span>`;
  return `<span class="${cls} avatar-initials" ${extra}>${esc(initials(user?.name || user?.authorName, user?.email))}</span>`;
}
export function firstName(name) {
  return String(name || "").trim().split(/\s+/)[0] || "";
}

/** Escape first, then turn bare URLs into links. */
export function linkify(text) {
  const out = [];
  const src = String(text ?? "");
  const re = /https?:\/\/[^\s<>"']+/g;
  let last = 0, m;
  while ((m = re.exec(src))) {
    out.push(esc(src.slice(last, m.index)));
    const url = m[0].replace(/[.,;:!?)]+$/, "");
    out.push(`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(url)}</a>`);
    last = m.index + url.length;
  }
  out.push(esc(src.slice(last)));
  return out.join("");
}
/** Plain text with blank-line paragraphs -> <p> elements, escaped and linkified. */
export function paragraphs(text) {
  return String(text ?? "").trim().split(/\n{2,}/).filter(Boolean)
    .map((p) => `<p>${linkify(p).replace(/\n/g, "<br>")}</p>`).join("");
}

export function fileToDataUrl(blob) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.onerror = rej;
    fr.readAsDataURL(blob);
  });
}

/* ─── Toasts ───────────────────────────────────────────────────────────── */
export function toast(message, kind = "ok", title = "") {
  const stack = $("toast-stack");
  if (!stack) return;
  const el = document.createElement("div");
  el.className = `toast toast-${kind}`;
  el.setAttribute("role", kind === "error" ? "alert" : "status");
  el.innerHTML = `
    <span class="toast-body">${title ? `<b>${esc(title)}</b> ` : ""}${esc(message)}</span>
    <button class="toast-close" type="button" aria-label="Dismiss">&times;</button>`;
  const kill = () => { el.classList.add("leaving"); setTimeout(() => el.remove(), 220); };
  el.querySelector(".toast-close").addEventListener("click", kill);
  stack.appendChild(el);
  setTimeout(kill, kind === "error" ? 7000 : 4200);
  const live = $("live-region");
  if (live) live.textContent = message;
}

/* ─── Modals ───────────────────────────────────────────────────────────── */
const modalStack = [];
let confirmResolve = null;

export function openModal(id) {
  const el = $(id);
  if (!el || !el.hidden) return;
  el.dataset.returnFocus = document.activeElement?.id || "";
  el.hidden = false;
  modalStack.push(id);
  document.body.classList.add("modal-open");
  const focusable = el.querySelector("input:not([type=hidden]):not([disabled]), textarea, select, button:not(.modal-close)");
  setTimeout(() => focusable?.focus(), 40);
}
export function closeModal(id) {
  const el = $(id);
  if (!el || el.hidden) return;
  el.hidden = true;
  if (id === "confirm-modal" && confirmResolve) { const r = confirmResolve; confirmResolve = null; r(false); }
  const i = modalStack.lastIndexOf(id);
  if (i >= 0) modalStack.splice(i, 1);
  if (!modalStack.length) document.body.classList.remove("modal-open");
  const back = el.dataset.returnFocus && $(el.dataset.returnFocus);
  if (back) back.focus();
}
export function closeTopModal() {
  if (modalStack.length) closeModal(modalStack[modalStack.length - 1]);
}
export function wireModals() {
  document.addEventListener("click", (e) => {
    const closer = e.target.closest("[data-close]");
    if (closer) {
      const m = closer.closest(".modal");
      if (m) { closeModal(m.id); return; }
    }
    if (e.target.classList?.contains("modal")) closeModal(e.target.id);
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeTopModal(); });
}

/** Promise-based replacement for window.confirm(). */
export function confirmDialog(text, { title = "Are you sure?", confirmLabel = "Confirm", danger = true } = {}) {
  return new Promise((resolve) => {
    $("confirm-title").textContent = title;
    $("confirm-text").textContent = text;
    const yesBtn = $("confirm-yes");
    yesBtn.textContent = confirmLabel;
    yesBtn.classList.toggle("btn-danger", danger);
    yesBtn.classList.toggle("btn-primary", !danger);
    const finish = (v) => {
      yesBtn.removeEventListener("click", yes);
      $("confirm-no").removeEventListener("click", no);
      resolve(v);
    };
    confirmResolve = finish;
    const answer = (v) => { confirmResolve = null; closeModal("confirm-modal"); finish(v); };
    const yes = () => answer(true);
    const no  = () => answer(false);
    yesBtn.addEventListener("click", yes);
    $("confirm-no").addEventListener("click", no);
    openModal("confirm-modal");
  });
}

/** Swap a button into a busy state and back. Returns a restore function. */
export function busy(btn, label) {
  if (!btn) return () => {};
  const prev = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner" aria-hidden="true"></span> ${esc(label)}`;
  return () => { btn.disabled = false; btn.innerHTML = prev; };
}

/** CSV cell: RFC 4180 quoting plus a guard against spreadsheet formula injection. */
export function csvCell(v) {
  let s = String(Array.isArray(v) ? v.join("; ") : (v ?? ""));
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}
export function downloadText(filename, text, type = "text/plain;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
