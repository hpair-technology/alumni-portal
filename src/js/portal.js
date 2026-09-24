/* ============================================================================
   HPAIR Alumni Portal: boot
   ----------------------------------------------------------------------------
   Authentication and the membership gates, the signed-in shell (tabs, user
   menu, greeting), and wiring each store to the module that renders it.
   ========================================================================== */
import "cropperjs/dist/cropper.css";
import {
  onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  sendPasswordResetEmail, signOut, updateProfile,
  setPersistence, browserLocalPersistence, browserSessionPersistence,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./firebase.js";
import { ADMIN_EMAILS, CONTACT } from "./config.js";
import { net } from "./store.js";
import {
  state, on, Users, Presence, Opportunities, Milestones, Events, Photos, Submissions, AmbConfig, FormsConfig,
} from "./state.js";
import { $, $$, avatarHtml, toast, wireModals, busy } from "./util.js";
import { setPresenceOnline, setPresenceOffline, stopHeartbeat, recomputeOnline, renderOnline } from "./presence.js";
import { initDirectory, renderDirectory, closePerson } from "./directory.js";
import { initProfile, openProfileModal, renderMyProfile, isThin } from "./profile.js";
import { initCareer, renderOpportunities } from "./career.js";
import { initUpdates, renderMilestones } from "./updates.js";
import { initConferences, renderEvents, renderPhotos, renderFeedback } from "./conferences.js";
import { initAmbassador, renderAmbassador, renderSubmissions, loadMySubmission, stopMySubmission } from "./ambassador.js";
import { initAdmin, renderAdmin } from "./admin.js";

const PORTAL_URL = `${location.origin}/portal`;
// Development-only design preview: /portal?preview=admin or ?preview=member.
const PREVIEW = import.meta.env.DEV ? new URLSearchParams(location.search).get("preview") : "";

/* ─── Degraded-mode banner ─────────────────────────────────────────────── */
net.onDegraded = () => { $("sysbar").hidden = false; };
$("sysbar-retry").addEventListener("click", () => location.reload());

/* ══════════════════════════════════════════════════════════════════════════
   AUTH
   ══════════════════════════════════════════════════════════════════════ */
const AUTH_ERRORS = {
  "auth/invalid-email": "That doesn't look like a valid email address.",
  "auth/user-disabled": `This account has been disabled. Write to ${CONTACT.tech}.`,
  "auth/user-not-found": "No account exists for that address. Create one first.",
  "auth/wrong-password": "Incorrect password. Try again, or reset it.",
  "auth/invalid-credential": "Incorrect email or password.",
  "auth/invalid-login-credentials": "Incorrect email or password.",
  "auth/too-many-requests": "Too many attempts. Wait a few minutes, or reset your password.",
  "auth/email-already-in-use": "That address already has an account. Sign in instead.",
  "auth/weak-password": "Please choose a password of at least 8 characters.",
  "auth/network-request-failed": "Network problem. Check your connection and try again.",
  "auth/operation-not-allowed": "Email and password sign-in is not enabled on this Firebase project.",
  "auth/missing-password": "Please enter your password.",
};
const authMessage = (err) => AUTH_ERRORS[err?.code] || String(err?.message || "Something went wrong.").replace(/^Firebase:\s*/, "").replace(/\s*\(auth\/[^)]+\)\.?$/, "");

function authAlert(msg, kind = "error") {
  const el = $("auth-alert");
  if (!msg) { el.hidden = true; el.textContent = ""; return; }
  el.className = `alert alert-${kind}`;
  el.textContent = msg;
  el.hidden = false;
}

function showAuthPanel(which) {
  const login = which === "login";
  $("tab-login").setAttribute("aria-selected", String(login));
  $("tab-register").setAttribute("aria-selected", String(!login));
  $("panel-login").hidden = !login;
  $("panel-register").hidden = login;
  authAlert("");
  history.replaceState(null, "", login ? "#" : "#register");
}
$("tab-login").addEventListener("click", () => showAuthPanel("login"));
$("tab-register").addEventListener("click", () => showAuthPanel("register"));
$$("[data-goto]").forEach((b) => b.addEventListener("click", () => showAuthPanel(b.dataset.goto)));
if (location.hash === "#register") showAuthPanel("register");

$$("[data-reveal]").forEach((btn) => btn.addEventListener("click", () => {
  const input = $(btn.dataset.reveal);
  const show = input.type === "password";
  input.type = show ? "text" : "password";
  btn.textContent = show ? "Hide" : "Show";
}));

$("register-password").addEventListener("input", (e) => {
  const v = e.target.value;
  let score = 0;
  if (v.length >= 8) score++;
  if (v.length >= 12) score++;
  if (/[A-Z]/.test(v) && /[a-z]/.test(v)) score++;
  if (/\d/.test(v) || /[^\w\s]/.test(v)) score++;
  if (!v) score = 0;
  $("pw-meter").dataset.score = String(score);
  $("pw-note").textContent = !v ? "At least 8 characters." : ["Too short.", "Weak. Add more characters.", "Fair.", "Good.", "Strong."][score];
});

