import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import { getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
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
const storage = getStorage();

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
const profileIndustriesContainer = document.getElementById("profile-industries");
const profileForm = document.getElementById("profile-form");
const profileName = document.getElementById("profile-name");
const profileYear = document.getElementById("profile-year");
const profileHeadshot = document.getElementById("profile-headshot");
const searchNameInput = document.getElementById("search-name");
const searchYearInput = document.getElementById("search-year");
const searchIndustryInput = document.getElementById("search-industry");
const otherCheckbox = document.getElementById("other-checkbox");
const otherText = document.getElementById("other-text");
const messageErrorClasses = ["border-rose-700", "text-rose-700", "bg-rose-50"];
const messageOkClasses = ["border-rose-400", "text-slate-700", "bg-white"];

if (otherCheckbox && otherText) {
  otherCheckbox.addEventListener("change", () => {
    otherText.disabled = !otherCheckbox.checked;
    if (!otherCheckbox.checked) otherText.value = "";
  });
}

searchNameInput.addEventListener("input", renderRegisteredUsers);
searchYearInput.addEventListener("input", renderRegisteredUsers);
searchIndustryInput.addEventListener("change", renderRegisteredUsers);

let registeredUnsubscribe = null;
let presenceUnsubscribe = null;
let unloadHandlerAttached = false;
let currentUser = null;
let allUsers = [];

function showMessage(text, isError = false) {
  if (!text) {
    messages.classList.add("hidden");
    messages.textContent = "";
    return;
  }
  messages.textContent = text;
  if (isError) {
    messages.classList.add(...messageErrorClasses);
    messages.classList.remove(...messageOkClasses);
  } else {
    messages.classList.add(...messageOkClasses);
    messages.classList.remove(...messageErrorClasses);
  }
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

    try {
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCred.user;

      await setDoc(doc(db, "users", user.uid), {
        email: user.email,
        name: "",
        gradYear: "",
        headshotUrl: "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      showMessage("Registration complete. You are signed in.");
    } catch (err) {
      if (err.code === "auth/email-already-in-use") {
        showMessage("This email is already registered. Please log in instead.", true);
        registerEmail.value = "";
        registerPassword.value = "";
        registerEmail.focus();
      } else {
        throw err;
      }
    }
  } catch (err) {
    console.error(err);
    showMessage(err.message || "Registration failed.", true);
  } finally {
    setFormDisabled(registerForm, false);
  }
});

if (loginForm) {
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
}

logoutBtn.addEventListener("click", async () => {
  try {
    showMessage("");

    if (auth.currentUser) {
      await setPresenceOffline(auth.currentUser);
    }

    await signOut(auth);
  } catch (err) {
    console.error(err);
    showMessage("Failed to sign out.", true);
  }
});

profileForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentUser) {
    console.error("No user logged in, cannot save profile.");
    return;
  }

  setFormDisabled(profileForm, true);
  showMessage("Saving profile...");

  let headshotUrl = null;

  try {
    if (profileHeadshot.files.length > 0) {
      const file = profileHeadshot.files[0];
      console.log("Uploading headshot for user:", currentUser.uid, file.name, file.size);

      if (file.size > 5 * 1024 * 1024) throw new Error("Headshot file too large.");

      const fileRef = ref(storage, `headshots/${currentUser.uid}`);
      await uploadBytes(fileRef, file);

      headshotUrl = await getDownloadURL(fileRef);
      console.log("Headshot uploaded! URL:", headshotUrl);
    } else {
      console.log("No headshot selected.");
    }

    const selectedIndustries = Array.from(
      profileIndustriesContainer.querySelectorAll("input[type=checkbox]:checked")
    )
      .map(cb => cb.value)
      .filter(v => v !== "Other");

    if (otherCheckbox.checked && otherText.value.trim()) {
      selectedIndustries.push(otherText.value.trim());
    }

    const updateData = {
      name: profileName.value.trim(),
      gradYear: profileYear.value ? Number(profileYear.value) : "",
      industries: selectedIndustries,
      updatedAt: serverTimestamp(),
    };

    if (headshotUrl) updateData.headshotUrl = headshotUrl;

    await setDoc(doc(db, "users", currentUser.uid), updateData, { merge: true });

    if (headshotUrl) {
      const userHeadshot = document.getElementById("user-headshot");
      userHeadshot.src = headshotUrl;
      userHeadshot.alt = `${profileName.value}'s photo`;
      userHeadshot.classList.remove("bg-rose-100");
    }

    showMessage("Profile updated successfully!");
    renderRegisteredUsers();
  } catch (err) {
    console.error("Profile save error:", err);
    showMessage(err.message || "Failed to save profile.", true);
  } finally {
    setFormDisabled(profileForm, false);
  }
});

function showRegisteredPlaceholder(text) {
  registeredBody.innerHTML = `<tr><td colspan="4" class="px-4 py-6 text-sm text-slate-500">${text}</td></tr>`;
}

function showPresencePlaceholder(text) {
  presenceBody.innerHTML = `<tr><td colspan="2" class="px-4 py-6 text-sm text-slate-500">${text}</td></tr>`;
}

function startRegisteredListener() {
  stopRegisteredListener();
  const q = collection(db, "users");
  registeredUnsubscribe = onSnapshot(
    q,
    (snapshot) => {
      if (snapshot.empty) {
        showRegisteredPlaceholder("No registered users yet.");
        return;
      }
      allUsers = snapshot.docs.map(docSnap => ({ uid: docSnap.id, ...docSnap.data() }));
      renderRegisteredUsers();
    },
    (err) => {
      showRegisteredPlaceholder("Unable to load registered users.");
      showMessage(err.message || "Registered users subscription failed.", true);
    }
  );
}

