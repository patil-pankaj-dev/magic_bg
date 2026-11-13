import { removeBackground, preload } from '@imgly/background-removal';

// Pre-warm the background removal AI model in background for instant responsiveness
try {
  preload({
    model: 'isnet_quint8',
    device: 'gpu'
  }).catch(() => {});
} catch (_) {}

// APPLICATION STATE
const state = {
  originalImage: null,
  originalBlob: null,
  originalWidth: 0,
  originalHeight: 0,
  cutoutCanvas: null,
  pristineCutoutCanvas: null,
  currentBgType: 'transparent', // 'transparent' | 'color' | 'image'
  currentBgColor: 'transparent',
  currentBgImage: null,
  currentBlur: 0,
  isProcessing: false,
  activeTab: 'tab-bg', // 'tab-bg' | 'tab-brush' | 'tab-ai-select'
  brushMode: 'erase', // 'erase' | 'restore'
  brushSize: 25,
  isPainting: false,
  didPaintInStroke: false,
  wandMode: 'add', // 'add' | 'subtract'
  wandTolerance: 30,
  viewMode: 'split', // 'split' | 'result' | 'original'
  sliderPos: 50,
};

// UNDO / REDO HISTORY STACK
const historyStack = [];
let historyIndex = -1;
const MAX_HISTORY = 30;

// DOM ELEMENTS
const themeToggleBtn = document.getElementById('themeToggleBtn');
const uploadBtn = document.getElementById('uploadBtn');
const navUploadBtn = document.getElementById('navUploadBtn');
const fileInput = document.getElementById('fileInput');
const dropzone = document.getElementById('dropzone');
const uploadCard = document.getElementById('uploadCard');
const processingOverlay = document.getElementById('processingOverlay');
const processingStatusText = document.getElementById('processingStatusText');
const processingDetailText = document.getElementById('processingDetailText');
const progressBarFill = document.getElementById('progressBarFill');

const workspaceSection = document.getElementById('workspaceSection');
const currentFileName = document.getElementById('currentFileName');
const currentImageSpecs = document.getElementById('currentImageSpecs');
const btnUploadAnother = document.getElementById('btnUploadAnother');

const btnUndo = document.getElementById('btnUndo');
const btnRedo = document.getElementById('btnRedo');

const stageCanvasBox = document.getElementById('stageCanvasBox');
const comparisonContainer = document.getElementById('comparisonContainer');
const sliderHandle = document.getElementById('sliderHandle');
const fgLayer = document.getElementById('fgLayer');
const originalCanvas = document.getElementById('originalCanvas');
const resultCanvas = document.getElementById('resultCanvas');

const viewTabBtns = document.querySelectorAll('.view-tab-btn');
const editorTabItems = document.querySelectorAll('.editor-tab-item');
const colorSwatches = document.querySelectorAll('.swatch');
const customColorPicker = document.getElementById('customColorPicker');
const photoCards = document.querySelectorAll('.photo-card');
const sampleChips = document.querySelectorAll('.sample-chip');
const btnUploadBg = document.getElementById('btnUploadBg');
const bgFileInput = document.getElementById('bgFileInput');
const blurSlider = document.getElementById('blurSlider');
const blurValueLabel = document.getElementById('blurValueLabel');

const btnEraseMode = document.getElementById('btnEraseMode');
const btnRestoreMode = document.getElementById('btnRestoreMode');
const brushSizeSlider = document.getElementById('brushSizeSlider');
const brushSizeLabel = document.getElementById('brushSizeLabel');
const btnResetEdits = document.getElementById('btnResetEdits');

const btnWandAdd = document.getElementById('btnWandAdd');
const btnWandSub = document.getElementById('btnWandSub');
const wandTolSlider = document.getElementById('wandTolSlider');
const wandTolLabel = document.getElementById('wandTolLabel');
const btnRefineHairEdges = document.getElementById('btnRefineHairEdges');

const btnCopyClipboard = document.getElementById('btnCopyClipboard');
const btnDownloadPng = document.getElementById('btnDownloadPng');
const btnDownloadJpg = document.getElementById('btnDownloadJpg');
const toast = document.getElementById('toast');

// SHOW TOAST MESSAGE
function showToast(message, duration = 2400) {
  if (!toast) return;
  toast.textContent = message;
  toast.style.display = 'block';
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    toast.style.display = 'none';
  }, duration);
}

// ====================================================
// THEME SWITCHER (Light <-> Dark)
// ====================================================
function initTheme() {
  const saved = localStorage.getItem('remove_back_theme');
  if (saved === 'dark' || saved === 'light') {
    setTheme(saved, false);
  } else {
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    setTheme(prefersDark ? 'dark' : 'light', false);
  }
}

function setTheme(theme, notify = true) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('remove_back_theme', theme);
  if (notify) {
    showToast(theme === 'dark' ? 'Dark theme enabled' : 'Light theme enabled');
  }
}

