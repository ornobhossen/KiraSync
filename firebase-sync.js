// IMPORT FIREBASE v10 MODULAR SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInAnonymously, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-auth.js";
import { initializeAppCheck, ReCaptchaV3Provider } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-app-check.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot, collection, collectionGroup, getDocs, deleteDoc, increment, arrayUnion } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";

// The config is kept in a git-ignored local file.
// Copy firebase-config.example.js to firebase-config.js and fill it in.
import { firebaseConfig } from "./firebase-config.js";

/* ==========================================================================
   FIREBASE INITIALISATION
   ========================================================================== */
const app = initializeApp(firebaseConfig);

// App Check is optional but recommended. Set appCheckSiteKey in
// firebase-config.js, then enforce App Check for Firestore in the console.
if (firebaseConfig.appCheckSiteKey) {
    initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(firebaseConfig.appCheckSiteKey),
        isTokenAutoRefreshEnabled: true
    });
}

const db = getFirestore(app);
const auth = getAuth(app);

/* Resolves as soon as any authenticated user exists: an anonymous diner or a
   signed-in staff member. The security rules reject every request without
   request.auth, so all data operations wait for this promise. */
export const authReady = new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
        if (user) {
            unsubscribe();
            resolve(user);
        }
    }, reject);
});

/* Diner pages: create or reuse an anonymous session. */
export function startAnonymousSession() {
    if (auth.currentUser) return Promise.resolve(auth.currentUser);
    return signInAnonymously(auth).then((credential) => credential.user);
}

/* Staff dashboard: sign in with email/password and verify staff access.
   The staff/{uid} document is created manually in the Firebase Console; the
   rules only allow reading your own staff document, never writing it. */
export async function startStaffSession(email, password) {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    const staffSnap = await getDoc(doc(db, "staff", credential.user.uid));
    if (!staffSnap.exists()) {
        await signOut(auth);
        throw new Error("This account does not have staff access.");
    }
    return credential.user;
}

export function endStaffSession() {
    return signOut(auth);
}

export function onAuthChange(callback) {
    return onAuthStateChanged(auth, callback);
}

export async function isStaffUser(user = auth.currentUser) {
    if (!user || user.isAnonymous) return false;
    const staffSnap = await getDoc(doc(db, "staff", user.uid));
    return staffSnap.exists();
}

/* ==========================================================================
   INPUT AND DATA NORMALISATION
   Firestore documents are untrusted input. Normalise them before they reach
   the UI so malformed or malicious data cannot break rendering or inject
   markup. The UI must still escape everything it inserts into HTML.
   ========================================================================== */
const TABLE_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const DOC_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

function assertTableId(tableId) {
    const value = String(tableId ?? '');
    if (!TABLE_ID_PATTERN.test(value)) throw new Error("Invalid table ID");
    return value;
}

function assertDocId(docId) {
    const value = String(docId ?? '');
    if (!DOC_ID_PATTERN.test(value)) throw new Error("Invalid document ID");
    return value;
}

function toText(value) {
    return value == null ? '' : String(value);
}

function toNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
}

function normalizeDiner(raw = {}) {
    return {
        id: toText(raw.id),
        name: toText(raw.name),
        initial: toText(raw.initial),
        hasPaid: raw.hasPaid === true,
        tableId: toText(raw.tableId),
        updatedAt: toText(raw.updatedAt),
        finalTotal: toNumber(raw.finalTotal),
        paymentMethod: toText(raw.paymentMethod),
        paymentRef: toText(raw.paymentRef)
    };
}

function normalizeOrder(raw = {}) {
    return {
        id: toText(raw.id),
        itemId: toText(raw.itemId),
        name: toText(raw.name),
        price: toNumber(raw.price),
        sharedBy: Array.isArray(raw.sharedBy) ? raw.sharedBy.map(toText) : [],
        status: toText(raw.status),
        tableId: toText(raw.tableId)
    };
}

function normalizeTransaction(raw = {}) {
    return {
        id: toText(raw.id),
        tableId: toText(raw.tableId),
        amount: toNumber(raw.amount),
        time: toText(raw.time)
    };
}

