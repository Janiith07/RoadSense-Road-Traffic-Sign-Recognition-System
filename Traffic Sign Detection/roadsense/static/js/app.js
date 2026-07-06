/* ══════════════════════════════════════════════
   RoadSense v2 — app.js
   ══════════════════════════════════════════════ */

/* ── SVG gradient def for ring ── */
document.body.insertAdjacentHTML('afterbegin', `
  <svg class="hidden-defs" style="position:absolute;width:0;height:0;overflow:hidden;">
    <defs>
      <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%"   stop-color="#2563EB"/>
        <stop offset="100%" stop-color="#06B6D4"/>
      </linearGradient>
    </defs>
  </svg>
`);

/* ── Canvas background removed in v3 (light theme uses road photo instead) ── */

/* ══ NAVBAR SCROLL ══ */
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 40);
}, { passive: true });

/* ══ ELEMENT REFS ══ */
const dropZone      = document.getElementById('dropZone');
const fileInput     = document.getElementById('fileInput');
const browseBtn     = document.getElementById('browseBtn');
const dropIdle      = document.getElementById('dropIdle');
const dropPreview   = document.getElementById('dropPreview');
const previewImg    = document.getElementById('previewImg');
const clearBtn      = document.getElementById('clearBtn');
const scanBeam      = document.getElementById('scanBeam');
const predictBtn    = document.getElementById('predictBtn');
const predictBtnText = document.getElementById('predictBtnText');
const btnSpinner    = document.getElementById('btnSpinner');
const uploadStatus  = document.getElementById('uploadStatus');
const processingBadge = document.getElementById('processingBadge');

const stateEmpty    = document.getElementById('stateEmpty');
const stateResult   = document.getElementById('stateResult');
const stateError    = document.getElementById('stateError');
const errorMsg      = document.getElementById('errorMsg');

const resultName    = document.getElementById('resultName');
const resultClassRaw = document.getElementById('resultClassRaw');
const confRingFill  = document.getElementById('confRingFill');
const confRingPct   = document.getElementById('confRingPct');
const confBarFill   = document.getElementById('confBarFill');
const confBarVal    = document.getElementById('confBarVal');
const resultTags    = document.getElementById('resultTags');

let currentFile = null;

/* ══ FILE HANDLING ══ */
browseBtn.addEventListener('click', e => { e.stopPropagation(); fileInput.click(); });
fileInput.addEventListener('change', () => {
  if (fileInput.files.length) handleFile(fileInput.files[0]);
});

/* Drag & drop */
dropZone.addEventListener('dragover',  e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
});

/* Click on idle area */
dropZone.addEventListener('click', e => {
  if (!e.target.closest('#browseBtn') && !e.target.closest('#clearBtn') && dropIdle.style.display !== 'none') {
    fileInput.click();
  }
});

/* Clear */
clearBtn.addEventListener('click', e => {
  e.stopPropagation();
  resetUpload();
  showState('empty');
});

/* ── Handle file ── */
function handleFile(file) {
  const allowed = ['image/png','image/jpeg','image/jpg','image/bmp','image/webp'];
  if (!allowed.includes(file.type)) {
    showState('error', 'Unsupported file type. Please use PNG, JPG, JPEG, BMP or WEBP.');
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    showState('error', 'File too large. Maximum size is 10 MB.');
    return;
  }

  currentFile      = file;
  previewImg.src   = URL.createObjectURL(file);

  dropIdle.style.display    = 'none';
  dropPreview.style.display = 'flex';
  predictBtn.disabled       = false;

  setUploadStatus('ready', 'Ready');
  showState('empty');
}

function resetUpload() {
  currentFile = null;
  fileInput.value  = '';
  previewImg.src   = '';
  dropIdle.style.display    = 'flex';
  dropPreview.style.display = 'none';
  predictBtn.disabled       = true;
  scanBeam.classList.remove('active');
  setUploadStatus('idle', 'Waiting');
}

/* ══ PREDICT ══ */
predictBtn.addEventListener('click', runPrediction);