if (themeToggleBtn) {
  themeToggleBtn.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    setTheme(next);
  });
}
initTheme();

// ====================================================
// UNDO / REDO ENGINE (Ctrl + Z / Ctrl + Y)
// ====================================================
function pushHistoryState(actionLabel = 'Edit') {
  if (!state.cutoutCanvas || !state.originalWidth) return;

  // Truncate any forward history if in middle of stack
  if (historyIndex < historyStack.length - 1) {
    historyStack.splice(historyIndex + 1);
  }

  // Snapshot cutout canvas
  const snapshotCanvas = document.createElement('canvas');
  snapshotCanvas.width = state.originalWidth;
  snapshotCanvas.height = state.originalHeight;
  snapshotCanvas.getContext('2d').drawImage(state.cutoutCanvas, 0, 0);

  const snapshot = {
    label: actionLabel,
    canvas: snapshotCanvas,
    bgType: state.currentBgType,
    bgColor: state.currentBgColor,
    bgImage: state.currentBgImage,
    blur: state.currentBlur
  };

  historyStack.push(snapshot);
  if (historyStack.length > MAX_HISTORY) {
    historyStack.shift();
  } else {
    historyIndex++;
  }

  updateUndoRedoUI();
}

function updateUndoRedoUI() {
  if (btnUndo) {
    btnUndo.disabled = (historyIndex <= 0);
  }
  if (btnRedo) {
    btnRedo.disabled = (historyIndex >= historyStack.length - 1);
  }
}

function undo() {
  if (historyIndex > 0) {
    const undoneAction = historyStack[historyIndex]?.label || 'Edit';
    historyIndex--;
    applyHistoryState(historyStack[historyIndex]);
    updateUndoRedoUI();
    showToast(`Undo: Reverted ${undoneAction}`);
  }
}

function redo() {
  if (historyIndex < historyStack.length - 1) {
    historyIndex++;
    applyHistoryState(historyStack[historyIndex]);
    updateUndoRedoUI();
    showToast(`Redo: Restored ${historyStack[historyIndex]?.label || 'Edit'}`);
  }
}

function applyHistoryState(snapshot) {
  if (!snapshot || !state.cutoutCanvas) return;

  // Restore cutout canvas pixels
  const cCtx = state.cutoutCanvas.getContext('2d');
  cCtx.clearRect(0, 0, state.originalWidth, state.originalHeight);
  cCtx.drawImage(snapshot.canvas, 0, 0);

  // Restore background settings
  state.currentBgType = snapshot.bgType;
  state.currentBgColor = snapshot.bgColor;
  state.currentBgImage = snapshot.bgImage;
  state.currentBlur = snapshot.blur;

  syncBackgroundControlsUI();
  renderComposite();
}

function syncBackgroundControlsUI() {
  // Sync swatch borders
  colorSwatches.forEach(swatch => {
    const col = swatch.getAttribute('data-color');
    const isTransparent = col === 'transparent' && state.currentBgType === 'transparent';
    const isColorMatch = state.currentBgType === 'color' && state.currentBgColor.toLowerCase() === col.toLowerCase();
    swatch.classList.toggle('active', isTransparent || isColorMatch);
  });

  // Sync photo card active
  photoCards.forEach(card => {
    const bgUrl = card.getAttribute('data-bg');
    const bgFilename = bgUrl ? bgUrl.split('/').pop() : '';
    const isActive = state.currentBgType === 'image' && state.currentBgImage && state.currentBgImage.src && state.currentBgImage.src.includes(bgFilename);
    card.classList.toggle('active', !!isActive);
  });

  // Sync blur slider
  if (blurSlider && blurValueLabel) {
    blurSlider.value = state.currentBlur;
    blurValueLabel.textContent = `${state.currentBlur}px`;
  }
}

if (btnUndo) {
  btnUndo.addEventListener('click', (e) => {
    e.preventDefault();
    undo();
  });
}
if (btnRedo) {
  btnRedo.addEventListener('click', (e) => {
    e.preventDefault();
    redo();
  });
}

// KEYBOARD SHORTCUTS: Undo (Ctrl + Z) and Redo (Ctrl + Y)
window.addEventListener('keydown', (e) => {
  if (!state.cutoutCanvas || state.isProcessing) return;

  const isCtrlOrCmd = e.ctrlKey || e.metaKey;

  // Undo: Ctrl+Z (without shift)
  if (isCtrlOrCmd && (e.key === 'z' || e.key === 'Z') && !e.shiftKey) {
    e.preventDefault();
    undo();
  }
  // Redo: Ctrl+Y OR Ctrl+Shift+Z
  else if (isCtrlOrCmd && ((e.key === 'y' || e.key === 'Y') || (e.shiftKey && (e.key === 'z' || e.key === 'Z')))) {
    e.preventDefault();
    redo();
  }
});

