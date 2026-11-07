import {
    resetTable,
    listenToAllTables,
    listenToDailyMetrics,
    bankTableRevenue,
    startStaffSession,
    endStaffSession,
    onAuthChange,
    isStaffUser
} from './firebase-sync.js';

const RESTAURANT_NAME = 'KiraBistro';
const BASE_URL = 'https://kirasynchro.web.app/diner';
const TABLE_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const ALLOWED_STATUSES = ['Available', 'Ordering', 'Seated', 'Payment Pending', 'Fully Paid', 'Paid', 'Cleaning'];

let globalTablesState = Object.create(null);
let dashboardStarted = false;
let stopListeners = [];

/* ==========================================================================
   SAFETY HELPERS
   Firestore data is untrusted. Escape it before inserting into HTML and
   coerce numbers before formatting.
   ========================================================================== */
function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
}
const escapeAttr = escapeHtml;

function asNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
}

function safeTableId(value) {
    const text = String(value == null ? '' : value);
    return TABLE_ID_PATTERN.test(text) ? text : null;
}

function safeStatus(value) {
    const text = String(value == null ? '' : value);
    return ALLOWED_STATUSES.includes(text) ? text : 'Active';
}

/* The table status is only a hint from the diner app. The dashboard derives
   "Fully Paid" from the guests' payment flags, so an anonymous diner cannot
   mark a table as settled by writing the table document alone. */
function effectiveStatus(data) {
    const diners = data && Array.isArray(data.diners) ? data.diners : [];
    if (diners.length > 0 && diners.every(d => d.hasPaid === true)) {
        return 'Fully Paid';
    }
    return safeStatus(data ? data.status : undefined);
}

/* ==========================================================================
   ANIMATION UTILITY: Triggers a pulse effect when a metric updates
   ========================================================================== */
function animateMetric(elementId, newValue) {
    const el = document.getElementById(elementId);
    if (el.innerText !== String(newValue)) {
        el.classList.remove('updated');
        void el.offsetWidth; // Trigger DOM reflow to restart animation
        el.innerText = newValue;
        el.classList.add('updated');
    }
}

/* ==========================================================================
   THEME ENGINE
   ========================================================================== */
const themeBtn = document.getElementById('themeToggleBtn');
const body = document.body;

if (localStorage.getItem('kiraTheme') === 'light') {
    body.classList.add('light-theme');
    themeBtn.innerText = '🌙';
}

themeBtn.addEventListener('click', () => {
    body.classList.toggle('light-theme');
    const isLight = body.classList.contains('light-theme');
    localStorage.setItem('kiraTheme', isLight ? 'light' : 'dark');
    themeBtn.innerText = isLight ? '🌙' : '☀️';
});

/* ==========================================================================
   STAFF AUTHENTICATION GATE
   The dashboard is only mounted for a signed-in staff account whose UID has
   a matching staff/{uid} document. Firestore rules enforce the same check.
   ========================================================================== */
const loginView = document.getElementById('staffLogin');
const dashboardRoot = document.getElementById('dashboardRoot');
const loginForm = document.getElementById('staffLoginForm');
const loginError = document.getElementById('staffLoginError');
const loginButton = document.getElementById('staffLoginBtn');
const signOutBtn = document.getElementById('signOutBtn');

function setLoginMessage(message) {
    if (loginError) loginError.textContent = message || '';
}

function showLogin(message) {
    if (dashboardRoot) dashboardRoot.hidden = true;
    if (loginView) loginView.hidden = false;
    setLoginMessage(message);
}

function stopDashboard() {
    stopListeners.forEach((stop) => {
        try { stop(); } catch (error) { /* already stopped */ }
    });
    stopListeners = [];
    dashboardStarted = false;
    globalTablesState = Object.create(null);
    if (dashboardRoot) dashboardRoot.hidden = true;
}

function startDashboard() {
    if (dashboardStarted) return;
    dashboardStarted = true;
    if (loginView) loginView.hidden = true;
    if (dashboardRoot) dashboardRoot.hidden = false;
    setLoginMessage('');

    stopListeners.push(listenToDailyMetrics(renderDailyMetrics));
    stopListeners.push(listenToAllTables(renderFloorPlan));
}

