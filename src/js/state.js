/* Shared application state and the Firestore-backed stores. Feature modules
   import from here so they never import each other. */
import { Col, Docu } from "./store.js";

export const state = {
  user: null,          // Firebase Auth user
  profile: {},         // users/{uid}
  isAdmin: false,
  tab: "directory",
  onlineUids: new Set(),
  mySubmission: null,  // ambassador_submissions/{uid}
};

export const Users         = new Col("users", { orderField: null });
export const Presence      = new Col("presence", { orderField: null });
export const Opportunities = new Col("opportunities");
export const Milestones    = new Col("milestones");
export const Events        = new Col("events", { orderField: "startDate", dir: "asc", max: 200 });
export const Photos        = new Col("library_photos");
export const Submissions   = new Col("ambassador_submissions");

export const AmbConfig   = new Docu("config/ambassador", { open: false, questions: [] });
export const FormsConfig = new Docu("config/forms", { feedbackUrl: "" });

export const isMe = (uid) => Boolean(state.user) && state.user.uid === uid;
export const myName = () => state.profile?.name || state.user?.displayName || state.user?.email || "";

/** Cross-module notifications without circular imports. */
export const bus = new EventTarget();
export const emit = (name, detail = {}) => bus.dispatchEvent(new CustomEvent(name, { detail }));
export const on = (name, fn) => bus.addEventListener(name, (e) => fn(e.detail));