// ====================================================
// ATTACH UPLOAD TRIGGERS
// ====================================================
[uploadBtn, navUploadBtn].forEach(btn => {
  if (btn) {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      fileInput.click();
    });
  }
});

fileInput.addEventListener('change', (e) => {
  if (e.target.files && e.target.files[0]) {
    handleSelectedFile(e.target.files[0]);
  }
});

// DRAG AND DROP
['dragenter', 'dragover'].forEach(evt => {
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.add('drag-active');
  });
});
['dragleave', 'drop'].forEach(evt => {
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.remove('drag-active');
  });
});
dropzone.addEventListener('drop', (e) => {
  if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
    handleSelectedFile(e.dataTransfer.files[0]);
  }
});

// CLIPBOARD PASTE LISTENER
window.addEventListener('paste', (e) => {
  if (e.clipboardData && e.clipboardData.items) {
    for (let item of e.clipboardData.items) {
      if (item.type.indexOf('image') !== -1) {
        const file = item.getAsFile();
        showToast('Image pasted from clipboard');
        handleSelectedFile(file);
        break;
      }
    }
  }
});

// SAMPLE IMAGE LOADER & QUICK CHIPS
sampleChips.forEach(chip => {
  chip.addEventListener('click', (e) => {
    e.preventDefault();
    const url = chip.getAttribute('data-sample');
    const name = chip.getAttribute('data-name') || 'Sample';
    loadSampleImage(url, `${name.toLowerCase()}.jpg`);
  });
});

async function loadSampleImage(url, filename) {
  setProcessingState(true, 'Fetching Image...', 'Preparing image tensor...', 10);
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const file = new File([blob], filename, { type: blob.type || 'image/jpeg' });
    await processImageFile(file);
  } catch (err) {
    console.error('Failed to load sample:', err);
    showToast('Failed to load image');
    setProcessingState(false);
  }
}

function handleSelectedFile(file) {
  if (!file.type.startsWith('image/')) {
    alert('Please upload a valid image file (JPG, PNG, or WebP).');
    return;
  }
  processImageFile(file);
}

// PROCESSING STATE UI
function setProcessingState(loading, status = '', detail = '', progress = 0) {
  state.isProcessing = loading;
  if (loading) {
    dropzone.style.display = 'none';
    processingOverlay.style.display = 'flex';
    processingStatusText.textContent = status;
    processingDetailText.textContent = detail;
    progressBarFill.style.width = `${progress}%`;
  } else {
    dropzone.style.display = 'flex';
    processingOverlay.style.display = 'none';
    progressBarFill.style.width = '0%';
  }
}

// DYNAMIC PREVIEW BOX SIZING
function syncCanvasDimensions() {
  if (!state.originalWidth || !state.originalHeight) return;

  const stageWrapper = document.querySelector('.stage-container');
  const availableW = stageWrapper ? stageWrapper.clientWidth - 48 : 860;
  const maxW = Math.min(Math.max(320, availableW), 860);
  const maxH = Math.min(window.innerHeight * 0.65, 560);
  const ratio = state.originalWidth / state.originalHeight;

  let dw, dh;
  if (ratio > maxW / maxH) {
    dw = Math.round(maxW);
    dh = Math.round(maxW / ratio);
  } else {
    dh = Math.round(maxH);
    dw = Math.round(maxH * ratio);
  }

  // Visual container dimensions
  stageCanvasBox.style.width = `${dw}px`;
  stageCanvasBox.style.height = `${dh}px`;
  comparisonContainer.style.width = `${dw}px`;
  comparisonContainer.style.height = `${dh}px`;

  // Canvases share exact display size
  resultCanvas.style.width = `${dw}px`;
  resultCanvas.style.height = `${dh}px`;

  originalCanvas.style.width = `${dw}px`;
  originalCanvas.style.height = `${dh}px`;

  updateSliderPosition(state.sliderPos);
}

window.addEventListener('resize', () => {
  if (state.originalWidth) {
    syncCanvasDimensions();
  }
});

// OPTIMIZED INFERENCE HELPER
async function getOptimizedInferenceBlob(file, img) {
  const maxDim = 1280;
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;

  if (w <= maxDim && h <= maxDim) {
    return file;
  }

  const scale = maxDim / Math.max(w, h);
  const optCanvas = document.createElement('canvas');
  optCanvas.width = Math.round(w * scale);
  optCanvas.height = Math.round(h * scale);
  const optCtx = optCanvas.getContext('2d');
  optCtx.drawImage(img, 0, 0, optCanvas.width, optCanvas.height);

  return new Promise(resolve => {
    optCanvas.toBlob(blob => resolve(blob || file), 'image/jpeg', 0.92);
  });
}

