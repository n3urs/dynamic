/**
 * BoulderRyn — Frontend Application (Web Version)
 * Complete overhaul matching BETA gym software
 */

// ============================================================
// API Helper
// ============================================================

async function api(method, url, body = null) {
  const opts = { method, headers: {} };
  if (body !== null) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(url, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

// ============================================================
// Utility
// ============================================================

function nameToColour(name) {
  const colours = [
    '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
    '#EC4899', '#06B6D4', '#F97316', '#6366F1', '#14B8A6',
    '#E11D48', '#0EA5E9', '#84CC16', '#A855F7', '#D946EF'
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colours[Math.abs(hash) % colours.length];
}

function getInitials(firstName, lastName) {
  return ((firstName || '')[0] || '') + ((lastName || '')[0] || '');
}

function calculateAge(dob) {
  if (!dob) return null;
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ============================================================
// Role Helpers
// ============================================================

const ROLE_DISPLAY_NAMES = {
  centre_assistant: 'Centre Assistant',
  duty_manager: 'Duty Manager',
  setter: 'Route Setter',
  tech_lead: 'Tech Lead',
  owner: 'Owner',
};

const ROLE_BADGE_CLASSES = {
  owner: 'bg-purple-100 text-purple-800',
  tech_lead: 'bg-blue-100 text-blue-800',
  duty_manager: 'bg-green-100 text-green-800',
  centre_assistant: 'bg-slate-100 text-slate-700',
  setter: 'bg-orange-100 text-orange-800',
};

const ROLE_SIDEBAR_COLOURS = {
  owner: 'bg-purple-600',
  tech_lead: 'bg-blue-600',
  duty_manager: 'bg-green-600',
  centre_assistant: 'bg-slate-500',
  setter: 'bg-orange-500',
};

function getRoleDisplayName(role) {
  return ROLE_DISPLAY_NAMES[role] || role;
}

function getRoleBadgeHTML(role, size = 'sm') {
  const cls = ROLE_BADGE_CLASSES[role] || 'bg-gray-100 text-gray-700';
  const padding = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';
  return `<span class="${cls} ${padding} rounded-full font-medium">${getRoleDisplayName(role)}</span>`;
}

// ============================================================
// Auth / Login System
// ============================================================

window.currentStaff = null;

async function initAuth() {
  // Check localStorage for existing session
  const saved = localStorage.getItem('boulderryn_staff');
  if (saved) {
    try {
      const staff = JSON.parse(saved);
      // Verify staff still exists and is active
      const verified = await api('GET', `/api/staff/${staff.id}`);
      if (verified && verified.is_active) {
        window.currentStaff = verified;
        onLoginSuccess();
        return;
      }
    } catch (e) {
      localStorage.removeItem('boulderryn_staff');
    }
  }

  // Check if any staff exist
  try {
    const { count } = await api('GET', '/api/staff/count');
    if (count === 0) {
      showFirstRunSetup();
    } else {
      showPinLogin();
    }
  } catch (e) {
    showPinLogin();
  }
}

function showFirstRunSetup() {
  const container = document.getElementById('login-container');
  container.innerHTML = `
    <div class="text-center mb-8">
      <h1 class="text-3xl font-bold text-white tracking-tight">BoulderRyn</h1>
      <p class="text-slate-400 mt-2">First Time Setup</p>
    </div>
    <div class="bg-slate-800 rounded-2xl p-6 shadow-2xl border border-slate-700">
      <h2 class="text-lg font-semibold text-white mb-1">Create First Staff Account</h2>
      <p class="text-slate-400 text-sm mb-6">This will be the owner account with full access.</p>
      <form id="first-run-form" onsubmit="handleFirstRunSetup(event)">
        <div class="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label class="block text-xs text-slate-400 mb-1">First Name</label>
            <input type="text" name="first_name" value="Oscar" required class="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
          </div>
          <div>
            <label class="block text-xs text-slate-400 mb-1">Last Name</label>
            <input type="text" name="last_name" value="Sullivan" required class="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
          </div>
        </div>
        <div class="mb-3">
          <label class="block text-xs text-slate-400 mb-1">Email</label>
          <input type="email" name="email" value="oscar@sullivanltd.co.uk" required class="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
        </div>
        <div class="mb-3">
          <label class="block text-xs text-slate-400 mb-1">4-Digit PIN</label>
          <input type="text" name="pin" maxlength="4" pattern="[0-9]{4}" value="1234" required class="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-center text-xl tracking-[0.5em] font-mono">
        </div>
        <div class="mb-4">
          <label class="block text-xs text-slate-400 mb-1">Password (optional)</label>
          <input type="password" name="password" class="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
        </div>
        <div id="first-run-error" class="text-red-400 text-sm mb-3 hidden"></div>
        <button type="submit" class="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition">Create Owner Account</button>
      </form>
      <div class="mt-4 text-center">
        <button onclick="handleSeedOwner()" class="text-slate-400 hover:text-white text-sm transition underline">Use default (Oscar Sullivan, PIN: 1234)</button>
      </div>
    </div>
  `;
}

async function handleFirstRunSetup(e) {
  e.preventDefault();
  const form = document.getElementById('first-run-form');
  const data = Object.fromEntries(new FormData(form));
  data.role = 'owner';
  const errEl = document.getElementById('first-run-error');

  try {
    const staff = await api('POST', '/api/staff', data);
    if (staff.error) throw new Error(staff.error);
    window.currentStaff = staff;
    localStorage.setItem('boulderryn_staff', JSON.stringify(staff));
    onLoginSuccess();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  }
}

async function handleSeedOwner() {
  try {
    const result = await api('POST', '/api/staff/seed-owner');
    if (result.created) {
      // Auto-login with PIN 1234
      const staff = await api('POST', '/api/staff/auth/pin', { pin: '1234' });
      if (staff && !staff.error) {
        window.currentStaff = staff;
        localStorage.setItem('boulderryn_staff', JSON.stringify(staff));
        onLoginSuccess();
      }
    } else {
      showPinLogin();
    }
  } catch (err) {
    const errEl = document.getElementById('first-run-error');
    if (errEl) { errEl.textContent = err.message; errEl.classList.remove('hidden'); }
  }
}

let pinValue = '';

function showPinLogin() {
  pinValue = '';
  const container = document.getElementById('login-container');
  container.innerHTML = `
    <div class="text-center mb-8">
      <h1 class="text-3xl font-bold text-white tracking-tight">BoulderRyn</h1>
      <p class="text-slate-400 mt-2">Enter your PIN to continue</p>
    </div>
    <div class="bg-slate-800 rounded-2xl p-6 shadow-2xl border border-slate-700">
      <!-- PIN Dots -->
      <div class="flex justify-center gap-4 mb-8" id="pin-dots">
        <div class="w-5 h-5 rounded-full border-2 border-slate-500 transition-all duration-150"></div>
        <div class="w-5 h-5 rounded-full border-2 border-slate-500 transition-all duration-150"></div>
        <div class="w-5 h-5 rounded-full border-2 border-slate-500 transition-all duration-150"></div>
        <div class="w-5 h-5 rounded-full border-2 border-slate-500 transition-all duration-150"></div>
      </div>
      <div id="pin-error" class="text-red-400 text-sm text-center mb-4 h-5"></div>
      <!-- Number Pad -->
      <div class="grid grid-cols-3 gap-3 max-w-[280px] mx-auto">
        ${[1,2,3,4,5,6,7,8,9].map(n => `
          <button onclick="pinPress('${n}')" class="h-16 rounded-xl bg-slate-700 hover:bg-slate-600 active:bg-slate-500 text-white text-2xl font-semibold transition-all duration-100 select-none">${n}</button>
        `).join('')}
        <button onclick="pinClear()" class="h-16 rounded-xl bg-slate-700/50 hover:bg-slate-600 text-slate-300 text-sm font-medium transition select-none">Clear</button>
        <button onclick="pinPress('0')" class="h-16 rounded-xl bg-slate-700 hover:bg-slate-600 active:bg-slate-500 text-white text-2xl font-semibold transition-all duration-100 select-none">0</button>
        <button onclick="pinBackspace()" class="h-16 rounded-xl bg-slate-700/50 hover:bg-slate-600 text-slate-300 transition select-none flex items-center justify-center">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414-6.414A2 2 0 0110.828 5H21a1 1 0 011 1v12a1 1 0 01-1 1H10.828a2 2 0 01-1.414-.586L3 12z"/></svg>
        </button>
      </div>
      <div class="mt-6 text-center">
        <button onclick="showEmailLogin()" class="text-slate-400 hover:text-white text-sm transition">Login with email instead</button>
      </div>
    </div>
  `;
  document.getElementById('login-overlay').classList.remove('hidden');
}

function updatePinDots() {
  const dots = document.querySelectorAll('#pin-dots div');
  dots.forEach((dot, i) => {
    if (i < pinValue.length) {
      dot.className = 'w-5 h-5 rounded-full bg-blue-500 border-2 border-blue-500 transition-all duration-150 scale-110';
    } else {
      dot.className = 'w-5 h-5 rounded-full border-2 border-slate-500 transition-all duration-150';
    }
  });
}

function pinPress(digit) {
  if (pinValue.length >= 4) return;
  pinValue += digit;
  updatePinDots();
  document.getElementById('pin-error').textContent = '';

  if (pinValue.length === 4) {
    attemptPinLogin(pinValue);
  }
}

function pinClear() {
  pinValue = '';
  updatePinDots();
  document.getElementById('pin-error').textContent = '';
}

function pinBackspace() {
  pinValue = pinValue.slice(0, -1);
  updatePinDots();
  document.getElementById('pin-error').textContent = '';
}

async function attemptPinLogin(pin) {
  try {
    const result = await api('POST', '/api/staff/auth/pin', { pin });
    if (result.error) {
      document.getElementById('pin-error').textContent = 'Invalid PIN';
      pinValue = '';
      updatePinDots();
      // Shake animation
      const dots = document.getElementById('pin-dots');
      dots.classList.add('animate-shake');
      setTimeout(() => dots.classList.remove('animate-shake'), 500);
      return;
    }
    window.currentStaff = result;
    localStorage.setItem('boulderryn_staff', JSON.stringify(result));
    onLoginSuccess();
  } catch (err) {
    document.getElementById('pin-error').textContent = 'Login failed';
    pinValue = '';
    updatePinDots();
  }
}

function showEmailLogin() {
  const container = document.getElementById('login-container');
  container.innerHTML = `
    <div class="text-center mb-8">
      <h1 class="text-3xl font-bold text-white tracking-tight">BoulderRyn</h1>
      <p class="text-slate-400 mt-2">Login with email</p>
    </div>
    <div class="bg-slate-800 rounded-2xl p-6 shadow-2xl border border-slate-700">
      <form id="email-login-form" onsubmit="handleEmailLogin(event)">
        <div class="mb-4">
          <label class="block text-xs text-slate-400 mb-1">Email</label>
          <input type="email" name="email" required autofocus class="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" placeholder="you@example.com">
        </div>
        <div class="mb-4">
          <label class="block text-xs text-slate-400 mb-1">Password</label>
          <input type="password" name="password" required class="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
        </div>
        <div id="email-login-error" class="text-red-400 text-sm mb-3 hidden"></div>
        <button type="submit" class="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition">Login</button>
      </form>
      <div class="mt-4 text-center">
        <button onclick="showPinLogin()" class="text-slate-400 hover:text-white text-sm transition">Back to PIN login</button>
      </div>
    </div>
  `;
}

async function handleEmailLogin(e) {
  e.preventDefault();
  const form = document.getElementById('email-login-form');
  const data = Object.fromEntries(new FormData(form));
  const errEl = document.getElementById('email-login-error');

  try {
    const result = await api('POST', '/api/staff/auth/password', data);
    if (result.error) {
      errEl.textContent = result.error;
      errEl.classList.remove('hidden');
      return;
    }
    window.currentStaff = result;
    localStorage.setItem('boulderryn_staff', JSON.stringify(result));
    onLoginSuccess();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  }
}

function onLoginSuccess() {
  const overlay = document.getElementById('login-overlay');
  overlay.classList.add('hidden');
  updateStaffBadge();
  enforcePermissions();
  navigateTo('dashboard');
}

function lockScreen() {
  window.currentStaff = null;
  localStorage.removeItem('boulderryn_staff');
  document.getElementById('staff-badge-container').classList.add('hidden');
  showPinLogin();
}

function updateStaffBadge() {
  const staff = window.currentStaff;
  if (!staff) return;

  const container = document.getElementById('staff-badge-container');
  const initialsEl = document.getElementById('staff-badge-initials');
  const nameEl = document.getElementById('staff-badge-name');
  const roleEl = document.getElementById('staff-badge-role');

  const initials = getInitials(staff.first_name, staff.last_name).toUpperCase();
  initialsEl.textContent = initials;
  initialsEl.className = `w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${ROLE_SIDEBAR_COLOURS[staff.role] || 'bg-slate-500'}`;
  nameEl.textContent = `${staff.first_name} ${staff.last_name}`;

  const badgeCls = ROLE_BADGE_CLASSES[staff.role] || 'bg-gray-100 text-gray-700';
  roleEl.className = `text-xs px-1.5 py-0.5 rounded-full font-medium ${badgeCls}`;
  roleEl.textContent = getRoleDisplayName(staff.role);

  container.classList.remove('hidden');
}

// ============================================================
// Permission Enforcement
// ============================================================

function staffHasPermission(perm) {
  if (!window.currentStaff) return false;
  const role = window.currentStaff.role;
  if (role === 'owner' || role === 'tech_lead') return true;
  const perms = window.currentStaff.permissions || {};
  return !!perms[perm];
}

function enforcePermissions() {
  const navLinks = document.querySelectorAll('#nav-links .nav-link');
  navLinks.forEach(link => {
    const perm = link.dataset.perm;
    if (!perm) return;
    const li = link.closest('li');
    if (staffHasPermission(perm)) {
      li.classList.remove('hidden');
      link.classList.remove('opacity-40', 'pointer-events-none');
    } else {
      li.classList.add('hidden');
    }
  });
}

// ============================================================
// Member Card Component
// ============================================================

function renderMemberCard(m, options = {}) {
  const { showCheckin = true, compact = false } = options;
  const initials = getInitials(m.first_name, m.last_name).toUpperCase();
  const colour = nameToColour(m.first_name + m.last_name);
  const age = calculateAge(m.date_of_birth);
  const isUnder18 = age !== null && age < 18;
  const regPaid = m.registration_fee_paid === 1;
  const name = `${m.first_name} ${m.last_name}`.toUpperCase();

  return `
    <div class="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md hover:border-blue-300 transition cursor-pointer flex items-start gap-3"
         onclick="openMemberProfile('${m.id}')">
      <div class="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
           style="background:${colour}">
        ${initials}
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <span class="font-bold text-sm text-gray-900">${name}</span>
          ${!regPaid ? '<span class="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" title="Registration fee not paid">!</span>' : '<span class="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center text-white text-xs flex-shrink-0"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg></span>'}
        </div>
        <p class="text-xs text-gray-500 truncate">${m.email || 'No email'}</p>
        ${m.date_of_birth ? `
          <p class="text-xs mt-0.5">
            <span class="text-gray-400">${formatDate(m.date_of_birth)}</span>
            ${age !== null ? `<span class="${isUnder18 ? 'text-blue-600 font-bold' : 'text-gray-500'} ml-1">(${age})</span>` : ''}
          </p>
        ` : ''}
      </div>
      ${showCheckin ? `
        <button onclick="event.stopPropagation(); quickCheckIn('${m.id}')" 
                class="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-50 hover:bg-blue-100 flex items-center justify-center text-blue-600 transition"
                title="Check in">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>
        </button>
      ` : ''}
    </div>
  `;
}

async function quickCheckIn(memberId) {
  try {
    const result = await api('POST', '/api/checkin/process', { memberId });
    if (result.success) {
      showToast(`${result.member.first_name} checked in`, 'success');
      if (result.registrationWarning) {
        showToast('REGISTRATION FEE NOT PAID — Add £3.00 to next transaction', 'error');
      }
      if (document.getElementById('page-dashboard').classList.contains('active')) {
        loadActiveVisitors();
      }
    } else {
      showToast(result.error, 'error');
    }
  } catch (err) {
    showToast('Check-in failed: ' + err.message, 'error');
  }
}

// ============================================================
// Navigation
// ============================================================

const pages = ['dashboard', 'checkin', 'members', 'pos', 'events', 'routes', 'analytics', 'staff'];

function navigateTo(pageName) {
  // Permission check
  const navLink = document.querySelector(`[data-page="${pageName}"]`);
  const perm = navLink ? navLink.dataset.perm : null;
  if (perm && !staffHasPermission(perm)) {
    showAccessDenied(pageName);
    return;
  }

  pages.forEach(p => {
    const el = document.getElementById(`page-${p}`);
    if (el) el.classList.remove('active');
  });

  document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));

  const pageEl = document.getElementById(`page-${pageName}`);
  if (pageEl) pageEl.classList.add('active');

  if (navLink) navLink.classList.add('active');

  // Remove padding and hide sidebar for POS page
  const container = document.getElementById('page-container');
  const sidebar = document.getElementById('sidebar');
  if (pageName === 'pos') {
    container.classList.remove('p-6');
    container.classList.add('p-0');
    if (sidebar) sidebar.classList.add('hidden');
  } else {
    container.classList.remove('p-0');
    container.classList.add('p-6');
    if (sidebar) sidebar.classList.remove('hidden');
  }

  loadPage(pageName);
}

function showAccessDenied(pageName) {
  const pageEl = document.getElementById(`page-${pageName}`);
  if (pageEl) {
    pages.forEach(p => { const el = document.getElementById(`page-${p}`); if (el) el.classList.remove('active'); });
    pageEl.classList.add('active');
    pageEl.innerHTML = `
      <div class="flex flex-col items-center justify-center py-24">
        <div class="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
          <svg class="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
        </div>
        <h2 class="text-xl font-bold text-gray-900">Access Denied</h2>
        <p class="text-gray-500 mt-2">You don't have permission to access this page.</p>
        <button onclick="navigateTo('dashboard')" class="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">Back to Visitors</button>
      </div>
    `;
  }
}

document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    navigateTo(link.dataset.page);
  });
});

// ============================================================
// Page Loaders
// ============================================================

async function loadPage(pageName) {
  switch (pageName) {
    case 'dashboard': return loadDashboard();
    case 'checkin': return loadCheckIn();
    case 'members': return loadMembers();
    case 'pos': return loadPOS();
    case 'events': return loadEvents();
    case 'routes': return loadRoutes();
    case 'analytics': return loadAnalytics();
    case 'staff': return loadStaff();
  }
}

// ============================================================
// Dashboard (Visitors Page)
// ============================================================

let dashboardSearchTimer = null;

