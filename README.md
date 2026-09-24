# HPAIR Alumni Portal

The alumni network of the Harvard College Project for Asian and International Relations: a public front page at `/` and a members-only portal at `/portal`.

Plain HTML, CSS and ES modules. Firebase for Auth, Firestore and Storage. Vite bundles the two pages. No framework, no CSS build step, no server of our own.

---

## Running it

```bash
npm install
npm run dev        # http://localhost:5173  (front page) and /portal
npm run build      # -> dist/
npm run preview    # serve dist/ as it will be deployed
```

Serve over HTTP. Opening the files from disk breaks the ES modules.

### Design preview without an account

With `npm run dev` running, open **`/portal?preview=admin`**, **`/portal?preview=member`** or **`/portal?preview=new`** (a member whose entry is still unfinished). The signed-in portal renders with fictional sample data and no Firebase account. This exists so the team can review the design and copy; it is stripped from production builds.

---

## Layout

| File | What it is |
| --- | --- |
| `index.html`, `src/css/landing.css`, `src/js/landing.js` | Public front page |
| `src/js/globe.js` | The Asia Conference globe and host-city list |
| `portal.html`, `src/css/portal.css` | Portal markup and styles: sign-in, six sections, drawer, modals |
| `src/css/base.css` | Design tokens and the shared component vocabulary |
| `src/js/portal.js` | Boot: auth, tabs, data wiring |
| `src/js/config.js` | Everything an admin might want to change: staff emails, industries, conference record, limits |
| `src/js/state.js`, `store.js` | Shared state; Firestore collections with a local fallback |
| `src/js/directory.js`, `profile.js`, `career.js`, `updates.js`, `conferences.js`, `ambassador.js`, `admin.js` | One module per section |
| `src/js/preview.js` | Dev-only sample data (see above) |
| `firebase-config.js`, `firestore.rules`, `storage.rules` | Firebase client config and security rules |
| `alumni_portal.csv` | The former allowlist, kept for reference; nothing reads it |
| `vercel.json` | Clean URLs (`/portal`) and security headers |

`public/` is copied to the build root as-is and is publicly downloadable. Keep private data out of it. It holds `img/earth.jpg` (the globe texture), `img/aconf-delegates.jpg`, `img/hpair-mark.png` and `vendor/globe.gl.min.js` (2.34.4, bundles three.js).

The globe is fetched only when its section nears the viewport, and not at all below 860 px wide, where the host-city list carries the same information. If WebGL or the library is unavailable the list still renders.

---

## How access works

Registration is open: anyone can create an account with an email address and a password, and any signed-in account can use the portal. Passwords are reset from the sign-in screen (Firebase sends the email).

### Getting members to fill in their entry

A directory is only worth having if the entries have something in them, so the portal asks three times, quietly, and never with a recurring popup:

1. **"Your profile" is the first tab**, so editing your own entry is one click from anywhere rather than buried in the account menu.
2. **The first sign-in on a browser opens the editor once.** It is keyed by uid in `localStorage` (`hpair:setup:<uid>`), so it does not come back on the next visit or in another tab. A member whose entry is still thin also *lands* on Your profile rather than the directory; once it has content, they land on the directory like everyone else.
3. **Your own entry always leads the directory**, shown as others see it, and carries a line naming what is missing while it is still thin. Seeing your own blank row above ten filled-in ones does more than a nag would. Filters still apply, so you are not forced into results you do not match.

"Thin" means at least two of these are missing: photograph, current position, class year, conferences attended, biography (`missingFields()` in `src/js/profile.js`). There is deliberately no percentage score.

The old CSV allowlist is gone. If HPAIR later wants to restrict access again, the cleanest route is a Firestore `allowlist/{email}` collection checked in the rules (`exists(...)` in `isMember()`), never a list served from `public/`.

---

## Firebase

Project `alumni-portal-30642` (Firebase account: tech-help@hpair.org). Client config is in `firebase-config.js`; copy `.env.example` to `.env` to point a local checkout elsewhere.

