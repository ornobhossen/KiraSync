// IMPORT FIREBASE v10 MODULAR SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-auth.js";
import { initializeAppCheck, ReCaptchaV3Provider } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-app-check.js";
import { getFirestore, doc, setDoc, updateDoc, onSnapshot, collection, collectionGroup, query, getDocs, deleteDoc, increment, arrayUnion } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";

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

/* Every Firestore operation waits for this promise. The security rules
   require request.auth != null, so anonymous sign-in must finish first. */
export const authReady = signInAnonymously(auth).then((credential) => credential.user);

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
    const tableRef = doc(db, "tables", tableId);
    await setDoc(tableRef, { status, updatedAt: new Date().toISOString() }, { merge: true });
}

/* --------------------------------------------------------------------------
   DINERS
   -------------------------------------------------------------------------- */
export async function addDiner(tableId, diner) {
    await authReady;
    const dinerRef = doc(db, "tables", tableId, "diners", diner.id);
    await setDoc(dinerRef, { ...diner, tableId }, { merge: true });
}

export async function updateDiner(tableId, dinerId, patch) {
    await authReady;
    const dinerRef = doc(db, "tables", tableId, "diners", dinerId);
    try {
        await updateDoc(dinerRef, { ...patch, updatedAt: new Date().toISOString() });
    } catch (err) {
        await setDoc(dinerRef, { ...patch, updatedAt: new Date().toISOString() }, { merge: true });
    }
}

/* --------------------------------------------------------------------------
   ORDERS
   -------------------------------------------------------------------------- */
export async function addOrder(tableId, order) {
    await authReady;
    const orderRef = doc(db, "tables", tableId, "orders", order.id);
    await setDoc(orderRef, { ...order, tableId }, { merge: true });
}

/* --------------------------------------------------------------------------
   RESET TABLE (clear diners + orders for the next group)
   -------------------------------------------------------------------------- */
export async function resetTable(tableId) {
    await authReady;
    await setTableStatus(tableId, 'Available');
    const dinersSnap = await getDocs(collection(db, "tables", tableId, "diners"));
    const ordersSnap = await getDocs(collection(db, "tables", tableId, "orders"));
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

    function emit() {
        if (active) callback({ status, diners, orders });
    }

    authReady.then(() => {
        if (!active) return;

        unsubscribers.push(
            onSnapshot(doc(db, "tables", tableId), (snap) => {
                status = snap.exists() ? (snap.data().status || null) : null;
                emit();
            }),
            onSnapshot(query(collection(db, "tables", tableId, "diners")), (snap) => {
                diners = [];
                snap.forEach(d => diners.push(d.data()));
                emit();
            }),
            onSnapshot(query(collection(db, "tables", tableId, "orders")), (snap) => {
                orders = [];
                snap.forEach(o => orders.push(o.data()));
                emit();
            })
        );
    }).catch((error) => {
        console.error("[Auth] Anonymous sign-in failed. Enable the Anonymous provider in Firebase Authentication.", error);
    });

    return () => {
        active = false;
        unsubscribers.forEach(unsubscribe => unsubscribe());
        unsubscribers.length = 0;
    };
}

/* Listen to every table (restaurant dashboard). Composes everything live. */
export function listenToAllTables(callback) {
    const statuses = {};
    const dinersByTable = {};
    const ordersByTable = {};
    let active = true;
    const unsubscribers = [];

    function emitAll() {
        if (!active) return;
        const tables = {};
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
                    statuses[docSnap.id] = docSnap.data().status || 'Active';
                });
                emitAll();
            }),
            onSnapshot(collectionGroup(db, "diners"), (snap) => {
                for (const key in dinersByTable) delete dinersByTable[key];
                snap.forEach(d => {
                    const t = d.data().tableId;
                    if (!t) return;
                    if (!dinersByTable[t]) dinersByTable[t] = [];
                    dinersByTable[t].push(d.data());
                });
                emitAll();
            }),
            onSnapshot(collectionGroup(db, "orders"), (snap) => {
                for (const key in ordersByTable) delete ordersByTable[key];
                snap.forEach(o => {
                    const t = o.data().tableId;
                    if (!t) return;
                    if (!ordersByTable[t]) ordersByTable[t] = [];
                    ordersByTable[t].push(o.data());
                });
                emitAll();
            })
        );
    }).catch((error) => {
        console.error("[Auth] Anonymous sign-in failed. Enable the Anonymous provider in Firebase Authentication.", error);
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
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const docRef = doc(db, "daily_metrics", today);

    // Create a transaction receipt object
    const transactionRecord = {
        id: `txn-${Date.now()}`,
        tableId: tableId,
        amount: amount,
        time: d.toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' })
    };

    try {
        await setDoc(docRef, {
            collected: increment(amount),
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
                // Pass both the total collected AND the array of transactions
                callback(data.collected || 0, data.transactions || []);
            } else {
                callback(0, []);
            }
        });
    }).catch((error) => {
        console.error("[Auth] Anonymous sign-in failed. Enable the Anonymous provider in Firebase Authentication.", error);
    });

    return () => {
        active = false;
        unsubscribe();
    };
}
