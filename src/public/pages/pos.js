/**
 * POS Page — Point of Sale interface (Beta-style overhaul)
 * Dark sidebar, category grid, checkout panel
 */

let posCart = [];
let posSelectedMember = null;
let posSelectedCategory = null;
let posOperator = null; // Staff member operating POS for this transaction
let posClock = null;
let posAutoCheckin = true; // default ON for day entry check-in toggle

async function loadPOS() {
  const el = document.getElementById('page-pos');

  el.innerHTML = `
    <div class="flex h-[calc(100vh-0rem)]">
      <!-- Left: Categories + Products -->
      <div class="flex-1 flex flex-col bg-gray-100 overflow-hidden">
        <!-- Category Grid -->
        <div id="pos-category-grid" class="p-4 flex-shrink-0">
          <div class="grid grid-cols-5 gap-3" id="pos-categories-inner"></div>
        </div>

        <!-- Product Grid -->
        <div class="flex-1 overflow-y-auto px-4 pb-4">
          <div id="pos-product-grid" class="grid grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
            <p class="text-gray-400 text-center col-span-full py-12 text-sm">Select a category above</p>
          </div>
        </div>

        <!-- Bottom Bar -->
        <div class="bg-white border-t border-gray-200 px-4 py-2 flex items-center justify-between flex-shrink-0">
          <div class="flex items-center gap-2">
            <button onclick="navigateTo('dashboard')" class="w-10 h-10 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 transition" title="Back to dashboard">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
            </button>
            <button onclick="posProductSearch()" class="w-10 h-10 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 transition" title="Search products">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            </button>
            <button onclick="posQuickCheckIn()" class="w-10 h-10 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 transition" title="Quick check-in">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/></svg>
            </button>
          </div>
          <div class="flex items-center gap-2">
            <button onclick="posLinkProfile()" class="w-10 h-10 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 transition" title="Link member profile">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Right: Checkout Sidebar -->
      <div class="w-80 xl:w-96 bg-slate-800 text-white flex flex-col flex-shrink-0">
        <!-- Date/Time -->
        <div class="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
          <div>
            <div id="pos-date" class="text-xs text-slate-400"></div>
            <div id="pos-time" class="text-lg font-bold font-mono"></div>
          </div>
          <div class="flex items-center gap-2">
            <div class="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            <button onclick="posAddCustomItem()" class="w-8 h-8 rounded bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-slate-300" title="Add custom item">+</button>
          </div>
        </div>

        <!-- Operator badge -->
        <div id="pos-operator-badge" class="px-4 py-1 border-b border-slate-700"></div>

        <!-- Member / Warning -->
        <div id="pos-member-section" class="px-4 py-2 border-b border-slate-700">
          <div id="pos-member-display">
            <div class="bg-red-600/90 rounded-lg px-3 py-2 text-center animate-pulse">
              <p class="text-sm font-bold">WARNING!!! No Profile Linked</p>
            </div>
          </div>
        </div>

        <!-- Cart Items -->
        <div id="pos-cart-items" class="flex-1 overflow-y-auto px-4 py-2">
          <p class="text-slate-500 text-center text-sm py-8">Cart is empty</p>
        </div>

        <!-- Totals -->
        <div class="px-4 py-3 border-t border-slate-700">
          <div class="flex justify-between text-sm text-slate-400 mb-1">
            <span>Subtotal</span>
            <span id="pos-subtotal">£0.00</span>
          </div>
          <div class="flex justify-between text-sm text-slate-400 mb-2">
            <span>Tax (0%)</span>
            <span>£0.00</span>
          </div>
          <div class="flex justify-between text-xl font-bold mb-3">
            <span>TOTAL</span>
            <span id="pos-cart-total">£0.00</span>
          </div>

          <!-- Discounts placeholder -->
          <div class="text-xs text-slate-500 uppercase tracking-wider mb-3">Discounts</div>

          <!-- Payment buttons -->
          <div class="grid grid-cols-3 gap-2 mb-3">
            <button onclick="posPayMethod('dojo_card')" class="bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2.5 text-sm font-bold flex flex-col items-center gap-1 transition" id="pos-pay-dojo">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>
              Dojo
            </button>
            <button onclick="posPayMethod('voucher')" class="bg-purple-600 hover:bg-purple-700 text-white rounded-lg py-2.5 text-sm font-bold flex flex-col items-center gap-1 transition">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"/></svg>
              Voucher
            </button>
            <button onclick="posPayMethod('other')" class="bg-slate-600 hover:bg-slate-500 text-white rounded-lg py-2.5 text-sm font-bold flex flex-col items-center gap-1 transition">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              Other
            </button>
          </div>

          <!-- Action buttons -->
          <div class="grid grid-cols-3 gap-2">
            <button onclick="posCancelTx()" class="bg-red-700 hover:bg-red-600 text-white rounded-lg py-2 text-xs font-bold transition">Cancel Tx</button>
            <button onclick="posNewTx()" class="bg-blue-700 hover:bg-blue-600 text-white rounded-lg py-2 text-xs font-bold transition">New Tx</button>
            <button onclick="showDailySummaryModal()" class="bg-slate-600 hover:bg-slate-500 text-white rounded-lg py-2 text-xs font-bold transition">Show Totals</button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Start clock
  updatePosClock();
  posClock = setInterval(updatePosClock, 1000);

  await posLoadProducts();
  posRenderCart();
}

function updatePosClock() {
  const now = new Date();
  const dateEl = document.getElementById('pos-date');
  const timeEl = document.getElementById('pos-time');
  if (dateEl) dateEl.textContent = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  if (timeEl) timeEl.textContent = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// Category colours for visual distinction
const categoryColours = {
  'cat_cold_drinks': 'from-cyan-500 to-cyan-600',
  'cat_day_entry': 'from-blue-500 to-blue-600',
  'cat_events': 'from-violet-500 to-violet-600',
  'cat_food': 'from-amber-500 to-amber-600',
  'cat_hire': 'from-emerald-500 to-emerald-600',
  'cat_hot_drinks': 'from-orange-500 to-orange-600',
  'cat_membership': 'from-indigo-500 to-indigo-600',
  'cat_prepaid': 'from-teal-500 to-teal-600',
  'cat_products': 'from-slate-500 to-slate-600',
};

async function posLoadProducts() {
  const grouped = await api('GET', '/api/products/grouped');
  const categoriesInner = document.getElementById('pos-categories-inner');

  if (grouped.length === 0) {
    categoriesInner.innerHTML = '<p class="text-gray-400 text-center col-span-full py-8">No products yet</p>';
    return;
  }

  window._posProducts = grouped;

  categoriesInner.innerHTML = grouped.map(g => {
    const gradient = categoryColours[g.id] || 'from-gray-500 to-gray-600';
    return `
      <button onclick="posSelectCategory('${g.id}', this)" 
              class="pos-category-btn bg-gradient-to-br ${gradient} text-white rounded-xl p-3 text-left hover:shadow-lg hover:scale-[1.02] transition-all relative overflow-hidden"
              data-cat="${g.id}">
        <div class="text-2xl mb-1">${g.icon || '📦'}</div>
        <div class="font-bold text-xs sm:text-sm leading-tight">${g.name}</div>
        <div class="text-xs opacity-75">${g.products.length} items</div>
      </button>
    `;
  }).join('');
}

function posSelectCategory(categoryId, btn) {
  posSelectedCategory = categoryId;

  // Highlight active category
  document.querySelectorAll('.pos-category-btn').forEach(b => {
    b.classList.remove('ring-4', 'ring-white', 'ring-offset-2');
  });
  if (btn) {
    btn.classList.add('ring-4', 'ring-white', 'ring-offset-2');
  }

  posRenderProductGrid(categoryId);
}

function posRenderProductGrid(categoryId) {
  const gridEl = document.getElementById('pos-product-grid');
  const cat = window._posProducts.find(g => g.id === categoryId);
  if (!cat || cat.products.length === 0) {
    gridEl.innerHTML = '<p class="text-gray-400 text-center col-span-full py-8 text-sm">No products in this category</p>';
    return;
  }

  gridEl.innerHTML = cat.products.map(p => {
    const outOfStock = p.stock_enforce_limit && p.stock_count !== null && p.stock_count <= 0;
    return `
      <button onclick="posAddToCart('${p.id}')" 
              class="pos-product-card bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition ${outOfStock ? 'opacity-40' : ''}" 
              ${outOfStock ? 'disabled' : ''}>
        <div class="bg-blue-600 px-3 py-2">
          <span class="text-white text-sm font-bold leading-tight block truncate">${p.name}</span>
        </div>
        <div class="px-3 py-2">
          <span class="text-blue-700 font-bold text-lg">£${p.price.toFixed(2)}</span>
          ${p.product_code ? `<span class="text-gray-400 text-xs block mt-0.5">${p.product_code}</span>` : ''}
          ${p.stock_count !== null ? `<span class="text-xs text-gray-400">${p.stock_count} in stock</span>` : ''}
        </div>
      </button>
    `;
  }).join('');
}

async function posAddToCart(productId) {
  _doAddToCart(productId);
}

async function _doAddToCart(productId) {
  const product = await api('GET', `/api/products/${productId}`);
  if (!product) return;

  if (product.stock_enforce_limit && product.stock_count !== null && product.stock_count <= 0) {
    showToast('Out of stock', 'error');
    return;
  }

  const isDayEntry = posIsDayEntryProduct(product.name);

  // Day entry items are never merged — each one is a separate line with its own member assignment
  if (isDayEntry) {
    posCart.push({
      product_id: productId,
      description: product.name,
      unit_price: product.price,
      quantity: 1,
      total_price: product.price,
      is_day_entry: true,
      assigned_member: posSelectedMember ? { ...posSelectedMember } : null,
    });
  } else {
    const existing = posCart.find(item => item.product_id === productId && !item.is_day_entry);
    if (existing) {
      existing.quantity++;
      existing.total_price = existing.quantity * existing.unit_price;
    } else {
      posCart.push({
        product_id: productId,
        description: product.name,
        unit_price: product.price,
        quantity: 1,
        total_price: product.price,
        is_day_entry: false,
        assigned_member: null,
      });
    }
  }

  posRenderCart();
  if (posSelectedMember) posRenderMemberDisplay();
}

function posRenderOperatorBadge() {
  const el = document.getElementById('pos-operator-badge');
  if (!el || !posOperator) return;
  const initials = (posOperator.first_name[0] + posOperator.last_name[0]).toUpperCase();
  el.innerHTML = `<div class="flex items-center gap-2 text-xs text-slate-300">
    <div class="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white text-[10px] font-bold">${initials}</div>
    <span>${posOperator.first_name}</span>
  </div>`;
}

function posRemoveFromCart(index) {
  posCart.splice(index, 1);
  posRenderCart();
  if (posSelectedMember) posRenderMemberDisplay();
}

function posUpdateQuantity(index, delta) {
  posCart[index].quantity += delta;
  if (posCart[index].quantity <= 0) {
    posCart.splice(index, 1);
  } else {
    posCart[index].total_price = posCart[index].quantity * posCart[index].unit_price;
  }
  posRenderCart();
}

function posRenderCart() {
  const itemsEl = document.getElementById('pos-cart-items');
  const subtotalEl = document.getElementById('pos-subtotal');
  const totalEl = document.getElementById('pos-cart-total');

  if (!itemsEl) return;

  if (posCart.length === 0) {
    itemsEl.innerHTML = '<p class="text-slate-500 text-center text-sm py-8">Cart is empty</p>';
    subtotalEl.textContent = '£0.00';
    totalEl.textContent = '£0.00';
    return;
  }

  const total = posCart.reduce((sum, item) => sum + item.total_price, 0);

  itemsEl.innerHTML = posCart.map((item, i) => {
    const memberChip = item.is_day_entry ? (() => {
      const m = item.assigned_member;
      const label = m ? `${m.first_name} ${m.last_name}` : 'Tap to assign';
      const chipClass = m
        ? 'bg-blue-700 text-blue-100 hover:bg-blue-600'
        : 'bg-slate-600 text-slate-300 hover:bg-slate-500 border border-dashed border-slate-500';
      return `<button onclick="posAssignMemberToItem(${i})" class="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition mt-0.5 max-w-[140px] ${chipClass}">
        <svg class="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
        <span class="truncate">${label}</span>
      </button>`;
    })() : '';
    return `
    <div class="py-2 border-b border-slate-700/50">
      <div class="flex items-center justify-between">
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-white truncate">${item.description}</p>
          ${item.is_day_entry ? memberChip : `<p class="text-xs text-slate-400">£${item.unit_price.toFixed(2)} each</p>`}
        </div>
        <div class="flex items-center gap-1.5 ml-2">
          ${!item.is_day_entry ? `
            <button onclick="posUpdateQuantity(${i}, -1)" class="w-6 h-6 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 text-xs font-bold flex items-center justify-center">−</button>
            <span class="text-sm font-bold w-5 text-center">${item.quantity}</span>
            <button onclick="posUpdateQuantity(${i}, 1)" class="w-6 h-6 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 text-xs font-bold flex items-center justify-center">+</button>
          ` : ''}
          <span class="text-sm font-bold w-14 text-right">£${item.total_price.toFixed(2)}</span>
          <button onclick="posRemoveFromCart(${i})" class="text-slate-500 hover:text-red-400 ml-1">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
      </div>
    </div>`;
  }).join('');

  subtotalEl.textContent = `£${total.toFixed(2)}`;
  totalEl.textContent = `£${total.toFixed(2)}`;
}

// Member search/link for POS
function posLinkProfile() {
  showModal(`
    <div class="max-w-md mx-auto">
      <h3 class="text-lg font-bold text-gray-900 mb-4">Link Member Profile</h3>
      <input type="text" id="pos-member-search" placeholder="Search by name or scan QR..." 
        class="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        oninput="posSearchMembers(this.value)" autofocus>
      <div id="pos-member-results" class="mt-3 space-y-2 max-h-64 overflow-y-auto"></div>
      <div class="mt-4 text-right">
        <button onclick="closeModal()" class="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
      </div>
    </div>
  `);
  setTimeout(() => document.getElementById('pos-member-search')?.focus(), 100);
}

let posSearchTimeout = null;
function posSearchMembers(query) {
  clearTimeout(posSearchTimeout);
  if (query.length < 2) {
    document.getElementById('pos-member-results').innerHTML = '<p class="text-sm text-gray-400">Type at least 2 characters...</p>';
    return;
  }
  posSearchTimeout = setTimeout(async () => {
    try {
      // Check for QR code
      if (query.startsWith('BR-')) {
        const m = await api('GET', '/api/members/by-qr/' + encodeURIComponent(query));
        if (m) { posSelectMember(m); closeModal(); return; }
      }
      const results = await api('GET', '/api/members/search?q=' + encodeURIComponent(query) + '&limit=8');
      const container = document.getElementById('pos-member-results');
      if (results.length === 0) {
        container.innerHTML = '<p class="text-sm text-gray-400">No members found</p>';
        return;
      }
      container.innerHTML = results.map(m => {
        const initials = (m.first_name[0] + m.last_name[0]).toUpperCase();
        const colour = nameToColour(m.first_name + m.last_name);
        return `<div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-blue-50 cursor-pointer transition" onclick="posSelectMember(${JSON.stringify(m).replace(/"/g, '&quot;')}); closeModal();">
          <div class="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold" style="background:${colour}">${initials}</div>
          <div><div class="font-medium text-gray-900">${m.first_name} ${m.last_name}</div><div class="text-xs text-gray-500">${m.email || ''}</div></div>
        </div>`;
      }).join('');
    } catch (err) {
      document.getElementById('pos-member-results').innerHTML = '<p class="text-sm text-red-500">Search error</p>';
    }
  }, 200);
}

function posSelectMember(member) {
  posSelectedMember = member;
  posAutoCheckin = true;
  // Update any unassigned day entry items to this member
  posCart.forEach(item => {
    if (item.is_day_entry && !item.assigned_member) {
      item.assigned_member = { ...member };
    }
  });
  posRenderCart();
  posRenderMemberDisplay();
}

function posAssignMemberToItem(itemIndex) {
  const item = posCart[itemIndex];
  if (!item) return;
  showModal(`
    <div class="max-w-md mx-auto">
      <h3 class="text-lg font-bold text-gray-900 mb-1">Assign to Member</h3>
      <p class="text-sm text-gray-500 mb-4">${item.description}</p>
      <input type="text" id="pos-assign-search" placeholder="Search by name or scan QR..."
        class="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
        oninput="posSearchForAssign(this.value, ${itemIndex})" autofocus>
      <div id="pos-assign-results" class="mt-3 space-y-2 max-h-64 overflow-y-auto">
        <p class="text-sm text-gray-400">Type a name to search...</p>
      </div>
      <div class="mt-4 flex justify-between items-center">
        ${item.assigned_member
          ? `<button onclick="posCart[${itemIndex}].assigned_member=null; posRenderCart(); closeModal();" class="text-sm text-red-500 hover:text-red-700">Remove assignment</button>`
          : '<span></span>'}
        <button onclick="closeModal()" class="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
      </div>
    </div>
  `);
  setTimeout(() => document.getElementById('pos-assign-search')?.focus(), 100);
}

let posAssignSearchTimeout = null;
let posAssignSearchCache = []; // store results so onclick can reference by index safely

function posSelectAssignResult(itemIndex, resultIndex) {
  const m = posAssignSearchCache[resultIndex];
  if (!m) return;
  posCart[itemIndex].assigned_member = m;
  posRenderCart();
  closeModal();
}

function posSearchForAssign(query, itemIndex) {
  clearTimeout(posAssignSearchTimeout);
  const container = document.getElementById('pos-assign-results');
  if (query.length < 2) {
    container.innerHTML = '<p class="text-sm text-gray-400">Type a name to search...</p>';
    return;
  }
  posAssignSearchTimeout = setTimeout(async () => {
    try {
      if (query.startsWith('BR-') || query.startsWith('BRN-')) {
        const m = await api('GET', '/api/members/by-qr/' + encodeURIComponent(query));
        if (m) { posCart[itemIndex].assigned_member = m; posRenderCart(); closeModal(); return; }
      }
      const results = await api('GET', '/api/members/search?q=' + encodeURIComponent(query) + '&limit=8');
      if (!results.length) { container.innerHTML = '<p class="text-sm text-gray-400">No members found</p>'; return; }
      posAssignSearchCache = results;
      container.innerHTML = results.map((m, idx) => {
        const initials = (m.first_name[0] + m.last_name[0]).toUpperCase();
        const colour = nameToColour(m.first_name + m.last_name);
        return `<div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-blue-50 cursor-pointer transition"
          onclick="posSelectAssignResult(${itemIndex}, ${idx})">
          <div class="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0" style="background:${colour}">${initials}</div>
          <div><p class="font-medium text-gray-900 text-sm">${m.first_name} ${m.last_name}</p><p class="text-xs text-gray-500">${m.email || ''}</p></div>
        </div>`;
      }).join('');
    } catch (e) { container.innerHTML = '<p class="text-sm text-red-500">Search error</p>'; }
  }, 200);
}

function posRenderMemberDisplay() {
  const member = posSelectedMember;
  if (!member) return;
  const displayEl = document.getElementById('pos-member-display');
  const initials = getInitials(member.first_name, member.last_name).toUpperCase();
  const colour = nameToColour(member.first_name + member.last_name);
  const regPaid = member.registration_fee_paid === 1;
  const hasDayEntry = posCart.some(item => posIsDayEntryProduct(item.description));

  displayEl.innerHTML = `
    <div class="bg-slate-700 rounded-lg px-3 py-2">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0" style="background:${colour}">${initials}</div>
        <div class="flex-1 min-w-0">
          <span class="font-bold text-sm text-white block truncate">${member.first_name} ${member.last_name}</span>
          ${!regPaid ? '<span class="text-xs text-red-400">Reg fee not paid</span>' : ''}
        </div>
        <button onclick="posClearMember()" class="text-slate-400 hover:text-red-400 flex-shrink-0" title="Remove">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>
      ${hasDayEntry ? `
        <label class="flex items-center gap-2 mt-2 cursor-pointer select-none">
          <input type="checkbox" id="pos-auto-checkin-toggle" ${posAutoCheckin ? 'checked' : ''} onchange="posAutoCheckin = this.checked"
            class="w-4 h-4 rounded border-slate-500 text-green-500 focus:ring-green-400 bg-slate-600">
          <span class="text-xs text-green-400 font-medium">Check in ${member.first_name} now</span>
        </label>
      ` : ''}
    </div>
  `;
}

function posIsDayEntryProduct(productName) {
  const dayEntryNames = ['adult peak', 'adult off peak', 'concession', 'u18', 'u16', '8-10 entry', 'falclimb', 'family entry'];
  const lower = (productName || '').toLowerCase();
  return dayEntryNames.some(n => lower.includes(n));
}

function posIsMembershipProduct(productName) {
  const lower = (productName || '').toLowerCase();
  return lower.includes('dd') && (lower.includes('peak') || lower.includes('off peak') || lower.includes('falclimb') || lower.includes('family') || lower.includes('concession'));
}

function posMapProductToPassType(productName) {
  const lower = (productName || '').toLowerCase();
  if (lower.includes('8-10')) return { match: '8-10 Single Entry', category: 'single_entry' };
  if (lower.includes('u16') || lower.includes('under 16')) return { match: 'Under 16 Single Entry', category: 'single_entry' };
  if (lower.includes('concession') || lower.includes('u18')) return { match: 'Concession/Student/U18 Single Entry', category: 'single_entry' };
  return { match: 'Adult Single Entry', category: 'single_entry' };
}

function posClearMember() {
  posSelectedMember = null;
  const displayEl = document.getElementById('pos-member-display');
  if (displayEl) {
    displayEl.innerHTML = `
      <div class="bg-red-600/90 rounded-lg px-3 py-2 text-center animate-pulse">
        <p class="text-sm font-bold">WARNING!!! No Profile Linked</p>
      </div>
    `;
  }
}

async function posPayMethod(method) {
  if (posCart.length === 0) {
    showToast('Cart is empty', 'error');
    return;
  }

  const total = posCart.reduce((sum, item) => sum + item.total_price, 0);

  if (method === 'voucher') {
    const code = prompt('Enter voucher / gift card code:');
    if (!code) return;

    try {
      const card = await api('GET', `/api/giftcards/by-code/${encodeURIComponent(code)}`);
      if (!card) { showToast('Card not found', 'error'); return; }
      if (card.current_balance < total) {
        showToast(`Insufficient balance (£${card.current_balance.toFixed(2)})`, 'error');
        return;
      }
      // Process with gift card
      const savedCart = [...posCart];
      const savedMember = posSelectedMember;
      const savedAutoCheckin = posAutoCheckin;
      const txn = await api('POST', '/api/transactions', {
        member_id: posSelectedMember ? posSelectedMember.id : null,
        staff_id: posOperator ? posOperator.id : null,
        payment_method: 'gift_card',
        payment_status: 'completed',
        payment_reference: code,
        items: posCart,
      });
      await api('POST', '/api/giftcards/redeem', { code, amount: total, transactionId: txn.id });

      // Post-payment extras for voucher path
      let passIssued = null, checkedIn = false, membershipPurchased = false;
      if (savedMember) {
        const dayEntryItems = savedCart.filter(item => posIsDayEntryProduct(item.description));
        if (dayEntryItems.length > 0) {
          try {
            const passTypes = await api('GET', '/api/passes/types');
            const mapping = posMapProductToPassType(dayEntryItems[0].description);
            const passType = passTypes.find(pt => pt.name === mapping.match && pt.category === 'single_entry');
            if (passType) {
              const now = new Date(); const hour = now.getHours(); const day = now.getDay();
              const isPeak = !(day >= 1 && day <= 5) || hour < 10 || hour >= 16;
              passIssued = await api('POST', '/api/passes/issue', { memberId: savedMember.id, passTypeId: passType.id, isPeak, pricePaid: dayEntryItems[0].unit_price });
            }
            if (savedAutoCheckin) {
              try { const ci = await api('POST', '/api/checkin/process', { memberId: savedMember.id, method: 'pos' }); if (ci.success) checkedIn = true; } catch(e) {}
            }
          } catch(e) {}
        }
        if (savedCart.some(item => posIsMembershipProduct(item.description))) membershipPurchased = true;
      }

      posShowReceipt(txn, savedCart, savedMember, 'voucher', { passIssued, checkedIn, membershipPurchased });
      posCart = [];
      posSelectedMember = null;
      posAutoCheckin = true;
      return;
    } catch (err) {
      showToast('Voucher error: ' + err.message, 'error');
      return;
    }
  }

  // Dojo (card) or Other
  try {
    const paymentMethod = method === 'dojo_card' ? 'dojo_card' : method;
    const savedCart = [...posCart];
    const savedMember = posSelectedMember;
    const savedAutoCheckin = posAutoCheckin;
    const txn = await api('POST', '/api/transactions', {
      member_id: posSelectedMember ? posSelectedMember.id : null,
      staff_id: posOperator ? posOperator.id : null,
      payment_method: paymentMethod,
      payment_status: 'completed',
      items: posCart,
      notes: null,
    });

    if (savedMember && savedMember.email) {
      api('POST', `/api/transactions/${txn.id}/send-receipt`).then(r => {
        if (r && r.success) showToast('Receipt emailed', 'info');
      }).catch(() => {});
    }

    // Post-payment: handle Day Entry and Membership products
    let passIssued = null;
    let checkedIn = false;
    let membershipPurchased = false;

    {
      // Day Entry: issue pass per assigned member, auto check-in each
      const dayEntryItems = savedCart.filter(item => posIsDayEntryProduct(item.description));
      if (dayEntryItems.length > 0) {
        try {
          const passTypes = await api('GET', '/api/passes/types');
          const now = new Date();
          const hour = now.getHours();
          const day = now.getDay();
          const isWeekday = day >= 1 && day <= 5;
          const isPeak = !isWeekday || hour < 10 || hour >= 16;

          for (const deItem of dayEntryItems) {
            const targetMember = deItem.assigned_member || savedMember;
            if (!targetMember) continue;
            const mapping = posMapProductToPassType(deItem.description);
            const passType = passTypes.find(pt => pt.name === mapping.match && pt.category === 'single_entry');
            if (passType) {
              const p = await api('POST', '/api/passes/issue', {
                memberId: targetMember.id,
                passTypeId: passType.id,
                isPeak,
                pricePaid: deItem.unit_price
              });
              if (!passIssued) passIssued = p; // keep first for receipt display
            }
            if (savedAutoCheckin) {
              try {
                const ci = await api('POST', '/api/checkin/process', { memberId: targetMember.id, method: 'pos' });
                if (ci.success) checkedIn = true;
              } catch (e) {}
            }
          }
        } catch (e) { console.warn('Day entry pass issue failed:', e); }
      }

      // Membership: flag for QR code display
      const membershipItems = savedCart.filter(item => posIsMembershipProduct(item.description));
      if (membershipItems.length > 0) {
        membershipPurchased = true;
      }
    }

    posShowReceipt(txn, savedCart, savedMember, paymentMethod, { passIssued, checkedIn, membershipPurchased });
    posCart = [];
    posSelectedMember = null;
    posAutoCheckin = true;
    await posLoadProducts(); // Refresh stock
  } catch (err) {
    showToast('Payment failed: ' + err.message, 'error');
  }
}

function posCancelTx() {
  posCart = [];
  posAutoCheckin = true;
  posClearMember();
  posRenderCart();
  showToast('Transaction cancelled', 'info');
}

function posShowReceipt(txn, items, member, paymentMethod, extras = {}) {
  const cartEl = document.getElementById('pos-cart-items');
  const now = new Date();
  const methodLabels = { dojo_card: 'Card (Dojo)', voucher: 'Voucher / Gift Card', gift_card: 'Voucher / Gift Card', other: 'Other' };
  const methodLabel = methodLabels[paymentMethod] || paymentMethod;
  const { passIssued, checkedIn, membershipPurchased } = extras;

  cartEl.innerHTML = `
    <div class="text-center py-3">
      <div class="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-2">
        <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
      </div>
      <p class="text-white font-bold text-sm">Payment Complete</p>
      <p class="text-slate-400 text-xs mt-1">${now.toLocaleDateString('en-GB')} ${now.toLocaleTimeString('en-GB', {hour:'2-digit',minute:'2-digit'})}</p>
      ${member ? `<p class="text-slate-300 text-xs mt-1">${member.first_name} ${member.last_name}</p>` : ''}
    </div>
    <div class="border-t border-slate-700 py-2">
      ${items.map(item => `
        <div class="flex justify-between py-1 text-sm">
          <span class="text-slate-300">${item.quantity}x ${item.description}</span>
          <span class="text-white font-medium">£${item.total_price.toFixed(2)}</span>
        </div>
      `).join('')}
    </div>

    ${passIssued ? `
      <div class="border-t border-slate-700 py-2">
        <div class="flex items-center gap-2 text-green-400 text-sm">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          <span>Pass issued: ${passIssued.pass_name || 'Day Entry'}</span>
        </div>
        ${checkedIn ? `
          <div class="flex items-center gap-2 text-green-400 text-sm mt-1">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
            <span>Checked in</span>
          </div>
        ` : ''}
      </div>
    ` : ''}

    ${membershipPurchased && member ? `
      <div class="border-t border-slate-700 py-3">
        <p class="text-xs text-slate-400 uppercase tracking-wider mb-2">Membership QR Code</p>
        <div class="bg-white rounded-lg p-3 text-center">
          <img src="/api/members/${member.id}/qr-code?size=200" alt="QR Code" class="mx-auto" style="width:150px;height:150px;">
          <p class="text-gray-500 text-xs mt-1">${member.qr_code || ''}</p>
        </div>
        <div class="flex gap-2 mt-2">
          <a href="/api/members/${member.id}/qr-code?size=400" download="boulderryn-qr.png" class="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-bold text-center transition">Download QR</a>
          ${member.email ? `<button onclick="posSendQrEmail('${member.id}')" class="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition">Email QR</button>` : ''}
        </div>
      </div>
    ` : ''}

    <div class="border-t border-slate-600 py-2">
      <div class="flex justify-between text-sm font-bold">
        <span class="text-white">TOTAL</span>
        <span class="text-green-400">£${txn.total_amount.toFixed(2)}</span>
      </div>
      <p class="text-slate-400 text-xs mt-1">Paid via ${methodLabel}</p>
      <p class="text-slate-500 text-xs">Ref: ${txn.id.split('-')[0]}</p>
    </div>
    <button onclick="posNewTx(); posRenderCart();" class="w-full mt-3 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold transition">
      New Transaction
    </button>
  `;

  // Update totals display
  document.getElementById('pos-subtotal').textContent = `£${txn.total_amount.toFixed(2)}`;
  document.getElementById('pos-cart-total').textContent = `£${txn.total_amount.toFixed(2)}`;
}

async function posSendQrEmail(memberId) {
  try {
    const result = await api('POST', `/api/members/${memberId}/send-qr-email`);
    if (result.success) {
      showToast('QR code emailed successfully', 'success');
    } else {
      showToast('Email failed: ' + (result.error || 'Unknown error'), 'error');
    }
  } catch (err) {
    showToast('Email failed: ' + err.message, 'error');
  }
}

function posNewTx() {
  posCart = [];
  posSelectedMember = null;
  posOperator = null;
  posAutoCheckin = true;
  posClearMember();
  posRenderCart();
  // Clear operator badge
  const badge = document.getElementById('pos-operator-badge');
  if (badge) badge.innerHTML = '';
}

function posProductSearch() {
  showModal(`
    <div class="max-w-md mx-auto">
      <h3 class="text-lg font-bold text-gray-900 mb-4">Search Products</h3>
      <input type="text" id="pos-product-search-input" placeholder="Search products..."
        class="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        oninput="posFilterProductSearch(this.value)" autofocus>
      <div id="pos-product-search-results" class="mt-3 space-y-1 max-h-64 overflow-y-auto"></div>
      <div class="mt-4 text-right">
        <button onclick="closeModal()" class="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
      </div>
    </div>
  `);
  setTimeout(() => document.getElementById('pos-product-search-input')?.focus(), 100);
}

function posFilterProductSearch(query) {
  const container = document.getElementById('pos-product-search-results');
  if (!query || query.length < 2 || !window._posProducts) {
    container.innerHTML = '<p class="text-sm text-gray-400">Type at least 2 characters...</p>';
    return;
  }
  const matches = [];
  window._posProducts.forEach(g => {
    g.products.forEach(p => {
      if (p.name.toLowerCase().includes(query.toLowerCase())) matches.push(p);
    });
  });
  if (matches.length === 0) {
    container.innerHTML = '<p class="text-sm text-gray-400">No products found</p>';
    return;
  }
  container.innerHTML = matches.slice(0, 15).map(p =>
    `<div class="flex items-center justify-between p-2 bg-gray-50 rounded-lg hover:bg-blue-50 cursor-pointer transition" onclick="closeModal(); posAddToCart('${p.id}')">
      <span class="text-sm font-medium text-gray-900">${p.name}</span>
      <span class="text-sm text-gray-500">&pound;${p.price.toFixed(2)}</span>
    </div>`
  ).join('');
}

function _posShowSearchResults(query) {
  if (!window._posProducts) return;
  const matches = [];
  window._posProducts.forEach(g => {
    g.products.forEach(p => {
      if (p.name.toLowerCase().includes(query.toLowerCase())) {
        matches.push(p);
      }
    });
  });

  if (matches.length === 0) {
    showToast('No products found', 'info');
    return;
  }

  // Show matches in product grid
  const gridEl = document.getElementById('pos-product-grid');
  gridEl.innerHTML = `
    <div class="col-span-full mb-2">
      <span class="text-sm text-gray-500">${matches.length} results for "${query}"</span>
      <button onclick="posRenderProductGrid(posSelectedCategory || window._posProducts[0]?.id)" class="text-blue-600 text-sm ml-2 hover:underline">Clear search</button>
    </div>
    ${matches.map(p => `
      <button onclick="posAddToCart('${p.id}')" 
              class="pos-product-card bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition">
        <div class="bg-blue-600 px-3 py-2">
          <span class="text-white text-sm font-bold leading-tight block truncate">${p.name}</span>
        </div>
        <div class="px-3 py-2">
          <span class="text-blue-700 font-bold text-lg">£${p.price.toFixed(2)}</span>
          ${p.product_code ? `<span class="text-gray-400 text-xs block mt-0.5">${p.product_code}</span>` : ''}
        </div>
      </button>
    `).join('')}
  `;
}

function posQuickCheckIn() {
  const query = prompt('Check in - Enter member name or QR code:');
  if (!query) return;
  
  (async () => {
    try {
      let memberId;
      if (query.startsWith('BR-')) {
        const m = await api('GET', `/api/members/by-qr/${encodeURIComponent(query)}`);
        if (m) memberId = m.id;
      } else {
        const results = await api('GET', `/api/members/search?q=${encodeURIComponent(query)}&limit=1`);
        if (results.length > 0) memberId = results[0].id;
      }

      if (!memberId) { showToast('Member not found', 'error'); return; }

      const result = await api('POST', '/api/checkin/process', { memberId });
      if (result.success) {
        showToast(`${result.member.first_name} checked in`, 'success');
        if (result.registrationWarning) {
          showToast('REGISTRATION FEE NOT PAID', 'error');
        }
      } else {
        showToast(result.error, 'error');
      }
    } catch (err) {
      showToast('Check-in error: ' + err.message, 'error');
    }
  })();
}

function posAddCustomItem() {
  showModal(`
    <div class="max-w-sm mx-auto p-2">
      <h3 class="text-lg font-bold text-gray-900 mb-4">Custom Item</h3>
      <div class="space-y-3">
        <div>
          <label class="block text-xs text-gray-500 mb-1">Item Name</label>
          <input type="text" id="custom-item-name" class="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="e.g. Shoe repair">
        </div>
        <div>
          <label class="block text-xs text-gray-500 mb-1">Price (&pound;)</label>
          <input type="number" id="custom-item-price" step="0.01" min="0" class="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="0.00">
        </div>
      </div>
      <div class="mt-4 flex gap-2 justify-end">
        <button onclick="closeModal()" class="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
        <button onclick="posSubmitCustomItem()" class="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">Add to Cart</button>
      </div>
    </div>
  `);
  setTimeout(() => document.getElementById('custom-item-name')?.focus(), 100);
}

function posSubmitCustomItem() {
  const name = document.getElementById('custom-item-name').value.trim();
  const price = parseFloat(document.getElementById('custom-item-price').value);
  if (!name) { showToast('Enter item name', 'error'); return; }
  if (isNaN(price) || price < 0) { showToast('Invalid price', 'error'); return; }

  // Custom items also need operator
  if (!posOperator) {
    closeModal();
    requirePin('pos', (staff) => {
      posOperator = staff;
      posRenderOperatorBadge();
      _addCustomToCart(name, price);
    }, 'Staff PIN', 'Identify yourself');
    return;
  }
  _addCustomToCart(name, price);
}

function _addCustomToCart(name, price) {
  posCart.push({
    product_id: null,
    description: name,
    unit_price: price,
    quantity: 1,
    total_price: price,
  });
  posRenderCart();
  closeModal();
}

async function showDailySummaryModal() {
  try {
    const summary = await api('GET', '/api/transactions/daily-summary');

    // Reset modal width
    document.getElementById('modal-content').className = 'bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto';

    showModal(`
      <div class="p-6">
        <h3 class="text-xl font-bold mb-4">End of Day — ${summary.date}</h3>

        <div class="grid grid-cols-3 gap-4 mb-6">
          <div class="card">
            <div class="card-header">Transactions</div>
            <div class="card-value">${summary.totals.transaction_count}</div>
          </div>
          <div class="card">
            <div class="card-header">Total Sales</div>
            <div class="card-value">£${summary.totals.total_sales.toFixed(2)}</div>
          </div>
          <div class="card">
            <div class="card-header">Net Total</div>
            <div class="card-value">£${summary.totals.net_total.toFixed(2)}</div>
          </div>
        </div>

        ${summary.totals.total_refunds > 0 ? `
          <div class="bg-red-50 rounded-lg p-3 mb-4">
            <span class="text-sm font-semibold text-red-800">Refunds: £${summary.totals.total_refunds.toFixed(2)}</span>
          </div>
        ` : ''}

        <h4 class="font-semibold text-sm text-gray-500 uppercase mb-2">By Payment Method</h4>
        <div class="space-y-2 mb-4">
          ${summary.byMethod.map(m => `
            <div class="flex justify-between items-center py-1">
              <span class="text-sm">${m.payment_method === 'dojo_card' ? 'Card (Dojo)' : m.payment_method}</span>
              <span class="font-semibold">£${m.net_total.toFixed(2)} <span class="text-gray-400 text-xs">(${m.transaction_count} txns)</span></span>
            </div>
          `).join('')}
        </div>

        ${summary.byCategory.length > 0 ? `
          <h4 class="font-semibold text-sm text-gray-500 uppercase mb-2">By Category</h4>
          <div class="space-y-2 mb-4">
            ${summary.byCategory.map(c => `
              <div class="flex justify-between items-center py-1">
                <span class="text-sm">${c.category || 'Uncategorised'}</span>
                <span class="font-semibold">£${c.total.toFixed(2)}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}

        ${summary.topProducts.length > 0 ? `
          <h4 class="font-semibold text-sm text-gray-500 uppercase mb-2">Top Products</h4>
          <div class="space-y-2">
            ${summary.topProducts.map(p => `
              <div class="flex justify-between items-center py-1">
                <span class="text-sm">${p.description} <span class="text-gray-400">(x${p.qty})</span></span>
                <span class="font-semibold">£${p.revenue.toFixed(2)}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}

        <div class="flex justify-end mt-6">
          <button onclick="closeModal()" class="btn btn-secondary">Close</button>
        </div>
      </div>
    `);
  } catch (err) {
    showToast('Error loading summary: ' + err.message, 'error');
  }
}