// ====================================================
// CORE PROCESS IMAGE PIPELINE
// ====================================================
async function processImageFile(file) {
  setProcessingState(true, 'Initializing AI Model...', 'Preparing neural network weights...', 15);
  
  const imgUrl = URL.createObjectURL(file);
  const img = new Image();
  img.src = imgUrl;

  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
  });

  state.originalImage = img;
  state.originalBlob = file;
  state.originalWidth = img.naturalWidth || img.width;
  state.originalHeight = img.naturalHeight || img.height;

  currentFileName.textContent = file.name;
  currentImageSpecs.textContent = `${state.originalWidth} × ${state.originalHeight} px`;

  // Draw original image to buffer
  originalCanvas.width = state.originalWidth;
  originalCanvas.height = state.originalHeight;
  const oCtx = originalCanvas.getContext('2d');
  oCtx.drawImage(img, 0, 0);

  // Initialize Cutout Canvas
  state.cutoutCanvas = document.createElement('canvas');
  state.cutoutCanvas.width = state.originalWidth;
  state.cutoutCanvas.height = state.originalHeight;

  resultCanvas.width = state.originalWidth;
  resultCanvas.height = state.originalHeight;

  // RUN AI BACKGROUND REMOVAL
  try {
    setProcessingState(true, 'Removing Background...', 'Deep learning segmentation in progress...', 40);

    const inferenceBlob = await getOptimizedInferenceBlob(file, img);

    const config = {
      model: 'isnet_quint8',
      device: 'gpu',
      progress: (key, current, total) => {
        if (total > 0) {
          const pct = Math.min(95, Math.round((current / total) * 100));
          progressBarFill.style.width = `${pct}%`;
          processingDetailText.textContent = `Processing: ${key} (${pct}%)`;
        }
      },
      output: {
        format: 'image/png',
        quality: 1.0,
        type: 'foreground'
      }
    };

    const resultBlob = await removeBackground(inferenceBlob, config);
    setProcessingState(true, 'Refining Edges...', 'Generating alpha transparency...', 98);

    const cutoutImg = new Image();
    cutoutImg.src = URL.createObjectURL(resultBlob);
    await new Promise((resolve) => (cutoutImg.onload = resolve));

    const cCtx = state.cutoutCanvas.getContext('2d');
    cCtx.clearRect(0, 0, state.originalWidth, state.originalHeight);
    cCtx.drawImage(cutoutImg, 0, 0, state.originalWidth, state.originalHeight);

    // Save pristine copy for clean resets
    state.pristineCutoutCanvas = document.createElement('canvas');
    state.pristineCutoutCanvas.width = state.originalWidth;
    state.pristineCutoutCanvas.height = state.originalHeight;
    state.pristineCutoutCanvas.getContext('2d').drawImage(state.cutoutCanvas, 0, 0);

    showToast('Background successfully removed');
  } catch (err) {
    console.warn('AI engine fallback triggered:', err);
    setProcessingState(true, 'Processing Matting...', 'Computing smart edge segmentation...', 70);
    await performSmartMattingFallback(img);

    state.pristineCutoutCanvas = document.createElement('canvas');
    state.pristineCutoutCanvas.width = state.originalWidth;
    state.pristineCutoutCanvas.height = state.originalHeight;
    state.pristineCutoutCanvas.getContext('2d').drawImage(state.cutoutCanvas, 0, 0);

    showToast('Applied Smart Edge Segmentation');
  }

  // Done processing
  setProcessingState(false);

  // Initialize history stack with pristine cutout
  historyStack.length = 0;
  historyIndex = -1;
  pushHistoryState('Initial Cutout');

  // Resize preview box
  syncCanvasDimensions();
  renderComposite();

  // Reset view to comparison split
  setViewMode('split');

  // Reveal Workspace
  workspaceSection.style.display = 'block';
  workspaceSection.scrollIntoView({ behavior: 'smooth' });
}

// FAST FALLBACK ENGINE
async function performSmartMattingFallback(img) {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  
  const cCtx = state.cutoutCanvas.getContext('2d');
  cCtx.drawImage(img, 0, 0);
  const imgData = cCtx.getImageData(0, 0, w, h);
  const d = imgData.data;

  const corners = [
    [0, 0],
    [w - 1, 0],
    [0, h - 1],
    [w - 1, h - 1],
    [Math.floor(w / 2), 0]
  ];
  
  let refR = 0, refG = 0, refB = 0;
  corners.forEach(([x, y]) => {
    const idx = (y * w + x) * 4;
    refR += d[idx];
    refG += d[idx + 1];
    refB += d[idx + 2];
  });
  refR /= corners.length;
  refG /= corners.length;
  refB /= corners.length;

  const threshold = 48;
  const feather = 24;

  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    
    const dist = Math.sqrt((r - refR) ** 2 + (g - refG) ** 2 + (b - refB) ** 2);
    
    if (dist < threshold) {
      d[i + 3] = 0;
    } else if (dist < threshold + feather) {
      d[i + 3] = Math.floor(((dist - threshold) / feather) * 255);
    }
  }

  cCtx.putImageData(imgData, 0, 0);
}