/* --- register --- */
$("register-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  authAlert("");
  const name = $("register-name").value.trim();
  const email = $("register-email").value.trim().toLowerCase();
  const password = $("register-password").value;
  if (!name) return authAlert("Please tell us your name.");
  if (!email) return authAlert("Please enter your email address.");
  if (password.length < 8) return authAlert("Please choose a password of at least 8 characters.");
  const restore = busy(e.target.querySelector('button[type="submit"]'), "Creating your account…");
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    try { await updateProfile(cred.user, { displayName: name }); } catch {}
    sessionStorage.setItem("hpair:pendingName", name);
    // onAuthStateChanged takes it from here.
  } catch (err) {
    authAlert(authMessage(err));
  } finally { restore(); }
});

/* --- login --- */
$("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  authAlert("");
  const email = $("login-email").value.trim().toLowerCase();
  const password = $("login-password").value;
  if (!email || !password) return authAlert("Please enter your email address and password.");
  const restore = busy(e.target.querySelector('button[type="submit"]'), "Signing in…");
  try {
    await setPersistence(auth, $("login-remember").checked ? browserLocalPersistence : browserSessionPersistence);
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    authAlert(authMessage(err));
  } finally { restore(); }
});

/* --- forgot password --- */
$("forgot-link").addEventListener("click", () => {
  $("forgot-email").value = $("login-email").value.trim();
  $("forgot-alert").hidden = true;
  openModal("forgot-modal");
});
$("forgot-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const box = $("forgot-alert");
  const email = $("forgot-email").value.trim().toLowerCase();
  const restore = busy(e.target.querySelector('button[type="submit"]'), "Sending…");
  try {
    await sendPasswordResetEmail(auth, email, { url: PORTAL_URL });
    box.className = "alert alert-ok";
    box.textContent = "If an account exists for that address, a reset link is on its way. Check your spam folder too.";
  } catch (err) {
    // Never reveal whether an address is registered.
    if (err?.code === "auth/user-not-found" || err?.code === "auth/invalid-email") {
      box.className = "alert alert-ok";
      box.textContent = "If an account exists for that address, a reset link is on its way.";
    } else {
      box.className = "alert alert-error";
      box.textContent = authMessage(err);
    }
  } finally {
    box.hidden = false;
    restore();
  }
});

/* --- sign out --- */
async function doLogout() {
  try {
    await setPresenceOffline();
    await signOut(auth);
    toast("Signed out.", "info");
  } catch { toast("Could not sign out.", "error"); }
}
$("menu-logout").addEventListener("click", doLogout);

function showAuth() {
  $("auth-view").hidden = false;
  $("app-view").hidden = true;
}

