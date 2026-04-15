require('dotenv').config();
const express = require('express');
const https = require('https');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.ELEVENLABS_API_KEY;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// List available voices
app.get('/api/voices', function (req, res) {
  var options = {
    hostname: 'api.elevenlabs.io',
    path: '/v1/voices',
    headers: { 'xi-api-key': API_KEY },
  };

  https.get(options, function (apiRes) {
    var chunks = [];
    apiRes.on('data', function (c) { chunks.push(c); });
    apiRes.on('end', function () {
      try {
        var data = JSON.parse(Buffer.concat(chunks).toString());
        var voices = (data.voices || []).map(function (v) {
          return {
            id: v.voice_id,
            name: v.name,
            gender: (v.labels || {}).gender || 'unknown',
            accent: (v.labels || {}).accent || '',
            language: (v.labels || {}).language || '',
            description: (v.labels || {}).description || '',
            useCase: (v.labels || {}).use_case || '',
            preview: v.preview_url || '',
          };
        });
        res.json({ voices: voices });
      } catch (e) {
        res.status(500).json({ error: 'Failed to parse voices' });
      }
    });
  }).on('error', function (e) {
    res.status(500).json({ error: e.message });
  });
});

// Text-to-speech proxy
app.post('/api/tts', function (req, res) {
  var voiceId = req.body.voiceId || 'onwK4e9ZLuTA'; // Daniel default
  var text = req.body.text || '';
  var lang = req.body.lang || 'en';

  if (!text) return res.status(400).json({ error: 'No text' });

  var modelId = 'eleven_multilingual_v2';

  var postData = JSON.stringify({
    text: text,
    model_id: modelId,
    voice_settings: {
      stability: 0.65,
      similarity_boost: 0.75,
      style: 0.3,
      use_speaker_boost: true,
    },
  });

  var options = {
    hostname: 'api.elevenlabs.io',
    path: '/v1/text-to-speech/' + voiceId,
    method: 'POST',
    headers: {
      'xi-api-key': API_KEY,
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg',
    },
  };

  var apiReq = https.request(options, function (apiRes) {
    if (apiRes.statusCode !== 200) {
      var errChunks = [];
      apiRes.on('data', function (c) { errChunks.push(c); });
      apiRes.on('end', function () {
        res.status(apiRes.statusCode).json({ error: Buffer.concat(errChunks).toString() });
      });
      return;
    }
    res.setHeader('Content-Type', 'audio/mpeg');
    apiRes.pipe(res);
  });

  apiReq.on('error', function (e) {
    res.status(500).json({ error: e.message });
  });

  apiReq.write(postData);
  apiReq.end();
});

app.listen(PORT, '0.0.0.0', function () {
  console.log('\n  JARVIS ACTIVATION SYSTEM v4.1');
  console.log('  http://localhost:' + PORT);
  console.log('  ElevenLabs: ' + (API_KEY ? 'CONFIGURED' : 'MISSING .env'));
  console.log('');
});
