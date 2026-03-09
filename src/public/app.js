/**
 * Crux — Frontend Application (Web Version)
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
    if (res.status === 402 && err.error === 'subscription_required') {
      showSubscriptionWall(err.upgradeUrl);
      throw new Error('subscription_required');
    }
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

function showSubscriptionWall(upgradeUrl) {
  // Don't double-show
  if (document.getElementById('subscription-wall')) return;
  const wall = document.createElement('div');
  wall.id = 'subscription-wall';
  wall.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#0f172a;display:flex;align-items:center;justify-content:center;padding:1rem';
  wall.innerHTML = `
    <div style="background:#1e293b;border-radius:1rem;padding:2.5rem;max-width:420px;width:100%;text-align:center;border:1px solid #334155">
      <div style="width:56px;height:56px;background:#ef4444;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 1.25rem">
        <svg style="width:28px;height:28px;color:white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
      </div>
      <h2 style="color:#f1f5f9;font-size:1.25rem;font-weight:700;margin:0 0 0.5rem">Subscription Required</h2>
      <p style="color:#94a3b8;font-size:0.875rem;margin:0 0 1.5rem;line-height:1.6">Your free trial has ended or your subscription is inactive. Reactivate to continue using Crux.</p>
      <a href="${upgradeUrl || '/billing/create-checkout'}" style="display:inline-block;padding:0.75rem 1.75rem;background:#3b82f6;color:white;font-weight:600;font-size:0.875rem;border-radius:0.5rem;text-decoration:none">Reactivate Subscription</a>
      <p style="color:#475569;font-size:0.75rem;margin:1rem 0 0">Questions? Email <a href="mailto:hello@cruxgym.co.uk" style="color:#64748b">hello@cruxgym.co.uk</a></p>
    </div>
  `;
  document.body.appendChild(wall);
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
// PIN Challenge System (per-action auth)
// ============================================================

// ── Staff Session ─────────────────────────────────────────────────────────
// Staff log in once with their PIN. Session stored in localStorage (12h expiry).
// requirePin() skips the modal entirely when already logged in.

window.currentStaff = null;
let _challengePinValue = '';
let _challengeCallback = null;
let _challengePermission = null;

function getSession() {
  try { return JSON.parse(localStorage.getItem('crux_staff_session') || 'null'); } catch { return null; }
}

function saveSession(staff) {
  localStorage.setItem('crux_staff_session', JSON.stringify({ ...staff, savedAt: Date.now() }));
  window.currentStaff = staff;
  renderStaffWidget();
  applyNavPermissions();
  setTimeout(() => checkSetupWizard(), 600);
}

function clearSession() {
  localStorage.removeItem('crux_staff_session');
  window.currentStaff = null;
  renderStaffWidget();
  applyNavPermissions();
}

function restoreSession() {
  const s = getSession();
  if (!s) { renderStaffWidget(); applyNavPermissions(); return; }
  if (s.savedAt && Date.now() - s.savedAt > 12 * 60 * 60 * 1000) { clearSession(); return; }
  window.currentStaff = s;
  renderStaffWidget();
  applyNavPermissions();
  setTimeout(() => checkSetupWizard(), 500);
}

function hasPermission(staff, permission) {
  if (!staff) return false;
  if (staff.role === 'owner' || staff.role === 'tech_lead') return true;
  return !!(staff.permissions && staff.permissions[permission]);
}

function logout() {
  clearSession();
  showToast('Signed out', 'success');
  setTimeout(() => location.reload(), 600);
}

// Map of page name → permission key required to VIEW that nav item
const NAV_PERMISSIONS = {
  dashboard: null,       // always visible
  members:   'members_view',
  pos:       'pos',
  events:    'events_view',
  routes:    'routes_view',
  analytics: 'analytics',
  staff:     'settings',
};

function applyNavPermissions() {
  const staff = window.currentStaff;
  document.querySelectorAll('#nav-links [data-page]').forEach(link => {
    const page = link.dataset.page;
    const perm = NAV_PERMISSIONS[page];
    if (!perm) { link.parentElement.style.display = ''; return; } // always show
    if (!staff) { link.parentElement.style.display = ''; return; } // logged out: show all (login prompt on click)
    const show = hasPermission(staff, perm);
    link.parentElement.style.display = show ? '' : 'none';
  });
}

function renderStaffWidget() {
  const el = document.getElementById('staff-session-widget');
  if (!el) return;
  if (window.currentStaff) {
    const s = window.currentStaff;
    const initials = ((s.first_name?.[0] || '') + (s.last_name?.[0] || '')).toUpperCase();
    el.innerHTML = `
      <div class="flex items-center gap-2.5">
        <div class="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">${initials}</div>
        <div class="flex-1 min-w-0">
          <p class="text-white text-xs font-medium truncate">${s.first_name} ${s.last_name}</p>
          <p class="text-slate-400 text-[11px] truncate">${getRoleDisplayName(s.role)}</p>
        </div>
        <button onclick="logout()" title="Sign out" class="p-1.5 rounded-lg hover:bg-slate-600 transition flex-shrink-0">
          <svg class="w-4 h-4 text-slate-400 hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
          </svg>
        </button>
      </div>`;
  } else {
    el.innerHTML = `
      <button onclick="showLoginModal()" class="flex items-center gap-2 text-slate-400 hover:text-white transition text-xs w-full py-1">
        <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
        Sign in
      </button>`;
  }
}

function showLoginModal() {
  requirePin(null, () => {});
}

/**
 * requirePin — gate a permission-protected action.
 * If already logged in with correct permission: runs callback immediately.
 * If not logged in: shows PIN login modal.
 */
function requirePin(permission, callback, title, desc) {
  if (window.currentStaff) {
    if (!permission || hasPermission(window.currentStaff, permission)) {
      if (callback) callback(window.currentStaff);
    } else {
      showToast(`${window.currentStaff.first_name} doesn't have permission for this`, 'error');
    }
    return;
  }

  // Not logged in — show PIN modal as login screen
  _challengePinValue = '';
  _challengeCallback = callback;
  _challengePermission = permission;

  document.getElementById('pin-challenge-title').textContent = 'Sign in';
  document.getElementById('pin-challenge-desc').textContent = (title && title !== 'Enter Staff PIN' && title !== 'Staff PIN') ? title : 'Enter your PIN to continue';
  document.getElementById('challenge-pin-error').textContent = '';
  document.getElementById('challenge-pin-staff').innerHTML = '';
  updateChallengeDots();
  document.getElementById('pin-challenge-overlay').style.display = 'flex';
}

function updateChallengeDots() {
  const dots = document.querySelectorAll('#challenge-pin-dots div');
  dots.forEach((dot, i) => {
    if (i < _challengePinValue.length) {
      dot.className = 'w-5 h-5 rounded-full bg-blue-500 border-2 border-blue-500 transition-all duration-150 scale-110';
    } else {
      dot.className = 'w-5 h-5 rounded-full border-2 border-slate-500 transition-all duration-150';
    }
  });
}

function challengePinPress(digit) {
  if (_challengePinValue.length >= 4) return;
  _challengePinValue += digit;
  updateChallengeDots();
  document.getElementById('challenge-pin-error').textContent = '';

  if (_challengePinValue.length === 4) {
    attemptPinChallenge(_challengePinValue);
  }
}

function challengePinClear() {
  _challengePinValue = '';
  updateChallengeDots();
  document.getElementById('challenge-pin-error').textContent = '';
  document.getElementById('challenge-pin-staff').innerHTML = '';
}

function challengePinBackspace() {
  _challengePinValue = _challengePinValue.slice(0, -1);
  updateChallengeDots();
  document.getElementById('challenge-pin-error').textContent = '';
}

async function attemptPinChallenge(pin) {
  try {
    const result = await api('POST', '/api/staff/auth/pin', { pin });
    if (result.error) {
      showPinError('Invalid PIN');
      return;
    }

    // Valid PIN — log them in regardless
    saveSession(result);

    // Now check if they have the required permission for this specific action
    if (_challengePermission && !hasPermission(result, _challengePermission)) {
      document.getElementById('pin-challenge-overlay').style.display = 'none';
      showToast(`${result.first_name} doesn't have permission for this`, 'error');
      _challengeCallback = null;
      _challengePermission = null;
      return;
    }

    // Success
    document.getElementById('pin-challenge-overlay').style.display = 'none';
    if (_challengeCallback) _challengeCallback(result);
    _challengeCallback = null;
    _challengePermission = null;
  } catch (err) {
    showPinError('Authentication failed');
  }
}

function showPinError(msg) {
  document.getElementById('challenge-pin-error').textContent = msg;
  _challengePinValue = '';
  updateChallengeDots();
  // Shake
  const dots = document.getElementById('challenge-pin-dots');
  dots.classList.add('animate-shake');
  setTimeout(() => dots.classList.remove('animate-shake'), 500);
}

function cancelPinChallenge() {
  document.getElementById('pin-challenge-overlay').style.display = 'none';
  _challengeCallback = null;
  _challengePermission = null;
  _challengePinValue = '';
}

async function attemptEmailLogin() {
  const email    = document.getElementById('email-login-input')?.value?.trim();
  const password = document.getElementById('email-login-password')?.value;
  const errEl    = document.getElementById('email-login-error');
  if (!email || !password) { errEl.textContent = 'Enter email and password'; return; }
  errEl.textContent = '';

  try {
    const result = await api('POST', '/api/staff/auth/password', { email, password });
    if (result.error) { errEl.textContent = 'Invalid email or password'; return; }

    saveSession(result);

    if (_challengePermission && !hasPermission(result, _challengePermission)) {
      document.getElementById('pin-challenge-overlay').style.display = 'none';
      showToast(`${result.first_name} doesn't have permission for this`, 'error');
      _challengeCallback = null;
      _challengePermission = null;
      return;
    }

    document.getElementById('pin-challenge-overlay').style.display = 'none';
    if (_challengeCallback) _challengeCallback(result);
    _challengeCallback = null;
    _challengePermission = null;
  } catch (err) {
    errEl.textContent = 'Authentication failed';
  }
}

function showEmailLoginForm() {
  const modal = document.getElementById('pin-challenge-overlay').querySelector('.bg-slate-800');
  if (!modal) return;
  modal.innerHTML = `
    <div class="text-center mb-4">
      <p class="text-white font-semibold">Sign in with email</p>
    </div>
    <div class="space-y-3">
      <input type="email" id="email-login-input" placeholder="your@email.com" autocomplete="email"
        class="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 text-sm focus:outline-none focus:border-blue-500">
      <input type="password" id="email-login-password" placeholder="Password" autocomplete="current-password"
        class="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 text-sm focus:outline-none focus:border-blue-500">
      <p id="email-login-error" class="text-red-400 text-xs min-h-4"></p>
      <button onclick="attemptEmailLogin()" class="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition text-sm">Sign in</button>
    </div>
    <div class="mt-3 text-center">
      <button onclick="cancelPinChallenge()" class="text-slate-400 hover:text-white text-sm transition">Cancel</button>
    </div>
  `;
  setTimeout(() => document.getElementById('email-login-input')?.focus(), 50);
  document.getElementById('email-login-password').addEventListener('keydown', e => {
    if (e.key === 'Enter') attemptEmailLogin();
  });
}

// ============================================================
// First Run Setup (only if no staff exist)
// ============================================================

async function checkFirstRun() {
  try {
    const { count } = await api('GET', '/api/staff/count');
    if (count === 0) {
      showFirstRunSetup();
    }
  } catch (e) {
    // Server may not be ready yet
  }
}

function showFirstRunSetup() {
  const overlay = document.getElementById('first-run-overlay');
  overlay.style.display = 'flex';
  const container = document.getElementById('first-run-container');
  container.innerHTML = `
    <div class="text-center mb-8">
      <img src="/assets/logos/logo-light.svg" alt="Crux" class="h-12 mx-auto mb-2">
      <p class="text-slate-400 mt-2">First Time Setup</p>
    </div>
    <div class="bg-slate-800 rounded-2xl p-6 shadow-2xl border border-slate-700">
      <h2 class="text-lg font-semibold text-white mb-1">Create First Staff Account</h2>
      <p class="text-slate-400 text-sm mb-6">This will be the owner account with full access. PIN defaults to your birthday (DDMM).</p>
      <div id="first-run-fields">
        <div class="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label class="block text-xs text-slate-400 mb-1">First Name</label>
            <input type="text" id="fr-first-name" class="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" placeholder="First">
          </div>
          <div>
            <label class="block text-xs text-slate-400 mb-1">Last Name</label>
            <input type="text" id="fr-last-name" class="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" placeholder="Last">
          </div>
        </div>
        <div class="mb-3">
          <label class="block text-xs text-slate-400 mb-1">Email</label>
          <input type="email" id="fr-email" class="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" placeholder="you@example.com">
        </div>
        <div class="mb-3">
          <label class="block text-xs text-slate-400 mb-1">4-Digit PIN (e.g. birthday DDMM)</label>
          <input type="tel" id="fr-pin" maxlength="4" inputmode="numeric" class="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-center text-xl tracking-[0.5em] font-mono" placeholder="••••">
        </div>
        <div id="first-run-error" class="text-red-400 text-sm mb-3" style="display:none;"></div>
        <button id="fr-submit" type="button" class="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition">Create Owner Account</button>
      </div>
    </div>
  `;
  document.getElementById('fr-submit').addEventListener('click', handleFirstRunSetup);
}

async function handleFirstRunSetup() {
  const firstName = document.getElementById('fr-first-name').value.trim();
  const lastName  = document.getElementById('fr-last-name').value.trim();
  const email     = document.getElementById('fr-email').value.trim();
  const pin       = document.getElementById('fr-pin').value.trim();
  const errEl     = document.getElementById('first-run-error');

  // Validate in JS
  if (!firstName || !lastName) { errEl.textContent = 'First and last name are required.'; errEl.style.display = 'block'; return; }
  if (!email || !email.includes('@')) { errEl.textContent = 'Enter a valid email address.'; errEl.style.display = 'block'; return; }
  if (!/^\d{4}$/.test(pin)) { errEl.textContent = 'PIN must be exactly 4 digits.'; errEl.style.display = 'block'; return; }
  errEl.style.display = 'none';

  const btn = document.querySelector('#first-run-fields button');
  btn.disabled = true;
  btn.textContent = 'Creating...';

  try {
    const newStaff = await api('POST', '/api/staff', { first_name: firstName, last_name: lastName, email, pin, role: 'owner' });
    document.getElementById('first-run-overlay').style.display = 'none';
    // If we came from the signup flow, show the success modal instead of just the dashboard
    if (sessionStorage.getItem('crux_signup_flow')) {
      const successModal = document.getElementById('signup-success-modal');
      if (successModal) successModal.style.display = 'flex';
    } else {
      // Auto-login as the newly created owner and launch setup wizard
      saveSession(newStaff);
      navigateTo('dashboard');
      showToast(`Welcome, ${firstName}! Let's set up your gym.`, 'success');
    }
  } catch (err) {
    errEl.textContent = err.message || 'Failed to create account';
    errEl.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Create Owner Account';
  }
}

// ============================================================
// Setup Wizard
// ============================================================

let _wizardStep = 1;
const _wizardData = { gymName: '', contactEmail: '', phone: '', waiverVideoUrl: '' };
let _waiverSections = [];
let _waiverMinorOption = false;
const WALL_COLOURS = ['#3B82F6','#10B981','#EF4444','#F59E0B','#8B5CF6','#EC4899','#14B8A6','#F97316'];
let _mapState = {
  localWalls: [], savedWalls: [], localRooms: [], savedRooms: [],
  drawingPoints: [], isDrawing: false, cursorPos: null,
  pendingColour: '#3B82F6', colourIndex: 0,
};
let _wizardPassTypes = [];

async function checkSetupWizard() {
  if (!window.currentStaff) return;
  const role = window.currentStaff.role;
  if (role !== 'owner' && role !== 'tech_lead') return;
  // Don't show if other overlays are visible
  const firstRun = document.getElementById('first-run-overlay');
  if (firstRun && firstRun.style.display === 'flex') return;
  try {
    const settings = await api('GET', '/api/settings');
    if (settings.setup_complete === '1') return;
    _wizardData.gymName = settings.gym_name || '';
    _wizardData.contactEmail = settings.contact_email || '';
    _wizardData.phone = settings.contact_phone || '';
    _wizardData.waiverVideoUrl = settings.waiver_video_url || '';
    showSetupWizard();
  } catch (e) { console.warn('[wizard] setup check failed', e); }
}

function showSetupWizard() {
  _wizardStep = 1;
  const el = document.getElementById('setup-wizard');
  if (!el) return;
  el.style.display = 'flex';
  renderWizardStep();
}

async function wizardNext() {
  const ok = await saveWizardStep(_wizardStep);
  if (!ok) return;
  if (_wizardStep === 5) { await completeSetupWizard(); return; }
  _wizardStep++;
  document.getElementById('wizard-content').scrollTop = 0;
  renderWizardStep();
}

function wizardBack() {
  if (_wizardStep <= 1) return;
  _wizardStep--;
  document.getElementById('wizard-content').scrollTop = 0;
  renderWizardStep();
}

function renderWizardStep() {
  const titles = ['Gym Details', 'Induction Video', 'Waiver Builder', 'Gym Map', 'Pass Types'];
  document.getElementById('wizard-step-label').textContent = `Step ${_wizardStep} of 5 — ${titles[_wizardStep-1]}`;
  document.getElementById('wizard-progress-bar').style.width = `${(_wizardStep / 5) * 100}%`;
  document.getElementById('wizard-back-btn').style.display = _wizardStep > 1 ? 'block' : 'none';
  document.getElementById('wizard-next-btn').textContent = _wizardStep === 5 ? 'Complete Setup ✓' : 'Next →';
  const c = document.getElementById('wizard-content');
  if (_wizardStep === 1) c.innerHTML = renderWizardStep1();
  else if (_wizardStep === 2) c.innerHTML = renderWizardStep2();
  else if (_wizardStep === 3) { c.innerHTML = renderWizardStep3(); initWaiverBuilder(); }
  else if (_wizardStep === 4) { c.innerHTML = renderWizardStep4(); initWallMapBuilder(); }
  else if (_wizardStep === 5) { c.innerHTML = renderWizardStep5(); loadWizardPassTypes(); }
}

async function saveWizardStep(n) {
  if (n === 1) {
    const name = document.getElementById('wz-gym-name').value.trim();
    if (!name) { showToast('Please enter your gym name', 'error'); return false; }
    _wizardData.gymName = name;
    _wizardData.contactEmail = document.getElementById('wz-contact-email').value.trim();
    _wizardData.phone = document.getElementById('wz-phone').value.trim();
    await api('PUT', '/api/settings', { gym_name: name, contact_email: _wizardData.contactEmail, contact_phone: _wizardData.phone });
    loadGymName();
  } else if (n === 2) {
    _wizardData.waiverVideoUrl = document.getElementById('wz-video-url').value.trim();
    if (!_wizardData.waiverVideoUrl) { showToast('Please enter a YouTube URL for your induction video', 'error'); return false; }
    if (!_wizardData.waiverVideoUrl.includes('youtube.com') && !_wizardData.waiverVideoUrl.includes('youtu.be')) { showToast('Please enter a valid YouTube URL', 'error'); return false; }
    await api('PUT', '/api/settings', { waiver_video_url: _wizardData.waiverVideoUrl });
  } else if (n === 3) {
    await saveWaiverSections();
  } else if (n === 4) {
    await saveWallMap();
  } else if (n === 5) {
    await saveWizardPassTypes();
  }
  return true;
}

async function completeSetupWizard() {
  await api('PUT', '/api/settings/setup_complete', { value: '1' });
  document.getElementById('setup-wizard').style.display = 'none';
  showToast('Setup complete! Welcome to Crux.', 'success');
  navigateTo('dashboard');
}

// Step 1 — Gym Details
function renderWizardStep1() {
  return `<div class="max-w-lg mx-auto">
    <h2 class="text-2xl font-bold text-gray-900 mb-2">Tell us about your gym</h2>
    <p class="text-gray-500 mb-8">This appears on member-facing pages and emails.</p>
    <div class="space-y-5">
      <div>
        <label class="block text-sm font-semibold text-gray-700 mb-1">Gym Name *</label>
        <input type="text" id="wz-gym-name" value="${_wizardData.gymName}" class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:border-[#1E3A5F] focus:ring-1 focus:ring-[#1E3A5F]" placeholder="e.g. Peak Climbing Centre">
      </div>
      <div>
        <label class="block text-sm font-semibold text-gray-700 mb-1">Contact Email</label>
        <input type="email" id="wz-contact-email" value="${_wizardData.contactEmail}" class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:border-[#1E3A5F]" placeholder="hello@mygym.co.uk">
      </div>
      <div>
        <label class="block text-sm font-semibold text-gray-700 mb-1">Phone Number</label>
        <input type="tel" id="wz-phone" value="${_wizardData.phone}" class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:border-[#1E3A5F]" placeholder="01234 567890">
      </div>
    </div>
  </div>`;
}

// Step 2 — Induction Video
function renderWizardStep2() {
  const url = _wizardData.waiverVideoUrl;
  const videoId = url && url.includes('v=') ? url.split('v=')[1].split('&')[0] : (url ? url.split('/').pop() : '');
  return `<div class="max-w-lg mx-auto">
    <h2 class="text-2xl font-bold text-gray-900 mb-2">Induction video</h2>
    <p class="text-gray-500 mb-8">Members must watch this before signing your waiver. Paste a YouTube URL below. You can skip and add it later.</p>
    <div class="mb-6">
      <label class="block text-sm font-semibold text-gray-700 mb-1">YouTube URL</label>
      <input type="url" id="wz-video-url" value="${url}" oninput="previewWizardVideo(this.value)"
        class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:border-[#1E3A5F]"
        placeholder="https://www.youtube.com/watch?v=...">
    </div>
    <div id="wz-video-preview" class="${videoId ? '' : 'hidden'}">
      ${videoId ? `<div class="relative rounded-xl overflow-hidden" style="padding-bottom:56.25%;height:0"><iframe src="https://www.youtube-nocookie.com/embed/${videoId}?rel=0" style="position:absolute;top:0;left:0;width:100%;height:100%" frameborder="0" allowfullscreen referrerpolicy="origin"></iframe></div>` : ''}
    </div>
  </div>`;
}

function previewWizardVideo(url) {
  const videoId = url.includes('v=') ? url.split('v=')[1].split('&')[0] : url.split('/').pop();
  const p = document.getElementById('wz-video-preview');
  if (videoId && videoId.length > 5) {
    p.innerHTML = `<div class="relative rounded-xl overflow-hidden" style="padding-bottom:56.25%;height:0"><iframe src="https://www.youtube-nocookie.com/embed/${videoId}?rel=0" style="position:absolute;top:0;left:0;width:100%;height:100%" frameborder="0" allowfullscreen referrerpolicy="origin"></iframe></div>`;
    p.classList.remove('hidden');
  } else { p.classList.add('hidden'); }
}

// Step 3 — Waiver Builder
function renderWizardStep3() {
  return `<div class="max-w-2xl mx-auto">
    <h2 class="text-2xl font-bold text-gray-900 mb-2">Build your waiver</h2>
    <p class="text-gray-500 mb-6">Add sections that members fill in before their first session. Use ↑↓ to reorder.</p>
    <div id="waiver-builder-sections" class="space-y-2 mb-6"></div>
    <div class="border-2 border-dashed border-gray-200 rounded-xl p-4">
      <p class="text-xs font-semibold text-gray-500 uppercase mb-3">Add section</p>
      <div class="flex flex-wrap gap-2">
        ${[
          ['text','📄 Text Block','Static text — rules, risk warnings etc.'],
          ['checkbox','☑️ Checkbox','A statement the member must agree to'],
          ['field_text','✏️ Text Field','A fill-in answer (e.g. medical conditions)'],
          ['field_radio','◉ Multiple Choice','A question with selectable options'],
          ['field_select','▾ Dropdown','A dropdown selection'],
          ['signature','✍️ Signature','A signature pad'],
          ['minor','👶 Minor Section','Option to add children / minors'],
        ].map(([t,lbl,tip]) => `<button onclick="addWaiverBuilderSection('${t}')" title="${tip}" class="px-3 py-2 bg-white border border-gray-300 hover:border-[#1E3A5F] hover:bg-blue-50 rounded-lg text-sm font-medium text-gray-700 transition">${lbl}</button>`).join('')}
      </div>
    </div>
    <div class="mt-4">
      <label class="flex items-center gap-2 text-sm cursor-pointer">
        <input type="checkbox" id="wz-minor-option" ${_waiverMinorOption ? 'checked' : ''} onchange="_waiverMinorOption=this.checked">
        <span class="font-medium text-gray-700">Allow minors — parents can add children when signing</span>
      </label>
    </div>
  </div>`;
}

function initWaiverBuilder() {
  api('GET', '/api/waivers/templates/active/adult').then(t => {
    if (t && t.content) {
      _waiverSections = t.content.sections || [];
      _waiverMinorOption = t.content.include_minor_option || false;
      const cb = document.getElementById('wz-minor-option');
      if (cb) cb.checked = _waiverMinorOption;
    }
    renderWaiverBuilderSections();
  }).catch(() => renderWaiverBuilderSections());
}

function renderWaiverBuilderSections() {
  const c = document.getElementById('waiver-builder-sections');
  if (!c) return;
  if (_waiverSections.length === 0) {
    c.innerHTML = `<div class="text-center py-8 text-gray-400 text-sm border border-dashed border-gray-200 rounded-xl">No sections yet — add one below to build your waiver.</div>`;
    return;
  }
  const BADGE = { text:'bg-blue-100 text-blue-700', checkbox:'bg-green-100 text-green-700', field_text:'bg-yellow-100 text-yellow-700', field_radio:'bg-purple-100 text-purple-700', field_select:'bg-orange-100 text-orange-700', signature:'bg-red-100 text-red-700', minor:'bg-pink-100 text-pink-700' };
  const LABEL = { text:'Text', checkbox:'Checkbox', field_text:'Text Field', field_radio:'Multiple Choice', field_select:'Dropdown', signature:'Signature', minor:'Minor Section' };
  c.innerHTML = _waiverSections.map((s, i) => `
    <div class="bg-white border border-gray-200 rounded-xl p-4">
      <div class="flex items-start gap-3">
        <div class="flex flex-col gap-1 mt-0.5 flex-shrink-0">
          <button onclick="moveWaiverSection(${i},-1)" ${i===0?'disabled':''} class="text-gray-400 hover:text-gray-700 disabled:opacity-30 text-xs leading-none">↑</button>
          <button onclick="moveWaiverSection(${i},1)" ${i===_waiverSections.length-1?'disabled':''} class="text-gray-400 hover:text-gray-700 disabled:opacity-30 text-xs leading-none">↓</button>
        </div>
        <div class="flex-1 min-w-0">
          <span class="inline-block text-xs font-bold px-2 py-0.5 rounded-full mb-2 ${BADGE[s.type]||'bg-gray-100 text-gray-700'}">${LABEL[s.type]||s.type}</span>
          ${renderWaiverSectionForm(s, i)}
        </div>
        <button onclick="removeWaiverSection(${i})" class="text-gray-300 hover:text-red-500 transition flex-shrink-0 mt-0.5">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>
    </div>
  `).join('');
}