async function loadDashboard() {
  const el = document.getElementById('page-dashboard');

  el.innerHTML = `
    <div class="mb-6">
      <h2 class="text-2xl font-bold text-gray-900">Visitors</h2>
      <p class="text-gray-500 mt-1">Search members, manage active visitors</p>
    </div>

    <div class="bg-white border border-gray-200 rounded-xl p-4 mb-6">
      <div class="relative">
        <svg class="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        <input type="text" id="dashboard-search" class="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
               placeholder="Search members by name or email..."
               autocomplete="off">
      </div>
      <p id="dashboard-search-hint" class="text-xs text-gray-400 mt-2">Enter at least 3 characters to search</p>
      <div id="dashboard-search-results" class="mt-4 hidden">
        <div class="flex items-center justify-between mb-2">
          <span id="dashboard-search-count" class="text-sm text-gray-500"></span>
        </div>
        <div id="dashboard-search-grid" class="grid grid-cols-1 md:grid-cols-2 gap-3"></div>
      </div>
    </div>

    <div class="mb-6">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-lg font-bold text-gray-900" id="active-visitors-header">Active Visitors (0)</h3>
        <button onclick="loadActiveVisitors()" class="btn btn-sm btn-secondary">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
          Refresh
        </button>
      </div>
      <div id="active-visitors-grid" class="grid grid-cols-1 md:grid-cols-2 gap-3"></div>
      <div id="active-visitors-pagination" class="mt-3 flex justify-center gap-2"></div>
    </div>

    <div class="mb-6">
      <h3 class="text-lg font-bold text-gray-900 mb-3">Recent Waiver Submissions</h3>
      <div id="recent-forms-list" class="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <p class="text-gray-400 text-sm p-4 text-center">Loading...</p>
      </div>
    </div>

    <button onclick="showNewMemberModal()" 
            class="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center text-2xl transition z-40">
      +
    </button>
  `;

  const searchInput = document.getElementById('dashboard-search');
  searchInput.addEventListener('input', () => {
    clearTimeout(dashboardSearchTimer);
    const q = searchInput.value.trim();
    if (q.length < 3) {
      document.getElementById('dashboard-search-results').classList.add('hidden');
      document.getElementById('dashboard-search-hint').textContent = 'Enter at least 3 characters to search';
      return;
    }
    dashboardSearchTimer = setTimeout(() => dashboardSearch(q), 300);
  });

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      searchInput.value = '';
      document.getElementById('dashboard-search-results').classList.add('hidden');
    }
  });

  await Promise.all([loadActiveVisitors(), loadRecentForms()]);
}

async function dashboardSearch(query) {
  try {
    const results = await api('GET', `/api/members/search?q=${encodeURIComponent(query)}&limit=30`);
    const container = document.getElementById('dashboard-search-results');
    const grid = document.getElementById('dashboard-search-grid');
    const count = document.getElementById('dashboard-search-count');
    const hint = document.getElementById('dashboard-search-hint');

    container.classList.remove('hidden');
    hint.textContent = '';
    count.textContent = `${results.length} result${results.length !== 1 ? 's' : ''}`;
    
    if (results.length === 0) {
      grid.innerHTML = '<p class="text-gray-400 text-sm col-span-2 text-center py-4">No members found</p>';
      return;
    }

    grid.innerHTML = results.map(m => renderMemberCard(m)).join('');
  } catch (err) {
    document.getElementById('dashboard-search-hint').textContent = 'Search error: ' + err.message;
  }
}

let activeVisitorsPage = 1;

async function loadActiveVisitors(page = 1) {
  activeVisitorsPage = page;
  try {
    const data = await api('GET', `/api/checkin/active?page=${page}&perPage=20`);
    const header = document.getElementById('active-visitors-header');
    const grid = document.getElementById('active-visitors-grid');
    const pagination = document.getElementById('active-visitors-pagination');

    header.textContent = `Active Visitors (${data.total})`;

    if (data.visitors.length === 0) {
      grid.innerHTML = '<p class="text-gray-400 text-sm col-span-2 text-center py-8">No active visitors today</p>';
      pagination.innerHTML = '';
      return;
    }

    grid.innerHTML = data.visitors.map(m => renderMemberCard(m, { showCheckin: false })).join('');

    if (data.totalPages > 1) {
      let paginationHtml = '';
      for (let i = 1; i <= data.totalPages; i++) {
        paginationHtml += `<button onclick="loadActiveVisitors(${i})" class="px-3 py-1 rounded text-sm ${i === page ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}">${i}</button>`;
      }
      pagination.innerHTML = paginationHtml;
    } else {
      pagination.innerHTML = '';
    }
  } catch (err) {
    document.getElementById('active-visitors-grid').innerHTML = `<p class="text-red-400 text-sm col-span-2">${err.message}</p>`;
  }
}

async function loadRecentForms() {
  try {
    const forms = await api('GET', '/api/waivers/recent?limit=10');
    const container = document.getElementById('recent-forms-list');

    if (forms.length === 0) {
      container.innerHTML = '<p class="text-gray-400 text-sm p-4 text-center">No waiver submissions yet</p>';
      return;
    }

    container.innerHTML = `
      <table class="w-full">
        <thead>
          <tr class="text-left text-xs text-gray-500 uppercase border-b border-gray-100">
            <th class="px-4 py-2">Form</th>
            <th class="px-4 py-2">Member</th>
            <th class="px-4 py-2">Age</th>
            <th class="px-4 py-2">Date</th>
          </tr>
        </thead>
        <tbody>
          ${forms.map(f => {
            const age = calculateAge(f.date_of_birth);
            const isUnder18 = age !== null && age < 18;
            return `
              <tr class="border-b border-gray-50 hover:bg-gray-50 cursor-pointer" onclick="openMemberProfile('${f.member_id}')">
                <td class="px-4 py-2 text-sm">${f.waiver_name}</td>
                <td class="px-4 py-2 text-sm font-medium">${f.first_name} ${f.last_name}</td>
                <td class="px-4 py-2 text-sm ${isUnder18 ? 'text-blue-600 font-bold' : 'text-gray-500'}">${age ?? '—'}</td>
                <td class="px-4 py-2 text-sm text-gray-400">${formatDateTime(f.signed_at)}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  } catch (err) {
    document.getElementById('recent-forms-list').innerHTML = `<p class="text-red-400 text-sm p-4">${err.message}</p>`;
  }
}

// ============================================================
// Check-In (Scanner-Ready)
// ============================================================

let checkinDebounceTimer = null;
let checkinScanBuffer = '';
let checkinScanTimeout = null;
let checkinResultClearTimer = null;

async function loadCheckIn() {
  const el = document.getElementById('page-checkin');
  el.innerHTML = `
    <div class="flex flex-col items-center pt-4 px-4" id="checkin-page-wrapper">
      <!-- Header -->
      <div class="text-center mb-4 w-full max-w-3xl">
        <h2 class="text-3xl font-bold text-gray-900">Check In</h2>
        <p class="text-gray-400 mt-1">Scan QR code or search by name</p>
      </div>

      <!-- Big Scanner Input -->
      <div class="w-full max-w-3xl relative mb-4">
        <div class="relative">
          <svg class="w-7 h-7 text-gray-400 absolute left-5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"/></svg>
          <input type="text" id="checkin-search"
            class="w-full pl-16 pr-6 py-5 text-2xl border-2 border-gray-300 rounded-2xl focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 bg-white shadow-lg placeholder-gray-300 font-medium"
            placeholder="Scan QR code or search by name..."
            autofocus autocomplete="off" spellcheck="false">
        </div>
        <!-- Search dropdown -->
        <div id="checkin-dropdown" style="display:none; position:absolute; top:100%; left:0; right:0; z-index:50; background:#fff; border:1px solid #e5e7eb; border-radius:0.75rem; box-shadow:0 8px 30px rgba(0,0,0,0.15); max-height:350px; overflow-y:auto; margin-top:6px;"></div>
      </div>

      <!-- Result Area (big, visible from distance) -->
      <div id="checkin-result" class="w-full max-w-3xl"></div>
    </div>
  `;

  const searchInput = document.getElementById('checkin-search');

  // QR Scanner detection: track input speed
  // USB scanners type the full string very fast (<100ms) then hit Enter
  let inputStartTime = 0;
  let lastInputLen = 0;

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      hideCheckinDropdown();
      const val = searchInput.value.trim();
      const elapsed = Date.now() - inputStartTime;
      const isScannerInput = val.length >= 5 && elapsed < 200;

      if (isScannerInput && val.startsWith('BR-')) {
        // QR scanner detected — auto check-in via QR endpoint
        checkinQrScan(val);
      } else if (val.startsWith('BR-')) {
        // Manual QR entry
        checkinQrScan(val);
      } else {
        processCheckInSearch();
      }
      return;
    }
    if (e.key === 'Escape') {
      hideCheckinDropdown();
      searchInput.value = '';
      clearCheckinResult();
    }
  });

  searchInput.addEventListener('input', () => {
    const val = searchInput.value;
    // Track timing for scanner detection
    if (val.length === 1 || val.length < lastInputLen) {
      inputStartTime = Date.now();
    }
    lastInputLen = val.length;

    clearTimeout(checkinDebounceTimer);
    const q = val.trim();

    // Don't show dropdown for scanner-speed input or QR codes
    if (q.startsWith('BR-')) return;
    if (q.length < 3) { hideCheckinDropdown(); return; }

    checkinDebounceTimer = setTimeout(() => checkinLiveSearch(q), 300);
  });

  // Click outside to dismiss dropdown
  document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('checkin-dropdown');
    if (dropdown && !dropdown.contains(e.target) && e.target.id !== 'checkin-search') hideCheckinDropdown();
  });

  searchInput.focus();
}

function clearCheckinResult() {
  clearTimeout(checkinResultClearTimer);
  const el = document.getElementById('checkin-result');
  if (el) el.innerHTML = '';
}

function hideCheckinDropdown() {
  const dd = document.getElementById('checkin-dropdown');
  if (dd) dd.style.display = 'none';
}

async function checkinQrScan(qrCode) {
  const searchInput = document.getElementById('checkin-search');
  const resultEl = document.getElementById('checkin-result');
  searchInput.value = '';
  clearTimeout(checkinResultClearTimer);

  try {
    const result = await api('GET', `/api/checkin/qr/${encodeURIComponent(qrCode)}`);
    showCheckinResultBig(result);
  } catch (err) {
    showCheckinResultBig({ success: false, error: err.message, message: 'Check-in failed' });
  }
}

function showCheckinResultBig(result) {
  const resultEl = document.getElementById('checkin-result');
  const searchInput = document.getElementById('checkin-search');
  clearTimeout(checkinResultClearTimer);

  if (result.success) {
    const m = result.member;
    const regWarning = result.registrationWarning;
    const passName = result.pass ? result.pass.pass_name : (m.active_pass ? m.active_pass.pass_name : '');

    resultEl.innerHTML = `
      <div class="rounded-3xl p-8 text-center animate-checkin-success" style="background: linear-gradient(135deg, #059669, #10B981); min-height: 300px; display:flex; flex-direction:column; align-items:center; justify-content:center;">
        <div class="w-24 h-24 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4 animate-bounce-once">
          <svg class="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>
        </div>
        <p class="text-white text-5xl font-black tracking-tight mb-2">${m.first_name} ${m.last_name}</p>
        <p class="text-white/80 text-2xl font-medium mb-3">${result.alreadyCheckedIn ? 'Already checked in today' : (result.message || 'Welcome back!')}</p>
        ${passName ? `<span class="inline-block px-4 py-1.5 bg-white/20 rounded-full text-white text-lg font-medium">${passName}</span>` : ''}
        ${regWarning ? `
          <div class="mt-6 bg-red-600 rounded-xl p-4 max-w-md">
            <p class="text-white font-bold text-xl">REGISTRATION FEE NOT PAID</p>
            <p class="text-white/80 text-sm mt-1">Add £3.00 to next transaction</p>
          </div>
        ` : ''}
      </div>
    `;

    // Auto-clear after 5 seconds, refocus input
    if (!regWarning) {
      checkinResultClearTimer = setTimeout(() => {
        resultEl.innerHTML = '';
        if (searchInput) { searchInput.value = ''; searchInput.focus(); }
      }, 5000);
    }
  } else {
    const m = result.member;
    const memberName = m ? `${m.first_name} ${m.last_name}` : 'Unknown Member';

    resultEl.innerHTML = `
      <div class="rounded-3xl p-8 text-center" style="background: linear-gradient(135deg, #DC2626, #EF4444); min-height: 300px; display:flex; flex-direction:column; align-items:center; justify-content:center;">
        <div class="w-24 h-24 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4">
          <svg class="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12"/></svg>
        </div>
        <p class="text-white text-4xl font-black tracking-tight mb-2">${memberName}</p>
        <p class="text-white/90 text-2xl font-medium">${result.error || result.message || 'Check-in failed'}</p>
        ${result.needsWaiver ? '<p class="text-white/70 text-lg mt-3">Please complete a waiver first</p>' : ''}
        ${result.needsPass ? '<p class="text-white/70 text-lg mt-3">No active pass — purchase at desk</p>' : ''}
        <button onclick="clearCheckinResult(); document.getElementById(\'checkin-search\').focus();" class="mt-6 px-6 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl text-lg font-medium transition">Dismiss</button>
      </div>
    `;

    // Refocus input so next scan works
    if (searchInput) searchInput.focus();
  }
}

async function checkinLiveSearch(query) {
  const dropdown = document.getElementById('checkin-dropdown');
  if (!dropdown) return;

  try {
    const results = await api('GET', `/api/members/search?q=${encodeURIComponent(query)}&limit=10`);

    if (results.length === 0) {
      dropdown.innerHTML = `<div style="padding:14px 20px; color:#9ca3af; font-size:1rem;">No members found</div>`;
      dropdown.style.display = 'block';
      return;
    }

    dropdown.innerHTML = results.map(m => {
      const age = calculateAge(m.date_of_birth);
      const isUnder18 = age !== null && age < 18;
      return `
        <div onclick="checkinDropdownSelect('${m.id}')" style="padding:12px 20px; cursor:pointer; border-bottom:1px solid #f3f4f6; display:flex; align-items:center; gap:10px;" onmouseenter="this.style.background='#eff6ff'" onmouseleave="this.style.background='#fff'">
          <div style="width:40px;height:40px;border-radius:50%;background:${nameToColour(m.first_name+m.last_name)};display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:0.8rem;flex-shrink:0">
            ${getInitials(m.first_name, m.last_name).toUpperCase()}
          </div>
          <div style="flex:1;min-width:0">
            <span style="font-weight:700; color:#111827; font-size:1.05rem;">${m.first_name} ${m.last_name}</span>
            <span style="color:#9ca3af; font-size:0.85rem; margin-left:10px;">${m.email || ''}</span>
            ${age !== null ? `<span style="color:${isUnder18 ? '#2563EB' : '#9ca3af'};font-size:0.8rem;margin-left:8px;${isUnder18 ? 'font-weight:700' : ''}">(${age})</span>` : ''}
          </div>
          ${!m.registration_fee_paid ? '<span style="width:24px;height:24px;background:#EF4444;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:0.7rem;font-weight:700;flex-shrink:0">!</span>' : ''}
        </div>
      `;
    }).join('');
    dropdown.style.display = 'block';
  } catch (err) {
    dropdown.style.display = 'none';
  }
}

async function checkinDropdownSelect(memberId) {
  hideCheckinDropdown();
  document.getElementById('checkin-search').value = '';
  await doCheckIn(memberId);
}

async function processCheckInSearch() {
  const query = document.getElementById('checkin-search').value.trim();
  if (!query) return;

  const resultEl = document.getElementById('checkin-result');

  try {
    if (query.startsWith('BR-')) {
      await checkinQrScan(query);
      return;
    }

    const results = await api('GET', `/api/members/search?q=${encodeURIComponent(query)}&limit=10`);

    if (results.length === 0) {
      resultEl.innerHTML = `
        <div class="bg-white border border-gray-200 rounded-2xl p-8 text-center">
          <p class="text-xl font-bold text-gray-900">No member found</p>
          <p class="text-gray-500 mt-2">Try a different search or register a new member</p>
          <button onclick="showNewMemberModal()" class="mt-4 px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-medium">Register New Member</button>
        </div>
      `;
      return;
    }

    if (results.length === 1) {
      await doCheckIn(results[0].id);
      document.getElementById('checkin-search').value = '';
      return;
    }

    resultEl.innerHTML = `
      <div class="bg-white border border-gray-200 rounded-2xl p-6">
        <p class="text-sm text-gray-500 mb-3">${results.length} members found — select one:</p>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          ${results.map(m => renderMemberCard(m)).join('')}
        </div>
      </div>
    `;
  } catch (err) {
    resultEl.innerHTML = `<div class="bg-white border border-red-200 rounded-2xl p-8 text-center"><p class="text-xl font-bold text-red-600">Error</p><p class="text-gray-500 mt-2">${err.message}</p></div>`;
  }
}

async function doCheckIn(memberId) {
  try {
    const result = await api('POST', '/api/checkin/process', { memberId });
    showCheckinResultBig(result);
  } catch (err) {
    showCheckinResultBig({ success: false, error: err.message });
  }
}

// ============================================================
// Members Page
// ============================================================

async function loadMembers() {
  const el = document.getElementById('page-members');

  el.innerHTML = `
    <div class="flex justify-between items-center mb-6">
      <div>
        <h2 class="text-2xl font-bold text-gray-900">Members</h2>
        <p class="text-gray-500 mt-1" id="member-count-text">Loading...</p>
      </div>
      <div class="flex gap-2">
        <button onclick="exportMembersCSV()" class="btn btn-secondary flex items-center gap-1">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          Export CSV
        </button>
        <button onclick="showNewMemberModal()" class="btn btn-primary">+ New Member</button>
      </div>
    </div>

    <div class="card mb-4">
      <input type="text" id="member-search" class="form-input" placeholder="Search members by name, email, or phone..." oninput="searchMembers(this.value)">
    </div>

    <div class="card p-0 overflow-x-auto">
      <table class="data-table w-full">
        <thead>
          <tr>
            <th class="whitespace-nowrap">Member</th>
            <th class="whitespace-nowrap">Email</th>
            <th class="whitespace-nowrap text-center">Reg.</th>
            <th class="whitespace-nowrap text-center">Waiver</th>
            <th class="whitespace-nowrap">Pass</th>
            <th class="whitespace-nowrap">Joined</th>
          </tr>
        </thead>
        <tbody id="members-table-body">
        </tbody>
      </table>
    </div>

    <div id="members-pagination" class="mt-4 flex justify-center gap-2"></div>
  `;

  await refreshMembersList();
}

let memberSearchTimeout = null;
function searchMembers(query) {
  clearTimeout(memberSearchTimeout);
  memberSearchTimeout = setTimeout(() => refreshMembersList(query), 200);
}