/* ==========================================================================
   DAILY METRICS & TRANSACTIONS LISTENER
   ========================================================================== */
function renderDailyMetrics(collectedAmount, transactions) {
    animateMetric('metric-collected', `RM ${asNumber(collectedAmount).toFixed(2)}`);

    const txList = document.getElementById('transactionsList');
    if (!transactions || transactions.length === 0) {
        txList.innerHTML = `<p class="text-muted">No transactions recorded yet today.</p>`;
        return;
    }

    const sortedTx = [...transactions].reverse();
    let html = '';

    sortedTx.forEach((tx, index) => {
        // Apply subtle delay to transaction list items so they cascade in
        const delay = Math.min(index + 1, 5);
        html += `
            <div class="glass-panel flex-between animate-slide-up delay-${delay}" style="padding: 15px;">
                <div>
                    <div style="font-weight: 500; font-size: 16px;">Table ${escapeHtml(tx.tableId)} Settled</div>
                    <div style="font-size: 12px; margin-top: 4px;" class="text-muted">${escapeHtml(tx.time)} • Ref: ${escapeHtml(tx.id)}</div>
                </div>
                <div style="color: var(--success); font-weight: 600; font-size: 18px;">+ RM ${asNumber(tx.amount).toFixed(2)}</div>
            </div>
        `;
    });
    txList.innerHTML = html;
}

/* ==========================================================================
   DASHBOARD STATE & METRICS CALCULATION
   ========================================================================== */
function renderFloorPlan(tables) {
    globalTablesState = tables;
    let activeCount = 0, guestCount = 0, orderCount = 0, revenue = 0;
    const grid = document.getElementById('floorPlan');

    let newHtml = '';

    if (Object.keys(tables).length === 0) {
        grid.innerHTML = `<p class="text-muted animate-slide-up delay-5" style="padding: 20px;">No active tables found. Open a diner session to populate data.</p>`;
        animateMetric('metric-tables', '0');
        animateMetric('metric-guests', '0');
        animateMetric('metric-orders', '0');
        animateMetric('metric-revenue', 'RM 0.00');
        return;
    }

    // Stagger counter for table cards
    let cardIndex = 1;

    for (const [tableId, data] of Object.entries(tables)) {
        const id = safeTableId(tableId);
        if (!id) continue;

        const diners = Array.isArray(data.diners) ? data.diners : [];
        const orders = Array.isArray(data.orders) ? data.orders : [];
        const status = effectiveStatus(data);
        if (status === 'Available') continue;

        if (status !== 'Fully Paid') activeCount++;
        guestCount += diners.length;
        orderCount += orders.length;

        let tableTotal = 0;
        orders.forEach(o => tableTotal += asNumber(o.price));

        const taxAndSc = tableTotal * 0.06;
        const grandTotal = tableTotal + taxAndSc;

        if (status === 'Fully Paid') revenue += grandTotal;

        let statusColor = status === 'Fully Paid' ? 'var(--success)' :
                          status === 'Ordering' ? '#FF9500' : 'var(--text-main)';

        const animDelay = Math.min(cardIndex + 5, 5); // caps delay class at delay-5

        newHtml += `
            <div class="glass-panel table-card-hover animate-slide-up delay-${animDelay}" data-table-id="${escapeAttr(id)}" style="border-top: 3px solid ${statusColor}; cursor: pointer;">
                <div class="flex-between" style="margin-bottom:15px;">
                    <h3 style="margin:0;">Table ${escapeHtml(id)}</h3>
                    <span class="badge" style="background: var(--bg-color); border: 1px solid var(--border-light);">${escapeHtml(status)}</span>
                </div>
                <div class="flex-between text-muted" style="margin-bottom: 5px;">
                    <span>Guests: ${diners.length}</span>
                    <span>Orders: ${orders.length}</span>
                </div>
                <div class="flex-between" style="margin-bottom: 15px;">
                    <span class="text-muted">Est. Total:</span>
                    <strong style="color:var(--accent-brass);">RM ${grandTotal.toFixed(2)}</strong>
                </div>
                <button class="btn btn-outline reset-table-btn" data-table="${escapeAttr(id)}" style="padding: 8px; font-size: 13px; width: 100%;">Reset Table for Next Group</button>
            </div>
        `;
        cardIndex++;
    }

    grid.innerHTML = newHtml;

    // Route metrics through the animation function
    animateMetric('metric-tables', activeCount);
    animateMetric('metric-guests', guestCount);
    animateMetric('metric-orders', orderCount);
    animateMetric('metric-revenue', `RM ${revenue.toFixed(2)}`);
}

