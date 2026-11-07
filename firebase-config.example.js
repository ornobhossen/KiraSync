// EXAMPLE Firebase configuration for KiraSync.
//
// 1. Copy this file to firebase-config.js:
//      Copy-Item firebase-config.example.js firebase-config.js   (PowerShell)
//      cp firebase-config.example.js firebase-config.js          (macOS/Linux)
// 2. Replace the placeholder values with the ones from:
//      Firebase Console > Project settings > Your apps > Web app
// 3. Never commit firebase-config.js. It is already listed in .gitignore.
//
// NOTE: a Firebase web config is not a password. It is delivered to every
// browser that loads the app, so the real protection comes from Firestore
// security rules, Firebase App Check, and API key restrictions in Google Cloud.
export const firebaseConfig = {
  apiKey: "YOUR_FIREBASE_WEB_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"

  // Optional: reCAPTCHA v3 site key for App Check (safe to expose).
  // appCheckSiteKey: "YOUR_RECAPTCHA_V3_SITE_KEY"
};