/* ==========================================================================
   DATA MODEL
   Each diner and each order is written as its OWN document inside the table:
     tables/{tableId}/diners/{dinerId}
     tables/{tableId}/orders/{orderId}
   Concurrent diners can add/edit their own docs without clobbering others.
   ========================================================================== */

/* --------------------------------------------------------------------------
   TABLE STATUS
   -------------------------------------------------------------------------- */
export async function setTableStatus(tableId, status) {
    await authReady;
    const id = assertTableId(tableId);
    const tableRef = doc(db, "tables", id);
    await setDoc(tableRef, { status: toText(status), updatedAt: new Date().toISOString() }, { merge: true });
}

/* --------------------------------------------------------------------------
   DINERS
   -------------------------------------------------------------------------- */
export async function addDiner(tableId, diner) {
    await authReady;
    const table = assertTableId(tableId);
    const record = normalizeDiner({ ...diner, tableId: table });
    const dinerRef = doc(db, "tables", table, "diners", assertDocId(record.id));
    await setDoc(dinerRef, record, { merge: true });
}

const DINER_PATCH_KEYS = ['name', 'initial', 'hasPaid', 'finalTotal', 'paymentMethod', 'paymentRef'];

export async function updateDiner(tableId, dinerId, patch) {
    await authReady;
    const table = assertTableId(tableId);
    const id = assertDocId(dinerId);
    const dinerRef = doc(db, "tables", table, "diners", id);

    const clean = {};
    for (const key of DINER_PATCH_KEYS) {
        if (!(key in (patch || {}))) continue;
        if (key === 'hasPaid') clean.hasPaid = patch.hasPaid === true;
        else if (key === 'finalTotal') clean.finalTotal = toNumber(patch.finalTotal);
        else clean[key] = toText(patch[key]);
    }
    clean.updatedAt = new Date().toISOString();

    await updateDoc(dinerRef, clean);
}

/* --------------------------------------------------------------------------
   ORDERS
   -------------------------------------------------------------------------- */
export async function addOrder(tableId, order) {
    await authReady;
    const table = assertTableId(tableId);
    const record = normalizeOrder({ ...order, tableId: table });
    const orderRef = doc(db, "tables", table, "orders", assertDocId(record.id));
    await setDoc(orderRef, record, { merge: true });
}

/* --------------------------------------------------------------------------
   RESET TABLE (clear diners + orders for the next group; staff only)
   -------------------------------------------------------------------------- */
export async function resetTable(tableId) {
    await authReady;
    const table = assertTableId(tableId);
    await setTableStatus(table, 'Available');
    const dinersSnap = await getDocs(collection(db, "tables", table, "diners"));
    const ordersSnap = await getDocs(collection(db, "tables", table, "orders"));
    await Promise.all([
        ...dinersSnap.docs.map(d => deleteDoc(d.ref)),
        ...ordersSnap.docs.map(d => deleteDoc(d.ref))
    ]);
}

/* ==========================================================================
   LIVE LISTENERS
   ========================================================================== */

/* Listen to one table (diner page). Composes table status + subcollections. */
export function listenToTable(tableId, callback) {
    let status = null;
    let diners = [];
    let orders = [];
    let active = true;
    const unsubscribers = [];
    let table;

    function emit() {
        if (active) callback({ status, diners, orders });
    }

    try {
        table = assertTableId(tableId);
    } catch (error) {
        console.error("[Sync] Refusing to listen to an invalid table ID.", error);
        callback({ status: null, diners: [], orders: [] });
        return () => {};
    }

    authReady.then(() => {
        if (!active) return;

        unsubscribers.push(
            onSnapshot(doc(db, "tables", table), (snap) => {
                status = snap.exists() ? (toText(snap.data().status) || null) : null;
                emit();
            }),
            onSnapshot(collection(db, "tables", table, "diners"), (snap) => {
                diners = [];
                snap.forEach(d => diners.push(normalizeDiner({ ...d.data(), id: toText(d.data().id) || d.id })));
                emit();
            }),
            onSnapshot(collection(db, "tables", table, "orders"), (snap) => {
                orders = [];
                snap.forEach(o => orders.push(normalizeOrder({ ...o.data(), id: toText(o.data().id) || o.id })));
                emit();
            })
        );
    }).catch((error) => {
        console.error("[Auth] Sign-in failed. Enable the Anonymous provider in Firebase Authentication.", error);
    });

    return () => {
        active = false;
        unsubscribers.forEach(unsubscribe => unsubscribe());
        unsubscribers.length = 0;
    };
}

