/* ==========================================================================
   KiraSYCN — Application Logic
   Vanilla JS. All state lives in memory for this demo/prototype.
   ========================================================================== */
(function () {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* Utilities                                                           */
  /* ------------------------------------------------------------------ */
  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));
  const fmt = (n) => 'RM ' + (Math.round(n * 100) / 100).toFixed(2);
  const uid = (prefix) => prefix + '-' + Math.random().toString(36).slice(2, 8).toUpperCase();
  const initials = (name) => (name || '?').trim().slice(0, 1).toUpperCase();

  function toast(msg) {
    const el = $('#toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('is-visible');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove('is-visible'), 2600);
  }

  /* ------------------------------------------------------------------ */
  /* Menu data (realistic sample restaurant menu)                        */
  /* ------------------------------------------------------------------ */
  const MENU = [
    { id: 'm1', cat: 'Starters', name: 'Salt & Pepper Squid', desc: 'Crisp-fried squid, chilli, lime', price: 18, emoji: '🦑' },
    { id: 'm2', cat: 'Starters', name: 'Garlic Butter Mushrooms', desc: 'Roasted button mushrooms, herb butter', price: 14, emoji: '🍄' },
    { id: 'm3', cat: 'Starters', name: 'Chicken Satay (6pc)', desc: 'Grilled skewers, peanut sauce', price: 16, emoji: '🍢' },
    { id: 'm4', cat: 'Main Courses', name: 'Grilled Salmon', desc: 'Citrus glaze, seasonal greens', price: 42, emoji: '🐟' },
    { id: 'm5', cat: 'Main Courses', name: 'Beef Rendang', desc: 'Slow-cooked, coconut spice', price: 34, emoji: '🍛' },
    { id: 'm6', cat: 'Main Courses', name: 'Nasi Lemak Set', desc: 'Coconut rice, sambal, egg, anchovies', price: 24, emoji: '🍚' },
    { id: 'm7', cat: 'Pizza', name: 'Large Pizza — Margherita', desc: 'San Marzano tomato, buffalo mozzarella', price: 32, emoji: '🍕' },
    { id: 'm8', cat: 'Pizza', name: 'Large Pizza — Pepperoni', desc: 'Double pepperoni, mozzarella, chilli oil', price: 36, emoji: '🍕' },
    { id: 'm9', cat: 'Burgers', name: 'Classic Beef Burger', desc: 'Angus beef, cheddar, house sauce', price: 22, emoji: '🍔' },
    { id: 'm10', cat: 'Burgers', name: 'Crispy Chicken Burger', desc: 'Buttermilk-fried, slaw, pickles', price: 20, emoji: '🍔' },
    { id: 'm11', cat: 'Pasta', name: 'Truffle Aglio Olio', desc: 'Garlic, chilli flakes, black truffle oil', price: 28, emoji: '🍝' },
    { id: 'm12', cat: 'Pasta', name: 'Carbonara', desc: 'Guanciale, egg yolk, pecorino', price: 26, emoji: '🍝' },
    { id: 'm13', cat: 'Chicken', name: 'Roasted Chicken Chop', desc: 'Herb-roasted, black pepper sauce', price: 24, emoji: '🍗' },
    { id: 'm14', cat: 'Chicken', name: 'Buttermilk Fried Chicken', desc: 'Two pieces, slaw, fries', price: 22, emoji: '🍗' },
    { id: 'm15', cat: 'Desserts', name: 'Molten Chocolate Cake', desc: 'Warm centre, vanilla ice cream', price: 16, emoji: '🍫' },
    { id: 'm16', cat: 'Desserts', name: 'Mango Sticky Rice', desc: 'Coconut cream, toasted sesame', price: 14, emoji: '🥭' },
    { id: 'm17', cat: 'Drinks', name: 'Fresh Lime Juice', desc: 'Calamansi, soda option', price: 8, emoji: '🍋' },
    { id: 'm18', cat: 'Drinks', name: 'Iced Latte', desc: 'Double shot, house blend', price: 10, emoji: '☕' },
    { id: 'm19', cat: 'Drinks', name: 'Sparkling Water', desc: '330ml bottle', price: 6, emoji: '💧' },
    { id: 'm20', cat: 'Drinks', name: 'Craft Lemonade', desc: 'Rosemary & citrus', price: 9, emoji: '🍹' },
  ];
  const CATEGORIES = ['All', 'Starters', 'Main Courses', 'Pizza', 'Burgers', 'Pasta', 'Chicken', 'Desserts', 'Drinks'];
  const PAYMENT_METHODS = [
    { id: 'tng', name: "Touch 'n Go", emoji: '💳' },
    { id: 'qr', name: 'QR Payment', emoji: '📱' },
    { id: 'mc', name: 'Mastercard', emoji: '💰' },
    { id: 'bigpay', name: 'BigPay', emoji: '🅱️' },
    { id: 'bank', name: 'Online Banking', emoji: '🏦' },
  ];

  /* ------------------------------------------------------------------ */
  /* Application state                                                   */
  /* ------------------------------------------------------------------ */
  const state = {
    step: 'scan', // scan | people | menu | review | payment | receipt
    restaurant: 'Kira Bistro',
    tableNumber: '05',
    sessionId: null,
    people: [],           // { id, name }
    orders: [],           // { id, itemId, mode: 'individual'|'shared', personId, sharedWith: [ids] }
    payments: {},         // personId -> { status: 'unpaid'|'processing'|'paid', method, txId, paidAt }
    fullTablePaid: false,
    menuFilter: 'All',
    menuSearch: '',
    pendingItem: null,    // item awaiting assignment
    assignMode: 'individual',
    assignPersonId: null,
    assignShared: [],
    payMode: 'individual', // individual | full
    payingTarget: null,    // personId or 'full'
    selectedMethod: null,
    processingScreen: null, // null | 'processing' | 'success'
    lastReceipt: null,
  };

  // Restaurant dashboard state — simulated multi-table environment
  const dashboardTables = {
    't01': { name: 'Table 01', status: 'Available', guests: 0, total: 0, paid: 0 },
    't02': { name: 'Table 02', status: 'Ordering', guests: 3, total: 96.5, paid: 0 },
    't08': { name: 'Table 08', status: 'Fully Paid', guests: 2, total: 64, paid: 64 },
  };
  const transactions = []; // { customer, table, amount, method, status, ref, time }

  /* ------------------------------------------------------------------ */
  /* Derived helpers                                                     */
  /* ------------------------------------------------------------------ */
  function menuItem(id) { return MENU.find((m) => m.id === id); }
  function person(id) { return state.people.find((p) => p.id === id); }

  function personBillLines(personId) {
    const lines = [];
    state.orders.forEach((o) => {
      const item = menuItem(o.itemId);
      if (!item) return;
      if (o.mode === 'individual' && o.personId === personId) {
        lines.push({ orderId: o.id, label: item.name, amount: item.price, item });
      } else if (o.mode === 'shared' && o.sharedWith.includes(personId)) {
        const share = item.price / o.sharedWith.length;
        lines.push({ orderId: o.id, label: `${item.name} (1/${o.sharedWith.length} shared)`, amount: share, item });
      }
    });
    return lines;
  }

  function personTotal(personId) {
    return personBillLines(personId).reduce((s, l) => s + l.amount, 0);
  }

  function tableTotal() {
    return state.people.reduce((s, p) => s + personTotal(p.id), 0);
  }

  function paidTotal() {
    return state.people.reduce((s, p) => {
      const pay = state.payments[p.id];
      return s + (pay && pay.status === 'paid' ? personTotal(p.id) : 0);
    }, 0);
  }

  function outstandingTotal() {
    return Math.max(0, tableTotal() - paidTotal());
  }

  function isPersonPaid(personId) {
    const pay = state.payments[personId];
    return !!(pay && pay.status === 'paid');
  }

  /* ------------------------------------------------------------------ */
  /* Screen renderers — each returns an HTML string                      */
  /* ------------------------------------------------------------------ */
  const screens = {};

  screens.scan = function () {
    return `
      <div class="dscan">
        <div class="dscan__qr">${qrSvg()}</div>
        <h2>Welcome to ${state.restaurant}</h2>
        <p>You're about to open the session for Table ${state.tableNumber}</p>
        <div class="dscan__session">${state.sessionId || `KSY-T${state.tableNumber}-DEMO`}</div>
        <button class="dbtn" id="btnScan" style="width:auto;padding:14px 30px;">Scan QR Code</button>
      </div>`;
  };

  screens.people = function () {
    const rows = state.people.map((p) => `
      <div class="person-row" data-id="${p.id}">
        <div class="person-row__avatar">${initials(p.name)}</div>
        <div class="person-row__name">${escapeHtml(p.name)}</div>
        <div class="person-row__actions">
          <button class="icon-btn" data-action="edit-person" data-id="${p.id}" aria-label="Edit name">${iconEdit()}</button>
          ${state.people.length > 1 ? `<button class="icon-btn icon-btn--danger" data-action="remove-person" data-id="${p.id}" aria-label="Remove person">${iconTrash()}</button>` : ''}
        </div>
      </div>`).join('');

    return `
      <div class="dscreen">
        <div class="dscreen__top">
          <div class="dscreen__eyebrow">TABLE ${state.tableNumber} · ${state.people.length} PEOPLE</div>
          <div class="dscreen__title">Who's at the table?</div>
        </div>
        <div class="dscreen__body">
          ${rows || `<p class="dempty">Add the first person to start the session.</p>`}
          <form class="add-person-form" id="addPersonForm">
            <input type="text" id="newPersonName" placeholder="Enter a name" maxlength="20" autocomplete="off">
            <button type="submit" class="dbtn dbtn--sm">+ Add</button>
          </form>
        </div>
        <div class="dscreen__foot">
          <button class="dbtn" id="btnToMenu" ${state.people.length === 0 ? 'disabled' : ''}>Continue to Menu</button>
        </div>
      </div>`;
  };

  screens.menu = function () {
    const filtered = MENU.filter((m) => {
      const catOk = state.menuFilter === 'All' || m.cat === state.menuFilter;
      const q = state.menuSearch.trim().toLowerCase();
      const searchOk = !q || m.name.toLowerCase().includes(q) || m.desc.toLowerCase().includes(q);
      return catOk && searchOk;
    });

    const cats = CATEGORIES.map((c) => `<button class="menu-cat ${c === state.menuFilter ? 'is-active' : ''}" data-cat="${c}">${c}</button>`).join('');

    const items = filtered.map((m) => `
      <div class="menu-item" data-item="${m.id}">
        <div class="menu-item__thumb">${m.emoji}</div>
        <div class="menu-item__info">
          <h4>${m.name}</h4>
          <p>${m.desc}</p>
          <div class="menu-item__price">${fmt(m.price)}</div>
        </div>
        <button class="menu-item__add" data-item="${m.id}" aria-label="Add ${m.name}">+</button>
      </div>`).join('');

    const orderCount = state.orders.length;

    return `
      <div class="dscreen" style="position:relative;">
        <div class="dscreen__top">
          <div class="dscreen__eyebrow">${state.people.length} PEOPLE · ${orderCount} ITEM${orderCount === 1 ? '' : 'S'} ORDERED</div>
          <div class="dscreen__title">Menu</div>
        </div>
        <div class="dscreen__body">
          <input type="text" class="menu-search" id="menuSearch" placeholder="Search the menu" value="${escapeAttr(state.menuSearch)}">
          <div class="menu-cats">${cats}</div>
          ${items || `<p class="dempty">No dishes match your search.</p>`}
        </div>
        <div class="dscreen__foot">
          <button class="dbtn" id="btnToReview" ${orderCount === 0 ? 'disabled' : ''}>Review Order (${orderCount})</button>
        </div>
        ${state.pendingItem ? renderAssignSheet() : ''}
      </div>`;
  };

  function renderAssignSheet() {
    const item = menuItem(state.pendingItem);
    if (!item) return '';
    const isShared = state.assignMode === 'shared';
    const peopleList = state.people.map((p) => {
      const selected = isShared ? state.assignShared.includes(p.id) : state.assignPersonId === p.id;
      return `
        <div class="assign-person ${selected ? 'is-selected' : ''}" data-action="pick-person" data-id="${p.id}">
          <div class="assign-person__check">${selected ? '✓' : ''}</div>
          <span>${escapeHtml(p.name)}</span>
        </div>`;
    }).join('');

    let splitInfo = '';
    if (isShared && state.assignShared.length > 0) {
      const each = item.price / state.assignShared.length;
      splitInfo = `<div class="assign-split"><span>Shared by ${state.assignShared.length} · ${fmt(item.price)}</span><strong>${fmt(each)} each</strong></div>`;
    }

    const canConfirm = isShared ? state.assignShared.length > 0 : !!state.assignPersonId;

    return `
      <div class="sheet-overlay" id="assignOverlay">
        <div class="sheet">
          <div class="sheet__handle"></div>
          <div>
            <div class="sheet__title">${item.name}</div>
            <div class="sheet__price">${fmt(item.price)} · Who is this for?</div>
          </div>
          <div class="assign-toggle">
            <button class="assign-toggle__btn ${!isShared ? 'is-active' : ''}" data-action="mode-individual">👤 Individual</button>
            <button class="assign-toggle__btn ${isShared ? 'is-active' : ''}" data-action="mode-shared">👥 Shared</button>
          </div>
          <div class="assign-people">${peopleList}</div>
          ${splitInfo}
          <button class="dbtn" id="btnConfirmAssign" ${canConfirm ? '' : 'disabled'}>Add to Order</button>
          <button class="dbtn dbtn--ghost" id="btnCancelAssign">Cancel</button>
        </div>
      </div>`;
  }

  screens.review = function () {
    const people = state.people.map((p) => {
      const lines = personBillLines(p.id);
      const total = personTotal(p.id);
      const itemsHtml = lines.map((l) => `
        <div class="review-item">
          <span>${l.label}</span>
          <span>${fmt(l.amount)}</span>
        </div>`).join('');
      return `
        <div class="review-person">
          <div class="review-person__head">
            <strong>${escapeHtml(p.name)}</strong>
            <span class="review-person__total">${fmt(total)}</span>
          </div>
          ${itemsHtml || `<div class="review-item" style="color:var(--text-low)">No items yet</div>`}
        </div>`;
    }).join('');

    return `
      <div class="dscreen">
        <div class="dscreen__top">
          <div class="dscreen__eyebrow">TABLE ${state.tableNumber} · ORDER SUMMARY</div>
          <div class="dscreen__title">Review the bill</div>
        </div>
        <div class="dscreen__body">
          ${people}
          <div class="review-total-bar">
            <span>Table total</span>
            <strong>${fmt(tableTotal())}</strong>
          </div>
        </div>
        <div class="dscreen__foot" style="display:flex;gap:8px;">
          <button class="dbtn dbtn--ghost" id="btnBackToMenu" style="flex:1;">Add More Food</button>
          <button class="dbtn" id="btnToPayment" style="flex:1;">Proceed to Pay</button>
        </div>
      </div>`;
  };

  screens.payment = function () {
    if (state.processingScreen === 'processing') return renderProcessing();
    if (state.processingScreen === 'success') return renderPaySuccess();

    const modeToggle = `
      <div class="pay-mode-toggle">
        <button class="assign-toggle__btn ${state.payMode === 'individual' ? 'is-active' : ''}" data-action="pay-mode-individual" style="flex:1;">Individual</button>
        <button class="assign-toggle__btn ${state.payMode === 'full' ? 'is-active' : ''}" data-action="pay-mode-full" style="flex:1;">Full Table</button>
      </div>`;

    let body = '';
    if (state.payMode === 'individual') {
      body = state.people.map((p) => {
        const total = personTotal(p.id);
        const paid = isPersonPaid(p.id);
        return `
          <div class="pay-person-card">
            <div>
              <div class="pay-person-card__name">${escapeHtml(p.name)}</div>
              <div class="pay-person-card__amt">${fmt(total)}</div>
            </div>
            ${paid
              ? `<span class="status status--paid">Paid</span>`
              : `<button class="dbtn dbtn--sm" data-action="start-pay" data-target="${p.id}">Pay Now</button>`}
          </div>`;
      }).join('');
    } else {
      const outstanding = outstandingTotal();
      body = `
        <div class="pay-person-card" style="flex-direction:column;align-items:flex-start;gap:12px;">
          <div>
            <div class="pay-person-card__name">Full table balance</div>
            <div class="pay-person-card__amt">Outstanding: ${fmt(outstanding)} of ${fmt(tableTotal())}</div>
          </div>
          ${outstanding <= 0
            ? `<span class="status status--paid">Fully Paid</span>`
            : `<button class="dbtn" style="width:100%;" data-action="start-pay" data-target="full">Pay Full Table — ${fmt(outstanding)}</button>`}
        </div>`;
    }

    const allPaid = state.people.every((p) => isPersonPaid(p.id)) || outstandingTotal() <= 0;

    return `
      <div class="dscreen">
        <div class="dscreen__top">
          <div class="dscreen__eyebrow">TABLE ${state.tableNumber} · PAYMENT</div>
          <div class="dscreen__title">Settle the bill</div>
        </div>
        <div class="dscreen__body">
          ${modeToggle}
          ${body}
        </div>
        <div class="dscreen__foot">
          <button class="dbtn" id="btnToReceiptOverview" ${allPaid ? '' : 'disabled'}>${allPaid ? 'View Final Receipt' : 'Waiting for payment...'}</button>
        </div>
      </div>`;
  };

  function renderMethodPicker() {
    const target = state.payingTarget;
    const amount = target === 'full' ? outstandingTotal() : personTotal(target);
    const methods = PAYMENT_METHODS.map((m) => `
      <button class="pay-method ${state.selectedMethod === m.id ? 'is-active' : ''}" data-method="${m.id}">
        <span style="font-size:1.3rem;">${m.emoji}</span>${m.name}
      </button>`).join('');

    return `
      <div class="sheet-overlay" id="methodOverlay">
        <div class="sheet">
          <div class="sheet__handle"></div>
          <div>
            <div class="sheet__title">Choose payment method</div>
            <div class="sheet__price">Amount: ${fmt(amount)}</div>
          </div>
          <div class="pay-methods">${methods}</div>
          <button class="dbtn" id="btnConfirmPay" ${state.selectedMethod ? '' : 'disabled'}>Confirm Payment</button>
          <button class="dbtn dbtn--ghost" id="btnCancelPay">Cancel</button>
        </div>
      </div>`;
  }

  function renderProcessing() {
    return `
      <div class="dscreen">
        <div class="dscreen__top">
          <div class="dscreen__eyebrow">SECURE PAYMENT</div>
          <div class="dscreen__title">Processing</div>
        </div>
        <div class="pay-processing">
          <div class="spinner"></div>
          <p style="color:var(--text-mid);font-size:0.9rem;">Confirming your payment securely…</p>
        </div>
      </div>`;
  }

  function renderPaySuccess() {
    const r = state.lastReceipt;
    if (!r) return '';
    return `
      <div class="dscreen">
        <div class="pay-success">
          <div class="pay-success__icon">✓</div>
          <div class="pay-success__amt">${fmt(r.amount)}</div>
          <div style="color:var(--text-mid);font-size:0.92rem;">Payment successful</div>
          <div class="pay-success__tx">${r.txId}</div>
          <button class="dbtn" id="btnSeeReceipt" style="width:auto;padding:12px 26px;margin-top:10px;">View Digital Receipt</button>
          <button class="dbtn dbtn--ghost" id="btnBackToPayment" style="width:auto;padding:12px 26px;">Back to Payment</button>
        </div>
      </div>`;
  }

  screens.receipt = function () {
    const r = state.lastReceipt || state._lastFinalReceipt;
    if (!r) {
      return `<div class="dscreen"><div class="dempty">No receipt yet. Complete a payment first.</div></div>`;
    }
    const itemsHtml = r.lines.map((l) => `<div class="receipt-card__row"><span>${l.label}</span><span>${fmt(l.amount)}</span></div>`).join('');
    return `
      <div class="dscreen">
        <div class="dscreen__top">
          <div class="dscreen__eyebrow">DIGITAL RECEIPT</div>
          <div class="dscreen__title">Receipt</div>
        </div>
        <div class="dscreen__body">
          <div class="receipt-card">
            <div class="receipt-card__brand">KiraSYCN</div>
            <div class="receipt-card__tag">${state.restaurant} · Table ${state.tableNumber}</div>
            <div class="receipt-card__status">PAYMENT SUCCESSFUL</div>
            <hr>
            <div class="receipt-card__row"><span>Customer</span><span>${escapeHtml(r.customer)}</span></div>
            <hr>
            ${itemsHtml}
            <hr>
            ${r.previouslyPaid ? `<div class="receipt-card__row receipt-card__row--muted"><span>Already paid by others</span><span>${fmt(r.previouslyPaid)}</span></div>` : ''}
            <div class="receipt-card__total"><span>Amount Paid</span><span>${fmt(r.amount)}</span></div>
            <div class="receipt-card__row receipt-card__row--muted"><span>Method</span><span>${r.methodName}</span></div>
            <div class="receipt-card__meta">
              ${r.txId}<br>${r.time}
            </div>
          </div>
        </div>
        <div class="dscreen__foot" style="display:flex;gap:8px;">
          <button class="dbtn dbtn--ghost" id="btnDownloadReceipt" style="flex:1;">Save Receipt</button>
          <button class="dbtn" id="btnNewSession" style="flex:1;">Start New Session</button>
        </div>
      </div>`;
  };

  /* ------------------------------------------------------------------ */
  /* Small SVG / icon helpers                                            */
  /* ------------------------------------------------------------------ */
  function qrSvg() {
    return `<svg viewBox="0 0 100 100" width="100%" height="100%">
      <g fill="currentColor">
        <rect x="6" y="6" width="24" height="24"/><rect x="12" y="12" width="12" height="12" fill="#06070a"/>
        <rect x="70" y="6" width="24" height="24"/><rect x="76" y="12" width="12" height="12" fill="#06070a"/>
        <rect x="6" y="70" width="24" height="24"/><rect x="12" y="76" width="12" height="12" fill="#06070a"/>
        <rect x="40" y="6" width="6" height="6"/><rect x="52" y="6" width="6" height="6"/><rect x="40" y="18" width="6" height="6"/>
        <rect x="40" y="40" width="6" height="6"/><rect x="52" y="40" width="6" height="6"/><rect x="64" y="40" width="6" height="6"/>
        <rect x="40" y="52" width="6" height="6"/><rect x="82" y="52" width="6" height="6"/><rect x="40" y="64" width="6" height="6"/>
        <rect x="52" y="64" width="6" height="6"/><rect x="64" y="64" width="6" height="6"/><rect x="82" y="64" width="6" height="6"/>
        <rect x="52" y="76" width="6" height="6"/><rect x="64" y="82" width="6" height="6"/><rect x="82" y="82" width="6" height="6"/>
      </g></svg>`;
  }
  function iconEdit() { return `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`; }
  function iconTrash() { return `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>`; }

  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function escapeAttr(s) { return escapeHtml(s); }

  /* ------------------------------------------------------------------ */
  /* Render loop                                                         */
  /* ------------------------------------------------------------------ */
  function render() {
    const screenEl = $('#demoScreen');
    if (screenEl) {
      let html = screens[state.step] ? screens[state.step]() : '';
      // attach method picker sheet on top of payment screen when needed
      if (state.step === 'payment' && state.payingTarget && state.processingScreen === null) {
        html += renderMethodPicker();
      }
      screenEl.innerHTML = html;
      bindScreenEvents();
    }
    renderProgress();
    renderHeroPhone();
    renderDashboard();
  }

  function renderProgress() {
    $$('.demo-progress__step').forEach((el) => {
      const s = el.dataset.step;
      const order = ['scan', 'people', 'menu', 'review', 'payment', 'receipt'];
      el.classList.toggle('is-active', s === state.step);
      el.classList.toggle('is-done', order.indexOf(s) < order.indexOf(state.step));
    });
  }

  /* ------------------------------------------------------------------ */
  /* Event binding for the demo phone                                    */
  /* ------------------------------------------------------------------ */
  function bindScreenEvents() {
    // SCAN
    const btnScan = $('#btnScan');
    if (btnScan) btnScan.addEventListener('click', () => {
      state.sessionId = uid('KSY-T' + state.tableNumber);
      if (state.people.length === 0) state.people.push({ id: uid('p'), name: 'You' });
      state.step = 'people';
      toast(`Session started — ${state.restaurant}, Table ${state.tableNumber}`);
      render();
    });

    // PEOPLE
    const addForm = $('#addPersonForm');
    if (addForm) addForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = $('#newPersonName');
      const name = input.value.trim();
      if (!name) return;
      state.people.push({ id: uid('p'), name });
      input.value = '';
      render();
      const focusInput = $('#newPersonName');
      if (focusInput) focusInput.focus();
    });
    $$('[data-action="edit-person"]').forEach((btn) => btn.addEventListener('click', () => {
      const p = person(btn.dataset.id);
      if (!p) return;
      const name = window.prompt('Edit name', p.name);
      if (name && name.trim()) { p.name = name.trim(); render(); }
    }));
    $$('[data-action="remove-person"]').forEach((btn) => btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      state.people = state.people.filter((p) => p.id !== id);
      state.orders.forEach((o) => {
        if (o.personId === id) o.personId = null;
        o.sharedWith = o.sharedWith ? o.sharedWith.filter((pid) => pid !== id) : o.sharedWith;
      });
      delete state.payments[id];
      render();
    }));
    const btnToMenu = $('#btnToMenu');
    if (btnToMenu) btnToMenu.addEventListener('click', () => { state.step = 'menu'; render(); });

    // MENU
    const menuSearch = $('#menuSearch');
    if (menuSearch) {
      menuSearch.addEventListener('input', (e) => { state.menuSearch = e.target.value; render(); setTimeout(() => { const el = $('#menuSearch'); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }, 0); });
    }
    $$('.menu-cat').forEach((btn) => btn.addEventListener('click', () => { state.menuFilter = btn.dataset.cat; render(); }));
    $$('.menu-item, .menu-item__add').forEach((el) => el.addEventListener('click', (e) => {
      const id = el.dataset.item;
      if (!id) return;
      openAssign(id);
    }));
    const btnToReview = $('#btnToReview');
    if (btnToReview) btnToReview.addEventListener('click', () => { state.step = 'review'; render(); });

    // ASSIGN SHEET
    const cancelAssign = $('#btnCancelAssign');
    if (cancelAssign) cancelAssign.addEventListener('click', closeAssign);
    const modeInd = $('[data-action="mode-individual"]');
    if (modeInd) modeInd.addEventListener('click', () => { state.assignMode = 'individual'; render(); });
    const modeShared = $('[data-action="mode-shared"]');
    if (modeShared) modeShared.addEventListener('click', () => { state.assignMode = 'shared'; render(); });
    $$('[data-action="pick-person"]').forEach((el) => el.addEventListener('click', () => {
      const id = el.dataset.id;
      if (state.assignMode === 'shared') {
        const idx = state.assignShared.indexOf(id);
        if (idx >= 0) state.assignShared.splice(idx, 1); else state.assignShared.push(id);
      } else {
        state.assignPersonId = id;
      }
      render();
    }));
    const confirmAssign = $('#btnConfirmAssign');
    if (confirmAssign) confirmAssign.addEventListener('click', () => {
      if (state.assignMode === 'individual' && state.assignPersonId) {
        state.orders.push({ id: uid('o'), itemId: state.pendingItem, mode: 'individual', personId: state.assignPersonId, sharedWith: [] });
        toast(`${menuItem(state.pendingItem).name} added for ${person(state.assignPersonId).name}`);
      } else if (state.assignMode === 'shared' && state.assignShared.length > 0) {
        state.orders.push({ id: uid('o'), itemId: state.pendingItem, mode: 'shared', personId: null, sharedWith: [...state.assignShared] });
        toast(`${menuItem(state.pendingItem).name} split ${state.assignShared.length} ways`);
      }
      closeAssign();
    });

    // REVIEW
    const backToMenu = $('#btnBackToMenu');
    if (backToMenu) backToMenu.addEventListener('click', () => { state.step = 'menu'; render(); });
    const toPayment = $('#btnToPayment');
    if (toPayment) toPayment.addEventListener('click', () => { state.step = 'payment'; syncDashboardTable(); render(); });

    // PAYMENT
    const payIndBtn = $('[data-action="pay-mode-individual"]');
    if (payIndBtn) payIndBtn.addEventListener('click', () => { state.payMode = 'individual'; render(); });
    const payFullBtn = $('[data-action="pay-mode-full"]');
    if (payFullBtn) payFullBtn.addEventListener('click', () => { state.payMode = 'full'; render(); });
    $$('[data-action="start-pay"]').forEach((btn) => btn.addEventListener('click', () => {
      state.payingTarget = btn.dataset.target;
      state.selectedMethod = null;
      render();
    }));
    const cancelPay = $('#btnCancelPay');
    if (cancelPay) cancelPay.addEventListener('click', () => { state.payingTarget = null; render(); });
    $$('.pay-method').forEach((btn) => btn.addEventListener('click', () => { state.selectedMethod = btn.dataset.method; render(); }));
    const confirmPay = $('#btnConfirmPay');
    if (confirmPay) confirmPay.addEventListener('click', runPayment);
    const seeReceipt = $('#btnSeeReceipt');
    if (seeReceipt) seeReceipt.addEventListener('click', () => { state.step = 'receipt'; state.processingScreen = null; render(); });
    const backToPay = $('#btnBackToPayment');
    if (backToPay) backToPay.addEventListener('click', () => { state.processingScreen = null; state.payingTarget = null; render(); });
    const toReceiptOverview = $('#btnToReceiptOverview');
    if (toReceiptOverview) toReceiptOverview.addEventListener('click', () => {
      state.step = 'receipt';
      state._lastFinalReceipt = state.lastReceipt;
      render();
    });

    // RECEIPT
    const downloadBtn = $('#btnDownloadReceipt');
    if (downloadBtn) downloadBtn.addEventListener('click', () => toast('Receipt saved to your device'));
    const newSession = $('#btnNewSession');
    if (newSession) newSession.addEventListener('click', resetDemo);
  }

  function openAssign(itemId) {
    state.pendingItem = itemId;
    state.assignMode = 'individual';
    state.assignPersonId = state.people.length === 1 ? state.people[0].id : null;
    state.assignShared = [];
    render();
  }
  function closeAssign() {
    state.pendingItem = null;
    render();
  }

  function runPayment() {
    const target = state.payingTarget;
    const method = PAYMENT_METHODS.find((m) => m.id === state.selectedMethod);
    const amount = target === 'full' ? outstandingTotal() : personTotal(target);
    state.processingScreen = 'processing';
    render();

    setTimeout(() => {
      const txId = uid('KSY-2026');
      const time = new Date().toLocaleString();

      if (target === 'full') {
        const previouslyPaid = paidTotal();
        state.people.forEach((p) => {
          if (!isPersonPaid(p.id)) {
            state.payments[p.id] = { status: 'paid', method: method.id, txId, paidAt: time };
          }
        });
        state.fullTablePaid = true;
        const allLines = state.people.flatMap((p) => personBillLines(p.id));
        state.lastReceipt = {
          customer: 'Full Table', amount, txId, methodName: method.name, time,
          lines: allLines, previouslyPaid,
        };
        logTransaction('Full Table', amount, method.name, txId, time);
      } else {
        state.payments[target] = { status: 'paid', method: method.id, txId, paidAt: time };
        const p = person(target);
        state.lastReceipt = {
          customer: p.name, amount, txId, methodName: method.name, time,
          lines: personBillLines(target), previouslyPaid: 0,
        };
        logTransaction(p.name, amount, method.name, txId, time);
      }

      state.processingScreen = 'success';
      state.payingTarget = null;
      syncDashboardTable();
      render();
      toast('Payment successful');
    }, 1400);
  }

  function logTransaction(customer, amount, methodName, txId, time) {
    transactions.unshift({ customer, table: state.tableNumber, amount, method: methodName, status: 'Paid', ref: txId, time });
    renderTransactions();
  }

  function resetDemo() {
    state.step = 'scan';
    state.sessionId = null;
    state.people = [];
    state.orders = [];
    state.payments = {};
    state.fullTablePaid = false;
    state.menuFilter = 'All';
    state.menuSearch = '';
    state.pendingItem = null;
    state.assignMode = 'individual';
    state.assignPersonId = null;
    state.assignShared = [];
    state.payMode = 'individual';
    state.payingTarget = null;
    state.selectedMethod = null;
    state.processingScreen = null;
    state.lastReceipt = null;
    state._lastFinalReceipt = null;
    render();
  }

  /* ------------------------------------------------------------------ */
  /* Hero phone — small looping preview (non-interactive)                 */
  /* ------------------------------------------------------------------ */
  const heroFrames = [
    () => `<div class="dscan" style="padding:16px;gap:10px;"><div class="dscan__qr" style="width:90px;height:90px;">${qrSvg()}</div><div style="font-size:0.7rem;color:var(--text-low);">Scan to start · Table 05</div></div>`,
    () => `<div style="padding:16px;"><div style="font-size:0.6rem;color:var(--brass-hi);font-family:var(--font-mono);">MENU</div><div style="font-family:var(--font-display);font-size:0.9rem;margin:8px 0;color:var(--text-hi);">Large Pizza</div><div style="display:flex;gap:6px;"><span style="flex:1;text-align:center;padding:8px;background:var(--text-hi);color:var(--ink);border-radius:8px;font-size:0.6rem;font-weight:700;">Individual</span><span style="flex:1;text-align:center;padding:8px;background:var(--surface-2);color:var(--text-hi);border-radius:8px;font-size:0.6rem;font-weight:700;">Shared</span></div></div>`,
    () => `<div style="padding:16px;"><div style="font-size:0.6rem;color:var(--teal);font-family:var(--font-mono);">SPLIT 3 WAYS</div><div style="font-family:var(--font-display);font-size:1.4rem;margin-top:10px;color:var(--text-hi);">RM 10.67</div><div style="font-size:0.62rem;color:var(--text-low);">each, from RM 32.00</div></div>`,
    () => `<div style="padding:16px;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;"><div style="width:40px;height:40px;border-radius:50%;background:var(--good);color:#fff;display:flex;align-items:center;justify-content:center;">✓</div><div style="font-family:var(--font-display);font-size:1rem;margin-top:8px;color:var(--text-hi);">Paid</div></div>`,
  ];
  let heroFrameIdx = 0;
  function renderHeroPhone() {
    const el = $('#heroPhoneScreen');
    if (!el) return;
    el.innerHTML = heroFrames[heroFrameIdx]();
  }
  setInterval(() => {
    heroFrameIdx = (heroFrameIdx + 1) % heroFrames.length;
    renderHeroPhone();
  }, 3200);

  /* ------------------------------------------------------------------ */
  /* Restaurant dashboard sync                                           */
  /* ------------------------------------------------------------------ */
  function syncDashboardTable() {
    const key = 't' + state.tableNumber;
    if (!dashboardTables[key]) {
      dashboardTables[key] = { name: 'Table ' + state.tableNumber, status: 'Ordering', guests: 0, total: 0, paid: 0 };
    }
    const t = dashboardTables[key];
    t.guests = state.people.length;
    t.total = tableTotal();
    t.paid = paidTotal();
    if (t.total > 0 && t.paid >= t.total && t.total > 0) t.status = 'Fully Paid';
    else if (t.paid > 0) t.status = 'Payment Pending';
    else if (state.orders.length > 0) t.status = 'Ordering';
    else if (t.guests > 0) t.status = 'Seated';
    renderDashboard();
  }

  function renderDashboard() {
    // top stats
    const activeTables = Object.values(dashboardTables).filter((t) => t.guests > 0).length;
    const guests = Object.values(dashboardTables).reduce((s, t) => s + t.guests, 0);
    const orders = state.orders.length + (dashboardTables.t02 ? 4 : 0);
    const collected = Object.values(dashboardTables).reduce((s, t) => s + t.paid, 0);
    const outstanding = Object.values(dashboardTables).reduce((s, t) => s + Math.max(0, t.total - t.paid), 0);

    setText('#statActiveTables', activeTables);
    setText('#statGuests', guests);
    setText('#statOrders', orders);
    setText('#statPaid', fmt(collected));
    setText('#statOutstanding', fmt(outstanding));

    // table list
    const listEl = $('#tableList');
    if (listEl) {
      const activeKey = listEl.dataset.active || null;
      listEl.innerHTML = Object.entries(dashboardTables).map(([key, t]) => `
        <div class="table-chip ${activeKey === key ? 'is-active' : ''}" data-table="${key}">
          <div>
            <div class="table-chip__name">${t.name}</div>
            <div class="table-chip__meta">${t.guests > 0 ? t.guests + ' guests · ' + t.status : t.status}</div>
          </div>
          <div style="font-family:var(--font-mono);font-size:0.76rem;color:var(--text-low);">${t.total > 0 ? fmt(t.total) : ''}</div>
        </div>`).join('');
      $$('.table-chip', listEl).forEach((chip) => chip.addEventListener('click', () => {
        listEl.dataset.active = chip.dataset.table;
        renderTableDetail(chip.dataset.table);
        renderDashboard();
      }));
      if (activeKey) renderTableDetail(activeKey);
    }
  }

  function renderTableDetail(key) {
    const detailEl = $('#tableDetail');
    if (!detailEl) return;
    const t = dashboardTables[key];
    if (!t) return;

    if (key === 't' + state.tableNumber && state.people.length > 0) {
      const rows = state.people.map((p) => {
        const total = personTotal(p.id);
        const paid = isPersonPaid(p.id);
        return `<div class="detail-row"><span>${escapeHtml(p.name)}</span><span>${fmt(total)} · <em class="status ${paid ? 'status--paid' : 'status--pending'}" style="font-style:normal;">${paid ? 'Paid' : 'Pending'}</em></span></div>`;
      }).join('');
      detailEl.innerHTML = `
        <h3>${t.name} — Live</h3>
        <div class="detail-row"><span>Guests</span><span>${state.people.length}</span></div>
        <div class="detail-row"><span>Items ordered</span><span>${state.orders.length}</span></div>
        ${rows}
        <div class="detail-row"><span>Table total</span><span>${fmt(tableTotal())}</span></div>
        <div class="detail-row"><span>Outstanding</span><span>${fmt(outstandingTotal())}</span></div>`;
    } else {
      detailEl.innerHTML = `
        <h3>${t.name}</h3>
        <div class="detail-row"><span>Status</span><span>${t.status}</span></div>
        <div class="detail-row"><span>Guests</span><span>${t.guests}</span></div>
        <div class="detail-row"><span>Total</span><span>${t.total ? fmt(t.total) : '—'}</span></div>
        <div class="detail-row"><span>Paid</span><span>${t.paid ? fmt(t.paid) : 'RM 0.00'}</span></div>`;
    }
  }

  function renderTransactions() {
    const body = $('#txTableBody');
    if (!body) return;
    if (transactions.length === 0) {
      body.innerHTML = `<tr><td colspan="6" class="dashboard__empty">No transactions yet.</td></tr>`;
      return;
    }
    body.innerHTML = transactions.slice(0, 8).map((tx) => `
      <tr>
        <td>${escapeHtml(tx.customer)}</td>
        <td>Table ${tx.table}</td>
        <td>${fmt(tx.amount)}</td>
        <td>${tx.method}</td>
        <td><span class="status status--paid">${tx.status}</span></td>
        <td style="font-family:var(--font-mono);font-size:0.74rem;">${tx.ref}</td>
      </tr>`).join('');
  }

  function setText(sel, val) { const el = $(sel); if (el) el.textContent = val; }

  /* ------------------------------------------------------------------ */
  /* Navigation, scroll effects, mobile menu                             */
  /* ------------------------------------------------------------------ */
  function initNav() {
    const nav = $('#nav');
    const burger = $('#navBurger');
    window.addEventListener('scroll', () => {
      nav.classList.toggle('is-scrolled', window.scrollY > 30);
    });
    if (burger) burger.addEventListener('click', () => {
      const open = nav.classList.toggle('is-open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    $$('.nav__links a').forEach((a) => a.addEventListener('click', () => nav.classList.remove('is-open')));
  }

  /* ------------------------------------------------------------------ */
  /* Init                                                                 */
  /* ------------------------------------------------------------------ */
  function init() {
    initNav();
    render();
    renderTransactions();
    initTheme();
    initHeroTitleReveal();
    initTypewriters();
    initScrollReveal();
    initHeroParallax();
  }

  document.addEventListener('DOMContentLoaded', init);

  /* ============================================================
     KiraSYCN — 3D Scroll & Motion Enhancements
     Theme toggle, hero pop-out, typing effects, scroll-reveal,
     and a lightweight parallax layer. All additive — none of this
     touches the ordering, splitting, payment or dashboard logic.
     ============================================================ */
  /* ---- Light / Dark theme toggle, persisted via localStorage ---- */
  function initTheme() {
    const root = document.documentElement;
    const toggle = $('#themeToggle');
    const icon = $('#themeToggleIcon');
    const label = $('#themeToggleLabel');
    if (!toggle) return;

    function applyThemeUI(theme) {
      const isLight = theme === 'light';
      if (icon) icon.textContent = isLight ? '☀' : '🌙';
      if (label) label.textContent = isLight ? 'Light Mode' : 'Dark Mode';
      toggle.setAttribute('aria-pressed', isLight ? 'true' : 'false');
    }

    // the inline head script already set data-theme before paint
    applyThemeUI(root.getAttribute('data-theme') === 'light' ? 'light' : 'dark');

    toggle.addEventListener('click', () => {
      const next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      root.setAttribute('data-theme', next);
      applyThemeUI(next);
      try { localStorage.setItem('kirasycn-theme', next); } catch (e) { /* storage unavailable */ }
      toggle.classList.add('is-flipping');
      setTimeout(() => toggle.classList.remove('is-flipping'), 420);
    });
  }

  /* ---- Hero title: cinematic word-by-word pop-out reveal ---- */
  function wrapWordsRecursive(el) {
    Array.from(el.childNodes).forEach((node) => {
      if (node.nodeType === 3) {
        const parts = node.textContent.split(/(\s+)/);
        const frag = document.createDocumentFragment();
        parts.forEach((part) => {
          if (part === '') return;
          if (/^\s+$/.test(part)) {
            frag.appendChild(document.createTextNode(part));
          } else {
            const span = document.createElement('span');
            span.className = 'reveal-word';
            span.textContent = part;
            frag.appendChild(span);
          }
        });
        el.replaceChild(frag, node);
      } else if (node.nodeType === 1 && node.tagName !== 'BR') {
        wrapWordsRecursive(node);
      }
    });
  }

  function initHeroTitleReveal() {
    const title = $('.hero__title');
    if (!title) return;
    wrapWordsRecursive(title);
    const words = $$('.reveal-word', title);
    words.forEach((w, i) => {
      w.style.animationDelay = (140 + i * 90) + 'ms';
    });
  }

  /* ---- Selective typing / reveal effect for supporting text ---- */
  function typeText(el, speed) {
    if (!el || el.dataset.typed === '1') return;
    el.dataset.typed = '1';
    const full = el.textContent;
    el.textContent = '';
    el.classList.add('is-typing');
    let i = 0;
    (function step() {
      i++;
      el.textContent = full.slice(0, i);
      if (i < full.length) {
        setTimeout(step, speed || 16);
      } else {
        el.classList.remove('is-typing');
      }
    }());
  }

  function initTypewriters() {
    const heroEyebrow = $('.hero .eyebrow-plain');
    const heroSub = $('.hero__sub');
    const demoLead = $('#demo .section__lead');

    if (heroEyebrow) setTimeout(() => typeText(heroEyebrow, 20), 120);
    if (heroSub) setTimeout(() => typeText(heroSub, 12), 900);

    if (demoLead && 'IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            typeText(entry.target, 10);
            io.unobserve(entry.target);
          }
        });
      }, { threshold: 0.4 });
      io.observe(demoLead);
    } else if (demoLead) {
      typeText(demoLead, 10);
    }
  }

  /* ---- Scroll-reveal for cards and sections entering the viewport ---- */
  function initScrollReveal() {
    const groups = [
      { sel: '.problem-card', tilt: false },
      { sel: '.step', tilt: false },
      { sel: '.feature-row', tilt: true },
      { sel: '.security-card', tilt: false },
      { sel: '.benefits-col', tilt: false },
    ];

    if (!('IntersectionObserver' in window)) {
      groups.forEach((g) => $$(g.sel).forEach((el) => el.classList.add('reveal', 'is-visible')));
      return;
    }

    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

    groups.forEach((g) => {
      $$(g.sel).forEach((el, i) => {
        el.classList.add('reveal');
        if (g.tilt) el.classList.add('reveal--tilt');
        el.style.transitionDelay = Math.min(i * 90, 360) + 'ms';
        io.observe(el);
      });
    });
  }

  /* ---- Lightweight hero parallax (passive scroll + rAF) ---- */
  function initHeroParallax() {
    const hero = $('#hero');
    if (!hero) return;
    const copy = $('.hero__copy', hero);
    const layers = $$('.scene-parallax', hero);
    if (!layers.length && !copy) return;

    const isMobile = () => window.innerWidth <= 760;
    let ticking = false;

    function update() {
      ticking = false;
      if (isMobile()) return; // keep mobile scrolling light and smooth
      const rect = hero.getBoundingClientRect();
      const progress = Math.min(Math.max(-rect.top / (rect.height || 1), 0), 1);

      layers.forEach((el) => {
        const speed = parseFloat(el.dataset.parallaxSpeed) || 0.5;
        el.style.transform = 'translate3d(0,' + (progress * -70 * speed) + 'px,0)';
      });
      if (copy) {
        copy.style.transform = 'translate3d(0,' + (progress * 26) + 'px,0)';
        copy.style.opacity = String(1 - progress * 0.55);
      }
    }

    window.addEventListener('scroll', () => {
      if (!ticking) { requestAnimationFrame(update); ticking = true; }
    }, { passive: true });
    window.addEventListener('resize', () => { if (!ticking) { requestAnimationFrame(update); ticking = true; } }, { passive: true });

    update();
  }
})();