// RENDER PREVIEW COMPOSITE TO RESULT CANVAS
function renderComposite() {
  if (!state.cutoutCanvas) return;

  const rCtx = resultCanvas.getContext('2d');
  const w = resultCanvas.width;
  const h = resultCanvas.height;

  rCtx.clearRect(0, 0, w, h);

  // 1. Draw Background
  if (state.currentBgType === 'color' && state.currentBgColor !== 'transparent') {
    rCtx.fillStyle = state.currentBgColor;
    rCtx.fillRect(0, 0, w, h);
  } else if (state.currentBgType === 'image' && state.currentBgImage) {
    rCtx.save();
    if (state.currentBlur > 0) {
      rCtx.filter = `blur(${state.currentBlur}px)`;
    }
    drawCover(rCtx, state.currentBgImage, 0, 0, w, h);
    rCtx.restore();
  }

  // 2. Draw Foreground Cutout
  rCtx.drawImage(state.cutoutCanvas, 0, 0);

  updateSliderPosition(state.sliderPos);
}

function drawCover(ctx, img, x, y, w, h) {
  const imgW = img.naturalWidth || img.width;
  const imgH = img.naturalHeight || img.height;
  const scale = Math.max(w / imgW, h / imgH);
  const dw = imgW * scale;
  const dh = imgH * scale;
  const dx = x + (w - dw) / 2;
  const dy = y + (h - dh) / 2;
  ctx.drawImage(img, dx, dy, dw, dh);
}

// ====================================================
// COMPARISON SLIDER DRAGGING
// ====================================================
let isDraggingSlider = false;

function setSliderPositionFromEvent(e) {
  const rect = comparisonContainer.getBoundingClientRect();
  const clientX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
  let pct = ((clientX - rect.left) / rect.width) * 100;
  pct = Math.max(0, Math.min(100, pct));
  updateSliderPosition(pct);
}

function updateSliderPosition(pct) {
  state.sliderPos = pct;
  if (state.viewMode === 'split') {
    fgLayer.style.width = `${pct}%`;
    sliderHandle.style.left = `${pct}%`;
    sliderHandle.style.display = 'flex';
  } else if (state.viewMode === 'result') {
    fgLayer.style.width = '0%';
    sliderHandle.style.display = 'none';
  } else if (state.viewMode === 'original') {
    fgLayer.style.width = '100%';
    sliderHandle.style.display = 'none';
  }
}

// SLIDER INTERACTION (Only moves split bar, never draws)
comparisonContainer.addEventListener('mousedown', (e) => {
  if (state.viewMode === 'split') {
    isDraggingSlider = true;
    setSliderPositionFromEvent(e);
  }
});
window.addEventListener('mousemove', (e) => {
  if (isDraggingSlider) {
    setSliderPositionFromEvent(e);
  }
});
window.addEventListener('mouseup', () => {
  isDraggingSlider = false;
});

// TOUCH EVENTS
comparisonContainer.addEventListener('touchstart', (e) => {
  if (state.viewMode === 'split') {
    isDraggingSlider = true;
    setSliderPositionFromEvent(e);
  }
}, { passive: true });
window.addEventListener('touchmove', (e) => {
  if (isDraggingSlider) {
    setSliderPositionFromEvent(e);
  }
}, { passive: true });
window.addEventListener('touchend', () => {
  isDraggingSlider = false;
});

// VIEW MODE SWITCHER
function setViewMode(mode) {
  state.viewMode = mode;
  viewTabBtns.forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-view') === mode);
  });
  updateSliderPosition(state.sliderPos);
}

viewTabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const mode = btn.getAttribute('data-view');
    setViewMode(mode);
  });
});

// EDITOR TABS (Background vs Brush vs AI Quick Select)
editorTabItems.forEach(item => {
  item.addEventListener('click', () => {
    editorTabItems.forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    const target = item.getAttribute('data-tab');
    state.activeTab = target;

    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    const pane = document.getElementById(target);
    if (pane) pane.classList.add('active');

    if (target === 'tab-brush' || target === 'tab-ai-select') {
      setViewMode('result');
      if (target === 'tab-ai-select') {
        showToast('Smart Wand Active: Click object to select / remove');
      } else {
        showToast('Magic Brush Active: Drag over canvas to touch up');
      }
    } else {
      state.isPainting = false;
    }
  });
});

// COLOR SWATCHES
colorSwatches.forEach(swatch => {
  swatch.addEventListener('click', () => {
    colorSwatches.forEach(s => s.classList.remove('active'));
    photoCards.forEach(p => p.classList.remove('active'));
    swatch.classList.add('active');

    const col = swatch.getAttribute('data-color');
    state.currentBgType = col === 'transparent' ? 'transparent' : 'color';
    state.currentBgColor = col;
    state.currentBgImage = null;
    renderComposite();
    pushHistoryState('Change Background Color');
  });
});

