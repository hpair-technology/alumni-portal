/* Opportunities: jobs, internships, fellowships, scholarships and HPAIR calls. */
import { state, Opportunities, isMe, myName } from "./state.js";
import { OPP_TYPES, oppLabel, LIMITS } from "./config.js";
import {
  $, esc, safeUrl, avatarHtml, debounce, paragraphs, timeAgo, todayLocal, formatIsoDate,
  openModal, closeModal, toast, busy, confirmDialog,
} from "./util.js";
import { uploadFile, safeName } from "./uploads.js";

const filters = { q: "", type: "", status: "open" };
let editing = null;

const isClosed = (o) => Boolean(o.deadline) && o.deadline < todayLocal();
export const openCount = () => Opportunities.items.filter((o) => !isClosed(o)).length;

export function initCareer() {
  $("opp-filter-type").innerHTML = `<option value="">All types</option>` + OPP_TYPES.map((t) => `<option value="${t}">${esc(oppLabel(t))}</option>`).join("");
  $("opp-type").innerHTML = OPP_TYPES.map((t) => `<option value="${t}">${esc(oppLabel(t))}</option>`).join("");

  $("opp-search").addEventListener("input", debounce((e) => { filters.q = e.target.value.trim().toLowerCase(); renderOpportunities(); }));
  $("opp-filter-type").addEventListener("change", (e) => { filters.type = e.target.value; renderOpportunities(); });
  $("opp-filter-status").addEventListener("change", (e) => { filters.status = e.target.value; renderOpportunities(); });
  $("post-opportunity-btn").addEventListener("click", () => openOppModal());
  $("opp-desc").addEventListener("input", (e) => { $("opp-desc-count").textContent = String(e.target.value.length); });
  $("opp-file").addEventListener("change", (e) => { $("opp-file-name").textContent = e.target.files?.[0]?.name || "Attach a PDF or image"; });
  $("opportunity-form").addEventListener("submit", saveOpportunity);

  $("opportunities-list").addEventListener("click", async (e) => {
    const edit = e.target.closest("[data-edit-opp]");
    if (edit) { const o = Opportunities.items.find((x) => x.id === edit.dataset.editOpp); if (o) openOppModal(o); return; }
    const del = e.target.closest("[data-del-opp]");
    if (del) {
      const ok = await confirmDialog("This removes the post for everyone.", { title: "Delete?", confirmLabel: "Delete" });
      if (!ok) return;
      try { await Opportunities.remove(del.dataset.delOpp); toast("Deleted.", "info"); }
      catch (err) { toast(err.message, "error"); }
    }
  });
}

function openOppModal(existing = null) {
  editing = existing;
  $("opportunity-title").textContent = existing ? "Edit opportunity" : "Post an opportunity";
  $("opp-submit").textContent = existing ? "Save" : "Post";
  $("opp-id").value = existing?.id || "";
  $("opp-title").value = existing?.title || "";
  $("opp-org").value = existing?.org || "";
  $("opp-type").value = existing?.type || "Job";
  $("opp-location").value = existing?.location || "";
  $("opp-deadline").value = existing?.deadline || "";
  $("opp-desc").value = existing?.description || "";
  $("opp-desc-count").textContent = String((existing?.description || "").length);
  $("opp-link").value = existing?.link || "";
  $("opp-file").value = "";
  $("opp-file-name").textContent = existing?.fileName || "Attach a PDF or image";
  openModal("opportunity-modal");
}

async function saveOpportunity(e) {
  e.preventDefault();
  const title = $("opp-title").value.trim();
  const org = $("opp-org").value.trim();
  if (!title || !org) { toast("Title and organisation are required.", "error"); return; }
  const link = $("opp-link").value.trim();
  if (link && !safeUrl(link)) { toast("The link must start with http:// or https://", "error"); return; }

  const restore = busy($("opp-submit"), "Saving…");
  try {
    const data = {
      title: title.slice(0, 160),
      org: org.slice(0, 160),
      type: $("opp-type").value,
      location: $("opp-location").value.trim(),
      deadline: $("opp-deadline").value || "",
      description: $("opp-desc").value.trim().slice(0, LIMITS.oppDescription),
      link: safeUrl(link),
    };
    const file = $("opp-file").files?.[0];
    if (file) {
      if (file.size > LIMITS.attachmentMB * 1024 * 1024) throw new Error(`Attachments must be under ${LIMITS.attachmentMB} MB.`);
      data.fileUrl = await uploadFile(`opportunities/${state.user.uid}/${Date.now()}_${safeName(file.name)}`, file, { allowInline: true });
      data.fileName = file.name;
    }
    if (editing) {
      await Opportunities.update(editing.id, data);
      toast("Saved.", "ok");
    } else {
      await Opportunities.add({
        ...data,
        posterUid: state.user.uid,
        posterEmail: state.user.email,
        posterName: myName(),
        posterPhoto: state.profile.headshotUrl || "",
      });
      toast("Posted.", "ok");
    }
    closeModal("opportunity-modal");
    $("opportunity-form").reset();
    editing = null;
  } catch (err) {
    toast(err.message || "Could not save.", "error");
  } finally {
    restore();
  }
}

