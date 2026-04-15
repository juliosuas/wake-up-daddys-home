// ============================================================
//  JARVIS ACTIVATION SYSTEM v4.1
//  ElevenLabs voice — real AI voice, not robotic TTS
// ============================================================

(() => {
  'use strict';

  var config = {
    dashboardUrl: 'http://192.168.1.66:8080',
    youtubeUrl: 'https://www.youtube.com/watch?v=BN1WwnEDWAM',
    voiceMessage: 'Buenas noches senor. Jeffrey OS esta en linea. Todos los sistemas operativos. Dashboard conectado. Feed de noticias en vivo. Esperando sus ordenes, senor.',
    voiceEnabled: false,
    agentName: 'JARVIS',
    voiceId: 'onwK4e9ZLuTAKqWW03F9', // Daniel — British Broadcaster
    voiceLang: 'es',
    sensitivity: 0.15,
  };

  var audioCtx, analyser, micStream, freqData, timeData;
  var activated = false;
  var micInitialized = false;
  var lastClapTime = 0;
  var ytReady = false;
  var ytPlayerObj = null;
  var logCount = 0;
  var voiceAudio = null;
  var COOLDOWN = 800;

  function $(s) { return document.getElementById(s); }
  var setupModal       = $('setupModal');
  var startBtn         = $('startBtn');
  var sensitivityInput = $('sensitivity');
  var sensitivityLabel = $('sensitivityLabel');
  var voiceEnabledCb   = $('voiceEnabled');
  var voiceToggleLabel = $('voiceToggleLabel');
  var voiceOptions     = $('voiceOptions');
  var agentNameInput   = $('agentName');
  var voiceSelect      = $('voiceSelect');
  var voiceLangSelect  = $('voiceLang');
  var previewVoiceBtn  = $('previewVoiceBtn');
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
        onReady: function () { ytReady = true; ytPlayerObj.setVolume(40); },
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

  // ---- Preview Voice ----
  previewVoiceBtn.addEventListener('click', function () {
    var name = agentNameInput.value || 'JARVIS';
    var lang = voiceLangSelect.value;
    var preview = lang === 'es'
      ? (name + ' en linea. Sistemas operativos. Esperando ordenes, senor.')
      : (name + ' online. All systems operational. Awaiting your command, sir.');
    previewVoiceBtn.textContent = 'GENERATING...';
    previewVoiceBtn.disabled = true;
    playElevenLabsVoice(preview, function () {
      previewVoiceBtn.textContent = 'PREVIEW VOICE';
      previewVoiceBtn.disabled = false;
    });
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
    config.agentName = agentNameInput.value || 'JARVIS';
    config.voiceId = voiceSelect.value;
    config.voiceLang = voiceLangSelect.value;
    config.sensitivity = parseFloat(sensitivityInput.value);

    try { localStorage.setItem('jarvis_config', JSON.stringify(config)); } catch (e) {}
    document.title = config.agentName + ' // ACTIVATION SYSTEM';

    if (ytPlayerObj && ytReady) {
      var match = config.youtubeUrl.match(/(?:v=|youtu\.be\/|\/embed\/)([a-zA-Z0-9_-]{11})/);
      if (match) ytPlayerObj.cueVideoById(match[1]);
    }

    setupModal.classList.add('hidden');
    setTimeout(function () { setupModal.style.display = 'none'; }, 500);
    await initMicrophone();
  });

  // Check if launched in stealth mode (?stealth in URL)
  var stealthMode = window.location.search.indexOf('stealth') !== -1;

  if (stealthMode) {
    // Skip config, start listening immediately
    setupModal.style.display = 'none';
    initMicrophone();
  }

  // ---- Load saved config ----
  try {
    var saved = JSON.parse(localStorage.getItem('jarvis_config'));
    if (saved) {
      for (var key in saved) { if (saved.hasOwnProperty(key)) config[key] = saved[key]; }
      $('dashboardUrl').value = config.dashboardUrl;
      $('youtubeUrl').value = config.youtubeUrl;
      if ($('voiceMessage')) $('voiceMessage').value = config.voiceMessage;
      voiceEnabledCb.checked = config.voiceEnabled;
      voiceToggleLabel.textContent = config.voiceEnabled ? 'ENABLED' : 'DISABLED';
      voiceToggleLabel.classList.toggle('off', !config.voiceEnabled);
      voiceOptions.classList.toggle('disabled', !config.voiceEnabled);
      agentNameInput.value = config.agentName;
      voiceSelect.value = config.voiceId;
      voiceLangSelect.value = config.voiceLang;
      sensitivityInput.value = config.sensitivity;
      sensitivityLabel.textContent = 'Threshold: ' + config.sensitivity.toFixed(2);
    }
  } catch (e) {}

  // ---- Matrix Rain ----
  var MATRIX_CHARS = '01アカサタ<>{}|/*';
  var columns = [];
  var FONT_SIZE = 24;
  var matrixFrame = 0;

  function resizeMatrix() {
    matrixCanvas.width = Math.floor(window.innerWidth / 2);
    matrixCanvas.height = Math.floor(window.innerHeight / 2);
    matrixCanvas.style.width = window.innerWidth + 'px';
    matrixCanvas.style.height = window.innerHeight + 'px';
    matrixCanvas.style.imageRendering = 'pixelated';
    var cols = Math.floor(matrixCanvas.width / FONT_SIZE);
    columns = [];
    for (var i = 0; i < cols; i++) columns.push(Math.random() * matrixCanvas.height / FONT_SIZE | 0);
  }

  function drawMatrix() {
    matrixCtx.fillStyle = 'rgba(10, 10, 15, 0.1)';
    matrixCtx.fillRect(0, 0, matrixCanvas.width, matrixCanvas.height);
    matrixCtx.font = FONT_SIZE + 'px monospace';
    matrixCtx.fillStyle = activated ? 'rgba(0,229,255,0.6)' : 'rgba(0,229,255,0.18)';
    for (var i = 0; i < columns.length; i++) {
      var ch = MATRIX_CHARS[Math.random() * MATRIX_CHARS.length | 0];
      matrixCtx.fillText(ch, i * FONT_SIZE, columns[i] * FONT_SIZE);
      if (columns[i] * FONT_SIZE > matrixCanvas.height && Math.random() > 0.98) columns[i] = 0;
      else columns[i]++;
    }
  }

  var matrixFrameSkip = 0;
  function startMatrix() {
    function loop() {
      matrixFrameSkip++;
      if (matrixFrameSkip % 2 === 0) drawMatrix(); // 30fps
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }
  window.addEventListener('resize', resizeMatrix);
  resizeMatrix();
  startMatrix();

  // ---- Microphone ----
  async function initMicrophone() {
    if (micInitialized) return;
    micInitialized = true;
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
    levelThreshold.style.left = Math.min(config.sensitivity * 200, 100) + '%';
  }

  // ---- Clap Detection (peak detection — catches transients better than RMS) ----
  var listenFrame = 0;
  function listenLoop() {
    listenFrame++;
    analyser.getByteTimeDomainData(timeData);

    // Peak detection — finds the loudest sample in the buffer
    // Much better than RMS for short transients like claps
    var peak = 0;
    for (var i = 0; i < timeData.length; i++) {
      var v = Math.abs((timeData[i] - 128) / 128);
      if (v > peak) peak = v;
    }

    var pct = Math.min(peak * 200, 100);
    levelFill.style.width = pct + '%';
    levelFill.classList.toggle('hot', peak > config.sensitivity * 0.7);
    if (listenFrame % 2 === 0) drawMicVis();

    // Peak check — single clap should trigger
    // After activation, use higher threshold to avoid YouTube audio triggering re-clap
    var threshold = activated ? Math.max(config.sensitivity * 3, 0.5) : config.sensitivity;
    var now = Date.now();
    if (peak > threshold && now - lastClapTime > COOLDOWN) {
      lastClapTime = now;
      if (!activated) activate();
      else restoreWindows();
    }
    requestAnimationFrame(listenLoop);
  }

  // ---- Mic Visualizer ----
  function drawMicVis() {
    var w = micCanvas.width, h = micCanvas.height, cx = w / 2, cy = h / 2, r = 40;
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
      var px = cx + Math.cos(rad) * dist, py = cy + Math.sin(rad) * dist;
      if (deg === 0) micCtx.moveTo(px, py); else micCtx.lineTo(px, py);
    }
    micCtx.closePath();
    micCtx.stroke();
  }

  // ============================================================
  //  ELEVENLABS VOICE ENGINE
  // ============================================================

  function playElevenLabsVoice(text, onEnd) {
    // Stop any current playback
    if (voiceAudio) {
      voiceAudio.pause();
      voiceAudio = null;
    }

    voiceIndicator.classList.add('speaking');
    voiceLabel.textContent = config.agentName + ' HABLANDO...';
    voiceBtnToggle.textContent = 'PAUSAR';
    voiceBtnToggle.classList.add('active');
    addLog('info', config.agentName + ' generando voz...');

    fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        voiceId: config.voiceId,
        text: text,
        lang: config.voiceLang,
      }),
    })
    .then(function (res) {
      if (!res.ok) throw new Error('TTS error ' + res.status);
      return res.blob();
    })
    .then(function (blob) {
      var url = URL.createObjectURL(blob);
      voiceAudio = new Audio(url);
      voiceAudio.volume = 1.0;

      voiceAudio.onplay = function () {
        addLog('ok', config.agentName + ' hablando (ElevenLabs)');
      };
      voiceAudio.onended = function () {
        voiceIndicator.classList.remove('speaking');
        voiceLabel.textContent = 'BRIEFING COMPLETO';
        voiceBtnToggle.textContent = 'REPRODUCIR';
        voiceBtnToggle.classList.remove('active');
        addLog('ok', 'Briefing completo');
        URL.revokeObjectURL(url);
        voiceAudio = null;
        if (onEnd) onEnd();
      };
      voiceAudio.onerror = function () {
        voiceIndicator.classList.remove('speaking');
        voiceLabel.textContent = 'ERROR';
        voiceBtnToggle.textContent = 'REINTENTAR';
        voiceBtnToggle.classList.remove('active');
        addLog('error', 'Error reproduciendo audio');
        if (onEnd) onEnd();
      };

      voiceAudio.play();
    })
    .catch(function (err) {
      voiceIndicator.classList.remove('speaking');
      voiceLabel.textContent = 'ERROR';
      voiceBtnToggle.textContent = 'REINTENTAR';
      voiceBtnToggle.classList.remove('active');
      addLog('error', 'ElevenLabs: ' + err.message);
      if (onEnd) onEnd();
    });
  }

  // Play / Pause / Resume
  voiceBtnToggle.addEventListener('click', function () {
    if (!config.voiceEnabled) return;

    // Currently playing → pause
    if (voiceAudio && !voiceAudio.paused) {
      voiceAudio.pause();
      voiceLabel.textContent = 'PAUSADO';
      voiceBtnToggle.textContent = 'REANUDAR';
      voiceIndicator.classList.remove('speaking');
      return;
    }
    // Paused → resume
    if (voiceAudio && voiceAudio.paused && voiceAudio.currentTime > 0) {
      voiceAudio.play();
      voiceLabel.textContent = config.agentName + ' HABLANDO...';
      voiceBtnToggle.textContent = 'PAUSAR';
      voiceIndicator.classList.add('speaking');
      return;
    }
    // Fresh briefing
    playElevenLabsVoice(config.voiceMessage);
  });

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

    // Go fullscreen
    goFullscreen();

    showReveal();
    playYouTube();

    if (config.voiceEnabled) {
      // Voice starts 400ms after music
      setTimeout(function () { playElevenLabsVoice(config.voiceMessage); }, 400);
    } else {
      voiceLabel.textContent = 'VOICE OFF';
      voiceBtnToggle.style.display = 'none';
    }

    fastBoot();
    startLogs();
    startPanels();
    addLog('ok', 'Dashboard: ' + config.dashboardUrl);
    // listenLoop already running and draws mic vis
  }

  // ---- YouTube (embedded only, robust retry) ----
  function playYouTube() {
    var attempts = 0;
    function tryPlay() {
      if (ytPlayerObj && ytReady) {
        ytPlayerObj.setVolume(40);
        ytPlayerObj.playVideo();
        addLog('ok', 'YouTube (vol 40%)');
        return;
      }
      attempts++;
      if (attempts <= 10) {
        setTimeout(tryPlay, 500);
      } else {
        addLog('error', 'YouTube no pudo cargar despues de 10 intentos');
      }
    }
    tryPlay();
  }

  // ---- Fullscreen ----
  function goFullscreen() {
    var el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen();
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    else if (el.mozRequestFullScreen) el.mozRequestFullScreen();
  }

  // ---- Restore on re-clap (no flash, higher threshold to avoid false triggers) ----
  function restoreWindows() {
    goFullscreen();
    if (ytPlayerObj && ytReady && ytPlayerObj.getPlayerState() === 2) {
      ytPlayerObj.playVideo();
      addLog('ok', 'YouTube reanudado');
    }
    window.focus();
  }

  // ---- Fast Boot Terminal ----
  function fastBoot() {
    var name = config.agentName;
    var lines = [
      { text: name + ' PROTOCOL v4.1 BOOT', cls: 'info' },
      { text: 'BIOMETRIC .......... AUTHORIZED', cls: 'success' },
      { text: 'NEURAL LINK ........ CONNECTED', cls: 'success' },
      { text: 'ENCRYPTION ......... AES-256', cls: 'success' },
      { text: 'MAINFRAME .......... ONLINE', cls: 'success' },
      { text: 'VOICE ENGINE ....... ELEVENLABS AI', cls: 'info' },
      { text: 'AGENT .............. ' + name, cls: 'info' },
      { text: 'DASHBOARD: ' + config.dashboardUrl, cls: 'info' },
      { text: 'ALL SYSTEMS NOMINAL', cls: 'success' },
      { text: '>> BIENVENIDO DE VUELTA, SENOR.', cls: 'info' },
    ];
    var li = 0;
    function next() {
      if (li >= lines.length) return;
      var text = lines[li].text, cls = lines[li].cls;
      var el = document.createElement('div');
      el.className = 't-line' + (cls ? ' ' + cls : '');
      terminalBody.appendChild(el);
      var ci = 0;
      function typeChar() {
        if (ci < text.length) { el.textContent += text[ci]; ci++; setTimeout(typeChar, 8 + Math.random() * 3); }
        else { li++; terminalBody.scrollTop = terminalBody.scrollHeight; setTimeout(next, 15); }
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
    var ts = document.createElement('span'); ts.className = 'log-time'; ts.textContent = time;
    var lv = document.createElement('span'); lv.className = 'log-level ' + level; lv.textContent = level.toUpperCase();
    var ms = document.createElement('span'); ms.className = 'log-msg'; ms.textContent = msg;
    entry.appendChild(ts); entry.appendChild(lv); entry.appendChild(ms);
    logsBody.appendChild(entry);
    logsBody.scrollTop = logsBody.scrollHeight;
    logCount++;
    logCountEl.textContent = logCount;
  }

  function startLogs() {
    addLog('info', config.agentName + ' v4.1 activado');
    addLog('ok', 'Aplauso detectado');
    addLog('info', 'ElevenLabs voice: ' + config.voiceId.substring(0, 8));
    var baseMsgs = [
      ['ok', 'Heartbeat OK'], ['info', 'Network: 14 hosts'], ['ok', 'Firewall: activo'],
      ['info', 'CPU load'], ['ok', 'RAM: 62.1/64 GB'], ['info', 'GPU temp'],
      ['ok', 'Disk I/O: nominal'], ['warn', 'Port scan detectado'], ['ok', 'Intrusion bloqueada'],
      ['info', 'Dashboard uptime'], ['ok', 'News feed: streaming'], ['info', 'AI inference'],
    ];
    var idx = 0;
    setInterval(function () {
      var pair = baseMsgs[idx % baseMsgs.length];
      var level = pair[0], base = pair[1], finalMsg = base;
      if (base === 'CPU load') finalMsg = 'CPU: ' + (85 + Math.random() * 13).toFixed(1) + '%';
      else if (base === 'GPU temp') finalMsg = 'GPU: ' + (60 + Math.random() * 12).toFixed(0) + 'C';
      else if (base === 'AI inference') finalMsg = 'AI: ' + (30 + Math.random() * 15).toFixed(0) + 'ms';
      else if (base === 'Port scan detectado') finalMsg = 'Scan desde 10.0.0.' + (Math.random() * 254 | 0);
      else if (base === 'Dashboard uptime') finalMsg = 'Uptime: ' + (99.9 + Math.random() * 0.09).toFixed(2) + '%';
      addLog(level, finalMsg);
      idx++;
    }, 3500);
  }

  // continuousVis removed — listenLoop handles mic vis

  function startPanels() {
    var sets = {
      panelTLData: ['CPU: 97.8% [OVERDRIVE]','RAM: 62.1 / 64 GB','GPU: RTX 4090 @ 2.8GHz','VRAM: 23.4 / 24 GB','DISK I/O: 3.4 GB/s','CORE TEMP: 68C','UPTIME: 1247:42:18','THREADS: 4,291'],
      panelTRData: ['TARGET: 192.168.1.0/24','NODES ONLINE: 14','PORTS: 22,80,443,8080','LATENCY: 1.8ms','THROUGHPUT: 2.4 Gbps','FIREWALL: ACTIVE','ENCRYPTION: AES-256','STATUS: SECURE'],
      panelBLData: ['SOURCE: YOUTUBE STREAM','CODEC: OPUS 128kbps','CHANNELS: STEREO','SAMPLE: 48000 Hz','DASHBOARD: CONNECTED','NEWS FEED: LIVE','BUFFER: 240ms','SYNC: LOCKED'],
      panelBRData: ['MODEL: '+config.agentName+' v4.1','PARAMS: 175B','INFERENCE: 38ms','CONFIDENCE: 99.8%','CONTEXT: 1M TOKENS','MODE: AUTONOMOUS','LEARNING: ACTIVE','ACCURACY: 99.97%'],
    };
    var keys = Object.keys(sets);
    for (var k = 0; k < keys.length; k++) {
      (function (id, lines) {
        var el = $(id);
        var offset = 0;
        function update() {
          var count = 4 + (Math.random() * 2 | 0), out = '';
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
