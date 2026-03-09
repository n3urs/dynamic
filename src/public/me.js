// Member Portal — me.js

const SESSION_KEY = 'crux_member_token';
const HOLD_COLOURS = {
  Black:'#1F2937',White:'#F9FAFB',Red:'#EF4444',Blue:'#3B82F6',Green:'#10B981',
  Yellow:'#FBBF24',Purple:'#8B5CF6',Orange:'#F97316',Pink:'#EC4899',Grey:'#6B7280',
  Teal:'#14B8A6',Mint:'#6EE7B7',Brown:'#92400E',Lime:'#84CC16',
};
const GRADE_COLOURS = {
  VB:'#6B7280',V0:'#10B981',V1:'#3B82F6',V2:'#F59E0B',V3:'#EF4444',
  V4:'#8B5CF6',V5:'#EC4899',V6:'#F97316',V7:'#14B8A6',V8:'#1E3A5F',V9:'#111827',
};

let _session = null;
let _mapData = null;
let _meGradeFilter = null;
let _currentTab = 'home';

// ── API helper ──────────────────────────────────────────────────────────────

async function meApi(method, path, body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (_session) opts.headers['Authorization'] = 'Bearer ' + _session.token;
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch('/api/me' + path, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

// ── Session ──────────────────────────────────────────────────────────────────

function saveSession(token, member) {
  _session = { token, member };
  localStorage.setItem(SESSION_KEY, JSON.stringify(_session));
}

function loadSession() {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY));
    if (s && s.token) { _session = s; return true; }
  } catch {}
  return false;
}

function logout() {
  localStorage.removeItem(SESSION_KEY);
  _session = null;
  document.getElementById('app-shell').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('hidden');
}

// ── Login flow ───────────────────────────────────────────────────────────────

async function requestCode() {
  const email = document.getElementById('me-email').value.trim();
  const errEl = document.getElementById('email-error');
  errEl.classList.add('hidden');
  if (!email || !email.includes('@')) { errEl.textContent = 'Enter a valid email'; errEl.classList.remove('hidden'); return; }

  const btn = document.querySelector('#email-step button');
  btn.textContent = 'Sending...'; btn.disabled = true;
  try {
    await meApi('POST', '/auth/request', { email });
    document.getElementById('otp-email-display').textContent = email;
    document.getElementById('email-step').classList.add('hidden');
    document.getElementById('otp-step').classList.remove('hidden');
    setTimeout(() => document.getElementById('me-otp')?.focus(), 100);
  } catch (err) {
    errEl.textContent = err.message; errEl.classList.remove('hidden');
  } finally {
    btn.textContent = 'Send Login Code'; btn.disabled = false;
  }
}

async function verifyCode() {
  const email = document.getElementById('me-email').value.trim();
  const token = document.getElementById('me-otp').value.trim();
  const errEl = document.getElementById('otp-error');
  errEl.classList.add('hidden');
  if (!token || token.length !== 6) { errEl.textContent = 'Enter the 6-digit code'; errEl.classList.remove('hidden'); return; }

  const btn = document.querySelector('#otp-step button');
  btn.textContent = 'Logging in...'; btn.disabled = true;
  try {
    const data = await meApi('POST', '/auth/verify', { email, token });
    saveSession(data.token, data.member);
    showApp();
  } catch (err) {
    errEl.textContent = err.message; errEl.classList.remove('hidden');
    btn.textContent = 'Log In'; btn.disabled = false;
  }
}

function showEmailStep() {
  document.getElementById('email-step').classList.remove('hidden');
  document.getElementById('otp-step').classList.add('hidden');
  document.getElementById('me-otp').value = '';
}

// ── App shell ────────────────────────────────────────────────────────────────

async function showApp() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app-shell').classList.remove('hidden');
  await loadHome();
}

function switchTab(tab) {
  _currentTab = tab;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + tab).classList.add('active');
  document.getElementById('tab-' + tab).classList.add('active');

  if (tab === 'map') loadMap();
  if (tab === 'logbook') loadLogbook();
  if (tab === 'noticeboard') loadNoticeboard();
}

