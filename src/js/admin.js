/* Administration: overview figures and member roles. */
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "./firebase.js";
import { state, Users, Submissions } from "./state.js";
import { ADMIN_EMAILS } from "./config.js";
import { $, esc, toast, confirmDialog } from "./util.js";
import { openCount } from "./career.js";
import { pendingCount, upcomingCount } from "./conferences.js";

export function initAdmin() {
  $("members-list").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-role-uid]");
    if (!b) return;
    const uid = b.dataset.roleUid;
    const makeAdmin = b.dataset.role === "admin";
    const u = Users.items.find((x) => x.id === uid);
    const who = u?.name || u?.email || "this member";
    const ok = await confirmDialog(makeAdmin
      ? `${who} will be able to post, publish, review applications and change roles.`
      : `${who} will no longer be an administrator.`,
      { title: makeAdmin ? "Make administrator?" : "Remove administrator role?", confirmLabel: makeAdmin ? "Promote" : "Remove", danger: !makeAdmin });
    if (!ok) return;
    try {
      await updateDoc(doc(db, "users", uid), { role: makeAdmin ? "admin" : "", updatedAt: serverTimestamp() });
      toast(makeAdmin ? `${who} is now an administrator.` : `${who} is no longer an administrator.`, "ok");
    } catch (err) { toast(err?.code === "permission-denied" ? "The database refused the change." : err.message, "error"); }
  });
}

export function renderAdmin() {
  if (!state.isAdmin) return;
  renderOverview();
  renderMembers();
}

function renderOverview() {
  const box = $("admin-overview");
  if (!box) return;
  const newApps = Submissions.items.filter((s) => (s.status || "new") === "new").length;
  const rows = [
    ["Registered alumni", Users.items.length, "accounts"],
    ["Online now", state.onlineUids.size, "in the last five minutes"],
    ["Opportunities", openCount(), "open"],
    ["Events", upcomingCount(), "upcoming"],
    ["Photographs", pendingCount(), "waiting for review"],
    ["Ambassador applications", Submissions.items.length, newApps ? `${newApps} not yet reviewed` : "all reviewed"],
  ];
  box.innerHTML = rows.map(([k, n, note]) => `<div class="ledger-row"><dt>${esc(k)}</dt><dd><b>${esc(String(n))}</b><span class="muted">${esc(note)}</span></dd></div>`).join("");
}

function renderMembers() {
  const box = $("members-list");
  if (!box) return;
  if (!Users.ready) { box.innerHTML = `<div class="skeleton" style="height:96px"></div>`; return; }
  const rows = [...Users.items].sort((a, b) => String(a.name || a.email).localeCompare(String(b.name || b.email)));
  if (!rows.length) { box.innerHTML = `<div class="empty"><h4>Nobody has registered yet</h4></div>`; return; }
  box.innerHTML = `<table class="table">
    <thead><tr><th scope="col">Member</th><th scope="col">Class year</th><th scope="col">Role</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead>
    <tbody>${rows.map((u) => {
      const email = String(u.email || "").toLowerCase();
      const staff = ADMIN_EMAILS.has(email);
      const admin = staff || u.role === "admin";
      return `<tr>
        <td><div><b>${esc(u.name || email.split("@")[0])}</b></div><div class="small muted">${esc(email)}</div></td>
        <td class="num">${esc(u.gradYear ? String(u.gradYear) : "")}</td>
        <td>${staff ? '<span class="tag tag-brass">Staff</span>' : admin ? '<span class="tag tag-crimson">Administrator</span>' : '<span class="muted small">Member</span>'}</td>
        <td style="text-align:right">${staff ? "" : admin
          ? `<button type="button" class="btn btn-quiet btn-sm" data-role-uid="${esc(u.id)}" data-role="">Remove role</button>`
          : `<button type="button" class="btn btn-quiet btn-sm" data-role-uid="${esc(u.id)}" data-role="admin">Make administrator</button>`}</td>
      </tr>`;
    }).join("")}</tbody>
  </table>`;
}