function renderWaiverSectionForm(s, i) {
  if (s.type === 'text') return `<div class="space-y-2">
    <input type="text" placeholder="Section title (optional)" value="${s.title||''}" oninput="_waiverSections[${i}].title=this.value" class="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#1E3A5F]">
    <textarea placeholder="Text content *" rows="3" oninput="_waiverSections[${i}].content=this.value" class="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#1E3A5F] resize-none">${s.content||''}</textarea>
  </div>`;
  if (s.type === 'checkbox') return `<textarea placeholder="Checkbox text — statement the member must agree to *" rows="2" oninput="_waiverSections[${i}].text=this.value" class="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#1E3A5F] resize-none">${s.text||''}</textarea>`;
  if (s.type === 'field_text') return `<div class="flex gap-2 items-center">
    <input type="text" placeholder="Label *" value="${s.label||''}" oninput="_waiverSections[${i}].label=this.value" class="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#1E3A5F]">
    <label class="flex items-center gap-1.5 text-sm text-gray-600 whitespace-nowrap"><input type="checkbox" ${s.required?'checked':''} onchange="_waiverSections[${i}].required=this.checked"> Required</label>
  </div>`;
  if (s.type === 'field_radio' || s.type === 'field_select') return `<div class="space-y-2">
    <div class="flex gap-2 items-center">
      <input type="text" placeholder="Question *" value="${s.label||''}" oninput="_waiverSections[${i}].label=this.value" class="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#1E3A5F]">
      <label class="flex items-center gap-1.5 text-sm text-gray-600 whitespace-nowrap"><input type="checkbox" ${s.required?'checked':''} onchange="_waiverSections[${i}].required=this.checked"> Required</label>
    </div>
    <div class="space-y-1 pl-2">
      ${(s.options||[]).map((opt,oi) => `<div class="flex gap-2"><input type="text" value="${opt}" oninput="_waiverSections[${i}].options[${oi}]=this.value" class="flex-1 px-3 py-1 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#1E3A5F]"><button onclick="_waiverSections[${i}].options.splice(${oi},1);renderWaiverBuilderSections()" class="text-gray-400 hover:text-red-500 text-xs px-1">✕</button></div>`).join('')}
      <button onclick="if(!_waiverSections[${i}].options)_waiverSections[${i}].options=[];_waiverSections[${i}].options.push('New option');renderWaiverBuilderSections()" class="text-xs text-blue-600 hover:underline">+ Add option</button>
    </div>
  </div>`;
  if (s.type === 'signature') return `<input type="text" placeholder="Signature label" value="${s.label||'Signature'}" oninput="_waiverSections[${i}].label=this.value" class="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#1E3A5F]">`;
  if (s.type === 'minor') return `<p class="text-sm text-gray-500">Adds a "I'm signing for a child" option. Parents provide child details and sign on their behalf.</p>`;
  return '';
}

function addWaiverBuilderSection(type) {
  if (type === 'minor' && _waiverSections.some(s => s.type === 'minor')) { showToast('Only one minor section allowed', 'error'); return; }
  const defaults = {
    text: { type, title:'', content:'' },
    checkbox: { type, text:'' },
    field_text: { type, label:'', required:true },
    field_radio: { type, label:'', options:['Option 1','Option 2'], required:true },
    field_select: { type, label:'', options:['Option 1','Option 2'], required:false },
    signature: { type, label:'Signature', role:'supervisee' },
    minor: { type },
  };
  _waiverSections.push(defaults[type]);
  renderWaiverBuilderSections();
  document.getElementById('waiver-builder-sections').lastElementChild?.scrollIntoView({ behavior:'smooth', block:'nearest' });
}

function moveWaiverSection(i, dir) {
  const j = i + dir;
  if (j < 0 || j >= _waiverSections.length) return;
  [_waiverSections[i], _waiverSections[j]] = [_waiverSections[j], _waiverSections[i]];
  renderWaiverBuilderSections();
}

function removeWaiverSection(i) {
  _waiverSections.splice(i, 1);
  renderWaiverBuilderSections();
}

async function saveWaiverSections() {
  try {
    const template = await api('GET', '/api/waivers/templates/active/adult');
    if (!template) return;
    const cb = document.getElementById('wz-minor-option');
    if (cb) _waiverMinorOption = cb.checked;
    await api('PUT', `/api/waivers/templates/${template.id}`, {
      content: { sections: _waiverSections, include_minor_option: _waiverMinorOption, signatures_required: ['supervisee'] },
      video_url: _wizardData.waiverVideoUrl,
    });
  } catch (e) { console.warn('[wizard] waiver save failed', e); }
}

// Step 4 — Wall Map Builder
function renderWizardStep4() {
  return `<div class="max-w-5xl mx-auto">
    <h2 class="text-2xl font-bold text-gray-900 mb-2">Draw your gym map</h2>
    <p class="text-gray-500 mb-4">Draw each wall as a line — click to place points, double-click to finish. Then name the wall. You can come back and edit this any time in Routes → Edit Map.</p>
    <div class="flex gap-4">
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 mb-3">
          <button id="map-draw-btn" onclick="startDrawingWall()" class="px-4 py-2 bg-[#1E3A5F] text-white text-sm font-semibold rounded-lg hover:bg-[#2A4D7A] transition">✏️ Draw Wall</button>
          <button onclick="cancelDrawing()" id="map-cancel-btn" class="hidden px-4 py-2 bg-gray-100 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-200 transition">Cancel</button>
          <span id="map-drawing-hint" class="text-sm text-amber-600 font-medium hidden">Click to add points · Double-click to finish</span>
        </div>
        <div class="border-2 border-gray-200 rounded-xl overflow-hidden" id="map-canvas-wrap">
          <svg id="wall-map-svg" viewBox="0 0 800 600" style="width:100%;height:auto;display:block;background:#f8fafc"
            onclick="handleMapClick(event)" ondblclick="handleMapDblClick(event)" onmousemove="handleMapMouseMove(event)">
            <defs><pattern id="wiz-grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e2e8f0" stroke-width="0.5"/></pattern></defs>
            <rect width="800" height="600" fill="url(#wiz-grid)"/>
            <g id="wiz-walls-layer"></g>
            <g id="wiz-drawing-layer"></g>
          </svg>
        </div>
      </div>
      <div class="w-60 flex-shrink-0 space-y-3">
        <div class="bg-white border border-gray-200 rounded-xl p-3">
          <p class="text-xs font-semibold text-gray-500 uppercase mb-2">Rooms (optional)</p>
          <div id="wiz-rooms-list" class="space-y-1 mb-2 max-h-28 overflow-y-auto"></div>
          <div class="flex gap-2">
            <input type="text" id="new-room-name" placeholder="Room name" class="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-[#1E3A5F]">
            <button onclick="addWizardRoom()" class="px-3 py-1.5 bg-[#1E3A5F] text-white text-xs font-semibold rounded-lg">+</button>
          </div>
        </div>
        <div id="wiz-name-panel" class="bg-blue-50 border border-blue-200 rounded-xl p-3 hidden">
          <p class="text-xs font-semibold text-blue-700 uppercase mb-2">Name this wall</p>
          <input type="text" id="wiz-wall-name" placeholder="e.g. Left Wall" class="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm mb-2 focus:outline-none focus:border-[#1E3A5F]">
          <div class="flex gap-1 mb-2 flex-wrap" id="wiz-colour-picker">
            ${WALL_COLOURS.map((c,i) => `<button onclick="selectWallColour('${c}',${i})" class="w-7 h-7 rounded-full border-2 ${i===0?'border-gray-800 scale-110':'border-transparent'} transition" id="wc-${i}" style="background:${c}"></button>`).join('')}
          </div>
          <select id="wiz-wall-room" class="w-full px-2 py-1.5 border border-blue-200 rounded-lg text-sm mb-2 focus:outline-none"><option value="">No room</option></select>
          <div class="flex gap-2">
            <button onclick="confirmWallName()" class="flex-1 py-1.5 bg-[#1E3A5F] text-white text-sm font-semibold rounded-lg hover:bg-[#2A4D7A]">Save</button>
            <button onclick="discardCurrentWall()" class="py-1.5 px-3 bg-white border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50">✕</button>
          </div>
        </div>
        <div class="bg-white border border-gray-200 rounded-xl p-3">
          <p class="text-xs font-semibold text-gray-500 uppercase mb-2">Walls</p>
          <div id="wiz-walls-list" class="space-y-1 max-h-48 overflow-y-auto"><p class="text-xs text-gray-400">No walls yet</p></div>
        </div>
      </div>
    </div>
  </div>`;
}

async function initWallMapBuilder() {
  try {
    _mapState.savedWalls = await api('GET', '/api/routes/walls') || [];
    _mapState.savedRooms = await api('GET', '/api/routes/rooms') || [];
  } catch (e) { _mapState.savedWalls = []; _mapState.savedRooms = []; }
  _mapState.localWalls = _mapState.savedWalls.map(w => ({ ...w, _localId: w.id }));
  _mapState.localRooms = _mapState.savedRooms.map(r => ({ ...r, _localId: r.id }));
  renderWallMapCanvas();
  renderWizardRoomsList();
  renderWizardWallsList();
}

function getSVGPoint(svg, e) {
  const pt = svg.createSVGPoint();
  pt.x = e.clientX; pt.y = e.clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const p = pt.matrixTransform(ctm.inverse());
  return { x: Math.round(p.x), y: Math.round(p.y) };
}

function handleMapClick(e) {
  if (!_mapState.isDrawing || e.detail >= 2) return;
  const svg = document.getElementById('wall-map-svg');
  const pt = getSVGPoint(svg, e);
  _mapState.drawingPoints.push([pt.x, pt.y]);
  renderDrawingLayer();
}

function handleMapDblClick(e) {
  if (!_mapState.isDrawing) return;
  e.preventDefault();
  if (_mapState.drawingPoints.length > 0) _mapState.drawingPoints.pop();
  if (_mapState.drawingPoints.length < 2) { showToast('Draw at least 2 points to define a wall', 'error'); return; }
  _mapState.isDrawing = false;
  document.getElementById('map-draw-btn').classList.remove('hidden');
  document.getElementById('map-cancel-btn').classList.add('hidden');
  document.getElementById('map-drawing-hint').classList.add('hidden');
  const panel = document.getElementById('wiz-name-panel');
  panel.classList.remove('hidden');
  document.getElementById('wiz-wall-name').value = '';
  document.getElementById('wiz-wall-name').focus();
  const sel = document.getElementById('wiz-wall-room');
  sel.innerHTML = '<option value="">No room</option>' + _mapState.localRooms.map(r => `<option value="${r.id||r._localId}">${r.name}</option>`).join('');
  renderDrawingLayer();
}

function handleMapMouseMove(e) {
  if (!_mapState.isDrawing) return;
  _mapState.cursorPos = getSVGPoint(document.getElementById('wall-map-svg'), e);
  renderDrawingLayer();
}

function startDrawingWall() {
  _mapState.isDrawing = true;
  _mapState.drawingPoints = [];
  _mapState.cursorPos = null;
  document.getElementById('map-draw-btn').classList.add('hidden');
  document.getElementById('map-cancel-btn').classList.remove('hidden');
  document.getElementById('map-drawing-hint').classList.remove('hidden');
  document.getElementById('wiz-name-panel').classList.add('hidden');
}

function cancelDrawing() {
  _mapState.isDrawing = false;
  _mapState.drawingPoints = [];
  _mapState.cursorPos = null;
  document.getElementById('map-draw-btn').classList.remove('hidden');
  document.getElementById('map-cancel-btn').classList.add('hidden');
  document.getElementById('map-drawing-hint').classList.add('hidden');
  renderDrawingLayer();
}

function selectWallColour(c, i) {
  _mapState.pendingColour = c;
  _mapState.colourIndex = i;
  WALL_COLOURS.forEach((_,j) => {
    const btn = document.getElementById(`wc-${j}`);
    if (btn) btn.className = `w-7 h-7 rounded-full border-2 ${j===i?'border-gray-800 scale-110':'border-transparent'} transition`;
  });
}

function confirmWallName() {
  const name = document.getElementById('wiz-wall-name').value.trim();
  if (!name) { showToast('Please enter a wall name', 'error'); return; }
  const roomSel = document.getElementById('wiz-wall-room');
  const room_id = roomSel.value || null;
  _mapState.localWalls.push({ _localId: Date.now(), name, colour: _mapState.pendingColour, room_id, path_json: [..._mapState.drawingPoints] });
  _mapState.drawingPoints = [];
  _mapState.colourIndex = (_mapState.colourIndex + 1) % WALL_COLOURS.length;
  _mapState.pendingColour = WALL_COLOURS[_mapState.colourIndex];
  document.getElementById('wiz-name-panel').classList.add('hidden');
  renderWallMapCanvas();
  renderWizardWallsList();
}

function discardCurrentWall() {
  _mapState.drawingPoints = [];
  document.getElementById('wiz-name-panel').classList.add('hidden');
  renderDrawingLayer();
}

function addWizardRoom() {
  const name = document.getElementById('new-room-name').value.trim();
  if (!name) return;
  _mapState.localRooms.push({ _localId: Date.now(), id: `local_${Date.now()}`, name });
  document.getElementById('new-room-name').value = '';
  renderWizardRoomsList();
}

function removeWizardRoom(localId) {
  _mapState.localRooms = _mapState.localRooms.filter(r => (r._localId || r.id) != localId);
  renderWizardRoomsList();
}

function removeWizardWall(localId) {
  _mapState.localWalls = _mapState.localWalls.filter(w => (w._localId || w.id) != localId);
  renderWallMapCanvas();
  renderWizardWallsList();
}

function renderWizardRoomsList() {
  const el = document.getElementById('wiz-rooms-list');
  if (!el) return;
  el.innerHTML = _mapState.localRooms.length === 0 ? '<p class="text-xs text-gray-400">No rooms</p>'
    : _mapState.localRooms.map(r => `<div class="flex items-center justify-between text-xs py-0.5">
      <span class="text-gray-700">${r.name}</span>
      <button onclick="removeWizardRoom(${r._localId||`'${r.id}'`})" class="text-gray-300 hover:text-red-500">✕</button>
    </div>`).join('');
}

function renderWizardWallsList() {
  const el = document.getElementById('wiz-walls-list');
  if (!el) return;
  if (_mapState.localWalls.length === 0) { el.innerHTML = '<p class="text-xs text-gray-400">No walls yet</p>'; return; }
  el.innerHTML = _mapState.localWalls.map(w => `
    <div class="flex items-center gap-2 py-0.5">
      <div class="w-3 h-3 rounded-full flex-shrink-0" style="background:${w.colour}"></div>
      <span class="text-xs text-gray-700 flex-1 truncate">${w.name}</span>
      <button onclick="removeWizardWall(${w._localId||`'${w.id}'`})" class="text-gray-300 hover:text-red-500 text-xs flex-shrink-0">✕</button>
    </div>
  `).join('');
}

function renderWallMapCanvas() {
  const layer = document.getElementById('wiz-walls-layer');
  if (!layer) return;
  layer.innerHTML = _mapState.localWalls.map(w => {
    const pts = w.path_json;
    if (!pts || pts.length < 2) return '';
    const points = pts.map(p => p.join(',')).join(' ');
    const mid = pts[Math.floor(pts.length / 2)];
    return `<g>
      <polyline points="${points}" fill="none" stroke="${w.colour}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>
      ${pts.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="3" fill="${w.colour}" opacity="0.6"/>`).join('')}
      <text x="${mid[0]}" y="${mid[1]-10}" text-anchor="middle" fill="${w.colour}" font-size="11" font-weight="700" opacity="0.9">${w.name}</text>
    </g>`;
  }).join('');
}

function renderDrawingLayer() {
  const layer = document.getElementById('wiz-drawing-layer');
  if (!layer) return;
  const pts = _mapState.drawingPoints;
  const colour = _mapState.pendingColour;
  let html = '';
  if (pts.length >= 2) html += `<polyline points="${pts.map(p=>p.join(',')).join(' ')}" fill="none" stroke="${colour}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>`;
  if (pts.length >= 1 && _mapState.cursorPos) {
    const last = pts[pts.length-1];
    html += `<line x1="${last[0]}" y1="${last[1]}" x2="${_mapState.cursorPos.x}" y2="${_mapState.cursorPos.y}" stroke="${colour}" stroke-width="2" stroke-dasharray="5,5" opacity="0.5"/>`;
  }
  pts.forEach(p => { html += `<circle cx="${p[0]}" cy="${p[1]}" r="5" fill="${colour}" stroke="white" stroke-width="2"/>`; });
  if (_mapState.cursorPos) html += `<circle cx="${_mapState.cursorPos.x}" cy="${_mapState.cursorPos.y}" r="4" fill="${colour}" opacity="0.4"/>`;
  layer.innerHTML = html;
}

async function saveWallMap() {
  try {
    const roomIdMap = {};
    for (const r of _mapState.localRooms) {
      if (r.id && !r.id.startsWith('local_')) { roomIdMap[r._localId||r.id] = r.id; }
      else { const saved = await api('POST', '/api/routes/rooms', { name: r.name }); roomIdMap[r._localId||r.id] = saved.id; }
    }
    const localIds = new Set(_mapState.localWalls.filter(w => w.id).map(w => w.id));
    for (const sw of _mapState.savedWalls) {
      if (!localIds.has(sw.id)) await api('DELETE', `/api/routes/walls/${sw.id}`);
    }
    for (const w of _mapState.localWalls) {
      const room_id = w.room_id ? (roomIdMap[w.room_id] || w.room_id) : null;
      const payload = { name: w.name, colour: w.colour, room_id, path_json: w.path_json };
      if (w.id && !String(w.id).startsWith('local_')) await api('PUT', `/api/routes/walls/${w.id}`, payload);
      else await api('POST', '/api/routes/walls', payload);
    }
  } catch (e) { console.warn('[wizard] wall map save failed', e); }
}

// Step 5 — Pass Types
function renderWizardStep5() {
  return `<div class="max-w-3xl mx-auto">
    <h2 class="text-2xl font-bold text-gray-900 mb-2">Set up your pass types</h2>
    <p class="text-gray-500 mb-6">Configure your pricing. You can always add more in Settings → Pass Types later.</p>
    <div id="wiz-pass-list" class="space-y-3 mb-4"></div>
    <button onclick="addWizardPassType()" class="w-full py-3 border-2 border-dashed border-gray-300 hover:border-[#1E3A5F] text-gray-500 hover:text-[#1E3A5F] rounded-xl text-sm font-medium transition">+ Add Pass Type</button>
  </div>`;
}

async function loadWizardPassTypes() {
  try { _wizardPassTypes = await api('GET', '/api/passes/types') || []; } catch (e) { _wizardPassTypes = []; }
  renderWizardPassList();
}

