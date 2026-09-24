/* Conferences tab: upcoming events, the photo library with its review queue,
   and the feedback form embed. */
import { state, Events, Photos, FormsConfig, isMe, myName } from "./state.js";
import { EVENT_TYPES, LIMITS } from "./config.js";
import {
  $, esc, safeUrl, safeImg, googleFormEmbedUrl, debounce, formatDateRange, todayLocal, plural,
  openModal, closeModal, toast, busy, confirmDialog,
} from "./util.js";
import { uploadFile, safeName } from "./uploads.js";

/* ══════════════════════════════════════════════════════════════════════════
   EVENTS
   ══════════════════════════════════════════════════════════════════════ */
let editingEvent = null;
let showPast = false;

const eventEnd = (ev) => ev.endDate || ev.startDate || "";
const isUpcoming = (ev) => eventEnd(ev) >= todayLocal();
export const upcomingCount = () => Events.items.filter(isUpcoming).length;

function initEvents() {
  $("ev-type").innerHTML = EVENT_TYPES.map((t) => `<option value="${esc(t)}">${esc(t)}</option>`).join("");
  $("add-event-btn").addEventListener("click", () => openEventModal());
  $("event-form").addEventListener("submit", saveEvent);
  $("events-list").addEventListener("click", async (e) => {
    const toggle = e.target.closest("[data-toggle-past]");
    if (toggle) { showPast = !showPast; renderEvents(); return; }
    const edit = e.target.closest("[data-edit-ev]");
    if (edit) { const ev = Events.items.find((x) => x.id === edit.dataset.editEv); if (ev) openEventModal(ev); return; }
    const del = e.target.closest("[data-del-ev]");
    if (del) {
      const ok = await confirmDialog("This removes the event for everyone.", { title: "Delete?", confirmLabel: "Delete" });
      if (!ok) return;
      try { await Events.remove(del.dataset.delEv); toast("Deleted.", "info"); }
      catch (err) { toast(err.message, "error"); }
    }
  });
}

function openEventModal(existing = null) {
  editingEvent = existing;
  $("event-title").textContent = existing ? "Edit event" : "Add an event";
  $("ev-submit").textContent = "Save";
  $("ev-id").value = existing?.id || "";
  $("ev-type").value = existing?.type || EVENT_TYPES[0];
  $("ev-title").value = existing?.title || "";
  $("ev-city").value = existing?.city || "";
  $("ev-country").value = existing?.country || "";
  $("ev-start").value = existing?.startDate || "";
  $("ev-end").value = existing?.endDate || "";
  $("ev-format").value = existing?.format || "In person";
  $("ev-link").value = existing?.link || "";
  $("ev-desc").value = existing?.description || "";
  openModal("event-modal");
}

async function saveEvent(e) {
  e.preventDefault();
  const title = $("ev-title").value.trim();
  const startDate = $("ev-start").value;
  if (!title || !startDate) { toast("Title and start date are required.", "error"); return; }
  const endDate = $("ev-end").value || "";
  if (endDate && endDate < startDate) { toast("The end date is before the start date.", "error"); return; }
  const link = $("ev-link").value.trim();
  if (link && !safeUrl(link)) { toast("The link must start with http:// or https://", "error"); return; }
  const restore = busy($("ev-submit"), "Saving…");
  try {
    const data = {
      type: $("ev-type").value, title: title.slice(0, 160),
      city: $("ev-city").value.trim(), country: $("ev-country").value.trim(),
      startDate, endDate, format: $("ev-format").value, link: safeUrl(link),
      description: $("ev-desc").value.trim().slice(0, 600),
    };
    if (editingEvent) { await Events.update(editingEvent.id, data); toast("Saved.", "ok"); }
    else { await Events.add({ ...data, createdBy: state.user.uid, createdByName: myName() }); toast("Added.", "ok"); }
    closeModal("event-modal");
    $("event-form").reset();
    editingEvent = null;
  } catch (err) {
    toast(err.message || "Could not save the event.", "error");
  } finally { restore(); }
}

