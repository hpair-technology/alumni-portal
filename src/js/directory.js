/* Alumni directory: filters, the list, and the profile drawer. */
import { state, Users, isMe, on, emit } from "./state.js";
import { INDUSTRIES, shortIndustry, MENTORING } from "./config.js";
import {
  $, $$, esc, safeUrl, avatarHtml, debounce, paragraphs, toMillis, formatDate, plural,
} from "./util.js";

const filters = { q: "", year: "", industry: "", conference: "", mentoring: "", sort: "name" };
const signatures = { year: "", industry: "", conference: "" };

const conferenceYear = (label) => Number((String(label).match(/\b(19|20)\d{2}\b/) || [])[0]) || 0;
const roleLine = (u) => [u.title, u.company].filter(Boolean).join(", ");
const placeLine = (u) => [u.location, u.country].filter(Boolean).join(", ");
const wantsMentor = (u) => u.mentoring === "mentor" || u.mentoring === "both";
const wantsMentee = (u) => u.mentoring === "mentee" || u.mentoring === "both";

export function initDirectory() {
  $("search-name").addEventListener("input", debounce((e) => { filters.q = e.target.value.trim().toLowerCase(); renderDirectory(); }));
  $("search-year").addEventListener("change", (e) => { filters.year = e.target.value; renderDirectory(); });
  $("search-industry").addEventListener("change", (e) => { filters.industry = e.target.value; renderDirectory(); });
  $("search-conference").addEventListener("change", (e) => { filters.conference = e.target.value; renderDirectory(); });
  $("search-mentoring").addEventListener("change", (e) => { filters.mentoring = e.target.value; renderDirectory(); });
  $("sort-by").addEventListener("change", (e) => { filters.sort = e.target.value; renderDirectory(); });
  $("clear-filters").addEventListener("click", () => {
    Object.assign(filters, { q: "", year: "", industry: "", conference: "", mentoring: "" });
    ["search-name", "search-year", "search-industry", "search-conference", "search-mentoring"].forEach((id) => { $(id).value = ""; });
    renderDirectory();
    $("search-name").focus();
  });

  const list = $("directory-list");
  list.addEventListener("click", (e) => {
    const row = e.target.closest(".person");
    if (row) openPerson(row.dataset.uid);
  });
  list.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const row = e.target.closest(".person");
    if (row) { e.preventDefault(); openPerson(row.dataset.uid); }
  });

  const drawer = $("person-drawer");
  drawer.addEventListener("click", (e) => {
    if (e.target === drawer || e.target.closest("[data-drawer-close]")) closePerson();
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !drawer.hidden) closePerson(); });

  on("presence:changed", () => { if (Users.ready) renderDirectory(); });
}

/** Rebuild a <select> only when its option set changes, keeping the selection. */
function fillSelect(id, key, values, label) {
  const sel = $(id);
  const sig = values.join("|");
  if (signatures[key] === sig) return;
  signatures[key] = sig;
  const current = sel.value;
  sel.innerHTML = `<option value="">${esc(label)}</option>` + values.map((v) => `<option value="${esc(v.value ?? v)}">${esc(v.label ?? v)}</option>`).join("");
  sel.value = values.some((v) => (v.value ?? v) === current) ? current : "";
}

function populateFilters() {
  const years = [...new Set(Users.items.map((u) => Number(u.gradYear)).filter(Boolean))].sort((a, b) => b - a).map(String);
  fillSelect("search-year", "year", years, "Any class year");

  const inds = new Set(INDUSTRIES);
  Users.items.forEach((u) => (u.industries || []).forEach((i) => inds.add(i)));
  fillSelect("search-industry", "industry", [...inds].sort().map((i) => ({ value: i, label: shortIndustry(i) })), "Any industry");

  const confs = new Set();
  Users.items.forEach((u) => (u.conferences || []).forEach((c) => confs.add(c)));
  fillSelect("search-conference", "conference", [...confs].sort((a, b) => conferenceYear(b) - conferenceYear(a) || a.localeCompare(b)), "Any conference");
}