function renderWizardPassList() {
  const el = document.getElementById('wiz-pass-list');
  if (!el) return;
  if (_wizardPassTypes.length === 0) { el.innerHTML = '<p class="text-gray-400 text-sm text-center py-4">No pass types.</p>'; return; }
  const CATS = ['single_entry','multi_visit','monthly_pass','membership_dd','staff'];
  el.innerHTML = _wizardPassTypes.map((p, i) => `
    <div class="bg-white border border-gray-200 rounded-xl p-4">
      <div class="grid grid-cols-5 gap-3 items-end mb-3">
        <div class="col-span-2">
          <label class="block text-xs font-semibold text-gray-500 mb-1">Name</label>
          <input type="text" value="${p.name}" oninput="_wizardPassTypes[${i}].name=this.value" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#1E3A5F]">
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-500 mb-1">Peak £</label>
          <input type="number" step="0.01" value="${p.price_peak||0}" oninput="_wizardPassTypes[${i}].price_peak=parseFloat(this.value)||0" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#1E3A5F]">
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-500 mb-1">Off-Peak £</label>
          <input type="number" step="0.01" value="${p.price_off_peak||0}" oninput="_wizardPassTypes[${i}].price_off_peak=parseFloat(this.value)||0" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#1E3A5F]">
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-500 mb-1">Category</label>
          <select oninput="_wizardPassTypes[${i}].category=this.value" class="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#1E3A5F]">
            ${CATS.map(c => `<option value="${c}" ${p.category===c?'selected':''}>${c.replace(/_/g,' ')}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="grid grid-cols-3 gap-3 items-end">
        <div>
          <label class="block text-xs font-semibold text-gray-500 mb-1">Visits (blank = unlimited)</label>
          <input type="number" value="${p.visits_included||''}" placeholder="∞" oninput="_wizardPassTypes[${i}].visits_included=this.value?parseInt(this.value):null" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#1E3A5F]">
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-500 mb-1">Duration days</label>
          <input type="number" value="${p.duration_days||''}" placeholder="No expiry" oninput="_wizardPassTypes[${i}].duration_days=this.value?parseInt(this.value):null" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#1E3A5F]">
        </div>
        <div class="flex items-end pb-0.5">
          ${p.category !== 'staff' ? `<button onclick="removeWizardPassType(${i})" class="text-xs text-red-400 hover:text-red-600 hover:underline">Remove</button>` : ''}
        </div>
      </div>
    </div>
  `).join('');
}

function addWizardPassType() {
  _wizardPassTypes.push({ name:'New Pass', category:'single_entry', price_peak:0, price_off_peak:0 });
  renderWizardPassList();
  document.getElementById('wiz-pass-list').lastElementChild?.scrollIntoView({ behavior:'smooth' });
}

function removeWizardPassType(i) {
  _wizardPassTypes.splice(i, 1);
  renderWizardPassList();
}

async function saveWizardPassTypes() {
  for (const p of _wizardPassTypes) {
    try {
      if (p.id) await api('PUT', `/api/passes/types/${p.id}`, p);
      else await api('POST', '/api/passes/types', p);
    } catch (e) { console.warn('[wizard] pass save failed', e); }
  }
}

// ============================================================
// Permission Check Helpers
// ============================================================

function staffHasPermission(staff, perm) {
  if (!staff) return false;
  const role = staff.role;
  if (role === 'owner' || role === 'tech_lead') return true;
  const perms = staff.permissions || {};
  return !!perms[perm];
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

function renderActiveVisitorCard(v) {
  const initials = (v.first_name[0] + v.last_name[0]).toUpperCase();
  const colour = nameToColour(v.first_name + v.last_name);
  const age = calculateAge(v.date_of_birth);
  const isUnder18 = age !== null && age < 18;

  // Time in gym
  let timeLabel = '';
  if (v.checked_in_at) {
    const mins = Math.floor((Date.now() - new Date(v.checked_in_at)) / 60000);
    if (mins < 60) timeLabel = `${mins}m`;
    else { const h = Math.floor(mins / 60); const m = mins % 60; timeLabel = m > 0 ? `${h}h ${m}m` : `${h}h`; }
  }

  const passName = v.pass_name || v.active_pass_name || '';
  const method = { desk: 'Desk', qr_scan: 'QR', pos: 'POS', app: 'App' }[v.method] || v.method || 'Desk';

  return `
    <div class="bg-white border border-gray-200 rounded-xl p-3.5 hover:shadow-sm hover:border-blue-200 transition cursor-pointer flex items-center gap-3"
         onclick="openMemberProfile('${v.id}')">
      <div class="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0 relative"
           style="background:${colour}">
        ${initials}
        ${isUnder18 ? `<span class="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-blue-500 rounded-full border-2 border-white"></span>` : ''}
      </div>
      <div class="flex-1 min-w-0">
        <p class="font-bold text-sm text-gray-900 truncate">${v.first_name} ${v.last_name}</p>
        <div class="flex items-center gap-2 mt-0.5 flex-wrap">
          ${passName ? `<span class="text-xs text-gray-500 truncate">${passName}</span>` : ''}
          ${passName && timeLabel ? '<span class="text-gray-300 text-xs">·</span>' : ''}
          ${timeLabel ? `<span class="text-xs font-medium text-blue-500">${timeLabel}</span>` : ''}
        </div>
      </div>
      <span class="text-xs text-gray-300 flex-shrink-0">${method}</span>
    </div>`;
}

// One-press check-in from member profile (no PIN — member has active pass, staff already looked them up)
async function quickCheckInFromProfile(memberId, name) {
  try {
    const result = await api('POST', '/api/checkin/process', { memberId });
    if (result.success) {
      showToast(`${name} checked in`, 'success');
      if (result.registrationWarning) {
        showToast('REGISTRATION FEE NOT PAID — collect £3', 'error');
      }
      closeModal();
      loadActiveVisitors();
    } else {
      showToast(result.error || 'Check-in failed', 'error');
    }
  } catch (err) {
    showToast('Check-in failed: ' + err.message, 'error');
  }
}

// Assign pass directly to member — requires manager PIN
function assignPassModal(memberId, name) {
  requirePin('members_edit', async (staff) => {
    const passTypes = await api('GET', '/api/passes/types');
    const categories = {
      'single_entry': 'Day Entry',
      'multi_visit': '10-Visit Pass',
      'monthly_pass': 'Monthly Pass',
      'annual_membership': 'Annual Membership',
      'membership': 'Membership',
      'staff': 'Staff / Complimentary',
    };

    showModal(`
      <div class="p-6 max-w-md mx-auto">
        <h3 class="text-lg font-bold text-gray-900 mb-1">Assign Pass</h3>
        <p class="text-sm text-gray-500 mb-4">Assigning to <strong>${name}</strong> — authorised by <strong>${staff.first_name} ${staff.last_name}</strong></p>
        <div class="space-y-3">
          <div>
            <label class="block text-xs text-gray-500 mb-1 uppercase font-medium">Pass Type</label>
            <select id="assign-pass-type" class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" onchange="assignPassUpdatePrice()">
              <option value="">Select a pass...</option>
              ${Object.entries(categories).map(([cat, label]) => {
                const group = passTypes.filter(p => p.category === cat);
                if (!group.length) return '';
                return `<optgroup label="${label}">${group.map(p => `<option value="${p.id}" data-peak="${p.price_peak}" data-offpeak="${p.price_off_peak}">${p.name} — £${p.price_peak?.toFixed(2)}</option>`).join('')}</optgroup>`;
              }).join('')}
            </select>
          </div>
          <div class="flex gap-3">
            <label class="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" id="assign-peak" checked class="w-4 h-4 rounded">
              <span>Peak rate</span>
            </label>
            <span id="assign-price-display" class="text-sm text-gray-500 ml-auto"></span>
          </div>
          <div>
            <label class="block text-xs text-gray-500 mb-1 uppercase font-medium">Price Paid (£)</label>
            <input type="number" id="assign-price-paid" step="0.01" min="0" placeholder="Leave blank for default"
              class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
          </div>
        </div>
        <div class="mt-5 flex gap-2">
          <button onclick="closeModal()" class="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
          <button onclick="submitAssignPass('${memberId}')" class="flex-1 py-2.5 bg-[#1E3A5F] text-white rounded-lg text-sm font-semibold hover:bg-[#2A4D7A]">Assign Pass</button>
        </div>
      </div>
    `);
  }, 'Manager PIN', `Assign a pass to ${name}`);
}

function assignPassUpdatePrice() {
  const sel = document.getElementById('assign-pass-type');
  const opt = sel.options[sel.selectedIndex];
  const isPeak = document.getElementById('assign-peak').checked;
  const price = isPeak ? opt.dataset.peak : opt.dataset.offpeak;
  const disp = document.getElementById('assign-price-display');
  if (price) {
    disp.textContent = `Default: £${parseFloat(price).toFixed(2)}`;
    document.getElementById('assign-price-paid').placeholder = parseFloat(price).toFixed(2);
  }
}

async function submitAssignPass(memberId) {
  const passTypeId = document.getElementById('assign-pass-type').value;
  if (!passTypeId) { showToast('Select a pass type', 'error'); return; }
  const isPeak = document.getElementById('assign-peak').checked;
  const pricePaidStr = document.getElementById('assign-price-paid').value;
  const pricePaid = pricePaidStr ? parseFloat(pricePaidStr) : null;

  try {
    await api('POST', '/api/passes/issue', { memberId, passTypeId, isPeak, pricePaid });
    showToast('Pass assigned', 'success');
    closeModal();
    openMemberProfile(memberId);
  } catch (err) {
    showToast('Failed: ' + err.message, 'error');
  }
}

// Open POS for a member — requires PIN first
function openPOSForMemberWithPin(memberId, name) {
  requirePin('pos', (staff) => {
    posOperator = staff;
    closeModal();
    openPOSForMember(memberId, name);
  }, 'Staff PIN', `Opening POS for ${name}`);
}

function quickCheckIn(memberId) {
  requirePin('checkin', async (staff) => {
    try {
      const result = await api('POST', '/api/checkin/process', { memberId, staffId: staff.id });
      if (result.success) {
        showToast(`${result.member.first_name} checked in (by ${staff.first_name})`, 'success');
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
  }, 'Staff PIN', 'Check-in requires staff authorisation');
}

// ============================================================
// Navigation
// ============================================================

const pages = ['dashboard', 'checkin', 'members', 'pos', 'events', 'routes', 'analytics', 'staff'];

function navigateTo(pageName) {
  const navLink = document.querySelector(`[data-page="${pageName}"]`);
  const pinRequired = navLink ? navLink.dataset.pinRequired : null;

  // Pages that require PIN to VIEW/ENTER
  if (pinRequired) {
    const pinTitle = navLink?.dataset.pinTitle || 'Enter PIN';
    const pinDesc = navLink?.dataset.pinDesc || '';
    requirePin(pinRequired, (staff) => {
      posOperator = staff; // Set POS operator from the nav-level PIN
      doNavigate(pageName);
    }, pinTitle, pinDesc);
    return;
  }

  doNavigate(pageName);
}

function doNavigate(pageName) {
  pages.forEach(p => {
    const el = document.getElementById(`page-${p}`);
    if (el) el.classList.remove('active');
  });

  document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));

  const pageEl = document.getElementById(`page-${pageName}`);
  if (pageEl) pageEl.classList.add('active');

  const navLink = document.querySelector(`[data-page="${pageName}"]`);
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

document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const page = link.dataset.page;
    navigateTo(page);
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

let dashboardAutoRefresh = null;

async function loadDashboard() {
  const el = document.getElementById('page-dashboard');

  el.innerHTML = `
    <!-- Stats bar -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5" id="dashboard-stats">
      ${[1,2,3,4].map(() => `<div class="bg-white border border-gray-200 rounded-xl p-4 animate-pulse"><div class="h-3 bg-gray-200 rounded w-16 mb-2"></div><div class="h-7 bg-gray-200 rounded w-10"></div></div>`).join('')}
    </div>

    <!-- Search -->
    <div class="bg-white border border-gray-200 rounded-xl p-4 mb-5">
      <div class="relative">
        <svg class="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        <input type="text" id="dashboard-search" class="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-base focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
               placeholder="Search by name, email or phone..." autocomplete="off">
      </div>
      <p id="dashboard-search-hint" class="text-xs text-gray-400 mt-2">Type to search all members</p>
      <div id="dashboard-search-results" class="mt-3 hidden">
        <span id="dashboard-search-count" class="text-xs text-gray-400"></span>
        <div id="dashboard-search-grid" class="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2"></div>
      </div>
    </div>

    <!-- Validation queue -->
    <div id="dashboard-validation-queue" class="mb-5 hidden">
      <div class="flex items-center gap-2 mb-2">
        <h3 class="text-base font-bold text-gray-900">Needs Validation</h3>
        <span id="validation-queue-badge" class="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-bold rounded-full"></span>
      </div>
      <div id="validation-queue-list" class="space-y-2"></div>
    </div>

    <!-- Active visitors -->
    <div class="mb-5">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-base font-bold text-gray-900" id="active-visitors-header">In Gym Now (0)</h3>
        <div class="flex items-center gap-3">
          <span id="dashboard-refresh-indicator" class="text-xs text-gray-400 hidden">Auto-refreshing</span>
          <button onclick="refreshDashboardData()" class="text-xs text-gray-400 hover:text-gray-700 flex items-center gap-1 transition">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
            Refresh
          </button>
        </div>
      </div>
      <div id="active-visitors-grid" class="grid grid-cols-1 md:grid-cols-2 gap-2"></div>
      <div id="active-visitors-pagination" class="mt-3 flex justify-center gap-2"></div>
    </div>

    <!-- FAB -->
    <button onclick="showNewMemberModal()"
            class="fixed bottom-6 right-6 w-14 h-14 bg-[#1E3A5F] hover:bg-[#2A4D7A] text-white rounded-full shadow-xl flex items-center justify-center text-2xl transition z-40">
      +
    </button>
  `;

  const searchInput = document.getElementById('dashboard-search');
  searchInput.addEventListener('input', () => {
    clearTimeout(dashboardSearchTimer);
    const q = searchInput.value.trim();
    if (q.length < 2) {
      document.getElementById('dashboard-search-results').classList.add('hidden');
      document.getElementById('dashboard-search-hint').textContent = 'Type to search all members';
      return;
    }
    dashboardSearchTimer = setTimeout(() => dashboardSearch(q), 250);
  });
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { searchInput.value = ''; document.getElementById('dashboard-search-results').classList.add('hidden'); }
  });

  await refreshDashboardData();

  // Auto-refresh every 45 seconds
  clearInterval(dashboardAutoRefresh);
  dashboardAutoRefresh = setInterval(() => {
    if (document.getElementById('page-dashboard')?.classList.contains('active')) {
      refreshDashboardData(true);
    } else {
      clearInterval(dashboardAutoRefresh);
    }
  }, 45000);
}

async function refreshDashboardData(silent = false) {
  await Promise.all([
    loadDashboardStats(),
    loadActiveVisitors(),
    loadValidationQueue(),
  ]);
}

async function loadDashboardStats() {
  try {
    const d = await api('GET', '/api/stats/dashboard');
    document.getElementById('dashboard-stats').innerHTML = `
      <div class="bg-white border border-gray-200 rounded-xl p-4">
        <p class="text-xs text-gray-500 font-medium uppercase">In Gym Now</p>
        <p class="text-3xl font-bold text-blue-600 mt-1">${d.currentlyInGym ?? d.todayCheckIns}</p>
        <p class="text-xs text-gray-400 mt-1">${d.todayCheckIns} total today</p>
      </div>
      <div class="bg-white border border-gray-200 rounded-xl p-4">
        <p class="text-xs text-gray-500 font-medium uppercase">Revenue Today</p>
        <p class="text-3xl font-bold text-green-600 mt-1">£${parseFloat(d.todayRevenue || 0).toFixed(0)}</p>
        <p class="text-xs text-gray-400 mt-1">${d.todayTransactions || 0} transactions</p>
      </div>
      <div class="bg-white border border-gray-200 rounded-xl p-4">
        <p class="text-xs text-gray-500 font-medium uppercase">Members</p>
        <p class="text-3xl font-bold text-gray-800 mt-1">${d.totalMembers}</p>
        <p class="text-xs text-gray-400 mt-1">${d.activeMembers} with active pass</p>
      </div>
      <div class="bg-white border border-gray-200 rounded-xl p-4">
        <p class="text-xs text-gray-500 font-medium uppercase">This Week</p>
        <p class="text-3xl font-bold text-gray-800 mt-1">£${parseFloat(d.weekRevenue || 0).toFixed(0)}</p>
        <p class="text-xs text-gray-400 mt-1">${d.weekCheckIns ?? '—'} check-ins</p>
      </div>
    `;
  } catch (e) {}
}

async function loadValidationQueue() {
  try {
    const result = await api('GET', '/api/members/list?filter=reg_due&perPage=20');
    const members = result.members || [];
    const container = document.getElementById('dashboard-validation-queue');
    const list = document.getElementById('validation-queue-list');
    const badge = document.getElementById('validation-queue-badge');

    if (members.length === 0) {
      container.classList.add('hidden');
      return;
    }

    container.classList.remove('hidden');
    badge.textContent = members.length;
    list.innerHTML = members.map(m => {
      const initials = (m.first_name[0] + m.last_name[0]).toUpperCase();
      const colour = nameToColour(m.first_name + m.last_name);
      const age = calculateAge(m.date_of_birth);
      const isUnder18 = age !== null && age < 18;
      const hasWaiver = m.waiver_valid;
      return `
        <div class="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
          <div class="flex items-center gap-3 min-w-0 cursor-pointer" onclick="openMemberProfile('${m.id}')">
            <div class="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0" style="background:${colour}">${initials}</div>
            <div class="min-w-0">
              <p class="font-semibold text-sm text-gray-900 truncate">${m.first_name} ${m.last_name}${isUnder18 ? ` <span class="text-blue-600 text-xs">(${age})</span>` : ''}</p>
              <div class="flex items-center gap-2 mt-0.5">
                ${hasWaiver
                  ? `<span class="text-xs text-green-600 font-medium">Waiver ✓</span>`
                  : `<span class="text-xs text-red-500 font-medium">No waiver</span>`}
                <span class="text-xs text-orange-600 font-medium">£3 reg fee due</span>
              </div>
            </div>
          </div>
          ${hasWaiver ? `
            <button onclick="event.stopPropagation(); validateRegistration('${m.id}')"
              class="flex-shrink-0 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-lg transition whitespace-nowrap">
              Collect £3
            </button>` : `
            <button onclick="event.stopPropagation(); openMemberProfile('${m.id}')"
              class="flex-shrink-0 px-3 py-1.5 border border-orange-300 text-orange-600 text-xs font-medium rounded-lg hover:bg-orange-100 transition whitespace-nowrap">
              View Profile
            </button>`}
        </div>`;
    }).join('');
  } catch (e) {}
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
      grid.innerHTML = '<p class="text-gray-400 text-sm col-span-2 text-center py-8">Nobody checked in yet today</p>';
      pagination.innerHTML = '';
      return;
    }

    grid.innerHTML = data.visitors.map(v => renderActiveVisitorCard(v)).join('');

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

// Check-in is fully autonomous — no PIN needed. Second laptop with QR scanner.
// Happy ding = success, sad ding = failure.

async function checkinQrScan(qrCode) {
  const searchInput = document.getElementById('checkin-search');
  searchInput.value = '';
  clearTimeout(checkinResultClearTimer);

  try {
    const result = await api('GET', `/api/checkin/qr/${encodeURIComponent(qrCode)}`);
    showCheckinResultBig(result);
    playCheckinSound(result.success);
  } catch (err) {
    showCheckinResultBig({ success: false, error: err.message, message: 'Check-in failed' });
    playCheckinSound(false);
  }
}

// Audio feedback for check-in scanner
function playCheckinSound(success) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (success) {
      // Happy ding — two ascending tones
      [0, 0.15].forEach((delay, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.value = i === 0 ? 880 : 1174.66; // A5 → D6
        gain.gain.setValueAtTime(0.3, ctx.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.3);
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + 0.3);
      });
    } else {
      // Sad buzz — low descending tone
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'square';
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(150, ctx.currentTime + 0.4);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
    }
  } catch (e) { /* audio not available */ }
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

    <div class="card mb-4 space-y-3">
      <input type="text" id="member-search" class="form-input" placeholder="Search members by name, email, or phone..." oninput="searchMembers(this.value)">
      <div class="flex flex-wrap gap-2" id="member-filter-chips">
        ${['all','reg_due','no_waiver','no_pass','active_pass','under_18'].map((f, i) => {
          const labels = { all: 'All members', reg_due: 'Reg fee due', no_waiver: 'No waiver', no_pass: 'No active pass', active_pass: 'Has pass', under_18: 'Under 18' };
          return `<button onclick="setMemberFilter('${f}')" data-filter="${f}" class="member-filter-chip px-3 py-1 rounded-full text-xs font-medium border transition ${i === 0 ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]' : 'bg-white text-gray-600 border-gray-300 hover:border-[#1E3A5F] hover:text-[#1E3A5F]'}">${labels[f]}</button>`;
        }).join('')}
      </div>
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
let memberActiveFilter = 'all';

function searchMembers(query) {
  clearTimeout(memberSearchTimeout);
  memberSearchTimeout = setTimeout(() => refreshMembersList(query, 1, memberActiveFilter), 200);
}

function setMemberFilter(filter) {
  memberActiveFilter = filter;
  document.querySelectorAll('.member-filter-chip').forEach(chip => {
    const active = chip.dataset.filter === filter;
    chip.className = chip.className.replace(/bg-\[#1E3A5F\] text-white border-\[#1E3A5F\]|bg-white text-gray-600 border-gray-300 hover:border-\[#1E3A5F\] hover:text-\[#1E3A5F\]/g, '');
    chip.className += active
      ? ' bg-[#1E3A5F] text-white border-[#1E3A5F]'
      : ' bg-white text-gray-600 border-gray-300 hover:border-[#1E3A5F] hover:text-[#1E3A5F]';
  });
  const q = document.getElementById('member-search')?.value || '';
  refreshMembersList(q, 1, filter);
}

async function exportMembersCSV() {
  try {
    showToast('Generating CSV...', 'info');
    // Fetch all members (large page)
    const result = await api('GET', '/api/members/list?page=1&perPage=10000');
    const members = result.members || [];
    if (members.length === 0) { showToast('No members to export', 'error'); return; }

    const headers = ['First Name','Last Name','Email','Phone','DOB','Gender','Address','City','County','Postcode','Registration Fee Paid','Waiver Signed','Active Pass','Emergency Contact','Emergency Phone','Medical Notes','Joined Date'];
    const escapeCSV = (val) => {
      if (val == null) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) return '"' + str.replace(/"/g, '""') + '"';
      return str;
    };

    const rows = members.map(m => [
      escapeCSV(m.first_name),
      escapeCSV(m.last_name),
      escapeCSV(m.email),
      escapeCSV(m.phone),
      escapeCSV(m.date_of_birth),
      escapeCSV(m.gender),
      escapeCSV([m.address_line1, m.address_line2].filter(Boolean).join(', ')),
      escapeCSV(m.city),
      escapeCSV(m.region),
      escapeCSV(m.postal_code),
      m.registration_fee_paid ? 'Yes' : 'No',
      m.waiver_valid ? 'Yes' : 'No',
      m.has_valid_pass ? (m.active_pass?.pass_name || 'Yes') : 'No',
      escapeCSV(m.emergency_contact_name),
      escapeCSV(m.emergency_contact_phone),
      escapeCSV(m.medical_conditions),
      m.created_at ? new Date(m.created_at).toLocaleDateString('en-GB') : ''
    ].join(','));

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const today = new Date().toISOString().split('T')[0];
    a.href = url;
    a.download = `members-export-${today}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Exported ${members.length} members`, 'success');
  } catch (err) {
    showToast('Export failed: ' + err.message, 'error');
  }
}

async function refreshMembersList(query = '', page = 1, filter = memberActiveFilter) {
  const tbody = document.getElementById('members-table-body');
  const countText = document.getElementById('member-count-text');

  let members, total;
  const filterParam = filter && filter !== 'all' ? `&filter=${filter}` : '';

  if (query) {
    members = await api('GET', `/api/members/search?q=${encodeURIComponent(query)}&limit=50${filterParam}`);
    total = members.length;
  } else {
    const result = await api('GET', `/api/members/list?page=${page}&perPage=50${filterParam}`);
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
  window._currentProfileMemberId = memberId;
  try {
    const [member, comments, passes, visits, transactionsData, events, vouchers] = await Promise.all([
      api('GET', `/api/members/${memberId}/with-pass-status`),
      api('GET', `/api/members/${memberId}/comments`),
      api('GET', `/api/passes/member/${memberId}`).catch(() => []),
      api('GET', `/api/members/${memberId}/visits`),
      api('GET', `/api/members/${memberId}/transactions?page=1&perPage=20`),
      api('GET', `/api/members/${memberId}/events`),
      api('GET', `/api/members/${memberId}/vouchers`),
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
      <div class="flex flex-col md:flex-row min-h-[560px]">
        <!-- Left Panel -->
        <div class="md:w-72 flex-shrink-0 bg-white border-r border-gray-200 rounded-l-xl flex flex-col overflow-y-auto">

          <!-- Photo + close -->
          <div class="relative">
            ${member.photo_url
              ? `<img src="${member.photo_url}?t=${Date.now()}" class="w-full h-52 object-cover rounded-tl-xl" alt="${fullName}">`
              : `<div class="w-full h-52 rounded-tl-xl flex items-center justify-center text-white font-bold text-5xl" style="background:${colour}">${initials}</div>`}
            <button onclick="closeModal()" class="absolute top-2 right-2 w-7 h-7 bg-black/40 hover:bg-black/60 rounded-full flex items-center justify-center text-white transition">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
            <button onclick="togglePhotoMenu('${member.id}')" class="absolute bottom-2 right-2 w-7 h-7 bg-black/40 hover:bg-black/60 rounded-full flex items-center justify-center text-white transition z-10" title="Change photo">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
            </button>
            <div id="photo-menu-${member.id}" class="hidden absolute bottom-12 right-2 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-20 w-44">
              <label class="flex items-center gap-2.5 px-4 py-2.5 hover:bg-gray-50 cursor-pointer text-sm text-gray-700">
                <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                Take photo
                <input type="file" accept="image/*" capture="environment" class="hidden" onchange="uploadMemberPhoto('${member.id}', this)">
              </label>
              <label class="flex items-center gap-2.5 px-4 py-2.5 hover:bg-gray-50 cursor-pointer text-sm text-gray-700 border-t border-gray-100">
                <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                Upload photo
                <input type="file" accept="image/*" class="hidden" onchange="uploadMemberPhoto('${member.id}', this)">
              </label>
            </div>
            ${isUnder18 ? `<span class="absolute top-2 left-2 px-2 py-0.5 bg-blue-500 text-white text-xs font-bold rounded-full">Under 18</span>` : ''}
            ${member.has_warning ? `<span class="absolute top-2 left-2 px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center gap-1"><svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>Warning</span>` : ''}
          </div>

          <!-- Name + info -->
          <div class="p-4 flex-1">
            <div class="flex items-start justify-between gap-2 mb-3">
              <h3 class="text-lg font-bold text-gray-900 leading-tight">${fullName}</h3>
              ${member.has_app ? `<span class="flex items-center gap-1 text-xs text-indigo-600 font-medium flex-shrink-0 mt-0.5"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>Has App</span>` : ''}
            </div>

            <div class="space-y-1.5 text-sm mb-4">
              ${member.date_of_birth ? `<div class="flex items-center gap-2 text-gray-700"><svg class="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg><span>${formatDate(member.date_of_birth)}${age !== null ? ` <span class="${isUnder18 ? 'text-blue-600 font-bold' : 'text-gray-500'}">${age}</span>` : ''}</span></div>` : ''}
              ${member.gender ? `<div class="flex items-center gap-2 text-gray-700"><svg class="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg><span class="capitalize">${member.gender.replace(/_/g, ' ')}</span></div>` : ''}
              ${member.email ? `<div class="flex items-center gap-2"><svg class="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg><span class="text-blue-600 truncate">${member.email}</span></div>` : ''}
              ${member.phone ? `<div class="flex items-center gap-2 text-gray-700"><svg class="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg><span>${member.phone}</span></div>` : ''}
              ${address ? `<div class="flex items-start gap-2 text-gray-700"><svg class="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg><span class="text-xs leading-relaxed">${address}</span></div>` : ''}
              ${member.emergency_contact_name ? `<div class="flex items-center gap-2 text-gray-700 mt-1 pt-1 border-t border-gray-100"><svg class="w-3.5 h-3.5 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg><span class="text-xs">${member.emergency_contact_name}${member.emergency_contact_phone ? ' · ' + member.emergency_contact_phone : ''}</span></div>` : ''}
              ${member.medical_conditions ? `<div class="mt-1 p-2 bg-yellow-50 border border-yellow-200 rounded-lg"><p class="text-xs text-yellow-800 font-semibold">Medical</p><p class="text-xs text-yellow-700 mt-0.5">${member.medical_conditions}</p></div>` : ''}
            </div>

            <!-- Warning + Edit row -->
            <div class="flex items-center gap-2 mb-4">
              <button onclick="toggleMemberWarning('${member.id}', ${!member.has_warning})"
                class="${member.has_warning ? 'bg-red-500 hover:bg-red-600 text-white' : 'border border-orange-300 text-orange-600 hover:bg-orange-50'} flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition">
                <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
                ${member.has_warning ? 'Warning' : 'Flag'}
              </button>
              <button onclick="editMemberModal('${member.id}')" class="text-xs text-gray-500 hover:text-gray-700 underline">Edit profile</button>
            </div>

            <!-- Action buttons -->
            <div class="space-y-2">
              ${member.has_valid_pass ? `
                <button onclick="quickCheckInFromProfile('${member.id}', '${fullName.replace(/'/g, "\\'")}')"
                  class="w-full py-2.5 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl transition text-sm flex items-center justify-center gap-2">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
                  Check In${member.active_pass?.visits_remaining != null ? ` (${member.active_pass.visits_remaining} left)` : ''}
                </button>` : ''}
              <button onclick="openPOSForMemberWithPin('${member.id}', '${fullName.replace(/'/g, "\\'")}')" class="btn btn-primary w-full btn-sm">Open in POS</button>
              <button onclick="assignPassModal('${member.id}', '${fullName.replace(/'/g, "\\'")}')" class="btn btn-secondary w-full btn-sm">Assign Pass</button>
              ${passes.some(p => p.status === 'active') ? `
                <button onclick="showMemberQrCode('${member.id}', '${fullName.replace(/'/g, "\\'")}')" class="btn btn-secondary w-full btn-sm">View QR Code</button>` : ''}
              ${member.email ? `
                <button onclick="emailMemberQrCode('${member.id}')" class="btn btn-secondary w-full btn-sm">Email QR Code</button>` : ''}
              ${member.email ? `
                <button onclick="sendPortalInvite('${member.id}')" class="btn btn-secondary w-full btn-sm">Send Portal Link</button>` : ''}
            </div>

            <!-- Collapsible: Comments -->
            <div class="mt-4 border-t border-gray-100 pt-3">
              <button onclick="toggleProfileSection('comments-section')" class="w-full flex items-center justify-between py-1 group">
                <span class="text-xs font-bold text-gray-500 uppercase">Comments ${comments.length > 0 ? `<span class="ml-1 px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded-full text-xs">${comments.length}</span>` : ''}</span>
                <svg id="comments-section-chevron" class="w-4 h-4 text-gray-400 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
              </button>
              <div id="comments-section" class="hidden mt-2">
                <div id="comment-form-container" class="hidden mb-3">
                  <textarea id="comment-text" class="form-input text-xs w-full" rows="2" placeholder="Add a comment..."></textarea>
                  <button onclick="addComment('${member.id}')" class="btn btn-sm btn-primary mt-1 w-full">Post</button>
                </div>
                <button onclick="toggleCommentForm()" class="text-xs text-blue-600 hover:underline mb-2">+ Add comment</button>
                <div class="space-y-2 max-h-36 overflow-y-auto">
                  ${comments.length === 0 ? '<p class="text-xs text-gray-400">No comments yet</p>' : comments.map(c => `
                    <div class="bg-gray-50 rounded-lg p-2">
                      <div class="flex items-center gap-1 mb-0.5">
                        <span class="text-xs font-bold text-gray-700">${c.staff_name}</span>
                        <span class="text-xs text-gray-300">${formatDate(c.created_at)}</span>
                      </div>
                      <p class="text-xs text-gray-600">${c.comment}</p>
                    </div>`).join('')}
                </div>
              </div>
            </div>

            <!-- Collapsible: Forms (Beta-style teal pill) -->
            <div class="mt-2">
              <button onclick="toggleProfileSection('forms-section')" class="w-full flex items-center justify-between px-3 py-2.5 bg-teal-500 hover:bg-teal-600 rounded-xl transition">
                <svg id="forms-section-chevron-l" class="w-4 h-4 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
                <span class="text-sm font-bold text-white tracking-wide flex items-center gap-2">
                  FORMS ${member.latest_waiver ? `<span class="w-5 h-5 rounded-full bg-white text-teal-600 text-xs font-bold flex items-center justify-center">1</span>` : ''}
                </span>
                <svg id="forms-section-chevron" class="w-4 h-4 text-white/70 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
              </button>
              <div id="forms-section" class="hidden mt-2 space-y-2">
                ${member.latest_waiver ? `
                  <div class="bg-gray-50 rounded-xl p-3 border border-gray-100">
                    <div class="flex items-start justify-between gap-2">
                      <div>
                        <p class="text-xs font-semibold text-gray-800">Waiver signed</p>
                        <p class="text-xs text-gray-400 mt-0.5">${formatDate(member.latest_waiver.signed_at)}</p>
                        ${member.latest_waiver.expires_at ? `<p class="text-xs ${new Date(member.latest_waiver.expires_at) < new Date() ? 'text-red-400' : 'text-gray-400'}">Expires ${formatDate(member.latest_waiver.expires_at)}</p>` : ''}
                      </div>
                      ${!regPaid ? `<button onclick="validateRegistration('${member.id}')" class="text-xs px-2 py-1 bg-orange-500 text-white rounded-lg font-semibold flex-shrink-0">Collect £3</button>` : `<span class="text-xs text-green-600 font-semibold">✓ Validated</span>`}
                    </div>
                  </div>` : `<p class="text-xs text-gray-400 text-center py-2">No waiver on file</p>`}
              </div>
            </div>

            <!-- Collapsible: Tags (Beta-style teal pill) -->
            <div class="mt-2">
              <button onclick="toggleProfileSection('tags-section')" class="w-full flex items-center justify-between px-3 py-2.5 bg-teal-500 hover:bg-teal-600 rounded-xl transition">
                <svg class="w-4 h-4 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
                <span class="text-sm font-bold text-white tracking-wide flex items-center gap-2">
                  TAGS ${member.tags?.length ? `<span class="w-5 h-5 rounded-full bg-white text-teal-600 text-xs font-bold flex items-center justify-center">${member.tags.length}</span>` : ''}
                </span>
                <svg id="tags-section-chevron" class="w-4 h-4 text-white/70 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
              </button>
              <div id="tags-section" class="hidden mt-2 space-y-1.5">
                ${member.tags?.length ? member.tags.map(t => {
                  const tagIcon = { warning: '⚠', jr_assessed: '◎', note: '📋', student: '🎓' }[t.tag_type] || '•';
                  const expiredSoon = t.tag_expires_at && new Date(t.tag_expires_at) < new Date(Date.now() + 30*24*60*60*1000);
                  const expired = t.tag_expires_at && new Date(t.tag_expires_at) < new Date();
                  return `<div class="flex items-center gap-2 p-2 rounded-lg bg-gray-50 border border-gray-100">
                    <span class="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold" style="background:${t.colour || '#6B7280'}">${tagIcon}</span>
                    <div class="flex-1 min-w-0">
                      <p class="text-xs font-semibold text-gray-800">${t.name}</p>
                      ${t.member_note ? `<p class="text-xs text-gray-400 truncate">${t.member_note}</p>` : ''}
                      ${t.tag_expires_at ? `<p class="text-xs ${expired ? 'text-red-400' : expiredSoon ? 'text-orange-400' : 'text-gray-400'}">Expires ${formatDate(t.tag_expires_at)}</p>` : ''}
                    </div>
                    <button onclick="removeMemberTag('${member.id}', '${t.id}')" class="text-gray-300 hover:text-red-400 transition flex-shrink-0">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                  </div>`;
                }).join('') : ''}
                <button onclick="showAddTagModal('${member.id}')" class="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-gray-300 text-xs text-gray-500 hover:border-teal-400 hover:text-teal-600 transition">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
                  Add tag
                </button>
              </div>
            </div>

          </div>
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
            <div id="profile-tab-transactions" class="profile-tab-content hidden">${renderTransactionsTab(transactionsData, vouchers, memberId)}</div>
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
  if (!passes || passes.length === 0) {
    return `<div class="text-center py-10">
      <svg class="w-10 h-10 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"/></svg>
      <p class="text-gray-400 text-sm">No passes on this account</p>
    </div>`;
  }

  const activePasses = passes.filter(p => p.status === 'active');
  const otherPasses = passes.filter(p => p.status !== 'active');

  const renderPassCard = (p) => {
    const isActive = p.status === 'active';
    const isPaused = p.status === 'paused';
    const isCancelled = p.status === 'cancelled';
    const isExpired = p.status === 'expired';
    const now = new Date();
    const expiresAt = p.expires_at ? new Date(p.expires_at) : null;
    const issuedAt = p.issued_at || p.created_at;
    const expiringToday = expiresAt && expiresAt.toDateString() === now.toDateString();
    const expiringSoon = expiresAt && expiresAt > now && (expiresAt - now) < 7 * 24 * 60 * 60 * 1000;
    const pastExpiry = expiresAt && expiresAt < now;

    // Badge: square with visits count or ∞
    const badgeBg = isActive ? '#1E3A5F' : isPaused ? '#9CA3AF' : '#D1D5DB';
    const badgeText = p.visits_remaining !== null ? String(p.visits_remaining) : '∞';
    const badgeSubtext = p.visits_remaining !== null ? 'left' : '';

    // Date range line: "9 sep 2025 → no expiration" matching Beta
    const shortDate = (d) => {
      if (!d) return null;
      const dt = new Date(d);
      return dt.getDate() + ' ' + dt.toLocaleString('en-GB', { month: 'short' }).toLowerCase() + ' ' + dt.getFullYear();
    };
    const issuedStr = shortDate(issuedAt) || '—';
    const expiryStr = expiresAt
      ? (expiringToday ? '<span class="text-orange-500 font-semibold">today</span>'
        : expiringSoon && !pastExpiry ? `<span class="text-yellow-500">${shortDate(p.expires_at)}</span>`
        : `<span class="${pastExpiry ? 'text-red-400' : ''}">${shortDate(p.expires_at)}</span>`)
      : '<span class="text-gray-400">no expiration</span>';

    // Actions gear menu
    const gearMenuId = `pass-gear-${p.id}`;
    const gearActions = [];
    if (isActive && p.category !== 'single_entry') gearActions.push(`<button onclick="passAction('pause','${p.id}');document.getElementById('${gearMenuId}').classList.add('hidden')" class="w-full text-left px-4 py-2 text-sm hover:bg-gray-50">Pause</button>`);
    if (isActive && expiresAt) gearActions.push(`<button onclick="passAction('extend','${p.id}');document.getElementById('${gearMenuId}').classList.add('hidden')" class="w-full text-left px-4 py-2 text-sm hover:bg-gray-50">Extend</button>`);
    if (isPaused) gearActions.push(`<button onclick="passAction('unpause','${p.id}');document.getElementById('${gearMenuId}').classList.add('hidden')" class="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 text-blue-600 font-medium">Resume</button>`);
    if (isActive || isPaused) gearActions.push(`<button onclick="passAction('cancel','${p.id}');document.getElementById('${gearMenuId}').classList.add('hidden')" class="w-full text-left px-4 py-2 text-sm hover:bg-red-50 text-red-500">Cancel</button>`);

    const gearBtn = gearActions.length ? `
      <div class="relative">
        <button onclick="event.stopPropagation();const m=document.getElementById('${gearMenuId}');m.classList.toggle('hidden')" class="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
        </button>
        <div id="${gearMenuId}" class="hidden absolute right-0 top-8 bg-white border border-gray-200 rounded-xl shadow-xl z-10 w-36 overflow-hidden">
          ${gearActions.join('')}
        </div>
      </div>` : '';

    // Check-in arrow button (active passes only)
    const checkinBtn = isActive ? `
      <button onclick="quickCheckInFromProfile(window._currentProfileMemberId, '')" class="p-1.5 rounded-lg hover:bg-blue-50 text-[#1E3A5F] transition" title="Check in with this pass">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/></svg>
      </button>` : '';

    return `
      <div class="flex items-center gap-3 p-3 border border-gray-200 rounded-xl mb-2.5 ${isCancelled || isExpired ? 'opacity-50' : ''}">
        <!-- Square badge -->
        <div class="w-12 h-12 rounded-xl flex-shrink-0 flex flex-col items-center justify-center text-white font-bold" style="background:${badgeBg}">
          <span class="text-lg leading-none">${badgeText}</span>
          ${badgeSubtext ? `<span class="text-xs opacity-70">${badgeSubtext}</span>` : ''}
        </div>

        <!-- Pass info -->
        <div class="flex-1 min-w-0">
          <p class="text-sm font-semibold text-gray-900 truncate">${p.pass_name || 'Pass'}</p>
          ${isPaused ? `<span class="inline-block text-xs font-semibold text-red-500 bg-red-50 border border-red-200 rounded px-1.5 py-0.5 mb-0.5">subscription is paused</span>` : ''}
          <p class="text-xs text-gray-400">${issuedStr} → ${expiryStr}</p>
          ${p.is_peak !== null && p.is_peak !== undefined ? `<p class="text-xs ${p.is_peak ? 'text-amber-600' : 'text-blue-500'}">${p.is_peak ? 'Peak' : 'Off-peak'}</p>` : ''}
        </div>

        <!-- Actions -->
        <div class="flex items-center gap-1 flex-shrink-0">
          ${gearBtn}
          ${checkinBtn}
        </div>
      </div>`;
  };

  let html = '';
  if (activePasses.length) html += activePasses.map(renderPassCard).join('');
  if (otherPasses.length) {
    html += `<p class="text-xs uppercase font-bold text-gray-400 mt-4 mb-2">History</p>`;
    html += otherPasses.map(renderPassCard).join('');
  }
  return html;
}

