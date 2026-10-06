// Page controller: remove-bg.html
import { removeBackground } from '../services/backgroundRemover.js';
import { initPaywall, isPremium, requirePremium, FREE_LIMITS } from '../stripe-paywall.js';
import { saveToHistory } from '../config/firebase.js';
import { downloadBlob, canvasToBlob, isImageFile, baseName } from '../utils/canvasUtils.js';

    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const removeBtn = document.getElementById('removeBtn');
    const resultCanvas = document.getElementById('resultCanvas');
    const downloadBtn = document.getElementById('downloadBtn');
    const alertArea = document.getElementById('alertArea');
    const tolSlider = document.getElementById('tolerance');
    const tolVal = document.getElementById('tolVal');
    const featherSlider = document.getElementById('feather');
    const featherVal = document.getElementById('featherVal');
    let origFile = null, fullCanvas = null;
initPaywall();

    tolSlider.addEventListener('input', () => { tolVal.textContent = tolSlider.value; });
    featherSlider.addEventListener('input', () => { featherVal.textContent = featherSlider.value; });

    function loadFile(f) {
      if (!isImageFile(f)) {
        alertArea.innerHTML = `<div class="alert alert-error">❌ That file isn't an image. Drop a JPG, PNG or WebP.</div>`;
        return;
      }
      origFile = f;
      document.getElementById('controls').style.display = 'block';
      alertArea.innerHTML = '';
    }

    fileInput.addEventListener('change', () => { if (fileInput.files[0]) loadFile(fileInput.files[0]); fileInput.value = ''; });
    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', e => {
      e.preventDefault(); dropZone.classList.remove('dragover');
      const f = e.dataTransfer.files[0];
      if (f) loadFile(f);
    });

    removeBtn.addEventListener('click', async () => {
      if (!origFile) return;
      if (origFile.size > FREE_LIMITS.pdfFileSizeMB * 1024 * 1024 && !isPremium()) {
        requirePremium('Removing backgrounds from images over 10MB requires Pro', 'image-remove-bg-size');
        return;
      }
      removeBtn.disabled = true;
      document.getElementById('progressWrap').classList.remove('hidden');
      alertArea.innerHTML = '';
      try {
        const tolerance = parseInt(tolSlider.value);
        const feather = parseInt(featherSlider.value);
        const resultImageData = await removeBackground(origFile, { tolerance, feather }, (pct, label) => {
          document.getElementById('progressFill').style.width = pct + '%';
          document.getElementById('progressLabel').textContent = label;
        });
        const scale = Math.min(1, 500 / Math.max(resultImageData.width, resultImageData.height));
        resultCanvas.width = Math.round(resultImageData.width * scale);
        resultCanvas.height = Math.round(resultImageData.height * scale);
        const ctx = resultCanvas.getContext('2d');
        const tmpCanvas = document.createElement('canvas');
        tmpCanvas.width = resultImageData.width; tmpCanvas.height = resultImageData.height;
        tmpCanvas.getContext('2d').putImageData(resultImageData, 0, 0);
        fullCanvas = tmpCanvas; // full resolution, for download
        ctx.drawImage(tmpCanvas, 0, 0, resultCanvas.width, resultCanvas.height);
        document.getElementById('resultPanel').style.display = 'block';
        alertArea.innerHTML = `<div class="alert alert-success">✅ Background removed! Download as PNG to preserve transparency.</div>`;
        await saveToHistory('image-remove-bg', { tolerance, feather });
      } catch (err) {
        alertArea.innerHTML = '';
        const div = document.createElement('div');
        div.className = 'alert alert-error';
        div.textContent = `❌ ${err.message}`;
        alertArea.appendChild(div);
      } finally {
        removeBtn.disabled = false;
        document.getElementById('progressWrap').classList.add('hidden');
      }
    });

    downloadBtn.addEventListener('click', async () => {
      // Download the full-resolution result; resultCanvas is a <=500px preview.
      const src = fullCanvas || resultCanvas;
      try {
        const blob = await canvasToBlob(src, 'image/png');
        downloadBlob(blob, `${baseName(origFile.name)}-nobg.png`);
      } catch (err) {
        alertArea.innerHTML = `<div class="alert alert-error">❌ Could not export the image.</div>`;
      }
    });
