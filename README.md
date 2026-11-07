# KiraSync

> **Demo / portfolio project — not a real product.**
> KiraSync is a fictional restaurant ordering experience built as a web
> development project. It is **not** a real business or product, is not
> affiliated with any real restaurant, and does not process real orders,
> reservations, or payments. All menus, prices, tables, guests, receipts, and
> transactions are simulated for demonstration purposes only.

**Prototype website:** https://kirasynchro.web.app

A mobile-first restaurant ordering demo with a live diner view and a protected
staff dashboard. Guests can join a table session, add themselves to the bill,
split items, and "pay" individually. Staff sign in to see every table's status,
orders, and a daily revenue ledger in real time.

## Features

- **Diner flow** — join a table, add guests, assign menu items to one or more
  diners, split the bill per person, and generate a demo e-receipt.
- **Protected staff dashboard** — email/password sign-in, live table statuses,
  diner/order breakdown, daily revenue and transaction history, and a table
  reset action.
- **Live sync** — Firestore `onSnapshot` listeners keep every open client in
  sync without polling.
- **Per-document writes** — each diner and order is its own document, so
  concurrent guests do not overwrite each other.
- **Hardened backend** — deny-by-default Firestore rules, required
  authentication, staff-only destructive actions, field validation, and
  optional App Check.
- **Browser hardening** — strict Content Security Policy, no inline scripts or
  inline event handlers, and all untrusted data is escaped before rendering.

## Tech stack

- HTML, CSS, and vanilla JavaScript (ES modules)
- Firebase Firestore (real-time database)
- Firebase Authentication (anonymous diners + email/password staff)
- Firebase Hosting
- Optional: Firebase App Check with reCAPTCHA v3

## Project structure

```
.
├── index.html                  # Landing / entry page
├── diner.html                  # Guest ordering and payment demo
├── restaurant.html             # Staff sign-in + dashboard
├── script.js                   # Landing-page UI logic and demo data
├── diner.js                    # Diner page logic
├── restaurant.js               # Staff dashboard logic
├── theme-init.js               # Pre-paint theme script for the landing page
├── style.css                   # Main styles
├── app.css                     # App-specific styles
├── firebase-sync.js            # Firebase init + Firestore data layer
├── firebase-config.example.js  # Safe template for local config
├── firebase-config.js          # Local config (git-ignored, create it yourself)
├── firestore.rules             # Security rules (deploy these)
├── firebase.json               # Hosting headers + Firestore config
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

### 2. Enable the authentication providers

In **Firebase Console → Authentication → Sign-in method**, enable:

- **Anonymous** — used by diners, so they can order without creating an account.
- **Email/Password** — used by staff to open the dashboard.

The security rules reject any request without an authenticated session.

### 3. Create a staff account

1. In **Authentication → Users**, add an email/password user for each staff
   member.
2. Copy that user's **UID**.
3. In **Firestore Database**, create a document at `staff/{UID}`. Its contents
   do not matter; its existence is the access grant. For example:

   ```
   staff/
     └── <STAFF_UID>/
           └── (any field, e.g. role: "manager")
   ```

   Create this document manually in the console. The client can read its own
   `staff/{uid}` document but can never create or modify staff membership.

### 4. Create the Firestore database

**Firebase Console → Firestore Database → Create database** (production mode).

### 5. Deploy the security rules

Staff sign-in works by reading `staff/{uid}`, so deploy the rules before
testing the dashboard.

```bash
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:rules
```

### 6. Serve locally

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
the site, headers, and rules:

```bash
firebase deploy
```

Hosting serves the current folder (`"public": "."` in `firebase.json`).
`firebase-config.js` is deployed with the site because the browser needs it —
it is only kept out of Git.

`firebase.json` adds these response headers to every route:

- **Content-Security-Policy** — only self-hosted code, the Firebase SDK, Google
  Fonts, and the QR image service may load. Inline scripts, `eval`, plugins, and
  framing are blocked.
- **Strict-Transport-Security**, **X-Content-Type-Options**,
  **X-Frame-Options**, **Referrer-Policy**, **Permissions-Policy**, and
  **Cross-Origin-Opener-Policy**.

## Security model

A Firebase **web** config (`apiKey`, `projectId`, etc.) is not a password. It
must be downloaded by the browser to talk to Firestore, so it is always visible
in DevTools on a live static site. Hiding it completely would require routing
all database access through a backend (for example Cloud Functions), which this
demo does not do.

What this project does instead:

1. **Config stays out of Git** — `firebase-config.js` is git-ignored, and the
   repository history was rewritten so the key is not stored there.
2. **Deny by default** — unknown collections are inaccessible, and every rule
   is explicit about what it allows.
3. **Authentication required** — every read and write requires
   `request.auth != null`.
4. **Staff authorization** — deleting data, resetting tables, and reading or
   writing `daily_metrics` require a signed-in user with a matching
   `staff/{uid}` document. Anonymous diners cannot reach those operations.
5. **Strict validation** — rules whitelist field names, check types, enforce
   document IDs, and limit string/list sizes. Oversized or malformed writes are
   rejected.
6. **XSS hardening** — no inline `<script>` blocks or `on*` attributes; all
   Firestore and URL-derived values are escaped or validated before rendering.
7. **App Check (recommended)** — set `appCheckSiteKey` in
   `firebase-config.js`, register the app in Firebase App Check with reCAPTCHA
   v3, then enforce App Check for Firestore. This blocks traffic that does not
   come from your registered sites.
8. **API key restrictions (do this)** — in **Google Cloud Console → APIs &
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
| `tables/{tableId}` | Authenticated | Diners may only set `Ordering`; staff may set any valid status |
| `tables/{tableId}/diners/{dinerId}` | Authenticated | Create/update with validated fields; delete is staff-only |
| `tables/{tableId}/orders/{orderId}` | Authenticated | Create/update with validated fields; delete is staff-only |
| `staff/{staffId}` | Only the signed-in user's own document | Denied (managed manually in the console) |
| `daily_metrics/{YYYY-MM-DD}` | Staff only | Staff only; no deletes |
| Anything else | Denied | Denied |

### Limitations

- Anonymous authentication proves a client is genuine, not that it is a
  specific diner. Any visitor who loads the demo can read demo table data and
  place demo orders, subject to the rules above. They cannot delete data, reset
  tables, or read revenue.
- The "payments" in this project are simulated in the browser. No payment
  provider is integrated, and no real money moves.
- The Firebase web API key is visible in the browser by design. Restrict it in
  Google Cloud and enable App Check as described above.
- Staff membership is managed manually in the Firebase Console. A production
  system would use custom claims and an admin workflow.

## Disclaimer

KiraSync is a **fictional demo**. The restaurant, menu, prices, staff, guests,
receipts, and transactions shown are examples only. Nothing in this repository
is a real product, service, or commercial offering. Do not use it to process
real payments or personal data.

## License

This project is provided for educational and portfolio purposes. Add a license
of your choice before redistributing.