async function passAction(action, passId) {
  const memberId = window._currentProfileMemberId;
  if (action === 'cancel') {
    if (!confirm('Cancel this pass? This cannot be undone.')) return;
    await api('POST', `/api/passes/${passId}/cancel`, { reason: 'Cancelled by staff' });
  } else if (action === 'pause') {
    const reason = prompt('Reason for pause (optional):') ?? '';
    await api('POST', `/api/passes/${passId}/pause`, { reason });
  } else if (action === 'unpause') {
    await api('POST', `/api/passes/${passId}/unpause`);
  } else if (action === 'extend') {
    const days = prompt('Extend by how many days?');
    if (!days || isNaN(days)) return;
    await api('POST', `/api/passes/${passId}/extend`, { days: parseInt(days) });
  }
  showToast('Pass updated', 'success');
  if (memberId) openMemberProfile(memberId);
}

function renderVisitsTab(visits) {
  if (!visits || visits.length === 0) {
    return `<div class="text-center py-10">
      <svg class="w-10 h-10 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
      <p class="text-gray-400 text-sm">No visit history yet</p>
    </div>`;
  }

  const methodLabel = { 'desk': 'Desk', 'qr_scan': 'QR Scan', 'pos': 'POS', 'app': 'App' };
  const methodColour = { 'desk': 'bg-blue-100 text-blue-700', 'qr_scan': 'bg-purple-100 text-purple-700', 'pos': 'bg-green-100 text-green-700', 'app': 'bg-indigo-100 text-indigo-700' };

  return `
    <div class="flex items-center justify-between mb-3">
      <p class="text-xs text-gray-400">${visits.length} visit${visits.length !== 1 ? 's' : ''} shown (most recent first)</p>
    </div>
    <div class="space-y-1">
      ${visits.map(v => {
        const dt = v.checked_in_at ? new Date(v.checked_in_at) : null;
        const date = dt ? dt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '—';
        const time = dt ? dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '';
        const method = v.method || 'desk';
        const mLabel = methodLabel[method] || method;
        const mColour = methodColour[method] || 'bg-gray-100 text-gray-600';
        const peak = v.is_peak !== null && v.is_peak !== undefined
          ? `<span class="text-xs ${v.is_peak ? 'text-amber-500' : 'text-blue-500'}">${v.is_peak ? 'Peak' : 'Off-peak'}</span>` : '';
        return `<div class="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-gray-50 transition">
          <div>
            <p class="text-sm font-medium text-gray-800">${date}</p>
            <div class="flex items-center gap-2 mt-0.5">
              <span class="text-xs text-gray-400">${time}</span>
              ${peak}
              <span class="text-xs text-gray-400">${v.pass_name || 'No pass'}</span>
            </div>
          </div>
          <span class="px-2 py-0.5 rounded-full text-xs font-medium ${mColour}">${mLabel}</span>
        </div>`;
      }).join('')}
    </div>`;
}

function renderEventsTab(events) {
  const memberId = window._currentProfileMemberId;
  const statusColour = { 'enrolled': 'bg-green-100 text-green-700', 'waitlisted': 'bg-yellow-100 text-yellow-700', 'cancelled': 'bg-gray-100 text-gray-500', 'attended': 'bg-blue-100 text-blue-700', 'no_show': 'bg-red-100 text-red-500' };

  const enrolBtn = memberId ? `<button onclick="enrolMemberInEvent('${memberId}')" class="flex items-center gap-1.5 px-3 py-1.5 bg-[#1E3A5F] text-white rounded-lg text-xs font-semibold hover:bg-[#2A4D7A] transition">
    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
    Book Event
  </button>` : '';

  const filterPills = `
    <div class="flex gap-1.5 flex-wrap mb-3">
      ${['all','enrolled','attended','no_show','cancelled'].map((f, i) => {
        const labels = { all: 'All', enrolled: 'Upcoming', attended: 'Attended', no_show: 'Missed', cancelled: 'Cancelled' };
        return `<button onclick="filterEventsTab('${f}')" data-events-filter="${f}" class="events-filter-pill px-2.5 py-1 rounded-full text-xs font-medium border transition ${i === 0 ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]' : 'bg-white text-gray-500 border-gray-300 hover:border-gray-400'}">${labels[f]}</button>`;
      }).join('')}
    </div>`;

  if (!events || events.length === 0) {
    return `${filterPills}<div class="text-center py-6">
      <p class="text-gray-400 text-sm mb-3">No events booked</p>
      ${enrolBtn}
    </div>`;
  }

  return `
    <div class="flex items-center justify-between mb-1">
      <span></span>${enrolBtn}
    </div>
    ${filterPills}
    <div class="space-y-2">
      ${events.map(e => {
        const dt = e.starts_at ? new Date(e.starts_at) : null;
        const dateStr = dt ? dt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '—';
        const isPast = dt && dt < new Date();
        const sc = statusColour[e.status] || 'bg-gray-100 text-gray-600';
        const canCancel = ['enrolled', 'waitlisted'].includes(e.status);
        return `<div data-event-card="${e.status}" class="flex items-center justify-between p-3 rounded-xl border border-gray-100 ${isPast ? 'opacity-70' : ''}">
          <div class="min-w-0">
            <p class="text-sm font-semibold text-gray-800 truncate">${e.event_name}</p>
            <p class="text-xs text-gray-400 mt-0.5">${dateStr}</p>
          </div>
          <div class="flex items-center gap-2 ml-2 flex-shrink-0">
            <span class="px-2 py-0.5 rounded-full text-xs font-medium ${sc}">${e.status}</span>
            ${canCancel ? `<button onclick="cancelEventEnrolment('${e.id}', '${e.event_name?.replace(/'/g, "\\'")}')" class="text-gray-300 hover:text-red-400 transition"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>` : ''}
          </div>
        </div>`;
      }).join('')}
    </div>`;
}