export function renderDirectory() {
  const box = $("directory-list");
  if (!box) return;

  if (!Users.ready) {
    box.innerHTML = Array.from({ length: 6 }, () => `<div class="skeleton sk-person"></div>`).join("");
    return;
  }
  populateFilters();

  let list = Users.items.filter((u) => u.email);
  const total = list.length;
  if (filters.q) {
    list = list.filter((u) => [u.name, u.title, u.company, u.location, u.country, u.email]
      .filter(Boolean).join(" ").toLowerCase().includes(filters.q));
  }
  if (filters.year) list = list.filter((u) => String(u.gradYear || "") === filters.year);
  if (filters.industry) list = list.filter((u) => (u.industries || []).includes(filters.industry));
  if (filters.conference) list = list.filter((u) => (u.conferences || []).includes(filters.conference));
  if (filters.mentoring === "mentor") list = list.filter(wantsMentor);
  if (filters.mentoring === "mentee") list = list.filter(wantsMentee);

  const online = state.onlineUids;
  const byName = (a, b) => String(a.name || a.email).localeCompare(String(b.name || b.email), undefined, { sensitivity: "base" });
  list.sort((a, b) => {
    switch (filters.sort) {
      case "recent": return toMillis(b.createdAt) - toMillis(a.createdAt) || byName(a, b);
      case "year":   return (Number(b.gradYear) || 0) - (Number(a.gradYear) || 0) || byName(a, b);
      case "online": return ((online.has(b.id) ? 1 : 0) - (online.has(a.id) ? 1 : 0)) || byName(a, b);
      default:       return byName(a, b);
    }
  });

  const active = Boolean(filters.q || filters.year || filters.industry || filters.conference || filters.mentoring);
  $("clear-filters").hidden = !active;
  $("directory-count").textContent = total
    ? (active ? `${list.length} of ${plural(total, "alum", "alumni")}` : plural(total, "alum", "alumni"))
    : "";

  if (!list.length) {
    box.innerHTML = `<div class="empty"><h4>${active ? "No matches." : "No one has registered yet."}</h4></div>`;
    return;
  }

  box.innerHTML = list.map((u) => {
    const me = isMe(u.id);
    const line1 = [roleLine(u), placeLine(u)].filter(Boolean);
    const confs = [...(u.conferences || [])].sort((a, b) => conferenceYear(b) - conferenceYear(a));
    const inds = (u.industries || []).slice(0, 2).map(shortIndustry);
    const line2 = confs.length
      ? confs[0] + (confs.length > 1 ? ` and ${plural(confs.length - 1, "other")}` : "")
      : inds.join(", ");
    return `
    <article class="person" role="listitem" tabindex="0" data-uid="${esc(u.id)}" aria-label="Open ${esc(u.name || u.email)}">
      ${avatarHtml(u)}
      <div class="person-main">
        <span class="person-name">${esc(u.name || u.email.split("@")[0])}${me ? '<span class="you">you</span>' : ""}</span>
        ${line1.length ? `<span class="person-line">${line1.map(esc).join('<span class="sep">·</span>')}</span>` : ""}
        ${line2 ? `<span class="person-line muted">${esc(line2)}</span>` : ""}
      </div>
      <div class="person-side">
        ${u.gradYear ? `<span class="tag num">Class of ${esc(String(u.gradYear))}</span>` : ""}
        ${online.has(u.id) ? `<span class="online"><span class="dot" aria-hidden="true"></span>Online</span>`
          : (wantsMentor(u) ? `<span class="small muted">Open to mentoring</span>` : "")}
      </div>
    </article>`;
  }).join("");
}

/* ─── Drawer ───────────────────────────────────────────────────────────── */
let returnFocus = null;

export function openPerson(uid) {
  const u = Users.items.find((x) => x.id === uid);
  if (!u) return;
  const me = isMe(u.id);

  $("detail-avatar").outerHTML = avatarHtml(u, "avatar avatar-xl", 'id="detail-avatar"');
  $("detail-eyebrow").textContent = [u.gradYear ? `Class of ${u.gradYear}` : "", placeLine(u)].filter(Boolean).join(" · ");
  $("detail-name").textContent = u.name || u.email.split("@")[0];
  const role = roleLine(u);
  $("detail-role").textContent = role;
  $("detail-role").hidden = !role;

  const tags = [];
  (u.industries || []).forEach((i) => tags.push(`<span class="tag">${esc(shortIndustry(i))}</span>`));
  if (u.mentoring && MENTORING[u.mentoring]) tags.push(`<span class="tag tag-brass">${esc(MENTORING[u.mentoring])}</span>`);
  if (state.onlineUids.has(u.id)) tags.push(`<span class="tag tag-ok"><span class="dot" aria-hidden="true"></span>Online now</span>`);
  $("detail-meta").innerHTML = tags.join("");
  $("detail-meta").hidden = !tags.length;

  $("detail-bio").innerHTML = u.bio ? paragraphs(u.bio) : "";
  $("detail-bio").hidden = !u.bio;

  const showEmail = me || u.showEmail !== false;
  const facts = [];
  const confs = [...(u.conferences || [])].sort((a, b) => conferenceYear(b) - conferenceYear(a));
  if (confs.length) facts.push(["Conferences", confs.map(esc).join("<br>")]);
  if (showEmail && u.email) facts.push(["Email", `<a href="mailto:${esc(u.email)}">${esc(u.email)}</a>`]);
  const li = safeUrl(u.linkedin);
  if (li) facts.push(["LinkedIn", `<a href="${esc(li)}" target="_blank" rel="noopener">${esc(li.replace(/^https?:\/\/(www\.)?/, ""))}</a>`]);
  const web = safeUrl(u.website);
  if (web) facts.push(["Website", `<a href="${esc(web)}" target="_blank" rel="noopener">${esc(web.replace(/^https?:\/\/(www\.)?/, ""))}</a>`]);
  if (toMillis(u.createdAt)) facts.push(["Joined", esc(formatDate(u.createdAt, { month: "long", year: "numeric" }))]);
  $("detail-facts").innerHTML = facts.map(([k, v]) => `<div class="ledger-row"><dt>${k}</dt><dd>${v}</dd></div>`).join("");
  $("detail-facts").hidden = !facts.length;

  const actions = [];
  if (showEmail && u.email && !me) actions.push(`<a class="btn btn-primary" href="mailto:${esc(u.email)}">Email</a>`);
  if (li) actions.push(`<a class="btn btn-outline" href="${esc(li)}" target="_blank" rel="noopener">LinkedIn</a>`);
  if (me) actions.push(`<button type="button" class="btn btn-outline" id="detail-edit-me">Edit</button>`);
  $("detail-actions").innerHTML = actions.join("");
  $("detail-edit-me")?.addEventListener("click", () => { closePerson(); emit("profile:edit"); });

  const drawer = $("person-drawer");
  if (drawer.hidden) {
    returnFocus = document.activeElement;
    drawer.hidden = false;
    document.body.classList.add("modal-open");
  }
  setTimeout(() => drawer.querySelector(".drawer-close")?.focus(), 30);
}

export function closePerson() {
  const drawer = $("person-drawer");
  if (drawer.hidden) return;
  drawer.hidden = true;
  document.body.classList.remove("modal-open");
  if (returnFocus && document.contains(returnFocus)) returnFocus.focus();
  returnFocus = null;
}