/* ==========================================================================
   TABLE CLICK DELEGATION
   ========================================================================== */
document.getElementById('floorPlan').addEventListener('click', async (e) => {
    if (!dashboardStarted) return;

    if (e.target.classList.contains('reset-table-btn')) {
        const tableId = safeTableId(e.target.getAttribute('data-table'));
        if (!tableId) return;

        if (confirm(`Are you sure you want to clear Table ${tableId} for a new group?`)) {
            const data = globalTablesState[tableId];
            if (data && effectiveStatus(data) === 'Fully Paid') {
                let tableTotal = 0;
                if (data.orders) {
                    data.orders.forEach(o => tableTotal += asNumber(o.price));
                }
                const grandTotal = tableTotal + (tableTotal * 0.06);
                try {
                    await bankTableRevenue(tableId, grandTotal);
                } catch (error) {
                    console.error("[Sync] Could not bank revenue:", error);
                }
            }
            try {
                await resetTable(tableId);
            } catch (error) {
                console.error("[Sync] Could not reset table:", error);
            }
        }
        return;
    }

    const card = e.target.closest('.glass-panel');
    if (card) {
        const tableId = safeTableId(card.getAttribute('data-table-id'));
        if (tableId) openTableDetails(tableId);
    }
});

/* ==========================================================================
   DETAIL INSPECTOR UI LOGIC
   ========================================================================== */
const detailOverlay = document.getElementById('detailOverlay');
const detailSheet = document.getElementById('detailSheet');