async function exportMembersCSV() {
  try {
    showToast('Generating CSV...', 'info');
    // Fetch all members (large page)
    const result = await api('GET', '/api/members/list?page=1&perPage=10000');
    const members = result.members || [];
    if (members.length === 0) { showToast('No members to export', 'error'); return; }

    const headers = ['First Name','Last Name','Email','Phone','DOB','Gender','Address','City','County','Postcode','Registration Fee Paid','Waiver Status','Joined Date'];
    const escapeCSV = (val) => {
      if (val == null) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    };

    const rows = members.map(m => [
      escapeCSV(m.first_name),
      escapeCSV(m.last_name),
      escapeCSV(m.email),
      escapeCSV(m.phone),
      escapeCSV(m.date_of_birth),
      escapeCSV(m.gender),
      escapeCSV(m.address_line1),
      escapeCSV(m.city),
      escapeCSV(m.region),
      escapeCSV(m.postal_code),
      m.registration_fee_paid ? 'Yes' : 'No',
      '—',
      m.created_at ? new Date(m.created_at).toLocaleDateString('en-GB') : ''
    ].join(','));

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const today = new Date().toISOString().split('T')[0];
    a.href = url;
    a.download = `boulderryn-members-${today}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Exported ${members.length} members`, 'success');
  } catch (err) {
    showToast('Export failed: ' + err.message, 'error');
  }
}

async function refreshMembersList(query = '', page = 1) {
  const tbody = document.getElementById('members-table-body');
  const countText = document.getElementById('member-count-text');

  let members, total;

  if (query) {
    members = await api('GET', `/api/members/search?q=${encodeURIComponent(query)}&limit=50`);
    total = members.length;
  } else {
    const result = await api('GET', `/api/members/list?page=${page}&perPage=50`);
    members = result.members;
    total = result.total;
  }

  countText.textContent = `${total} member${total !== 1 ? 's' : ''}`;

  if (members.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-gray-400 py-8">No members found</td></tr>`;
    return;
  }

  tbody.innerHTML = members.map(m => {
    const initials = getInitials(m.first_name, m.last_name).toUpperCase();
    const colour = nameToColour(m.first_name + m.last_name);
    const regPaid = m.registration_fee_paid === 1;

    return `
      <tr onclick="openMemberProfile('${m.id}')">
        <td>
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs" style="background:${colour}">${initials}</div>
            <span class="font-medium">${m.first_name} ${m.last_name}</span>
          </div>
        </td>
        <td class="text-gray-500">${m.email || '—'}</td>
        <td class="text-center">
          ${regPaid
            ? '<span class="w-6 h-6 inline-flex items-center justify-center bg-green-100 text-green-600 rounded-full"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg></span>'
            : '<span class="w-6 h-6 inline-flex items-center justify-center bg-red-100 text-red-600 rounded-full text-xs font-bold">!</span>'}
        </td>
        <td><span class="badge badge-neutral">—</span></td>
        <td><span class="badge badge-neutral">—</span></td>
        <td class="text-gray-400 text-sm">${m.created_at ? new Date(m.created_at).toLocaleDateString('en-GB') : '—'}</td>
      </tr>
    `;
  }).join('');
}

// ============================================================
// Member Profile Modal
// ============================================================

async function openMemberProfile(memberId) {
  try {
    const [member, comments, passes, visits, transactions, events] = await Promise.all([
      api('GET', `/api/members/${memberId}/with-pass-status`),
      api('GET', `/api/members/${memberId}/comments`),
      api('GET', `/api/passes/member/${memberId}`).catch(() => []),
      api('GET', `/api/members/${memberId}/visits`),
      api('GET', `/api/members/${memberId}/transactions`),
      api('GET', `/api/members/${memberId}/events`),
    ]);

    if (!member) { showToast('Member not found', 'error'); return; }

    const initials = getInitials(member.first_name, member.last_name).toUpperCase();
    const colour = nameToColour(member.first_name + member.last_name);
    const age = calculateAge(member.date_of_birth);
    const isUnder18 = age !== null && age < 18;
    const regPaid = member.registration_fee_paid === 1;
    const fullName = `${member.first_name} ${member.last_name}`;

    const address = [member.address_line1, member.address_line2, member.city, member.region, member.postal_code].filter(Boolean).join(', ');

    document.getElementById('modal-content').className = 'bg-white rounded-xl shadow-2xl max-w-5xl w-full mx-4 max-h-[90vh] overflow-y-auto';

    showModal(`
      <div class="flex flex-col md:flex-row min-h-[500px]">
        <div class="md:w-80 flex-shrink-0 bg-gray-50 p-6 border-r border-gray-200 rounded-l-xl">
          <div class="flex justify-end mb-2">
            <button onclick="closeModal()" class="text-gray-400 hover:text-gray-600">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>

          <div class="text-center mb-4">
            <div class="w-20 h-20 rounded-full flex items-center justify-center text-white font-bold text-2xl mx-auto mb-3" style="background:${colour}">${initials}</div>
            <h3 class="text-lg font-bold text-gray-900">${fullName}</h3>
          </div>

          <div class="flex items-center justify-center gap-2 mb-4">
            ${regPaid
              ? '<span class="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg></span><span class="text-sm text-green-600 font-medium">Registered</span>'
              : `<span class="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold">!</span><span class="text-sm text-red-600 font-medium">Not Registered</span>
                 <button onclick="validateRegistration('${member.id}')" class="btn btn-sm btn-danger ml-1">Validate</button>`}
          </div>

          <div class="space-y-3 text-sm">
            ${member.date_of_birth ? `<div><span class="text-gray-400 text-xs uppercase">DOB</span><p class="font-medium">${formatDate(member.date_of_birth)} ${age !== null ? `<span class="${isUnder18 ? 'text-blue-600 font-bold' : 'text-gray-500'}">(${age})</span>` : ''}</p></div>` : ''}
            ${member.gender ? `<div><span class="text-gray-400 text-xs uppercase">Gender</span><p class="font-medium capitalize">${member.gender.replace('_', ' ')}</p></div>` : ''}
            ${member.email ? `<div><span class="text-gray-400 text-xs uppercase">Email</span><p class="font-medium text-blue-600">${member.email}</p></div>` : ''}
            ${member.phone ? `<div><span class="text-gray-400 text-xs uppercase">Phone</span><p class="font-medium">${member.phone}</p></div>` : ''}
            ${address ? `<div><span class="text-gray-400 text-xs uppercase">Address</span><p class="font-medium">${address}</p></div>` : ''}
            ${member.emergency_contact_name ? `<div><span class="text-gray-400 text-xs uppercase">Emergency Contact</span><p class="font-medium">${member.emergency_contact_name} ${member.emergency_contact_phone ? '(' + member.emergency_contact_phone + ')' : ''}</p></div>` : ''}
            ${member.medical_conditions ? `<div class="bg-yellow-50 border border-yellow-200 rounded-lg p-2"><span class="text-yellow-800 text-xs uppercase font-bold">Medical</span><p class="text-yellow-700 text-sm">${member.medical_conditions}</p></div>` : ''}
          </div>

          <div class="mt-4 space-y-2">
            <button onclick="closeModal(); openPOSForMember('${member.id}', '${fullName.replace(/'/g, "\\'")}')" class="btn btn-primary w-full btn-sm">Open in POS</button>
            <button onclick="editMemberModal('${member.id}')" class="btn btn-secondary w-full btn-sm">Edit Profile</button>
            ${passes.some(p => p.category === 'membership' && p.status === 'active') ? `
              <button onclick="showMemberQrCode('${member.id}', '${fullName.replace(/'/g, "\\'")}')" class="btn btn-secondary w-full btn-sm">View QR Code</button>
              <button onclick="emailMemberQrCode('${member.id}')" class="btn btn-secondary w-full btn-sm flex items-center justify-center gap-1">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                Email QR Code
              </button>
            ` : ''}
          </div>

          <div class="mt-4 border-t border-gray-200 pt-4">
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs uppercase font-bold text-gray-400">Comments (${comments.length})</span>
              <button onclick="toggleCommentForm()" class="text-blue-600 text-xs font-medium hover:underline">+ Add</button>
            </div>
            <div id="comment-form-container" class="hidden mb-3">
              <input type="text" id="comment-staff-name" class="form-input text-xs mb-1" placeholder="Your name" value="${window.currentStaff ? window.currentStaff.first_name : 'Staff'}">
              <textarea id="comment-text" class="form-input text-xs" rows="2" placeholder="Add a comment..."></textarea>
              <button onclick="addComment('${member.id}')" class="btn btn-sm btn-primary mt-1 w-full">Post Comment</button>
            </div>
            <div id="comments-list" class="space-y-2 max-h-40 overflow-y-auto">
              ${comments.length === 0 ? '<p class="text-xs text-gray-400">No comments yet</p>' :
                comments.map(c => `
                  <div class="bg-white rounded-lg p-2 border border-gray-100">
                    <div class="flex items-center gap-1 mb-0.5">
                      <span class="text-xs font-bold text-gray-700">${c.staff_name}</span>
                      <span class="text-xs text-gray-300">${formatDate(c.created_at)}</span>
                    </div>
                    <p class="text-xs text-gray-600">${c.comment}</p>
                  </div>
                `).join('')}
            </div>
          </div>

          ${member.tags && member.tags.length > 0 ? `
            <div class="mt-4 border-t border-gray-200 pt-4">
              <span class="text-xs uppercase font-bold text-gray-400">Tags</span>
              <div class="flex flex-wrap gap-1 mt-2">
                ${member.tags.map(t => `<span class="px-2 py-0.5 rounded-full text-xs font-medium text-white" style="background:${t.colour || '#3B82F6'}">${t.name}</span>`).join('')}
              </div>
            </div>
          ` : ''}
        </div>

        <div class="flex-1 flex flex-col min-w-0">
          <div class="flex border-b border-gray-200">
            <button onclick="switchProfileTab('passes')" class="profile-tab active px-4 py-3 text-sm font-medium border-b-2 border-blue-600 text-blue-600" data-tab="passes">Passes</button>
            <button onclick="switchProfileTab('visits')" class="profile-tab px-4 py-3 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700" data-tab="visits">Visits</button>
            <button onclick="switchProfileTab('events')" class="profile-tab px-4 py-3 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700" data-tab="events">Events</button>
            <button onclick="switchProfileTab('transactions')" class="profile-tab px-4 py-3 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700" data-tab="transactions">Transactions</button>
          </div>

          <div class="flex-1 overflow-y-auto p-4">
            <div id="profile-tab-passes" class="profile-tab-content">${renderPassesTab(passes)}</div>
            <div id="profile-tab-visits" class="profile-tab-content hidden">${renderVisitsTab(visits)}</div>
            <div id="profile-tab-events" class="profile-tab-content hidden">${renderEventsTab(events)}</div>
            <div id="profile-tab-transactions" class="profile-tab-content hidden">${renderTransactionsTab(transactions)}</div>
          </div>
        </div>
      </div>
    `);
  } catch (err) {
    showToast('Error loading profile: ' + err.message, 'error');
  }
}

function switchProfileTab(tabName) {
  document.querySelectorAll('.profile-tab').forEach(t => {
    t.classList.remove('active', 'border-blue-600', 'text-blue-600');
    t.classList.add('border-transparent', 'text-gray-500');
  });
  document.querySelectorAll('.profile-tab-content').forEach(c => c.classList.add('hidden'));

  const activeTab = document.querySelector(`.profile-tab[data-tab="${tabName}"]`);
  if (activeTab) {
    activeTab.classList.add('active', 'border-blue-600', 'text-blue-600');
    activeTab.classList.remove('border-transparent', 'text-gray-500');
  }
  const content = document.getElementById(`profile-tab-${tabName}`);
  if (content) content.classList.remove('hidden');
}

function renderPassesTab(passes) {
  if (!passes || passes.length === 0) return '<p class="text-gray-400 text-center py-8">No passes</p>';
  return passes.map(p => {
    const isActive = p.status === 'active';
    const statusColour = isActive ? 'green' : p.status === 'paused' ? 'yellow' : 'red';
    return `
      <div class="bg-white border border-gray-200 rounded-xl p-4 mb-3 ${isActive ? 'border-l-4 border-l-green-500' : ''}">
        <div class="flex items-start justify-between">
          <div><h4 class="font-bold text-sm">${p.pass_name || 'Pass'}</h4><p class="text-xs text-gray-500 mt-0.5">${p.category || ''}</p></div>
          <span class="badge badge-${statusColour === 'green' ? 'success' : statusColour === 'yellow' ? 'warning' : 'danger'}">${p.status}</span>
        </div>
        <div class="flex items-center gap-4 mt-2 text-xs text-gray-500">
          ${p.visits_remaining !== null ? `<span>Visits: ${p.visits_remaining} remaining</span>` : '<span>Unlimited visits</span>'}
          ${p.started_at ? `<span>From: ${formatDate(p.started_at)}</span>` : ''}
          ${p.expires_at ? `<span>Expires: ${formatDate(p.expires_at)}</span>` : ''}
        </div>
        ${p.status === 'paused' && p.pause_reason ? `<p class="text-xs text-yellow-600 mt-1">Paused: ${p.pause_reason}</p>` : ''}
      </div>
    `;
  }).join('');
}