if (PREVIEW) {
  import("./preview.js").then(({ startPreview }) => startPreview(PREVIEW, { enterShell }));
} else {
  onAuthStateChanged(auth, async (user) => {
    state.user = user;
    if (!user) { exitApp(); return; }
    await enterApp();
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   APP SHELL
   ══════════════════════════════════════════════════════════════════════ */
async function enterApp() {
  $("auth-view").hidden = true;
  $("app-view").hidden = false;

  try {
    const ref = doc(db, "users", state.user.uid);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      state.profile = snap.data();
    } else {
      const name = state.user.displayName || sessionStorage.getItem("hpair:pendingName") || "";
      const fresh = {
        email: (state.user.email || "").toLowerCase(), name, gradYear: "", headshotUrl: "", bio: "", industries: [], conferences: [],
        title: "", company: "", location: "", country: "", linkedin: "", website: "", mentoring: "", showEmail: true, role: "",
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      };
      await setDoc(ref, fresh);
      state.profile = { ...fresh, createdAt: Date.now(), updatedAt: Date.now() };
      sessionStorage.removeItem("hpair:pendingName");
    }
  } catch (err) {
    console.warn("Profile load failed:", err);
    state.profile = { email: state.user.email, name: state.user.displayName || "" };
    if (err?.code === "permission-denied") {
      toast("Could not load your profile. Write to tech-help@hpair.org if this continues.", "error");
    }
  }

  enterShell();
}

/** Everything after the profile is known: roles, identity, data, first tab. */
function enterShell({ forceAdmin = false } = {}) {
  $("auth-view").hidden = true;
  $("app-view").hidden = false;
  state.isAdmin = forceAdmin || ADMIN_EMAILS.has((state.user.email || "").toLowerCase()) || state.profile.role === "admin";
  $$(".admin-only").forEach((el) => { el.hidden = !state.isAdmin; });
  $("admin-badge-wrap").hidden = !state.isAdmin;

  paintIdentity();
  if (PREVIEW) renderAll(); else startData();
  showTab(location.hash.replace("#", "") || (isThin(state.profile) ? "profile" : "directory"));
  if (!PREVIEW) setPresenceOnline();

  // First sign-in on this browser, and only then: open the editor once so a
  // new member starts with something in the directory. Keyed by uid in
  // localStorage, so it does not reappear on the next visit or the next tab.
  const setupKey = `hpair:setup:${state.user.uid}`;
  let seenSetup = true;
  try { seenSetup = Boolean(localStorage.getItem(setupKey)); } catch {}
  if (!PREVIEW && !seenSetup && isThin(state.profile)) {
    try { localStorage.setItem(setupKey, "1"); } catch {}
    setTimeout(() => { if (state.user) openProfileModal(); }, 500);
  }
}

/** Preview only: paint every section from whatever the stores hold. */
function renderAll() {
  recomputeOnline(Presence.items);
  renderDirectory();
  $("count-alumni").textContent = Users.items.length ? String(Users.items.length) : "";
  renderOpportunities();
  renderMilestones();
  renderEvents();
  renderPhotos();
  renderFeedback(FormsConfig.data);
  renderAmbassador(AmbConfig.data);
  renderSubmissions();
  renderAdmin();
}

function exitApp() {
  showAuth();
  stopData();
  stopHeartbeat();
  closePerson();
  state.profile = {};
  state.isAdmin = false;
  state.mySubmission = null;
  $("login-password").value = "";
  $("register-password").value = "";
}

function paintIdentity() {
  const me = { ...state.profile, email: state.user.email };
  $("user-avatar").outerHTML = avatarHtml(me, "avatar avatar-sm", 'id="user-avatar"');
  $("user-name-short").textContent = me.name || me.email.split("@")[0];
  $("user-display-name").textContent = me.name || me.email;
  $("user-email").textContent = me.email;
}

on("profile:saved", () => { paintIdentity(); setPresenceOnline(); renderDirectory(); renderMyProfile(); });
$("profile-edit-btn").addEventListener("click", openProfileModal);
// "Add them" inside the missing-fields note, wherever it is rendered.
document.addEventListener("click", (e) => {
  if (e.target.closest("[data-edit-profile]")) openProfileModal();
});
$("menu-profile").addEventListener("click", openProfileModal);
$("menu-view-me").addEventListener("click", () => showTab("profile"));

/* --- tabs --- */
const TABS = ["profile", "directory", "career", "updates", "conferences", "ambassador", "admin"];
function showTab(name) {
  if (!TABS.includes(name) || (name === "admin" && !state.isAdmin)) name = "directory";
  state.tab = name;
  if (name === "profile") renderMyProfile();
  $$(".tab-btn").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === name)));
  $$(".tab-panel").forEach((p) => { p.hidden = p.id !== `tab-${name}`; });
  history.replaceState(null, "", `#${name}`);
  if (name === "admin") renderAdmin();
}
$$(".tab-btn").forEach((b) => b.addEventListener("click", () => showTab(b.dataset.tab)));
window.addEventListener("hashchange", () => { if (state.user && !$("app-view").hidden) showTab(location.hash.replace("#", "")); });

/* --- user menu --- */
const um = $("usermenu");
$("usermenu-btn").addEventListener("click", (e) => {
  e.stopPropagation();
  const open = um.classList.toggle("open");
  $("usermenu-btn").setAttribute("aria-expanded", String(open));
});
document.addEventListener("click", () => { um.classList.remove("open"); $("usermenu-btn").setAttribute("aria-expanded", "false"); });

/* ══════════════════════════════════════════════════════════════════════════
   DATA WIRING
   ══════════════════════════════════════════════════════════════════════ */
const unsubs = [];
function startData() {
  stopData();
  [Users, Presence, Opportunities, Milestones, Events, Photos].forEach((c) => c.start());
  AmbConfig.start();
  FormsConfig.start();
  if (state.isAdmin) Submissions.start();
  else loadMySubmission();

  const adminRefresh = () => { if (state.isAdmin && state.tab === "admin") renderAdmin(); };
  unsubs.push(
    Users.onChange(() => {
      renderDirectory(); renderOnline(); renderMyProfile();
      $("count-alumni").textContent = Users.items.length ? String(Users.items.length) : "";
      adminRefresh();
    }),
    Presence.onChange((rows) => { recomputeOnline(rows); adminRefresh(); }),
    Opportunities.onChange(() => { renderOpportunities(); adminRefresh(); }),
    Milestones.onChange(renderMilestones),
    Events.onChange(() => { renderEvents(); adminRefresh(); }),
    Photos.onChange(() => { renderPhotos(); adminRefresh(); }),
    AmbConfig.onChange(renderAmbassador),
    FormsConfig.onChange(renderFeedback),
    Submissions.onChange(() => { renderSubmissions(); renderAmbassador(); adminRefresh(); }),
  );
}
function stopData() {
  unsubs.splice(0).forEach((fn) => fn());
  stopMySubmission();
  [Users, Presence, Opportunities, Milestones, Events, Photos, Submissions].forEach((c) => c.stop());
  AmbConfig.stop();
  FormsConfig.stop();
}

/* ══════════════════════════════════════════════════════════════════════════
   BOOT
   ══════════════════════════════════════════════════════════════════════ */
wireModals();
initDirectory();
initProfile();
initCareer();
initUpdates();
initConferences();
initAmbassador();
initAdmin();
$("foot-year").textContent = String(new Date().getFullYear());
renderDirectory();
