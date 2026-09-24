// Firebase client configuration.
//
// The defaults are the live project. To point a local checkout somewhere else,
// copy .env.example to .env and fill in the values; Vite exposes anything
// prefixed with VITE_.
//
// Web API keys are public by design: they ship in the JS bundle of every
// Firebase site. Access is controlled by firestore.rules and storage.rules.
const env = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {};

export const firebaseConfig = {
  apiKey:            env.VITE_FIREBASE_API_KEY             || "AIzaSyDoxK8mf_341BcZWCLxjwt1iIMCHGbLWz0",
  authDomain:        env.VITE_FIREBASE_AUTH_DOMAIN         || "alumni-portal-30642.firebaseapp.com",
  projectId:         env.VITE_FIREBASE_PROJECT_ID          || "alumni-portal-30642",
  storageBucket:     env.VITE_FIREBASE_STORAGE_BUCKET      || "alumni-portal-30642.firebasestorage.app",
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || "180735084374",
  appId:             env.VITE_FIREBASE_APP_ID              || "1:180735084374:web:705a0bfb0fe78409e4b8f7",
  measurementId:     env.VITE_FIREBASE_MEASUREMENT_ID      || "G-QHJ3PCD7MB",
};