export function renderOpportunities() {
  const box = $("opportunities-list");
  if (!box) return;
  if (!Opportunities.ready) {
    box.innerHTML = Array.from({ length: 3 }, () => `<div class="skeleton sk-row"></div>`).join("");
    return;
  }
  const open = openCount();
  $("count-career").textContent = open ? String(open) : "";

  let list = [...Opportunities.items];
  if (filters.status === "open") list = list.filter((o) => !isClosed(o));
  if (filters.status === "mine") list = list.filter((o) => isMe(o.posterUid));
  if (filters.type) list = list.filter((o) => o.type === filters.type);
  if (filters.q) list = list.filter((o) => [o.title, o.org, o.description, o.location, o.type].filter(Boolean).join(" ").toLowerCase().includes(filters.q));

  if (!list.length) {
    box.innerHTML = `<div class="empty">
      <h4>${Opportunities.items.length ? "No matches." : "No opportunities yet."}</h4>
      ${Opportunities.items.length ? "" : '<button type="button" class="btn btn-primary" id="empty-post-opp">Post one</button>'}
    </div>`;
    $("empty-post-opp")?.addEventListener("click", () => openOppModal());
    return;
  }

  box.innerHTML = list.map((o) => {
    const closed = isClosed(o);
    const mine = isMe(o.posterUid);
    const canManage = mine || state.isAdmin;
    const link = safeUrl(o.link);
    const fileUrl = safeUrl(o.fileUrl) || (String(o.fileUrl || "").startsWith("data:") ? o.fileUrl : "");
    const when = o.deadline
      ? `${closed ? "Closed" : "Closes"}<b class="num">${esc(formatIsoDate(o.deadline, { day: "numeric", month: "long", year: "numeric" }))}</b>`
      : `<b>No closing date</b>`;
    return `
    <article class="opp${closed ? " closed" : ""}">
      <div class="opp-aside">
        <span class="tag${o.type === "HPAIR" ? " tag-crimson" : ""}">${esc(oppLabel(o.type))}</span>
        <span class="opp-when">${when}</span>
        ${o.location ? `<span class="small muted">${esc(o.location)}</span>` : ""}
      </div>
      <div class="opp-main">
        <h3 class="opp-title">${esc(o.title)}</h3>
        <p class="opp-org">${esc(o.org)}</p>
        ${o.description ? `<div class="opp-desc">${paragraphs(o.description)}</div>` : ""}
        <div class="opp-foot">
          <span class="opp-by">${avatarHtml({ name: o.posterName, email: o.posterEmail, headshotUrl: o.posterPhoto }, "avatar avatar-sm")}
            <span>Posted by ${esc(mine ? "you" : (o.posterName || o.posterEmail || "an alum"))}, ${esc(timeAgo(o.createdAt))}</span></span>
          ${fileUrl ? `<a class="tag" href="${esc(fileUrl)}" target="_blank" rel="noopener">Attachment: ${esc(o.fileName || "file")}</a>` : ""}
          <span class="opp-actions">
            ${canManage ? `<button type="button" class="btn btn-quiet btn-sm" data-edit-opp="${esc(o.id)}">Edit</button>
                           <button type="button" class="btn btn-quiet btn-sm" data-del-opp="${esc(o.id)}">Delete</button>` : ""}
            ${link ? `<a class="btn btn-outline btn-sm" href="${esc(link)}" target="_blank" rel="noopener">Apply</a>` : ""}
          </span>
        </div>
      </div>
    </article>`;
  }).join("");
}