Deploy the rules whenever they change:

```bash
npx firebase-tools deploy --only firestore:rules,storage
```

**Authentication → Sign-in method → Email/Password** must be enabled. Under **Authentication → Templates**, set the sender name to HPAIR and check the password-reset email reads well; its "continue" link returns people to `/portal`.

### Collections

| Collection | Contents | Who writes |
| --- | --- | --- |
| `users/{uid}` | Profile: name, gradYear, title, company, location, country, linkedin, website, bio, industries[], conferences[], mentoring, showEmail, headshotUrl | Owner, except `role`; admins |
| `presence/{uid}` | `status`, `lastSeen`, refreshed every 60 s | Owner |
| `opportunities/{id}` | Career posts with `type`, `deadline`, optional attachment | Poster; admins |
| `milestones/{id}` | Updates from the board | Admins |
| `events/{id}` | Upcoming conferences and gatherings | Admins |
| `library_photos/{id}` | Photographs, `status` pending or published | Uploader creates pending; admins publish |
| `config/ambassador` | `{ open, questions[] }` | Admins |
| `config/forms` | `{ feedbackUrl }` | Admins |
| `ambassador_submissions/{uid}` | One application per alum, with `status` | Applicant creates; admins update |

`role` on a user document is the permission field. A person's job title is stored separately as `title`, so nobody becomes an administrator by typing "admin" into their job title.

### Administrators

An account is an administrator if its email is in `ADMIN_EMAILS` (`src/js/config.js`) or its `users/{uid}` document has `role: "admin"`. Admins promote and demote others from **Admin → Members and roles**; the rules stop anyone granting the role to themselves.

The staff email list is written in **three places** that must stay in sync: `ADMIN_EMAILS` in `src/js/config.js` (what the interface shows), `isStaffEmail()` in `firestore.rules` (what the database accepts) and `isStaffEmail()` in `storage.rules` (what can be uploaded). Rules changes take effect only after `firebase deploy`.

Administrators can: post and edit updates and events, publish or decline photo submissions, build the ambassador form and review applications, promote members, and delete any opportunity.

### Degraded mode

If a collection cannot reach Firestore, it falls back to a copy in the browser and a banner appears. Other collections keep working. Permission errors are reported as such rather than hidden.

---

## Deployment

Vercel, from this repository. `vercel.json` turns on clean URLs so `dist/portal.html` is served at `/portal`, and adds security headers. Build command `npm run build`, output directory `dist`.

---

## Design

The portal is meant to read like something a university alumni office would publish, not a start-up dashboard. The rules, so future changes stay consistent:

- **Type.** Source Serif 4 for headings and names; Public Sans for everything else. Numerals are tabular in tables and dates.
- **Colour.** Warm paper background, near-black ink, crimson `#A51C30` only for the primary action and small emphasis, brass `#B49761` for hairlines and markers. No gradients, no pure white or pure black outside photographs.
- **Shape.** Hairlines instead of shadows. Radius 0 on cards, images and tables; 2 px on inputs and buttons; 50 % on avatars. The only shadows are on the drawer and menus.
- **Layout.** Asymmetric grids (7/5, 4/8, 3/9), a 1320 px container, spacing that varies with importance.
- **Content.** Real names, dates and places over generic copy. No emoji, no icon tiles, no stat counters, no eyebrow labels above every block.
- **Copy.** Short declarative sentences. Name what a thing is rather than what it "lets you" do. No slogans, no rule-of-three lists written for rhythm, no jokes, no closing flourishes. Headings are noun phrases without full stops. American spelling.

Tokens live in `src/css/base.css`. Change them there rather than per component.

The Asia Conference host list in `src/js/config.js` is compiled from the public record; Alumni Relations should correct any entry that disagrees with HPAIR's own archive. Figures on the front page (49 conferences, 34 host countries, 40,000 delegates) are the ones hpair.org publishes.
