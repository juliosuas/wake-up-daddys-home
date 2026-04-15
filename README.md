# JARVIS Activation System v2.0

> *"Wake up... daddy's home."*

A clap-activated Tony Stark experience. Clap your hands and watch the system come alive — matrix rain, JARVIS HUD animations, a hacker terminal sequence, your dashboard, and your song. Built for performances and demos.

![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue)

---

## What It Does

1. **You open the app** — a dark JARVIS interface appears, listening through your microphone
2. **You clap** — the system detects the impulse and triggers the activation sequence:
   - Flash effect + matrix rain intensifies
   - HUD rings accelerate, data panels light up
   - Terminal types out a boot sequence
   - **"WAKE UP... DADDY'S HOME"** glitch text reveal
   - Your **song plays via YouTube** (embedded, no Spotify dependency)
   - Your **dashboard opens** in a new tab

Everything is configurable from the setup screen — dashboard URL, YouTube song, mic sensitivity.

## Quick Start

```bash
git clone https://github.com/juliosuas/wake-up-daddys-home.git
cd wake-up-daddys-home
npm install
npm start
```

Open `http://localhost:3000` in your browser (Chrome recommended for mic access).

## Configuration

On first load you'll see the setup screen:

| Parameter | Default | Description |
|-----------|---------|-------------|
| **Dashboard URL** | `http://192.168.1.66:8080` | Your dashboard — opens in a new tab on activation |
| **YouTube URL** | Should I Stay or Should I Go | Any YouTube video URL — plays embedded on activation |
| **Sensitivity** | `0.30` | Mic threshold for clap detection (lower = more sensitive) |

Settings persist in `localStorage` — set once, use forever.

## How Clap Detection Works

The system uses the Web Audio API with two checks:

- **Amplitude spike** — RMS of the audio signal exceeds the sensitivity threshold
- **Frequency spread** — claps have energy distributed across the spectrum (unlike speech or music, which concentrate in specific bands)

Both conditions must be met, with a 2-second cooldown to prevent double triggers.

## Tech Stack

- **Frontend**: Vanilla JS, CSS3 animations, Web Audio API, Canvas
- **Backend**: Express (static file server)
- **Audio**: YouTube embed with autoplay
- **Visuals**: Matrix rain, rotating HUD rings, glitch text, terminal typing, data panels

## Project Structure

```
wake-up-daddys-home/
├── server.js           # Express server
├── public/
│   ├── index.html      # Main page + setup modal
│   ├── style.css       # All visual effects
│   └── app.js          # Clap detection + activation logic
├── package.json
└── .gitignore
```

## Requirements

- Node.js 18+
- A browser with microphone access (Chrome, Firefox, Edge)
- A microphone

## Tips for Performances

- **Test sensitivity** before going live — ambient noise varies by venue
- **Use Chrome** — best Web Audio API and autoplay support
- **Go fullscreen** (F11) for maximum impact
- **Lower sensitivity** (0.15-0.20) in quiet rooms, raise it (0.40-0.50) in noisy ones
- The setup screen lets you swap dashboard and song URLs on the fly

## License

MIT
