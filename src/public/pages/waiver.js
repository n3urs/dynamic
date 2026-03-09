/**
 * Waiver Page — induction video + digital signing flow (Web Version)
 */

let waiverVideoWatched = false;
let waiverCurrentTemplate = null;
let waiverCurrentMember = null;
let waiverSignatureData = null;
let waiverDependentSignatureData = null;

async function openWaiverFlow(memberId, type = null) {
  const member = await api('GET', `/api/members/${memberId}`);
  if (!member) { showToast('Member not found', 'error'); return; }

  waiverCurrentMember = member;

  if (!type) {
    type = member.is_minor ? 'minor' : 'adult';
  }

  const template = await api('GET', `/api/waivers/templates/active/${type}`);
  if (!template) { showToast('No waiver template found for type: ' + type, 'error'); return; }

  waiverCurrentTemplate = template;
  waiverVideoWatched = false;
  waiverSignatureData = null;
  waiverDependentSignatureData = null;

  showWaiverVideoStep();
}

function showWaiverVideoStep() {
  const videoUrl = waiverCurrentTemplate.video_url || 'https://www.youtube.com/watch?v=-r2zbi21aks';
  const videoId = videoUrl.includes('v=') ? videoUrl.split('v=')[1].split('&')[0] : videoUrl.split('/').pop();

  showModal(`
    <div class="p-6">
      <h3 class="text-xl font-bold mb-2">${waiverCurrentTemplate.name}</h3>
      <p class="text-gray-500 text-sm mb-4">For: ${waiverCurrentMember.first_name} ${waiverCurrentMember.last_name}</p>

      <p class="text-sm text-gray-600 mb-4">Please watch the full induction video before continuing.</p>

      <div class="relative" style="padding-bottom:56.25%;height:0;overflow:hidden;border-radius:0.5rem">
        <iframe id="waiver-video" src="https://www.youtube.com/embed/${videoId}?enablejsapi=1&rel=0"
          style="position:absolute;top:0;left:0;width:100%;height:100%" frameborder="0"
          allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture" allowfullscreen>
        </iframe>
      </div>

      <div class="flex justify-between items-center mt-4">
        <label class="flex items-center gap-2 text-sm">
          <input type="checkbox" id="video-watched-check" onchange="waiverVideoChecked(this.checked)">
          <span>I have watched the full induction video</span>
        </label>
        <button id="waiver-continue-btn" onclick="showWaiverFormStep()" class="btn btn-primary" disabled>
          Continue to Form
        </button>
      </div>
    </div>
  `);
}

function waiverVideoChecked(checked) {
  waiverVideoWatched = checked;
  document.getElementById('waiver-continue-btn').disabled = !checked;
}

