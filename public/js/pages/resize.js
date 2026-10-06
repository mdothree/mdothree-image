// Page controller: resize.html
import { resizeImage } from '../services/imageResize.js';
import { initPaywall, isPremium, requirePremium, FREE_LIMITS } from '../stripe-paywall.js';
    import { formatBytes, downloadBlob, canvasToBlob, createOutputCanvas, outputTypeFor, extensionFor, disableUnsupportedFormats, isImageFile, baseName } from '../utils/canvasUtils.js';

    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const resizeBtn = document.getElementById('resizeBtn');
    const previewCanvas = document.getElementById('previewCanvas');
    const alertArea = document.getElementById('alertArea');
    let origImg = null, origFile = null, origW = 0, origH = 0, currentMode = 'percent';
    initPaywall();
    disableUnsupportedFormats(document.getElementById('outFormat'));

    function showAlert(type, msg) {
      alertArea.innerHTML = '';
      const div = document.createElement('div');
      div.className = `alert alert-${type}`;
      div.textContent = msg;
      alertArea.appendChild(div);
    }

    // "Same as input" resolves to a format the browser can actually encode
    // (GIF/SVG/BMP inputs -> PNG); previously a GIF came out as PNG bytes
    // named .gif and an SVG as ".svg+xml".
    function targetType() {
      const outFmt = document.getElementById('outFormat').value;
      return outFmt === 'same' ? outputTypeFor(origFile?.type || 'image/png') : outFmt;
    }

    function renderFull(tw, th, fmt) {
      const { canvas, ctx } = createOutputCanvas(tw, th, fmt);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(origImg, 0, 0, tw, th);
      return canvas;
    }

    // Real size estimate: encode at full size (debounced). The old value was
    // w*h*3 — the raw bitmap size, often 10x the real file.
    let estTimer = null, estRun = 0;
    function scheduleEstimate(tw, th) {
      clearTimeout(estTimer);
      const el = document.getElementById('outFileSize');
      el.textContent = '…';
      estTimer = setTimeout(async () => {
        const id = ++estRun;
        try {
          const blob = await canvasToBlob(renderFull(tw, th, targetType()), targetType(), 0.92);
          if (id === estRun) el.textContent = `~${formatBytes(blob.size)} ${extensionFor(blob.type).toUpperCase()}`;
        } catch (e) { if (id === estRun) el.textContent = '—'; }
      }, 400);
    }
    document.getElementById('outFormat').addEventListener('change', () => updatePreview());

    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentMode = btn.dataset.mode;
        document.getElementById('modePercent').classList.toggle('hidden', currentMode !== 'percent');
        document.getElementById('modePixels').classList.toggle('hidden', currentMode !== 'pixels');
      });
    });

    const percentSlider = document.getElementById('percent');
    const percentVal = document.getElementById('percentVal');
    percentSlider.addEventListener('input', () => {
      const pct = parseInt(percentSlider.value);
      percentVal.textContent = pct + '%';
      if (origW) document.getElementById('resultDimsPercent').textContent = `→ ${Math.round(origW * pct/100)} × ${Math.round(origH * pct/100)} px`;
      updatePreview();
    });

    const widthPx = document.getElementById('widthPx');
    const heightPx = document.getElementById('heightPx');
    const lockAspect = document.getElementById('lockAspect');
    widthPx.addEventListener('input', () => {
      if (lockAspect.checked && origW && origH) {
        heightPx.value = Math.round(parseInt(widthPx.value) * origH / origW) || '';
      }
      updatePreview();
    });
    heightPx.addEventListener('input', () => {
      if (lockAspect.checked && origW && origH) {
        widthPx.value = Math.round(parseInt(heightPx.value) * origW / origH) || '';
      }
      updatePreview();
    });

    function loadImage(file) {
      if (!isImageFile(file)) { showAlert('error', "❌ That file isn't an image. Drop a JPG, PNG, WebP or GIF."); return; }
      alertArea.innerHTML = '';
      origFile = file;
      if (window._resizePreviewUrl) URL.revokeObjectURL(window._resizePreviewUrl);
      const url = URL.createObjectURL(file);
      window._resizePreviewUrl = url;
      origImg = new Image();
      origImg.onload = () => {
        origW = origImg.naturalWidth;
        origH = origImg.naturalHeight;
        document.getElementById('origName').textContent = file.name;
        document.getElementById('origSize').textContent = formatBytes(file.size);
        document.getElementById('origDims').textContent = `${origW} × ${origH}px`;
        const thumb = document.getElementById('origThumb');
        thumb.outerHTML = `<img id="origThumb" src="${url}" style="width:40px;height:40px;object-fit:cover;border-radius:4px;flex-shrink:0;" />`;
        widthPx.value = origW; heightPx.value = origH;
        document.getElementById('origInfo').classList.remove('hidden');
        document.getElementById('settings').style.display = 'block';
        const pct = parseInt(percentSlider.value);
        document.getElementById('resultDimsPercent').textContent = `→ ${Math.round(origW * pct/100)} × ${Math.round(origH * pct/100)} px`;
        updatePreview();
      };
      origImg.onerror = () => showAlert('error', `❌ Your browser can't decode this image (${file.type || 'unknown type'}).`);
      origImg.src = url;
    }

    function updatePreview() {
      if (!origImg) return;
      let tw, th;
      if (currentMode === 'percent') {
        const pct = parseInt(percentSlider.value) / 100;
        tw = Math.round(origW * pct); th = Math.round(origH * pct);
      } else {
        tw = parseInt(widthPx.value) || origW;
        th = parseInt(heightPx.value) || origH;
      }
      const maxPreview = 400;
      const scale = Math.min(1, maxPreview / Math.max(tw, th));
      previewCanvas.width = Math.round(tw * scale);
      previewCanvas.height = Math.round(th * scale);
      const ctx = previewCanvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(origImg, 0, 0, previewCanvas.width, previewCanvas.height);
      document.getElementById('outDims').textContent = `${tw} × ${th}px`;
      scheduleEstimate(tw, th);
      document.getElementById('previewPanel').style.display = 'block';
    }

    fileInput.addEventListener('change', () => { if (fileInput.files[0]) loadImage(fileInput.files[0]); fileInput.value = ''; });
    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', e => {
      e.preventDefault(); dropZone.classList.remove('dragover');
      const f = e.dataTransfer.files[0];
      if (f) loadImage(f);
    });

    resizeBtn.addEventListener('click', async () => {
      if (!origImg) return;
      if (origFile && origFile.size > FREE_LIMITS.pdfFileSizeMB * 1024 * 1024 && !isPremium()) {
        requirePremium('Resizing images over 10MB requires Pro', 'image-resize-size');
        return;
      }
      resizeBtn.disabled = true;
      try {
        let tw, th;
        if (currentMode === 'percent') {
          const pct = parseInt(percentSlider.value) / 100;
          tw = Math.round(origW * pct); th = Math.round(origH * pct);
        } else {
          tw = parseInt(widthPx.value) || origW;
          th = parseInt(heightPx.value) || origH;
        }
        if (!(tw > 0 && th > 0)) throw new Error('Width and height must be positive numbers.');
        const fmt = targetType();
        // JPEG output gets a white background so transparency doesn't turn black.
        const blob = await canvasToBlob(renderFull(tw, th, fmt), fmt, 0.92);
        downloadBlob(blob, `${baseName(origFile.name)}-${tw}x${th}.${extensionFor(blob.type)}`);
        showAlert('success', `✅ Downloaded ${tw}×${th}px ${extensionFor(blob.type).toUpperCase()} image.`);
      } catch (err) {
        showAlert('error', `❌ ${err.message}`);
      } finally {
        resizeBtn.disabled = false;
      }
    });