export function renderEvents() {
  const box = $("events-list");
  if (!box) return;
  if (!Events.ready) { box.innerHTML = `<div class="skeleton" style="height:120px"></div>`; return; }

  const upcoming = Events.items.filter(isUpcoming).sort((a, b) => a.startDate.localeCompare(b.startDate));
  const past = Events.items.filter((ev) => !isUpcoming(ev)).sort((a, b) => b.startDate.localeCompare(a.startDate));

  const row = (ev, cls = "") => {
    const where = [ev.city, ev.country].filter(Boolean).join(", ");
    const link = safeUrl(ev.link);
    return `<tr class="${cls}">
      <td class="ev-date num">${esc(formatDateRange(ev.startDate, ev.endDate))}</td>
      <td><div class="ev-title">${esc(ev.title)}</div>${ev.description ? `<div class="ev-note">${esc(ev.description)}</div>` : ""}</td>
      <td>${esc(where || (ev.format === "Online" ? "Online" : ""))}</td>
      <td>${esc(ev.format || "")}</td>
      <td><div class="ev-tools">
        ${link ? `<a class="btn btn-outline btn-sm" href="${esc(link)}" target="_blank" rel="noopener">Details</a>` : ""}
        ${state.isAdmin ? `<button type="button" class="btn btn-quiet btn-sm" data-edit-ev="${esc(ev.id)}">Edit</button>
                           <button type="button" class="btn btn-quiet btn-sm" data-del-ev="${esc(ev.id)}">Delete</button>` : ""}
      </div></td>
    </tr>`;
  };

  if (!upcoming.length && !past.length) {
    box.innerHTML = `<div class="empty"><h4>No dates announced.</h4></div>`;
    return;
  }

  box.innerHTML = `
    <div class="events table-wrap">
      <table class="table">
        <thead><tr><th scope="col">Dates</th><th scope="col">Event</th><th scope="col">Where</th><th scope="col">Format</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead>
        <tbody>
          ${upcoming.length ? upcoming.map((ev) => row(ev)).join("") : `<tr><td colspan="5" class="muted">Nothing upcoming.</td></tr>`}
          ${showPast ? past.map((ev) => row(ev, "past")).join("") : ""}
        </tbody>
      </table>
    </div>
    ${past.length ? `<p class="small" style="margin-top:10px"><button type="button" class="btn-link" data-toggle-past>${showPast ? "Hide past events" : `Show ${plural(past.length, "past event")}`}</button></p>` : ""}`;
}

/* ══════════════════════════════════════════════════════════════════════════
   PHOTO LIBRARY
   ══════════════════════════════════════════════════════════════════════ */
const photoFilters = { q: "", year: "" };
const isPending = (p) => p.status === "pending";
const published = () => Photos.items.filter((p) => !isPending(p));
export const pendingCount = () => Photos.items.filter(isPending).length;

function initPhotos() {
  $("photo-search").addEventListener("input", debounce((e) => { photoFilters.q = e.target.value.trim().toLowerCase(); renderPhotos(); }));
  $("photo-filter-year").addEventListener("change", (e) => { photoFilters.year = e.target.value; renderPhotos(); });
  $("add-photo-btn").addEventListener("click", openPhotoModal);
  $("submit-photo-btn").addEventListener("click", openPhotoModal);
  $("photo-files").addEventListener("change", (e) => {
    const n = e.target.files?.length || 0;
    $("photo-file-name").textContent = n ? `${plural(n, "image")} selected` : "Choose one or more images";
  });
  $("photo-form").addEventListener("submit", submitPhotos);
  $("caption-form").addEventListener("submit", saveCaption);

  $("photo-grid").addEventListener("click", async (e) => {
    const edit = e.target.closest("[data-edit-caption]");
    if (edit) { openCaptionModal(edit.dataset.editCaption); return; }
    const del = e.target.closest("[data-del-photo]");
    if (!del) return;
    const ok = await confirmDialog("This removes the photograph for everyone.", { title: "Remove?", confirmLabel: "Remove" });
    if (!ok) return;
    try { await Photos.remove(del.dataset.delPhoto); toast("Removed.", "info"); }
    catch (err) { toast(err.message, "error"); }
  });
  $("photo-review").addEventListener("click", async (e) => {
    const ok = e.target.closest("[data-approve-photo]");
    if (ok) {
      try { await Photos.update(ok.dataset.approvePhoto, { status: "published" }); toast("Published.", "ok"); }
      catch (err) { toast(err.message, "error"); }
      return;
    }
    const no = e.target.closest("[data-reject-photo]");
    if (!no) return;
    const sure = await confirmDialog("This deletes the submission.", { title: "Decline?", confirmLabel: "Decline" });
    if (!sure) return;
    try { await Photos.remove(no.dataset.rejectPhoto); toast("Declined.", "info"); }
    catch (err) { toast(err.message, "error"); }
  });
}