/* Listen to every table (restaurant dashboard). Composes everything live. */
export function listenToAllTables(callback) {
    const statuses = Object.create(null);
    const dinersByTable = Object.create(null);
    const ordersByTable = Object.create(null);
    let active = true;
    const unsubscribers = [];

    function emitAll() {
        if (!active) return;
        const tables = Object.create(null);
        for (const tableId in statuses) {
            tables[tableId] = {
                status: statuses[tableId] || 'Active',
                diners: (dinersByTable[tableId] || []).slice().sort((a, b) => a.id.localeCompare(b.id)),
                orders: (ordersByTable[tableId] || []).slice().sort((a, b) => a.id.localeCompare(b.id))
            };
        }
        callback(tables);
    }

    authReady.then(() => {
        if (!active) return;

        unsubscribers.push(
            onSnapshot(collection(db, "tables"), (snap) => {
                for (const key in statuses) delete statuses[key];
                snap.forEach(docSnap => {
                    const id = toText(docSnap.id);
                    if (!TABLE_ID_PATTERN.test(id)) return;
                    statuses[id] = toText(docSnap.data().status) || 'Active';
                });
                emitAll();
            }),
            onSnapshot(collectionGroup(db, "diners"), (snap) => {
                for (const key in dinersByTable) delete dinersByTable[key];
                snap.forEach(d => {
                    const t = toText(d.data().tableId);
                    if (!TABLE_ID_PATTERN.test(t)) return;
                    if (!dinersByTable[t]) dinersByTable[t] = [];
                    dinersByTable[t].push(normalizeDiner({ ...d.data(), id: toText(d.data().id) || d.id }));
                });
                emitAll();
            }),
            onSnapshot(collectionGroup(db, "orders"), (snap) => {
                for (const key in ordersByTable) delete ordersByTable[key];
                snap.forEach(o => {
                    const t = toText(o.data().tableId);
                    if (!TABLE_ID_PATTERN.test(t)) return;
                    if (!ordersByTable[t]) ordersByTable[t] = [];
                    ordersByTable[t].push(normalizeOrder({ ...o.data(), id: toText(o.data().id) || o.id }));
                });
                emitAll();
            })
        );
    }).catch((error) => {
        console.error("[Auth] Sign-in failed. Enable the Anonymous provider in Firebase Authentication.", error);
    });

    return () => {
        active = false;
        unsubscribers.forEach(unsubscribe => unsubscribe());
        unsubscribers.length = 0;
    };
}

/* ==========================================================================
   DAILY REVENUE & TRANSACTION LEDGER
   ========================================================================== */
export async function bankTableRevenue(tableId, amount) {
    await authReady;
    const table = assertTableId(tableId);
    const value = Math.round(toNumber(amount) * 100) / 100;
    if (!Number.isFinite(value) || value <= 0 || value > 1000000) return;

    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const docRef = doc(db, "daily_metrics", today);

    // Create a transaction receipt object
    const transactionRecord = {
        id: `txn-${Date.now()}`,
        tableId: table,
        amount: value,
        time: d.toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' })
    };

    try {
        await setDoc(docRef, {
            collected: increment(value),
            transactions: arrayUnion(transactionRecord)
        }, { merge: true });
    } catch (error) {
        console.error("[Sync Error] Failed to bank revenue:", error);
    }
}

export function listenToDailyMetrics(callback) {
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const docRef = doc(db, "daily_metrics", today);
    let active = true;
    let unsubscribe = () => {};

    authReady.then(() => {
        if (!active) return;
        unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                const transactions = Array.isArray(data.transactions)
                    ? data.transactions.map(normalizeTransaction)
                    : [];
                callback(toNumber(data.collected), transactions);
            } else {
                callback(0, []);
            }
        });
    }).catch((error) => {
        console.error("[Auth] Sign-in failed. Staff authentication is required for revenue data.", error);
    });

    return () => {
        active = false;
        unsubscribe();
    };
}
