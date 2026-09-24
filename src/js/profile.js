/* Editing your own profile, including the square headshot crop. */
import Cropper from "cropperjs";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { updateProfile } from "firebase/auth";
import { db } from "./firebase.js";
import { state, emit, on } from "./state.js";
import { INDUSTRIES, shortIndustry, MENTORING, conferenceOptions, LIMITS } from "./config.js";
import { $, $$, esc, normaliseUrl, safeUrl, avatarHtml, paragraphs, formatDate, toMillis, openModal, closeModal, toast, busy } from "./util.js";
import { uploadFile } from "./uploads.js";

let cropper = null;
let croppedBlob = null;
let chosenConferences = [];

function renderConferenceTags() {
  const box = $("conference-tags");
  box.innerHTML = chosenConferences.map((c, i) =>
    `<span class="tag tag-fill">${esc(c)} <button type="button" class="tag-x" data-remove-conf="${i}" aria-label="Remove ${esc(c)}">&times;</button></span>`).join("");
  const picker = $("conference-picker");
  const current = picker.value;
  picker.innerHTML = `<option value="">Choose a conference…</option>` +
    conferenceOptions().filter((o) => !chosenConferences.includes(o)).map((o) => `<option value="${esc(o)}">${esc(o)}</option>`).join("");
  if ([...picker.options].some((o) => o.value === current)) picker.value = current;
}

export function initProfile() {
  // Static option lists.
  $("profile-industries").innerHTML = INDUSTRIES.map((i) =>
    `<label class="check"><input type="checkbox" value="${esc(i)}"> ${esc(shortIndustry(i))}</label>`).join("");
  $("profile-mentoring").innerHTML = Object.entries(MENTORING).map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join("");

  $("profile-bio").addEventListener("input", (e) => { $("bio-count").textContent = String(e.target.value.length); });
  $("other-checkbox").addEventListener("change", (e) => {
    $("other-text").disabled = !e.target.checked;
    if (!e.target.checked) $("other-text").value = "";
    else $("other-text").focus();
  });

  $("conference-add").addEventListener("click", () => {
    const v = $("conference-picker").value;
    if (!v || chosenConferences.includes(v)) return;
    chosenConferences.push(v);
    renderConferenceTags();
  });
  $("conference-tags").addEventListener("click", (e) => {
    const b = e.target.closest("[data-remove-conf]");
    if (!b) return;
    chosenConferences.splice(Number(b.dataset.removeConf), 1);
    renderConferenceTags();
  });

  /* --- headshot crop --- */
  $("profile-headshot").addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast("Choose an image file.", "error"); e.target.value = ""; return; }
    if (file.size > LIMITS.headshotPickMB * 1024 * 1024) { toast(`Images must be under ${LIMITS.headshotPickMB} MB.`, "error"); e.target.value = ""; return; }
    const reader = new FileReader();
    reader.onload = () => {
      $("crop-image").src = reader.result;
      openModal("crop-modal");
      cropper?.destroy();
      cropper = new Cropper($("crop-image"), { aspectRatio: 1, viewMode: 1, autoCropArea: 1, background: false, guides: false });
      $("profile-headshot").value = "";
    };
    reader.readAsDataURL(file);
  });
  $("crop-save").addEventListener("click", () => {
    if (!cropper) return;
    cropper.getCroppedCanvas({ width: 600, height: 600, imageSmoothingQuality: "high" }).toBlob((blob) => {
      croppedBlob = blob;
      const el = $("profile-avatar-preview");
      el.classList.remove("avatar-initials");
      el.innerHTML = `<img src="${URL.createObjectURL(blob)}" alt="">`;
      closeModal("crop-modal");
      cropper.destroy(); cropper = null;
    }, "image/jpeg", 0.9);
  });
  const cancelCrop = () => {
    closeModal("crop-modal");
    cropper?.destroy(); cropper = null;
    croppedBlob = null;
  };
  $("crop-cancel").addEventListener("click", cancelCrop);
  $("crop-cancel-x").addEventListener("click", cancelCrop);

  $("profile-form").addEventListener("submit", saveProfile);
  on("profile:edit", openProfileModal);
}

