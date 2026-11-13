# Remove-back v2 🚀

> **Next-Generation In-Browser AI Background Remover & Creative Studio**  
> Inspired by and reverse-engineered from **remove.bg** — rebuilt to run 100% locally and free in your browser with zero cloud server costs, no rate limits, and total data privacy!

---

## ✨ Features & Capabilities

- 🤖 **Neural Deep Learning Alpha Matting**:
  - Powered by `@imgly/background-removal` (ISNet neural architecture running via ONNX WebAssembly SIMD and WebGPU).
  - Sub-pixel boundary detection across complex flyaway hair, animal fur, transparent lace, and intricate product edges.
- ⚡ **Dual Engine Architecture**:
  - Real-time client-side fallback engine (Smart Euclidean Matting & Saliency) for instant offline processing on lower-spec hardware.
- 🔒 **100% Client-Side Privacy**:
  - Your images never leave your computer. No external API calls, no third-party cloud uploads, no tracking.
- 🎨 **Creative Studio & Backdrop Swapper**:
  - **Transparent PNG**: Classic checkered alpha transparency.
  - **Solid Colors**: Studio White, Clean Grey, Slate Black, Vibrant Blue, Cyan, Emerald, Amber, Red, Purple, and Custom Hex Color Picker.
  - **Preset Photographic Backdrops**: Minimalist Studio, Modern Office, Forest Nature, Golden Sunset, Cyberpunk Neon, and Luxury Architectural Interior.
  - **Custom Background Uploader**: Composite any custom photo from your computer behind your cut-out subject.
  - **Cinematic Depth-of-Field Blur**: Adjustable bokeh slider (0px to 25px).
- 🖌️ **Magic Brush (Erase & Restore)**:
  - Touch up subtle edges with the Erase brush or paint back omitted foreground details with the Restore brush.
  - Variable brush size slider (5px to 80px).
  - One-click "Reset to Cutout" button.
- 🪄 **AI Smart Select (Wand & Edge Refine)**:
  - Click-to-select object contours automatically with active contour BFS color-distance snapping.
  - Smart Select (+) and Smart Remove (-) modes with adjustable tolerance slider (5% to 65%).
  - **Refine Hair & Edges**: Guided filter alpha matting algorithm to smooth and feather complex edge transitions.
- ↩️ **Full History Engine (Undo / Redo)**:
  - Interactive Undo and Redo buttons in the workspace header.
  - Standard keyboard shortcuts: `Ctrl + Z` to undo, `Ctrl + Y` (or `Ctrl + Shift + Z`) to redo.
  - History tracking across brush strokes, AI wand selections, and backdrop changes.
- ↔️ **Interactive Comparison Split Slider**:
  - Draggable split-view slider comparing the original photo against the transparent/replaced cutout.
  - View mode toggles: **Comparison Split**, **Cutout Only**, or **Original Only**.
- 🌓 **Theme Switcher**:
  - Seamless Light and Dark mode with instant toggle in the navbar and persistent preference storage.
- 💾 **Export Options**:
  - **Download HD (PNG)**: Full native resolution transparent 32-bit PNG.
  - **Download (JPG)**: High-quality composite image with selected background.
  - **Copy Image to Clipboard**: Direct one-click copy to system clipboard (`ClipboardItem`) for instant pasting into CapCut, Photoshop, Figma, Canva, Word, or chat apps.
- 📋 **Seamless Input Options**:
  - Drag-and-drop file upload.
  - One-click file picker (JPG, PNG, WebP).
  - Global clipboard paste listener (`Ctrl + V` anywhere on the page).
  - 4 Built-in Interactive Test Samples: Person Portrait, Sneaker Product, Pet Animal, and Sports Car.

---

## 🚀 Quick Start Guide

### Option 1: Development Server (Vite)
Double-click `start-remove-back.bat` or run:
```bash
npm install
npm run dev
```
Opens automatically at `http://localhost:5173`.

### Option 2: Production Build & Preview
Double-click `start-production.bat` or run:
```bash
npm run build
npm run preview
```
Opens automatically at `http://localhost:4173`.

### Option 3: Standalone Zero-Dependency Server
Double-click `start-standalone.bat` or run:
```bash
python server.py
```
Serves the pre-compiled `dist/` directory on `http://localhost:8080` with Cross-Origin Isolation headers (`COOP`/`COEP`) enabled for maximum WebAssembly SIMD and WebGPU performance.

---

## 📁 Project Structure

```
magic_bg_v2/
├── dist/                     # Optimized production bundle (standalone static assets)
│   ├── assets/               # Compiled JS, CSS, WASM, and ONNX runtime bundles
│   ├── backgrounds/          # 6 High-resolution scene backdrops
│   ├── samples/              # 4 Built-in test photos (Person, Product, Pet, Car)
│   ├── coi-serviceworker.js  # Cross-Origin Isolation worker for WASM threads
│   └── index.html            # Compiled production entry point
├── public/                   # Public static assets
│   ├── backgrounds/          # Photographic backdrop presets (Studio, Office, Nature, etc.)
│   ├── samples/              # Sample images for instant one-click testing
│   ├── coi-serviceworker.js  # Service worker ensuring SharedArrayBuffer availability
│   ├── logo.svg              # Brand logo wordmark
│   ├── logo-icon.svg         # Favicon and brand emblem
│   └── custom-cursor.svg     # Modern ergonomic vector cursor
├── src/
│   ├── main.js               # Application logic, AI pipeline, undo/redo, canvas studio
│   └── style.css             # Minimalist design system, CSS variables, dark/light themes
├── index.html                # Main application template
├── package.json              # Project metadata and dependencies
├── vite.config.js            # Vite configuration with COOP/COEP headers
├── server.py                 # Standalone local HTTP server with COOP/COEP
├── start-remove-back.bat     # One-click dev launcher
├── start-production.bat      # One-click production preview launcher
├── start-standalone.bat      # One-click standalone Python server launcher
└── REVERSE_ENGINEERING_REPORT.md # Technical reverse-engineering analysis
```

---

## 🛠️ Technology Stack

- **Inference Runtime**: `@imgly/background-removal` via ONNX Runtime Web
- **Acceleration**: WebAssembly SIMD + WebGPU multithreading
- **Bundler & Dev Server**: Vite 6 / Rollup
- **UI Architecture**: Vanilla ES Modules with zero heavy UI framework overhead
- **Color Space & Matting**: HTML5 Canvas 2D Context, Guided Filter, Active Contour BFS

---

## 📜 License & Acknowledgments

- Reverse engineered from `remove.bg` (Kaleido AI / Canva).
- AI Model: ISNet Salient Object Detection (SOD) licensed under Apache-2.0.
- Released for educational, creator, and productivity workflows.