function renderRegisteredUsers() {
  if (!allUsers.length) {
    showRegisteredPlaceholder("No registered users yet.");
    return;
  }

  const nameFilter = searchNameInput.value.trim().toLowerCase();
  const yearFilter = searchYearInput.value.trim();
  const industryFilter = searchIndustryInput.value;

  const filtered = allUsers.filter(u => {
    const matchesName = u.name?.toLowerCase().includes(nameFilter) ?? false;
    const matchesYear = yearFilter ? String(u.gradYear) === yearFilter : true;
    const matchesIndustry = industryFilter
      ? u.industries?.includes(industryFilter) ?? false
      : true;

    return matchesName && matchesYear && matchesIndustry;
  });

  if (!filtered.length) {
    registeredBody.innerHTML = `<tr><td colspan="4" class="px-4 py-6 text-sm text-slate-500">No matching users found.</td></tr>`;
    return;
  }

  registeredBody.innerHTML = filtered
    .map(u => `
      <tr class="align-middle">
        <td class="px-4 py-3">${u.headshotUrl ? `<img src="${u.headshotUrl}" class="h-12 w-12 rounded-full object-cover shadow-sm">` : `<img src="./anonymous.jpg" class="h-12 w-12 rounded-full object-cover shadow-sm">`}</td>
        <td class="px-4 py-3"><a href="#" class="user-link font-semibold text-rose-800 transition hover:text-rose-600" data-uid="${u.uid}">${u.name || "—"}</a></td>
        <td class="px-4 py-3 text-slate-600">${u.gradYear || "—"}</td>
        <td class="px-4 py-3 text-slate-600">${u.email}</td>
      </tr>
    `)
    .join("");

  registeredBody.addEventListener("click", async (e) => {
    if (!e.target.classList.contains("user-link")) return;
    e.preventDefault();
    const uid = e.target.dataset.uid;
    if (!uid) return;

    try {
      const docSnap = await getDoc(doc(db, "users", uid));
      if (!docSnap.exists()) return showMessage("User data not found.", true);

      const data = docSnap.data();
      const modal = document.getElementById("user-detail-modal");
      modal.querySelector("#detail-headshot").src = data.headshotUrl || "./anonymous.jpg";
      modal.querySelector("#detail-name").textContent = data.name || "—";
      modal.querySelector("#detail-email").textContent = data.email || "—";
      modal.querySelector("#detail-gradyear").textContent = `Grad Year: ${data.gradYear || "—"}`;
      modal.querySelector("#detail-industries").textContent = `Industries: ${data.industries?.join(", ") || "—"}`;

      modal.classList.remove("hidden");
    } catch (err) {
      console.error(err);
      showMessage("Failed to load user details.", true);
    }
  });

  document.getElementById("close-modal").addEventListener("click", () => {
    document.getElementById("user-detail-modal").classList.add("hidden");
  });

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
  const handler = () => {
    if (auth.currentUser) setPresenceOffline(auth.currentUser);
  };
  window.addEventListener("beforeunload", handler);
  unloadHandlerAttached = true;
}

onAuthStateChanged(auth, async (user) => {
  currentUser = user;

  if (user) {
    console.log("Auth state changed: user logged in", user);
    authSection.classList.add("hidden");
    userSection.classList.remove("hidden");
    userEmail.textContent = user.email || "";
    showMessage("Signed in.");
    try {
      await setPresenceOnline(user);
    } catch (err) {
      console.warn("Presence update failed:", err);
    }
    startRegisteredListener();
    startPresenceListener();
    getDoc(doc(db, "users", user.uid))
      .then((profileSnap) => {
        if (profileSnap.exists()) {
          const data = profileSnap.data();
          profileName.value = data.name || "";
          profileYear.value = data.gradYear || "";

          const userIndustries = data.industries || [];
          let otherValue = "";

          profileIndustriesContainer.querySelectorAll("input[type=checkbox]").forEach(cb => {
            if (cb.value === "Other") {
              const predefinedValues = Array.from(profileIndustriesContainer.querySelectorAll("input[type=checkbox]"))
                .map(c => c.value)
                .filter(v => v !== "Other");

              const otherIndustry = userIndustries.find(i => !predefinedValues.includes(i));
              if (otherIndustry) {
                cb.checked = true;
                otherValue = otherIndustry;
              } else {
                cb.checked = false;
              }
            } else {
              cb.checked = userIndustries.includes(cb.value);
            }
          });
          if (otherText) {
            otherText.value = otherValue;
            otherText.disabled = !otherValue; 
          }

          const signedInAs = document.getElementById("signed-in-as");
          const userHeadshot = document.getElementById("user-headshot");

          signedInAs.textContent = `Signed in as ${data.name || "—"}`;
          userEmail.textContent = user.email || "";

          if (data.headshotUrl) {
            userHeadshot.src = data.headshotUrl;
            userHeadshot.alt = `${data.name || "User"}'s photo`;
            userHeadshot.classList.remove("bg-rose-100");
          } else {
            userHeadshot.src = "./anonymous.jpg"; 
            userHeadshot.alt = "Anonymous user";
            userHeadshot.classList.add("bg-rose-100");
          }
        } else {
          console.warn("Profile doc missing for user:", user.uid);
        }
      })
      .catch((err) => {
        console.error("Failed to load profile data:", err);
        showMessage("Failed to load profile data.", true);
      });

  } else {
    console.log("Auth state changed: user logged out");
    stopRegisteredListener();
    stopPresenceListener();
    showRegisteredPlaceholder("Please log in to see registered users.");
    authSection.classList.remove("hidden");
    userSection.classList.add("hidden");
    showMessage("");
  }
});


// Kick off allowlist loading early, and catch errors to avoid breaking the app
loadAllowlist().catch(err => console.warn("Allowlist preload failed:", err));