function showWaiverFormStep() {
  if (!waiverVideoWatched) return;

  const template = waiverCurrentTemplate;
  const content = template.content || {};
  const isMinor = template.type === 'minor';

  showModal(`
    <div class="p-6 max-h-[85vh] overflow-y-auto">
      <h3 class="text-xl font-bold mb-2">${template.name}</h3>
      <p class="text-gray-500 text-sm mb-6">For: ${waiverCurrentMember.first_name} ${waiverCurrentMember.last_name}</p>

      <form id="waiver-form" onsubmit="submitWaiver(event)">
        <div class="bg-gray-50 rounded-lg p-4 mb-6 max-h-60 overflow-y-auto text-sm text-gray-700 leading-relaxed">
          <h4 class="font-bold mb-2">CONDITIONS OF USE</h4>
          <p class="mb-2"><strong>Participation Statement:</strong> All climbing and bouldering activities have a risk of serious injury or death. Participants must be aware of and accept that even if they follow all good practice there may still be the risk of accident and injury.</p>
          <p class="mb-2">By signing this form, you are stating you understand that these risks cannot be completely removed.</p>
          <p class="italic text-gray-500 mt-2">Full conditions of use displayed during induction video. Scroll to continue.</p>
        </div>

        <h4 class="font-semibold text-gray-700 mb-3">Climber Details</h4>
        <div class="grid grid-cols-2 gap-4 mb-6">
          <div class="form-group col-span-2">
            <label class="form-label">Medical Requirements, If Any *</label>
            <input type="text" name="medical_conditions" class="form-input" placeholder="None, or describe..." required>
          </div>
          <div class="form-group col-span-2">
            <label class="form-label">Level of Climbing Experience? *</label>
            <div class="flex gap-4 mt-1">
              <label class="flex items-center gap-2 text-sm"><input type="radio" name="climbing_experience" value="new" required> New Climber</label>
              <label class="flex items-center gap-2 text-sm"><input type="radio" name="climbing_experience" value="few_times"> Climbed a few times</label>
              <label class="flex items-center gap-2 text-sm"><input type="radio" name="climbing_experience" value="regular"> Regular Climber</label>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Member of Other Walls? Which? *</label>
            <input type="text" name="other_walls" class="form-input" placeholder="None, or list..." required>
          </div>
          <div class="form-group">
            <label class="form-label">Times Climbed in Past 12 Months? *</label>
            <input type="text" name="climbs_12_months" class="form-input" placeholder="0, 5, 50+..." required>
          </div>
        </div>

        <h4 class="font-semibold text-gray-700 mb-3">Please Confirm the Following</h4>
        <div class="space-y-3 mb-6">
          ${(content.confirmation_questions || [
            'Do you understand that failure to exercise due care could result in injury or death?',
            'Have you watched the Induction Video?',
            'Have you fully read and understood this Participation Agreement?',
            'Do you agree to abide by the rules and conditions?',
            'Do you understand that the matting does not remove the risk of injury?',
            'Having watched the video, do you feel you know how to climb safely?',
            'Are you, the person filling out this form, over 18 years of age?',
            'Do you understand that failure to follow rules could result in being asked to leave?',
          ]).map((q, i) => `
            <label class="flex items-start gap-3 text-sm">
              <input type="checkbox" name="confirm_${i}" required class="mt-0.5 flex-shrink-0">
              <span>${q}</span>
            </label>
          `).join('')}
        </div>

        ${isMinor ? `
          <div class="space-y-3 mb-6">
            <label class="flex items-start gap-3 text-sm bg-blue-50 rounded-lg p-3">
              <input type="checkbox" name="photo_id_consent" required class="mt-0.5 flex-shrink-0">
              <span><strong>Under 18 Photo ID Consent</strong> — I confirm that I am the parent/legal guardian of the above-named child and I consent to the gym taking and storing a photograph of my child for identification purposes at the reception desk only.</span>
            </label>
          </div>

          <h4 class="font-semibold text-gray-700 mb-3">Minor/Dependent Details</h4>
          <div id="waiver-dependents">
            <div class="dependent-row grid grid-cols-4 gap-2 mb-2">
              <input type="text" name="dep_first_name_0" class="form-input" placeholder="First Name *" required>
              <input type="text" name="dep_last_name_0" class="form-input" placeholder="Last Name *" required>
              <input type="date" name="dep_dob_0" class="form-input" required>
              <select name="dep_gender_0" class="form-select">
                <option value="">Gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <button type="button" onclick="addDependentRow()" class="btn btn-sm btn-secondary mt-2 mb-6">+ Add Another Child</button>
        ` : ''}

        <div class="space-y-3 mb-6">
          <label class="flex items-start gap-3 text-sm">
            <input type="checkbox" name="medical_cert" required class="mt-0.5 flex-shrink-0">
            <span>I certify that to the best of my knowledge, I do not suffer from a medical condition that might make it more likely that I will be involved in an accident, OR I have discussed it with a duty manager.</span>
          </label>
          <label class="flex items-start gap-3 text-sm">
            <input type="checkbox" name="info_correct" required class="mt-0.5 flex-shrink-0">
            <span>I confirm that the above information is correct and if any information changes I will notify the centre.</span>
          </label>
          <label class="flex items-start gap-3 text-sm font-semibold">
            <input type="checkbox" name="final_declaration" required class="mt-0.5 flex-shrink-0">
            <span>I HAVE HAD SUFFICIENT OPPORTUNITY TO READ THIS ENTIRE DOCUMENT AND WATCH THE INDUCTION VIDEO. I HAVE UNDERSTOOD THE FORM AND VIDEO AND ACKNOWLEDGE I AM BOUND BY ITS TERMS.</span>
          </label>
        </div>

        <h4 class="font-semibold text-gray-700 mb-3">${isMinor ? 'Parent/Guardian Signature' : 'Signature'}</h4>
        <div class="border border-gray-300 rounded-lg mb-4 bg-white" style="height:120px;position:relative">
          <canvas id="sig-canvas-supervisee" style="width:100%;height:100%;cursor:crosshair"></canvas>
          <button type="button" onclick="clearSignature('supervisee')" class="absolute top-2 right-2 text-xs text-gray-400 hover:text-red-500">Clear</button>
        </div>

        ${isMinor ? `
          <h4 class="font-semibold text-gray-700 mb-3">Dependent Signature</h4>
          <div class="border border-gray-300 rounded-lg mb-4 bg-white" style="height:120px;position:relative">
            <canvas id="sig-canvas-dependent" style="width:100%;height:100%;cursor:crosshair"></canvas>
            <button type="button" onclick="clearSignature('dependent')" class="absolute top-2 right-2 text-xs text-gray-400 hover:text-red-500">Clear</button>
          </div>
        ` : ''}

        <h4 class="font-semibold text-gray-700 mb-3">Emergency Contact</h4>
        <div class="grid grid-cols-2 gap-4 mb-6">
          <div class="form-group">
            <label class="form-label">Emergency Contact Name *</label>
            <input type="text" name="emergency_contact_name" class="form-input" value="${waiverCurrentMember.emergency_contact_name || ''}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Emergency Contact Number *</label>
            <input type="tel" name="emergency_contact_phone" class="form-input" value="${waiverCurrentMember.emergency_contact_phone || ''}" required>
          </div>
        </div>

        <div class="flex justify-end gap-2">
          <button type="button" onclick="closeModal()" class="btn btn-secondary">Cancel</button>
          <button type="submit" class="btn btn-primary btn-lg">Sign Waiver</button>
        </div>
      </form>
    </div>
  `);

  setTimeout(() => {
    initSignatureCanvas('sig-canvas-supervisee', 'supervisee');
    if (waiverCurrentTemplate.type === 'minor') {
      initSignatureCanvas('sig-canvas-dependent', 'dependent');
    }
  }, 100);
}