function populatePhotoYears() {
  const sel = $("photo-filter-year");
  const years = [...new Set(published().map((p) => p.year).filter(Boolean))].sort((a, b) => b - a);
  const sig = years.join(",");
  if (sel.dataset.signature === sig) return;
  sel.dataset.signature = sig;
  sel.innerHTML = `<option value="">All years</option>` + years.map((y) => `<option value="${esc(y)}">${esc(y)}</option>`).join("");
  if (years.map(String).includes(photoFilters.year)) sel.value = photoFilters.year; else { sel.value = ""; photoFilters.year = ""; }
}

export function renderPhotos() {
  const box = $("photo-grid");
  if (!box) return;
  renderPhotoReview();
  if (!Photos.ready) {
    box.innerHTML = Array.from({ length: 6 }, () => `<div class="skeleton sk-photo"></div>`).join("");
    return;
  }
  populatePhotoYears();
  const live = published();
  let list = [...live];
  if (photoFilters.year) list = list.filter((p) => String(p.year) === String(photoFilters.year));
  if (photoFilters.q) list = list.filter((p) => [p.caption, p.city, p.year, p.uploaderName].filter(Boolean).join(" ").toLowerCase().includes(photoFilters.q));

  if (!list.length) {
    box.innerHTML = `<div class="empty" style="grid-column:1/-1"><h4>${live.length ? "No matches." : "No photographs yet."}</h4></div>`;
    return;
  }

  box.innerHTML = list.map((p) => {
    const src = safeImg(p.imageUrl) || (String(p.imageUrl || "").startsWith("data:image/") ? p.imageUrl : "");
    if (!src) return "";
    const meta = [p.city, p.year].filter(Boolean).join(", ");
    const tools = [
      state.isAdmin ? `<button type="button" class="btn btn-quiet btn-sm" data-del-photo="${esc(p.id)}">Remove</button>` : "",
      isMe(p.uploaderUid) ? `<button type="button" class="btn btn-quiet btn-sm" data-edit-caption="${esc(p.id)}">Caption</button>` : "",
    ].filter(Boolean).join("");
    return `<figure class="photo">
      <a href="${esc(src)}" target="_blank" rel="noopener" aria-label="Open the full-size photograph">
        <img src="${esc(src)}" alt="${esc(p.caption || `HPAIR conference photograph${meta ? `, ${meta}` : ""}`)}" loading="lazy">
      </a>
      ${tools ? `<div class="photo-tools">${tools}</div>` : ""}
      ${(p.caption || meta) ? `<figcaption>${p.caption ? `<b>${esc(p.caption)}</b>` : ""}${meta ? `<span>${esc(meta)}</span>` : ""}</figcaption>` : ""}
    </figure>`;
  }).join("");
}

function renderPhotoReview() {
  const box = $("photo-review");
  if (!box) return;
  const queue = Photos.items.filter(isPending);
  box.hidden = !state.isAdmin || !queue.length;
  if (box.hidden) { box.innerHTML = ""; return; }
  box.innerHTML = `
    <div class="review-head">
      <h3>${plural(queue.length, "photograph")} waiting for review</h3>
    </div>
    <div class="review-grid">${queue.map((p) => {
      const src = safeImg(p.imageUrl) || (String(p.imageUrl || "").startsWith("data:image/") ? p.imageUrl : "");
      if (!src) return "";
      const meta = [p.city, p.year].filter(Boolean).join(", ");
      return `<figure class="review-item">
        <img src="${esc(src)}" alt="${esc(p.caption || "Submitted photograph")}" loading="lazy">
        <figcaption>${p.caption ? `<b>${esc(p.caption)}</b>` : ""}${meta ? `${esc(meta)}<br>` : ""}From ${esc(p.uploaderName || p.uploaderEmail || "an alum")}</figcaption>
        <div class="review-actions">
          <button type="button" class="btn btn-primary btn-sm" data-approve-photo="${esc(p.id)}">Publish</button>
          <button type="button" class="btn btn-quiet btn-sm" data-reject-photo="${esc(p.id)}">Decline</button>
        </div>
      </figure>`;
    }).join("")}</div>`;
}