export function openProfileModal() {
  const p = state.profile || {};
  $("profile-name").value = p.name || "";
  $("profile-year").value = p.gradYear || "";
  $("profile-role").value = p.title || "";
  $("profile-company").value = p.company || "";
  $("profile-location").value = p.location || "";
  $("profile-country").value = p.country || "";
  $("profile-linkedin").value = p.linkedin || "";
  $("profile-website").value = p.website || "";
  $("profile-bio").value = p.bio || "";
  $("bio-count").textContent = String((p.bio || "").length);
  $("profile-mentoring").value = p.mentoring || "";
  $("profile-show-email").checked = p.showEmail !== false;

  const chosen = p.industries || [];
  $$("#profile-industries input").forEach((cb) => { cb.checked = chosen.includes(cb.value); });
  const custom = chosen.find((i) => !INDUSTRIES.includes(i));
  $("other-checkbox").checked = Boolean(custom);
  $("other-text").disabled = !custom;
  $("other-text").value = custom || "";

  chosenConferences = [...(p.conferences || [])];
  renderConferenceTags();

  $("profile-avatar-preview").outerHTML = avatarHtml({ ...p, email: state.user.email }, "avatar avatar-lg", 'id="profile-avatar-preview"');
  croppedBlob = null;
  openModal("profile-modal");
}

