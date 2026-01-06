# Alumni Portal

Single-page alumni portal with Firebase auth, online presence, and user registry.

## Features
- Register only with emails present in `alumni_portal.csv`.
- Log in/out via Firebase Authentication (email/password).
- Currently online users list (presence) pulled from Firestore.
- Registered users list (all accounts) pulled from Firestore.

## Setup
1) Create a Firebase project and enable **Email/Password** in Authentication.
2) In Firestore, create the database in production or test mode (rules below).
3) Copy your web app config into `firebase-config.js`.
4) Serve the app (needed so the CSV can be fetched), e.g.:
   ```bash
   cd /Users/natalia_mac/Desktop/alumni-portal
   python3 -m http.server 8000
   ```
   Then open http://localhost:8000 in the browser.

## Files
- `index.html` – UI with register/login, online users table, registered users table.
- `app.js` – Auth + allowlist enforcement + presence + user registry handling.
- `firebase-config.js` – Fill with your Firebase project config.
- `alumni_portal.csv` – Allowed emails (one per line).
- `styles.css` – Basic styling.

## Recommended Firestore security rules
The app now uses the email as the document ID in `users/{email}` (lowercased). This rule lets any signed-in user read the list, and lets a user write only their own email doc.
```rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{emailId} {
      allow read: if request.auth != null; // signed-in users can list registered users
      allow write: if request.auth != null
        && request.auth.token.email != null
        && lower(request.auth.token.email) == emailId;
    }
    match /presence/{uid} {
      allow read: if request.auth != null; // signed-in users can see online users
      allow write: if request.auth != null && request.auth.uid == uid; // user writes their own presence
    }
  }
}
```
