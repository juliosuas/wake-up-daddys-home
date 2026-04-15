// ========================================
// JARVIS ACTIVATION SYSTEM
// Clap detection + Tony Stark experience
// ========================================

const CLAP_THRESHOLD = 0.35;
const CLAP_COOLDOWN = 3000;
const DASHBOARD_URL_FALLBACK = 'http://192.168.1.66:8080';

let audioCtx, analyser, microphone, dataArray;
let isActivated = false;
let lastClapTime = 0;
let dashboardUrl = DASHBOARD_URL_FALLBACK;

// ---- MATRIX RAIN ----
const canvas = document.getElementById('matrix');
const ctx = canvas.getContext('2d');
let matrixColumns = [];
const matrixChars = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEF';

function initMatrix() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const fontSize = 14;
  const cols = Math.floor(canvas.width / fontSize);
  matrixColumns = Array(cols).fill(0);

  function drawMatrix() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#00f0ff22';
    ctx.font = fontSize + 'px monospace';

    matrixColumns.forEach((y, i) => {
      const char = matrixChars[Math.floor(Math.random() * matrixChars.length)];
      ctx.fillText(char, i * fontSize, y * fontSize);
      if (y * fontSize > canvas.height && Math.random() > 0.975) {
        matrixColumns[i] = 0;
      } else {
        matrixColumns[i] = y + 1;
      }
    });
    requestAnimationFrame(drawMatrix);
  }
  drawMatrix();
}

window.addEventListener('resize', () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
});

// ---- CLAP DETECTION ----
async function initAudio() {
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    microphone = audioCtx.createMediaStreamSource(stream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.3;
    microphone.connect(analyser);
    dataArray = new Uint8Array(analyser.frequencyBinCount);
    detectClap();
    document.getElementById('subStatus').textContent = 'CLAP TO ACTIVATE';
  } catch (err) {
    console.error('Microphone error:', err);
    document.getElementById('subStatus').textContent = 'MIC ACCESS DENIED — CLICK TO ACTIVATE';
    document.body.addEventListener('click', () => {
      if (!isActivated) activate();
    }, { once: true });
  }
}

function detectClap() {
  if (isActivated) return;

  analyser.getByteTimeDomainData(dataArray);

  // Calculate RMS amplitude
  let sum = 0;
  for (let i = 0; i < dataArray.length; i++) {
    const normalized = (dataArray[i] - 128) / 128;
    sum += normalized * normalized;
  }
  const rms = Math.sqrt(sum / dataArray.length);

  // Update level bar
  const levelBar = document.getElementById('levelBar');
  const pct = Math.min(rms * 300, 100);
  levelBar.style.width = pct + '%';
  levelBar.classList.toggle('hot', rms > CLAP_THRESHOLD * 0.7);

  // Check for clap
  const now = Date.now();
  if (rms > CLAP_THRESHOLD && now - lastClapTime > CLAP_COOLDOWN) {
    lastClapTime = now;
    activate();
    return;
  }

  requestAnimationFrame(detectClap);
}

