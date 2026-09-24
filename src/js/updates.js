/* Updates from the board (the `milestones` collection): admin-authored posts. */
import { state, Milestones, myName } from "./state.js";
import { LIMITS } from "./config.js";
import { $, esc, safeImg, paragraphs, formatDate, toMillis, openModal, closeModal, toast, busy, confirmDialog } from "./util.js";
import { uploadFile, safeName } from "./uploads.js";

let editing = null;

export function initUpdates() {
  $("post-milestone-btn").addEventListener("click", () => openMsModal());
  $("ms-content").addEventListener("input", (e) => { $("ms-count").textContent = String(e.target.value.length); });
  $("ms-file").addEventListener("change", (e) => { $("ms-file-name").textContent = e.target.files?.[0]?.name || "Upload an image"; });
  $("ms-image-remove").addEventListener("click", () => setImagePreview(""));
  $("milestone-form").addEventListener("submit", saveMilestone);

  $("milestones-list").addEventListener("click", async (e) => {
    const edit = e.target.closest("[data-edit-ms]");
    if (edit) { const m = Milestones.items.find((x) => x.id === edit.dataset.editMs); if (m) openMsModal(m); return; }
    const del = e.target.closest("[data-del-ms]");
    if (del) {
      const ok = await confirmDialog("This removes the update for everyone.", { title: "Delete?", confirmLabel: "Delete" });
      if (!ok) return;
      try { await Milestones.remove(del.dataset.delMs); toast("Deleted.", "info"); }
      catch (err) { toast(err.message, "error"); }
    }
  });
}

function setImagePreview(url) {
  $("ms-image-current").value = url || "";
  const shown = url && (String(url).startsWith("data:") ? url : safeImg(url));
  $("ms-image-preview").hidden = !shown;
  if (shown) $("ms-image-thumb").src = shown; else $("ms-image-thumb").removeAttribute("src");
}

function openMsModal(existing = null) {
  editing = existing;
  $("milestone-title").textContent = existing ? "Edit update" : "Post an update";
  $("ms-submit").textContent = existing ? "Save" : "Publish";
  $("ms-id").value = existing?.id || "";
  $("ms-title").value = existing?.title || "";
  $("ms-content").value = existing?.content || "";
  $("ms-count").textContent = String((existing?.content || "").length);
  $("ms-file").value = "";
  $("ms-file-name").textContent = "Upload an image";
  setImagePreview(existing?.imageUrl || "");
  openModal("milestone-modal");
}

async function saveMilestone(e) {
  e.preventDefault();
  const title = $("ms-title").value.trim();
  const content = $("ms-content").value.trim();
  if (!title || !content) { toast("Title and text are required.", "error"); return; }
  const restore = busy($("ms-submit"), "Publishing…");
  try {
    const data = { title: title.slice(0, 160), content: content.slice(0, LIMITS.milestone), imageUrl: $("ms-image-current").value };
    const file = $("ms-file").files?.[0];
    if (file) {
      if (file.size > LIMITS.attachmentMB * 1024 * 1024) throw new Error(`Images must be under ${LIMITS.attachmentMB} MB.`);
      data.imageUrl = await uploadFile(`milestones/${Date.now()}_${safeName(file.name)}`, file, { allowInline: true });
    }
    if (editing) {
      await Milestones.update(editing.id, data);
      toast("Saved.", "ok");
    } else {
      await Milestones.add({ ...data, authorUid: state.user.uid, authorName: myName() });
      toast("Published.", "ok");
    }
    closeModal("milestone-modal");
    $("milestone-form").reset();
    editing = null;
  } catch (err) {
    toast(err.message || "Could not publish.", "error");
  } finally {
    restore();
  }
}

export function renderMilestones() {
  const box = $("milestones-list");
  if (!box) return;
  if (!Milestones.ready) {
    box.innerHTML = `<div class="skeleton" style="height:220px"></div>`;
    return;
  }
  $("count-updates").textContent = Milestones.items.length ? String(Milestones.items.length) : "";

  if (!Milestones.items.length) {
    box.innerHTML = `<div class="empty">
      <h4>No updates yet.</h4>
      ${state.isAdmin ? '<button type="button" class="btn btn-primary" id="empty-post-ms">Post one</button>' : ""}
    </div>`;
    $("empty-post-ms")?.addEventListener("click", () => openMsModal());
    return;
  }

  box.innerHTML = Milestones.items.map((m) => {
    const img = safeImg(m.imageUrl);
    const ms = toMillis(m.createdAt);
    return `
    <article class="update">
      <div class="update-when">
        <time datetime="${ms ? new Date(ms).toISOString().slice(0, 10) : ""}">${esc(formatDate(m.createdAt, { day: "numeric", month: "long", year: "numeric" }))}</time>
        ${m.authorName ? `<span>${esc(m.authorName)}</span>` : ""}
      </div>
      <div class="update-body">
        ${img ? `<figure class="update-img"><img src="${esc(img)}" alt="" loading="lazy"></figure>` : ""}
        <h3>${esc(m.title)}</h3>
        <div class="update-text">${paragraphs(m.content)}</div>
        ${state.isAdmin ? `<div class="update-tools">
          <button type="button" class="btn btn-quiet btn-sm" data-edit-ms="${esc(m.id)}">Edit</button>
          <button type="button" class="btn btn-quiet btn-sm" data-del-ms="${esc(m.id)}">Delete</button>
        </div>` : ""}
      </div>
    </article>`;
  }).join("");
}