async function saveProfile(e) {
  e.preventDefault();
  if (!state.user) return;
  const name = $("profile-name").value.trim();
  if (!name) { toast("Name is required.", "error"); $("profile-name").focus(); return; }
  const restore = busy($("profile-save"), "Saving…");
  try {
    const industries = $$("#profile-industries input:checked").map((cb) => cb.value);
    const other = $("other-text").value.trim();
    if ($("other-checkbox").checked && other) industries.push(other.slice(0, 60));

    const update = {
      name,
      gradYear: $("profile-year").value ? Number($("profile-year").value) : "",
      title: $("profile-role").value.trim(),          // job title; `role` is reserved for permissions
      company: $("profile-company").value.trim(),
      location: $("profile-location").value.trim(),
      country: $("profile-country").value.trim(),
      linkedin: normaliseUrl($("profile-linkedin").value),
      website: normaliseUrl($("profile-website").value),
      bio: $("profile-bio").value.trim().slice(0, LIMITS.bio),
      industries,
      conferences: [...chosenConferences],
      mentoring: $("profile-mentoring").value,
      showEmail: $("profile-show-email").checked,
      updatedAt: serverTimestamp(),
    };
    if (croppedBlob) {
      if (croppedBlob.size > LIMITS.headshotMB * 1024 * 1024) throw new Error(`Photo too large (max ${LIMITS.headshotMB} MB).`);
      update.headshotUrl = await uploadFile(`headshots/${state.user.uid}`, croppedBlob, { allowInline: true });
    }

    await setDoc(doc(db, "users", state.user.uid), update, { merge: true });
    state.profile = { ...state.profile, ...update, updatedAt: Date.now() };
    try { await updateProfile(state.user, { displayName: name }); } catch {}

    croppedBlob = null;
    closeModal("profile-modal");
    toast("Saved.", "ok");
    emit("profile:saved");
  } catch (err) {
    console.error(err);
    toast(err?.code === "permission-denied" ? "The database refused the change." : (err.message || "Could not save."), "error");
  } finally {
    restore();
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   YOUR PROFILE: what is missing, and the read-only view of your own entry
   ══════════════════════════════════════════════════════════════════════ */

/** The fields a directory entry needs to be useful, in the order they matter. */
export function missingFields(p = {}) {
  const out = [];
  if (!p.headshotUrl) out.push("a photograph");
  if (!p.title && !p.company) out.push("your current position");
  if (!p.gradYear) out.push("your class year");
  if (!(p.conferences || []).length) out.push("the conferences you attended");
  if (!p.bio) out.push("a short biography");
  return out;
}

/** "a photograph and your current position" / "a photograph, x and y" */
export function listPhrase(items) {
  if (items.length <= 1) return items[0] || "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** True when the entry is thin enough to be worth prompting about. */
export const isThin = (p = {}) => missingFields(p).length >= 2;

/**
 * How to ask for the rest of it. A brand-new entry is missing everything, and
 * reciting five items reads worse than naming the state.
 * Returns { text, action } or null when nothing is missing.
 */
export function missingPrompt(p = {}, { terse = false } = {}) {
  const missing = missingFields(p);
  if (!missing.length) return null;
  if (missing.length >= 4) {
    return { text: terse ? "Your entry is nearly empty." : "Your entry has little on it beyond your name.", action: "Fill it in" };
  }
  const list = listPhrase(missing);
  return {
    text: terse ? `Missing ${list}.` : `Your entry is missing ${list}.`,
    action: missing.length > 1 ? "Add them" : "Add it",
  };
}

export function renderMyProfile() {
  const box = $("my-profile");
  if (!box || !state.user) return;
  const p = { ...state.profile, email: state.user.email };
  const prompt = missingPrompt(p);

  $("count-profile").textContent = prompt ? "•" : "";

  const roleLine = [p.title, p.company].filter(Boolean).join(", ");
  const placeLine = [p.location, p.country].filter(Boolean).join(", ");
  const confs = [...(p.conferences || [])].sort((a, b) =>
    (Number((String(b).match(/(19|20)\d{2}/) || [])[0]) || 0) - (Number((String(a).match(/(19|20)\d{2}/) || [])[0]) || 0));

  const facts = [];
  if (confs.length) facts.push(["Conferences", confs.map(esc).join("<br>")]);
  facts.push(["Email", `${esc(p.email)}${p.showEmail === false ? ' <span class="muted">(hidden from other members)</span>' : ""}`]);
  const li = safeUrl(p.linkedin);
  if (li) facts.push(["LinkedIn", `<a href="${esc(li)}" target="_blank" rel="noopener">${esc(li.replace(/^https?:\/\/(www\.)?/, ""))}</a>`]);
  const web = safeUrl(p.website);
  if (web) facts.push(["Website", `<a href="${esc(web)}" target="_blank" rel="noopener">${esc(web.replace(/^https?:\/\/(www\.)?/, ""))}</a>`]);
  if (p.mentoring && MENTORING[p.mentoring]) facts.push(["Mentoring", esc(MENTORING[p.mentoring])]);
  if (toMillis(p.createdAt)) facts.push(["Member since", esc(formatDate(p.createdAt, { month: "long", year: "numeric" }))]);

  box.innerHTML = `
    ${prompt ? `<p class="missing-note">${esc(prompt.text)}
      <button type="button" class="btn-link" data-edit-profile>${esc(prompt.action)}</button></p>` : ""}
    <div class="my-profile-card">
      ${avatarHtml(p, "avatar avatar-xl")}
      <div class="my-profile-id">
        <h3>${esc(p.name || p.email.split("@")[0])}</h3>
        ${roleLine ? `<p class="lead">${esc(roleLine)}</p>` : ""}
        ${placeLine || p.gradYear ? `<p class="small muted">${[p.gradYear ? `Class of ${p.gradYear}` : "", placeLine].filter(Boolean).map(esc).join(" · ")}</p>` : ""}
        ${(p.industries || []).length ? `<div class="tags">${(p.industries || []).map((i) => `<span class="tag">${esc(shortIndustry(i))}</span>`).join("")}</div>` : ""}
      </div>
    </div>
    ${p.bio ? `<div class="my-profile-bio">${paragraphs(p.bio)}</div>` : ""}
    <dl class="ledger my-profile-facts">
      ${facts.map(([k, v]) => `<div class="ledger-row"><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join("")}
    </dl>`;
}