// ── Home / QR ────────────────────────────────────────────────────────────────

async function loadHome() {
  try {
    const { member, passes, gym } = await meApi('GET', '/profile');
    _session.member = member;

    document.getElementById('home-name').textContent = member.first_name;
    if (gym.gym_name) document.title = gym.gym_name + ' · Member Portal';

    // QR code
    const qrData = member.qr_code || member.id;
    QRCode.toCanvas(document.getElementById('qr-canvas'), qrData, { width: 200, margin: 1, color: { dark: '#1E3A5F', light: '#FFFFFF' } });
    QRCode.toCanvas(document.getElementById('qr-fullscreen-canvas'), qrData, { width: 300, margin: 1, color: { dark: '#1E3A5F', light: '#FFFFFF' } });

    // Pass status
    if (passes.length > 0) {
      const p = passes[0];
      document.getElementById('home-pass').classList.remove('hidden');
      document.getElementById('home-pass-name').textContent = p.pass_name;
      const details = [];
      if (p.visits_remaining != null) details.push(`${p.visits_remaining} visits remaining`);
      if (p.expires_at) details.push(`Expires ${new Date(p.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`);
      document.getElementById('home-pass-detail').textContent = details.join(' · ');
    } else {
      document.getElementById('home-no-pass').classList.remove('hidden');
    }
    // Load stats
    loadStats();
  } catch (err) {
    if (err.message === 'Unauthorised' || err.message.includes('expired')) logout();
  }
}

async function loadStats() {
  try {
    const { sendsByGrade, totalSends, hardestGrade } = await meApi('GET', '/stats');
    if (totalSends === 0) return;

    document.getElementById('home-stats').classList.remove('hidden');
    document.getElementById('stat-total').textContent = totalSends;
    document.getElementById('stat-hardest').textContent = hardestGrade || '—';
    document.getElementById('stat-grades').textContent = sendsByGrade.length;

    const GRADE_ORDER = ['VB','V0','V1','V2','V3','V4','V5','V6','V7','V8','V9'];
    const maxCount = Math.max(...sendsByGrade.map(s => s.count), 1);
    const pyramid = document.getElementById('grade-pyramid');
    const gradeMap = Object.fromEntries(sendsByGrade.map(s => [s.grade, s.count]));

    pyramid.innerHTML = GRADE_ORDER.filter(g => gradeMap[g]).map(g => {
      const count = gradeMap[g] || 0;
      const pct = Math.round((count / maxCount) * 100);
      const fill = GRADE_COLOURS[g] || '#6B7280';
      return `
        <div class="flex items-center gap-2">
          <span class="text-xs font-bold w-6 text-right" style="color:${fill}">${g}</span>
          <div class="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
            <div style="width:${pct}%;background:${fill};height:100%;border-radius:9999px;transition:width 0.5s ease"></div>
          </div>
          <span class="text-xs text-gray-500 w-4">${count}</span>
        </div>
      `;
    }).join('');
  } catch {}
}

function showQRFullscreen() {
  document.getElementById('qr-fullscreen').classList.remove('hidden');
}
function hideQRFullscreen() {
  document.getElementById('qr-fullscreen').classList.add('hidden');
}

// ── Map ──────────────────────────────────────────────────────────────────────

async function loadMap() {
  if (!_mapData) {
    try {
      _mapData = await meApi('GET', '/map');
    } catch (err) {
      document.getElementById('me-route-list').innerHTML = `<p class="text-red-400 text-sm">${err.message}</p>`;
      return;
    }
  }
  renderMeMap();
  renderMeRouteList();
}