customColorPicker.addEventListener('change', (e) => {
  colorSwatches.forEach(s => s.classList.remove('active'));
  state.currentBgType = 'color';
  state.currentBgColor = e.target.value;
  state.currentBgImage = null;
  renderComposite();
  pushHistoryState('Custom Background Color');
});

// PHOTO PRESETS
photoCards.forEach(card => {
  card.addEventListener('click', () => {
    photoCards.forEach(c => c.classList.remove('active'));
    colorSwatches.forEach(s => s.classList.remove('active'));
    card.classList.add('active');

    const bgUrl = card.getAttribute('data-bg');
    const img = new Image();
    img.src = bgUrl;
    img.onload = () => {
      state.currentBgType = 'image';
      state.currentBgImage = img;
      renderComposite();
      pushHistoryState('Scene Backdrop');
    };
  });
});

// CUSTOM BG UPLOAD
btnUploadBg.addEventListener('click', () => {
  bgFileInput.click();
});
bgFileInput.addEventListener('change', (e) => {
  if (e.target.files && e.target.files[0]) {
    const file = e.target.files[0];
    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = () => {
      photoCards.forEach(c => c.classList.remove('active'));
      colorSwatches.forEach(s => s.classList.remove('active'));
      state.currentBgType = 'image';
      state.currentBgImage = img;
      renderComposite();
      pushHistoryState('Custom Background Image');
      showToast('Custom background loaded');
    };
  }
});

// BLUR SLIDER
blurSlider.addEventListener('input', (e) => {
  state.currentBlur = parseInt(e.target.value, 10);
  blurValueLabel.textContent = `${state.currentBlur}px`;
  renderComposite();
});
blurSlider.addEventListener('change', () => {
  pushHistoryState('Background Blur');
});

// MAGIC BRUSH CONTROLS
btnEraseMode.addEventListener('click', () => {
  state.brushMode = 'erase';
  btnEraseMode.classList.add('active');
  btnRestoreMode.classList.remove('active');
});
btnRestoreMode.addEventListener('click', () => {
  state.brushMode = 'restore';
  btnRestoreMode.classList.add('active');
  btnEraseMode.classList.remove('active');
});

brushSizeSlider.addEventListener('input', (e) => {
  state.brushSize = parseInt(e.target.value, 10);
  brushSizeLabel.textContent = `${state.brushSize}px`;
});

// AI QUICK SELECTION WAND CONTROLS
if (btnWandAdd && btnWandSub) {
  btnWandAdd.addEventListener('click', () => {
    state.wandMode = 'add';
    btnWandAdd.classList.add('active');
    btnWandSub.classList.remove('active');
    showToast('Smart Wand: Add (+)');
  });
  btnWandSub.addEventListener('click', () => {
    state.wandMode = 'subtract';
    btnWandSub.classList.add('active');
    btnWandAdd.classList.remove('active');
    showToast('Smart Wand: Remove (-)');
  });
}

if (wandTolSlider && wandTolLabel) {
  wandTolSlider.addEventListener('input', (e) => {
    state.wandTolerance = parseInt(e.target.value, 10);
    wandTolLabel.textContent = `${state.wandTolerance}%`;
  });
}

if (btnRefineHairEdges) {
  btnRefineHairEdges.addEventListener('click', () => {
    refineHairAndEdges();
  });
}

// RESET EDITS
btnResetEdits.addEventListener('click', () => {
  if (state.pristineCutoutCanvas && state.cutoutCanvas) {
    const cCtx = state.cutoutCanvas.getContext('2d');
    cCtx.clearRect(0, 0, state.originalWidth, state.originalHeight);
    cCtx.drawImage(state.pristineCutoutCanvas, 0, 0);
    renderComposite();
    pushHistoryState('Reset to Cutout');
    showToast('Reset to original AI cutout');
  }
});

// CANVAS INTERACTIONS (BRUSH & AI QUICK WAND)
resultCanvas.addEventListener('mousedown', (e) => {
  if (state.viewMode === 'split') return;

  if (state.activeTab === 'tab-brush') {
    state.isPainting = true;
    state.didPaintInStroke = true;
    paintOnCutout(e);
  } else if (state.activeTab === 'tab-ai-select') {
    applyAIQuickWand(e);
  }
});

resultCanvas.addEventListener('mousemove', (e) => {
  if (state.isPainting && state.activeTab === 'tab-brush' && state.viewMode !== 'split') {
    state.didPaintInStroke = true;
    paintOnCutout(e);
  }
});

window.addEventListener('mouseup', () => {
  if (state.isPainting) {
    state.isPainting = false;
    if (state.didPaintInStroke) {
      state.didPaintInStroke = false;
      pushHistoryState(state.brushMode === 'erase' ? 'Brush Erase' : 'Brush Restore');
    }
  }
});

