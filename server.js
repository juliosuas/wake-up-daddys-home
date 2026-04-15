const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

app.listen(PORT, '0.0.0.0', () => {
  console.log(`
  ╔═══════════════════════════════════════════════╗
  ║                                               ║
  ║   ██╗ █████╗ ██████╗ ██╗   ██╗██╗███████╗     ║
  ║   ██║██╔══██╗██╔══██╗██║   ██║██║██╔════╝     ║
  ║   ██║███████║██████╔╝██║   ██║██║███████╗     ║
  ║   ██║██╔══██║██╔══██╗╚██╗ ██╔╝██║╚════██║     ║
  ║   ██║██║  ██║██║  ██║ ╚████╔╝ ██║███████║     ║
  ║   ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝  ╚═══╝  ╚═╝╚══════╝     ║
  ║                                               ║
  ║   ACTIVATION SYSTEM v2.0                      ║
  ║   http://localhost:${PORT}                        ║
  ║                                               ║
  ║   Open in browser → Clap to activate          ║
  ╚═══════════════════════════════════════════════╝
  `);
});
