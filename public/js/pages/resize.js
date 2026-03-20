// Page controller: resize.html
import { resizeImage } from '../services/imageResize.js';
import { initPaywall, isPremium, requirePremium, FREE_LIMITS } from '../stripe-paywall.js';
    import { formatBytes } from '../utils/canvasUtils.js';

    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const resizeBtn = document.getElementById('resizeBtn');
    const previewCanvas = document.getElementById('previewCanvas');
    const alertArea = document.getElementById('alertArea');
    let origImg = null, origFile = null, origW = 0, origH = 0, currentMode = 'percent';
    initPaywall();

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
      document.getElementById('outFileSize').textContent = `~${formatBytes(tw * th * 3)}`;
      document.getElementById('previewPanel').style.display = 'block';
    }

    fileInput.addEventListener('change', () => { if (fileInput.files[0]) loadImage(fileInput.files[0]); });
    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', e => {
      e.preventDefault(); dropZone.classList.remove('dragover');
      const f = e.dataTransfer.files[0];
      if (f?.type.startsWith('image/')) loadImage(f);
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
        const outFmt = document.getElementById('outFormat').value;
        const fmt = outFmt === 'same' ? (origFile.type || 'image/jpeg') : outFmt;
        const ext = fmt.split('/')[1].replace('jpeg','jpg');
        const canvas = document.createElement('canvas');
        canvas.width = tw; canvas.height = th;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(origImg, 0, 0, tw, th);
        canvas.toBlob(blob => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          const base = origFile.name.replace(/\.[^.]+$/, '');
          a.href = url; a.download = `${base}-${tw}x${th}.${ext}`; a.click();
          URL.revokeObjectURL(url);
          alertArea.innerHTML = `<div class="alert alert-success">✅ Downloaded ${tw}×${th}px image.</div>`;
        }, fmt, 0.92);
      } catch (err) {
        alertArea.innerHTML = `<div class="alert alert-error">❌ ${err.message}</div>`;
      } finally {
        resizeBtn.disabled = false;
      }
    });
