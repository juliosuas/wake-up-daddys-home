// ============================================================
//  JARVIS ACTIVATION SYSTEM v3.1
//  Jeffrey-style voice briefing + toggle + play/pause
// ============================================================

(() => {
  'use strict';

  // ---- State ----
  var config = {
    dashboardUrl: 'http://192.168.1.66:8080',
    youtubeUrl: 'https://www.youtube.com/watch?v=BN1WwnEDWAM',
    voiceMessage: 'Buenas noches señor. Jeffrey OS esta en linea. Todos los sistemas estan operativos. Dashboard conectado. Feed de noticias en vivo. Esperando sus ordenes, señor.',
    voiceEnabled: true,
    sensitivity: 0.08,
  };
  var audioCtx, analyser, micStream, freqData, timeData;
  var activated = false;
  var lastClapTime = 0;
  var ytReady = false;
  var ytPlayerObj = null;
  var logCount = 0;
  var speechSynth = window.speechSynthesis;
  var COOLDOWN = 2000;

  // ---- DOM refs ----
  function $(s) { return document.getElementById(s); }
  var setupModal       = $('setupModal');
  var startBtn         = $('startBtn');
  var sensitivityInput = $('sensitivity');
  var sensitivityLabel = $('sensitivityLabel');
  var voiceEnabledCb   = $('voiceEnabled');
  var voiceToggleLabel = $('voiceToggleLabel');
  var voiceOptions     = $('voiceOptions');
  var matrixCanvas     = $('matrix');
  var matrixCtx        = matrixCanvas.getContext('2d');
  var micCanvas        = $('micCanvas');
  var micCtx           = micCanvas.getContext('2d');
  var levelFill        = $('levelFill');
  var levelThreshold   = $('levelThreshold');
  var hudStatus        = $('hudStatus');
  var hudSub           = $('hudSub');
  var terminalBody     = $('terminalBody');
  var reveal           = $('reveal');
  var revealLine2      = $('revealLine2');
  var voiceIndicator   = $('voiceIndicator');
  var voiceLabel       = $('voiceLabel');
  var voiceBtnToggle   = $('voiceBtnToggle');
  var logsBody         = $('logsBody');
  var logCountEl       = $('logCount');

  // ---- YouTube IFrame API ----
  window.onYouTubeIframeAPIReady = function () {
    var match = config.youtubeUrl.match(/(?:v=|youtu\.be\/|\/embed\/)([a-zA-Z0-9_-]{11})/);
    var videoId = match ? match[1] : 'BN1WwnEDWAM';

    ytPlayerObj = new YT.Player('ytPlayer', {
      videoId: videoId,
      playerVars: { autoplay: 0, controls: 0, modestbranding: 1 },
      events: {
        onReady: function () {
          ytReady = true;
          ytPlayerObj.setVolume(40);
        },
      },
    });
  };

  // ---- Voice Toggle ----
  voiceEnabledCb.addEventListener('change', function () {
    config.voiceEnabled = voiceEnabledCb.checked;
    voiceToggleLabel.textContent = config.voiceEnabled ? 'ENABLED' : 'DISABLED';
    voiceToggleLabel.classList.toggle('off', !config.voiceEnabled);
    voiceOptions.classList.toggle('disabled', !config.voiceEnabled);
  });

  // ---- Setup ----
  sensitivityInput.addEventListener('input', function () {
    config.sensitivity = parseFloat(sensitivityInput.value);
    sensitivityLabel.textContent = 'Threshold: ' + config.sensitivity.toFixed(2);
  });

  startBtn.addEventListener('click', async function () {
    config.dashboardUrl = $('dashboardUrl').value || config.dashboardUrl;
    config.youtubeUrl = $('youtubeUrl').value || config.youtubeUrl;
    config.voiceMessage = $('voiceMessage').value || config.voiceMessage;
    config.voiceEnabled = voiceEnabledCb.checked;
    config.sensitivity = parseFloat(sensitivityInput.value);

    try { localStorage.setItem('jarvis_config', JSON.stringify(config)); } catch (e) {}

    if (ytPlayerObj && ytReady) {
      var match = config.youtubeUrl.match(/(?:v=|youtu\.be\/|\/embed\/)([a-zA-Z0-9_-]{11})/);
      if (match) ytPlayerObj.cueVideoById(match[1]);
    }

    setupModal.classList.add('hidden');
    setTimeout(function () { setupModal.style.display = 'none'; }, 500);

    await initMicrophone();
  });

  // Load saved config
  try {
    var saved = JSON.parse(localStorage.getItem('jarvis_config'));
    if (saved) {
      config = { dashboardUrl: 'http://192.168.1.66:8080', youtubeUrl: 'https://www.youtube.com/watch?v=BN1WwnEDWAM', voiceMessage: config.voiceMessage, voiceEnabled: true, sensitivity: 0.08 };
      for (var key in saved) { if (saved.hasOwnProperty(key)) config[key] = saved[key]; }
      $('dashboardUrl').value = config.dashboardUrl;
      $('youtubeUrl').value = config.youtubeUrl;
      if ($('voiceMessage')) $('voiceMessage').value = config.voiceMessage;
      voiceEnabledCb.checked = config.voiceEnabled;
      voiceToggleLabel.textContent = config.voiceEnabled ? 'ENABLED' : 'DISABLED';
      voiceToggleLabel.classList.toggle('off', !config.voiceEnabled);
      voiceOptions.classList.toggle('disabled', !config.voiceEnabled);
      sensitivityInput.value = config.sensitivity;
      sensitivityLabel.textContent = 'Threshold: ' + config.sensitivity.toFixed(2);
    }
  } catch (e) {}

  // ---- Matrix Rain ----
  var MATRIX_CHARS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ<>{}[]|/\\=+*^~';
  var columns = [];
  var FONT_SIZE = 14;

  function resizeMatrix() {
    matrixCanvas.width = window.innerWidth;
    matrixCanvas.height = window.innerHeight;
    var cols = Math.floor(matrixCanvas.width / FONT_SIZE);
    if (columns.length !== cols) {
      columns = [];
      for (var i = 0; i < cols; i++) columns.push(Math.random() * matrixCanvas.height / FONT_SIZE | 0);
    }
  }

  function drawMatrix() {
    matrixCtx.fillStyle = 'rgba(10, 10, 15, 0.06)';
    matrixCtx.fillRect(0, 0, matrixCanvas.width, matrixCanvas.height);
    matrixCtx.font = FONT_SIZE + 'px monospace';

    for (var i = 0; i < columns.length; i++) {
      var ch = MATRIX_CHARS[Math.random() * MATRIX_CHARS.length | 0];
      var x = i * FONT_SIZE;
      var y = columns[i] * FONT_SIZE;
      matrixCtx.fillStyle = activated
        ? ('rgba(0, 229, 255, ' + (0.6 + Math.random() * 0.4) + ')')
        : ('rgba(0, 229, 255, ' + (0.15 + Math.random() * 0.15) + ')');
      matrixCtx.fillText(ch, x, y);
      if (y > matrixCanvas.height && Math.random() > 0.975) columns[i] = 0;
      else columns[i]++;
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
      var stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      micStream = audioCtx.createMediaStreamSource(stream);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.3;
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
      document.body.addEventListener('click', function () { if (!activated) activate(); }, { once: true });
    }
  }

  function updateThresholdMarker() {
    var pct = Math.min(config.sensitivity * 500, 100);
    levelThreshold.style.left = pct + '%';
  }

  // ---- Clap Detection ----
  function listenLoop() {
    if (activated) return;
    analyser.getByteTimeDomainData(timeData);
    analyser.getByteFrequencyData(freqData);

    var sum = 0;
    for (var i = 0; i < timeData.length; i++) {
      var v = (timeData[i] - 128) / 128;
      sum += v * v;
    }
    var rms = Math.sqrt(sum / timeData.length);

    var lowE = 0, highE = 0, mid = freqData.length / 2;
    for (var j = 0; j < freqData.length; j++) {
      if (j < mid) lowE += freqData[j]; else highE += freqData[j];
    }
    var spread = highE / (lowE + 1);

    var pct = Math.min(rms * 500, 100);
    levelFill.style.width = pct + '%';
    levelFill.classList.toggle('hot', rms > config.sensitivity * 0.7);
    drawMicVis();

    var now = Date.now();
    if (rms > config.sensitivity && spread > 0.1 && now - lastClapTime > COOLDOWN) {
      lastClapTime = now;
      activate();
      return;
    }
    requestAnimationFrame(listenLoop);
  }

  // ---- Mic Visualizer ----
  function drawMicVis() {
    var w = micCanvas.width, h = micCanvas.height;
    var cx = w / 2, cy = h / 2, r = 40;
    micCtx.clearRect(0, 0, w, h);
    if (!timeData) return;

    micCtx.beginPath();
    micCtx.strokeStyle = activated ? 'rgba(57,255,20,0.8)' : 'rgba(0,229,255,0.6)';
    micCtx.lineWidth = 1.5;
    var step = timeData.length / 360;
    for (var deg = 0; deg < 360; deg++) {
      var idx = Math.floor(deg * step);
      var val = (timeData[idx] - 128) / 128;
      var rad = (deg * Math.PI) / 180;
      var dist = r + val * 18;
      var px = cx + Math.cos(rad) * dist;
      var py = cy + Math.sin(rad) * dist;
      if (deg === 0) micCtx.moveTo(px, py); else micCtx.lineTo(px, py);
    }
    micCtx.closePath();
    micCtx.stroke();
    micCtx.shadowBlur = 8;
    micCtx.shadowColor = activated ? 'rgba(57,255,20,0.4)' : 'rgba(0,229,255,0.3)';
    micCtx.stroke();
    micCtx.shadowBlur = 0;
  }

  // ============================================================
  //  ACTIVATION
  // ============================================================
  function activate() {
    if (activated) return;
    activated = true;

    document.body.classList.add('flash');
    setTimeout(function () { document.body.classList.remove('flash'); }, 400);
    document.body.classList.add('active');
    hudStatus.textContent = 'ACTIVATED';
    hudSub.textContent = 'SYSTEMS ONLINE';

    showReveal();
    playYouTube();

    // Voice briefing (if enabled)
    if (config.voiceEnabled) {
      speakBriefing(config.voiceMessage);
    } else {
      voiceLabel.textContent = 'VOICE OFF';
      voiceBtnToggle.style.display = 'none';
    }

    fastBoot();
    startLogs();
    startPanels();

    setTimeout(function () {
      window.open(config.dashboardUrl, 'jarvis_dashboard');
      addLog('ok', 'Dashboard abierto: ' + config.dashboardUrl);
    }, 3500);

    continuousVis();
  }

  // ---- YouTube ----
  function playYouTube() {
    if (ytPlayerObj && ytReady) {
      ytPlayerObj.setVolume(40);
      ytPlayerObj.playVideo();
      addLog('ok', 'YouTube stream iniciado (vol 40%)');
    } else {
      window.open(config.youtubeUrl, 'jarvis_music');
      addLog('warn', 'YT API no listo, abierto en nueva pestaña');
    }
  }

  // ============================================================
  //  VOICE SYSTEM — Jeffrey OS style
  //  pickVoice(), speak(), play/pause toggle
  // ============================================================

  /**
   * Pick the best Spanish voice, fallback to English.
   * Priority: Google español > any Spanish > Google UK Male > Daniel > any English
   */
  function pickVoice() {
    var voices = speechSynth.getVoices();
    var order = [
      function (v) { return v.name.indexOf('Google') !== -1 && v.lang.startsWith('es'); },
      function (v) { return v.lang.startsWith('es') && v.name.indexOf('Male') !== -1; },
      function (v) { return v.lang.startsWith('es'); },
      function (v) { return v.name === 'Google UK English Male'; },
      function (v) { return v.name.indexOf('UK') !== -1 && v.lang.startsWith('en'); },
      function (v) { return v.name === 'Daniel'; },
      function (v) { return v.lang.startsWith('en'); },
    ];
    for (var o = 0; o < order.length; o++) {
      for (var i = 0; i < voices.length; i++) {
        if (order[o](voices[i])) return voices[i];
      }
    }
    return voices[0] || null;
  }

  /**
   * Speak text with JARVIS-style settings (pitch 0.8, rate 0.9)
   */
  function speakBriefing(text) {
    if (!speechSynth) {
      addLog('warn', 'Speech synthesis no disponible');
      return;
    }
    speechSynth.cancel();

    var utt = new SpeechSynthesisUtterance(text);
    utt.pitch = 0.8;   // Lower pitch — authoritative
    utt.rate = 0.9;    // Slower — deliberate, calm
    utt.volume = 1.0;  // Full volume, YouTube at 40%

    var voice = pickVoice();
    if (voice) utt.voice = voice;

    utt.onstart = function () {
      voiceIndicator.classList.add('speaking');
      voiceLabel.textContent = 'HABLANDO...';
      voiceBtnToggle.textContent = 'PAUSAR';
      voiceBtnToggle.classList.add('active');
      addLog('info', 'JARVIS hablando...');
    };
    utt.onend = function () {
      voiceIndicator.classList.remove('speaking');
      voiceLabel.textContent = 'BRIEFING COMPLETO';
      voiceBtnToggle.textContent = 'REPRODUCIR';
      voiceBtnToggle.classList.remove('active');
      addLog('ok', 'Briefing de voz completo');
    };
    utt.onerror = function () {
      voiceIndicator.classList.remove('speaking');
      voiceLabel.textContent = 'ERROR DE VOZ';
      voiceBtnToggle.textContent = 'REINTENTAR';
      voiceBtnToggle.classList.remove('active');
      addLog('error', 'Error en sintesis de voz');
    };

    // Small delay so music starts first
    setTimeout(function () { speechSynth.speak(utt); }, 300);
  }

  /**
   * Play / Pause / Resume toggle (like Jeffrey's toggleBriefing)
   */
  voiceBtnToggle.addEventListener('click', function () {
    if (!speechSynth) return;
    if (!config.voiceEnabled) return;

    // Currently speaking → pause
    if (speechSynth.speaking && !speechSynth.paused) {
      speechSynth.pause();
      voiceLabel.textContent = 'PAUSADO';
      voiceBtnToggle.textContent = 'REANUDAR';
      voiceIndicator.classList.remove('speaking');
      return;
    }

    // Paused → resume
    if (speechSynth.paused) {
      speechSynth.resume();
      voiceLabel.textContent = 'HABLANDO...';
      voiceBtnToggle.textContent = 'PAUSAR';
      voiceIndicator.classList.add('speaking');
      return;
    }

    // Not speaking → fresh briefing
    speakBriefing(config.voiceMessage);
  });

  // ---- Fast Boot Terminal ----
  function fastBoot() {
    var lines = [
      { text: 'JARVIS PROTOCOL v3.1 BOOT', cls: 'info' },
      { text: 'BIOMETRIC .......... AUTHORIZED', cls: 'success' },
      { text: 'NEURAL LINK ........ CONNECTED', cls: 'success' },
      { text: 'ENCRYPTION ......... AES-256', cls: 'success' },
      { text: 'MAINFRAME .......... ONLINE', cls: 'success' },
      { text: 'SATELLITE .......... LOCKED', cls: 'success' },
      { text: 'DASHBOARD: ' + config.dashboardUrl, cls: 'info' },
      { text: 'YOUTUBE ............ STREAMING', cls: 'info' },
      { text: 'VOICE .............. ' + (config.voiceEnabled ? 'ACTIVE' : 'DISABLED'), cls: config.voiceEnabled ? 'info' : 'warn' },
      { text: 'THREAT LEVEL ....... MINIMAL', cls: 'success' },
      { text: 'ALL SYSTEMS NOMINAL', cls: 'success' },
      { text: '>> BIENVENIDO DE VUELTA, SENOR.', cls: 'info' },
    ];
    typeLinesFast(lines, 15);
  }

  function typeLinesFast(lines, speed) {
    var li = 0;
    function next() {
      if (li >= lines.length) return;
      var text = lines[li].text;
      var cls = lines[li].cls;
      var el = document.createElement('div');
      el.className = 't-line' + (cls ? ' ' + cls : '');
      terminalBody.appendChild(el);
      if (!text) { li++; setTimeout(next, 30); return; }
      var ci = 0;
      function typeChar() {
        if (ci < text.length) {
          el.textContent += text[ci];
          ci++;
          setTimeout(typeChar, speed + Math.random() * 8);
        } else {
          li++;
          terminalBody.scrollTop = terminalBody.scrollHeight;
          setTimeout(next, 40);
        }
      }
      typeChar();
    }
    next();
  }

  // ---- Reveal ----
  function showReveal() {
    var hud = $('hud');
    hud.style.transition = 'opacity 0.3s';
    hud.style.opacity = '0.1';
    reveal.classList.add('show');
    setTimeout(function () { revealLine2.classList.add('show'); }, 800);
    setTimeout(function () {
      reveal.style.transition = 'opacity 2s';
      reveal.style.opacity = '0';
      hud.style.opacity = '1';
    }, 5000);
  }

  // ---- Logs ----
  function addLog(level, msg) {
    var now = new Date();
    var time = now.toTimeString().slice(0, 8);

    var entry = document.createElement('div');
    entry.className = 'log-entry';

    var timeSpan = document.createElement('span');
    timeSpan.className = 'log-time';
    timeSpan.textContent = time;

    var levelSpan = document.createElement('span');
    levelSpan.className = 'log-level ' + level;
    levelSpan.textContent = level.toUpperCase();

    var msgSpan = document.createElement('span');
    msgSpan.className = 'log-msg';
    msgSpan.textContent = msg;

    entry.appendChild(timeSpan);
    entry.appendChild(levelSpan);
    entry.appendChild(msgSpan);

    logsBody.appendChild(entry);
    logsBody.scrollTop = logsBody.scrollHeight;
    logCount++;
    logCountEl.textContent = logCount;
  }

  function startLogs() {
    addLog('info', 'JARVIS v3.1 activado');
    addLog('ok', 'Aplauso detectado');
    addLog('info', 'Stream de musica iniciado');
    if (config.voiceEnabled) addLog('info', 'Sintesis de voz iniciada');

    var baseMsgs = [
      ['ok', 'Heartbeat check OK'],
      ['info', 'Network scan: 14 hosts online'],
      ['ok', 'Firewall: activo'],
      ['info', 'CPU load'],
      ['ok', 'Memoria: 62.1 / 64 GB'],
      ['info', 'GPU temp'],
      ['ok', 'Disk I/O: nominal'],
      ['info', 'DNS: encriptado'],
      ['warn', 'Port scan detectado'],
      ['ok', 'Intrusion bloqueada'],
      ['info', 'Dashboard uptime'],
      ['ok', 'News feed: streaming'],
      ['info', 'AI inference'],
      ['ok', 'Enlace satelital: estable'],
      ['info', 'VPN tunnel: encriptado'],
    ];

    var idx = 0;
    setInterval(function () {
      var pair = baseMsgs[idx % baseMsgs.length];
      var level = pair[0];
      var base = pair[1];
      var finalMsg = base;
      if (base === 'CPU load') finalMsg = 'CPU load: ' + (85 + Math.random() * 13).toFixed(1) + '%';
      else if (base === 'GPU temp') finalMsg = 'GPU temp: ' + (60 + Math.random() * 12).toFixed(0) + 'C';
      else if (base === 'AI inference') finalMsg = 'AI inference: ' + (30 + Math.random() * 15).toFixed(0) + 'ms';
      else if (base === 'Port scan detectado') finalMsg = 'Port scan desde 10.0.0.' + (Math.random() * 254 | 0);
      else if (base === 'Dashboard uptime') finalMsg = 'Dashboard uptime: ' + (99.9 + Math.random() * 0.09).toFixed(2) + '%';
      addLog(level, finalMsg);
      idx++;
    }, 3500);
  }

  // ---- Continuous Visualizer ----
  function continuousVis() {
    if (!analyser) return;
    analyser.getByteTimeDomainData(timeData);
    analyser.getByteFrequencyData(freqData);
    drawMicVis();
    requestAnimationFrame(continuousVis);
  }

  // ---- Data Panels ----
  function startPanels() {
    var sets = {
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
        'MODEL: JARVIS v3.1', 'PARAMS: 175B', 'INFERENCE: 38ms',
        'CONFIDENCE: 99.8%', 'CONTEXT: 1M TOKENS', 'MODE: AUTONOMOUS',
        'LEARNING: ACTIVE', 'ACCURACY: 99.97%',
      ],
    };

    var keys = Object.keys(sets);
    for (var k = 0; k < keys.length; k++) {
      (function (id, lines) {
        var el = $(id);
        var offset = 0;
        function update() {
          var count = 4 + (Math.random() * 2 | 0);
          var out = '';
          for (var j = 0; j < count; j++) out += lines[(offset + j) % lines.length] + '\n';
          el.textContent = out;
          offset = (offset + 1) % lines.length;
        }
        update();
        setInterval(update, 2000 + Math.random() * 1500);
      })(keys[k], sets[keys[k]]);
    }
  }

})();
