# KiraSync

> **Demo / portfolio project — not a real product.**
> KiraSync is a fictional restaurant ordering experience built as a web
> development project. It is **not** a real business or product, is not
> affiliated with any real restaurant, and does not process real orders,
> reservations, or payments. All menus, prices, tables, guests, receipts, and
> transactions are simulated for demonstration purposes only.

**Prototype website:** https://kirasynchro.web.app

A mobile-first restaurant ordering demo with a live diner view and a staff
dashboard. Guests can join a table session, add themselves to the bill, split
items, and "pay" individually. The restaurant view shows every table's status,
orders, and a daily revenue ledger in real time.

## Features

- **Diner flow** — join a table, add guests, assign menu items to one or more
  diners, split the bill per person, and generate a demo e-receipt.
- **Restaurant dashboard** — live table statuses, diner/order breakdown, daily
  revenue and transaction history, and a table reset action.
- **Live sync** — Firestore `onSnapshot` listeners keep every open client in
  sync without polling.
- **Per-document writes** — each diner and order is its own document, so
  concurrent guests do not overwrite each other.
- **Hardened backend** — deny-by-default Firestore rules, required
  authentication, field validation, and optional App Check.

## Tech stack

- HTML, CSS, and vanilla JavaScript (ES modules)
- Firebase Firestore (real-time database)
- Firebase Authentication (anonymous sessions)
- Firebase Hosting
- Optional: Firebase App Check with reCAPTCHA v3

## Project structure

```
.
├── index.html                  # Landing / entry page
├── diner.html                  # Guest ordering and payment demo
├── restaurant.html             # Staff dashboard
├── script.js                   # Shared UI logic and demo data
├── style.css                   # Main styles
├── app.css                     # App-specific styles
├── firebase-sync.js            # Firebase init + Firestore data layer
├── firebase-config.example.js  # Safe template for local config
├── firebase-config.js          # Local config (git-ignored, create it yourself)
├── firestore.rules             # Security rules (deploy these)
├── firebase.json               # Firebase Hosting + Firestore config
└── .firebaserc                 # Firebase project alias
```

## Local setup

### 1. Create the local Firebase config

The real config is intentionally not in Git.

```powershell
Copy-Item firebase-config.example.js firebase-config.js   # Windows PowerShell
# cp firebase-config.example.js firebase-config.js        # macOS / Linux
```

Open `firebase-config.js` and fill in the values from:

**Firebase Console → Project settings → Your apps → Web app**

> `firebase-config.js` is listed in `.gitignore`. Never commit it.

### 2. Enable Anonymous Authentication

**Firebase Console → Authentication → Sign-in method → Anonymous → Enable**

The app signs in anonymously on load, and the security rules reject any request
without an authenticated session.

### 3. Create the Firestore database

**Firebase Console → Firestore Database → Create database** (production mode).

### 4. Deploy the security rules

```bash
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:rules
```

### 5. Serve locally

Because the app uses ES modules, open it through a local server rather than
`file://`:

```bash
npx serve .
# or
python -m http.server 8080
```

Then visit `http://localhost:8080`.

## Deployment

The `.firebaserc` file already points at the `kirasynchro` project. To deploy
the site and rules:

```bash
firebase deploy
```

Hosting serves the current folder (`"public": "."` in `firebase.json`).
`firebase-config.js` is deployed with the site because the browser needs it —
it is only kept out of Git.

## Security model

A Firebase **web** config (`apiKey`, `projectId`, etc.) is not a password. It
must be downloaded by the browser to talk to Firestore, so it is always visible
in DevTools on a live static site. Hiding it completely would require routing
all database access through a backend (for example Cloud Functions), which this
demo does not do.

What this project does instead:

1. **Config stays out of Git** — `firebase-config.js` is git-ignored, and the
   repository history was rewritten so the key is not stored there.
2. **Deny by default** — unknown collections are inaccessible, and destructive
   operations are limited to what the app actually needs.
3. **Authentication required** — every read and write requires
   `request.auth != null`. The app uses anonymous auth so there is no login
   screen.
4. **Strict validation** — rules whitelist field names, check types, enforce
   document IDs, and limit string/list sizes. Oversized or malformed writes are
   rejected.
5. **App Check (recommended)** — set `appCheckSiteKey` in
   `firebase-config.js`, register the app in Firebase App Check with reCAPTCHA
   v3, then enforce App Check for Firestore. This blocks traffic that does not
   come from your registered sites.
6. **API key restrictions (do this)** — in **Google Cloud Console → APIs &
   Services → Credentials**, edit the Firebase browser key:
   - **Application restrictions → HTTP referrers**:
     - `https://kirasynchro.web.app/*`
     - `https://kirasynchro.firebaseapp.com/*`
     - `http://localhost/*` (local development)
   - **API restrictions → Restrict key**: allow only
     - Identity Toolkit API (Firebase Auth)
     - Cloud Firestore API

   If the key was ever exposed publicly, add these restrictions immediately.
   They are what prevent the key from being useful to anyone else, even though
   the key itself is visible.

### Rules summary

| Path | Read | Write |
| --- | --- | --- |
| `tables/{tableId}` | Authenticated | Create/update with a valid status and timestamps only |
| `tables/{tableId}/diners/{dinerId}` | Authenticated | Create/update with validated diner fields; delete allowed for table reset |
| `tables/{tableId}/orders/{orderId}` | Authenticated | Create/update with validated order fields; delete allowed for table reset |
| `daily_metrics/{YYYY-MM-DD}` | Authenticated | Append/update revenue totals only; no deletes |
| Anything else | Denied | Denied |

### Limitations

- Anonymous authentication proves a client is genuine, not that it is a
  specific diner or staff member. Anyone who loads the demo site can read and
  write demo data, subject to the rules above. A real product would add staff
  accounts, custom claims, and per-user ownership.
- The "payments" in this project are simulated in the browser. No payment
  provider is integrated, and no real money moves.

## Disclaimer

KiraSync is a **fictional demo**. The restaurant, menu, prices, staff, guests,
receipts, and transactions shown are examples only. Nothing in this repository
is a real product, service, or commercial offering. Do not use it to process
real payments or personal data.

## License

This project is provided for educational and portfolio purposes. Add a license
of your choice before redistributing.