async function runPrediction() {
  if (!currentFile) return;

  // UI: loading
  predictBtn.disabled          = true;
  predictBtnText.style.display = 'none';
  btnSpinner.style.display     = 'block';
  scanBeam.classList.add('active');
  processingBadge.style.display = 'flex';
  setUploadStatus('ready', 'Analysing');
  showState('empty');

  const fd = new FormData();
  fd.append('image', currentFile);

  try {
    const res  = await fetch('/predict', { method: 'POST', body: fd });
    const data = await res.json();

    if (!res.ok || data.error) {
      showState('error', data.error || 'An unexpected error occurred.');
      return;
    }
    showResult(data);
    setUploadStatus('success', 'Done');

  } catch (err) {
    showState('error', 'Could not connect to the server. Make sure Flask is running on port 5000.');
  } finally {
    predictBtn.disabled          = false;
    predictBtnText.style.display = 'flex';
    btnSpinner.style.display     = 'none';
    scanBeam.classList.remove('active');
    processingBadge.style.display = 'none';
  }
}

/* ══ RENDER RESULT ══ */
function showResult(data) {
  showState('result');

  const conf     = data.confidence;           // 0–100
  const circumf  = 2 * Math.PI * 34;         // r=34 → 213.6

  /* Primary card */
  resultName.textContent     = data.prediction;
  resultClassRaw.textContent = data.class;

  /* Circular ring — animate via stroke-dashoffset */
  const offset = circumf - (conf / 100) * circumf;
  confRingFill.style.strokeDashoffset = circumf; // reset
  setTimeout(() => {
    confRingFill.style.transition       = 'stroke-dashoffset 1.2s cubic-bezier(0.22,1,0.36,1)';
    confRingFill.style.strokeDashoffset = offset;
  }, 80);

  /* Ring label */
  animateNumber(confRingPct, 0, conf, 1200, v => `${v.toFixed(0)}%`);

  /* Bar */
  confBarFill.style.width = '0%';
  confBarVal.textContent  = `${conf.toFixed(1)}%`;
  setTimeout(() => { confBarFill.style.width = `${conf}%`; }, 100);

  /* Tags */
  resultTags.innerHTML = `
    <span class="result-tag">✓ AI Verified</span>
    <span class="result-tag">15 Sign Types Checked</span>
  `;
}

/* ══ STATE MANAGER ══ */
function showState(state, msg) {
  stateEmpty.style.display  = 'none';
  stateResult.style.display = 'none';
  stateError.style.display  = 'none';

  if (state === 'empty')  { stateEmpty.style.display  = 'flex';  stateEmpty.style.flexDirection  = 'column'; }
  if (state === 'result') { stateResult.style.display = 'flex';  stateResult.style.flexDirection = 'column'; }
  if (state === 'error')  {
    stateError.style.display  = 'flex';
    stateError.style.flexDirection = 'column';
    errorMsg.textContent = msg || '';
    setUploadStatus('idle', 'Waiting');
  }
}

function setUploadStatus(type, text) {
  const dot  = uploadStatus.querySelector('.status-dot');
  const span = uploadStatus.querySelector('.status-text');
  dot.className  = `status-dot status-dot--${type}`;
  span.textContent = text;
}

/* ══ UTILS ══ */
function formatBytes(b) {
  if (b < 1024)        return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function animateNumber(el, from, to, duration, format) {
  const start = performance.now();
  function step(now) {
    const t = Math.min((now - start) / duration, 1);
    const e = 1 - Math.pow(1 - t, 3); // ease-out cubic
    el.textContent = format(from + (to - from) * e);
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

/* ══ INTERSECTION OBSERVER — class cards entrance ══ */
const cards = document.querySelectorAll('.class-card');
const io = new IntersectionObserver(entries => {
  entries.forEach((entry, i) => {
    if (entry.isIntersecting) {
      setTimeout(() => {
        entry.target.style.opacity   = '1';
        entry.target.style.transform = 'translateY(0)';
      }, i * 35);
      io.unobserve(entry.target);
    }
  });
}, { threshold: 0.1 });

cards.forEach(card => {
  card.style.opacity   = '0';
  card.style.transform = 'translateY(20px)';
  card.style.transition = 'opacity 0.45s ease, transform 0.45s ease';
  io.observe(card);
});
