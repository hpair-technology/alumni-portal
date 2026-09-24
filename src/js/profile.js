/* Editing your own profile, including the square headshot crop. */
import Cropper from "cropperjs";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { updateProfile } from "firebase/auth";
import { db } from "./firebase.js";
import { state, emit, on } from "./state.js";
import { INDUSTRIES, shortIndustry, MENTORING, conferenceOptions, LIMITS } from "./config.js";
import { $, $$, esc, normaliseUrl, avatarHtml, openModal, closeModal, toast, busy } from "./util.js";
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