function renderMeMap() {
  const { walls, climbs } = _mapData;

  // Render walls
  const wallsG = document.getElementById('me-walls-group');
  wallsG.innerHTML = walls.map(w => {
    const pts = Array.isArray(w.path_json) ? w.path_json : [];
    if (pts.length < 2) return '';
    const pointsAttr = pts.map(p => `${p[0]},${p[1]}`).join(' ');
    const colour = w.colour || '#64748B';
    const mid = pts[Math.floor(pts.length / 2)];
    return `
      <polyline points="${pointsAttr}" fill="none" stroke="${colour}" stroke-opacity="0.7" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
      <text x="${mid[0]}" y="${mid[1] - 8}" text-anchor="middle" fill="${colour}" fill-opacity="0.9" font-size="11" font-weight="700">${w.name.toUpperCase()}</text>
    `;
  }).join('');

  // Render climb dots
  const climbsG = document.getElementById('me-climbs-group');
  const filtered = climbs.filter(c => !_meGradeFilter || c.grade === _meGradeFilter);
  climbsG.innerHTML = filtered.map(c => {
    if (c.map_x == null || c.map_y == null) return '';
    const fill = HOLD_COLOURS[c.colour] || '#6B7280';
    const textFill = ['Yellow','Mint','White'].includes(c.colour) ? '#1F2937' : '#fff';
    const sent = c.sent_by_me;
    return `
      <g onclick="toggleSend('${c.id}', ${sent})" style="cursor:pointer" data-climb="${c.id}">
        <circle cx="${c.map_x}" cy="${c.map_y}" r="14" fill="${fill}" stroke="${sent ? '#10B981' : 'white'}" stroke-width="${sent ? 3 : 2}"/>
        <text x="${c.map_x}" y="${c.map_y + 4}" text-anchor="middle" fill="${textFill}" font-size="8" font-weight="700">${c.grade}</text>
        ${sent ? `<circle cx="${c.map_x + 10}" cy="${c.map_y - 10}" r="6" fill="#10B981" stroke="white" stroke-width="1.5"/>
          <text x="${c.map_x + 10}" y="${c.map_y - 7}" text-anchor="middle" fill="white" font-size="7" font-weight="900">✓</text>` : ''}
      </g>
    `;
  }).join('');
}

function renderMeRouteList() {
  const { climbs } = _mapData;
  const filtered = climbs.filter(c => !_meGradeFilter || c.grade === _meGradeFilter);
  const list = document.getElementById('me-route-list');
  if (!filtered.length) {
    list.innerHTML = '<p class="text-gray-400 text-sm text-center py-6">No routes found</p>';
    return;
  }
  list.innerHTML = filtered.map(c => {
    const fill = HOLD_COLOURS[c.colour] || '#6B7280';
    const textFill = ['Yellow','Mint','White'].includes(c.colour) ? '#1F2937' : '#fff';
    return `
      <div class="bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-center gap-3">
        <div class="grade-badge text-${textFill === '#fff' ? 'white' : 'gray-900'}" style="background:${fill};color:${textFill}">${c.grade}</div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-semibold text-gray-900">${c.colour} · ${c.wall_name || 'Unknown wall'}</p>
          ${c.style_tags ? `<p class="text-xs text-gray-400 truncate">${c.style_tags}</p>` : ''}
          ${c.setter ? `<p class="text-xs text-gray-400">Set by ${c.setter}</p>` : ''}
        </div>
        <button onclick="toggleSend('${c.id}', ${c.sent_by_me})" class="send-btn flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${c.sent_by_me ? 'bg-green-500 text-white border-green-500' : 'bg-white text-gray-600 border-gray-200 hover:border-green-400 hover:text-green-600'}">
          ${c.sent_by_me ? '✓ Sent' : 'Mark sent'}
        </button>
      </div>
    `;
  }).join('');
}

async function toggleSend(climbId, isSent) {
  try {
    if (isSent) {
      await meApi('DELETE', `/climbs/${climbId}/send`);
    } else {
      await meApi('POST', `/climbs/${climbId}/send`);
    }
    // Update local state
    const climb = _mapData.climbs.find(c => c.id === climbId);
    if (climb) climb.sent_by_me = isSent ? 0 : 1;
    renderMeMap();
    renderMeRouteList();
  } catch (err) {
    alert(err.message);
  }
}