// MANUAL BRUSH PAINTING
function paintOnCutout(e) {
  if (!state.cutoutCanvas || !state.originalImage) return;
  if (state.activeTab !== 'tab-brush') return;
  if (state.viewMode === 'split') return;

  const rect = resultCanvas.getBoundingClientRect();
  const scaleX = resultCanvas.width / rect.width;
  const scaleY = resultCanvas.height / rect.height;

  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top) * scaleY;

  const cCtx = state.cutoutCanvas.getContext('2d');
  cCtx.save();

  if (state.brushMode === 'erase') {
    cCtx.globalCompositeOperation = 'destination-out';
    cCtx.beginPath();
    cCtx.arc(x, y, state.brushSize, 0, Math.PI * 2);
    cCtx.fill();
  } else if (state.brushMode === 'restore') {
    cCtx.save();
    cCtx.beginPath();
    cCtx.arc(x, y, state.brushSize, 0, Math.PI * 2);
    cCtx.clip();
    cCtx.drawImage(state.originalImage, 0, 0);
    cCtx.restore();
  }

  cCtx.restore();
  renderComposite();
}

// AI QUICK SELECTION WAND (Active Contour BFS Edge Snapping)
function applyAIQuickWand(e) {
  if (!state.cutoutCanvas || !state.originalImage) return;

  const rect = resultCanvas.getBoundingClientRect();
  const scaleX = resultCanvas.width / rect.width;
  const scaleY = resultCanvas.height / rect.height;

  const startX = Math.round((e.clientX - rect.left) * scaleX);
  const startY = Math.round((e.clientY - rect.top) * scaleY);

  const w = state.originalWidth;
  const h = state.originalHeight;

  if (startX < 0 || startX >= w || startY < 0 || startY >= h) return;

  const oCtx = originalCanvas.getContext('2d');
  const imgData = oCtx.getImageData(0, 0, w, h);
  const origData = imgData.data;

  const cCtx = state.cutoutCanvas.getContext('2d');
  const cutoutData = cCtx.getImageData(0, 0, w, h);
  const cData = cutoutData.data;

  const startIdx = (startY * w + startX) * 4;
  const seedR = origData[startIdx];
  const seedG = origData[startIdx + 1];
  const seedB = origData[startIdx + 2];

  const tol = (state.wandTolerance / 100) * 160;
  const maxRadius = Math.round(Math.min(w, h) * 0.35);

  const visited = new Uint8Array(w * h);
  const queueX = new Int32Array(w * h);
  const queueY = new Int32Array(w * h);
  let head = 0;
  let tail = 0;

  queueX[tail] = startX;
  queueY[tail] = startY;
  tail++;
  visited[startY * w + startX] = 1;

  const isAdd = state.wandMode === 'add';

  while (head < tail) {
    const cx = queueX[head];
    const cy = queueY[head];
    head++;

    const idx = (cy * w + cx) * 4;

    if (isAdd) {
      cData[idx] = origData[idx];
      cData[idx + 1] = origData[idx + 1];
      cData[idx + 2] = origData[idx + 2];
      cData[idx + 3] = 255;
    } else {
      cData[idx + 3] = 0;
    }

    const neighbors = [
      [cx + 1, cy],
      [cx - 1, cy],
      [cx, cy + 1],
      [cx, cy - 1]
    ];

    for (let i = 0; i < 4; i++) {
      const nx = neighbors[i][0];
      const ny = neighbors[i][1];

      if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
        const nPos = ny * w + nx;
        if (!visited[nPos]) {
          const dx = nx - startX;
          const dy = ny - startY;
          if (dx * dx + dy * dy <= maxRadius * maxRadius) {
            const nIdx = nPos * 4;
            const nr = origData[nIdx];
            const ng = origData[nIdx + 1];
            const nb = origData[nIdx + 2];

            const dist = Math.sqrt(
              (nr - seedR) ** 2 +
              (ng - seedG) ** 2 +
              (nb - seedB) ** 2
            );

            if (dist <= tol) {
              visited[nPos] = 1;
              queueX[tail] = nx;
              queueY[tail] = ny;
              tail++;
            }
          }
        }
      }
    }
  }

  cCtx.putImageData(cutoutData, 0, 0);
  renderComposite();
  pushHistoryState(isAdd ? 'AI Smart Select' : 'AI Smart Remove');
  showToast(isAdd ? 'Smart Select applied' : 'Smart Remove applied');
}

