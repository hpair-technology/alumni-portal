/* Online presence: a heartbeat every minute while the tab is open, and an
   "online" window of five minutes after the last one. */
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase.js";
import { state, Users, Presence, emit } from "./state.js";
import { ONLINE_WINDOW_MS, HEARTBEAT_MS } from "./config.js";
import { $, esc, toMillis, avatarHtml } from "./util.js";

let heartbeat = null;

async function write(status) {
  if (!state.user) return;
  try {
    await setDoc(doc(db, "presence", state.user.uid), {
      email: state.user.email,
      name: state.profile.name || "",
      headshotUrl: state.profile.headshotUrl || "",
      status,
      lastSeen: serverTimestamp(),
    }, { merge: true });
  } catch (err) { console.warn("presence write failed:", err?.code || err); }
}

export async function setPresenceOnline() {
  await write("online");
  clearInterval(heartbeat);
  heartbeat = setInterval(() => write("online"), HEARTBEAT_MS);
}
export async function setPresenceOffline() {
  clearInterval(heartbeat);
  await write("offline");
}
export function stopHeartbeat() { clearInterval(heartbeat); }

window.addEventListener("pagehide", () => { if (state.user) setPresenceOffline(); });
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && state.user && $("app-view") && !$("app-view").hidden) setPresenceOnline();
});

export function recomputeOnline(rows) {
  const now = Date.now();
  state.onlineUids = new Set(
    rows.filter((p) => p.status === "online" && now - toMillis(p.lastSeen) < ONLINE_WINDOW_MS).map((p) => p.id));
  if (state.user) state.onlineUids.add(state.user.uid);
  renderOnline();
  emit("presence:changed");
}

const ONLINE_AVATAR_LIMIT = 7;
export function renderOnline() {
  const people = Array.from(state.onlineUids)
    .map((uid) => Users.items.find((u) => u.id === uid) || Presence.items.find((p) => p.id === uid))
    .filter(Boolean);
  const strip = $("online-strip");
  const avatars = $("online-avatars");
  if (strip && avatars) {
    strip.hidden = people.length < 2;
    const hidden = people.length - ONLINE_AVATAR_LIMIT;
    avatars.innerHTML = people.slice(0, ONLINE_AVATAR_LIMIT)
      .map((p) => avatarHtml(p, "avatar avatar-sm", `title="${esc(p.name || p.email || "")}"`)).join("")
      + (hidden > 0 ? `<span class="avatar avatar-sm avatar-initials" title="${hidden} more">+${hidden}</span>` : "");
  }
  const stat = $("stat-online");
  if (stat) stat.textContent = String(people.length);
}