function filterEventsTab(filter) {
  document.querySelectorAll('.events-filter-pill').forEach(p => {
    const active = p.dataset.eventsFilter === filter;
    p.className = p.className.replace(/bg-\[#1E3A5F\] text-white border-\[#1E3A5F\]|bg-white text-gray-500 border-gray-300 hover:border-gray-400/g, '');
    p.className += active ? ' bg-[#1E3A5F] text-white border-[#1E3A5F]' : ' bg-white text-gray-500 border-gray-300 hover:border-gray-400';
  });
  document.querySelectorAll('[data-event-card]').forEach(card => {
    const status = card.dataset.eventCard;
    card.style.display = (filter === 'all' || filter === status) ? '' : 'none';
  });
}

async function enrolMemberInEvent(memberId) {
  try {
    const events = await api('GET', '/api/events?status=active&upcoming=true');
    const upcoming = (events.items || events || []).filter(e => new Date(e.starts_at) > new Date());

    showModal(`
      <div class="max-w-md mx-auto">
        <h3 class="text-lg font-bold text-gray-900 mb-4">Book Event</h3>
        ${upcoming.length === 0 ? '<p class="text-gray-400 text-sm py-4">No upcoming events available.</p>' : `
        <div class="space-y-2 max-h-80 overflow-y-auto">
          ${upcoming.map(e => {
            const dt = new Date(e.starts_at);
            const dateStr = dt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
            const timeStr = dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
            const spotsLeft = e.capacity ? e.capacity - (e.enrolled_count || 0) : null;
            const full = spotsLeft !== null && spotsLeft <= 0;
            return `<div class="flex items-center justify-between p-3 rounded-xl border ${full ? 'border-gray-100 opacity-60' : 'border-gray-200 hover:border-blue-300 cursor-pointer hover:bg-blue-50'} transition"
              ${full ? '' : `onclick="doEnrolMemberInEvent('${memberId}','${e.id}','${e.name?.replace(/'/g, "\\'")}')"`}>
              <div>
                <p class="text-sm font-semibold text-gray-800">${e.name}</p>
                <p class="text-xs text-gray-400">${dateStr} · ${timeStr}</p>
              </div>
              ${full ? `<span class="text-xs text-red-400 font-medium">Full</span>` : spotsLeft !== null ? `<span class="text-xs text-green-600 font-medium">${spotsLeft} left</span>` : `<span class="text-xs text-gray-400">Open</span>`}
            </div>`;
          }).join('')}
        </div>`}
        <div class="mt-4 text-right">
          <button onclick="closeModal()" class="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Close</button>
        </div>
      </div>
    `);
  } catch (err) {
    showToast('Error loading events: ' + err.message, 'error');
  }
}

async function doEnrolMemberInEvent(memberId, eventId, eventName) {
  try {
    await api('POST', `/api/events/${eventId}/enroll`, { member_id: memberId });
    showToast(`Booked into ${eventName}`, 'success');
    closeModal();
    openMemberProfile(memberId);
  } catch (err) {
    showToast('Booking failed: ' + err.message, 'error');
  }
}

async function cancelEventEnrolment(enrolmentId, eventName) {
  if (!confirm(`Cancel booking for ${eventName}?`)) return;
  try {
    await api('POST', `/api/events/enrolments/${enrolmentId}/cancel`);
    showToast('Booking cancelled', 'success');
    if (window._currentProfileMemberId) openMemberProfile(window._currentProfileMemberId);
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

function renderTransactionsTab(data, vouchers, memberId) {
  const transactions = data?.transactions || [];
  const totalPages = data?.totalPages || 1;
  const currentPage = data?.page || 1;
  const totalSpent = transactions.reduce((s, t) => s + (t.total_amount || 0), 0);

  const statusBadge = (status) => {
    if (status === 'completed') return `<span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">Succeeded</span>`;
    if (status === 'pending' || status === 'open') return `<span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-800 text-white">open</span>`;
    if (status === 'failed') return `<span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-600">Failed</span>`;
    if (status === 'refunded') return `<span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-600">Refunded</span>`;
    return `<span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">${status || '—'}</span>`;
  };

  const methodLabel = { 'dojo_card': 'Card', 'cash': 'Cash', 'voucher': 'Voucher', 'gift_card': 'Gift Card', 'other': 'Other', 'gocardless': 'GoCardless' };

  // Vouchers section
  const voucherHtml = `
    <div class="mb-3 border border-gray-200 rounded-xl overflow-hidden">
      <button onclick="toggleProfileSection('vouchers-section')" class="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition">
        <div class="flex items-center gap-2">
          <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"/></svg>
          <span class="text-sm font-semibold text-gray-700">Vouchers</span>
          <span class="px-2 py-0.5 rounded-full text-xs font-bold ${vouchers?.length ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}">${vouchers?.length || 0}</span>
        </div>
        <svg id="vouchers-section-chevron" class="w-4 h-4 text-gray-400 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
      </button>
      <div id="vouchers-section" class="hidden border-t border-gray-100">
        ${!vouchers?.length ? `<p class="text-xs text-gray-400 p-4 text-center">No vouchers</p>` :
          vouchers.map(v => `
            <div class="flex items-center justify-between px-4 py-2.5 border-b border-gray-50 last:border-0">
              <div>
                <p class="text-xs font-mono font-semibold text-gray-800">${v.code}</p>
                <p class="text-xs text-gray-400">Purchased ${formatDate(v.created_at)}</p>
              </div>
              <div class="text-right">
                <p class="text-sm font-bold ${v.current_balance > 0 ? 'text-green-600' : 'text-gray-400'}">£${parseFloat(v.current_balance || 0).toFixed(2)}</p>
                <p class="text-xs text-gray-400">of £${parseFloat(v.initial_balance || 0).toFixed(2)}</p>
              </div>
            </div>`).join('')}
      </div>
    </div>`;

  // History section
  const historyHtml = `
    <div class="border border-gray-200 rounded-xl overflow-hidden">
      <div class="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
        <div class="flex items-center gap-2">
          <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          <span class="text-sm font-semibold text-gray-700">History</span>
        </div>
        ${data?.total > 0 ? `<span class="text-xs text-gray-400">Total spent: <strong class="text-gray-700">£${totalSpent.toFixed(2)}</strong></span>` : ''}
      </div>

      ${transactions.length === 0 ? `<p class="text-xs text-gray-400 p-6 text-center">No transactions</p>` : `
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left text-xs text-gray-400 uppercase border-b border-gray-100 bg-gray-50/50">
              <th class="px-4 py-2">Date</th>
              <th class="px-4 py-2">Items</th>
              <th class="px-4 py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${transactions.map(t => {
              const dt = t.created_at ? new Date(t.created_at) : null;
              const dateStr = dt ? dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
              const timeStr = dt ? dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';
              const items = t.items || [];
              const itemsText = items.map(i => `${i.quantity > 1 ? i.quantity + '× ' : ''}${i.description}`).join(', ');
              const method = methodLabel[t.payment_method] || t.payment_method || '';
              return `<tr class="border-b border-gray-50 hover:bg-gray-50 transition">
                <td class="px-4 py-3">
                  <p class="text-xs font-medium text-gray-800 whitespace-nowrap">${dateStr}</p>
                  <p class="text-xs text-gray-400">${timeStr}</p>
                </td>
                <td class="px-4 py-3">
                  <p class="text-xs text-gray-700">${itemsText || '—'}</p>
                  <p class="text-xs text-gray-400">${method}</p>
                </td>
                <td class="px-4 py-3 text-right">
                  <p class="text-sm font-bold ${t.total_amount < 0 ? 'text-red-500' : 'text-gray-800'} whitespace-nowrap">£${Math.abs(t.total_amount || 0).toFixed(2)}</p>
                  <div class="flex justify-end mt-0.5">${statusBadge(t.payment_status)}</div>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>

        ${totalPages > 1 ? `
          <div class="flex items-center justify-center gap-2 px-4 py-3 border-t border-gray-100">
            <button onclick="loadProfileTransactions('${memberId}', ${currentPage - 1})" ${currentPage <= 1 ? 'disabled' : ''} class="w-7 h-7 flex items-center justify-center rounded-full border border-gray-300 text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">‹</button>
            ${Array.from({length: totalPages}, (_, i) => i + 1).map(p => `
              <button onclick="loadProfileTransactions('${memberId}', ${p})" class="w-7 h-7 flex items-center justify-center rounded-full text-xs font-semibold ${p === currentPage ? 'bg-[#1E3A5F] text-white' : 'border border-gray-300 text-gray-600 hover:bg-gray-100'}">${p}</button>
            `).join('')}
            <button onclick="loadProfileTransactions('${memberId}', ${currentPage + 1})" ${currentPage >= totalPages ? 'disabled' : ''} class="w-7 h-7 flex items-center justify-center rounded-full border border-gray-300 text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">›</button>
          </div>` : ''}
      `}
    </div>`;

  return voucherHtml + historyHtml;
}

async function loadProfileTransactions(memberId, page) {
  try {
    const [data, vouchers] = await Promise.all([
      api('GET', `/api/members/${memberId}/transactions?page=${page}&perPage=20`),
      api('GET', `/api/members/${memberId}/vouchers`),
    ]);
    document.getElementById('profile-tab-transactions').innerHTML = renderTransactionsTab(data, vouchers, memberId);
  } catch (e) { showToast('Error loading transactions', 'error'); }
}

function toggleProfileSection(id) {
  const section = document.getElementById(id);
  const chevron = document.getElementById(id + '-chevron');
  if (!section) return;
  section.classList.toggle('hidden');
  if (chevron) chevron.style.transform = section.classList.contains('hidden') ? '' : 'rotate(180deg)';
}

function toggleCommentForm() {
  document.getElementById('comment-form-container').classList.toggle('hidden');
}

function togglePhotoMenu(memberId) {
  const menu = document.getElementById('photo-menu-' + memberId);
  if (!menu) return;
  menu.classList.toggle('hidden');
  // Close on outside click
  setTimeout(() => {
    const close = (e) => { if (!menu.contains(e.target)) { menu.classList.add('hidden'); document.removeEventListener('click', close); } };
    document.addEventListener('click', close);
  }, 10);
}

async function uploadMemberPhoto(memberId, input) {
  if (!input.files[0]) return;
  const form = new FormData();
  form.append('photo', input.files[0]);
  try {
    showToast('Uploading photo...', 'info');
    const res = await fetch(`/api/members/${memberId}/photo`, { method: 'POST', body: form });
    const data = await res.json();
    if (data.success) { showToast('Photo updated', 'success'); openMemberProfile(memberId); }
    else showToast('Upload failed: ' + data.error, 'error');
  } catch (e) { showToast('Upload failed: ' + e.message, 'error'); }
}

async function showAddTagModal(memberId) {
  // Load tag types
  let tagTypes;
  try { tagTypes = await api('GET', '/api/members/tags/types'); }
  catch (e) {
    // fallback static list
    tagTypes = [
      { id: 'tag-warning', name: 'Warning', colour: '#F97316', tag_type: 'warning' },
      { id: 'tag-jr-assessed', name: 'Jr. Assessed', colour: '#10B981', tag_type: 'jr_assessed' },
      { id: 'tag-note', name: 'Note', colour: '#6B7280', tag_type: 'note' },
      { id: 'tag-student', name: 'Student', colour: '#6366F1', tag_type: 'student' },
    ];
  }

  const tagIcons = { warning: `<svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>`, jr_assessed: `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" stroke-width="2"/><circle cx="12" cy="12" r="4" stroke-width="2"/></svg>`, note: `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>`, student: `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 14l9-5-9-5-9 5 9 5z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"/></svg>` };

  const html = `
    <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-4" id="add-tag-overlay">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div class="flex items-center gap-2 mb-4">
          <svg class="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/></svg>
          <h3 class="text-base font-bold text-gray-900">Add A Tag & Proficiency</h3>
          <button onclick="document.getElementById('add-tag-overlay').remove()" class="ml-auto text-gray-400 hover:text-gray-600">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <p class="text-xs font-semibold text-gray-500 uppercase mb-2">Type</p>
        <div class="flex flex-wrap gap-2 mb-4" id="tag-type-pills">
          ${tagTypes.map((t, i) => `
            <button type="button" onclick="selectTagType('${t.id}', '${t.colour}')"
              data-tag-id="${t.id}"
              class="tag-type-pill flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border-2 transition ${i === 0 ? 'border-transparent text-white' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}"
              style="${i === 0 ? `background:${t.colour};` : ''}">
              ${tagIcons[t.tag_type] || ''}
              ${t.name}
            </button>`).join('')}
        </div>
        <input type="hidden" id="selected-tag-id" value="${tagTypes[0]?.id || ''}">
        <input type="hidden" id="selected-tag-colour" value="${tagTypes[0]?.colour || ''}">

        <textarea id="tag-note-input" class="form-input text-sm w-full mb-4" rows="3" placeholder="Note"></textarea>

        <div class="flex items-center gap-3 mb-3">
          <label class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" id="tag-expiry-toggle" class="sr-only peer" onchange="toggleTagExpiry()">
            <div class="w-10 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-teal-300 rounded-full peer peer-checked:bg-teal-500 transition"></div>
            <div class="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow peer-checked:translate-x-4 transition-transform"></div>
          </label>
          <span class="text-sm text-gray-600">expiration date</span>
        </div>

        <div id="tag-expiry-section" class="hidden mb-4">
          <div class="flex gap-2 flex-wrap mb-2">
            <button type="button" onclick="setTagExpiry(1)" class="px-3 py-1.5 rounded-full text-xs font-medium border border-gray-300 hover:bg-gray-50">1 Year Exp.</button>
            <button type="button" onclick="setTagExpiry(2)" class="px-3 py-1.5 rounded-full text-xs font-medium border border-gray-300 hover:bg-gray-50">2 Years Exp.</button>
            <button type="button" onclick="setTagExpiry(5)" class="px-3 py-1.5 rounded-full text-xs font-medium border border-gray-300 hover:bg-gray-50">5 Years Exp.</button>
          </div>
          <input type="date" id="tag-expiry-date" class="form-input text-sm w-full">
        </div>

        <button onclick="submitAddTag('${memberId}')" class="w-full py-2.5 bg-[#1E3A5F] hover:bg-[#2A4D7A] text-white font-semibold rounded-xl transition">Submit</button>
      </div>
    </div>`;

  document.body.insertAdjacentHTML('beforeend', html);
  // Select first tag by default
  if (tagTypes[0]) selectTagType(tagTypes[0].id, tagTypes[0].colour);
}

function selectTagType(tagId, colour) {
  document.getElementById('selected-tag-id').value = tagId;
  document.getElementById('selected-tag-colour').value = colour;
  document.querySelectorAll('.tag-type-pill').forEach(p => {
    const isSelected = p.dataset.tagId === tagId;
    p.style.background = isSelected ? colour : '';
    p.style.borderColor = isSelected ? colour : '';
    p.className = p.className.replace(/border-transparent text-white|border-gray-200 bg-white text-gray-600 hover:border-gray-300/g, '');
    p.className += isSelected ? ' border-transparent text-white' : ' border-gray-200 bg-white text-gray-600 hover:border-gray-300';
  });
}

function toggleTagExpiry() {
  const on = document.getElementById('tag-expiry-toggle').checked;
  document.getElementById('tag-expiry-section').classList.toggle('hidden', !on);
}

function setTagExpiry(years) {
  const d = new Date();
  d.setFullYear(d.getFullYear() + years);
  document.getElementById('tag-expiry-date').value = d.toISOString().slice(0, 10);
}

async function submitAddTag(memberId) {
  const tagId = document.getElementById('selected-tag-id').value;
  const note = document.getElementById('tag-note-input').value.trim();
  const expiryOn = document.getElementById('tag-expiry-toggle').checked;
  const expiresAt = expiryOn ? document.getElementById('tag-expiry-date').value : null;
  if (!tagId) return;
  try {
    await api('POST', `/api/members/${memberId}/tags`, { tag_id: tagId, note: note || null, expires_at: expiresAt });
    document.getElementById('add-tag-overlay')?.remove();
    showToast('Tag added', 'success');
    openMemberProfile(memberId);
  } catch (e) { showToast('Error: ' + e.message, 'error'); }
}

async function removeMemberTag(memberId, tagId) {
  if (!confirm('Remove this tag?')) return;
  try {
    await api('DELETE', `/api/members/${memberId}/tags/${tagId}`);
    showToast('Tag removed', 'success');
    openMemberProfile(memberId);
  } catch (e) { showToast('Error: ' + e.message, 'error'); }
}

async function toggleMemberWarning(memberId, enable) {
  let note = null;
  if (enable) {
    note = prompt('Warning note (optional — will show to all staff):') ?? '';
  }
  try {
    await api('POST', `/api/members/${memberId}/warning`, { has_warning: enable, warning_note: note });
    showToast(enable ? 'Warning flag set' : 'Warning removed', 'success');
    openMemberProfile(memberId);
  } catch (e) { showToast('Error: ' + e.message, 'error'); }
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

function validateRegistration(memberId) {
  requirePin('checkin', async (staff) => {
    try {
      await api('POST', `/api/members/${memberId}/validate-registration`);
      showToast(`Registration validated (by ${staff.first_name})`, 'success');
      await openMemberProfile(memberId);
    } catch (err) { showToast('Error: ' + err.message, 'error'); }
  }, 'Staff PIN', 'Validate registration (collect £3)');
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
        <a href="/api/members/${memberId}/qr-code?size=400" download="member-qr.png" class="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition text-center">Download</a>
        <button onclick="(async()=>{try{const r=await api('POST','/api/members/${memberId}/send-qr-email');showToast(r.success?'QR code emailed':'Email failed: '+(r.error||'Unknown'),'info');}catch(e){showToast('Email failed: '+e.message,'error');}})()" class="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition">Email QR</button>
      </div>
      <button onclick="openMemberProfile('${memberId}')" class="mt-3 text-sm text-gray-400 hover:text-gray-600">Back to profile</button>
    </div>
  `);
}

function editMemberModal(memberId) {
  requirePin('members_edit', (staff) => {
    _doEditMemberModal(memberId);
  }, 'Manager PIN', 'Editing profiles requires manager access');
}

async function _doEditMemberModal(memberId, activeTab = 'edit') {
  const m = await api('GET', `/api/members/${memberId}`);
  if (!m) return;

  document.getElementById('modal-content').className = 'bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto';

  const tabs = [
    { id: 'edit', label: 'Edit' },
    { id: 'merge', label: 'Merge Profile' },
    { id: 'family', label: 'Family Members' },
  ];

  const tabNav = tabs.map(t => `
    <button onclick="editModalTab('${memberId}', '${t.id}')" id="edit-tab-${t.id}"
      class="px-4 py-3 text-sm font-medium border-b-2 transition ${t.id === activeTab ? 'border-[#1E3A5F] text-[#1E3A5F]' : 'border-transparent text-gray-500 hover:text-gray-700'}">
      ${t.label}
    </button>`).join('');

  // DOB dropdowns
  const dobDate = m.date_of_birth ? new Date(m.date_of_birth) : null;
  const dobDay = dobDate ? dobDate.getUTCDate() : '';
  const dobMonth = dobDate ? dobDate.getUTCMonth() + 1 : '';
  const dobYear = dobDate ? dobDate.getUTCFullYear() : '';
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const dayOpts = ['<option value="">Day</option>', ...Array.from({length:31},(_,i)=>`<option value="${i+1}" ${dobDay===i+1?'selected':''}>${i+1}</option>`)].join('');
  const monthOpts = ['<option value="">Month</option>', ...months.map((mo,i)=>`<option value="${i+1}" ${dobMonth===i+1?'selected':''}>${mo}</option>`)].join('');
  const currentYear = new Date().getFullYear();
  const yearOpts = ['<option value="">Year</option>', ...Array.from({length:100},(_,i)=>currentYear-i).map(y=>`<option value="${y}" ${dobYear===y?'selected':''}>${y}</option>`)].join('');

  const editFormHtml = `
    <div class="flex items-center gap-2 mb-4">
      <svg class="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
      <span class="text-sm font-bold text-gray-700">Edit Profile</span>
    </div>
    <form id="edit-member-form" onsubmit="updateMember(event, '${m.id}')">
      <div class="space-y-3">
        <div>
          <label class="block text-xs font-semibold text-[#1E3A5F] mb-1">First Name</label>
          <div class="relative">
            <input type="text" name="first_name" class="form-input pr-10" value="${m.first_name || ''}" required oninput="checkEditDuplicate('${m.id}', this)">
            <span id="edit-dupe-badge" class="hidden absolute right-2 top-1/2 -translate-y-1/2 px-1.5 py-0.5 bg-red-500 text-white text-xs font-bold rounded cursor-pointer" onclick="editModalTab('${m.id}', 'merge')" title="Possible duplicate — click to merge">···</span>
          </div>
        </div>
        <div>
          <label class="block text-xs font-semibold text-[#1E3A5F] mb-1">Middle Name</label>
          <input type="text" name="middle_name" class="form-input" value="${m.middle_name || ''}">
        </div>
        <div>
          <label class="block text-xs font-semibold text-[#1E3A5F] mb-1">Last Name</label>
          <input type="text" name="last_name" class="form-input" value="${m.last_name || ''}" required>
        </div>
        <div>
          <label class="block text-xs font-semibold text-[#1E3A5F] mb-1">Telephone</label>
          <div class="relative">
            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-sm">🇬🇧</span>
            <input type="tel" name="phone" class="form-input pl-9" value="${m.phone || ''}">
            <svg class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
          </div>
        </div>
        <div>
          <label class="block text-xs font-semibold text-[#1E3A5F] mb-1">Address</label>
          <textarea name="address_line1" class="form-input" rows="2" placeholder="1 Dunstan Close, Penryn, Cornwall, TR10 8RY">${[m.address_line1, m.address_line2, m.city, m.region, m.postal_code].filter(Boolean).join(', ')}</textarea>
        </div>
        <div>
          <label class="block text-xs font-semibold text-[#1E3A5F] mb-1">Email *</label>
          <input type="email" name="email" class="form-input" value="${m.email || ''}" required>
        </div>
        <div>
          <label class="block text-xs font-semibold text-[#1E3A5F] mb-1">Gender</label>
          <select name="gender" class="form-select">
            <option value="">—</option>
            <option value="male" ${m.gender==='male'?'selected':''}>Male</option>
            <option value="female" ${m.gender==='female'?'selected':''}>Female</option>
            <option value="other" ${m.gender==='other'?'selected':''}>Other</option>
            <option value="prefer_not_to_say" ${m.gender==='prefer_not_to_say'?'selected':''}>Prefer not to say</option>
          </select>
        </div>
        <div>
          <label class="block text-xs font-semibold text-[#1E3A5F] mb-1">Date of Birth</label>
          <div class="grid grid-cols-3 gap-2">
            <select name="dob_day" class="form-select text-sm">${dayOpts}</select>
            <select name="dob_month" class="form-select text-sm">${monthOpts}</select>
            <select name="dob_year" class="form-select text-sm">${yearOpts}</select>
          </div>
          <p class="text-xs text-gray-400 mt-1">birthdate</p>
        </div>
        <div>
          <label class="block text-xs font-semibold text-[#1E3A5F] mb-1">Emergency Contact</label>
          <div class="grid grid-cols-2 gap-2">
            <input type="text" name="emergency_contact_name" class="form-input" placeholder="Name" value="${m.emergency_contact_name || ''}">
            <input type="tel" name="emergency_contact_phone" class="form-input" placeholder="Phone" value="${m.emergency_contact_phone || ''}">
          </div>
        </div>
        <div>
          <label class="block text-xs font-semibold text-[#1E3A5F] mb-1">Medical Conditions</label>
          <input type="text" name="medical_conditions" class="form-input" value="${m.medical_conditions || ''}">
        </div>
        <div>
          <label class="block text-xs font-semibold text-[#1E3A5F] mb-1">Notes</label>
          <textarea name="notes" class="form-input" rows="2">${m.notes || ''}</textarea>
        </div>
      </div>
      <div class="flex justify-end mt-5">
        <button type="submit" class="btn btn-primary px-6">Submit</button>
      </div>
    </form>`;

  const fullName = `${m.first_name} ${m.last_name}`;
  const dob = m.date_of_birth ? formatDate(m.date_of_birth) : '—';
  const colour = nameToColour(m.first_name + m.last_name);
  const initials = ((m.first_name||'')[0]||'') + ((m.last_name||'')[0]||'');

  const mergeHtml = `
    <div>
      <h3 class="text-base font-bold text-gray-900 mb-2">Merge Profile</h3>
      <p class="text-sm text-gray-600 mb-4 leading-relaxed">DANGER! Running this function will delete this profile and map all sessions, passes, transactions, and events to the target profile. You can only run this function when you have admin rights over both this profile and the target profile, otherwise you will need to submit a help request.</p>

      <div class="flex items-center gap-3 mb-5">
        <label class="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" id="merge-understand-toggle" class="sr-only peer" onchange="onMergeToggle(this.checked)">
          <div class="w-11 h-6 bg-gray-300 rounded-full peer peer-checked:bg-blue-500 transition"></div>
          <div class="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow peer-checked:translate-x-5 transition-transform"></div>
        </label>
        <span class="text-sm font-medium text-blue-600">I understand</span>
      </div>

      <div id="merge-action-area" class="opacity-30 pointer-events-none transition-opacity">
        <div class="grid grid-cols-[1fr_auto_1fr] gap-3 items-start mb-2">

          <div>
            <p class="text-sm font-bold text-gray-800 mb-1">Incorrect Profile</p>
            <p class="text-xs text-gray-400 mb-3">This profile will be permanently deleted. All passes, events, visits, purchases, and forms will be transferred to the target profile. This cannot be undone.</p>
            <div class="flex items-center gap-2 p-2.5 border border-gray-200 rounded-xl">
              ${m.photo_url ? `<img src="${m.photo_url}" class="w-11 h-11 rounded-lg object-cover flex-shrink-0">` : `<div class="w-11 h-11 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0" style="background:${colour}">${initials}</div>`}
              <div class="min-w-0 flex-1">
                <p class="text-xs font-bold text-gray-900">${fullName.toUpperCase()}</p>
                <p class="text-xs text-gray-400 truncate">${m.email || '—'}</p>
                <p class="text-xs text-gray-400">${dob}</p>
              </div>
              <svg class="w-4 h-4 text-orange-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
            </div>
          </div>

          <div class="flex flex-col items-center justify-center pt-14 gap-2">
            <span class="text-xl font-bold text-gray-400">&raquo;</span>
          </div>

          <div>
            <p class="text-sm font-bold text-gray-800 mb-1">Target Profile</p>
            <p class="text-xs text-gray-400 mb-3">This profile will get all passes, events, visits, purchases, and forms from the profile to delete.</p>
            <div id="merge-target-area">
              <div class="relative">
                <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                <input type="text" id="merge-target-search" class="form-input pl-9 text-sm" placeholder="Search" oninput="searchMergeTarget('${m.id}', this.value)">
              </div>
              <p class="text-xs text-blue-400 mt-1 text-center">Enter at least 3 characters to search</p>
              <div id="merge-target-results" class="mt-2 border border-gray-200 rounded-xl overflow-hidden max-h-40 overflow-y-auto hidden"></div>
            </div>
          </div>
        </div>

        <div class="flex justify-end mb-4">
          <button type="button" onclick="swapMergeProfiles('${m.id}')" class="text-xs px-3 py-1.5 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition">Swap</button>
        </div>

        <input type="hidden" id="merge-target-id">
        <input type="hidden" id="merge-source-id" value="${m.id}">

        <div id="merge-preview-section" class="hidden mt-2">
          <button type="button" onclick="toggleMergePreview()" class="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm mb-3 transition">Merged Profile</button>
          <div id="merge-preview-content" class="hidden border border-gray-200 rounded-xl p-4 space-y-1.5 text-sm mb-4"></div>
          <button id="merge-submit-btn" onclick="submitMergeProfile()" disabled
            class="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition text-sm">
            Merge profile
          </button>
        </div>
      </div>
    </div>`;
  const familyHtml = `<div id="family-section-content"><p class="text-sm text-gray-400 text-center py-8">Loading family members...</p></div>`;

  const tabContent = { edit: editFormHtml, merge: mergeHtml, family: familyHtml };

  showModal(`
    <div class="p-6">
      <div class="flex items-center justify-between mb-1">
        <h3 class="text-lg font-bold text-gray-900">${fullName}</h3>
        <button onclick="openMemberProfile('${m.id}')" class="text-gray-400 hover:text-gray-600">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="flex border-b border-gray-200 mb-5">${tabNav}</div>
      <div id="edit-modal-tab-content">${tabContent[activeTab]}</div>
    </div>
  `);

  if (activeTab === 'family') loadFamilyTab(memberId);
}

function editModalTab(memberId, tab) {
  // Re-render with new active tab
  _doEditMemberModal(memberId, tab);
}

function onMergeToggle(checked) {
  const area = document.getElementById('merge-action-area');
  area.classList.toggle('opacity-30', !checked);
  area.classList.toggle('pointer-events-none', !checked);
  const btn = document.getElementById('merge-submit-btn');
  if (btn) btn.disabled = !checked;
}

let _mergeSearchTimer = null;
async function searchMergeTarget(excludeId, query) {
  clearTimeout(_mergeSearchTimer);
  const resultsEl = document.getElementById('merge-target-results');
  if (!query || query.length < 3) { resultsEl.classList.add('hidden'); return; }
  resultsEl.classList.remove('hidden');
  _mergeSearchTimer = setTimeout(async () => {
    try {
      const members = await api('GET', `/api/members/search?q=${encodeURIComponent(query)}&limit=10`);
      const list = (members.members || members || []).filter(m => m.id !== excludeId);
      if (!list.length) { resultsEl.innerHTML = '<p class="text-xs text-gray-400 p-3 text-center">No results</p>'; return; }
      resultsEl.innerHTML = list.map(mem => {
        const name = `${mem.first_name} ${mem.last_name}`;
        const dob = mem.date_of_birth ? formatDate(mem.date_of_birth) : '';
        const colour = nameToColour(name);
        const initials = ((mem.first_name||'')[0]||'') + ((mem.last_name||'')[0]||'');
        const enc = encodeURIComponent(JSON.stringify({id:mem.id,photo_url:mem.photo_url||null,first_name:mem.first_name,last_name:mem.last_name,email:mem.email,date_of_birth:mem.date_of_birth,gender:mem.gender,phone:mem.phone,address_line1:mem.address_line1,city:mem.city,region:mem.region,postal_code:mem.postal_code}));
        return `<button type="button" onclick="selectMergeTarget(decodeURIComponent('${enc}'))"
          class="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-gray-50 border-b border-gray-50 last:border-0 text-left transition">
          ${mem.photo_url ? `<img src="${mem.photo_url}" class="w-9 h-9 rounded-lg object-cover flex-shrink-0">` : `<div class="w-9 h-9 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style="background:${colour}">${initials}</div>`}
          <div class="min-w-0 flex-1">
            <p class="text-xs font-bold text-gray-800">${name.toUpperCase()}</p>
            <p class="text-xs text-gray-400 truncate">${mem.email || '—'} ${dob ? '· ' + dob : ''}</p>
          </div>
        </button>`;
      }).join('');
    } catch (e) { resultsEl.innerHTML = '<p class="text-xs text-red-400 p-3 text-center">Search error</p>'; }
  }, 300);
}

function selectMergeTarget(jsonStr) {
  const t = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
  document.getElementById('merge-target-id').value = t.id;

  // Replace the search box area with the selected profile card
  const area = document.getElementById('merge-target-area');
  const colour = nameToColour(`${t.first_name}${t.last_name}`);
  const initials = ((t.first_name||'')[0]||'') + ((t.last_name||'')[0]||'');
  const dob = t.date_of_birth ? formatDate(t.date_of_birth) : '—';
  area.innerHTML = `
    <div class="flex items-center gap-2 p-2.5 border border-blue-200 bg-blue-50 rounded-xl">
      ${t.photo_url ? `<img src="${t.photo_url}" class="w-11 h-11 rounded-lg object-cover flex-shrink-0">` : `<div class="w-11 h-11 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0" style="background:${colour}">${initials}</div>`}
      <div class="min-w-0 flex-1">
        <p class="text-xs font-bold text-gray-900">${(t.first_name + ' ' + t.last_name).toUpperCase()}</p>
        <p class="text-xs text-gray-400 truncate">${t.email || '—'}</p>
        <p class="text-xs text-gray-400">${dob}</p>
      </div>
      <button type="button" onclick="resetMergeTargetSearch('${document.getElementById('merge-source-id')?.value}')" class="text-gray-300 hover:text-gray-500 flex-shrink-0">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
    </div>`;

  // Show merged profile preview
  buildMergePreview(t);
  document.getElementById('merge-preview-section').classList.remove('hidden');
  document.getElementById('merge-submit-btn').disabled = false;
}

function resetMergeTargetSearch(sourceId) {
  document.getElementById('merge-target-id').value = '';
  document.getElementById('merge-preview-section').classList.add('hidden');
  const area = document.getElementById('merge-target-area');
  area.innerHTML = `
    <div class="relative">
      <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
      <input type="text" id="merge-target-search" class="form-input pl-9 text-sm" placeholder="Search" oninput="searchMergeTarget('${sourceId}', this.value)">
    </div>
    <p class="text-xs text-blue-400 mt-1 text-center">Enter at least 3 characters to search</p>
    <div id="merge-target-results" class="mt-2 border border-gray-200 rounded-xl overflow-hidden max-h-40 overflow-y-auto hidden"></div>`;
}

function buildMergePreview(target) {
  const el = document.getElementById('merge-preview-content');
  const row = (icon, text) => text ? `<div class="flex items-center gap-2 text-gray-700"><span class="text-gray-400 w-4 flex-shrink-0">${icon}</span><span class="text-sm">${text}</span></div>` : '';
  const dob = target.date_of_birth ? formatDate(target.date_of_birth) : null;
  const addr = [target.address_line1, target.city, target.region, target.postal_code].filter(Boolean).join(', ');
  el.innerHTML = `
    <div class="flex items-center gap-2 mb-3">
      <div class="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-400 flex-shrink-0">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
      </div>
      <p class="font-semibold text-gray-800">${target.first_name} ${target.last_name}</p>
    </div>
    ${row('📅', dob ? `${dob}` : null)}
    ${row('⚥', target.gender || null)}
    ${row('✉', target.email || null)}
    ${row('📞', target.phone || null)}
    ${row('📍', addr || null)}`;
}

function toggleMergePreview() {
  const el = document.getElementById('merge-preview-content');
  el.classList.toggle('hidden');
}

function swapMergeProfiles(originalSourceId) {
  const targetId = document.getElementById('merge-target-id').value;
  if (!targetId) { showToast('Select a target profile first', 'error'); return; }
  // Reload the merge tab but with source swapped to target
  showToast('Swap: re-open this member\'s profile and use Edit → Merge from there', 'info');
}

async function submitMergeProfile() {
  const sourceId = document.getElementById('merge-source-id').value;
  const targetId = document.getElementById('merge-target-id').value;
  if (!targetId) { showToast('Select a target profile first', 'error'); return; }
  if (!confirm(`This will permanently delete the source profile and move everything to the target. This cannot be undone. Continue?`)) return;
  try {
    await api('POST', `/api/members/${sourceId}/merge`, { target_id: targetId });
    showToast('Profiles merged', 'success');
    closeModal();
    openMemberProfile(targetId);
  } catch (e) { showToast('Merge failed: ' + e.message, 'error'); }
}

async function loadFamilyTab(memberId) {
  try {
    const data = await api('GET', `/api/members/${memberId}/family`);
    const el = document.getElementById('family-section-content');
    if (!el) return;
    const { parents = [], children = [] } = data;
    const renderRow = (m, rel, canRemove) => {
      const fullName = `${m.first_name} ${m.last_name}`;
      const age = m.date_of_birth ? Math.floor((Date.now() - new Date(m.date_of_birth)) / (365.25*24*60*60*1000)) : null;
      return `<div class="flex items-center gap-3 p-3 border border-gray-100 rounded-xl hover:bg-gray-50 transition">
        <div class="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0" style="background:${nameToColour(fullName)}">${(m.first_name[0]||'')+(m.last_name[0]||'')}</div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-semibold text-gray-800">${fullName}</p>
          <p class="text-xs text-gray-400">${rel}${age !== null ? ' · Age ' + age : ''}</p>
        </div>
        <button onclick="openMemberProfile('${m.id}')" class="text-xs text-blue-600 hover:underline">View</button>
        ${canRemove ? `<button onclick="removeFamilyLink('${memberId}', '${m.id}')" class="text-gray-300 hover:text-red-400 ml-1"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>` : ''}
      </div>`;
    };
    el.innerHTML = `
      ${parents.length ? `<p class="text-xs font-bold text-gray-400 uppercase mb-2">Parents / Guardians</p><div class="space-y-2 mb-4">${parents.map(p => renderRow(p, p.relationship || 'Parent', true)).join('')}</div>` : ''}
      ${children.length ? `<p class="text-xs font-bold text-gray-400 uppercase mb-2">Children / Dependants</p><div class="space-y-2 mb-4">${children.map(c => renderRow(c, c.relationship || 'Child', true)).join('')}</div>` : ''}
      ${!parents.length && !children.length ? `<p class="text-sm text-gray-400 text-center py-4 mb-4">No family links yet</p>` : ''}
      <div class="border-t border-gray-100 pt-4">
        <p class="text-xs font-bold text-gray-500 uppercase mb-2">Link Family Member</p>
        <div class="flex gap-2">
          <input type="text" id="family-link-search" class="form-input flex-1 text-sm" placeholder="Search by name..." oninput="searchFamilyLink('${memberId}', this.value)">
        </div>
        <div id="family-link-results" class="mt-2 border border-gray-200 rounded-xl overflow-hidden max-h-40 overflow-y-auto hidden"></div>
      </div>`;
  } catch (e) { document.getElementById('family-section-content').innerHTML = '<p class="text-xs text-red-400 p-4 text-center">Error loading family</p>'; }
}

let _familySearchTimer = null;
async function searchFamilyLink(memberId, query) {
  clearTimeout(_familySearchTimer);
  const el = document.getElementById('family-link-results');
  if (!query || query.length < 2) { el.classList.add('hidden'); return; }
  _familySearchTimer = setTimeout(async () => {
    el.classList.remove('hidden');
    try {
      const members = await api('GET', `/api/members/search?q=${encodeURIComponent(query)}&limit=8`);
      const list = (members.members || members || []).filter(m => m.id !== memberId);
      el.innerHTML = list.length ? list.map(m => {
        const name = `${m.first_name} ${m.last_name}`;
        return `<button type="button" onclick="addFamilyLink('${memberId}', '${m.id}', '${name.replace(/'/g,"\\'")}')"
          class="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 border-b border-gray-50 last:border-0 text-left">
          <div class="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style="background:${nameToColour(name)}">${name[0]||''}</div>
          <div class="min-w-0 flex-1"><p class="text-sm font-medium text-gray-800">${name}</p><p class="text-xs text-gray-400">${m.email || ''}</p></div>
          <svg class="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
        </button>`;
      }).join('') : '<p class="text-xs text-gray-400 p-3 text-center">No results</p>';
    } catch(e) { el.innerHTML = '<p class="text-xs text-red-400 p-3 text-center">Search error</p>'; }
  }, 300);
}

async function addFamilyLink(parentId, childId, childName) {
  try {
    await api('POST', `/api/members/${parentId}/family`, { child_id: childId });
    showToast(`Linked ${childName}`, 'success');
    loadFamilyTab(parentId);
    document.getElementById('family-link-search').value = '';
    document.getElementById('family-link-results').classList.add('hidden');
  } catch(e) { showToast('Error: ' + e.message, 'error'); }
}

async function removeFamilyLink(memberId, linkedId) {
  if (!confirm('Remove this family link?')) return;
  try {
    await api('DELETE', `/api/members/${memberId}/family/${linkedId}`);
    showToast('Link removed', 'success');
    loadFamilyTab(memberId);
  } catch(e) { showToast('Error: ' + e.message, 'error'); }
}

async function updateMember(e, memberId) {
  e.preventDefault();
  const form = document.getElementById('edit-member-form');
  const raw = Object.fromEntries(new FormData(form));

  // Reconstruct DOB from dropdowns
  if (raw.dob_day && raw.dob_month && raw.dob_year) {
    const d = String(raw.dob_day).padStart(2,'0');
    const mo = String(raw.dob_month).padStart(2,'0');
    raw.date_of_birth = `${raw.dob_year}-${mo}-${d}`;
  }
  delete raw.dob_day; delete raw.dob_month; delete raw.dob_year;

  // address_line1 is the combined address textarea — don't touch city/region/postal_code
  // (they're not in the form, so they won't appear in raw, and the model only updates
  //  fields that are present in the payload — so they'll be left unchanged in the DB)

  try {
    await api('PUT', `/api/members/${memberId}`, raw);
    showToast('Saved', 'success');
    await openMemberProfile(memberId);
  } catch (err) { showToast('Error: ' + err.message, 'error'); }
}

let _dupeCheckTimer = null;
async function checkEditDuplicate(currentId, input) {
  clearTimeout(_dupeCheckTimer);
  const badge = document.getElementById('edit-dupe-badge');
  if (!badge || !input.value || input.value.length < 2) { badge?.classList.add('hidden'); return; }
  _dupeCheckTimer = setTimeout(async () => {
    try {
      const lastName = document.querySelector('#edit-member-form [name=last_name]')?.value || '';
      const q = input.value + (lastName ? ' ' + lastName : '');
      const res = await api('GET', `/api/members/search?q=${encodeURIComponent(q)}&limit=5`);
      const dupes = (res.members || res || []).filter(m => m.id !== currentId);
      badge.classList.toggle('hidden', dupes.length === 0);
    } catch(e) { badge.classList.add('hidden'); }
  }, 500);
}

// ============================================================
// New Member Modal
// ============================================================

function showNewMemberModal() {
  document.getElementById('modal-content').className = 'bg-white rounded-xl shadow-2xl max-w-lg w-full mx-4 max-h-[92vh] overflow-y-auto';

  showModal(`
    <div class="p-6">
      <div class="flex items-center justify-between mb-5">
        <div>
          <h3 class="text-xl font-bold text-gray-900">New Member</h3>
          <p class="text-sm text-gray-400 mt-0.5">Quick desk registration</p>
        </div>
        <button onclick="closeModal()" class="text-gray-400 hover:text-gray-600">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>

      <form id="new-member-form" onsubmit="createMember(event)" novalidate>

        <!-- Name row -->
        <div class="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">First Name <span class="text-red-400">*</span></label>
            <input type="text" name="first_name" class="form-input" placeholder="Jane" required autofocus>
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Last Name <span class="text-red-400">*</span></label>
            <input type="text" name="last_name" class="form-input" placeholder="Smith" required>
          </div>
        </div>

        <!-- Contact row -->
        <div class="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Email</label>
            <input type="email" name="email" class="form-input" placeholder="jane@example.com">
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Phone</label>
            <input type="tel" name="phone" class="form-input" placeholder="07700 900000">
          </div>
        </div>

        <!-- DOB + Gender -->
        <div class="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Date of Birth</label>
            <input type="date" name="date_of_birth" class="form-input" onchange="newMemberCheckAge(this)">
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Gender</label>
            <select name="gender" class="form-select">
              <option value="">—</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
            </select>
          </div>
        </div>

        <!-- Under-18 warning -->
        <div id="new-member-minor-warning" class="hidden mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p class="text-sm text-blue-800 font-semibold">Under 18 — minor waiver required</p>
          <p class="text-xs text-blue-600 mt-0.5">Ensure a parent/guardian completes the minor waiver before climbing.</p>
        </div>

        <!-- Emergency contact -->
        <div class="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Emergency Contact</label>
            <input type="text" name="emergency_contact_name" class="form-input" placeholder="Name">
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Emergency Phone</label>
            <input type="tel" name="emergency_contact_phone" class="form-input" placeholder="07700 900000">
          </div>
        </div>

        <!-- Medical -->
        <div class="mb-4">
          <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Medical Conditions</label>
          <input type="text" name="medical_conditions" class="form-input" placeholder="None, or describe...">
        </div>

        <!-- Waiver note -->
        <div class="mb-5 p-3 bg-amber-50 border border-amber-200 rounded-lg flex gap-2">
          <svg class="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          <p class="text-xs text-amber-800">Member will need to complete the waiver and induction video before climbing. You can send them the registration link, or they can use a kiosk tablet.</p>
        </div>

        <div class="flex gap-2">
          <button type="button" onclick="closeModal()" class="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
          <button type="submit" id="new-member-submit" class="flex-1 py-2.5 bg-[#1E3A5F] text-white rounded-lg text-sm font-semibold hover:bg-[#2A4D7A] transition flex items-center justify-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/></svg>
            Register Member
          </button>
        </div>
      </form>
    </div>
  `);
}

function newMemberCheckAge(input) {
  const dob = new Date(input.value);
  const age = Math.floor((Date.now() - dob) / (365.25 * 24 * 60 * 60 * 1000));
  const warning = document.getElementById('new-member-minor-warning');
  if (warning) warning.classList.toggle('hidden', age >= 18 || isNaN(age));
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

async function sendPortalInvite(memberId) {
  try {
    await api('POST', `/api/me/invite/${memberId}`);
    showToast('Portal link sent to member\'s email', 'success');
  } catch (err) {
    showToast('Failed to send: ' + err.message, 'error');
  }
}

async function createMember(e) {
  e.preventDefault();
  const form = document.getElementById('new-member-form');
  const data = Object.fromEntries(new FormData(form));

  if (!data.first_name?.trim() || !data.last_name?.trim()) {
    showToast('First and last name are required', 'error');
    return;
  }

  const btn = document.getElementById('new-member-submit');
  if (btn) { btn.disabled = true; btn.textContent = 'Registering...'; }

  try {
    const member = await api('POST', '/api/members', data);
    const fullName = `${member.first_name} ${member.last_name}`;

    // Show post-registration action modal
    document.getElementById('modal-content').className = 'bg-white rounded-xl shadow-2xl max-w-sm w-full mx-4';
    document.getElementById('modal-content').innerHTML = `
      <div class="p-6 text-center">
        <div class="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
          <svg class="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
        </div>
        <h3 class="text-lg font-bold text-gray-900">${fullName} registered</h3>
        <p class="text-sm text-gray-500 mt-1 mb-5">Member ID created. Waiver still needed before climbing.</p>
        <div class="space-y-2">
          <button onclick="closeModal(); openMemberProfile('${member.id}')" class="w-full py-2.5 bg-[#1E3A5F] text-white rounded-lg text-sm font-semibold hover:bg-[#2A4D7A] transition">View Profile</button>
          <button onclick="closeModal(); openPOSForMemberWithPin('${member.id}', '${fullName.replace(/'/g, "\\'")}')" class="w-full py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">Open in POS</button>
          ${member.email ? `<button onclick="newMemberSendPortalLink('${member.id}', '${member.email}')" id="send-portal-btn" class="w-full py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">Send Registration Link</button>` : ''}
          <button onclick="closeModal()" class="w-full py-2 text-sm text-gray-400 hover:text-gray-600">Done</button>
        </div>
      </div>
    `;

    // Refresh whichever page is active
    if (document.getElementById('page-members')?.classList.contains('active')) refreshMembersList().catch(() => {});
    if (document.getElementById('page-dashboard')?.classList.contains('active')) {
      const q = document.getElementById('dashboard-search')?.value;
      if (q && q.length >= 3) dashboardSearch(q).catch(() => {});
    }
  } catch (err) {
    if (btn) { btn.disabled = false; btn.textContent = 'Register Member'; }
    showToast('Error: ' + err.message, 'error');
  }
}

async function newMemberSendPortalLink(memberId, email) {
  const btn = document.getElementById('send-portal-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Sending...'; }
  try {
    await api('POST', `/api/register/send-link`, { member_id: memberId, email });
    if (btn) { btn.textContent = 'Sent!'; btn.className = btn.className.replace('text-gray-700', 'text-green-600'); }
    showToast('Registration link sent to ' + email, 'success');
  } catch (err) {
    if (btn) { btn.disabled = false; btn.textContent = 'Send Registration Link'; }
    showToast('Send failed: ' + err.message, 'error');
  }
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
// Cache of DB walls for the routes page — loaded fresh each time loadRoutes() runs
let _routeWallsCache = [];

// Distribute points evenly along a polyline
function getPointsAlongPolyline(points, numPoints) {
  if (!points || points.length < 2 || numPoints < 1) return [];
  // Calculate total length
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i][0] - points[i-1][0], dy = points[i][1] - points[i-1][1];
    total += Math.sqrt(dx*dx + dy*dy);
  }
  const result = [];
  for (let n = 0; n < numPoints; n++) {
    let target = (total / (numPoints + 1)) * (n + 1);
    let rem = target;
    for (let i = 1; i < points.length; i++) {
      const dx = points[i][0] - points[i-1][0], dy = points[i][1] - points[i-1][1];
      const segLen = Math.sqrt(dx*dx + dy*dy);
      if (rem <= segLen || i === points.length - 1) {
        const t = segLen > 0 ? Math.min(rem / segLen, 1) : 0;
        result.push({ x: Math.round((points[i-1][0] + t*dx) * 10) / 10, y: Math.round((points[i-1][1] + t*dy) * 10) / 10 });
        break;
      }
      rem -= segLen;
    }
  }
  return result;
}

async function autoDistributeClimbs(climbs, walls) {
  const wallMap = {};
  (walls || _routeWallsCache).forEach(w => { wallMap[w.id] = w; });
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
    const wall = wallMap[wallId];
    if (!wall || !wall.path_json || wall.path_json.length < 2) continue;
    const wallClimbs = missing[wallId];
    const pts = getPointsAlongPolyline(wall.path_json, wallClimbs.length);
    for (let i = 0; i < wallClimbs.length; i++) {
      wallClimbs[i].map_x = pts[i]?.x ?? 400;
      wallClimbs[i].map_y = pts[i]?.y ?? 300;
      positions.push({ id: wallClimbs[i].id, map_x: wallClimbs[i].map_x, map_y: wallClimbs[i].map_y });
    }
  }
  if (positions.length > 0) {
    try { await api('POST', '/api/routes/climbs/map-positions', { positions }); } catch (e) { console.warn('Failed to save auto-distributed positions:', e); }
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

            <!-- Wall shapes — rendered dynamically by renderRoutesPage() -->
            <g id="map-walls-group"></g>

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

  // Render walls into map-walls-group
  const wallsGroup = document.getElementById('map-walls-group');
  if (wallsGroup && _routeWallsCache.length) {
    wallsGroup.innerHTML = _routeWallsCache.map(w => {
      const pts = Array.isArray(w.path_json) ? w.path_json : [];
      if (pts.length < 2) return '';
      const pointsAttr = pts.map(p => `${p[0]},${p[1]}`).join(' ');
      const colour = w.colour || '#64748B';
      // Compute label position as midpoint of polyline
      const mid = pts[Math.floor(pts.length / 2)];
      return `
        <polyline points="${pointsAttr}" fill="none" stroke="${colour}" stroke-opacity="0.7" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
        <text x="${mid[0]}" y="${mid[1] - 8}" text-anchor="middle" fill="${colour}" fill-opacity="0.9" font-size="11" font-weight="700">${w.name.toUpperCase()}</text>
      `;
    }).join('');
  }

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

    // Cache walls for map rendering and mini-map
    _routeWallsCache = walls;

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
        <button onclick="setWallFilter(null)" data-wall-id="" class="px-4 py-2 rounded-lg text-sm font-medium transition ${!routesWallFilter ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}">All</button>
        ${walls.map(w => `
          <button onclick="setWallFilter('${w.id}')" data-wall-id="${w.id}" class="px-4 py-2 rounded-lg text-sm font-medium transition ${routesWallFilter === w.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}">${w.name}</button>
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
        const btnWallId = btn.getAttribute('data-wall-id') || '';
        const isActive = wallId ? btnWallId === wallId : btnWallId === '';
        btn.className = `px-4 py-2 rounded-lg text-sm font-medium transition ${isActive ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`;
      });
    }
  } else {
    renderRoutesPage();
  }
}

async function showAddClimbModal(existingClimb = null) {
  const isEdit = !!existingClimb;
  const title = isEdit ? 'Edit Climb' : 'Add Climb';
  const today = new Date().toISOString().split('T')[0];

  // Ensure walls are loaded
  if (!_routeWallsCache.length) {
    try { _routeWallsCache = await api('GET', '/api/routes/walls'); } catch (_) {}
  }
  const walls = _routeWallsCache;

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
              ${walls.length
                ? walls.map(w => `<option value="${w.id}" ${isEdit && existingClimb.wall_id === w.id ? 'selected' : ''}>${w.name}</option>`).join('')
                : '<option value="">No walls configured — add walls in Settings</option>'}
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
                ${walls.map(w => {
                  const pts = Array.isArray(w.path_json) ? w.path_json : [];
                  if (pts.length < 2) return '';
                  const pointsAttr = pts.map(p => `${p[0]},${p[1]}`).join(' ');
                  const colour = w.colour || '#64748B';
                  const mid = pts[Math.floor(pts.length / 2)];
                  return `<polyline points="${pointsAttr}" fill="none" stroke="${colour}" stroke-opacity="0.7" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                <text x="${mid[0]}" y="${mid[1] - 6}" text-anchor="middle" fill="${colour}" fill-opacity="0.8" font-size="10" font-weight="700">${w.name.toUpperCase()}</text>`;
                }).join('')}
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

    <!-- End of Day Report -->
    <div class="bg-white border border-gray-200 rounded-xl p-4 mb-6" id="analytics-eod">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-sm font-semibold text-gray-700">End of Day Report</h3>
        <div class="flex items-center gap-2">
          <input type="date" id="eod-date" class="text-xs border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500" value="${new Date().toISOString().split('T')[0]}" onchange="loadEodReport()">
          <button onclick="printEodReport()" class="text-xs px-3 py-1.5 bg-[#1E3A5F] text-white rounded-lg hover:bg-[#2A4D7A] transition font-medium flex items-center gap-1">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
            Print
          </button>
        </div>
      </div>
      <div id="eod-content" class="text-gray-400 text-sm text-center py-4">Loading...</div>
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
    loadEodReport();

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
      <button onclick="switchSettingsTab('staff')" class="settings-tab px-5 py-3 text-sm font-medium border-b-2 ${settingsTab === 'staff' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}" data-stab="staff">Staff</button>
      <button onclick="switchSettingsTab('products')" class="settings-tab px-5 py-3 text-sm font-medium border-b-2 ${settingsTab === 'products' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}" data-stab="products">Products</button>
      <button onclick="switchSettingsTab('passes')" class="settings-tab px-5 py-3 text-sm font-medium border-b-2 ${settingsTab === 'passes' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}" data-stab="passes">Pass Types</button>
      <button onclick="switchSettingsTab('general')" class="settings-tab px-5 py-3 text-sm font-medium border-b-2 ${settingsTab === 'general' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}" data-stab="general">General</button>
      <button onclick="switchSettingsTab('integrations')" class="settings-tab px-5 py-3 text-sm font-medium border-b-2 ${settingsTab === 'integrations' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}" data-stab="integrations">Integrations</button>
      <button onclick="switchSettingsTab('waivers')" class="settings-tab px-5 py-3 text-sm font-medium border-b-2 ${settingsTab === 'waivers' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}" data-stab="waivers">Waivers</button>
      <button onclick="switchSettingsTab('billing')" class="settings-tab px-5 py-3 text-sm font-medium border-b-2 ${settingsTab === 'billing' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}" data-stab="billing">Billing</button>
      <button onclick="switchSettingsTab('map')" class="settings-tab px-5 py-3 text-sm font-medium border-b-2 ${settingsTab === 'map' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}" data-stab="map">Gym Map</button>
    </div>

    <div id="settings-tab-staff" class="settings-tab-content ${settingsTab !== 'staff' ? 'hidden' : ''}"></div>
    <div id="settings-tab-products" class="settings-tab-content ${settingsTab !== 'products' ? 'hidden' : ''}"></div>
    <div id="settings-tab-passes" class="settings-tab-content ${settingsTab !== 'passes' ? 'hidden' : ''}"></div>
    <div id="settings-tab-general" class="settings-tab-content ${settingsTab !== 'general' ? 'hidden' : ''}"></div>
    <div id="settings-tab-integrations" class="settings-tab-content ${settingsTab !== 'integrations' ? 'hidden' : ''}"></div>
    <div id="settings-tab-waivers" class="settings-tab-content ${settingsTab !== 'waivers' ? 'hidden' : ''}"></div>
    <div id="settings-tab-billing" class="settings-tab-content ${settingsTab !== 'billing' ? 'hidden' : ''}"></div>
    <div id="settings-tab-map" class="settings-tab-content ${settingsTab !== 'map' ? 'hidden' : ''}"></div>
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

async function loadEodReport() {
  const container = document.getElementById('eod-content');
  if (!container) return;
  const dateInput = document.getElementById('eod-date');
  const date = dateInput ? dateInput.value : new Date().toISOString().split('T')[0];
  container.innerHTML = '<p class="text-gray-400 text-sm text-center py-4">Loading...</p>';

  try {
    const data = await api('GET', `/api/stats/eod?date=${date}`);
    const isToday = date === new Date().toISOString().split('T')[0];
    const dateLabel = isToday ? 'Today' : new Date(date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    const methodRow = (label, amount, count) => amount > 0 ? `
      <div class="flex items-center justify-between py-1.5 text-sm">
        <span class="text-gray-600">${label}</span>
        <div class="text-right">
          <span class="font-medium text-gray-900">£${parseFloat(amount).toFixed(2)}</span>
          <span class="text-xs text-gray-400 ml-2">${count} txn${count !== 1 ? 's' : ''}</span>
        </div>
      </div>` : '';

    container.innerHTML = `
      <div id="eod-printable">
        <div class="flex items-center justify-between mb-4">
          <div>
            <p class="text-xs text-gray-400 uppercase font-semibold">Report for</p>
            <p class="text-lg font-bold text-gray-900">${dateLabel}</p>
          </div>
          <div class="text-right">
            <p class="text-2xl font-bold text-green-600">£${parseFloat(data.totalRevenue).toFixed(2)}</p>
            <p class="text-xs text-gray-400">Total revenue</p>
          </div>
        </div>

        <div class="grid grid-cols-3 gap-3 mb-4">
          <div class="bg-blue-50 rounded-xl p-3 text-center">
            <p class="text-2xl font-bold text-blue-600">${data.totalCheckIns}</p>
            <p class="text-xs text-gray-500 mt-0.5">Check-ins</p>
          </div>
          <div class="bg-green-50 rounded-xl p-3 text-center">
            <p class="text-2xl font-bold text-green-600">${data.totalTransactions}</p>
            <p class="text-xs text-gray-500 mt-0.5">Transactions</p>
          </div>
          <div class="bg-purple-50 rounded-xl p-3 text-center">
            <p class="text-2xl font-bold text-purple-600">${data.newMembers}</p>
            <p class="text-xs text-gray-500 mt-0.5">New members</p>
          </div>
        </div>

        <div class="border-t border-gray-100 pt-3 mb-4">
          <p class="text-xs uppercase font-bold text-gray-400 mb-2">Revenue by Payment Method</p>
          ${methodRow('Card (Dojo)', data.byMethod?.dojo_card?.amount || 0, data.byMethod?.dojo_card?.count || 0)}
          ${methodRow('Voucher / Gift Card', (data.byMethod?.voucher?.amount || 0) + (data.byMethod?.gift_card?.amount || 0), (data.byMethod?.voucher?.count || 0) + (data.byMethod?.gift_card?.count || 0))}
          ${methodRow('Other', data.byMethod?.other?.amount || 0, data.byMethod?.other?.count || 0)}
          ${data.totalRevenue == 0 ? '<p class="text-sm text-gray-400 py-2">No revenue recorded</p>' : ''}
        </div>

        ${data.topProducts?.length > 0 ? `
        <div class="border-t border-gray-100 pt-3 mb-4">
          <p class="text-xs uppercase font-bold text-gray-400 mb-2">Top Sellers</p>
          ${data.topProducts.map(p => `
            <div class="flex items-center justify-between py-1.5 text-sm">
              <span class="text-gray-700 truncate mr-3">${p.name}</span>
              <div class="flex-shrink-0 text-right">
                <span class="font-medium">£${parseFloat(p.revenue).toFixed(2)}</span>
                <span class="text-xs text-gray-400 ml-1">×${p.qty}</span>
              </div>
            </div>`).join('')}
        </div>` : ''}

        ${data.checkInMethods?.length > 0 ? `
        <div class="border-t border-gray-100 pt-3">
          <p class="text-xs uppercase font-bold text-gray-400 mb-2">Check-in Methods</p>
          <div class="flex gap-3 flex-wrap">
            ${data.checkInMethods.map(c => `<span class="text-sm text-gray-600">${c.method}: <strong>${c.count}</strong></span>`).join(' · ')}
          </div>
        </div>` : ''}
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<p class="text-sm text-red-500 text-center py-4">Failed to load: ${err.message}</p>`;
  }
}

function printEodReport() {
  const content = document.getElementById('eod-printable');
  if (!content) return;
  const dateInput = document.getElementById('eod-date');
  const date = dateInput?.value || '';
  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html><head><title>${window.gymName || 'Gym'} EOD Report ${date}</title>
    <style>body{font-family:sans-serif;padding:2rem;max-width:600px;margin:0 auto}h2{margin-bottom:0.25rem}p{margin:0.15rem 0}.row{display:flex;justify-content:space-between;padding:0.3rem 0;border-bottom:1px solid #eee}.label{color:#666}.bold{font-weight:700}@media print{button{display:none}}</style>
  </head><body>
    <h2>${window.gymName || 'Gym'} — End of Day Report</h2>
    <p style="color:#666;margin-bottom:1.5rem">${date}</p>
    ${content.innerHTML}
    <script>window.onload=()=>window.print()<\/script>
  </body></html>`);
  w.document.close();
}

async function loadSettingsTabContent(tab) {
  switch (tab) {
    case 'staff': return loadStaffManagement();
    case 'products': return loadProductSettings();
    case 'passes': return loadPassTypeSettings();
    case 'general': return loadGeneralSettings();
    case 'integrations': return loadIntegrationSettings();
    case 'waivers': return loadWaiverSettings();
    case 'billing': return loadBillingSettings();
    case 'map': return loadMapSettings();
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
                        ${s.email ? `<button onclick="sendStaffInvite('${s.id}', '${s.first_name}')" class="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition" title="Send invite email">
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                        </button>` : ''}
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
            <label class="block text-sm font-medium text-gray-700 mb-1">4-Digit PIN ${isEdit ? '(blank = keep)' : '*'}</label>
            <input type="text" name="pin" maxlength="4" pattern="[0-9]{4}" ${isEdit ? '' : 'required'} class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-center text-lg tracking-[0.3em] font-mono" placeholder="${isEdit ? '••••' : '0000'}">
            <p class="text-xs text-gray-400 mt-0.5">Default: birthday DDMM</p>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input type="date" name="start_date" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" value="${staff?.start_date || ''}">
          </div>
        </div>

        <!-- Permission overrides -->
        <div class="mb-4">
          <div class="flex items-center justify-between mb-2">
            <label class="block text-sm font-medium text-gray-700">Permission Overrides</label>
            <button type="button" onclick="resetPermissionsToRole()" class="text-xs text-blue-600 hover:underline">Reset to role defaults</button>
          </div>
          <div class="border border-gray-200 rounded-xl p-3 grid grid-cols-2 gap-2" id="permission-toggles">
            ${await buildPermissionToggles(staff)}
          </div>
        </div>

        <div id="staff-form-error" class="text-red-500 text-sm mb-3 hidden"></div>
        <div class="flex ${isEdit ? 'justify-between' : 'justify-end'} gap-2">
          ${isEdit ? `<button type="button" onclick="deleteStaff('${staffId}', '${staff.first_name} ${staff.last_name}')" class="px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg transition text-sm font-medium border border-red-200">Delete</button>` : ''}
          <div class="flex gap-2">
            <button type="button" onclick="closeModal()" class="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition text-sm font-medium">Cancel</button>
            <button type="submit" class="px-4 py-2 bg-[#1E3A5F] hover:bg-[#2A4D7A] text-white rounded-lg transition text-sm font-medium">${isEdit ? 'Save Changes' : 'Add Staff'}</button>
          </div>
        </div>
      </form>
    </div>
  `);
}

async function buildPermissionToggles(staff) {
  const PERMS = [
    { key: 'checkin', label: 'Check In' },
    { key: 'pos', label: 'POS' },
    { key: 'members_view', label: 'View Members' },
    { key: 'members_edit', label: 'Edit Members' },
    { key: 'events_view', label: 'Events View' },
    { key: 'events_edit', label: 'Events Edit' },
    { key: 'routes_view', label: 'Routes View' },
    { key: 'routes_edit', label: 'Routes Edit' },
    { key: 'analytics', label: 'Analytics' },
    { key: 'settings', label: 'Settings' },
    { key: 'staff', label: 'Staff Mgmt' },
    { key: 'waiver_validate', label: 'Validate Waivers' },
  ];
  const perms = staff?.permissions || {};
  return PERMS.map(p => {
    const checked = p.key in perms ? perms[p.key] : true;
    return `<label class="flex items-center gap-2 cursor-pointer">
      <input type="checkbox" name="perm_${p.key}" ${checked ? 'checked' : ''} class="perm-toggle w-4 h-4 text-[#1E3A5F]">
      <span class="text-xs text-gray-700">${p.label}</span>
    </label>`;
  }).join('');
}

async function resetPermissionsToRole() {
  const role = document.querySelector('#staff-form [name=role]')?.value;
  if (!role) return;
  try {
    const defaults = await api('GET', `/api/staff/default-permissions/${role}`);
    document.querySelectorAll('.perm-toggle').forEach(cb => {
      const key = cb.name.replace('perm_', '');
      if (key in defaults) cb.checked = defaults[key];
    });
  } catch(e) { showToast('Could not load defaults', 'error'); }
}

async function deleteStaff(staffId, name) {
  if (!confirm(`Permanently delete ${name}? This cannot be undone.`)) return;
  try {
    await api('DELETE', `/api/staff/${staffId}`);
    showToast(`${name} deleted`, 'success');
    closeModal();
    loadStaffManagement();
  } catch(e) { showToast('Error: ' + e.message, 'error'); }
}

async function saveStaff(e, staffId) {
  e.preventDefault();
  const form = document.getElementById('staff-form');
  const data = Object.fromEntries(new FormData(form));
  const errEl = document.getElementById('staff-form-error');

  // Collect permission overrides from checkboxes
  const permissions = {};
  document.querySelectorAll('.perm-toggle').forEach(cb => {
    permissions[cb.name.replace('perm_', '')] = cb.checked;
  });
  data.permissions = permissions;

  // Clean empty optional fields
  if (!data.pin) delete data.pin;
  if (!data.password) delete data.password;
  if (!data.email) delete data.email;
  if (!data.phone) delete data.phone;
  if (!data.start_date) delete data.start_date;
  // Remove perm_ keys from flat data (already collected above)
  Object.keys(data).filter(k => k.startsWith('perm_')).forEach(k => delete data[k]);

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

async function sendStaffInvite(staffId, firstName) {
  if (!confirm(`Send an invite email to ${firstName}? They'll get a link to set their password.`)) return;
  try {
    const data = await api('POST', `/api/staff/${staffId}/invite`);
    if (data.ok) {
      showToast(`Invite sent to ${firstName}`, 'success');
      // Show the invite URL in case email isn't configured
      if (data.inviteUrl) {
        console.log('Invite URL (fallback):', data.inviteUrl);
      }
    }
  } catch (err) {
    showToast('Error sending invite: ' + err.message, 'error');
  }
}

// ---- General Settings Tab ----

// ---- Products Tab ----

async function loadProductSettings() {
  const container = document.getElementById('settings-tab-products');
  container.innerHTML = '<p class="text-gray-400 text-center py-8">Loading...</p>';
  try {
    const grouped = await api('GET', '/api/products/grouped?activeOnly=false');
    const totalProducts = grouped.reduce((s, c) => s + c.products.length, 0);

    container.innerHTML = `
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold text-gray-900">Products <span class="text-sm text-gray-400 font-normal">(${totalProducts} total)</span></h3>
        <div class="flex gap-2">
          <button onclick="showCategoryModal()" class="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition">+ Category</button>
          <button onclick="showProductModal()" class="px-4 py-2 bg-[#1E3A5F] hover:bg-[#2A4D7A] text-white text-sm font-medium rounded-lg transition">+ Product</button>
        </div>
      </div>
      ${grouped.map(cat => {
        const products = cat.products || [];
        return `
          <div class="mb-5" data-cat-section="${cat.id}">
            <div class="flex items-center justify-between mb-2">
              <h4 class="text-xs uppercase font-bold text-gray-400 flex items-center gap-1.5">
                <span>${cat.icon || ''}</span> ${cat.name}
                <span class="text-gray-300 font-normal normal-case">(${products.length})</span>
              </h4>
              <div class="flex gap-1">
                <button onclick="showProductModal(null, '${cat.id}')" class="text-xs text-blue-600 hover:underline">+ Add here</button>
                <span class="text-gray-200 mx-1">|</span>
                <button onclick="showCategoryModal('${cat.id}')" class="text-xs text-gray-400 hover:text-gray-600">Edit</button>
              </div>
            </div>
            <div class="bg-white border border-gray-200 rounded-xl overflow-hidden">
              ${products.length === 0
                ? `<p class="text-xs text-gray-400 text-center py-4">No products in this category</p>`
                : products.map((p, i) => `
                  <div class="flex items-center justify-between px-4 py-2.5 ${i < products.length - 1 ? 'border-b border-gray-50' : ''} hover:bg-gray-50 transition">
                    <div class="flex items-center gap-3 min-w-0">
                      <div class="w-1.5 h-1.5 rounded-full flex-shrink-0 ${p.is_active ? 'bg-green-500' : 'bg-gray-300'}"></div>
                      <div class="min-w-0">
                        <p class="text-sm font-medium text-gray-900 truncate">${p.name}</p>
                        ${p.description ? `<p class="text-xs text-gray-400 truncate">${p.description}</p>` : ''}
                      </div>
                    </div>
                    <div class="flex items-center gap-3 ml-3 flex-shrink-0">
                      <span class="text-sm font-bold text-gray-700">£${parseFloat(p.price).toFixed(2)}</span>
                      ${p.stock_count !== null ? `<span class="text-xs px-1.5 py-0.5 rounded-full ${p.stock_count <= (p.stock_low_threshold || 0) ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'}">Stock: ${p.stock_count}</span>` : ''}
                      <button onclick="showProductModal('${p.id}')" class="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                      </button>
                      <button onclick="toggleProductActive('${p.id}', ${!p.is_active})" class="p-1.5 rounded-lg hover:bg-gray-100 text-gray-300 hover:text-gray-600 transition" title="${p.is_active ? 'Hide from POS' : 'Show in POS'}">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          ${p.is_active
                            ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>'
                            : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>'}
                        </svg>
                      </button>
                    </div>
                  </div>
                `).join('')}
            </div>
          </div>`;
      }).join('')}
    `;
  } catch (err) {
    container.innerHTML = `<p class="text-red-400 text-center py-8">Error: ${err.message}</p>`;
  }
}

async function showProductModal(productId = null, defaultCategoryId = null) {
  const categories = await api('GET', '/api/products/categories');
  let product = null;
  if (productId) {
    try { product = await api('GET', `/api/products/${productId}`); } catch (e) {}
  }

  document.getElementById('modal-content').className = 'bg-white rounded-xl shadow-2xl max-w-lg w-full mx-4 max-h-[92vh] overflow-y-auto';
  showModal(`
    <div class="p-6">
      <div class="flex items-center justify-between mb-5">
        <h3 class="text-xl font-bold text-gray-900">${product ? 'Edit Product' : 'New Product'}</h3>
        <button onclick="closeModal()" class="text-gray-400 hover:text-gray-600"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
      </div>
      <form id="product-form" onsubmit="saveProduct(event, ${product ? `'${product.id}'` : 'null'})" class="space-y-4">
        <div>
          <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Product Name *</label>
          <input type="text" name="name" required class="form-input" value="${product?.name || ''}" placeholder="e.g. Oat Milk Latte" autofocus>
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Category *</label>
          <select name="category_id" required class="form-select">
            ${categories.map(c => `<option value="${c.id}" ${(product?.category_id || defaultCategoryId) === c.id ? 'selected' : ''}>${c.icon || ''} ${c.name}</option>`).join('')}
          </select>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Price (£) *</label>
            <input type="number" name="price" step="0.01" min="0" required class="form-input" value="${product?.price ?? ''}">
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Cost Price (£)</label>
            <input type="number" name="cost_price" step="0.01" min="0" class="form-input" value="${product?.cost_price ?? ''}" placeholder="Optional">
          </div>
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Description</label>
          <input type="text" name="description" class="form-input" value="${product?.description || ''}" placeholder="Short description (optional)">
        </div>

        <div class="border-t border-gray-100 pt-4">
          <p class="text-xs font-semibold text-gray-500 uppercase mb-3">Stock Tracking</p>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs text-gray-500 mb-1">Current Stock</label>
              <input type="number" name="stock_count" min="0" class="form-input" value="${product?.stock_count ?? ''}" placeholder="Leave blank = no tracking">
            </div>
            <div>
              <label class="block text-xs text-gray-500 mb-1">Low Stock Alert</label>
              <input type="number" name="stock_low_threshold" min="0" class="form-input" value="${product?.stock_low_threshold ?? ''}" placeholder="e.g. 5">
            </div>
          </div>
          <label class="flex items-center gap-2 mt-3 cursor-pointer">
            <input type="checkbox" name="stock_enforce_limit" ${product?.stock_enforce_limit ? 'checked' : ''} class="w-4 h-4 rounded">
            <span class="text-sm text-gray-700">Block sale when out of stock</span>
          </label>
        </div>

        <label class="flex items-center gap-2 cursor-pointer pt-1">
          <input type="checkbox" name="is_active" ${product === null || product?.is_active ? 'checked' : ''} class="w-4 h-4 rounded">
          <span class="text-sm text-gray-700">Active (show in POS)</span>
        </label>

        <div class="flex gap-2 pt-2">
          ${product ? `<button type="button" onclick="deleteProduct('${product.id}')" class="px-4 py-2.5 border border-red-200 text-red-500 rounded-lg text-sm font-medium hover:bg-red-50 transition">Delete</button>` : ''}
          <button type="button" onclick="closeModal()" class="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
          <button type="submit" class="flex-1 py-2.5 bg-[#1E3A5F] text-white rounded-lg text-sm font-semibold hover:bg-[#2A4D7A] transition">${product ? 'Save' : 'Add Product'}</button>
        </div>
      </form>
    </div>
  `);
}

async function saveProduct(e, productId) {
  e.preventDefault();
  const form = document.getElementById('product-form');
  const data = Object.fromEntries(new FormData(form));
  data.is_active = form.querySelector('[name="is_active"]').checked ? 1 : 0;
  data.stock_enforce_limit = form.querySelector('[name="stock_enforce_limit"]').checked ? 1 : 0;
  if (data.stock_count === '') data.stock_count = null;
  if (data.stock_low_threshold === '') data.stock_low_threshold = null;
  if (data.cost_price === '') data.cost_price = null;

  try {
    if (productId) {
      await api('PUT', `/api/products/${productId}`, data);
      showToast('Product updated', 'success');
    } else {
      await api('POST', '/api/products', data);
      showToast('Product added', 'success');
    }
    closeModal();
    loadProductSettings();
  } catch (err) { showToast('Error: ' + err.message, 'error'); }
}

async function toggleProductActive(productId, active) {
  await api('PUT', `/api/products/${productId}`, { is_active: active ? 1 : 0 });
  loadProductSettings();
}

async function deleteProduct(productId) {
  if (!confirm('Delete this product? It will be removed from the POS. Past transactions are unaffected.')) return;
  try {
    await api('DELETE', `/api/products/${productId}`);
    showToast('Product deleted', 'success');
    closeModal();
    loadProductSettings();
  } catch (err) { showToast('Error: ' + err.message, 'error'); }
}

async function showCategoryModal(categoryId = null) {
  let cat = null;
  if (categoryId) {
    const cats = await api('GET', '/api/products/categories');
    cat = cats.find(c => c.id === categoryId);
  }

  document.getElementById('modal-content').className = 'bg-white rounded-xl shadow-2xl max-w-sm w-full mx-4';
  showModal(`
    <div class="p-6">
      <div class="flex items-center justify-between mb-5">
        <h3 class="text-lg font-bold text-gray-900">${cat ? 'Edit Category' : 'New Category'}</h3>
        <button onclick="closeModal()" class="text-gray-400 hover:text-gray-600"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
      </div>
      <form id="category-form" onsubmit="saveCategory(event, ${cat ? `'${cat.id}'` : 'null'})" class="space-y-4">
        <div>
          <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Category Name *</label>
          <input type="text" name="name" required class="form-input" value="${cat?.name || ''}" placeholder="e.g. Protein Shakes" autofocus>
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Emoji Icon</label>
          <input type="text" name="icon" class="form-input text-2xl text-center" value="${cat?.icon || ''}" placeholder="🛍️" maxlength="4">
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Sort Order</label>
          <input type="number" name="sort_order" class="form-input" value="${cat?.sort_order ?? 99}" min="0">
        </div>
        <div class="flex gap-2 pt-1">
          ${cat ? `<button type="button" onclick="deleteCategory('${cat.id}')" class="px-3 py-2.5 border border-red-200 text-red-500 rounded-lg text-sm font-medium hover:bg-red-50">Delete</button>` : ''}
          <button type="button" onclick="closeModal()" class="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
          <button type="submit" class="flex-1 py-2.5 bg-[#1E3A5F] text-white rounded-lg text-sm font-semibold hover:bg-[#2A4D7A]">${cat ? 'Save' : 'Create'}</button>
        </div>
      </form>
    </div>
  `);
}

async function saveCategory(e, categoryId) {
  e.preventDefault();
  const form = document.getElementById('category-form');
  const data = Object.fromEntries(new FormData(form));
  try {
    if (categoryId) {
      await api('PUT', `/api/products/categories/${categoryId}`, data);
      showToast('Category updated', 'success');
    } else {
      await api('POST', '/api/products/categories', data);
      showToast('Category created', 'success');
    }
    closeModal();
    loadProductSettings();
  } catch (err) { showToast('Error: ' + err.message, 'error'); }
}

async function deleteCategory(categoryId) {
  if (!confirm('Delete this category? Products inside will need to be reassigned.')) return;
  try {
    await api('DELETE', `/api/products/categories/${categoryId}`);
    showToast('Category deleted', 'success');
    closeModal();
    loadProductSettings();
  } catch (err) { showToast('Error: ' + err.message, 'error'); }
}

// ---- Pass Types Tab ----

const PASS_CATEGORIES = {
  single_entry: 'Day Entry',
  multi_visit: '10-Visit Pass',
  monthly_pass: 'Monthly Pass',
  membership_dd: 'Membership (Direct Debit)',
  annual_membership: 'Annual Membership',
  membership: 'Membership',
  staff: 'Staff / Complimentary',
};

async function loadPassTypeSettings() {
  const container = document.getElementById('settings-tab-passes');
  container.innerHTML = '<p class="text-gray-400 text-center py-8">Loading...</p>';
  try {
    const types = await api('GET', '/api/passes/types?activeOnly=false');
    const grouped = {};
    types.forEach(t => {
      const cat = t.category || 'other';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(t);
    });

    container.innerHTML = `
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold text-gray-900">Pass Types</h3>
        <button onclick="showPassTypeModal()" class="px-4 py-2 bg-[#1E3A5F] hover:bg-[#2A4D7A] text-white text-sm font-medium rounded-lg transition">+ New Pass Type</button>
      </div>
      ${Object.entries(grouped).map(([cat, passes]) => `
        <div class="mb-5">
          <h4 class="text-xs uppercase font-bold text-gray-400 mb-2">${PASS_CATEGORIES[cat] || cat}</h4>
          <div class="bg-white border border-gray-200 rounded-xl overflow-hidden">
            ${passes.map((p, i) => `
              <div class="flex items-center justify-between px-4 py-3 ${i < passes.length - 1 ? 'border-b border-gray-100' : ''}">
                <div class="flex items-center gap-3">
                  <div class="w-2 h-2 rounded-full ${p.is_active ? 'bg-green-500' : 'bg-gray-300'}"></div>
                  <div>
                    <p class="text-sm font-medium text-gray-900">${p.name}</p>
                    <div class="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                      <span>Peak: <strong class="text-gray-700">£${parseFloat(p.price_peak || 0).toFixed(2)}</strong></span>
                      ${p.price_off_peak !== p.price_peak ? `<span>Off-peak: <strong class="text-gray-700">£${parseFloat(p.price_off_peak || 0).toFixed(2)}</strong></span>` : ''}
                      ${p.visits_included ? `<span>${p.visits_included} visits</span>` : ''}
                      ${p.duration_days ? `<span>${p.duration_days} days</span>` : ''}
                    </div>
                  </div>
                </div>
                <div class="flex items-center gap-1">
                  <button onclick="showPassTypeModal('${p.id}')" class="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                  </button>
                  <button onclick="togglePassTypeActive('${p.id}', ${!p.is_active})" class="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition" title="${p.is_active ? 'Disable' : 'Enable'}">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      ${p.is_active
                        ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>'
                        : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>'}
                    </svg>
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')}
    `;
  } catch (err) {
    container.innerHTML = `<p class="text-red-400 text-center py-8">Error: ${err.message}</p>`;
  }
}

async function showPassTypeModal(passTypeId = null) {
  let pt = null;
  if (passTypeId) {
    try { pt = await api('GET', `/api/passes/types/${passTypeId}`); } catch (e) {}
    if (!pt) {
      const all = await api('GET', '/api/passes/types?activeOnly=false');
      pt = all.find(p => p.id === passTypeId);
    }
  }

  document.getElementById('modal-content').className = 'bg-white rounded-xl shadow-2xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto';
  showModal(`
    <div class="p-6">
      <div class="flex items-center justify-between mb-5">
        <h3 class="text-xl font-bold text-gray-900">${pt ? 'Edit Pass Type' : 'New Pass Type'}</h3>
        <button onclick="closeModal()" class="text-gray-400 hover:text-gray-600"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
      </div>
      <form id="pass-type-form" onsubmit="savePassType(event, ${pt ? `'${pt.id}'` : 'null'})" class="space-y-4">
        <div>
          <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Name *</label>
          <input type="text" name="name" required class="form-input" value="${pt?.name || ''}" placeholder="e.g. Adult Single Entry">
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Category *</label>
          <select name="category" required class="form-select">
            ${Object.entries(PASS_CATEGORIES).map(([val, label]) => `<option value="${val}" ${pt?.category === val ? 'selected' : ''}>${label}</option>`).join('')}
          </select>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Peak Price (£) *</label>
            <input type="number" name="price_peak" step="0.01" min="0" required class="form-input" value="${pt?.price_peak ?? ''}">
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Off-Peak Price (£)</label>
            <input type="number" name="price_off_peak" step="0.01" min="0" class="form-input" value="${pt?.price_off_peak ?? ''}" placeholder="Same as peak">
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Visits Included</label>
            <input type="number" name="visits_included" min="1" class="form-input" value="${pt?.visits_included ?? ''}" placeholder="Blank = unlimited">
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Duration (days)</label>
            <input type="number" name="duration_days" min="1" class="form-input" value="${pt?.duration_days ?? ''}" placeholder="Blank = no expiry">
          </div>
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Description</label>
          <input type="text" name="description" class="form-input" value="${pt?.description || ''}" placeholder="Optional note">
        </div>
        <label class="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" name="is_active" ${pt === null || pt?.is_active ? 'checked' : ''} class="w-4 h-4 rounded">
          <span class="text-sm text-gray-700">Active (visible in POS and Assign Pass)</span>
        </label>
        <div class="flex gap-2 pt-2">
          <button type="button" onclick="closeModal()" class="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
          <button type="submit" class="flex-1 py-2.5 bg-[#1E3A5F] text-white rounded-lg text-sm font-semibold hover:bg-[#2A4D7A] transition">${pt ? 'Save Changes' : 'Create Pass Type'}</button>
        </div>
      </form>
    </div>
  `);
}

async function savePassType(e, passTypeId) {
  e.preventDefault();
  const form = document.getElementById('pass-type-form');
  const data = Object.fromEntries(new FormData(form));
  data.is_active = form.querySelector('[name="is_active"]').checked ? 1 : 0;
  if (!data.price_off_peak) data.price_off_peak = data.price_peak;
  if (!data.visits_included) data.visits_included = null;
  if (!data.duration_days) data.duration_days = null;

  try {
    if (passTypeId) {
      await api('PUT', `/api/passes/types/${passTypeId}`, data);
      showToast('Pass type updated', 'success');
    } else {
      await api('POST', '/api/passes/types', data);
      showToast('Pass type created', 'success');
    }
    closeModal();
    loadPassTypeSettings();
  } catch (err) { showToast('Error: ' + err.message, 'error'); }
}

async function togglePassTypeActive(passTypeId, active) {
  try {
    await api('PUT', `/api/passes/types/${passTypeId}`, { is_active: active ? 1 : 0 });
    loadPassTypeSettings();
  } catch (err) { showToast('Error: ' + err.message, 'error'); }
}

// ---- Waivers Tab ----

async function loadWaiverSettings() {
  const container = document.getElementById('settings-tab-waivers');
  container.innerHTML = '<p class="text-gray-400 text-center py-8">Loading waiver templates...</p>';

  try {
    const templates = await api('GET', '/api/waivers/templates');
    const adult = templates.find(t => t.type === 'adult' && t.is_active) || templates.find(t => t.type === 'adult');
    const minor = templates.find(t => t.type === 'minor' && t.is_active) || templates.find(t => t.type === 'minor');

    if (!adult && !minor) {
      container.innerHTML = '<p class="text-gray-400 text-center py-8">No waiver templates found. Seed defaults first.</p>';
      return;
    }

    container.innerHTML = `
      <div class="max-w-3xl space-y-6">
        ${adult ? renderWaiverTemplateEditor(adult) : ''}
        ${minor ? renderWaiverTemplateEditor(minor) : ''}
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<p class="text-red-400 text-center py-8">Error loading waivers: ${err.message}</p>`;
  }
}

function renderWaiverTemplateEditor(template) {
  const content = template.content || (template.content_json ? JSON.parse(template.content_json) : {});
  const sections = content.sections || [];
  const typeLabel = template.type === 'adult' ? 'Adult Waiver' : 'Minor Waiver';

  const sectionsHtml = sections.map((sec, i) => {
    const sectionContent = sec.content || (sec.subsections ? sec.subsections.join('\n') : '');
    return `
      <div class="waiver-section-row border border-gray-200 rounded-xl p-4 bg-gray-50" data-idx="${i}">
        <div class="flex items-center gap-2 mb-3">
          <span class="text-xs font-bold text-gray-400 uppercase tracking-wide flex-1">Section ${i + 1}</span>
          <div class="flex gap-1">
            <button type="button" onclick="moveWaiverSection('${template.id}', ${i}, -1)" title="Move up"
              class="p-1.5 rounded-lg hover:bg-white text-gray-400 hover:text-gray-700 transition border border-transparent hover:border-gray-200">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"/></svg>
            </button>
            <button type="button" onclick="moveWaiverSection('${template.id}', ${i}, 1)" title="Move down"
              class="p-1.5 rounded-lg hover:bg-white text-gray-400 hover:text-gray-700 transition border border-transparent hover:border-gray-200">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
            </button>
            <button type="button" onclick="deleteWaiverSection('${template.id}', ${i})" title="Delete section"
              class="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition border border-transparent hover:border-red-200">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          </div>
        </div>
        <div class="space-y-2">
          <div>
            <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Title</label>
            <input type="text" class="form-input section-title" value="${escapeHtml(sec.title || '')}" placeholder="Section title">
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Content</label>
            <textarea class="form-input section-content" rows="6" placeholder="Section content...">${escapeHtml(sectionContent)}</textarea>
          </div>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="bg-white border border-gray-200 rounded-xl p-5" id="waiver-editor-${template.id}" data-content-json="${escapeHtml(JSON.stringify(content))}">
      <h3 class="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${template.type === 'adult' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}">${template.type}</span>
        ${typeLabel}
      </h3>

      <!-- Template metadata -->
      <div class="grid grid-cols-1 gap-4 mb-5 p-4 bg-gray-50 rounded-xl border border-gray-200">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Template Name</label>
            <input type="text" id="waiver-name-${template.id}" class="form-input" value="${escapeHtml(template.name || '')}">
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Expiry (days)</label>
            <input type="number" id="waiver-expiry-${template.id}" class="form-input" value="${template.expires_after_days || 365}" min="1">
          </div>
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Induction Video URL</label>
          <input type="url" id="waiver-video-${template.id}" class="form-input" value="${escapeHtml(template.video_url || '')}" placeholder="https://www.youtube.com/watch?v=...">
        </div>
      </div>

      <!-- Sections editor -->
      <div class="mb-4">
        <div class="flex items-center justify-between mb-3">
          <h4 class="text-sm font-semibold text-gray-700">Waiver Sections</h4>
          <span class="text-xs text-gray-400">These sections are displayed to climbers on the registration page</span>
        </div>
        <div id="waiver-sections-${template.id}" class="space-y-3">
          ${sectionsHtml}
        </div>
        <button type="button" onclick="addWaiverSection('${template.id}')"
          class="mt-3 w-full py-2 border-2 border-dashed border-gray-300 hover:border-blue-400 text-gray-500 hover:text-blue-600 rounded-xl text-sm font-medium transition">
          + Add Section
        </button>
      </div>

      <div class="flex justify-end">
        <button onclick="saveWaiverTemplate('${template.id}')"
          class="px-6 py-2.5 bg-[#1E3A5F] hover:bg-[#2A4D7A] text-white font-medium rounded-lg transition text-sm">
          Save Waiver
        </button>
      </div>
    </div>
  `;
}

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function getWaiverSectionsFromDom(templateId) {
  const container = document.getElementById(`waiver-sections-${templateId}`);
  if (!container) return [];
  return Array.from(container.querySelectorAll('.waiver-section-row')).map(row => ({
    title: row.querySelector('.section-title').value.trim(),
    content: row.querySelector('.section-content').value.trim(),
  }));
}

async function saveWaiverTemplate(templateId) {
  const name = document.getElementById(`waiver-name-${templateId}`)?.value?.trim();
  const video_url = document.getElementById(`waiver-video-${templateId}`)?.value?.trim();
  const expires_after_days = parseInt(document.getElementById(`waiver-expiry-${templateId}`)?.value) || 365;
  const sections = getWaiverSectionsFromDom(templateId);

  // Preserve non-sections fields from the stored content_json
  let existingContent = {};
  try {
    const editorEl = document.getElementById(`waiver-editor-${templateId}`);
    if (editorEl && editorEl.dataset.contentJson) {
      existingContent = JSON.parse(editorEl.dataset.contentJson);
    }
  } catch (e) {}

  const content_json = { ...existingContent, sections };

  try {
    await api('PUT', `/api/waivers/templates/${templateId}`, {
      name,
      video_url,
      expires_after_days,
      content_json,
    });
    showToast('Waiver template saved', 'success');
  } catch (err) {
    showToast('Error saving waiver: ' + err.message, 'error');
  }
}

function addWaiverSection(templateId) {
  const container = document.getElementById(`waiver-sections-${templateId}`);
  if (!container) return;
  const i = container.querySelectorAll('.waiver-section-row').length;
  const div = document.createElement('div');
  div.className = 'waiver-section-row border border-gray-200 rounded-xl p-4 bg-gray-50';
  div.dataset.idx = i;
  div.innerHTML = `
    <div class="flex items-center gap-2 mb-3">
      <span class="text-xs font-bold text-gray-400 uppercase tracking-wide flex-1">Section ${i + 1}</span>
      <div class="flex gap-1">
        <button type="button" onclick="moveWaiverSection('${templateId}', ${i}, -1)" title="Move up"
          class="p-1.5 rounded-lg hover:bg-white text-gray-400 hover:text-gray-700 transition border border-transparent hover:border-gray-200">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"/></svg>
        </button>
        <button type="button" onclick="moveWaiverSection('${templateId}', ${i}, 1)" title="Move down"
          class="p-1.5 rounded-lg hover:bg-white text-gray-400 hover:text-gray-700 transition border border-transparent hover:border-gray-200">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
        </button>
        <button type="button" onclick="deleteWaiverSection('${templateId}', ${i})" title="Delete section"
          class="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition border border-transparent hover:border-red-200">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
        </button>
      </div>
    </div>
    <div class="space-y-2">
      <div>
        <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Title</label>
        <input type="text" class="form-input section-title" value="" placeholder="Section title">
      </div>
      <div>
        <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Content</label>
        <textarea class="form-input section-content" rows="6" placeholder="Section content..."></textarea>
      </div>
    </div>
  `;
  container.appendChild(div);
  renumberWaiverSections(container);
}

function deleteWaiverSection(templateId, idx) {
  const container = document.getElementById(`waiver-sections-${templateId}`);
  if (!container) return;
  const rows = container.querySelectorAll('.waiver-section-row');
  if (rows[idx]) rows[idx].remove();
  renumberWaiverSections(container);
}

function moveWaiverSection(templateId, idx, direction) {
  const container = document.getElementById(`waiver-sections-${templateId}`);
  if (!container) return;
  const rows = Array.from(container.querySelectorAll('.waiver-section-row'));
  const newIdx = idx + direction;
  if (newIdx < 0 || newIdx >= rows.length) return;
  if (direction === -1) {
    container.insertBefore(rows[idx], rows[newIdx]);
  } else {
    container.insertBefore(rows[newIdx], rows[idx]);
  }
  renumberWaiverSections(container);
}

function renumberWaiverSections(container) {
  container.querySelectorAll('.waiver-section-row').forEach((row, i) => {
    row.dataset.idx = i;
    const label = row.querySelector('span.text-xs.font-bold');
    if (label) label.textContent = `Section ${i + 1}`;
  });
}

async function loadGeneralSettings() {
  const container = document.getElementById('settings-tab-general');
  container.innerHTML = '<p class="text-gray-400 text-center py-8">Loading settings...</p>';

  try {
    const settings = await api('GET', '/api/settings');

    container.innerHTML = `
      <div class="max-w-2xl">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">General Settings</h3>
        <form id="general-settings-form" onsubmit="saveGeneralSettings(event)" class="space-y-4">
          <!-- Gym Details -->
          <div class="bg-white border border-gray-200 rounded-xl p-5">
            <h4 class="font-medium text-gray-900 mb-3 flex items-center gap-2">
              <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
              Gym Details
            </h4>
            <div class="space-y-3">
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Gym Name</label>
                  <input type="text" name="gym_name" class="form-input" value="${settings.gym_name || ''}">
                </div>
                <div>
                  <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Contact Email</label>
                  <input type="email" name="contact_email" class="form-input" value="${settings.contact_email || ''}" placeholder="info@yourgym.co.uk">
                </div>
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Phone</label>
                  <input type="tel" name="gym_phone" class="form-input" value="${settings.gym_phone || ''}">
                </div>
                <div>
                  <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Website</label>
                  <input type="text" name="gym_website" class="form-input" value="${settings.gym_website || ''}" placeholder="https://yourgym.co.uk">
                </div>
              </div>
              <div>
                <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Address</label>
                <input type="text" name="gym_address" class="form-input" value="${settings.gym_address || ''}" placeholder="Rope Walk, Penryn, Cornwall, TR10 8RY">
              </div>
            </div>
          </div>

          <!-- Opening Hours -->
          <div class="bg-white border border-gray-200 rounded-xl p-5">
            <h4 class="font-medium text-gray-900 mb-3 flex items-center gap-2">
              <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              Opening Hours
            </h4>
            <div class="space-y-2">
              ${['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(day => `
                <div class="flex items-center gap-3">
                  <span class="text-sm text-gray-600 w-24 flex-shrink-0">${day}</span>
                  <input type="text" name="hours_${day.toLowerCase()}" class="form-input flex-1 text-sm" value="${settings['hours_' + day.toLowerCase()] || ''}" placeholder="e.g. 9:00–21:00 or Closed">
                </div>`).join('')}
            </div>
          </div>

          <!-- Pricing -->
          <div class="bg-white border border-gray-200 rounded-xl p-5">
            <h4 class="font-medium text-gray-900 mb-3 flex items-center gap-2">
              <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              Pricing
            </h4>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Registration Fee (£)</label>
                <input type="number" step="0.01" name="first_time_registration_fee" class="form-input" value="${settings.first_time_registration_fee || '3.00'}">
              </div>
              <div>
                <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Shoe Rental (£)</label>
                <input type="number" step="0.01" name="shoe_rental_price" class="form-input" value="${settings.shoe_rental_price || '3.50'}">
              </div>
              <div>
                <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Peak Label</label>
                <input type="text" name="peak_description" class="form-input" value="${settings.peak_description || ''}">
              </div>
              <div>
                <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Off-Peak Label</label>
                <input type="text" name="off_peak_description" class="form-input" value="${settings.off_peak_description || ''}">
              </div>
            </div>
          </div>

          <!-- Induction Video -->
          <div class="bg-white border border-gray-200 rounded-xl p-5">
            <h4 class="font-medium text-gray-900 mb-3 flex items-center gap-2">
              <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              Induction Video
            </h4>
            <div>
              <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">YouTube URL</label>
              <input type="url" name="waiver_video_url" class="form-input" value="${settings.waiver_video_url || ''}" placeholder="https://www.youtube.com/watch?v=...">
              <p class="text-xs text-gray-400 mt-1">Shown on the public registration page. Must be watched in full before the waiver form.</p>
            </div>
          </div>

          <div class="flex justify-end">
            <button type="submit" class="px-6 py-2.5 bg-[#1E3A5F] hover:bg-[#2A4D7A] text-white font-medium rounded-lg transition text-sm">Save Changes</button>
          </div>
        </form>

        <!-- Logo Upload (outside form — handled separately) -->
        <div class="bg-white border border-gray-200 rounded-xl p-5 max-w-2xl mt-4">
          <h4 class="font-medium text-gray-900 mb-3 flex items-center gap-2">
            <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
            Gym Logo
          </h4>
          <div class="flex items-center gap-4">
            <div id="logo-preview" class="w-16 h-16 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden bg-gray-50">
              ${settings.gym_logo
                ? `<img src="${settings.gym_logo}" class="w-full h-full object-contain p-1" alt="Gym logo">`
                : `<svg class="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>`}
            </div>
            <div class="flex-1">
              <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Upload Logo</label>
              <input type="file" id="logo-file-input" accept="image/*" onchange="uploadGymLogo(this)" class="text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 cursor-pointer">
              <p class="text-xs text-gray-400 mt-1">PNG, JPG or SVG. Appears in the sidebar and on emails.</p>
              ${settings.gym_logo ? `<button onclick="removeGymLogo()" class="text-xs text-red-500 hover:text-red-700 mt-1">Remove logo</button>` : ''}
            </div>
          </div>
        </div>

        <!-- Data Export -->
        <div class="bg-white border border-gray-200 rounded-xl p-5 max-w-2xl mt-4">
          <h4 class="font-medium text-gray-900 mb-1 flex items-center gap-2">
            <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            Data Export
          </h4>
          <p class="text-xs text-gray-500 mb-3">Download a complete export of all your gym data (members, transactions, waivers, etc.) for GDPR compliance or backup purposes.</p>
          <div class="flex gap-3 flex-wrap">
            <a href="/api/export/gdpr" download class="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition text-sm">
              Export All Data (JSON)
            </a>
            <a href="/api/export/members.csv" download class="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition text-sm">
              Export Members (CSV)
            </a>
          </div>
        </div>

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

async function uploadGymLogo(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 500 * 1024) {
    showToast('Logo must be under 500 KB', 'error');
    return;
  }
  const reader = new FileReader();
  reader.onload = async (e) => {
    const base64 = e.target.result;
    try {
      await api('PUT', '/api/settings/gym_logo', { value: base64 });
      document.getElementById('logo-preview').innerHTML = `<img src="${base64}" class="w-full h-full object-contain p-1" alt="Gym logo">`;
      // Update sidebar logo if present
      const sidebarLogo = document.getElementById('sidebar-logo-img');
      if (sidebarLogo) { sidebarLogo.src = base64; sidebarLogo.style.display = ''; }
      showToast('Logo updated', 'success');
    } catch (err) {
      showToast('Error uploading logo: ' + err.message, 'error');
    }
  };
  reader.readAsDataURL(file);
}

async function removeGymLogo() {
  try {
    await api('PUT', '/api/settings/gym_logo', { value: '' });
    document.getElementById('logo-preview').innerHTML = `<svg class="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>`;
    const sidebarLogo = document.getElementById('sidebar-logo-img');
    if (sidebarLogo) sidebarLogo.style.display = 'none';
    showToast('Logo removed', 'success');
  } catch (err) {
    showToast('Error removing logo: ' + err.message, 'error');
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
              <input type="email" name="email_from" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" value="${settings.email_from || ''}" placeholder="noreply@yourgym.com">
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

// ---- Billing Tab ----

async function loadBillingSettings() {
  const container = document.getElementById('settings-tab-billing');
  if (!container) return;
  container.innerHTML = '<p class="text-gray-400 text-center py-8">Loading billing...</p>';

  // Derive gymId from window.gymId or the subdomain
  const gymId = window.gymId || window.location.hostname.split('.')[0] || '';

  const statusBadge = (status) => {
    const map = {
      active:    'bg-green-100 text-green-800',
      trialing:  'bg-green-100 text-green-800',
      past_due:  'bg-yellow-100 text-yellow-800',
      cancelled: 'bg-red-100 text-red-800',
      unpaid:    'bg-red-100 text-red-800',
    };
    const label = { active: 'Active', trialing: 'Trial', past_due: 'Past Due', cancelled: 'Cancelled', unpaid: 'Unpaid' };
    const cls = map[status] || 'bg-gray-100 text-gray-700';
    return `<span class="${cls} px-2.5 py-0.5 rounded-full text-xs font-medium">${label[status] || status}</span>`;
  };

  try {
    const billing = await api('GET', `/billing/status?gymId=${encodeURIComponent(gymId)}`);
    const planNames = { starter: 'Starter', growth: 'Growth', scale: 'Scale' };
    const planName = planNames[billing.plan] || billing.plan;

    let dateInfo = '';
    if (billing.status === 'trialing' && billing.trialEndsAt) {
      dateInfo = `<p class="text-sm text-gray-500 mt-1">Trial ends: <strong>${formatDate(billing.trialEndsAt)}</strong></p>`;
    } else if (billing.currentPeriodEnd) {
      dateInfo = `<p class="text-sm text-gray-500 mt-1">Renews: <strong>${formatDate(billing.currentPeriodEnd)}</strong></p>`;
    }

    container.innerHTML = `
      <div class="max-w-2xl">
        <div class="bg-white border border-gray-200 rounded-xl p-6 mb-6">
          <div class="flex items-center justify-between mb-2">
            <h3 class="text-lg font-semibold text-gray-900">${planName} Plan</h3>
            ${statusBadge(billing.status)}
          </div>
          ${dateInfo}
          <div class="flex gap-3 mt-4">
            <button onclick="billingUpgrade('${gymId}')" class="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">Upgrade plan</button>
            <button onclick="billingPortal('${gymId}')" class="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200">Manage billing</button>
          </div>
        </div>

        <h3 class="text-base font-semibold text-gray-900 mb-3">Plans</h3>
        <div class="grid grid-cols-3 gap-4 mb-6">
          <div class="border border-gray-200 rounded-xl p-4">
            <p class="font-semibold text-gray-900">Starter</p>
            <p class="text-2xl font-bold text-gray-900 mt-1">£59<span class="text-sm font-normal text-gray-500">/mo</span></p>
            <ul class="mt-3 space-y-1 text-sm text-gray-600">
              <li>Up to 200 members</li>
              <li>Check-in & passes</li>
              <li>Basic analytics</li>
              <li>Email support</li>
            </ul>
          </div>
          <div class="border-2 border-blue-500 rounded-xl p-4 relative">
            <span class="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-xs font-semibold px-2 py-0.5 rounded-full">Popular</span>
            <p class="font-semibold text-gray-900">Growth</p>
            <p class="text-2xl font-bold text-gray-900 mt-1">£99<span class="text-sm font-normal text-gray-500">/mo</span></p>
            <ul class="mt-3 space-y-1 text-sm text-gray-600">
              <li>Unlimited members</li>
              <li>Everything in Starter</li>
              <li>Waivers & events</li>
              <li>Route setting tools</li>
              <li>Priority support</li>
            </ul>
          </div>
          <div class="border border-gray-200 rounded-xl p-4">
            <p class="font-semibold text-gray-900">Scale</p>
            <p class="text-2xl font-bold text-gray-900 mt-1">£149<span class="text-sm font-normal text-gray-500">/mo</span></p>
            <ul class="mt-3 space-y-1 text-sm text-gray-600">
              <li>Everything in Growth</li>
              <li>Multi-location</li>
              <li>Custom integrations</li>
              <li>Dedicated support</li>
            </ul>
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<p class="text-sm text-red-500 text-center py-8">Failed to load billing: ${err.message}</p>`;
  }
}

async function billingUpgrade(gymId) {
  try {
    const successUrl = window.location.origin + '/app';
    const cancelUrl = window.location.origin + '/app';
    const data = await api('POST', '/billing/create-checkout', {
      gymId,
      plan: 'growth',
      successUrl,
      cancelUrl,
    });
    if (data.url) window.location.href = data.url;
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

async function billingPortal(gymId) {
  try {
    const returnUrl = window.location.origin + '/app';
    const data = await api('POST', '/billing/portal', { gymId, returnUrl });
    if (data.url) window.location.href = data.url;
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

// ============================================================
// Gym Map Settings Tab
// ============================================================

async function loadMapSettings() {
  const container = document.getElementById('settings-tab-map');
  container.innerHTML = '<p class="text-gray-400 text-center py-8">Loading...</p>';
  try {
    const [rooms, walls] = await Promise.all([
      api('GET', '/api/routes/rooms'),
      api('GET', '/api/routes/walls'),
    ]);

    container.innerHTML = `
      <div class="space-y-8">

        <!-- Rooms -->
        <div>
          <div class="flex items-center justify-between mb-3">
            <div>
              <h3 class="text-lg font-semibold text-gray-900">Rooms</h3>
              <p class="text-sm text-gray-500">Named groups of walls (e.g. Main Room, Basement)</p>
            </div>
            <button onclick="showAddRoomModal()" class="px-4 py-2 bg-[#1E3A5F] hover:bg-[#2A4D7A] text-white text-sm font-medium rounded-lg transition">+ Add Room</button>
          </div>
          <div id="map-settings-rooms" class="bg-white border border-gray-200 rounded-xl overflow-hidden">
            ${rooms.length === 0
              ? '<p class="text-gray-400 text-sm text-center py-6">No rooms yet</p>'
              : rooms.map((r, i) => `
                <div class="flex items-center justify-between px-4 py-3 ${i < rooms.length - 1 ? 'border-b border-gray-100' : ''}">
                  <span class="text-sm font-medium text-gray-900">${r.name}</span>
                  <div class="flex gap-1">
                    <button onclick="showRenameRoomModal('${r.id}','${r.name.replace(/'/g, "\\'")}')" class="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                    </button>
                    <button onclick="deleteRoom('${r.id}')" class="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    </button>
                  </div>
                </div>
              `).join('')}
          </div>
        </div>

        <!-- Walls -->
        <div>
          <div class="flex items-center justify-between mb-3">
            <div>
              <h3 class="text-lg font-semibold text-gray-900">Walls</h3>
              <p class="text-sm text-gray-500">Draw the shape of each wall section on the floor plan</p>
            </div>
            <button onclick="showDrawWallModal()" class="px-4 py-2 bg-[#1E3A5F] hover:bg-[#2A4D7A] text-white text-sm font-medium rounded-lg transition">+ Draw Wall</button>
          </div>
          <div id="map-settings-walls" class="bg-white border border-gray-200 rounded-xl overflow-hidden">
            ${walls.length === 0
              ? '<p class="text-gray-400 text-sm text-center py-6">No walls yet — click "Draw Wall" to add one</p>'
              : walls.map((w, i) => {
                  const room = rooms.find(r => r.id === w.room_id);
                  const pts = Array.isArray(w.path_json) ? w.path_json : [];
                  return `
                    <div class="flex items-center justify-between px-4 py-3 ${i < walls.length - 1 ? 'border-b border-gray-100' : ''}">
                      <div class="flex items-center gap-3">
                        <div class="w-3 h-3 rounded-full" style="background:${w.colour || '#64748B'}"></div>
                        <div>
                          <p class="text-sm font-medium text-gray-900">${w.name}</p>
                          <p class="text-xs text-gray-400">${room ? room.name + ' · ' : ''}${pts.length} points</p>
                        </div>
                      </div>
                      <div class="flex gap-1">
                        <button onclick="showEditWallModal('${w.id}')" class="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition">
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                        </button>
                        <button onclick="deleteWallSetting('${w.id}')" class="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition">
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        </button>
                      </div>
                    </div>
                  `;
                }).join('')}
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<p class="text-red-400 text-center py-8">Error: ${err.message}</p>`;
  }
}

function showAddRoomModal() {
  showModal(`
    <div class="p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-bold text-gray-900">Add Room</h3>
        <button onclick="closeModal()" class="text-gray-400 hover:text-gray-600"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
      </div>
      <input id="new-room-name" type="text" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 mb-4" placeholder="e.g. Main Room">
      <div class="flex justify-end gap-2">
        <button onclick="closeModal()" class="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium">Cancel</button>
        <button onclick="saveNewRoom()" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">Add Room</button>
      </div>
    </div>
  `);
  setTimeout(() => document.getElementById('new-room-name')?.focus(), 50);
}

async function saveNewRoom() {
  const name = document.getElementById('new-room-name').value.trim();
  if (!name) { showToast('Enter a room name', 'error'); return; }
  try {
    await api('POST', '/api/routes/rooms', { name });
    closeModal();
    showToast('Room added', 'success');
    loadMapSettings();
  } catch (err) { showToast(err.message, 'error'); }
}

function showRenameRoomModal(id, currentName) {
  showModal(`
    <div class="p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-bold text-gray-900">Rename Room</h3>
        <button onclick="closeModal()" class="text-gray-400 hover:text-gray-600"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
      </div>
      <input id="rename-room-name" type="text" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 mb-4" value="${currentName}">
      <div class="flex justify-end gap-2">
        <button onclick="closeModal()" class="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium">Cancel</button>
        <button onclick="saveRenameRoom('${id}')" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">Save</button>
      </div>
    </div>
  `);
  setTimeout(() => { const el = document.getElementById('rename-room-name'); if (el) { el.focus(); el.select(); } }, 50);
}

async function saveRenameRoom(id) {
  const name = document.getElementById('rename-room-name').value.trim();
  if (!name) { showToast('Enter a room name', 'error'); return; }
  try {
    await api('PUT', `/api/routes/rooms/${id}`, { name });
    closeModal();
    showToast('Room renamed', 'success');
    loadMapSettings();
  } catch (err) { showToast(err.message, 'error'); }
}

async function deleteRoom(id) {
  if (!confirm('Delete this room? Walls assigned to it will become unassigned.')) return;
  try {
    await api('DELETE', `/api/routes/rooms/${id}`);
    showToast('Room deleted', 'success');
    loadMapSettings();
  } catch (err) { showToast(err.message, 'error'); }
}

// Draw Wall modal — reuses the same SVG canvas approach as the wizard
let _settingsWallDrawState = { points: [], drawing: false, colour: '#3B82F6' };

async function showDrawWallModal(existingWallId = null) {
  let existingWall = null;
  if (existingWallId) {
    try { existingWall = await api('GET', `/api/routes/walls/${existingWallId}`); } catch (_) {}
  }
  const rooms = await api('GET', '/api/routes/rooms');

  _settingsWallDrawState = {
    points: existingWall && Array.isArray(existingWall.path_json) ? existingWall.path_json : [],
    drawing: false,
    colour: existingWall?.colour || '#3B82F6',
  };

  document.getElementById('modal-content').className = 'bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto';
  showModal(`
    <div class="p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-bold text-gray-900">${existingWall ? 'Edit Wall' : 'Draw New Wall'}</h3>
        <button onclick="closeModal()" class="text-gray-400 hover:text-gray-600"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
      </div>
      <div class="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label class="block text-xs font-semibold text-gray-600 mb-1">Wall Name *</label>
          <input id="sw-wall-name" type="text" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-sm" value="${existingWall?.name || ''}" placeholder="e.g. Left Wall">
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-600 mb-1">Room</label>
          <select id="sw-wall-room" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-sm">
            <option value="">No room</option>
            ${rooms.map(r => `<option value="${r.id}" ${existingWall?.room_id === r.id ? 'selected' : ''}>${r.name}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="mb-3">
        <label class="block text-xs font-semibold text-gray-600 mb-2">Colour</label>
        <div class="flex gap-2 flex-wrap" id="sw-colour-row">
          ${['#3B82F6','#10B981','#F59E0B','#EF4444','#8B5CF6','#EC4899','#06B6D4','#64748B'].map(c => `
            <div onclick="selectSettingsWallColour('${c}')" style="width:24px;height:24px;background:${c};border-radius:50%;cursor:pointer;border:3px solid ${c === _settingsWallDrawState.colour ? '#fff' : 'transparent'};box-shadow:${c === _settingsWallDrawState.colour ? '0 0 0 2px '+c : 'none'}" data-colour="${c}"></div>
          `).join('')}
        </div>
      </div>
      <p class="text-xs text-gray-500 mb-2">Click to place points · Double-click to finish · <button onclick="clearSettingsWallDraw()" class="text-blue-500 hover:underline">Clear</button></p>
      <svg id="sw-map-svg" viewBox="0 0 800 500" style="width:100%;height:260px;background:#F8FAFC;border:1px solid #E5E7EB;border-radius:0.5rem;cursor:crosshair"
           onclick="settingsMapClick(event)" ondblclick="settingsMapDblClick(event)">
        <defs><pattern id="swgrid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="#E5E7EB" stroke-width="0.5"/></pattern></defs>
        <rect width="800" height="500" fill="url(#swgrid)"/>
        <g id="sw-existing-walls"></g>
        <polyline id="sw-drawing-line" points="" fill="none" stroke="${_settingsWallDrawState.colour}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
        <g id="sw-points-group"></g>
      </svg>
      <div class="flex justify-end gap-2 mt-4">
        <button onclick="closeModal()" class="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium">Cancel</button>
        <button onclick="saveSettingsWall(${existingWallId ? `'${existingWallId}'` : 'null'})" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">Save Wall</button>
      </div>
    </div>
  `);

  // Render existing walls as context, and pre-draw existing path
  setTimeout(() => {
    renderSettingsExistingWalls(existingWallId);
    renderSettingsDrawing();
  }, 50);
}

async function renderSettingsExistingWalls(skipId = null) {
  const g = document.getElementById('sw-existing-walls');
  if (!g) return;
  try {
    const walls = await api('GET', '/api/routes/walls');
    g.innerHTML = walls.filter(w => w.id !== skipId).map(w => {
      const pts = Array.isArray(w.path_json) ? w.path_json : [];
      if (pts.length < 2) return '';
      return `<polyline points="${pts.map(p => p[0]+','+p[1]).join(' ')}" fill="none" stroke="${w.colour || '#64748B'}" stroke-opacity="0.4" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
    }).join('');
  } catch (_) {}
}

function renderSettingsDrawing() {
  const line = document.getElementById('sw-drawing-line');
  const dotsG = document.getElementById('sw-points-group');
  if (!line || !dotsG) return;
  const pts = _settingsWallDrawState.points;
  line.setAttribute('points', pts.map(p => p[0]+','+p[1]).join(' '));
  line.setAttribute('stroke', _settingsWallDrawState.colour);
  dotsG.innerHTML = pts.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="${_settingsWallDrawState.colour}" stroke="white" stroke-width="1.5"/>`).join('');
}

function settingsMapClick(e) {
  if (e.detail >= 2) return; // ignore double-click
  const svg = document.getElementById('sw-map-svg');
  if (!svg) return;
  const pt = svg.createSVGPoint();
  pt.x = e.clientX; pt.y = e.clientY;
  const sp = pt.matrixTransform(svg.getScreenCTM().inverse());
  _settingsWallDrawState.points.push([Math.round(sp.x), Math.round(sp.y)]);
  renderSettingsDrawing();
}

function settingsMapDblClick(e) {
  // Remove last point (dblclick fires click twice) and finish
  if (_settingsWallDrawState.points.length > 0) _settingsWallDrawState.points.pop();
  renderSettingsDrawing();
}

function selectSettingsWallColour(c) {
  _settingsWallDrawState.colour = c;
  document.querySelectorAll('#sw-colour-row [data-colour]').forEach(el => {
    const isActive = el.getAttribute('data-colour') === c;
    el.style.border = `3px solid ${isActive ? '#fff' : 'transparent'}`;
    el.style.boxShadow = isActive ? `0 0 0 2px ${c}` : 'none';
  });
  renderSettingsDrawing();
}

function clearSettingsWallDraw() {
  _settingsWallDrawState.points = [];
  renderSettingsDrawing();
}

async function saveSettingsWall(existingId) {
  const name = document.getElementById('sw-wall-name').value.trim();
  if (!name) { showToast('Enter a wall name', 'error'); return; }
  if (_settingsWallDrawState.points.length < 2) { showToast('Draw at least 2 points to define a wall', 'error'); return; }
  const roomId = document.getElementById('sw-wall-room').value || null;
  const data = { name, colour: _settingsWallDrawState.colour, path_json: _settingsWallDrawState.points, room_id: roomId };
  try {
    if (existingId) {
      await api('PUT', `/api/routes/walls/${existingId}`, data);
      showToast('Wall updated', 'success');
    } else {
      await api('POST', '/api/routes/walls', data);
      showToast('Wall added', 'success');
    }
    closeModal();
    loadMapSettings();
    _routeWallsCache = []; // clear cache so routes page reloads walls
  } catch (err) { showToast(err.message, 'error'); }
}

function showEditWallModal(id) {
  showDrawWallModal(id);
}

async function deleteWallSetting(id) {
  if (!confirm('Delete this wall? Any climbs on it will be unassigned from the map.')) return;
  try {
    await api('DELETE', `/api/routes/walls/${id}`);
    showToast('Wall deleted', 'success');
    loadMapSettings();
    _routeWallsCache = [];
  } catch (err) { showToast(err.message, 'error'); }
}

// ============================================================
// Modal
// ============================================================

function showModal(html) {
  document.getElementById('modal-content').innerHTML = html;
  document.getElementById('modal-overlay').style.display = 'flex';
}

function closeModal() {
  document.getElementById('modal-overlay').style.display = 'none';
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

// Gym name — loaded from settings, used throughout the UI
window.gymName = 'Crux';
async function loadGymName() {
  try {
    const settings = await api('GET', '/api/settings');
    if (settings && settings.gym_name) {
      window.gymName = settings.gym_name;
      const sidebarFooter = document.getElementById('sidebar-gym-footer');
      if (sidebarFooter) {
        if (settings.gym_logo) {
          sidebarFooter.innerHTML = `<img id="sidebar-logo-img" src="${settings.gym_logo}" style="max-height:32px;max-width:120px;object-fit:contain;" alt="${settings.gym_name}">`;
        } else {
          sidebarFooter.textContent = settings.gym_name;
        }
      }
      document.title = settings.gym_name + ' · Crux';
    }
  } catch (e) { /* settings not critical for startup */ }
}
loadGymName();

// Init — no login required, check first run then load dashboard
restoreSession();
checkFirstRun();
loadPage('dashboard');

// ============================================================
// Onboarding Setup Wizard
// ============================================================

/**
 * Navigate to the Settings page (requires PIN) and open a specific tab.
 */
function navigateToSettings(tab) {
  settingsTab = tab;
  navigateTo('staff');
}

/**
 * Fetch onboarding status and render the sidebar checklist.
 * Also shows the welcome modal on first-ever page load if no steps are done.
 */
async function loadOnboardingStatus() {
  try {
    const status = await api('GET', '/api/onboarding/status');

    renderOnboardingChecklist(status);

    // Welcome modal: show once per session if 0 steps done and not yet dismissed
    if (!status.complete && !sessionStorage.getItem('crux_welcome_shown')) {
      const completedCount = Object.values(status.steps).filter(Boolean).length;
      if (completedCount === 0) {
        showWelcomeModal();
      }
    }
  } catch (e) {
    // Onboarding check is non-critical — silently ignore errors
  }
}

/**
 * Render the sidebar "Get started" checklist based on onboarding status.
 */
function renderOnboardingChecklist(status) {
  const el = document.getElementById('onboarding-checklist');
  if (!el) return;

  if (!status || status.complete) {
    el.style.display = 'none';
    return;
  }

  el.style.display = 'block';

  const stepDefs = [
    { key: 'gym_details', label: 'Set your gym name & details', tab: 'general' },
    { key: 'waiver',      label: 'Configure your waiver',       tab: 'waivers' },
    { key: 'pass_types',  label: 'Set up pass types',           tab: 'passes'  },
    { key: 'staff',       label: 'Add a staff member',          tab: 'staff'   },
  ];

  const completedCount = stepDefs.filter(s => status.steps[s.key]).length;
  const allStepsDone = completedCount === stepDefs.length;
  const totalDone = allStepsDone ? 5 : completedCount;

  const progressText = document.getElementById('onboarding-progress-text');
  if (progressText) progressText.textContent = `${totalDone} / 5 done`;

  const progressBar = document.getElementById('onboarding-progress-bar');
  if (progressBar) progressBar.style.width = ((totalDone / 5) * 100) + '%';

  const list = document.getElementById('onboarding-steps-list');
  if (!list) return;

  const stepItems = stepDefs.map(step => {
    const done = !!status.steps[step.key];
    return `
      <li>
        <button onclick="navigateToSettings('${step.tab}')"
                class="flex items-center gap-2 w-full text-left hover:text-white transition ${done ? 'text-slate-500' : 'text-slate-200'}">
          <span class="flex-shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center
                       ${done ? 'bg-blue-500 border-blue-500 text-white' : 'border-slate-500'}">
            ${done ? '<svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>' : ''}
          </span>
          <span class="text-xs ${done ? 'line-through opacity-50' : ''}">${step.label}</span>
        </button>
      </li>`;
  }).join('');

  // 5th item: "You're ready!" — auto-completes when all 4 steps done
  const readyItem = `
    <li>
      <div class="flex items-center gap-2 ${allStepsDone ? 'text-slate-200' : 'text-slate-600'}">
        <span class="flex-shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center
                     ${allStepsDone ? 'bg-blue-500 border-blue-500 text-white' : 'border-slate-600'}">
          ${allStepsDone ? '<svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>' : ''}
        </span>
        <span class="text-xs">You're ready!</span>
      </div>
    </li>`;

  list.innerHTML = stepItems + readyItem;
}

/**
 * Dismiss the onboarding checklist permanently.
 */
async function dismissOnboarding() {
  try {
    await api('POST', '/api/onboarding/dismiss');
    const el = document.getElementById('onboarding-checklist');
    if (el) el.style.display = 'none';
  } catch (e) {
    // ignore
  }
}

/**
 * Show the first-login welcome modal (once per session).
 */
function showWelcomeModal() {
  sessionStorage.setItem('crux_welcome_shown', '1');
  const el = document.getElementById('onboarding-welcome-modal');
  if (el) el.style.display = 'flex';
}

/**
 * Close the welcome modal.
 */
function closeWelcomeModal() {
  const el = document.getElementById('onboarding-welcome-modal');
  if (el) el.style.display = 'none';
}

// Load onboarding status on startup (non-blocking)
loadOnboardingStatus();

// ── Post-signup success detection ─────────────────────────────────────────
// When Stripe redirects back with ?signup=success, show the welcome modal.

function closeSignupSuccessModal() {
  const el = document.getElementById('signup-success-modal');
  if (el) el.style.display = 'none';
  sessionStorage.removeItem('crux_signup_flow');
  // Go to settings — will prompt for their newly created PIN
  navigateToSettings('general');
}

(function checkSignupSuccess() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('signup') === 'success') {
    // Clean the URL so refresh doesn't re-trigger
    window.history.replaceState({}, '', window.location.pathname);
    // Store flag so first-run flow can hand off to success modal
    sessionStorage.setItem('crux_signup_flow', '1');
    // Show modal after a short delay — but only if first-run overlay is NOT showing
    // (if it is showing, handleFirstRunSetup will show the modal after account creation)
    setTimeout(() => {
      const firstRun = document.getElementById('first-run-overlay');
      const isFirstRunVisible = firstRun && firstRun.style.display !== 'none';
      if (!isFirstRunVisible) {
        const el = document.getElementById('signup-success-modal');
        if (el) el.style.display = 'flex';
      }
    }, 600);
  }
})();