let dependentCount = 1;
function addDependentRow() {
  const container = document.getElementById('waiver-dependents');
  const i = dependentCount++;
  const row = document.createElement('div');
  row.className = 'dependent-row grid grid-cols-4 gap-2 mb-2';
  row.innerHTML = `
    <input type="text" name="dep_first_name_${i}" class="form-input" placeholder="First Name *" required>
    <input type="text" name="dep_last_name_${i}" class="form-input" placeholder="Last Name *" required>
    <input type="date" name="dep_dob_${i}" class="form-input" required>
    <select name="dep_gender_${i}" class="form-select">
      <option value="">Gender</option>
      <option value="male">Male</option>
      <option value="female">Female</option>
      <option value="other">Other</option>
    </select>
  `;
  container.appendChild(row);
}

const signatureContexts = {};

function initSignatureCanvas(canvasId, name) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;

  ctx.strokeStyle = '#1E3A5F';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';

  let drawing = false;

  canvas.addEventListener('mousedown', (e) => {
    drawing = true;
    ctx.beginPath();
    ctx.moveTo(e.offsetX, e.offsetY);
  });
  canvas.addEventListener('mousemove', (e) => {
    if (!drawing) return;
    ctx.lineTo(e.offsetX, e.offsetY);
    ctx.stroke();
  });
  canvas.addEventListener('mouseup', () => { drawing = false; });
  canvas.addEventListener('mouseleave', () => { drawing = false; });

  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    drawing = true;
    const touch = e.touches[0];
    const r = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(touch.clientX - r.left, touch.clientY - r.top);
  });
  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (!drawing) return;
    const touch = e.touches[0];
    const r = canvas.getBoundingClientRect();
    ctx.lineTo(touch.clientX - r.left, touch.clientY - r.top);
    ctx.stroke();
  });
  canvas.addEventListener('touchend', () => { drawing = false; });

  signatureContexts[name] = { canvas, ctx };
}

function clearSignature(name) {
  const entry = signatureContexts[name];
  if (!entry) return;
  entry.ctx.clearRect(0, 0, entry.canvas.width, entry.canvas.height);
}

function getSignatureData(name) {
  const entry = signatureContexts[name];
  if (!entry) return null;

  const pixels = entry.ctx.getImageData(0, 0, entry.canvas.width, entry.canvas.height).data;
  let hasContent = false;
  for (let i = 3; i < pixels.length; i += 4) {
    if (pixels[i] > 0) { hasContent = true; break; }
  }

  if (!hasContent) return null;
  return entry.canvas.toDataURL('image/png');
}

async function submitWaiver(e) {
  e.preventDefault();

  const form = document.getElementById('waiver-form');
  const formData = Object.fromEntries(new FormData(form));

  const sigSupervisee = getSignatureData('supervisee');
  if (!sigSupervisee) {
    showToast('Please sign the form', 'error');
    return;
  }

  let sigDependent = null;
  if (waiverCurrentTemplate.type === 'minor') {
    sigDependent = getSignatureData('dependent');
    if (!sigDependent) {
      showToast('Dependent signature required', 'error');
      return;
    }
  }

  let dependents = null;
  if (waiverCurrentTemplate.type === 'minor') {
    dependents = [];
    for (let i = 0; i < dependentCount; i++) {
      const fn = formData[`dep_first_name_${i}`];
      if (fn) {
        dependents.push({
          first_name: fn,
          last_name: formData[`dep_last_name_${i}`],
          date_of_birth: formData[`dep_dob_${i}`],
          gender: formData[`dep_gender_${i}`] || null,
        });
      }
    }
  }

  // Update member
  await api('PUT', `/api/members/${waiverCurrentMember.id}`, {
    emergency_contact_name: formData.emergency_contact_name,
    emergency_contact_phone: formData.emergency_contact_phone,
    medical_conditions: formData.medical_conditions,
    climbing_experience: formData.climbing_experience,
    member_of_other_walls: formData.other_walls,
    climbs_past_12_months: formData.climbs_12_months,
    photo_id_consent: formData.photo_id_consent ? 1 : 0,
  });

  // Sign waiver
  try {
    await api('POST', '/api/waivers/sign', {
      member_id: waiverCurrentMember.id,
      waiver_template_id: waiverCurrentTemplate.id,
      form_data: formData,
      signature_supervisee: sigSupervisee,
      signature_dependent: sigDependent,
      video_watched: true,
      dependents,
    });

    closeModal();
    showToast(`Waiver signed for ${waiverCurrentMember.first_name}`, 'success');

    const activePage = document.querySelector('.page.active');
    if (activePage) {
      const pageId = activePage.id.replace('page-', '');
      loadPage(pageId);
    }
  } catch (err) {
    showToast('Error signing waiver: ' + err.message, 'error');
  }
}
