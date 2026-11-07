        import { addDiner, updateDiner, addOrder, setTableStatus, listenToTable, startAnonymousSession } from './firebase-sync.js';

        /* ==========================================================================
           SAFETY HELPERS
           Everything that comes from Firestore or the URL is untrusted. Escape it
           before it is placed into HTML, and coerce numbers before formatting.
           ========================================================================== */
        const TABLE_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

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
            return TABLE_ID_PATTERN.test(text) ? text : '01';
        }

        // COMPLETE MENU DATA (123 Items)
        const MENU = [
            // Nasi Kandar & Briyani
            { id: 'm1', name: 'Nasi Kandar + Ayam Kari + Sayur', price: 16.30, category: 'Nasi Kandar & Briyani' },
            { id: 'm2', name: 'Nasi Kandar + Ayam Madu Kicap + Sayur', price: 16.30, category: 'Nasi Kandar & Briyani' },
            { id: 'm3', name: 'Nasi Kandar + Ayam Sambal + Sayur', price: 16.30, category: 'Nasi Kandar & Briyani' },
            { id: 'm4', name: 'Nasi Kandar + Ikan Goreng + Sayur', price: 16.30, category: 'Nasi Kandar & Briyani' },
            { id: 'm5', name: 'Nasi Kandar + Ikan Kari + Sayur', price: 16.30, category: 'Nasi Kandar & Briyani' },


            // Rice & Proteins
            { id: 'm18', name: 'Nasi Putih', price: 4.50, category: 'Rice & Proteins' },
            { id: 'm19', name: 'Nasi Briyani with Dalcha', price: 9.50, category: 'Rice & Proteins' },
            { id: 'm20', name: 'Ayam Goreng', price: 10.00, category: 'Rice & Proteins' },
            { id: 'm21', name: 'Ayam Kari', price: 10.00, category: 'Rice & Proteins' },
            { id: 'm22', name: 'Ayam Madu Kicap', price: 10.00, category: 'Rice & Proteins' },


            // Sides & Seafood
            { id: 'm35', name: 'Telur Goreng', price: 3.30, category: 'Sides & Seafood' },
            { id: 'm36', name: 'Telur Goreng Bawang', price: 4.50, category: 'Sides & Seafood' },
            { id: 'm37', name: 'Sayur Bendi', price: 3.40, category: 'Sides & Seafood' },
            { id: 'm38', name: 'Sayur Kobis', price: 3.40, category: 'Sides & Seafood' },


            // Roti & Thosai
            { id: 'm46', name: 'Roti Canai', price: 3.30, category: 'Roti & Thosai' },
            { id: 'm47', name: 'Roti Telur', price: 5.30, category: 'Roti & Thosai' },
            { id: 'm48', name: 'Roti Planta', price: 5.30, category: 'Roti & Thosai' },
            { id: 'm49', name: 'Roti Bawang', price: 5.30, category: 'Roti & Thosai' },


            // Goreng & Noodles
            { id: 'm72', name: 'Mee Goreng', price: 9.90, category: 'Goreng & Noodles' },
            { id: 'm73', name: 'Nasi Goreng', price: 10.30, category: 'Goreng & Noodles' },
            { id: 'm74', name: 'Nasi Goreng Cina', price: 10.30, category: 'Goreng & Noodles' },
            { id: 'm75', name: 'Nasi Goreng Kampung', price: 13.60, category: 'Goreng & Noodles' },
            { id: 'm76', name: 'Nasi Goreng Pattaya', price: 14.60, category: 'Goreng & Noodles' },


            // Naan & Tandoori
            { id: 'm89', name: 'Plain Naan', price: 5.00, category: 'Naan & Tandoori' },
            { id: 'm90', name: 'Garlic Naan', price: 6.50, category: 'Naan & Tandoori' },
            { id: 'm91', name: 'Butter Naan', price: 6.50, category: 'Naan & Tandoori' },
            { id: 'm92', name: 'Double Cheese Naan', price: 10.40, category: 'Naan & Tandoori' },


            // Hot Drinks
            { id: 'm101', name: 'Teh Panas', price: 4.40, category: 'Hot Drinks' },
            { id: 'm102', name: 'Nescafe Panas', price: 5.60, category: 'Hot Drinks' },
            { id: 'm103', name: 'Milo Panas', price: 5.60, category: 'Hot Drinks' },
            { id: 'm104', name: 'Kopi Panas', price: 4.40, category: 'Hot Drinks' },
            { id: 'm105', name: 'Kopi O Panas', price: 3.70, category: 'Hot Drinks' },


            // Cold Drinks
            { id: 'm109', name: 'Teh O Ais', price: 4.20, category: 'Cold Drinks' },
            { id: 'm110', name: 'Teh Ais', price: 5.00, category: 'Cold Drinks' },
            { id: 'm111', name: 'Limau Ais', price: 4.50, category: 'Cold Drinks' },
            { id: 'm112', name: 'Teh O Limau Ais', price: 4.60, category: 'Cold Drinks' },
            { id: 'm113', name: 'Sirap Limau Ais', price: 4.60, category: 'Cold Drinks' },

        ];

        // TAX CONSTANTS (6% SST)
        const TAX_RATE = 0.06;

        // STATE ENGINE
        let state = {
            restaurantId: 'KiraBistro',
            tableId: null,
            status: null,
            diners: [],
            orders: [],
            currentDinerId: null
        };

        const appDiv = document.getElementById('app');

        /* One delegated listener handles the bill buttons, so no inline
           onclick handlers are needed anywhere in the app. */
        appDiv.addEventListener('click', (event) => {
            const button = event.target.closest('button[data-action]');
            if (!button) return;
            const dinerId = button.getAttribute('data-diner-id');
            if (!dinerId) return;

            if (button.getAttribute('data-action') === 'view-receipt') {
                renderReceipt(dinerId);
            } else if (button.getAttribute('data-action') === 'pay') {
                const subtotals = calculateDinerTotals();
                const grand = asNumber(subtotals[dinerId]) * (1 + TAX_RATE);
                renderPayment(dinerId, grand);
            }
        });

        /* ==========================================================================
           THEME ENGINE LOGIC
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
           ROUTING & INITIALIZATION
           ========================================================================== */
        function init() {
            const params = new URLSearchParams(window.location.search);
            state.tableId = safeTableId(params.get('table'));

            listenToTable(state.tableId, (serverState) => {
                if (serverState) {
                    state.diners = serverState.diners || [];
                    state.orders = serverState.orders || [];
                    state.status = serverState.status;

                    if (state.currentDinerId) {
                        const isViewingBill = document.getElementById('backToMenuBtn') !== null;
                        if (isViewingBill) renderBill();
                        else if (document.getElementById('viewBillBtn')) renderMenu();
                    }
                }
            });

            renderWelcome();
        }

        /* ==========================================================================
           UI RENDERING LOGIC
           ========================================================================== */
        function renderWelcome() {
            appDiv.innerHTML = `
                <div style="text-align:center; margin-top: 5vh;">
                    <h3 class="text-muted">${escapeHtml(state.restaurantId)}</h3>
                    <h1 style="font-size: 3rem; margin: 10px 0; color: var(--accent-brass);">Table ${escapeHtml(state.tableId)}</h1>
                    <p style="margin-bottom: 30px;">Scan to Order & Pay Individually</p>

                    <div class="glass-panel" style="text-align:left;">
                        <label style="display:block; margin-bottom: 8px;">Enter your name to start:</label>
                        <input type="text" id="dinerName" maxlength="80" placeholder="e.g. Vasi" style="width:100%; padding: 12px; border-radius: 8px; margin-bottom: 20px; font-size:16px;">
                        <button class="btn btn-primary" id="joinBtn">Open Table Session</button>
                    </div>
                </div>
            `;

            document.getElementById('joinBtn').addEventListener('click', async () => {
                const input = document.getElementById('dinerName');
                const name = input.value.trim().slice(0, 80);
                if(!name) return;

                const newDiner = {
                    id: `d-${Date.now()}`,
                    name: name,
                    initial: name.charAt(0).toUpperCase(),
                    hasPaid: false
                };

                state.currentDinerId = newDiner.id;
                state.diners.push(newDiner);

                try {
                    await addDiner(state.tableId, newDiner);
                    await setTableStatus(state.tableId, 'Ordering');
                } catch (error) {
                    console.error("[Sync] Could not open the table session:", error);
                }
                renderMenu();
            });
        }

        function renderMenu() {
            let html = `
                <div class="flex-between" style="margin-bottom: 15px;">
                    <div>
                        <h2>Menu</h2>
                        <p class="text-muted">Table ${escapeHtml(state.tableId)}</p>
                    </div>
                    <button class="btn btn-outline" id="viewBillBtn" style="width:auto; padding: 8px 16px;">View Bill</button>
                </div>

                <!-- ADD EXTRA DINER PANEL -->
                <div class="glass-panel" style="margin-bottom: 20px; padding: 15px;">
                    <p style="font-size: 14px; margin-bottom: 8px; font-weight: 500;">Guests at this table: ${state.diners.map(d => escapeHtml(d.name)).join(', ')}</p>
                    <div style="display:flex; gap:10px;">
                        <input type="text" id="extraDinerName" maxlength="80" placeholder="Add a friend's name..." style="flex:1; padding: 10px; border-radius: 8px; font-size: 14px;">
                        <button class="btn btn-outline" id="addDinerBtn" style="width: auto; padding: 10px 16px; font-size: 14px;">Add</button>
                    </div>
                </div>

                <div style="display:flex; flex-direction:column; gap:12px;">
            `;

            let currentCategory = '';

            MENU.forEach(item => {
                // Inject a solid block divider whenever a new category starts
                if (item.category !== currentCategory) {
                    currentCategory = item.category;
                    html += `
                        <div style="background: var(--accent-brass); color: #000; padding: 10px 15px; border-radius: 8px; margin: 25px 0 10px 0; font-weight: 600; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; display: flex; align-items: center; justify-content: space-between;">
                            <span>${escapeHtml(currentCategory)}</span>
                            <span style="font-size: 18px; opacity: 0.5;">▾</span>
                        </div>
                    `;
                }

                html += `
                    <div class="glass-panel flex-between menu-item" data-id="${escapeAttr(item.id)}" style="cursor:pointer; padding: 15px;">
                        <div>
                            <h4 style="color: var(--text-main); font-weight: 500; font-size: 15px;">${escapeHtml(item.name)}</h4>
                        </div>
                        <div style="font-weight:600; color: var(--text-main);">RM ${asNumber(item.price).toFixed(2)}</div>
                    </div>
                `;
            });


            html += `</div>`;
            appDiv.innerHTML = html;

            document.getElementById('viewBillBtn').addEventListener('click', renderBill);

            // Logic to add extra guests dynamically
            document.getElementById('addDinerBtn').addEventListener('click', async () => {
                const extraInput = document.getElementById('extraDinerName');
                const extraName = extraInput.value.trim().slice(0, 80);
                if (!extraName) return;

                const extraDiner = {
                    id: `d-${Date.now()}`,
                    name: extraName,
                    initial: extraName.charAt(0).toUpperCase(),
                    hasPaid: false
                };

                state.diners.push(extraDiner);
                try {
                    await addDiner(state.tableId, extraDiner);
                } catch (error) {
                    console.error("[Sync] Could not add guest:", error);
                }
                extraInput.value = '';
            });

            document.querySelectorAll('.menu-item').forEach(el => {
                el.addEventListener('click', (e) => {
                    const itemId = e.currentTarget.getAttribute('data-id');
                    openAssignmentSheet(itemId);
                });
            });
        }

        /* ==========================================================================
           SMART ALGORITHMIC BILL SPLITTING & TAX ENGINE
           ========================================================================== */
        let pendingItemToAssign = null;
        let selectedDinersForSplit = new Set();

        function openAssignmentSheet(itemId) {
            const item = MENU.find(m => m.id === itemId);
            if (!item) return;
            pendingItemToAssign = item;
            selectedDinersForSplit.clear();
            selectedDinersForSplit.add(state.currentDinerId);

            document.getElementById('sheetItemName').innerText = item.name;
            document.getElementById('sheetItemPrice').innerText = `RM ${asNumber(item.price).toFixed(2)}`;

            const dinersDiv = document.getElementById('sheetDinersList');
            dinersDiv.innerHTML = '';

            state.diners.forEach(d => {
                // Do not allow assigning items to diners who have already paid
                if (d.hasPaid) return;

                const isSelected = selectedDinersForSplit.has(d.id);
                // Dynamically injecting the diner-avatar classes for clean light mode toggling
                dinersDiv.innerHTML += `
                    <div class="diner-avatar ${isSelected ? 'selected' : ''}" data-id="${escapeAttr(d.id)}" style="
                        min-width: 60px; height: 50px; border-radius: 12px; padding: 0 10px;
                        display: flex; align-items: center; justify-content: center; gap: 6px;
                        font-weight: 500; font-size: 14px; cursor: pointer; flex-shrink:0; transition: 0.2s;">
                        <span>${escapeHtml(d.initial)}</span> <span style="font-size:12px;">${escapeHtml(d.name)}</span>
                    </div>
                `;
            });

            document.querySelectorAll('.diner-avatar').forEach(el => {
                el.addEventListener('click', (e) => {
                    const dId = e.currentTarget.getAttribute('data-id');
                    if (selectedDinersForSplit.has(dId)) {
                        selectedDinersForSplit.delete(dId);
                        e.currentTarget.classList.remove('selected');
                    } else {
                        selectedDinersForSplit.add(dId);
                        e.currentTarget.classList.add('selected');
                    }
                });
            });

            document.getElementById('sheetOverlay').classList.add('active');
            document.getElementById('itemSheet').classList.add('active');
        }

        document.getElementById('sheetOverlay').addEventListener('click', closeSheet);
        function closeSheet() {
            document.getElementById('sheetOverlay').classList.remove('active');
            document.getElementById('itemSheet').classList.remove('active');
        }

        document.getElementById('confirmAssignBtn').addEventListener('click', async () => {
            if (selectedDinersForSplit.size === 0) return alert("Select at least one diner.");
            if (!pendingItemToAssign) return;

            const newOrder = {
                id: `o-${Date.now()}`,
                itemId: pendingItemToAssign.id,
                name: pendingItemToAssign.name,
                price: asNumber(pendingItemToAssign.price),
                sharedBy: Array.from(selectedDinersForSplit),
                status: 'Pending'
            };

            state.orders.push(newOrder);
            try {
                await addOrder(state.tableId, newOrder);
            } catch (error) {
                console.error("[Sync] Could not add order:", error);
            }
            closeSheet();
        });

        /* ==========================================================================
           INDIVIDUAL BILL REVIEW & TAX CALCULATIONS
           Calculates exactly down to the cent, preventing rounding errors.
           ========================================================================== */
        function calculateDinerTotals() {
            const subtotals = Object.create(null);
            state.diners.forEach(d => subtotals[d.id] = 0);

            state.orders.forEach(order => {
                const sharedBy = Array.isArray(order.sharedBy)
                    ? order.sharedBy.filter(dId => subtotals[dId] !== undefined)
                    : [];
                const numPeople = sharedBy.length;
                if (numPeople === 0) return;

                const price = asNumber(order.price);
                // Exact cent splitting algorithm for the item price
                const baseSplit = Math.floor((price * 100) / numPeople) / 100;
                const remainder = Math.round((price - (baseSplit * numPeople)) * 100);

                sharedBy.forEach((dId, index) => {
                    let amount = baseSplit;
                    if (index < remainder) amount += 0.01;
                    subtotals[dId] += amount;
                });
            });

            return subtotals;
        }

        function renderBill() {
            const subtotals = calculateDinerTotals();
            let tableSubtotal = 0;
            Object.values(subtotals).forEach(val => tableSubtotal += val);

            const tableTax = tableSubtotal * TAX_RATE;
            const tableGrandTotal = tableSubtotal + tableTax;

            let html = `
                <div class="flex-between" style="margin-bottom: 20px;">
                    <h2>Table Bill</h2>
                    <button class="btn btn-outline" id="backToMenuBtn" style="width:auto; padding: 8px 16px;">Menu</button>
                </div>
                <div class="glass-panel" style="margin-bottom: 20px;">
                    <p class="text-muted">Table Grand Total (Incl. 6% Tax)</p>
                    <h1 style="color:var(--accent-brass);">RM ${tableGrandTotal.toFixed(2)}</h1>
                </div>
                <h3>Individual Splits</h3>
                <div style="display:flex; flex-direction:column; gap:15px; margin-top:10px; margin-bottom: 30px;">
            `;

            state.diners.forEach(d => {
                const sub = subtotals[d.id] || 0;
                const tax = sub * TAX_RATE;
                const grand = sub + tax;

                html += `
                    <div class="glass-panel">
                        <div class="flex-between" style="margin-bottom: 10px;">
                            <div style="display:flex; align-items:center; gap:10px;">
                                <div class="bill-avatar" style="width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size:12px; font-weight: 600;">${escapeHtml(d.initial)}</div>
                                <strong>${escapeHtml(d.name)} ${d.id === state.currentDinerId ? '(You)' : ''}</strong>
                            </div>
                            ${d.hasPaid
                                ? `<span class="badge paid">PAID</span>`
                                : `<span class="badge pending" style="color:#FF9500;">PENDING</span>`
                            }
                        </div>
                        <div class="flex-between text-muted" style="font-size: 13px;">
                            <span>Subtotal:</span>
                            <span>RM ${sub.toFixed(2)}</span>
                        </div>
                        <div class="flex-between text-muted" style="font-size: 13px; margin-bottom: 10px;">
                            <span>Tax (6%):</span>
                            <span>RM ${tax.toFixed(2)}</span>
                        </div>
                        <div class="flex-between" style="margin-bottom: 15px; border-top: 1px solid var(--border-light); padding-top: 10px;">
                            <span style="font-weight:500;">Total to Pay:</span>
                            <strong style="color:var(--accent-brass); font-size: 16px;">RM ${grand.toFixed(2)}</strong>
                        </div>
                        ${d.hasPaid
                            ? `<button class="btn btn-outline" data-action="view-receipt" data-diner-id="${escapeAttr(d.id)}" style="font-size: 14px; padding: 10px;">View E-Bill</button>`
                            : `<button class="btn btn-primary" data-action="pay" data-diner-id="${escapeAttr(d.id)}" style="font-size: 14px; padding: 10px;">Pay RM ${grand.toFixed(2)}</button>`
                        }
                    </div>
                `;
            });

            html += `</div>`;
            appDiv.innerHTML = html;

            document.getElementById('backToMenuBtn').addEventListener('click', renderMenu);
        }

        /* ==========================================================================
           PAYMENT GATEWAY INTEGRATION
           ========================================================================== */
        function renderPayment(dinerId, totalAmount) {
            const diner = state.diners.find(d => d.id === dinerId);
            if (!diner) return;
            totalAmount = asNumber(totalAmount);

            // 1. Calculate the individual's specific items for the pre-payment bill
            const dinerItems = state.orders.filter(o => Array.isArray(o.sharedBy) && o.sharedBy.includes(dinerId));
            let itemsHtml = '';

            dinerItems.forEach(item => {
                const sharedCount = Math.max(1, Array.isArray(item.sharedBy) ? item.sharedBy.length : 1);
                const splitPrice = asNumber(item.price) / sharedCount;
                itemsHtml += `
                    <div class="flex-between text-muted" style="margin-bottom: 8px; font-size: 14px;">
                        <span>${sharedCount > 1 ? `½ ` : ''}${escapeHtml(item.name)}</span>
                        <span>RM ${splitPrice.toFixed(2)}</span>
                    </div>
                `;
            });

            const methods = [
                { id: 'tng', name: "Touch 'n Go eWallet", icon: "📱" },
                { id: 'duitnow', name: "DuitNow QR", icon: "🔳" },
                { id: 'mastercard', name: "Mastercard", icon: "💳" },
                { id: 'bigpay', name: "BigPay", icon: "✈️" },
                { id: 'visa', name: "Visa", icon: "💳" },
                { id: 'grabpay', name: "GrabPay", icon: "🟢" }
            ];

            let html = `
                <div class="flex-between" style="margin-bottom: 20px;">
                    <h2>Checkout</h2>
                    <button class="btn btn-outline" id="cancelPayBtn" style="width:auto; padding: 8px 16px;">Cancel</button>
                </div>

                <!-- 2. ITEMIZED PRE-CHECKOUT BILL -->
                <div class="glass-panel" style="background: var(--bg-color); color: var(--text-main); padding: 20px; border-radius: 12px; margin-bottom: 25px; border: 1px solid var(--border-light);">
                    <div style="margin-bottom: 15px; border-bottom: 1px dashed var(--border-light); padding-bottom: 15px;">
                        <h4 style="margin-bottom: 15px; color: var(--text-main); font-weight: 600;">Itemized Bill for ${escapeHtml(diner.name)}</h4>
                        ${itemsHtml}
                    </div>

                    <div class="flex-between" style="font-size: 13px; margin-bottom: 5px; color: var(--text-muted);">
                        <span>Subtotal</span>
                        <span>RM ${(totalAmount / (1 + TAX_RATE)).toFixed(2)}</span>
                    </div>
                    <div class="flex-between" style="font-size: 13px; margin-bottom: 15px; color: var(--text-muted);">
                        <span>6% Tax</span>
                        <span>RM ${(totalAmount - (totalAmount / (1 + TAX_RATE))).toFixed(2)}</span>
                    </div>
                    <div class="flex-between" style="font-size: 18px; font-weight: bold;">
                        <span>Total to Pay</span>
                        <span style="color:var(--accent-brass);">RM ${totalAmount.toFixed(2)}</span>
                    </div>
                </div>

                <!-- 3. PAYMENT GATEWAYS -->
                <h3 style="margin-bottom: 15px;">Select Payment Method</h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; padding-bottom: 30px;">
            `;

            methods.forEach(m => {
                html += `
                    <button class="btn glass-panel payment-method-btn" data-method="${escapeAttr(m.name)}" style="display:flex; flex-direction:column; align-items:center; gap:10px; background: rgba(255,255,255,0.05); color: var(--text-main); border: 1px solid var(--border-light);">
                        <span style="font-size: 24px;">${escapeHtml(m.icon)}</span>
                        <span style="font-size: 13px; font-weight: 500;">${escapeHtml(m.name)}</span>
                    </button>
                `;
            });

            html += `</div>`;
            appDiv.innerHTML = html;

            document.getElementById('cancelPayBtn').addEventListener('click', renderBill);

            document.querySelectorAll('.payment-method-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const method = e.currentTarget.getAttribute('data-method');
                    processPayment(dinerId, totalAmount, method);
                });
            });
        }


        function processPayment(dinerId, totalAmount, method) {
            const dinerIndex = state.diners.findIndex(d => d.id === dinerId);
            if (dinerIndex === -1) return;
            totalAmount = asNumber(totalAmount);

            appDiv.innerHTML = `
                <div style="text-align:center; margin-top:20vh;">
                    <h2 style="color: var(--accent-brass);">Processing ${escapeHtml(method)}...</h2>
                    <p class="text-muted">Please wait securely.</p>
                </div>
            `;

            setTimeout(() => {
                // Update specific diner's payment status
                state.diners[dinerIndex].hasPaid = true;
                state.diners[dinerIndex].finalTotal = totalAmount;
                state.diners[dinerIndex].paymentMethod = method;
                state.diners[dinerIndex].paymentRef = `KSY-${Math.floor(Math.random()*1000000)}`;

                // The staff dashboard derives "Fully Paid" from the guest
                // payment flags, so diners never write a "Fully Paid" table
                // status themselves.

                // Sync to Firebase (per-document updates, no clobbering)
                updateDiner(state.tableId, dinerId, {
                    hasPaid: true,
                    finalTotal: totalAmount,
                    paymentMethod: method,
                    paymentRef: state.diners[dinerIndex].paymentRef
                }).catch((error) => console.error("[Sync] Could not record payment:", error));
                setTableStatus(state.tableId, 'Ordering')
                    .catch((error) => console.error("[Sync] Could not update table status:", error));

                renderReceipt(dinerId);
            }, 1200);
        }

        /* ==========================================================================
           DIGITAL E-BILL GENERATOR
           Generates a clean, Apple-styled digital receipt for the individual user.
           ========================================================================== */
        function renderReceipt(dinerId) {
            const diner = state.diners.find(d => d.id === dinerId);
            if (!diner) return;
            const finalTotal = asNumber(diner.finalTotal);

            // Filter orders to only show items this specific diner shared
            const dinerItems = state.orders.filter(o => Array.isArray(o.sharedBy) && o.sharedBy.includes(dinerId));
            let itemsHtml = '';

            dinerItems.forEach(item => {
                const sharedCount = Math.max(1, Array.isArray(item.sharedBy) ? item.sharedBy.length : 1);
                const splitPrice = asNumber(item.price) / sharedCount;
                itemsHtml += `
                    <div class="flex-between text-muted" style="margin-bottom: 8px; font-size: 14px;">
                        <span>${sharedCount > 1 ? `½ ` : ''}${escapeHtml(item.name)}</span>
                        <span>RM ${splitPrice.toFixed(2)}</span>
                    </div>
                `;
            });

            // Re-written to dynamically inherit Apple glassmorphism based on the active theme
            appDiv.innerHTML = `
                <div class="glass-panel" style="background: var(--bg-color); color: var(--text-main); padding: 30px 20px; border-radius: 12px; margin-top: 20px; border: 1px solid var(--border-light);">
                    <div style="text-align: center; border-bottom: 1px dashed var(--border-light); padding-bottom: 20px; margin-bottom: 20px;">
                        <h2 style="font-family: var(--font-serif); margin-bottom: 5px;">${escapeHtml(state.restaurantId)}</h2>
                        <p style="color: var(--text-muted); font-size: 12px;">Table ${escapeHtml(state.tableId)} • E-Bill</p>
                    </div>

                    <div style="margin-bottom: 20px;">
                        <p style="font-size: 12px; color: var(--text-muted);">Guest Name</p>
                        <p style="font-weight: 600;">${escapeHtml(diner.name)}</p>
                    </div>

                    <div style="margin-bottom: 20px; border-bottom: 1px dashed var(--border-light); padding-bottom: 20px;">
                        ${itemsHtml}
                    </div>

                    <div class="flex-between" style="font-size: 14px; margin-bottom: 5px; color: var(--text-muted);">
                        <span>Subtotal</span>
                        <span>RM ${(finalTotal / (1 + TAX_RATE)).toFixed(2)}</span>
                    </div>
                    <div class="flex-between" style="font-size: 14px; margin-bottom: 15px; color: var(--text-muted);">
                        <span>6% Tax</span>
                        <span>RM ${(finalTotal - (finalTotal / (1 + TAX_RATE))).toFixed(2)}</span>
                    </div>
                    <div class="flex-between" style="font-size: 18px; font-weight: bold; margin-bottom: 20px;">
                        <span>Total Paid</span>
                        <span>RM ${finalTotal.toFixed(2)}</span>
                    </div>

                    <div style="background: rgba(128,128,128,0.1); padding: 15px; border-radius: 8px; font-size: 12px; color: var(--text-muted);">
                        <div class="flex-between" style="margin-bottom: 5px;">
                            <span>Method</span>
                            <span style="font-weight: 500; color: var(--text-main);">${escapeHtml(diner.paymentMethod)}</span>
                        </div>
                        <div class="flex-between" style="margin-bottom: 5px;">
                            <span>Ref No</span>
                            <span style="font-weight: 500; color: var(--text-main);">${escapeHtml(diner.paymentRef)}</span>
                        </div>
                        <div class="flex-between">
                            <span>Date</span>
                            <span style="font-weight: 500; color: var(--text-main);">${new Date().toLocaleDateString('en-MY')}</span>
                        </div>
                    </div>
                </div>

                <button class="btn btn-outline" id="backToTableBtn" style="margin-top: 20px;">Return to Table Dashboard</button>
            `;

            document.getElementById('backToTableBtn').addEventListener('click', renderBill);
        }

        // Boot: establish an authenticated (anonymous) session before reading data.
        startAnonymousSession()
            .then(init)
            .catch((error) => {
                console.error("[Auth] Anonymous sign-in failed. Enable the Anonymous provider in Firebase Authentication.", error);
                appDiv.innerHTML = `
                    <div class="glass-panel" style="text-align:center; margin-top:20vh;">
                        <h2 style="color: var(--accent-brass);">Session unavailable</h2>
                        <p class="text-muted">The demo could not start a secure session. Please try again later.</p>
                    </div>
                `;
            });