// AI HAIR & EDGE REFINE (Guided Filter Alpha Matting)
function refineHairAndEdges() {
  if (!state.cutoutCanvas || !state.originalImage) return;

  const w = state.originalWidth;
  const h = state.originalHeight;

  const oCtx = originalCanvas.getContext('2d');
  const origData = oCtx.getImageData(0, 0, w, h).data;

  const cCtx = state.cutoutCanvas.getContext('2d');
  const cutoutImgData = cCtx.getImageData(0, 0, w, h);
  const cData = cutoutImgData.data;

  const edgeBand = new Uint8Array(w * h);

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = (y * w + x) * 4;
      const a = cData[idx + 3];

      if (a > 5 && a < 250) {
        edgeBand[y * w + x] = 1;
      } else if (a >= 250) {
        const neighbors = [
          cData[((y - 1) * w + x) * 4 + 3],
          cData[((y + 1) * w + x) * 4 + 3],
          cData[(y * w + (x - 1)) * 4 + 3],
          cData[(y * w + (x + 1)) * 4 + 3]
        ];
        if (neighbors.some(na => na < 120)) {
          edgeBand[y * w + x] = 1;
        }
      }
    }
  }

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const pos = y * w + x;
      if (edgeBand[pos]) {
        const idx = pos * 4;
        const r = origData[idx];
        const g = origData[idx + 1];
        const b = origData[idx + 2];

        let sumA = 0;
        let count = 0;

        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nPos = (y + dy) * w + (x + dx);
            sumA += cData[nPos * 4 + 3];
            count++;
          }
        }

        const avgA = sumA / count;
        const edgeLuma = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
        const refinedA = Math.round(avgA * 0.7 + (edgeLuma * 255) * 0.3);

        cData[idx + 3] = Math.max(0, Math.min(255, refinedA));
      }
    }
  }

  cCtx.putImageData(cutoutImgData, 0, 0);
  renderComposite();
  pushHistoryState('Hair & Edge Refine');
  showToast('Hair & edges refined');
}

// FULL NATIVE RESOLUTION HD COMPOSITE GENERATOR
function generateFullResolutionComposite(isJpg = false) {
  if (!state.cutoutCanvas || !state.originalWidth || !state.originalHeight) return null;

  const fullCanvas = document.createElement('canvas');
  fullCanvas.width = state.originalWidth;
  fullCanvas.height = state.originalHeight;
  const ctx = fullCanvas.getContext('2d');

  const w = state.originalWidth;
  const h = state.originalHeight;

  // 1. Draw Selected Background
  if (state.currentBgType === 'color' && state.currentBgColor !== 'transparent') {
    ctx.fillStyle = state.currentBgColor;
    ctx.fillRect(0, 0, w, h);
  } else if (state.currentBgType === 'image' && state.currentBgImage) {
    ctx.save();
    if (state.currentBlur > 0) {
      const scaleBlur = Math.round(state.currentBlur * (w / Math.min(w, 860)));
      ctx.filter = `blur(${scaleBlur}px)`;
    }
    drawCover(ctx, state.currentBgImage, 0, 0, w, h);
    ctx.restore();
  } else {
    if (isJpg) {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, w, h);
    }
  }

  // 2. Composite Foreground Cutout
  ctx.drawImage(state.cutoutCanvas, 0, 0, w, h);

  return fullCanvas;
}

// ACTION BUTTONS (HD EXPORT)
btnUploadAnother.addEventListener('click', () => {
  fileInput.click();
});

btnCopyClipboard.addEventListener('click', async () => {
  const fullCanvas = generateFullResolutionComposite(false);
  if (!fullCanvas) return;
  try {
    fullCanvas.toBlob(async (blob) => {
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
      showToast('Copied to clipboard');
    });
  } catch (err) {
    console.error('Clipboard copy failed:', err);
    showToast('Failed to copy');
  }
});

btnDownloadPng.addEventListener('click', () => {
  const fullCanvas = generateFullResolutionComposite(false);
  if (!fullCanvas) return;

  const link = document.createElement('a');
  link.download = `remove-back-${Date.now()}.png`;
  link.href = fullCanvas.toDataURL('image/png');
  link.click();
  showToast('Downloaded HD PNG');
});

btnDownloadJpg.addEventListener('click', () => {
  const fullCanvas = generateFullResolutionComposite(true);
  if (!fullCanvas) return;

  const link = document.createElement('a');
  link.download = `remove-back-${Date.now()}.jpg`;
  link.href = fullCanvas.toDataURL('image/jpeg', 1.0);
  link.click();
  showToast('Downloaded HD JPG');
});

// HERO DEMO INTERACTIVE SLIDER
const heroDemoWrapper = document.getElementById('heroDemoWrapper');
const heroDemoAfter = document.getElementById('heroDemoAfter');
if (heroDemoWrapper && heroDemoAfter) {
  heroDemoWrapper.addEventListener('mousemove', (e) => {
    const rect = heroDemoWrapper.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = (x / rect.width) * 100;
    heroDemoAfter.style.width = `${Math.max(10, Math.min(90, pct))}%`;
  });
}

// FAQ ACCORDION
document.querySelectorAll('.faq-question').forEach(q => {
  q.addEventListener('click', () => {
    const item = q.parentElement;
    item.classList.toggle('open');
  });
});

console.log('Remove-back minimal application ready.');