function setMeGradeFilter(grade) {
  _meGradeFilter = grade;
  document.querySelectorAll('[id^="me-filter-"]').forEach(btn => {
    btn.className = 'flex-shrink-0 px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-semibold rounded-full hover:bg-gray-200';
  });
  const activeId = grade ? `me-filter-${grade}` : 'me-filter-all';
  const activeBtn = document.getElementById(activeId);
  if (activeBtn) activeBtn.className = 'flex-shrink-0 px-3 py-1.5 bg-[#1E3A5F] text-white text-xs font-semibold rounded-full';
  if (_mapData) { renderMeMap(); renderMeRouteList(); }
}

// ── Logbook ──────────────────────────────────────────────────────────────────

async function loadLogbook() {
  const list = document.getElementById('logbook-list');
  list.innerHTML = '<p class="text-gray-400 text-sm text-center py-6">Loading...</p>';
  try {
    const sends = await meApi('GET', '/logbook');
    if (!sends.length) {
      list.innerHTML = '<p class="text-gray-400 text-sm text-center py-6">No sends yet — mark climbs on the map!</p>';
      return;
    }
    list.innerHTML = sends.map(s => {
      const fill = HOLD_COLOURS[s.colour] || '#6B7280';
      const textFill = ['Yellow','Mint','White'].includes(s.colour) ? '#1F2937' : '#fff';
      return `
        <div class="bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-center gap-3">
          <div class="grade-badge" style="background:${fill};color:${textFill}">${s.grade}</div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-gray-900">${s.colour} · ${s.wall_name || 'Unknown wall'}</p>
            ${s.style_tags ? `<p class="text-xs text-gray-400 truncate">${s.style_tags}</p>` : ''}
          </div>
          <p class="text-xs text-gray-400 flex-shrink-0">${new Date(s.sent_at).toLocaleDateString('en-GB', { day:'numeric', month:'short' })}</p>
        </div>
      `;
    }).join('');
  } catch (err) {
    list.innerHTML = `<p class="text-red-400 text-sm text-center py-6">${err.message}</p>`;
  }
}

// ── Noticeboard ──────────────────────────────────────────────────────────────

async function loadNoticeboard() {
  const list = document.getElementById('noticeboard-list');
  list.innerHTML = '<p class="text-gray-400 text-sm text-center py-6">Loading...</p>';
  try {
    const posts = await meApi('GET', '/noticeboard');
    if (!posts.length) {
      list.innerHTML = '<p class="text-gray-400 text-sm text-center py-6">No posts yet</p>';
      return;
    }
    list.innerHTML = posts.map(p => `
      <div class="bg-white rounded-xl border border-gray-100 p-4">
        <div class="flex items-start justify-between gap-2 mb-2">
          <h3 class="font-semibold text-gray-900 text-sm">${p.title}</h3>
          <span class="text-xs text-gray-400 flex-shrink-0">${new Date(p.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}</span>
        </div>
        ${p.body ? `<p class="text-sm text-gray-600 leading-relaxed">${p.body.replace(/\n/g, '<br>')}</p>` : ''}
        ${p.image_url ? `<img src="${p.image_url}" class="w-full rounded-lg mt-3 object-cover" style="max-height:200px">` : ''}
        ${p.posted_by ? `<p class="text-xs text-gray-400 mt-2">Posted by ${p.posted_by}</p>` : ''}
      </div>
    `).join('');
  } catch (err) {
    list.innerHTML = `<p class="text-red-400 text-sm text-center py-6">${err.message}</p>`;
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────

(async function init() {
  // Load gym name
  try {
    const res = await fetch('/api/settings/gym_name');
    const data = await res.json();
    if (data.value) {
      document.getElementById('me-gym-name').textContent = data.value;
      document.title = data.value + ' · Member Portal';
    }
  } catch {}

  if (loadSession()) {
    showApp();
  }
})();
