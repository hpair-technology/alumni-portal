import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  onSnapshot,
  collection,
  query,
  orderBy,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const registerForm = document.getElementById("register-form");
const registerEmail = document.getElementById("register-email");
const registerPassword = document.getElementById("register-password");
const loginForm = document.getElementById("login-form");
const loginEmail = document.getElementById("login-email");
const loginPassword = document.getElementById("login-password");
const logoutBtn = document.getElementById("logout-btn");
const authSection = document.getElementById("auth-section");
const userSection = document.getElementById("user-section");
const userEmail = document.getElementById("user-email");
const messages = document.getElementById("messages");
const presenceBody = document.getElementById("presence-body");
const registeredBody = document.getElementById("registered-body");

let registeredUnsubscribe = null;
let presenceUnsubscribe = null;
let unloadHandlerAttached = false;
let currentUser = null;

function showMessage(text, isError = false) {
  if (!text) {
    messages.classList.add("hidden");
    messages.textContent = "";
    return;
  }
  messages.textContent = text;
  messages.classList.toggle("error", Boolean(isError));
  messages.classList.remove("hidden");
}

function setFormDisabled(formEl, disabled) {
  formEl.querySelectorAll("input, button").forEach((el) => {
    el.disabled = disabled;
  });
}

async function loadAllowlist() {
  return fetch("./alumni_portal.csv")
    .then((res) => {
      if (!res.ok) throw new Error("Unable to load alumni allowlist.");
      return res.text();
    })
    .then((text) => {
      const entries = text
        .split(/\r?\n/)
        .map((line) => line.trim().toLowerCase())
        .filter(Boolean);
      return new Set(entries);
    })
    .catch((err) => {
      showMessage(err.message || "Failed to load allowlist.", true);
      throw err;
    });
}

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  showMessage("");
  setFormDisabled(registerForm, true);
  try {
    const allowlist = await loadAllowlist();
    const email = registerEmail.value.trim().toLowerCase();
    const password = registerPassword.value.trim();

    if (!allowlist.has(email)) {
      showMessage("This email is not on the alumni allowlist.", true);
      return;
    }

    const userCred = await createUserWithEmailAndPassword(auth, email, password);
    showMessage("Registration complete. You are signed in.");
  } catch (err) {
    showMessage(err.message || "Registration failed.", true);
  } finally {
    setFormDisabled(registerForm, false);
  }
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  showMessage("");
  setFormDisabled(loginForm, true);
  try {
    const email = loginEmail.value.trim().toLowerCase();
    const password = loginPassword.value.trim();
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    showMessage(err.message || "Login failed.", true);
  } finally {
    setFormDisabled(loginForm, false);
  }
});

logoutBtn.addEventListener("click", async () => {
  if (!auth.currentUser) return;
  showMessage("");
  await setPresenceOffline(auth.currentUser);
  await signOut(auth);
});

function showRegisteredPlaceholder(text) {
  registeredBody.innerHTML = `<tr><td class="muted">${text}</td></tr>`;
}

function showPresencePlaceholder(text) {
  presenceBody.innerHTML = `<tr><td colspan="2" class="muted">${text}</td></tr>`;
}

function startRegisteredListener() {
  stopRegisteredListener();
  const q = query(collection(db, "presence"), orderBy("email"));
  registeredUnsubscribe = onSnapshot(
    q,
    (snapshot) => {
      if (snapshot.empty) {
        showRegisteredPlaceholder("No registered users yet.");
        return;
      }
      const rows = snapshot.docs
        .map((docSnap) => docSnap.data())
        .map((data) => `<tr><td>${data.email || "Unknown"}</td></tr>`)
        .join("");
      registeredBody.innerHTML = rows;
    },
    (err) => {
      showRegisteredPlaceholder("Unable to load registered users.");
      showMessage(err.message || "Registered users subscription failed.", true);
    }
  );
}

function stopRegisteredListener() {
  if (registeredUnsubscribe) {
    registeredUnsubscribe();
    registeredUnsubscribe = null;
  }
}

function startPresenceListener() {
  stopPresenceListener();
  const q = query(collection(db, "presence"), orderBy("email"));
  presenceUnsubscribe = onSnapshot(
    q,
    (snapshot) => {
      if (snapshot.empty) {
        showPresencePlaceholder("No users recorded yet.");
        return;
      }
      const rows = snapshot.docs
        .map((docSnap) => docSnap.data())
        .map((data) => {
          const status = data.status || "offline";
          const lastSeen = data.lastSeen?.toDate
            ? data.lastSeen.toDate().toLocaleString()
            : "—";
          return `<tr><td>${data.email || "Unknown"}</td><td>${status} · ${lastSeen}</td></tr>`;
        })
        .join("");
      presenceBody.innerHTML = rows;
    },
    (err) => {
      showPresencePlaceholder("Unable to load presence.");
      showMessage(err.message || "Presence subscription failed.", true);
    }
  );
}

function stopPresenceListener() {
  if (presenceUnsubscribe) {
    presenceUnsubscribe();
    presenceUnsubscribe = null;
  }
}

async function setPresenceOnline(user) {
  if (!user) return;
  try {
    await setDoc(
      doc(db, "presence", user.uid),
      {
        email: user.email,
        status: "online",
        lastSeen: serverTimestamp(),
      },
      { merge: true }
    );
    attachUnloadHandler();
  } catch (err) {
    showMessage(err.message || "Failed to update presence.", true);
  }
}

async function setPresenceOffline(user) {
  if (!user) return;
  try {
    await setDoc(
      doc(db, "presence", user.uid),
      {
        email: user.email,
        status: "offline",
        lastSeen: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    // best-effort cleanup
  }
}

function attachUnloadHandler() {
  if (unloadHandlerAttached) return;
  const handler = () => setPresenceOffline(auth.currentUser);
  window.addEventListener("beforeunload", handler);
  unloadHandlerAttached = true;
}

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  if (user) {
    authSection.classList.add("hidden");
    userSection.classList.remove("hidden");
    userEmail.textContent = user.email || "";
    showMessage("Signed in.");
    await setPresenceOnline(user);
    startRegisteredListener();
    startPresenceListener();
  } else {
    stopRegisteredListener();
    stopPresenceListener();
    showRegisteredPlaceholder("Please log in to see registered users.");
    showPresencePlaceholder("Please log in to see online users.");
    authSection.classList.remove("hidden");
    userSection.classList.add("hidden");
    showMessage("");
  }
});

// Kick off allowlist loading early so registration feedback is fast.
loadAllowlist();

