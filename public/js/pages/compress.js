// Page controller: compress.html (image compression)
// Previously this file was a copy of the PDF compress controller: it imported
// modules that don't exist in this repo and only accepted PDFs.
import { compressImage } from '../services/imageCompress.js';
import {
  formatBytes, downloadBlob, extensionFor, disableUnsupportedFormats,
  isImageFile, baseName,
} from '../utils/canvasUtils.js';
import { saveToHistory } from '../config/firebase.js';

const dropZone      = document.getElementById('dropZone');
const fileInput     = document.getElementById('fileInput');
const settings      = document.getElementById('settings');
const qualitySlider = document.getElementById('quality');
const qualityVal    = document.getElementById('qualityVal');
const outFormat     = document.getElementById('outFormat');
const downloadBtn   = document.getElementById('downloadBtn');
const comparePanel  = document.getElementById('comparePanel');
const previewCanvas = document.getElementById('previewCanvas');
const alertArea     = document.getElementById('alertArea');

let origFile = null, origBitmap = null, resultBlob = null, resultIsOriginal = false;
let runId = 0, debounce = null;

disableUnsupportedFormats(outFormat);

function showAlert(type, msg) {
  alertArea.innerHTML = '';
  if (!msg) return;
  const div = document.createElement('div');
  div.className = `alert alert-${type}`;
  div.textContent = msg;
  alertArea.appendChild(div);
}

async function loadFile(file) {
  if (!isImageFile(file)) {
    showAlert('error', "❌ That file isn't an image. Drop a JPG, PNG, WebP or GIF.");
    return;
  }
  showAlert('', '');
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    if (origBitmap?.close) origBitmap.close();
    origFile = file; origBitmap = bmp; resultBlob = null;
    document.getElementById('origSize').textContent = formatBytes(file.size);
    settings.style.display = 'block';
    comparePanel.style.display = 'block';
    scheduleCompress(0);
  } catch (err) {
    showAlert('error', `❌ This image format can't be decoded by your browser (${file.type || 'unknown type'}).`);
  }
}

function scheduleCompress(delay = 250) {
  clearTimeout(debounce);
  debounce = setTimeout(runCompress, delay);
}

async function runCompress() {
  if (!origBitmap) return;
  const id = ++runId;
  downloadBtn.disabled = true;
  document.getElementById('newSize').textContent = '…';
  try {
    const blob = await compressImage(origBitmap, {
      quality: parseInt(qualitySlider.value, 10) / 100,
      format: outFormat.value,
    });
    if (id !== runId) return; // a newer setting superseded this run

    // Preview the compressed output itself so artifacts are visible.
    const outBmp = await createImageBitmap(blob);
    const scale = Math.min(1, 600 / Math.max(outBmp.width, outBmp.height));
    previewCanvas.width = Math.round(outBmp.width * scale);
    previewCanvas.height = Math.round(outBmp.height * scale);
    previewCanvas.getContext('2d').drawImage(outBmp, 0, 0, previewCanvas.width, previewCanvas.height);
    if (outBmp.close) outBmp.close();

    const savingsEl = document.getElementById('savings');
    if (blob.size >= origFile.size) {
      // Re-encoding made it bigger: don't hand over a larger "compressed" file.
      resultBlob = origFile; resultIsOriginal = true;
      document.getElementById('newSize').textContent = formatBytes(blob.size);
      savingsEl.textContent = '0%';
      downloadBtn.textContent = '⬇️ Download original (already smaller)';
      showAlert('info', 'ℹ️ At these settings the result would be larger than your original, so the original is kept. Lower the quality or try another format.');
    } else {
      resultBlob = blob; resultIsOriginal = false;
      const pct = ((1 - blob.size / origFile.size) * 100).toFixed(1);
      document.getElementById('newSize').textContent = formatBytes(blob.size);
      savingsEl.textContent = `-${pct}%`;
      downloadBtn.textContent = `⬇️ Download ${extensionFor(blob.type).toUpperCase()}`;
      showAlert('', '');
    }
    downloadBtn.style.display = 'flex';
  } catch (err) {
    if (id === runId) showAlert('error', `❌ Could not compress this image: ${err.message}`);
  } finally {
    if (id === runId) downloadBtn.disabled = false;
  }
}

qualitySlider.addEventListener('input', () => {
  qualityVal.textContent = qualitySlider.value + '%';
  scheduleCompress();
});
outFormat.addEventListener('change', () => scheduleCompress(0));

downloadBtn.addEventListener('click', async () => {
  if (!resultBlob) return;
  const name = resultIsOriginal
    ? origFile.name
    : `${baseName(origFile.name)}-compressed.${extensionFor(resultBlob.type)}`;
  downloadBlob(resultBlob, name);
  showAlert('success', resultIsOriginal ? '✅ Downloaded your original file.' : `✅ Downloaded ${name}.`);
  await saveToHistory('image-compress', {
    originalSize: origFile.size, compressedSize: resultBlob.size, format: resultBlob.type,
  });
});

fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) loadFile(fileInput.files[0]);
  fileInput.value = '';
});
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', e => {
  e.preventDefault(); dropZone.classList.remove('dragover');
  const f = e.dataTransfer.files[0];
  if (f) loadFile(f);
});