function openTableDetails(tableId) {
    const data = globalTablesState[tableId];
    if (!data) return;

    document.getElementById('detailTableTitle').innerText = `Table ${tableId} Details`;
    let html = `<div style="margin-bottom: 25px;"><h3 style="color: var(--accent-brass); margin-bottom: 15px; font-size: 18px;">Guest Payment Status</h3>`;

    if (data.diners && data.diners.length > 0) {
        data.diners.forEach(d => {
            html += `
                <div class="flex-between" style="margin-bottom: 10px; background: var(--bg-color); padding: 12px; border-radius: 8px; border: 1px solid var(--border-light);">
                    <div>
                        <div style="font-weight: 500; font-size: 15px; color: var(--text-main);">${escapeHtml(d.name)}</div>
                        ${d.hasPaid ? `<div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">Ref: ${escapeHtml(d.paymentRef)}</div>` : ``}
                    </div>
                    <div style="text-align:right;">
                        ${d.hasPaid ? `<span class="badge paid" style="font-size: 10px;">PAID via ${escapeHtml(d.paymentMethod)}</span>` : `<span class="badge pending" style="color:#FF9500; font-size: 10px;">PENDING</span>`}
                        ${d.finalTotal ? `<div style="margin-top: 6px; color: var(--text-main); font-weight: 600;">RM ${asNumber(d.finalTotal).toFixed(2)}</div>` : ``}
                    </div>
                </div>
            `;
        });
    } else {
        html += `<p class="text-muted">No guests seated.</p>`;
    }

    html += `</div><div><h3 style="color: var(--accent-brass); margin-bottom: 15px; font-size: 18px;">Ordered Items</h3>`;

    if (data.orders && data.orders.length > 0) {
        data.orders.forEach(o => {
            const sharedIds = Array.isArray(o.sharedBy) ? o.sharedBy : [];
            const sharedNames = sharedIds.map(dId => {
                const diner = data.diners.find(d => d.id === dId);
                return diner ? escapeHtml(diner.name) : 'Unknown';
            }).join(', ');

            html += `
                <div class="flex-between text-muted" style="margin-bottom: 10px; font-size: 14px; background: var(--bg-color); padding: 12px; border-radius: 8px; border: 1px solid var(--border-light);">
                    <div>
                        <div style="color: var(--text-main); font-weight: 500;">${escapeHtml(o.name)}</div>
                        <div style="font-size: 12px; margin-top: 4px;">Shared by: ${sharedNames}</div>
                    </div>
                    <div style="color: var(--text-main); font-weight: 500;">RM ${asNumber(o.price).toFixed(2)}</div>
                </div>
            `;
        });
    } else {
        html += `<p class="text-muted">No items ordered yet.</p>`;
    }

    html += `</div>`;
    document.getElementById('detailContent').innerHTML = html;

    detailOverlay.classList.add('active');
    detailSheet.classList.add('active');
}

document.getElementById('closeDetailBtn').addEventListener('click', () => {
    detailOverlay.classList.remove('active');
    detailSheet.classList.remove('active');
});
detailOverlay.addEventListener('click', () => {
    detailOverlay.classList.remove('active');
    detailSheet.classList.remove('active');
});

/* ==========================================================================
   QR GENERATOR ENGINE
   ========================================================================== */
const qrOverlay = document.getElementById('qrOverlay');
const qrSheet = document.getElementById('qrSheet');

document.getElementById('openQrPanelBtn').addEventListener('click', () => {
    qrOverlay.classList.add('active');
    qrSheet.classList.add('active');
});
document.getElementById('closeQrBtn').addEventListener('click', () => {
    qrOverlay.classList.remove('active');
    qrSheet.classList.remove('active');
});
qrOverlay.addEventListener('click', () => {
    qrOverlay.classList.remove('active');
    qrSheet.classList.remove('active');
});
document.getElementById('printQrBtn').addEventListener('click', () => {
    if (!dashboardStarted) return;

    const rawVal = document.getElementById('qrTableInput').value;
    const parsed = Number.parseInt(rawVal, 10);
    const tableNumber = Number.isFinite(parsed) ? Math.min(999, Math.max(1, parsed)) : 1;
    const tableNum = String(tableNumber).padStart(2, '0');
    const targetUrl = `${BASE_URL}?restaurant=${encodeURIComponent(RESTAURANT_NAME)}&table=${encodeURIComponent(tableNum)}`;

    document.getElementById('printTableNum').innerText = tableNum;
    const container = document.getElementById('qrContainer');
    container.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(targetUrl)}" alt="Table QR Code" style="width:220px; height:220px; border-radius:12px; background:#fff; padding:10px;">`;

    qrOverlay.classList.remove('active');
    qrSheet.classList.remove('active');
    setTimeout(() => { window.print(); }, 400);
});

/* ==========================================================================
   AUTH FLOW
   ========================================================================== */
loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    setLoginMessage('');

    const email = document.getElementById('staffEmail').value.trim();
    const password = document.getElementById('staffPassword').value;

    if (loginButton) loginButton.disabled = true;
    try {
        await startStaffSession(email, password);
        loginForm.reset();
    } catch (error) {
        console.error("[Auth] Staff sign-in failed:", error);
        setLoginMessage('Sign-in failed. Check your staff email and password.');
    } finally {
        if (loginButton) loginButton.disabled = false;
    }
});

if (signOutBtn) {
    signOutBtn.addEventListener('click', async () => {
        stopDashboard();
        try {
            await endStaffSession();
        } catch (error) {
            console.error("[Auth] Sign-out failed:", error);
        }
        showLogin('');
    });
}

onAuthChange(async (user) => {
    if (!user || user.isAnonymous) {
        stopDashboard();
        // Preserve any sign-in error that was just shown.
        showLogin(loginError ? loginError.textContent : '');
        return;
    }

    try {
        const staff = await isStaffUser(user);
        if (!staff) {
            await endStaffSession();
            stopDashboard();
            showLogin('This account does not have staff access.');
            return;
        }
        startDashboard();
    } catch (error) {
        console.error("[Auth] Could not verify staff access:", error);
        stopDashboard();
        showLogin('Could not verify staff access. Please sign in again.');
    }
});

showLogin('');
