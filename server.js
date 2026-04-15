const express = require('express');
const { execFile } = require('child_process');
const path = require('path');

const app = express();
const PORT = 3000;
const DASHBOARD_URL = 'http://192.168.1.66:8080';
const SPOTIFY_TRACK = 'spotify:track:4RodJ4GEBgjmnrlDCgCmAh'; // Should I Stay or Should I Go - The Clash

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

function dbusSpotify(method, args) {
  return new Promise((resolve, reject) => {
    const baseArgs = [
      '--print-reply',
      '--dest=org.mpris.MediaPlayer2.spotify',
      '/org/mpris/MediaPlayer2',
    ];
    execFile('dbus-send', [...baseArgs, ...args], (error, stdout, stderr) => {
      if (error) return reject(error);
      resolve(stdout);
    });
  });
}

// Activate: play Spotify track via DBus
app.post('/api/activate', async (req, res) => {
  try {
    await dbusSpotify('OpenUri', [
      'org.mpris.MediaPlayer2.Player.OpenUri',
      `string:${SPOTIFY_TRACK}`,
    ]);
    console.log('>> ACTIVATED: Spotify playing "Should I Stay or Should I Go"');
    res.json({ ok: true, spotify: true, dashboardUrl: DASHBOARD_URL });
  } catch (err) {
    console.error('Spotify error:', err.message);
    res.json({ ok: true, spotify: false, dashboardUrl: DASHBOARD_URL, error: err.message });
  }
});

// Spotify status check
app.get('/api/spotify-status', (req, res) => {
  execFile('dbus-send', [
    '--print-reply',
    '--dest=org.mpris.MediaPlayer2.spotify',
    '/org/mpris/MediaPlayer2',
    'org.freedesktop.DBus.Properties.Get',
    'string:org.mpris.MediaPlayer2.Player',
    'string:PlaybackStatus',
  ], (error, stdout) => {
    if (error) return res.json({ running: false });
    const playing = stdout.includes('Playing');
    res.json({ running: true, playing });
  });
});

// Dashboard config
app.get('/api/config', (req, res) => {
  res.json({ dashboardUrl: DASHBOARD_URL });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`
  ╔══════════════════════════════════════════╗
  ║   JARVIS ACTIVATION SYSTEM ONLINE        ║
  ║   http://localhost:${PORT}                   ║
  ║                                          ║
  ║   Waiting for clap to activate...        ║
  ║   Dashboard: ${DASHBOARD_URL}      ║
  ║   Spotify Track: Should I Stay or Go     ║
  ╚══════════════════════════════════════════╝
  `);
});