// ---- ACTIVATION SEQUENCE ----
async function activate() {
  if (isActivated) return;
  isActivated = true;

  // Flash effect
  document.body.classList.add('flash');
  setTimeout(() => document.body.classList.remove('flash'), 300);

  // Hide standby elements
  document.getElementById('hud').style.transition = 'opacity 0.3s';

  // Activate body class for CSS transitions
  document.body.classList.add('activated');

  // Start terminal sequence
  const terminalLines = [
    'INITIALIZING JARVIS PROTOCOL v4.2.0...',
    'BIOMETRIC SCAN: AUTHORIZED',
    'NEURAL INTERFACE: CONNECTED',
    'ACCESSING STARK INDUSTRIES MAINFRAME...',
    'DECRYPTING QUANTUM CHANNELS... [OK]',
    'LOADING DASHBOARD: ' + dashboardUrl,
    'SATELLITE UPLINK: ESTABLISHED',
    'AI CORE TEMPERATURE: 42.7°C',
    'THREAT LEVEL: MINIMAL',
    'ALL SYSTEMS NOMINAL',
    '',
    'SPOTIFY > PLAYING: "Should I Stay or Should I Go" — The Clash',
    'DASHBOARD > STREAMING NEWS FEED',
    '',
    '>> WELCOME BACK, SIR.',
  ];

  await typeTerminal(terminalLines, 80);

  // Send activation to server (Spotify)
  try {
    const res = await fetch('/api/activate', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    const data = await res.json();
    if (data.dashboardUrl) dashboardUrl = data.dashboardUrl;
  } catch (e) {
    console.error('Server activation error:', e);
  }

  // Show reveal after terminal
  setTimeout(() => showReveal(), 500);

  // Open dashboard after reveal
  setTimeout(() => {
    window.open(dashboardUrl, '_blank');
  }, 4000);

  // Start data panels
  startDataPanels();
}

// ---- TERMINAL TYPING ----
function typeTerminal(lines, speed) {
  const terminal = document.getElementById('terminal');
  let lineIndex = 0;

  return new Promise((resolve) => {
    function nextLine() {
      if (lineIndex >= lines.length) { resolve(); return; }

      const lineEl = document.createElement('div');
      lineEl.className = 'line';
      terminal.appendChild(lineEl);

      const text = lines[lineIndex];
      let charIndex = 0;

      function typeChar() {
        if (charIndex < text.length) {
          lineEl.textContent += text[charIndex];
          charIndex++;
          setTimeout(typeChar, speed + Math.random() * 30);
        } else {
          lineIndex++;
          terminal.scrollTop = terminal.scrollHeight;
          setTimeout(nextLine, 150);
        }
      }
      typeChar();
    }
    nextLine();
  });
}

// ---- REVEAL ----
function showReveal() {
  const container = document.getElementById('revealContainer');
  const hud = document.getElementById('hud');

  // Fade out HUD center
  document.getElementById('centerStatus').style.opacity = '0';

  // Show "WAKE UP"
  container.classList.add('show');

  // After 1.5s show "DADDY'S HOME"
  setTimeout(() => {
    document.getElementById('revealSub').classList.add('show');
  }, 1500);

  // Fade out reveal after 5s
  setTimeout(() => {
    container.style.transition = 'opacity 2s';
    container.style.opacity = '0';
  }, 6000);
}

// ---- DATA PANELS (fake hacker data) ----
function startDataPanels() {
  const sysLines = [
    'CPU: 98.2% [TURBO]',
    'RAM: 62.4 GB / 64 GB',
    'GPU: RTX 4090 @ 2.8GHz',
    'VRAM: 23.1 / 24 GB',
    'DISK I/O: 3.2 GB/s',
    'TEMP: 67°C',
    'UPTIME: 847:23:01',
    'PROCESSES: 2,847',
  ];
  const netLines = [
    'SCAN: 192.168.1.0/24',
    'HOSTS FOUND: 14',
    'OPEN PORTS: 22,80,443,8080',
    'LATENCY: 2.1ms',
    'BANDWIDTH: 940 Mbps',
    'FIREWALL: ACTIVE',
    'VPN: ENCRYPTED',
    'DNS: SECURED',
  ];
  const audioLines = [
    'INPUT: MICROPHONE [ACTIVE]',
    'SAMPLE RATE: 48000 Hz',
    'CHANNELS: STEREO',
    'SPOTIFY: CONNECTED',
    'TRACK: Should I Stay...',
    'VOLUME: 78%',
    'EQ: FLAT',
    'LATENCY: 12ms',
  ];
  const neuralLines = [
    'MODEL: JARVIS-v4.2',
    'PARAMETERS: 175B',
    'INFERENCE: 42ms',
    'CONFIDENCE: 99.7%',
    'CONTEXT: 1M TOKENS',
    'STATUS: ONLINE',
    'LEARNING RATE: 0.001',
    'ACCURACY: 99.94%',
  ];

  function cyclePanel(el, lines) {
    let i = 0;
    function update() {
      const count = 3 + Math.floor(Math.random() * 3);
      let html = '';
      for (let j = 0; j < count; j++) {
        html += lines[(i + j) % lines.length] + '\n';
      }
      el.textContent = html;
      i = (i + 1) % lines.length;
    }
    update();
    setInterval(update, 2000 + Math.random() * 1000);
  }

  cyclePanel(document.getElementById('sysData'), sysLines);
  cyclePanel(document.getElementById('netData'), netLines);
  cyclePanel(document.getElementById('audioData'), audioLines);
  cyclePanel(document.getElementById('neuralData'), neuralLines);
}

// ---- FETCH CONFIG ----
async function loadConfig() {
  try {
    const res = await fetch('/api/config');
    const data = await res.json();
    if (data.dashboardUrl) dashboardUrl = data.dashboardUrl;
  } catch (e) {
    // use fallback
  }
}

// ---- INIT ----
window.addEventListener('DOMContentLoaded', () => {
  initMatrix();
  loadConfig();
  initAudio();
});
