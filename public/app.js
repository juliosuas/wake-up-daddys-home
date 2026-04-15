// ============================================================
//  JARVIS ACTIVATION SYSTEM v2.0
//  Clap-triggered Tony Stark experience
//  YouTube + configurable dashboard
// ============================================================

(() => {
  'use strict';

  // ---- State ----
  let config = {
    dashboardUrl: 'http://192.168.1.66:8080',
    youtubeUrl: 'https://www.youtube.com/watch?v=BN1WwnEDWAM',
    sensitivity: 0.30,
  };
  let audioCtx, analyser, micStream, freqData, timeData;
  let activated = false;
  let lastClapTime = 0;
  const COOLDOWN = 2000;

  // ---- DOM refs ----
  const $ = (s) => document.getElementById(s);
  const setupModal   = $('setupModal');
  const startBtn     = $('startBtn');
  const sensitivityInput = $('sensitivity');
  const sensitivityLabel = $('sensitivityLabel');
  const matrixCanvas = $('matrix');
  const matrixCtx    = matrixCanvas.getContext('2d');
  const micCanvas    = $('micCanvas');
  const micCtx       = micCanvas.getContext('2d');
  const levelFill    = $('levelFill');
  const levelThreshold = $('levelThreshold');
  const hudStatus    = $('hudStatus');
  const hudSub       = $('hudSub');
  const terminalBody = $('terminalBody');
  const reveal       = $('reveal');
  const revealLine2  = $('revealLine2');
  const ytPlayer     = $('ytPlayer');

  // ---- Setup ----
  sensitivityInput.addEventListener('input', () => {
    config.sensitivity = parseFloat(sensitivityInput.value);
    sensitivityLabel.textContent = `Threshold: ${config.sensitivity.toFixed(2)}`;
  });

  startBtn.addEventListener('click', async () => {
    config.dashboardUrl = $('dashboardUrl').value || config.dashboardUrl;
    config.youtubeUrl = $('youtubeUrl').value || config.youtubeUrl;
    config.sensitivity = parseFloat(sensitivityInput.value);

    // Save config
    try { localStorage.setItem('jarvis_config', JSON.stringify(config)); } catch(e) {}

    setupModal.classList.add('hidden');
    setTimeout(() => { setupModal.style.display = 'none'; }, 500);

    await initMicrophone();
  });

  // Load saved config
  try {
    const saved = JSON.parse(localStorage.getItem('jarvis_config'));
    if (saved) {
      config = { ...config, ...saved };
      $('dashboardUrl').value = config.dashboardUrl;
      $('youtubeUrl').value = config.youtubeUrl;
      sensitivityInput.value = config.sensitivity;
      sensitivityLabel.textContent = `Threshold: ${config.sensitivity.toFixed(2)}`;
    }
  } catch(e) {}

  // ---- Matrix Rain ----
  const MATRIX_CHARS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ<>{}[]|/\\=+*^~';
  let columns = [];
  const FONT_SIZE = 14;

  function resizeMatrix() {
    matrixCanvas.width = window.innerWidth;
    matrixCanvas.height = window.innerHeight;
    const cols = Math.floor(matrixCanvas.width / FONT_SIZE);
    if (columns.length !== cols) {
      columns = Array.from({ length: cols }, () => Math.random() * matrixCanvas.height / FONT_SIZE | 0);
    }
  }

  function drawMatrix() {
    matrixCtx.fillStyle = 'rgba(10, 10, 15, 0.06)';
    matrixCtx.fillRect(0, 0, matrixCanvas.width, matrixCanvas.height);
    matrixCtx.font = FONT_SIZE + 'px monospace';

    for (let i = 0; i < columns.length; i++) {
      const ch = MATRIX_CHARS[Math.random() * MATRIX_CHARS.length | 0];
      const x = i * FONT_SIZE;
      const y = columns[i] * FONT_SIZE;

      // Head character brighter
      matrixCtx.fillStyle = activated
        ? `rgba(0, 229, 255, ${0.6 + Math.random() * 0.4})`
        : `rgba(0, 229, 255, ${0.15 + Math.random() * 0.15})`;
      matrixCtx.fillText(ch, x, y);

      if (y > matrixCanvas.height && Math.random() > 0.975) {
        columns[i] = 0;
      } else {
        columns[i]++;
      }
    }
    requestAnimationFrame(drawMatrix);
  }

  window.addEventListener('resize', resizeMatrix);
  resizeMatrix();
  drawMatrix();

  // ---- Microphone ----
  async function initMicrophone() {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      micStream = audioCtx.createMediaStreamSource(stream);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.4;
      micStream.connect(analyser);
      freqData = new Uint8Array(analyser.frequencyBinCount);
      timeData = new Uint8Array(analyser.fftSize);

      hudStatus.textContent = 'LISTENING';
      hudSub.textContent = 'CLAP TO ACTIVATE';

      updateThresholdMarker();
      listenLoop();
    } catch (err) {
      hudStatus.textContent = 'MIC DENIED';
      hudSub.textContent = 'CLICK ANYWHERE TO ACTIVATE';
      document.body.addEventListener('click', () => { if (!activated) activate(); }, { once: true });
    }
  }

  function updateThresholdMarker() {
    const pct = Math.min(config.sensitivity * 250, 100);
    levelThreshold.style.left = pct + '%';
  }

  // ---- Clap Detection ----
  function listenLoop() {
    if (activated) return;

    analyser.getByteTimeDomainData(timeData);
    analyser.getByteFrequencyData(freqData);

    // RMS from time domain
    let sum = 0;
    for (let i = 0; i < timeData.length; i++) {
      const v = (timeData[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / timeData.length);

    // Frequency spread check — claps have broad spectrum energy
    let lowEnergy = 0, highEnergy = 0;
    const mid = freqData.length / 2;
    for (let i = 0; i < freqData.length; i++) {
      if (i < mid) lowEnergy += freqData[i];
      else highEnergy += freqData[i];
    }
    const spread = highEnergy / (lowEnergy + 1);

    // Update level meter
    const pct = Math.min(rms * 300, 100);
    levelFill.style.width = pct + '%';
    levelFill.classList.toggle('hot', rms > config.sensitivity * 0.7);

    // Draw mic visualizer
    drawMicVis();

    // Detect clap
    const now = Date.now();
    if (rms > config.sensitivity && spread > 0.15 && now - lastClapTime > COOLDOWN) {
      lastClapTime = now;
      activate();
      return;
    }

    requestAnimationFrame(listenLoop);
  }

  // ---- Mic Visualizer (circular waveform) ----
  function drawMicVis() {
    const w = micCanvas.width;
    const h = micCanvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const r = 40;

    micCtx.clearRect(0, 0, w, h);

    if (!timeData) return;

    micCtx.beginPath();
    micCtx.strokeStyle = activated ? 'rgba(57,255,20,0.8)' : 'rgba(0,229,255,0.6)';
    micCtx.lineWidth = 1.5;

    const step = timeData.length / 360;
    for (let deg = 0; deg < 360; deg++) {
      const idx = Math.floor(deg * step);
      const v = (timeData[idx] - 128) / 128;
      const rad = (deg * Math.PI) / 180;
      const dist = r + v * 18;
      const x = cx + Math.cos(rad) * dist;
      const y = cy + Math.sin(rad) * dist;
      if (deg === 0) micCtx.moveTo(x, y);
      else micCtx.lineTo(x, y);
    }
    micCtx.closePath();
    micCtx.stroke();

    // Glow
    micCtx.shadowBlur = 8;
    micCtx.shadowColor = activated ? 'rgba(57,255,20,0.4)' : 'rgba(0,229,255,0.3)';
    micCtx.stroke();
    micCtx.shadowBlur = 0;
  }

  // ---- Activation ----
  async function activate() {
    if (activated) return;
    activated = true;

    // Flash
    document.body.classList.add('flash');
    setTimeout(() => document.body.classList.remove('flash'), 400);

    // Activate mode
    document.body.classList.add('active');
    hudStatus.textContent = 'ACTIVATED';
    hudSub.textContent = 'SYSTEMS ONLINE';

    // Terminal sequence
    const lines = [
      { text: 'JARVIS PROTOCOL v2.0 INITIALIZING...', cls: 'info' },
      { text: 'BIOMETRIC SCAN ................... AUTHORIZED', cls: 'success' },
      { text: 'NEURAL INTERFACE ................ CONNECTED', cls: 'success' },
      { text: 'QUANTUM ENCRYPTION .............. ACTIVE', cls: 'success' },
      { text: 'ACCESSING STARK INDUSTRIES MAINFRAME...', cls: '' },
      { text: 'SATELLITE UPLINK ................ LOCKED', cls: 'success' },
      { text: 'LOADING DASHBOARD: ' + config.dashboardUrl, cls: 'info' },
      { text: 'AI CORE TEMPERATURE: 42.7C', cls: '' },
      { text: 'THREAT ASSESSMENT ............... MINIMAL', cls: 'success' },
      { text: 'YOUTUBE STREAM .................. QUEUED', cls: 'info' },
      { text: '', cls: '' },
      { text: 'ALL SYSTEMS NOMINAL', cls: 'success' },
      { text: '', cls: '' },
      { text: '>> WELCOME BACK, SIR.', cls: 'info' },
    ];

    await typeLines(lines, 60);

    // Open YouTube (song)
    openYouTube();

    // Show reveal
    setTimeout(showReveal, 300);

    // Open dashboard after reveal
    setTimeout(() => {
      window.open(config.dashboardUrl, 'jarvis_dashboard');
    }, 3500);

    // Start data panels
    startPanels();

    // Keep visualizer running
    continuousVis();
  }

  // ---- YouTube ----
  function openYouTube() {
    // Extract video ID and build embed URL with autoplay
    const match = config.youtubeUrl.match(/(?:v=|youtu\.be\/|\/embed\/)([a-zA-Z0-9_-]{11})/);
    if (match) {
      const videoId = match[1];
      ytPlayer.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&start=0`;
      ytPlayer.style.display = 'none';
    } else {
      // Fallback: open in new tab
      window.open(config.youtubeUrl, '_blank');
    }
  }

  // ---- Terminal Typing ----
  function typeLines(lines, speed) {
    let li = 0;
    return new Promise(resolve => {
      function next() {
        if (li >= lines.length) { resolve(); return; }

        const { text, cls } = lines[li];
        const el = document.createElement('div');
        el.className = 't-line' + (cls ? ' ' + cls : '');
        terminalBody.appendChild(el);

        if (!text) { li++; setTimeout(next, 100); return; }

        let ci = 0;
        function typeChar() {
          if (ci < text.length) {
            el.textContent += text[ci];
            ci++;
            setTimeout(typeChar, speed + Math.random() * 20);
          } else {
            li++;
            terminalBody.scrollTop = terminalBody.scrollHeight;
            setTimeout(next, 120);
          }
        }
        typeChar();
      }
      next();
    });
  }

  // ---- Reveal ----
  function showReveal() {
    const hud = $('hud');
    hud.style.transition = 'opacity 0.5s';
    hud.style.opacity = '0.15';

    reveal.classList.add('show');

    setTimeout(() => { revealLine2.classList.add('show'); }, 1500);

    setTimeout(() => {
      reveal.style.transition = 'opacity 2s';
      reveal.style.opacity = '0';
      hud.style.opacity = '1';
    }, 6000);
  }

  // ---- Continuous Visualizer after activation ----
  function continuousVis() {
    if (!analyser) return;
    analyser.getByteTimeDomainData(timeData);
    analyser.getByteFrequencyData(freqData);
    drawMicVis();
    requestAnimationFrame(continuousVis);
  }

  // ---- Data Panels ----
  function startPanels() {
    const sets = {
      panelTLData: [
        'CPU: 97.8% [OVERDRIVE]', 'RAM: 62.1 / 64 GB', 'GPU: RTX 4090 @ 2.8GHz',
        'VRAM: 23.4 / 24 GB', 'DISK I/O: 3.4 GB/s', 'CORE TEMP: 68C',
        'UPTIME: 1247:42:18', 'THREADS: 4,291',
      ],
      panelTRData: [
        'TARGET: 192.168.1.0/24', 'NODES ONLINE: 14', 'PORTS: 22,80,443,8080',
        'LATENCY: 1.8ms', 'THROUGHPUT: 2.4 Gbps', 'FIREWALL: ACTIVE',
        'ENCRYPTION: AES-256', 'STATUS: SECURE',
      ],
      panelBLData: [
        'SOURCE: YOUTUBE STREAM', 'CODEC: OPUS 128kbps', 'CHANNELS: STEREO',
        'SAMPLE: 48000 Hz', 'DASHBOARD: CONNECTED', 'NEWS FEED: LIVE',
        'BUFFER: 240ms', 'SYNC: LOCKED',
      ],
      panelBRData: [
        'MODEL: JARVIS v4.2', 'PARAMS: 175B', 'INFERENCE: 38ms',
        'CONFIDENCE: 99.8%', 'CONTEXT: 1M TOKENS', 'MODE: AUTONOMOUS',
        'LEARNING: ACTIVE', 'ACCURACY: 99.97%',
      ],
    };

    Object.entries(sets).forEach(([id, lines]) => {
      const el = $(id);
      let offset = 0;
      function update() {
        const count = 4 + (Math.random() * 2 | 0);
        let out = '';
        for (let j = 0; j < count; j++) {
          out += lines[(offset + j) % lines.length] + '\n';
        }
        el.textContent = out;
        offset = (offset + 1) % lines.length;
      }
      update();
      setInterval(update, 2000 + Math.random() * 1500);
    });
  }

})();