function renderVisitsTab(visits) {
  if (!visits || visits.length === 0) return '<p class="text-gray-400 text-center py-8">No visit history</p>';
  return `<table class="w-full text-sm"><thead><tr class="text-left text-xs text-gray-400 uppercase border-b"><th class="pb-2">Date</th><th class="pb-2">Time</th><th class="pb-2">Method</th><th class="pb-2">Pass</th></tr></thead><tbody>${visits.map(v => `<tr class="border-b border-gray-50"><td class="py-2">${formatDate(v.checked_in_at)}</td><td class="py-2 text-gray-500">${v.checked_in_at ? new Date(v.checked_in_at).toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit'}) : '—'}</td><td class="py-2"><span class="badge badge-neutral">${v.method || 'desk'}</span></td><td class="py-2 text-gray-500">${v.pass_name || '—'}</td></tr>`).join('')}</tbody></table>`;
}

function renderEventsTab(events) {
  if (!events || events.length === 0) return '<p class="text-gray-400 text-center py-8">No event history</p>';
  return `<table class="w-full text-sm"><thead><tr class="text-left text-xs text-gray-400 uppercase border-b"><th class="pb-2">Event</th><th class="pb-2">Date</th><th class="pb-2">Status</th></tr></thead><tbody>${events.map(e => `<tr class="border-b border-gray-50"><td class="py-2 font-medium">${e.event_name}</td><td class="py-2 text-gray-500">${formatDate(e.starts_at)}</td><td class="py-2"><span class="badge badge-neutral">${e.status}</span></td></tr>`).join('')}</tbody></table>`;
}

function renderTransactionsTab(transactions) {
  if (!transactions || transactions.length === 0) return '<p class="text-gray-400 text-center py-8">No transactions</p>';
  return `<table class="w-full text-sm"><thead><tr class="text-left text-xs text-gray-400 uppercase border-b"><th class="pb-2">Date</th><th class="pb-2">Items</th><th class="pb-2">Method</th><th class="pb-2 text-right">Amount</th></tr></thead><tbody>${transactions.map(t => `<tr class="border-b border-gray-50"><td class="py-2">${formatDate(t.created_at)}</td><td class="py-2 text-gray-600 truncate max-w-[200px]">${t.items_summary || '—'}</td><td class="py-2"><span class="badge badge-neutral">${t.payment_method === 'dojo_card' ? 'Card' : t.payment_method}</span></td><td class="py-2 text-right font-semibold ${t.total_amount < 0 ? 'text-red-500' : ''}">£${Math.abs(t.total_amount).toFixed(2)}</td></tr>`).join('')}</tbody></table>`;
}

function toggleCommentForm() {
  document.getElementById('comment-form-container').classList.toggle('hidden');
}

async function addComment(memberId) {
  const staffName = document.getElementById('comment-staff-name').value.trim();
  const comment = document.getElementById('comment-text').value.trim();
  if (!comment) return;
  try {
    await api('POST', `/api/members/${memberId}/comments`, { staff_name: staffName || 'Staff', comment });
    showToast('Comment added', 'success');
    await openMemberProfile(memberId);
  } catch (err) { showToast('Error: ' + err.message, 'error'); }
}

async function validateRegistration(memberId) {
  try {
    await api('POST', `/api/members/${memberId}/validate-registration`);
    showToast('Registration validated', 'success');
    await openMemberProfile(memberId);
  } catch (err) { showToast('Error: ' + err.message, 'error'); }
}

function showMemberQrCode(memberId, memberName) {
  document.getElementById('modal-content').className = 'bg-white rounded-xl shadow-2xl max-w-sm w-full mx-4';
  showModal(`
    <div class="p-6 text-center">
      <h3 class="text-lg font-bold text-gray-900 mb-1">Membership QR Code</h3>
      <p class="text-gray-500 text-sm mb-4">${memberName}</p>
      <div class="bg-gray-50 rounded-xl p-4 mb-4">
        <img src="/api/members/${memberId}/qr-code?size=300" alt="QR Code" class="mx-auto" style="width:200px;height:200px;">
      </div>
      <div class="flex gap-2">
        <a href="/api/members/${memberId}/qr-code?size=400" download="boulderryn-qr.png" class="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition text-center">Download</a>
        <button onclick="(async()=>{try{const r=await api('POST','/api/members/${memberId}/send-qr-email');showToast(r.success?'QR code emailed':'Email failed: '+(r.error||'Unknown'),'info');}catch(e){showToast('Email failed: '+e.message,'error');}})()" class="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition">Email QR</button>
      </div>
      <button onclick="openMemberProfile('${memberId}')" class="mt-3 text-sm text-gray-400 hover:text-gray-600">Back to profile</button>
    </div>
  `);
}

async function editMemberModal(memberId) {
  const m = await api('GET', `/api/members/${memberId}`);
  if (!m) return;

  document.getElementById('modal-content').className = 'bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto';

  showModal(`
    <div class="p-6">
      <h3 class="text-xl font-bold mb-4">Edit Member</h3>
      <form id="edit-member-form" onsubmit="updateMember(event, '${m.id}')">
        <div class="grid grid-cols-2 gap-4">
          <div class="form-group"><label class="form-label">First Name *</label><input type="text" name="first_name" class="form-input" value="${m.first_name || ''}" required></div>
          <div class="form-group"><label class="form-label">Last Name *</label><input type="text" name="last_name" class="form-input" value="${m.last_name || ''}" required></div>
          <div class="form-group"><label class="form-label">Email</label><input type="email" name="email" class="form-input" value="${m.email || ''}"></div>
          <div class="form-group"><label class="form-label">Phone</label><input type="tel" name="phone" class="form-input" value="${m.phone || ''}"></div>
          <div class="form-group"><label class="form-label">Date of Birth</label><input type="date" name="date_of_birth" class="form-input" value="${m.date_of_birth || ''}"></div>
          <div class="form-group"><label class="form-label">Gender</label><select name="gender" class="form-select"><option value="">—</option><option value="male" ${m.gender === 'male' ? 'selected' : ''}>Male</option><option value="female" ${m.gender === 'female' ? 'selected' : ''}>Female</option><option value="other" ${m.gender === 'other' ? 'selected' : ''}>Other</option><option value="prefer_not_to_say" ${m.gender === 'prefer_not_to_say' ? 'selected' : ''}>Prefer not to say</option></select></div>
        </div>
        <div class="form-group"><label class="form-label">Address</label><input type="text" name="address_line1" class="form-input mb-2" placeholder="Address Line 1" value="${m.address_line1 || ''}"><input type="text" name="address_line2" class="form-input mb-2" placeholder="Address Line 2" value="${m.address_line2 || ''}"><div class="grid grid-cols-3 gap-2"><input type="text" name="city" class="form-input" placeholder="City" value="${m.city || ''}"><input type="text" name="region" class="form-input" placeholder="County" value="${m.region || ''}"><input type="text" name="postal_code" class="form-input" placeholder="Postcode" value="${m.postal_code || ''}"></div></div>
        <div class="grid grid-cols-2 gap-4">
          <div class="form-group"><label class="form-label">Emergency Contact Name</label><input type="text" name="emergency_contact_name" class="form-input" value="${m.emergency_contact_name || ''}"></div>
          <div class="form-group"><label class="form-label">Emergency Contact Phone</label><input type="tel" name="emergency_contact_phone" class="form-input" value="${m.emergency_contact_phone || ''}"></div>
        </div>
        <div class="form-group"><label class="form-label">Medical Conditions</label><input type="text" name="medical_conditions" class="form-input" value="${m.medical_conditions || ''}"></div>
        <div class="form-group"><label class="form-label">Notes</label><textarea name="notes" class="form-input" rows="2">${m.notes || ''}</textarea></div>
        <div class="flex justify-end gap-2 mt-6">
          <button type="button" onclick="openMemberProfile('${m.id}')" class="btn btn-secondary">Cancel</button>
          <button type="submit" class="btn btn-primary">Save Changes</button>
        </div>
      </form>
    </div>
  `);
}

async function updateMember(e, memberId) {
  e.preventDefault();
  const form = document.getElementById('edit-member-form');
  const data = Object.fromEntries(new FormData(form));
  try {
    await api('PUT', `/api/members/${memberId}`, data);
    showToast('Member updated', 'success');
    await openMemberProfile(memberId);
  } catch (err) { showToast('Error: ' + err.message, 'error'); }
}

// ============================================================
// New Member Modal
// ============================================================

function showNewMemberModal() {
  document.getElementById('modal-content').className = 'bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto';

  showModal(`
    <div class="p-6">
      <h3 class="text-xl font-bold mb-4">Register New Member</h3>
      <form id="new-member-form" onsubmit="createMember(event)">
        <div class="grid grid-cols-2 gap-4">
          <div class="form-group"><label class="form-label">First Name *</label><input type="text" name="first_name" class="form-input" required></div>
          <div class="form-group"><label class="form-label">Last Name *</label><input type="text" name="last_name" class="form-input" required></div>
          <div class="form-group"><label class="form-label">Email</label><input type="email" name="email" class="form-input"></div>
          <div class="form-group"><label class="form-label">Phone</label><input type="tel" name="phone" class="form-input"></div>
          <div class="form-group"><label class="form-label">Date of Birth</label><input type="date" name="date_of_birth" class="form-input"></div>
          <div class="form-group"><label class="form-label">Gender</label><select name="gender" class="form-select"><option value="">—</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option><option value="prefer_not_to_say">Prefer not to say</option></select></div>
        </div>
        <div class="form-group"><label class="form-label">Address</label><input type="text" name="address_line1" class="form-input mb-2" placeholder="Address Line 1"><input type="text" name="address_line2" class="form-input mb-2" placeholder="Address Line 2"><div class="grid grid-cols-3 gap-2"><input type="text" name="city" class="form-input" placeholder="City"><input type="text" name="region" class="form-input" placeholder="County"><input type="text" name="postal_code" class="form-input" placeholder="Postcode"></div></div>
        <div class="grid grid-cols-2 gap-4">
          <div class="form-group"><label class="form-label">Emergency Contact Name</label><input type="text" name="emergency_contact_name" class="form-input"></div>
          <div class="form-group"><label class="form-label">Emergency Contact Phone</label><input type="tel" name="emergency_contact_phone" class="form-input"></div>
        </div>
        <div class="form-group"><label class="form-label">Medical Conditions</label><input type="text" name="medical_conditions" class="form-input" placeholder="None, or describe..."></div>
        <div class="form-group"><label class="form-label">Climbing Experience</label><select name="climbing_experience" class="form-select"><option value="">—</option><option value="new">New Climber</option><option value="few_times">Climbed a few times</option><option value="regular">Regular Climber</option></select></div>
        <div class="flex justify-end gap-2 mt-6">
          <button type="button" onclick="closeModal()" class="btn btn-secondary">Cancel</button>
          <button type="submit" class="btn btn-primary">Register Member</button>
        </div>
      </form>
    </div>
  `);
}

async function emailMemberQrCode(memberId) {
  try {
    showToast('Sending QR code email...', 'info');
    const r = await api('POST', '/api/email/send-qr', { member_id: memberId });
    if (r.success) {
      showToast('QR code emailed successfully', 'success');
    } else {
      showToast('Email failed: ' + (r.error || 'Unknown error'), 'error');
    }
  } catch (e) {
    showToast('Email failed: ' + e.message, 'error');
  }
}

async function createMember(e) {
  e.preventDefault();
  const form = document.getElementById('new-member-form');
  const data = Object.fromEntries(new FormData(form));

  try {
    const member = await api('POST', '/api/members', data);
    closeModal();
    showToast(`${member.first_name} ${member.last_name} registered`, 'success');

    if (member.email) {
      // Send welcome email + QR code
      api('POST', '/api/email/send-welcome', { member_id: member.id }).catch(() => {});
      api('POST', `/api/members/${member.id}/send-qr-email`).then(r => {
        if (r.success) showToast('QR code sent to ' + member.email, 'info');
      });
    }

    if (document.getElementById('page-members').classList.contains('active')) await refreshMembersList();
    if (document.getElementById('page-dashboard').classList.contains('active')) {
      const q = document.getElementById('dashboard-search')?.value;
      if (q && q.length >= 3) await dashboardSearch(q);
    }
  } catch (err) { showToast('Error: ' + err.message, 'error'); }
}

// ============================================================
// Open POS for a specific member
// ============================================================

async function openPOSForMember(memberId, memberName) {
  closeModal();
  navigateTo('pos');
  await new Promise(r => setTimeout(r, 200));
  try {
    const member = await api('GET', `/api/members/${memberId}/with-pass-status`);
    posSelectMember(member);
  } catch (err) {
    const [firstName, ...rest] = memberName.split(' ');
    posSelectMember({ id: memberId, first_name: firstName, last_name: rest.join(' ') });
  }
}

// ============================================================
// Placeholder pages
// ============================================================

// ============================================================
// EVENTS PAGE
// ============================================================

let eventsViewMode = 'list';
let eventsCalendarDate = new Date();

async function loadEvents() {
  const el = document.getElementById('page-events');
  el.innerHTML = `
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-2xl font-bold text-gray-900">Events</h2>
        <p class="text-gray-500 mt-1">Manage events, courses, and scheduling</p>
      </div>
      <div class="flex items-center gap-3">
        <div class="flex bg-gray-100 rounded-lg p-0.5">
          <button onclick="switchEventsView('list')" id="events-view-list" class="px-3 py-1.5 text-sm font-medium rounded-md transition ${eventsViewMode === 'list' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}">
            <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16"/></svg>List
          </button>
          <button onclick="switchEventsView('calendar')" id="events-view-calendar" class="px-3 py-1.5 text-sm font-medium rounded-md transition ${eventsViewMode === 'calendar' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}">
            <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>Calendar
          </button>
        </div>
        <button onclick="showCreateEventModal()" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition">+ Create Event</button>
      </div>
    </div>
    <div id="events-content"></div>
  `;
  await renderEventsView();
}

function switchEventsView(mode) {
  eventsViewMode = mode;
  document.getElementById('events-view-list').className = `px-3 py-1.5 text-sm font-medium rounded-md transition ${mode === 'list' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`;
  document.getElementById('events-view-calendar').className = `px-3 py-1.5 text-sm font-medium rounded-md transition ${mode === 'calendar' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`;
  renderEventsView();
}

async function renderEventsView() {
  const container = document.getElementById('events-content');
  if (!container) return;

  try {
    const events = await api('GET', '/api/events/list?perPage=100');
    if (eventsViewMode === 'list') {
      renderEventsListView(container, events);
    } else {
      renderEventsCalendarView(container, events);
    }
  } catch (err) {
    container.innerHTML = `<p class="text-red-400">Error loading events: ${err.message}</p>`;
  }
}

function renderEventsListView(container, events) {
  if (events.length === 0) {
    container.innerHTML = `
      <div class="bg-white border border-gray-200 rounded-xl p-12 text-center">
        <svg class="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
        <p class="text-gray-500 font-medium">No events yet</p>
        <p class="text-gray-400 text-sm mt-1">Create your first event to get started</p>
      </div>
    `;
    return;
  }

  const statusBadge = (s) => {
    const map = { scheduled: 'bg-green-100 text-green-700', cancelled: 'bg-red-100 text-red-700', completed: 'bg-gray-100 text-gray-600' };
    return `<span class="px-2 py-0.5 rounded-full text-xs font-medium ${map[s] || 'bg-gray-100 text-gray-600'}">${s.charAt(0).toUpperCase() + s.slice(1)}</span>`;
  };

  container.innerHTML = `
    <div class="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <table class="w-full">
        <thead>
          <tr class="text-left text-xs text-gray-500 uppercase border-b border-gray-100 bg-gray-50">
            <th class="px-4 py-3">Event</th>
            <th class="px-4 py-3">Date / Time</th>
            <th class="px-4 py-3 text-center">Capacity</th>
            <th class="px-4 py-3 text-right">Price</th>
            <th class="px-4 py-3 text-center">Status</th>
            <th class="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${events.map(ev => {
            const start = new Date(ev.starts_at);
            const end = new Date(ev.ends_at);
            const dateStr = start.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' });
            const timeStr = start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) + ' – ' + end.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
            const capacityStr = ev.capacity ? `${ev.current_enrolment || 0}/${ev.capacity}` : '—';
            const capacityPct = ev.capacity ? ((ev.current_enrolment || 0) / ev.capacity * 100) : 0;
            const priceStr = ev.price > 0 ? `£${parseFloat(ev.price).toFixed(2)}` : 'Free';
            return `
              <tr class="border-b border-gray-50 hover:bg-gray-50 cursor-pointer" onclick="openEventDetail('${ev.id}')">
                <td class="px-4 py-3">
                  <p class="font-medium text-gray-900">${ev.name}</p>
                  ${ev.tags ? `<p class="text-xs text-gray-400 mt-0.5">${ev.tags}</p>` : ''}
                </td>
                <td class="px-4 py-3">
                  <p class="text-sm text-gray-900">${dateStr}</p>
                  <p class="text-xs text-gray-500">${timeStr}</p>
                </td>
                <td class="px-4 py-3 text-center">
                  <span class="text-sm font-medium ${capacityPct >= 90 ? 'text-red-600' : capacityPct >= 70 ? 'text-yellow-600' : 'text-gray-700'}">${capacityStr}</span>
                  ${ev.capacity ? `<div class="w-16 h-1.5 bg-gray-200 rounded-full mx-auto mt-1"><div class="h-full rounded-full ${capacityPct >= 90 ? 'bg-red-500' : capacityPct >= 70 ? 'bg-yellow-500' : 'bg-green-500'}" style="width:${Math.min(capacityPct, 100)}%"></div></div>` : ''}
                </td>
                <td class="px-4 py-3 text-right text-sm font-medium ${ev.price > 0 ? 'text-gray-900' : 'text-green-600'}">${priceStr}</td>
                <td class="px-4 py-3 text-center">${statusBadge(ev.status)}</td>
                <td class="px-4 py-3 text-right">
                  <button onclick="event.stopPropagation(); openEventDetail('${ev.id}')" class="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition" title="View Details">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                  </button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderEventsCalendarView(container, events) {
  const year = eventsCalendarDate.getFullYear();
  const month = eventsCalendarDate.getMonth();
  const monthName = eventsCalendarDate.toLocaleString('en-GB', { month: 'long', year: 'numeric' });
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = (firstDay + 6) % 7; // Monday=0

  // Map events to dates
  const eventsByDate = {};
  events.forEach(ev => {
    const d = new Date(ev.starts_at).toISOString().split('T')[0];
    if (!eventsByDate[d]) eventsByDate[d] = [];
    eventsByDate[d].push(ev);
  });

  const today = new Date().toISOString().split('T')[0];
  let cells = '';
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  for (let i = 0; i < startOffset; i++) {
    cells += `<div class="min-h-[100px] bg-gray-50 border border-gray-100 rounded-lg p-1"></div>`;
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isToday = dateStr === today;
    const dayEvents = eventsByDate[dateStr] || [];

    cells += `
      <div class="min-h-[100px] border border-gray-200 rounded-lg p-1.5 ${isToday ? 'bg-blue-50 border-blue-300' : 'bg-white hover:bg-gray-50'}">
        <div class="text-xs font-medium ${isToday ? 'text-blue-700' : 'text-gray-500'} mb-1">${d}</div>
        ${dayEvents.slice(0, 3).map(ev => {
          const time = new Date(ev.starts_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
          const statusColor = ev.status === 'cancelled' ? 'bg-red-200 text-red-800' : 'bg-blue-200 text-blue-800';
          return `<div onclick="openEventDetail('${ev.id}')" class="text-xs px-1.5 py-0.5 rounded ${statusColor} mb-0.5 truncate cursor-pointer hover:opacity-80" title="${ev.name}">${time} ${ev.name}</div>`;
        }).join('')}
        ${dayEvents.length > 3 ? `<div class="text-xs text-gray-400">+${dayEvents.length - 3} more</div>` : ''}
      </div>
    `;
  }

  container.innerHTML = `
    <div class="bg-white border border-gray-200 rounded-xl p-4">
      <div class="flex items-center justify-between mb-4">
        <button onclick="eventsCalendarNav(-1)" class="p-2 rounded-lg hover:bg-gray-100 transition">
          <svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
        </button>
        <h3 class="text-lg font-semibold text-gray-900">${monthName}</h3>
        <button onclick="eventsCalendarNav(1)" class="p-2 rounded-lg hover:bg-gray-100 transition">
          <svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
        </button>
      </div>
      <div class="grid grid-cols-7 gap-1 mb-1">
        ${dayNames.map(d => `<div class="text-xs font-medium text-gray-500 text-center py-1">${d}</div>`).join('')}
      </div>
      <div class="grid grid-cols-7 gap-1">
        ${cells}
      </div>
    </div>
  `;
}

function eventsCalendarNav(dir) {
  eventsCalendarDate.setMonth(eventsCalendarDate.getMonth() + dir);
  renderEventsView();
}

function showCreateEventModal() {
  const now = new Date();
  const defaultStart = new Date(now.getTime() + 86400000);
  defaultStart.setMinutes(0, 0, 0);
  const startStr = defaultStart.toISOString().slice(0, 16);
  const endDate = new Date(defaultStart.getTime() + 3600000);
  const endStr = endDate.toISOString().slice(0, 16);

  document.getElementById('modal-content').className = 'bg-white rounded-xl shadow-2xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto';
  showModal(`
    <div class="p-6">
      <div class="flex items-center justify-between mb-6">
        <h3 class="text-xl font-bold text-gray-900">Create Event</h3>
        <button onclick="closeModal()" class="text-gray-400 hover:text-gray-600"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
      </div>
      <form id="create-event-form" onsubmit="submitCreateEvent(event)">
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Event Name *</label>
            <input type="text" name="name" required class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" placeholder="e.g. Saturday Morning Yoga">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea name="description" rows="2" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" placeholder="Optional description..."></textarea>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Start Date/Time *</label>
              <input type="datetime-local" name="starts_at" required value="${startStr}" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">End Date/Time *</label>
              <input type="datetime-local" name="ends_at" required value="${endStr}" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Capacity *</label>
              <input type="number" name="capacity" required min="1" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" placeholder="20">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Price (£)</label>
              <input type="number" name="price" step="0.01" min="0" value="0" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Tags</label>
            <input type="text" name="tags" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" placeholder="yoga, social, kids (comma-separated)">
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Min Participants</label>
              <input type="number" name="min_participants" min="0" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Auto-Cancel Deadline</label>
              <input type="datetime-local" name="auto_cancel_deadline" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select name="status" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
              <option value="scheduled">Scheduled</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
        <div id="create-event-error" class="text-red-500 text-sm mt-3 hidden"></div>
        <div class="flex justify-end gap-2 mt-6">
          <button type="button" onclick="closeModal()" class="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition text-sm font-medium">Cancel</button>
          <button type="submit" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition text-sm font-medium">Create Event</button>
        </div>
      </form>
    </div>
  `);
}

async function submitCreateEvent(e) {
  e.preventDefault();
  const form = document.getElementById('create-event-form');
  const data = Object.fromEntries(new FormData(form));
  data.starts_at = new Date(data.starts_at).toISOString();
  data.ends_at = new Date(data.ends_at).toISOString();
  data.capacity = parseInt(data.capacity) || null;
  data.price = parseFloat(data.price) || 0;
  data.min_participants = data.min_participants ? parseInt(data.min_participants) : null;
  data.auto_cancel_deadline = data.auto_cancel_deadline ? new Date(data.auto_cancel_deadline).toISOString() : null;
  if (!data.tags) delete data.tags;
  if (!data.description) delete data.description;

  try {
    await api('POST', '/api/events', data);
    closeModal();
    showToast('Event created', 'success');
    await renderEventsView();
  } catch (err) {
    const errEl = document.getElementById('create-event-error');
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  }
}

async function openEventDetail(eventId) {
  try {
    const ev = await api('GET', `/api/events/${eventId}`);
    if (!ev) { showToast('Event not found', 'error'); return; }

    const start = new Date(ev.starts_at);
    const end = new Date(ev.ends_at);
    const dateStr = start.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    const timeStr = start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) + ' – ' + end.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const priceStr = ev.price > 0 ? `£${parseFloat(ev.price).toFixed(2)}` : 'Free';
    const statusMap = { scheduled: 'bg-green-100 text-green-700', cancelled: 'bg-red-100 text-red-700', completed: 'bg-gray-100 text-gray-600' };
    const enrolled = (ev.enrolments || []).filter(e => e.status === 'enrolled' || e.status === 'attended');
    const capacityNum = ev.capacity || 0;
    const enrolledCount = enrolled.length;
    const isFull = capacityNum > 0 && enrolledCount >= capacityNum;
    const capacityPct = capacityNum > 0 ? Math.min((enrolledCount / capacityNum) * 100, 100) : 0;
    const capacityColor = capacityPct >= 90 ? 'bg-red-500' : capacityPct >= 70 ? 'bg-yellow-500' : 'bg-green-500';

    document.getElementById('modal-content').className = 'bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto';
    showModal(`
      <div class="p-6">
        <div class="flex items-start justify-between mb-4">
          <div>
            <h3 class="text-xl font-bold text-gray-900">${ev.name}</h3>
            <span class="px-2 py-0.5 rounded-full text-xs font-medium ${statusMap[ev.status] || 'bg-gray-100 text-gray-600'}">${ev.status.charAt(0).toUpperCase() + ev.status.slice(1)}</span>
          </div>
          <button onclick="closeModal()" class="text-gray-400 hover:text-gray-600"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
        </div>
        <div class="grid grid-cols-2 gap-4 mb-6">
          <div class="bg-gray-50 rounded-lg p-3">
            <p class="text-xs text-gray-500 uppercase font-medium">Date</p>
            <p class="text-sm font-medium text-gray-900 mt-0.5">${dateStr}</p>
          </div>
          <div class="bg-gray-50 rounded-lg p-3">
            <p class="text-xs text-gray-500 uppercase font-medium">Time</p>
            <p class="text-sm font-medium text-gray-900 mt-0.5">${timeStr}</p>
          </div>
          <div class="bg-gray-50 rounded-lg p-3">
            <p class="text-xs text-gray-500 uppercase font-medium">Capacity</p>
            <p class="text-sm font-medium text-gray-900 mt-0.5">${ev.capacity ? `${enrolledCount} / ${ev.capacity} enrolled` : 'Unlimited'}</p>
            ${ev.capacity ? `<div class="w-full h-2 bg-gray-200 rounded-full mt-2"><div class="h-full rounded-full ${capacityColor} transition-all" style="width:${capacityPct}%"></div></div>` : ''}
            ${isFull ? '<p class="text-xs text-red-600 font-semibold mt-1">Event Full</p>' : ''}
          </div>
          <div class="bg-gray-50 rounded-lg p-3">
            <p class="text-xs text-gray-500 uppercase font-medium">Price</p>
            <p class="text-sm font-medium text-gray-900 mt-0.5">${priceStr}</p>
          </div>
        </div>
        ${ev.description ? `<div class="mb-4"><p class="text-xs text-gray-500 uppercase font-medium mb-1">Description</p><p class="text-sm text-gray-700">${ev.description}</p></div>` : ''}
        ${ev.tags ? `<div class="mb-4"><p class="text-xs text-gray-500 uppercase font-medium mb-1">Tags</p><div class="flex flex-wrap gap-1">${ev.tags.split(',').map(t => `<span class="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">${t.trim()}</span>`).join('')}</div></div>` : ''}

        <div class="border-t border-gray-200 pt-4 mb-4">
          <div class="flex items-center justify-between mb-3">
            <h4 class="font-semibold text-gray-900">Enrolled Members (${enrolledCount})</h4>
            ${ev.status === 'scheduled' && !isFull ? `<button onclick="showEventEnrolSearch('${ev.id}')" class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition">+ Add Member</button>` : ''}
            ${ev.status === 'scheduled' && isFull ? `<span class="px-3 py-1.5 bg-gray-200 text-gray-500 text-xs font-medium rounded-lg cursor-not-allowed">Event Full</span>` : ''}
          </div>
          <div id="event-enrol-search-container" class="hidden mb-3">
            <div class="relative">
              <input type="text" id="event-enrol-search-input" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm" placeholder="Search member by name or email..." oninput="searchMembersForEventInline(this.value, '${ev.id}')">
              <button onclick="hideEventEnrolSearch()" class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div id="event-enrol-search-results" class="mt-2 max-h-40 overflow-y-auto"></div>
          </div>
          ${enrolled.length === 0
            ? '<p class="text-gray-400 text-sm">No members enrolled yet</p>'
            : `<div class="space-y-2 max-h-60 overflow-y-auto">${enrolled.map(en => `
                <div class="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                  <div class="flex items-center gap-2">
                    <div class="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold" style="background:${nameToColour(en.first_name + en.last_name)}">${getInitials(en.first_name, en.last_name).toUpperCase()}</div>
                    <div>
                      <span class="text-sm font-medium">${en.first_name} ${en.last_name}</span>
                      <span class="text-xs text-gray-400 ml-2">${en.email || ''}</span>
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="text-xs text-gray-400">${formatDate(en.enrolled_at)}</span>
                    ${ev.status === 'scheduled' ? `<button onclick="removeEnrolment('${ev.id}', '${en.member_id}')" class="p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-600 transition" title="Remove">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>` : ''}
                  </div>
                </div>
              `).join('')}</div>`
          }
        </div>

        ${ev.status === 'scheduled' ? `
          <div class="flex justify-end gap-2 pt-4 border-t border-gray-200">
            <button onclick="cancelEventAction('${ev.id}')" class="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg transition text-sm font-medium">Cancel Event</button>
          </div>
        ` : ''}
      </div>
    `);
  } catch (err) {
    showToast('Error loading event: ' + err.message, 'error');
  }
}

function showEventEnrolSearch(eventId) {
  const container = document.getElementById('event-enrol-search-container');
  if (container) {
    container.classList.remove('hidden');
    const input = document.getElementById('event-enrol-search-input');
    if (input) input.focus();
  }
}

function hideEventEnrolSearch() {
  const container = document.getElementById('event-enrol-search-container');
  if (container) {
    container.classList.add('hidden');
    const input = document.getElementById('event-enrol-search-input');
    if (input) input.value = '';
    const results = document.getElementById('event-enrol-search-results');
    if (results) results.innerHTML = '';
  }
}

let eventEnrolSearchTimer = null;
async function searchMembersForEventInline(query, eventId) {
  clearTimeout(eventEnrolSearchTimer);
  const results = document.getElementById('event-enrol-search-results');
  if (query.length < 2) { results.innerHTML = ''; return; }
  eventEnrolSearchTimer = setTimeout(async () => {
    try {
      const members = await api('GET', `/api/members/search?q=${encodeURIComponent(query)}&limit=10`);
      results.innerHTML = members.map(m => `
        <div onclick="enrolMemberInEventInline('${eventId}', '${m.id}')" class="flex items-center gap-2 p-2 rounded-lg hover:bg-blue-50 cursor-pointer transition">
          <div class="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold" style="background:${nameToColour(m.first_name + m.last_name)}">${getInitials(m.first_name, m.last_name).toUpperCase()}</div>
          <div class="flex-1 min-w-0"><p class="text-sm font-medium">${m.first_name} ${m.last_name}</p><p class="text-xs text-gray-400 truncate">${m.email || ''}</p></div>
        </div>
      `).join('') || '<p class="text-gray-400 text-sm p-2">No members found</p>';
    } catch (err) { results.innerHTML = ''; }
  }, 300);
}

async function enrolMemberInEventInline(eventId, memberId) {
  try {
    await api('POST', `/api/events/${eventId}/enroll`, { member_id: memberId });
    showToast('Member enrolled', 'success');
    openEventDetail(eventId);
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

async function removeEnrolment(eventId, memberId) {
  if (!confirm('Remove this member from the event?')) return;
  try {
    await api('DELETE', `/api/events/${eventId}/enroll/${memberId}`);
    showToast('Member removed', 'success');
    openEventDetail(eventId);
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

async function cancelEventAction(eventId) {
  if (!confirm('Are you sure you want to cancel this event? All enrolments will be cancelled.')) return;
  try {
    await api('POST', `/api/events/${eventId}/cancel`, { reason: 'Cancelled by staff' });
    closeModal();
    showToast('Event cancelled', 'success');
    await renderEventsView();
  } catch (err) { showToast('Error: ' + err.message, 'error'); }
}

function showAddMemberToEventModal(eventId) {
  document.getElementById('modal-content').className = 'bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto';
  showModal(`
    <div class="p-6">
      <h3 class="text-lg font-bold text-gray-900 mb-4">Add Member to Event</h3>
      <input type="text" id="event-member-search" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 mb-3" placeholder="Search member by name..." oninput="searchMembersForEvent(this.value, '${eventId}')">
      <div id="event-member-results" class="max-h-64 overflow-y-auto"></div>
      <div class="flex justify-end mt-4">
        <button onclick="openEventDetail('${eventId}')" class="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition text-sm font-medium">Back</button>
      </div>
    </div>
  `);
}

let eventMemberSearchTimer = null;
async function searchMembersForEvent(query, eventId) {
  clearTimeout(eventMemberSearchTimer);
  if (query.length < 2) { document.getElementById('event-member-results').innerHTML = ''; return; }
  eventMemberSearchTimer = setTimeout(async () => {
    try {
      const members = await api('GET', `/api/members/search?q=${encodeURIComponent(query)}&limit=10`);
      const results = document.getElementById('event-member-results');
      results.innerHTML = members.map(m => `
        <div onclick="enrolMemberInEvent('${eventId}', '${m.id}')" class="flex items-center gap-2 p-2 rounded-lg hover:bg-blue-50 cursor-pointer transition">
          <div class="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style="background:${nameToColour(m.first_name + m.last_name)}">${getInitials(m.first_name, m.last_name).toUpperCase()}</div>
          <div><p class="text-sm font-medium">${m.first_name} ${m.last_name}</p><p class="text-xs text-gray-400">${m.email || ''}</p></div>
        </div>
      `).join('') || '<p class="text-gray-400 text-sm">No members found</p>';
    } catch (err) {}
  }, 300);
}

async function enrolMemberInEvent(eventId, memberId) {
  try {
    await api('POST', '/api/events/enrol', { eventId, memberId });
    showToast('Member enrolled', 'success');
    openEventDetail(eventId);
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

// ============================================================
// ROUTES PAGE
// ============================================================

const GRADE_COLOURS = {
  VB: '#22C55E', V0: '#3B82F6', V1: '#0EA5E9', V2: '#EAB308', V3: '#F97316',
  V4: '#EF4444', V5: '#EC4899', V6: '#A855F7', V7: '#6366F1', V8: '#6B7280', V9: '#1a1a1a'
};

const HOLD_COLOURS = {
  Black: '#1a1a1a', Yellow: '#EAB308', Green: '#22C55E', Purple: '#A855F7', Mint: '#34D399', Red: '#EF4444'
};

let routesWallFilter = null;
let routesViewMode = 'cards'; // 'cards' or 'map'
let mapGradeFilters = new Set();
let mapColourFilters = new Set();
let mapShowStripped = false;

// Wall path definitions for SVG map
const WALL_PATHS = {
  wall_cove: {
    // Open line: zig-zags across top, then drops down right side
    path: 'M 100,130 L 145,155 L 260,100 L 400,155 L 530,100 L 620,100 L 660,180 L 680,300 L 690,420 L 690,450',
    fill: '#0EA5E9', label: 'Cove Wall', labelX: 350, labelY: 80, closed: false,
    climbOffset: 0
  },
  wall_mothership: {
    // Elongated octagon in centre — climbs go on the perimeter
    path: 'M 280,320 L 280,245 L 320,210 L 500,205 L 540,240 L 540,320 L 500,355 L 320,360 Z',
    fill: '#EAB308', label: 'Mothership', labelX: 410, labelY: 290, closed: true,
    climbOffset: 0
  },
  wall_mystery: {
    // Open line across bottom — shallow arch. Climbs sit on the line.
    path: 'M 120,490 L 170,530 L 380,505 L 560,520 L 620,515 L 620,570',
    fill: '#EF4444', label: 'Magical Mystery', labelX: 390, labelY: 555, closed: false,
    climbOffset: 0
  }
};

// Get points along an SVG path for auto-distributing climbs
function getPointsAlongPath(pathStr, numPoints) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', pathStr);
  svg.appendChild(path);
  document.body.appendChild(svg);
  const totalLength = path.getTotalLength();
  const points = [];
  for (let i = 0; i < numPoints; i++) {
    const distance = (totalLength / (numPoints + 1)) * (i + 1);
    const pt = path.getPointAtLength(distance);
    points.push({ x: Math.round(pt.x * 10) / 10, y: Math.round(pt.y * 10) / 10 });
  }
  document.body.removeChild(svg);
  return points;
}

async function autoDistributeClimbs(climbs) {
  // Group climbs missing positions by wall
  const missing = {};
  for (const c of climbs) {
    if (c.map_x == null || c.map_y == null) {
      if (!missing[c.wall_id]) missing[c.wall_id] = [];
      missing[c.wall_id].push(c);
    }
  }
  const wallIds = Object.keys(missing);
  if (wallIds.length === 0) return;

  const positions = [];
  for (const wallId of wallIds) {
    const wallDef = WALL_PATHS[wallId];
    if (!wallDef) continue;
    const wallClimbs = missing[wallId];
    const pts = getPointsAlongPath(wallDef.path, wallClimbs.length);
    const offset = wallDef.climbOffset || 0;
    for (let i = 0; i < wallClimbs.length; i++) {
      // Offset climbs inward from the wall using normal direction
      let ox = pts[i].x, oy = pts[i].y;
      if (offset !== 0 && i < pts.length) {
        // Get tangent at this point and compute perpendicular offset
        const prev = i > 0 ? pts[i-1] : pts[i];
        const next = i < pts.length - 1 ? pts[i+1] : pts[i];
        const dx = next.x - prev.x, dy = next.y - prev.y;
        const len = Math.sqrt(dx*dx + dy*dy) || 1;
        // Perpendicular: rotate tangent 90 degrees
        ox = pts[i].x + (-dy / len) * offset;
        oy = pts[i].y + (dx / len) * offset;
      }
      wallClimbs[i].map_x = Math.round(ox * 10) / 10;
      wallClimbs[i].map_y = Math.round(oy * 10) / 10;
      positions.push({ id: wallClimbs[i].id, map_x: wallClimbs[i].map_x, map_y: wallClimbs[i].map_y });
    }
  }

  if (positions.length > 0) {
    try {
      await api('POST', '/api/routes/climbs/map-positions', { positions });
    } catch (e) { console.warn('Failed to save auto-distributed positions:', e); }
  }
}

async function loadRoutes() {
  const el = document.getElementById('page-routes');
  el.innerHTML = `
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-2xl font-bold text-gray-900">Routes</h2>
        <p class="text-gray-500 mt-1">Manage climbs across all walls</p>
      </div>
      <div class="flex items-center gap-3">
        <div class="flex bg-gray-100 rounded-lg p-0.5">
          <button onclick="switchRoutesView('cards')" id="routes-view-cards" class="px-3 py-1.5 text-sm font-medium rounded-md transition ${routesViewMode === 'cards' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}">
            <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/></svg>Cards
          </button>
          <button onclick="switchRoutesView('map')" id="routes-view-map" class="px-3 py-1.5 text-sm font-medium rounded-md transition ${routesViewMode === 'map' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}">
            <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/></svg>Map
          </button>
        </div>
        <button onclick="showAddClimbModal()" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition">+ Add Climb</button>
        <button onclick="confirmResetAllClimbs()" class="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 text-sm font-medium rounded-lg transition border border-red-200">Reset Gym</button>
      </div>
    </div>

    <!-- Wall Filter Tabs -->
    <div class="flex gap-2 mb-4" id="wall-filter-tabs"></div>

    <!-- Map Filter Bar (hidden when in cards mode) -->
    <div id="map-filter-bar" class="mb-4 ${routesViewMode === 'map' ? '' : 'hidden'}">
      <div class="bg-white border border-gray-200 rounded-xl p-3">
        <div class="flex flex-wrap items-center gap-4">
          <!-- Grade chips -->
          <div class="flex items-center gap-1.5">
            <span class="text-xs font-medium text-gray-500 mr-1">Grade:</span>
            <div class="flex flex-wrap gap-1" id="map-grade-chips"></div>
          </div>
          <!-- Colour filters -->
          <div class="flex items-center gap-1.5">
            <span class="text-xs font-medium text-gray-500 mr-1">Colour:</span>
            <div class="flex gap-1" id="map-colour-chips"></div>
          </div>
          <!-- Show stripped toggle -->
          <label class="flex items-center gap-1.5 cursor-pointer ml-auto">
            <input type="checkbox" id="map-show-stripped" onchange="mapShowStripped=this.checked;renderMapView()" class="rounded border-gray-300 text-blue-600 focus:ring-blue-500">
            <span class="text-xs text-gray-500">Show stripped</span>
          </label>
        </div>
      </div>
    </div>

    <!-- Cards view -->
    <div id="routes-cards-view" class="${routesViewMode === 'cards' ? '' : 'hidden'}">
      <div class="bg-white border border-gray-200 rounded-xl p-4 mb-6" id="grade-distribution-chart"></div>
      <div id="routes-climb-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"></div>
    </div>

    <!-- Map view -->
    <div id="routes-map-view" class="${routesViewMode === 'map' ? '' : 'hidden'}">
      <div id="gym-map-container" class="bg-white border border-gray-200 rounded-xl overflow-hidden relative" style="touch-action:none;">
        <div id="gym-map-wrapper" style="position:relative;width:100%;padding-bottom:75%;overflow:hidden;">
          <svg id="gym-map-svg" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid meet"
               style="position:absolute;top:0;left:0;width:100%;height:100%;background:#F9FAFB;"
               xmlns="http://www.w3.org/2000/svg">
            <!-- Grid pattern -->
            <defs>
              <pattern id="gym-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#E5E7EB" stroke-width="0.5"/>
              </pattern>
            </defs>
            <rect width="800" height="600" fill="url(#gym-grid)"/>

            <!-- Wall shapes -->
            <!-- Cove Wall: open path (no fill), thick stroke -->
            <path d="${WALL_PATHS.wall_cove.path}" fill="none" stroke="${WALL_PATHS.wall_cove.fill}" stroke-opacity="0.7" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
            <!-- Mothership: closed octagon with fill -->
            <path d="${WALL_PATHS.wall_mothership.path}" fill="${WALL_PATHS.wall_mothership.fill}" fill-opacity="0.12" stroke="${WALL_PATHS.wall_mothership.fill}" stroke-opacity="0.6" stroke-width="3"/>
            <!-- Magical Mystery: open path (no fill), thick stroke -->
            <path d="${WALL_PATHS.wall_mystery.path}" fill="none" stroke="${WALL_PATHS.wall_mystery.fill}" stroke-opacity="0.7" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>

            <!-- Wall labels -->
            <text x="${WALL_PATHS.wall_cove.labelX}" y="${WALL_PATHS.wall_cove.labelY}" text-anchor="middle" fill="#64748B" fill-opacity="0.5" font-size="18" font-weight="700">COVE WALL</text>
            <text x="${WALL_PATHS.wall_mothership.labelX}" y="${WALL_PATHS.wall_mothership.labelY}" text-anchor="middle" fill="#64748B" fill-opacity="0.5" font-size="16" font-weight="700">MOTHERSHIP</text>
            <text x="${WALL_PATHS.wall_mystery.labelX}" y="${WALL_PATHS.wall_mystery.labelY}" text-anchor="middle" fill="#64748B" fill-opacity="0.4" font-size="14" font-weight="700">MAGICAL MYSTERY</text>

            <!-- Reception marker — top left -->
            <g transform="translate(60,65)">
              <rect x="-18" y="-12" width="36" height="24" rx="4" fill="#94A3B8" fill-opacity="0.3" stroke="#94A3B8" stroke-opacity="0.5" stroke-width="1"/>
              <text x="0" y="5" text-anchor="middle" fill="#64748B" font-size="10" font-weight="600">REC</text>
            </g>

            <!-- Climb dots rendered here -->
            <g id="map-climbs-group"></g>
          </svg>
        </div>
        <!-- Zoom controls -->
        <div class="absolute top-3 right-3 flex flex-col gap-1">
          <button onclick="mapZoom(1.3)" class="w-8 h-8 bg-white border border-gray-300 rounded-lg shadow-sm flex items-center justify-center text-gray-600 hover:bg-gray-50 text-lg font-bold">+</button>
          <button onclick="mapZoom(1/1.3)" class="w-8 h-8 bg-white border border-gray-300 rounded-lg shadow-sm flex items-center justify-center text-gray-600 hover:bg-gray-50 text-lg font-bold">−</button>
          <button onclick="mapReset()" class="w-8 h-8 bg-white border border-gray-300 rounded-lg shadow-sm flex items-center justify-center text-gray-600 hover:bg-gray-50 text-xs font-medium">⟲</button>
        </div>
        <!-- Tooltip -->
        <div id="map-tooltip" class="hidden absolute bg-gray-900 text-white text-xs rounded-lg px-3 py-2 pointer-events-none shadow-lg z-50" style="max-width:200px;"></div>
      </div>
    </div>
  `;

  // Build filter chips for map
  buildMapFilterChips();
  await renderRoutesPage();
}

function switchRoutesView(mode) {
  routesViewMode = mode;
  document.getElementById('routes-view-cards').className = `px-3 py-1.5 text-sm font-medium rounded-md transition ${mode === 'cards' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`;
  document.getElementById('routes-view-map').className = `px-3 py-1.5 text-sm font-medium rounded-md transition ${mode === 'map' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`;

  const cardsView = document.getElementById('routes-cards-view');
  const mapView = document.getElementById('routes-map-view');
  const filterBar = document.getElementById('map-filter-bar');

  if (mode === 'cards') {
    cardsView.classList.remove('hidden');
    mapView.classList.add('hidden');
    filterBar.classList.add('hidden');
  } else {
    cardsView.classList.add('hidden');
    mapView.classList.remove('hidden');
    filterBar.classList.remove('hidden');
    renderMapView();
  }
}

function buildMapFilterChips() {
  const gradeContainer = document.getElementById('map-grade-chips');
  const colourContainer = document.getElementById('map-colour-chips');
  if (!gradeContainer || !colourContainer) return;

  const grades = ['VB','V0','V1','V2','V3','V4','V5','V6','V7','V8','V9'];
  gradeContainer.innerHTML = grades.map(g => {
    const active = mapGradeFilters.size === 0 || mapGradeFilters.has(g);
    return `<button onclick="toggleMapGrade('${g}')" class="px-2 py-0.5 rounded-full text-xs font-bold transition ${active ? 'text-white' : 'opacity-30 text-white'}" style="background:${GRADE_COLOURS[g]}">${g}</button>`;
  }).join('');

  colourContainer.innerHTML = Object.entries(HOLD_COLOURS).map(([name, hex]) => {
    const active = mapColourFilters.size === 0 || mapColourFilters.has(name);
    const border = name === 'Black' ? 'border-gray-400' : 'border-transparent';
    return `<button onclick="toggleMapColour('${name}')" class="w-6 h-6 rounded-full border-2 ${border} transition ${active ? '' : 'opacity-20'}" style="background:${hex}" title="${name}"></button>`;
  }).join('');
}

function toggleMapGrade(grade) {
  if (mapGradeFilters.has(grade)) {
    mapGradeFilters.delete(grade);
  } else {
    mapGradeFilters.add(grade);
  }
  // If all selected, clear filter (show all)
  if (mapGradeFilters.size === 11) mapGradeFilters.clear();
  buildMapFilterChips();
  renderMapView();
}

function toggleMapColour(colour) {
  if (mapColourFilters.has(colour)) {
    mapColourFilters.delete(colour);
  } else {
    mapColourFilters.add(colour);
  }
  if (mapColourFilters.size === Object.keys(HOLD_COLOURS).length) mapColourFilters.clear();
  buildMapFilterChips();
  renderMapView();
}

// Map zoom/pan state
let mapViewBox = { x: 0, y: 0, w: 800, h: 600 };

function mapZoom(factor) {
  const svg = document.getElementById('gym-map-svg');
  if (!svg) return;
  const cx = mapViewBox.x + mapViewBox.w / 2;
  const cy = mapViewBox.y + mapViewBox.h / 2;
  mapViewBox.w = Math.max(200, Math.min(1600, mapViewBox.w / factor));
  mapViewBox.h = Math.max(150, Math.min(1200, mapViewBox.h / factor));
  mapViewBox.x = cx - mapViewBox.w / 2;
  mapViewBox.y = cy - mapViewBox.h / 2;
  svg.setAttribute('viewBox', `${mapViewBox.x} ${mapViewBox.y} ${mapViewBox.w} ${mapViewBox.h}`);
}

function mapReset() {
  mapViewBox = { x: 0, y: 0, w: 800, h: 600 };
  const svg = document.getElementById('gym-map-svg');
  if (svg) svg.setAttribute('viewBox', '0 0 800 600');
}

// Touch/mouse pan support
(function setupMapPan() {
  let isPanning = false, startX, startY, startVBX, startVBY;

  document.addEventListener('pointerdown', (e) => {
    const svg = document.getElementById('gym-map-svg');
    if (!svg || !svg.contains(e.target)) return;
    // Don't pan if clicking a climb dot
    if (e.target.closest('.climb-dot-group')) return;
    isPanning = true;
    startX = e.clientX; startY = e.clientY;
    startVBX = mapViewBox.x; startVBY = mapViewBox.y;
    svg.style.cursor = 'grabbing';
  });

  document.addEventListener('pointermove', (e) => {
    if (!isPanning) return;
    const svg = document.getElementById('gym-map-svg');
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const scaleX = mapViewBox.w / rect.width;
    const scaleY = mapViewBox.h / rect.height;
    mapViewBox.x = startVBX - (e.clientX - startX) * scaleX;
    mapViewBox.y = startVBY - (e.clientY - startY) * scaleY;
    svg.setAttribute('viewBox', `${mapViewBox.x} ${mapViewBox.y} ${mapViewBox.w} ${mapViewBox.h}`);
  });

  document.addEventListener('pointerup', () => {
    if (!isPanning) return;
    isPanning = false;
    const svg = document.getElementById('gym-map-svg');
    if (svg) svg.style.cursor = 'grab';
  });

  // Mouse wheel zoom
  document.addEventListener('wheel', (e) => {
    const svg = document.getElementById('gym-map-svg');
    if (!svg || !svg.contains(e.target)) return;
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    mapZoom(factor);
  }, { passive: false });
})();

// Cache for climbs data used by map
let _mapClimbsCache = [];

async function renderMapView() {
  const group = document.getElementById('map-climbs-group');
  if (!group) return;

  let climbs = _mapClimbsCache;
  if (!climbs.length) return;

  // Filter
  let filtered = climbs.filter(c => {
    if (!mapShowStripped && c.status !== 'active') return false;
    if (routesWallFilter && c.wall_id !== routesWallFilter) return false;
    if (mapGradeFilters.size > 0 && !mapGradeFilters.has(c.grade)) return false;
    if (mapColourFilters.size > 0 && !mapColourFilters.has(c.colour)) return false;
    return c.map_x != null && c.map_y != null;
  });

  group.innerHTML = filtered.map(c => {
    const fillColour = HOLD_COLOURS[c.colour] || '#6B7280';
    const textColour = ['Yellow', 'Mint'].includes(c.colour) ? '#1a1a1a' : '#ffffff';
    const isStripped = c.status === 'stripped';
    return `
      <g class="climb-dot-group" data-climb-id="${c.id}" style="cursor:pointer"
         onmouseenter="showMapTooltip(event, this)" onmouseleave="hideMapTooltip()"
         onclick="openClimbDetail('${c.id}')">
        <circle cx="${c.map_x}" cy="${c.map_y}" r="14" fill="${fillColour}" stroke="white" stroke-width="2" ${isStripped ? 'opacity="0.4"' : ''}/>
        <text x="${c.map_x}" y="${c.map_y + 3}" text-anchor="middle" fill="${textColour}" font-size="8" font-weight="700" ${isStripped ? 'opacity="0.4"' : ''}>${c.grade}</text>
      </g>
    `;
  }).join('');
}

function showMapTooltip(event, el) {
  const tooltip = document.getElementById('map-tooltip');
  if (!tooltip) return;
  const climbId = el.getAttribute('data-climb-id');
  const climb = _mapClimbsCache.find(c => c.id === climbId);
  if (!climb) return;

  tooltip.innerHTML = `
    <div class="font-bold">${climb.grade} — ${climb.colour}</div>
    <div>${climb.wall_name}</div>
    ${climb.setter ? `<div>Setter: ${climb.setter}</div>` : ''}
    ${climb.style_tags ? `<div>${climb.style_tags}</div>` : ''}
    <div class="text-gray-400">Set: ${formatDate(climb.date_set)}</div>
  `;
  tooltip.classList.remove('hidden');

  const container = document.getElementById('gym-map-container');
  const containerRect = container.getBoundingClientRect();
  const x = event.clientX - containerRect.left + 12;
  const y = event.clientY - containerRect.top - 10;
  tooltip.style.left = x + 'px';
  tooltip.style.top = y + 'px';
}

function hideMapTooltip() {
  const tooltip = document.getElementById('map-tooltip');
  if (tooltip) tooltip.classList.add('hidden');
}

async function renderRoutesPage() {
  try {
    const [walls, activeClimbs, strippedClimbs, gradeDist] = await Promise.all([
      api('GET', '/api/routes/walls'),
      api('GET', `/api/routes/climbs?status=active${routesWallFilter ? '&wallId=' + routesWallFilter : ''}`),
      api('GET', `/api/routes/climbs?status=stripped${routesWallFilter ? '&wallId=' + routesWallFilter : ''}`),
      api('GET', `/api/routes/grade-distribution${routesWallFilter ? '?wallId=' + routesWallFilter : ''}`),
    ]);

    const allClimbs = [...activeClimbs, ...strippedClimbs];

    // Auto-distribute climbs missing map positions
    const needsPosition = allClimbs.filter(c => c.map_x == null || c.map_y == null);
    if (needsPosition.length > 0) {
      await autoDistributeClimbs(allClimbs);
    }

    // Cache for map view
    _mapClimbsCache = allClimbs;

    // Render map if in map mode
    if (routesViewMode === 'map') {
      renderMapView();
    }

    // Wall filter tabs
    const tabContainer = document.getElementById('wall-filter-tabs');
    if (tabContainer) {
      tabContainer.innerHTML = `
        <button onclick="setWallFilter(null)" class="px-4 py-2 rounded-lg text-sm font-medium transition ${!routesWallFilter ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}">All</button>
        ${walls.map(w => `
          <button onclick="setWallFilter('${w.id}')" class="px-4 py-2 rounded-lg text-sm font-medium transition ${routesWallFilter === w.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}">${w.name}</button>
        `).join('')}
      `;
    }

    // Grade distribution bar chart
    const chartContainer = document.getElementById('grade-distribution-chart');
    if (chartContainer) {
      const grades = ['VB', 'V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9'];
      const gradeMap = {};
      gradeDist.forEach(g => gradeMap[g.grade] = g.count);
      const maxCount = Math.max(...grades.map(g => gradeMap[g] || 0), 1);

      chartContainer.innerHTML = `
        <h3 class="text-sm font-semibold text-gray-700 mb-3">Grade Distribution</h3>
        <div class="flex items-end gap-2 h-24">
          ${grades.map(g => {
            const count = gradeMap[g] || 0;
            const height = count > 0 ? Math.max((count / maxCount) * 100, 8) : 0;
            return `
              <div class="flex-1 flex flex-col items-center gap-1">
                <span class="text-xs font-medium text-gray-500">${count}</span>
                <div class="w-full rounded-t" style="height:${height}%;background:${GRADE_COLOURS[g] || '#9CA3AF'};min-height:${count > 0 ? '4px' : '0'}"></div>
                <span class="text-xs text-gray-500 font-medium">${g}</span>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    // Climb cards grid
    const grid = document.getElementById('routes-climb-grid');
    if (grid) {
      if (allClimbs.length === 0) {
        grid.innerHTML = `
          <div class="col-span-3 bg-white border border-gray-200 rounded-xl p-12 text-center">
            <p class="text-gray-500 font-medium">No climbs found</p>
            <p class="text-gray-400 text-sm mt-1">Add your first climb to get started</p>
          </div>
        `;
      } else {
        grid.innerHTML = allClimbs.map(c => {
          const holdColour = HOLD_COLOURS[c.colour] || '#6B7280';
          const gradeColour = GRADE_COLOURS[c.grade] || '#6B7280';
          const isStripped = c.status === 'stripped';
          const textOnHold = ['Yellow', 'Mint'].includes(c.colour) ? 'text-gray-900' : 'text-white';

          return `
            <div onclick="openClimbDetail('${c.id}')" class="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md hover:border-blue-300 transition cursor-pointer ${isStripped ? 'opacity-60' : ''}">
              <div class="flex items-start justify-between mb-3">
                <div class="flex items-center gap-2">
                  <span class="px-2.5 py-1 rounded-lg text-sm font-bold ${textOnHold}" style="background:${holdColour}">${c.grade}</span>
                  <span class="text-sm font-medium text-gray-900">${c.wall_name}</span>
                </div>
                ${isStripped
                  ? '<span class="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full font-medium">Stripped</span>'
                  : '<span class="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-medium">Active</span>'}
              </div>
              <div class="space-y-1 text-sm text-gray-500">
                <div class="flex items-center gap-1.5">
                  <span class="w-3 h-3 rounded-full" style="background:${holdColour}"></span>
                  <span>${c.colour}</span>
                </div>
                ${c.setter ? `<p>Setter: <span class="text-gray-700 font-medium">${c.setter}</span></p>` : ''}
                <p>Set: ${formatDate(c.date_set)}</p>
                ${c.style_tags ? `<div class="flex flex-wrap gap-1 mt-2">${c.style_tags.split(',').map(t => `<span class="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">${t.trim()}</span>`).join('')}</div>` : ''}
              </div>
            </div>
          `;
        }).join('');
      }
    }
  } catch (err) {
    const grid = document.getElementById('routes-climb-grid');
    if (grid) grid.innerHTML = `<p class="text-red-400 col-span-3">Error: ${err.message}</p>`;
  }
}

function setWallFilter(wallId) {
  routesWallFilter = wallId;
  if (routesViewMode === 'map') {
    renderMapView();
    // Also update wall tabs visuals
    const tabContainer = document.getElementById('wall-filter-tabs');
    if (tabContainer) {
      tabContainer.querySelectorAll('button').forEach(btn => {
        const isAll = btn.textContent.trim() === 'All';
        const isActive = isAll ? !wallId : btn.textContent.trim() === (wallId === 'wall_cove' ? 'Cove Wall' : wallId === 'wall_mothership' ? 'Mothership' : wallId === 'wall_mystery' ? 'Magical Mystery' : '');
        btn.className = `px-4 py-2 rounded-lg text-sm font-medium transition ${isActive ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`;
      });
    }
  } else {
    renderRoutesPage();
  }
}

function showAddClimbModal(existingClimb = null) {
  const isEdit = !!existingClimb;
  const title = isEdit ? 'Edit Climb' : 'Add Climb';
  const today = new Date().toISOString().split('T')[0];

  document.getElementById('modal-content').className = 'bg-white rounded-xl shadow-2xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto';
  showModal(`
    <div class="p-6">
      <div class="flex items-center justify-between mb-6">
        <h3 class="text-xl font-bold text-gray-900">${title}</h3>
        <button onclick="closeModal()" class="text-gray-400 hover:text-gray-600"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
      </div>
      <form id="climb-form" onsubmit="submitClimbForm(event, ${isEdit ? `'${existingClimb.id}'` : 'null'})">
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Wall *</label>
            <select name="wall_id" required class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
              <option value="wall_cove" ${isEdit && existingClimb.wall_id === 'wall_cove' ? 'selected' : ''}>Cove Wall</option>
              <option value="wall_mothership" ${isEdit && existingClimb.wall_id === 'wall_mothership' ? 'selected' : ''}>Mothership</option>
              <option value="wall_mystery" ${isEdit && existingClimb.wall_id === 'wall_mystery' ? 'selected' : ''}>Magical Mystery</option>
            </select>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Grade *</label>
              <select name="grade" required class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
                ${['VB','V0','V1','V2','V3','V4','V5','V6','V7','V8','V9'].map(g =>
                  `<option value="${g}" ${isEdit && existingClimb.grade === g ? 'selected' : ''} style="color:${GRADE_COLOURS[g]}">${g}</option>`
                ).join('')}
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Hold Colour *</label>
              <select name="colour" required class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" onchange="updateColourPreview(this)">
                ${Object.entries(HOLD_COLOURS).map(([name, hex]) =>
                  `<option value="${name}" ${isEdit && existingClimb.colour === name ? 'selected' : ''}>${name}</option>`
                ).join('')}
              </select>
              <div id="colour-preview" class="mt-1 h-3 rounded" style="background:${isEdit ? HOLD_COLOURS[existingClimb.colour] : HOLD_COLOURS.Black}"></div>
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Setter Name</label>
            <input type="text" name="setter" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" value="${isEdit ? (existingClimb.setter || '') : ''}" placeholder="Who set this climb?">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Style Tags</label>
            <input type="text" name="style_tags" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" value="${isEdit ? (existingClimb.style_tags || '') : ''}" placeholder="crimpy, overhang, dynamic (comma-separated)">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Date Set</label>
            <input type="date" name="date_set" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" value="${isEdit ? (existingClimb.date_set || today) : today}">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea name="notes" rows="2" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" placeholder="Any additional notes...">${isEdit ? (existingClimb.notes || '') : ''}</textarea>
          </div>

          <!-- Map position picker -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Map Position <span class="text-gray-400 font-normal">(click to place)</span></label>
            <div class="border border-gray-200 rounded-lg overflow-hidden bg-gray-50" style="position:relative">
              <svg id="climb-form-minimap" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid meet"
                   style="width:100%;height:200px;background:#F9FAFB;cursor:crosshair"
                   onclick="placeClimbOnMinimap(event)">
                <defs><pattern id="minigrid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="#E5E7EB" stroke-width="0.5"/></pattern></defs>
                <rect width="800" height="600" fill="url(#minigrid)"/>
                <path d="${WALL_PATHS.wall_cove.path}" fill="none" stroke="${WALL_PATHS.wall_cove.fill}" stroke-opacity="0.6" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="${WALL_PATHS.wall_mothership.path}" fill="${WALL_PATHS.wall_mothership.fill}" fill-opacity="0.1" stroke="${WALL_PATHS.wall_mothership.fill}" stroke-opacity="0.5" stroke-width="2"/>
                <path d="${WALL_PATHS.wall_mystery.path}" fill="none" stroke="${WALL_PATHS.wall_mystery.fill}" stroke-opacity="0.6" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                <text x="${WALL_PATHS.wall_cove.labelX}" y="${WALL_PATHS.wall_cove.labelY}" text-anchor="middle" fill="#94A3B8" font-size="14" font-weight="700">COVE</text>
                <text x="${WALL_PATHS.wall_mothership.labelX}" y="${WALL_PATHS.wall_mothership.labelY}" text-anchor="middle" fill="#94A3B8" font-size="12" font-weight="700">MOTHERSHIP</text>
                <text x="${WALL_PATHS.wall_mystery.labelX}" y="${WALL_PATHS.wall_mystery.labelY}" text-anchor="middle" fill="#94A3B8" font-size="11" font-weight="700">MYSTERY</text>
                <circle id="minimap-preview-dot" cx="${isEdit && existingClimb.map_x ? existingClimb.map_x : 0}" cy="${isEdit && existingClimb.map_y ? existingClimb.map_y : 0}" r="10" fill="#3B82F6" stroke="white" stroke-width="2" ${isEdit && existingClimb.map_x ? '' : 'visibility="hidden"'}/>
              </svg>
            </div>
            <input type="hidden" name="map_x" id="climb-form-map-x" value="${isEdit && existingClimb.map_x != null ? existingClimb.map_x : ''}">
            <input type="hidden" name="map_y" id="climb-form-map-y" value="${isEdit && existingClimb.map_y != null ? existingClimb.map_y : ''}">
          </div>
        </div>
        <div id="climb-form-error" class="text-red-500 text-sm mt-3 hidden"></div>
        <div class="flex justify-end gap-2 mt-6">
          <button type="button" onclick="closeModal()" class="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition text-sm font-medium">Cancel</button>
          <button type="submit" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition text-sm font-medium">${isEdit ? 'Save Changes' : 'Add Climb'}</button>
        </div>
      </form>
    </div>
  `);
}

function updateColourPreview(select) {
  const preview = document.getElementById('colour-preview');
  if (preview) preview.style.background = HOLD_COLOURS[select.value] || '#6B7280';
}

function placeClimbOnMinimap(event) {
  const svg = document.getElementById('climb-form-minimap');
  if (!svg) return;
  const pt = svg.createSVGPoint();
  pt.x = event.clientX;
  pt.y = event.clientY;
  const svgPt = pt.matrixTransform(svg.getScreenCTM().inverse());

  const dot = document.getElementById('minimap-preview-dot');
  dot.setAttribute('cx', svgPt.x);
  dot.setAttribute('cy', svgPt.y);
  dot.setAttribute('visibility', 'visible');

  document.getElementById('climb-form-map-x').value = Math.round(svgPt.x * 10) / 10;
  document.getElementById('climb-form-map-y').value = Math.round(svgPt.y * 10) / 10;
}

async function submitClimbForm(e, climbId) {
  e.preventDefault();
  const form = document.getElementById('climb-form');
  const data = Object.fromEntries(new FormData(form));
  if (!data.setter) delete data.setter;
  if (!data.style_tags) delete data.style_tags;
  if (!data.notes) delete data.notes;
  if (data.map_x !== '' && data.map_x != null) { data.map_x = parseFloat(data.map_x); } else { delete data.map_x; }
  if (data.map_y !== '' && data.map_y != null) { data.map_y = parseFloat(data.map_y); } else { delete data.map_y; }

  try {
    if (climbId) {
      await api('PUT', `/api/routes/climbs/${climbId}`, data);
      showToast('Climb updated', 'success');
    } else {
      await api('POST', '/api/routes/climbs', data);
      showToast('Climb added', 'success');
    }
    closeModal();
    await renderRoutesPage();
  } catch (err) {
    const errEl = document.getElementById('climb-form-error');
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  }
}

async function openClimbDetail(climbId) {
  try {
    const [climb, feedback] = await Promise.all([
      api('GET', `/api/routes/climbs/${climbId}`),
      api('GET', `/api/routes/feedback/${climbId}`).catch(() => []),
    ]);
    if (!climb) { showToast('Climb not found', 'error'); return; }

    const holdColour = HOLD_COLOURS[climb.colour] || '#6B7280';
    const textOnHold = ['Yellow', 'Mint'].includes(climb.colour) ? 'text-gray-900' : 'text-white';
    const isActive = climb.status === 'active';

    document.getElementById('modal-content').className = 'bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto';
    showModal(`
      <div class="p-6">
        <div class="flex items-start justify-between mb-4">
          <div class="flex items-center gap-3">
            <span class="px-3 py-1.5 rounded-lg text-lg font-bold ${textOnHold}" style="background:${holdColour}">${climb.grade}</span>
            <div>
              <h3 class="text-lg font-bold text-gray-900">${climb.wall_name}</h3>
              <span class="px-2 py-0.5 rounded-full text-xs font-medium ${isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}">${climb.status.charAt(0).toUpperCase() + climb.status.slice(1)}</span>
            </div>
          </div>
          <button onclick="closeModal()" class="text-gray-400 hover:text-gray-600"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
        </div>

        <div class="grid grid-cols-2 gap-3 mb-4">
          <div class="bg-gray-50 rounded-lg p-3">
            <p class="text-xs text-gray-500 uppercase">Hold Colour</p>
            <div class="flex items-center gap-2 mt-1">
              <span class="w-4 h-4 rounded-full" style="background:${holdColour}"></span>
              <span class="text-sm font-medium">${climb.colour}</span>
            </div>
          </div>
          <div class="bg-gray-50 rounded-lg p-3">
            <p class="text-xs text-gray-500 uppercase">Setter</p>
            <p class="text-sm font-medium mt-1">${climb.setter || 'Unknown'}</p>
          </div>
          <div class="bg-gray-50 rounded-lg p-3">
            <p class="text-xs text-gray-500 uppercase">Date Set</p>
            <p class="text-sm font-medium mt-1">${formatDate(climb.date_set)}</p>
          </div>
          <div class="bg-gray-50 rounded-lg p-3">
            <p class="text-xs text-gray-500 uppercase">Stats</p>
            <p class="text-sm font-medium mt-1">${climb.log_count} logs · ${climb.send_count} sends</p>
          </div>
        </div>

        ${climb.style_tags ? `<div class="mb-4"><p class="text-xs text-gray-500 uppercase mb-1">Style</p><div class="flex flex-wrap gap-1">${climb.style_tags.split(',').map(t => `<span class="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-full">${t.trim()}</span>`).join('')}</div></div>` : ''}
        ${climb.notes ? `<div class="mb-4"><p class="text-xs text-gray-500 uppercase mb-1">Notes</p><p class="text-sm text-gray-700">${climb.notes}</p></div>` : ''}

        ${climb.avg_rating > 0 ? `<div class="mb-4"><p class="text-xs text-gray-500 uppercase mb-1">Rating</p><p class="text-sm">${'★'.repeat(Math.round(climb.avg_rating))}${'☆'.repeat(5 - Math.round(climb.avg_rating))} <span class="text-gray-400">(${climb.feedback_count} reviews)</span></p></div>` : ''}

        ${feedback.length > 0 ? `
          <div class="mb-4 border-t border-gray-200 pt-4">
            <p class="text-xs text-gray-500 uppercase mb-2">Feedback</p>
            <div class="space-y-2 max-h-32 overflow-y-auto">
              ${feedback.slice(0, 5).map(f => `
                <div class="bg-gray-50 rounded-lg p-2">
                  <div class="flex items-center gap-2">
                    ${f.rating ? `<span class="text-xs">${'★'.repeat(f.rating)}</span>` : ''}
                    ${f.grade_opinion ? `<span class="px-1.5 py-0.5 text-xs rounded ${f.grade_opinion === 'soft' ? 'bg-green-100 text-green-700' : f.grade_opinion === 'hard' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}">${f.grade_opinion}</span>` : ''}
                    ${f.first_name ? `<span class="text-xs text-gray-400">${f.first_name} ${f.last_name}</span>` : ''}
                  </div>
                  ${f.comment ? `<p class="text-xs text-gray-600 mt-1">${f.comment}</p>` : ''}
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <div class="flex justify-end gap-2 pt-4 border-t border-gray-200">
          <button onclick="editClimbFromDetail('${climb.id}')" class="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition text-sm font-medium">Edit</button>
          ${isActive ? `<button onclick="stripClimbAction('${climb.id}')" class="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg transition text-sm font-medium">Strip Climb</button>` : ''}
        </div>
      </div>
    `);
  } catch (err) {
    showToast('Error loading climb: ' + err.message, 'error');
  }
}

async function editClimbFromDetail(climbId) {
  try {
    const climb = await api('GET', `/api/routes/climbs/${climbId}`);
    showAddClimbModal(climb);
  } catch (err) { showToast('Error: ' + err.message, 'error'); }
}

async function stripClimbAction(climbId) {
  if (!confirm('Strip this climb? This will mark it as stripped.')) return;
  try {
    await api('POST', `/api/routes/climbs/${climbId}/strip`);
    closeModal();
    showToast('Climb stripped', 'success');
    await renderRoutesPage();
  } catch (err) { showToast('Error: ' + err.message, 'error'); }
}

async function confirmResetAllClimbs() {
  showModal(`
    <div class="text-center">
      <div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg class="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg>
      </div>
      <h3 class="text-xl font-bold text-gray-900 mb-2">Reset All Climbs?</h3>
      <p class="text-gray-600 mb-2">This will strip ALL active climbs across every wall.</p>
      <p class="text-gray-500 text-sm mb-6">Stripped climbs are kept in history but won't appear on the map or active list. Use this when the gym gets a full reset.</p>
      <div class="flex justify-center gap-3">
        <button onclick="closeModal()" class="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition text-sm font-medium">Cancel</button>
        <button onclick="executeResetAllClimbs()" class="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition text-sm font-medium">Strip All Climbs</button>
      </div>
    </div>
  `);
}

async function executeResetAllClimbs() {
  try {
    const res = await api('POST', '/api/routes/climbs/strip-all');
    closeModal();
    showToast('All climbs stripped — ' + (res.count || 0) + ' climbs reset', 'success');
    await renderRoutesPage();
  } catch (err) { showToast('Error: ' + err.message, 'error'); }
}

// ============================================================
// ANALYTICS PAGE
// ============================================================

async function loadAnalytics() {
  const el = document.getElementById('page-analytics');
  el.innerHTML = `
    <div class="mb-6">
      <h2 class="text-2xl font-bold text-gray-900">Analytics</h2>
      <p class="text-gray-500 mt-1">Dashboard overview and key metrics</p>
    </div>

    <!-- Summary Cards -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6" id="analytics-summary-cards">
      ${[1,2,3,4].map(() => `<div class="bg-white border border-gray-200 rounded-xl p-4 animate-pulse"><div class="h-4 bg-gray-200 rounded w-20 mb-2"></div><div class="h-8 bg-gray-200 rounded w-16"></div></div>`).join('')}
    </div>

    <!-- Charts Row -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      <div class="bg-white border border-gray-200 rounded-xl p-4" id="analytics-revenue-chart">
        <h3 class="text-sm font-semibold text-gray-700 mb-3">Revenue (Last 7 Days)</h3>
        <div class="h-40 flex items-center justify-center text-gray-400 text-sm">Loading...</div>
      </div>
      <div class="bg-white border border-gray-200 rounded-xl p-4" id="analytics-checkin-chart">
        <h3 class="text-sm font-semibold text-gray-700 mb-3">Check-in Trends (Last 7 Days)</h3>
        <div class="h-40 flex items-center justify-center text-gray-400 text-sm">Loading...</div>
      </div>
    </div>

    <!-- Bottom Row -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div class="bg-white border border-gray-200 rounded-xl p-4" id="analytics-popular-products">
        <h3 class="text-sm font-semibold text-gray-700 mb-3">Popular Products</h3>
        <div class="text-gray-400 text-sm text-center py-4">Loading...</div>
      </div>
      <div class="bg-white border border-gray-200 rounded-xl p-4" id="analytics-grade-dist">
        <h3 class="text-sm font-semibold text-gray-700 mb-3">Grade Distribution (Active Climbs)</h3>
        <div class="text-gray-400 text-sm text-center py-4">Loading...</div>
      </div>
    </div>
  `;

  // Load all data in parallel
  try {
    const [dashboard, revenueDaily, checkinsDaily, products, gradeDist] = await Promise.all([
      api('GET', '/api/stats/dashboard'),
      api('GET', '/api/stats/revenue-daily?days=7'),
      api('GET', '/api/stats/checkins-daily?days=7'),
      api('GET', '/api/stats/popular-products?limit=10&days=30'),
      api('GET', '/api/routes/grade-distribution'),
    ]);

    // Summary cards
    const cards = document.getElementById('analytics-summary-cards');
    cards.innerHTML = `
      <div class="bg-white border border-gray-200 rounded-xl p-4">
        <p class="text-xs text-gray-500 uppercase font-medium">Total Members</p>
        <p class="text-2xl font-bold text-gray-900 mt-1">${dashboard.totalMembers.toLocaleString()}</p>
        <p class="text-xs text-gray-400 mt-1">${dashboard.activeMembers} with active pass</p>
      </div>
      <div class="bg-white border border-gray-200 rounded-xl p-4">
        <p class="text-xs text-gray-500 uppercase font-medium">Visitors Today</p>
        <p class="text-2xl font-bold text-blue-600 mt-1">${dashboard.todayCheckIns}</p>
        <p class="text-xs text-gray-400 mt-1">Check-ins today</p>
      </div>
      <div class="bg-white border border-gray-200 rounded-xl p-4">
        <p class="text-xs text-gray-500 uppercase font-medium">Revenue Today</p>
        <p class="text-2xl font-bold text-green-600 mt-1">£${parseFloat(dashboard.todayRevenue).toFixed(2)}</p>
        <p class="text-xs text-gray-400 mt-1">£${parseFloat(dashboard.weekRevenue).toFixed(2)} this week</p>
      </div>
      <div class="bg-white border border-gray-200 rounded-xl p-4">
        <p class="text-xs text-gray-500 uppercase font-medium">Transactions Today</p>
        <p class="text-2xl font-bold text-gray-900 mt-1">${dashboard.todayTransactions || 0}</p>
        <p class="text-xs text-gray-400 mt-1">Completed today</p>
      </div>
    `;

    // Revenue bar chart
    const revenueContainer = document.getElementById('analytics-revenue-chart');
    if (revenueDaily.length > 0) {
      const maxRev = Math.max(...revenueDaily.map(r => r.revenue), 1);
      revenueContainer.innerHTML = `
        <h3 class="text-sm font-semibold text-gray-700 mb-3">Revenue (Last 7 Days)</h3>
        <div class="flex items-end gap-2 h-40">
          ${revenueDaily.map(r => {
            const height = r.revenue > 0 ? Math.max((r.revenue / maxRev) * 100, 5) : 0;
            const dayLabel = new Date(r.date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short' });
            return `
              <div class="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                <span class="text-xs font-medium text-gray-600">£${parseFloat(r.revenue).toFixed(0)}</span>
                <div class="w-full bg-green-500 rounded-t transition-all" style="height:${height}%"></div>
                <span class="text-xs text-gray-500">${dayLabel}</span>
              </div>
            `;
          }).join('')}
        </div>
      `;
    } else {
      revenueContainer.innerHTML = `<h3 class="text-sm font-semibold text-gray-700 mb-3">Revenue (Last 7 Days)</h3><p class="text-gray-400 text-sm text-center py-8">No revenue data</p>`;
    }

    // Check-in bar chart
    const checkinContainer = document.getElementById('analytics-checkin-chart');
    if (checkinsDaily.length > 0) {
      const maxCI = Math.max(...checkinsDaily.map(c => c.count), 1);
      checkinContainer.innerHTML = `
        <h3 class="text-sm font-semibold text-gray-700 mb-3">Check-in Trends (Last 7 Days)</h3>
        <div class="flex items-end gap-2 h-40">
          ${checkinsDaily.map(c => {
            const height = c.count > 0 ? Math.max((c.count / maxCI) * 100, 5) : 0;
            const dayLabel = new Date(c.date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short' });
            return `
              <div class="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                <span class="text-xs font-medium text-gray-600">${c.count}</span>
                <div class="w-full bg-blue-500 rounded-t transition-all" style="height:${height}%"></div>
                <span class="text-xs text-gray-500">${dayLabel}</span>
              </div>
            `;
          }).join('')}
        </div>
      `;
    } else {
      checkinContainer.innerHTML = `<h3 class="text-sm font-semibold text-gray-700 mb-3">Check-in Trends (Last 7 Days)</h3><p class="text-gray-400 text-sm text-center py-8">No check-in data</p>`;
    }

    // Popular products
    const productsContainer = document.getElementById('analytics-popular-products');
    if (products.length > 0) {
      productsContainer.innerHTML = `
        <h3 class="text-sm font-semibold text-gray-700 mb-3">Popular Products (Last 30 Days)</h3>
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left text-xs text-gray-400 uppercase border-b border-gray-100">
              <th class="pb-2">Product</th>
              <th class="pb-2 text-right">Qty</th>
              <th class="pb-2 text-right">Revenue</th>
            </tr>
          </thead>
          <tbody>
            ${products.map((p, i) => `
              <tr class="border-b border-gray-50">
                <td class="py-2"><span class="text-gray-400 text-xs mr-2">${i + 1}.</span>${p.name}</td>
                <td class="py-2 text-right text-gray-600">${p.quantity}</td>
                <td class="py-2 text-right font-medium">£${parseFloat(p.revenue).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } else {
      productsContainer.innerHTML = `<h3 class="text-sm font-semibold text-gray-700 mb-3">Popular Products</h3><p class="text-gray-400 text-sm text-center py-8">No product data</p>`;
    }

    // Grade distribution
    const gradeContainer = document.getElementById('analytics-grade-dist');
    const grades = ['VB', 'V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9'];
    const gradeMap = {};
    gradeDist.forEach(g => gradeMap[g.grade] = g.count);
    const totalClimbs = gradeDist.reduce((s, g) => s + g.count, 0);

    if (totalClimbs > 0) {
      const maxG = Math.max(...grades.map(g => gradeMap[g] || 0), 1);
      gradeContainer.innerHTML = `
        <h3 class="text-sm font-semibold text-gray-700 mb-3">Grade Distribution (${totalClimbs} Active Climbs)</h3>
        <div class="space-y-2">
          ${grades.filter(g => gradeMap[g]).map(g => {
            const count = gradeMap[g];
            const pct = (count / maxG) * 100;
            return `
              <div class="flex items-center gap-2">
                <span class="text-xs font-medium text-gray-600 w-6">${g}</span>
                <div class="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                  <div class="h-full rounded-full" style="width:${pct}%;background:${GRADE_COLOURS[g]}"></div>
                </div>
                <span class="text-xs text-gray-500 w-6 text-right">${count}</span>
              </div>
            `;
          }).join('')}
        </div>
      `;
    } else {
      gradeContainer.innerHTML = `<h3 class="text-sm font-semibold text-gray-700 mb-3">Grade Distribution</h3><p class="text-gray-400 text-sm text-center py-8">No active climbs</p>`;
    }

  } catch (err) {
    console.error('Analytics load error:', err);
    document.getElementById('analytics-summary-cards').innerHTML = `<p class="text-red-400 col-span-4">Error loading analytics: ${err.message}</p>`;
  }
}

// ============================================================
// Settings Page (Staff Management + General + Integrations)
// ============================================================

let settingsTab = 'staff';

async function loadStaff() {
  const el = document.getElementById('page-staff');

  el.innerHTML = `
    <div class="mb-6">
      <h2 class="text-2xl font-bold text-gray-900">Settings</h2>
      <p class="text-gray-500 mt-1">Staff management, gym settings, and integrations</p>
    </div>

    <!-- Tabs -->
    <div class="flex border-b border-gray-200 mb-6">
      <button onclick="switchSettingsTab('staff')" class="settings-tab px-5 py-3 text-sm font-medium border-b-2 ${settingsTab === 'staff' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}" data-stab="staff">Staff Management</button>
      <button onclick="switchSettingsTab('general')" class="settings-tab px-5 py-3 text-sm font-medium border-b-2 ${settingsTab === 'general' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}" data-stab="general">General</button>
      <button onclick="switchSettingsTab('integrations')" class="settings-tab px-5 py-3 text-sm font-medium border-b-2 ${settingsTab === 'integrations' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}" data-stab="integrations">Integrations</button>
    </div>

    <div id="settings-tab-staff" class="settings-tab-content ${settingsTab !== 'staff' ? 'hidden' : ''}"></div>
    <div id="settings-tab-general" class="settings-tab-content ${settingsTab !== 'general' ? 'hidden' : ''}"></div>
    <div id="settings-tab-integrations" class="settings-tab-content ${settingsTab !== 'integrations' ? 'hidden' : ''}"></div>
  `;

  loadSettingsTabContent(settingsTab);
}

function switchSettingsTab(tab) {
  settingsTab = tab;
  document.querySelectorAll('.settings-tab').forEach(t => {
    t.classList.remove('border-blue-600', 'text-blue-600');
    t.classList.add('border-transparent', 'text-gray-500');
  });
  document.querySelectorAll('.settings-tab-content').forEach(c => c.classList.add('hidden'));

  const active = document.querySelector(`.settings-tab[data-stab="${tab}"]`);
  if (active) { active.classList.add('border-blue-600', 'text-blue-600'); active.classList.remove('border-transparent', 'text-gray-500'); }

  const content = document.getElementById(`settings-tab-${tab}`);
  if (content) content.classList.remove('hidden');

  loadSettingsTabContent(tab);
}

async function loadSettingsTabContent(tab) {
  switch (tab) {
    case 'staff': return loadStaffManagement();
    case 'general': return loadGeneralSettings();
    case 'integrations': return loadIntegrationSettings();
  }
}

// ---- Staff Management Tab ----

async function loadStaffManagement() {
  const container = document.getElementById('settings-tab-staff');
  container.innerHTML = '<p class="text-gray-400 text-center py-8">Loading staff...</p>';

  try {
    const staffList = await api('GET', '/api/staff/list?activeOnly=false');

    container.innerHTML = `
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold text-gray-900">Staff Members</h3>
        <button onclick="showStaffModal()" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition">+ Add Staff</button>
      </div>

      <div class="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table class="w-full">
          <thead>
            <tr class="text-left text-xs text-gray-500 uppercase border-b border-gray-100 bg-gray-50">
              <th class="px-4 py-3">Name</th>
              <th class="px-4 py-3">Role</th>
              <th class="px-4 py-3">Email</th>
              <th class="px-4 py-3 text-center">Status</th>
              <th class="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${staffList.length === 0 ? '<tr><td colspan="5" class="text-center text-gray-400 py-8">No staff members</td></tr>' :
              staffList.map(s => {
                const initials = getInitials(s.first_name, s.last_name).toUpperCase();
                const colour = nameToColour(s.first_name + s.last_name);
                return `
                  <tr class="border-b border-gray-50 hover:bg-gray-50">
                    <td class="px-4 py-3">
                      <div class="flex items-center gap-3">
                        <div class="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-xs" style="background:${colour}">${initials}</div>
                        <div>
                          <p class="font-medium text-gray-900">${s.first_name} ${s.last_name}</p>
                          ${s.phone ? `<p class="text-xs text-gray-400">${s.phone}</p>` : ''}
                        </div>
                      </div>
                    </td>
                    <td class="px-4 py-3">${getRoleBadgeHTML(s.role)}</td>
                    <td class="px-4 py-3 text-sm text-gray-500">${s.email || '—'}</td>
                    <td class="px-4 py-3 text-center">
                      ${s.is_active
                        ? '<span class="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded-full"><span class="w-1.5 h-1.5 bg-green-500 rounded-full"></span>Active</span>'
                        : '<span class="inline-flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-full"><span class="w-1.5 h-1.5 bg-gray-400 rounded-full"></span>Inactive</span>'}
                    </td>
                    <td class="px-4 py-3 text-right">
                      <div class="flex items-center justify-end gap-1">
                        <button onclick="showStaffModal('${s.id}')" class="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition" title="Edit">
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                        </button>
                        <button onclick="resetStaffPin('${s.id}', '${s.first_name}')" class="p-1.5 rounded-lg hover:bg-yellow-50 text-gray-400 hover:text-yellow-600 transition" title="Reset PIN">
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/></svg>
                        </button>
                        ${s.is_active
                          ? `<button onclick="toggleStaffStatus('${s.id}', false)" class="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition" title="Deactivate"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg></button>`
                          : `<button onclick="toggleStaffStatus('${s.id}', true)" class="p-1.5 rounded-lg hover:bg-green-50 text-gray-400 hover:text-green-600 transition" title="Activate"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></button>`}
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<p class="text-red-400 text-center py-8">Error loading staff: ${err.message}</p>`;
  }
}

async function showStaffModal(staffId = null) {
  let staff = null;
  if (staffId) {
    try { staff = await api('GET', `/api/staff/${staffId}`); } catch (e) {}
  }

  const isEdit = !!staff;
  const title = isEdit ? 'Edit Staff Member' : 'Add Staff Member';

  document.getElementById('modal-content').className = 'bg-white rounded-xl shadow-2xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto';

  showModal(`
    <div class="p-6">
      <div class="flex items-center justify-between mb-6">
        <h3 class="text-xl font-bold">${title}</h3>
        <button onclick="closeModal()" class="text-gray-400 hover:text-gray-600"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
      </div>
      <form id="staff-form" onsubmit="saveStaff(event, ${isEdit ? `'${staffId}'` : 'null'})">
        <div class="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
            <input type="text" name="first_name" required class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" value="${staff ? staff.first_name : ''}">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
            <input type="text" name="last_name" required class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" value="${staff ? staff.last_name : ''}">
          </div>
        </div>
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input type="email" name="email" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" value="${staff ? (staff.email || '') : ''}">
        </div>
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-1">Phone</label>
          <input type="tel" name="phone" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" value="${staff ? (staff.phone || '') : ''}">
        </div>
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-1">Role *</label>
          <select name="role" required class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
            <option value="centre_assistant" ${staff && staff.role === 'centre_assistant' ? 'selected' : ''}>Centre Assistant</option>
            <option value="duty_manager" ${staff && staff.role === 'duty_manager' ? 'selected' : ''}>Duty Manager</option>
            <option value="setter" ${staff && staff.role === 'setter' ? 'selected' : ''}>Route Setter</option>
            <option value="tech_lead" ${staff && staff.role === 'tech_lead' ? 'selected' : ''}>Tech Lead</option>
            <option value="owner" ${staff && staff.role === 'owner' ? 'selected' : ''}>Owner</option>
          </select>
        </div>
        <div class="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">4-Digit PIN ${isEdit ? '' : '*'}</label>
            <input type="text" name="pin" maxlength="4" pattern="[0-9]{4}" ${isEdit ? '' : 'required'} class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-center text-lg tracking-[0.3em] font-mono" placeholder="${isEdit ? 'Leave blank to keep' : '0000'}">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input type="password" name="password" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" placeholder="${isEdit ? 'Leave blank to keep' : 'Optional'}">
          </div>
        </div>
        <div id="staff-form-error" class="text-red-500 text-sm mb-3 hidden"></div>
        <div class="flex justify-end gap-2">
          <button type="button" onclick="closeModal()" class="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition text-sm font-medium">Cancel</button>
          <button type="submit" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition text-sm font-medium">${isEdit ? 'Save Changes' : 'Add Staff'}</button>
        </div>
      </form>
    </div>
  `);
}

async function saveStaff(e, staffId) {
  e.preventDefault();
  const form = document.getElementById('staff-form');
  const data = Object.fromEntries(new FormData(form));
  const errEl = document.getElementById('staff-form-error');

  // Clean empty optional fields
  if (!data.pin) delete data.pin;
  if (!data.password) delete data.password;
  if (!data.email) delete data.email;
  if (!data.phone) delete data.phone;

  try {
    if (staffId) {
      await api('PUT', `/api/staff/${staffId}`, data);
      showToast('Staff member updated', 'success');
    } else {
      await api('POST', '/api/staff', data);
      showToast('Staff member added', 'success');
    }
    closeModal();
    loadStaffManagement();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  }
}

async function resetStaffPin(staffId, firstName) {
  const newPin = prompt(`Enter new 4-digit PIN for ${firstName}:`);
  if (!newPin || !/^\d{4}$/.test(newPin)) {
    if (newPin !== null) showToast('PIN must be 4 digits', 'error');
    return;
  }
  try {
    await api('PUT', `/api/staff/${staffId}`, { pin: newPin });
    showToast('PIN reset successfully', 'success');
  } catch (err) { showToast('Error: ' + err.message, 'error'); }
}

async function toggleStaffStatus(staffId, activate) {
  try {
    if (activate) {
      await api('POST', `/api/staff/${staffId}/activate`);
      showToast('Staff member activated', 'success');
    } else {
      await api('POST', `/api/staff/${staffId}/deactivate`);
      showToast('Staff member deactivated', 'success');
    }
    loadStaffManagement();
  } catch (err) { showToast('Error: ' + err.message, 'error'); }
}

// ---- General Settings Tab ----

async function loadGeneralSettings() {
  const container = document.getElementById('settings-tab-general');
  container.innerHTML = '<p class="text-gray-400 text-center py-8">Loading settings...</p>';

  try {
    const settings = await api('GET', '/api/settings');

    container.innerHTML = `
      <div class="max-w-2xl">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">General Settings</h3>
        <form id="general-settings-form" onsubmit="saveGeneralSettings(event)" class="space-y-4">
          <div class="bg-white border border-gray-200 rounded-xl p-5">
            <h4 class="font-medium text-gray-900 mb-3">Gym Details</h4>
            <div class="space-y-3">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Gym Name</label>
                <input type="text" name="gym_name" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" value="${settings.gym_name || ''}">
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Peak Description</label>
                  <input type="text" name="peak_description" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" value="${settings.peak_description || ''}">
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Off-Peak Description</label>
                  <input type="text" name="off_peak_description" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" value="${settings.off_peak_description || ''}">
                </div>
              </div>
            </div>
          </div>

          <div class="bg-white border border-gray-200 rounded-xl p-5">
            <h4 class="font-medium text-gray-900 mb-3">Pricing</h4>
            <div class="grid grid-cols-3 gap-3">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Registration Fee (£)</label>
                <input type="number" step="0.01" name="first_time_registration_fee" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" value="${settings.first_time_registration_fee || ''}">
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Shoe Rental (£)</label>
                <input type="number" step="0.01" name="shoe_rental_price" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" value="${settings.shoe_rental_price || ''}">
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                <select name="currency" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
                  <option value="GBP" ${settings.currency === 'GBP' ? 'selected' : ''}>GBP (£)</option>
                  <option value="EUR" ${settings.currency === 'EUR' ? 'selected' : ''}>EUR (€)</option>
                  <option value="USD" ${settings.currency === 'USD' ? 'selected' : ''}>USD ($)</option>
                </select>
              </div>
            </div>
          </div>

          <div class="flex justify-end">
            <button type="submit" class="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition text-sm">Save Changes</button>
          </div>
        </form>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<p class="text-red-400 text-center py-8">Error loading settings: ${err.message}</p>`;
  }
}

async function saveGeneralSettings(e) {
  e.preventDefault();
  const form = document.getElementById('general-settings-form');
  const data = Object.fromEntries(new FormData(form));

  // Map currency to symbol
  const symbols = { GBP: '£', EUR: '€', USD: '$' };

  try {
    const promises = Object.entries(data).map(([key, value]) =>
      api('PUT', `/api/settings/${key}`, { value })
    );
    // Also update currency symbol
    if (data.currency) {
      promises.push(api('PUT', '/api/settings/currency_symbol', { value: symbols[data.currency] || '£' }));
    }
    await Promise.all(promises);
    showToast('Settings saved', 'success');
  } catch (err) {
    showToast('Error saving settings: ' + err.message, 'error');
  }
}

// ---- Integrations Tab ----

async function loadIntegrationSettings() {
  const container = document.getElementById('settings-tab-integrations');

  try {
    const settings = await api('GET', '/api/settings');

    container.innerHTML = `
      <div class="max-w-2xl space-y-4">
        <div class="bg-white border border-gray-200 rounded-xl p-5">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>
            </div>
            <div>
              <h4 class="font-medium text-gray-900">GoCardless</h4>
              <p class="text-xs text-gray-500">Direct debit payment collection</p>
            </div>
          </div>
          <form onsubmit="saveIntegration(event, 'gocardless')" class="space-y-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Access Token</label>
              <input type="password" name="gocardless_access_token" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" value="${settings.gocardless_access_token || ''}" placeholder="sandbox_xxx or live_xxx">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Environment</label>
              <div class="flex items-center gap-4">
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="gocardless_environment" value="sandbox" ${settings.gocardless_environment !== 'live' ? 'checked' : ''} class="text-blue-600">
                  <span class="text-sm text-gray-700">Sandbox</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="gocardless_environment" value="live" ${settings.gocardless_environment === 'live' ? 'checked' : ''} class="text-blue-600">
                  <span class="text-sm text-gray-700">Live</span>
                </label>
              </div>
            </div>
            <div class="flex justify-end"><button type="submit" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition">Save</button></div>
          </form>
        </div>

        <div class="bg-white border border-gray-200 rounded-xl p-5">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"/></svg>
            </div>
            <div>
              <h4 class="font-medium text-gray-900">Dojo</h4>
              <p class="text-xs text-gray-500">Card terminal payments</p>
            </div>
          </div>
          <form onsubmit="saveIntegration(event, 'dojo')" class="space-y-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">API Key</label>
              <input type="password" name="dojo_api_key" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" value="${settings.dojo_api_key || ''}" placeholder="Your Dojo API key">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Terminal ID</label>
              <input type="text" name="dojo_terminal_id" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" value="${settings.dojo_terminal_id || ''}" placeholder="Terminal identifier">
            </div>
            <div class="flex justify-end"><button type="submit" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition">Save</button></div>
          </form>
        </div>

        <div class="bg-white border border-gray-200 rounded-xl p-5">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <svg class="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
            </div>
            <div>
              <h4 class="font-medium text-gray-900">Email / SMTP</h4>
              <p class="text-xs text-gray-500">Outbound email for receipts, QR codes</p>
            </div>
          </div>
          <form onsubmit="saveIntegration(event, 'email')" class="space-y-3">
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">SMTP Host</label>
                <input type="text" name="email_smtp_host" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" value="${settings.email_smtp_host || ''}">
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">SMTP Port</label>
                <input type="text" name="email_smtp_port" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" value="${settings.email_smtp_port || ''}">
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">From Address</label>
              <input type="email" name="email_from" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" value="${settings.email_from || ''}" placeholder="noreply@boulderryn.com">
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">SMTP Username</label>
                <input type="text" name="email_smtp_user" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" value="${settings.email_smtp_user || ''}">
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">SMTP Password</label>
                <input type="password" name="email_smtp_pass" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" value="${settings.email_smtp_pass || ''}">
              </div>
            </div>
            <div class="flex justify-end"><button type="submit" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition">Save</button></div>
          </form>
        </div>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<p class="text-red-400 text-center py-8">Error loading integrations: ${err.message}</p>`;
  }
}

async function saveIntegration(e, type) {
  e.preventDefault();
  const form = e.target;
  const data = Object.fromEntries(new FormData(form));

  try {
    const promises = Object.entries(data).map(([key, value]) =>
      api('PUT', `/api/settings/${key}`, { value })
    );
    await Promise.all(promises);
    showToast(`${type.charAt(0).toUpperCase() + type.slice(1)} settings saved`, 'success');
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

// ============================================================
// Modal
// ============================================================

function showModal(html) {
  document.getElementById('modal-content').innerHTML = html;
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  document.getElementById('modal-content').innerHTML = '';
  document.getElementById('modal-content').className = 'bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto';
}

document.getElementById('modal-overlay').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeModal();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

// ============================================================
// Toast notifications
// ============================================================

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ============================================================
// Init — Start with auth
// ============================================================

// Add shake animation CSS
const shakeStyle = document.createElement('style');
shakeStyle.textContent = `
  @keyframes shake { 0%, 100% { transform: translateX(0); } 20%, 60% { transform: translateX(-8px); } 40%, 80% { transform: translateX(8px); } }
  .animate-shake { animation: shake 0.4s ease-in-out; }
`;
document.head.appendChild(shakeStyle);

initAuth();