function openPhotoModal() {
  $("photo-form").reset();
  $("photo-file-name").textContent = "Choose one or more images";
  $("photo-modal-title").textContent = state.isAdmin ? "Add to the library" : "Submit photos";
  $("photo-modal-sub").textContent = state.isAdmin ? "" : "Reviewed before they appear.";
  $("photo-submit").textContent = state.isAdmin ? "Add to library" : "Send for review";
  openModal("photo-modal");
}

async function submitPhotos(e) {
  e.preventDefault();
  const files = [...($("photo-files").files || [])];
  if (!files.length) { toast("Choose at least one image.", "warn"); return; }
  const admin = state.isAdmin;
  const btn = $("photo-submit");
  const label = btn.textContent;
  btn.disabled = true;
  const shared = {
    caption: $("photo-caption").value.trim().slice(0, LIMITS.caption),
    city: $("photo-city").value.trim().slice(0, 80),
    year: Number($("photo-year").value) || null,
    uploaderUid: state.user.uid,
    uploaderName: myName(),
    uploaderEmail: state.user.email,
    status: admin ? "published" : "pending",
  };
  let done = 0, failed = 0;
  try {
    for (const file of files) {
      btn.innerHTML = `<span class="spinner"></span> Uploading ${done + failed + 1} of ${files.length}…`;
      if (!file.type.startsWith("image/") || file.size > LIMITS.attachmentMB * 1024 * 1024) { failed++; continue; }
      try {
        const path = admin ? `library/${Date.now()}_${safeName(file.name)}` : `photo_submissions/${state.user.uid}/${Date.now()}_${safeName(file.name)}`;
        const imageUrl = await uploadFile(path, file, { allowInline: true });
        await Photos.add({ ...shared, imageUrl });
        done++;
      } catch (err) { console.warn("[photos] upload failed:", err); failed++; }
    }
    if (done) toast(admin ? `${plural(done, "photograph")} added.` : `${plural(done, "photograph")} sent for review.`, "ok");
    if (failed) toast(`${plural(failed, "file")} could not be uploaded. Images must be under ${LIMITS.attachmentMB} MB.`, "warn");
    if (done) { closeModal("photo-modal"); $("photo-form").reset(); }
  } finally {
    btn.disabled = false;
    btn.textContent = label;
  }
}

function openCaptionModal(id) {
  const p = Photos.items.find((x) => x.id === id);
  if (!p) return;
  $("caption-photo-id").value = id;
  $("caption-text").value = p.caption || "";
  openModal("caption-modal");
}
async function saveCaption(e) {
  e.preventDefault();
  const restore = busy($("caption-submit"), "Saving…");
  try {
    await Photos.update($("caption-photo-id").value, { caption: $("caption-text").value.trim().slice(0, LIMITS.caption) });
    closeModal("caption-modal");
    toast("Caption saved.", "ok");
  } catch (err) { toast(err.message || "Could not save the caption.", "error"); }
  finally { restore(); }
}

/* ══════════════════════════════════════════════════════════════════════════
   FEEDBACK FORM
   ══════════════════════════════════════════════════════════════════════ */
function initFeedback() {
  $("edit-forms-btn").addEventListener("click", () => {
    $("cfg-feedback-url").value = FormsConfig.data?.feedbackUrl || "";
    openModal("forms-modal");
  });
  $("forms-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const restore = busy($("forms-submit"), "Saving…");
    try {
      await FormsConfig.write({ feedbackUrl: safeUrl($("cfg-feedback-url").value.trim()) });
      toast("Saved.", "ok");
      closeModal("forms-modal");
    } catch (err) { toast(err.message || "Could not save the link.", "error"); }
    finally { restore(); }
  });
}

export function renderFeedback(cfg) {
  const c = cfg || FormsConfig.data || {};
  const box = $("feedback-embed");
  if (!box) return;
  const embed = googleFormEmbedUrl(c.feedbackUrl);
  const plain = safeUrl(c.feedbackUrl);
  if (embed) {
    box.innerHTML = `<div class="form-embed"><iframe src="${esc(embed)}" title="Conference feedback form" loading="lazy">Loading the feedback form…</iframe></div>`;
  } else if (plain) {
    box.innerHTML = `<div class="empty"><a class="btn btn-primary" href="${esc(plain)}" target="_blank" rel="noopener">Open the form</a></div>`;
  } else {
    box.innerHTML = `<div class="empty"><h4>No form at the moment.</h4></div>`;
  }
}

export function initConferences() {
  initEvents();
  initPhotos();
  initFeedback();
}
