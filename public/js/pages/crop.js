// Page controller: crop.html
import { initPaywall, isPremium, requirePremium, FREE_LIMITS } from '../stripe-paywall.js';
const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const cropArea = document.getElementById('cropArea');
    const cropImg = document.getElementById('cropImg');
    const cropWrap = document.getElementById('cropWrap');
    const cropBox = document.getElementById('cropBox');
    const cropBtn = document.getElementById('cropBtn');
    const alertArea = document.getElementById('alertArea');
    let origFile = null;
initPaywall();, naturalW = 0, naturalH = 0, displayW = 0, displayH = 0;
    let cropX = 0, cropY = 0, cropW = 0, cropH = 0;
    let isDragging = false, isResizing = false, dragCorner = null;
    let startX = 0, startY = 0, startCrop = {};
    let currentRatio = 'free';

    function loadFile(file) {
      origFile = file;
      if (cropImg._previewUrl) URL.revokeObjectURL(cropImg._previewUrl);
      const url = URL.createObjectURL(file);
      cropImg._previewUrl = url;
      cropImg.src = url;
      cropImg.onload = () => {
        naturalW = cropImg.naturalWidth; naturalH = cropImg.naturalHeight;
        displayW = cropImg.offsetWidth; displayH = cropImg.offsetHeight;
        dropZone.style.display = 'none';
        cropArea.classList.remove('hidden');
        // Default crop = full image with 10% margin
        cropX = Math.round(displayW * 0.05);
        cropY = Math.round(displayH * 0.05);
        cropW = Math.round(displayW * 0.9);
        cropH = Math.round(displayH * 0.9);
        updateCropBox();
        document.getElementById('cropInfo').style.display = 'block';
      };
    }

    function updateCropBox() {
      cropBox.style.left = cropX + 'px';
      cropBox.style.top = cropY + 'px';
      cropBox.style.width = cropW + 'px';
      cropBox.style.height = cropH + 'px';
      if (!isPremium() && origFile && origFile.size > FREE_LIMITS.pdfFileSizeMB * 1024 * 1024) {
        requirePremium('Cropping images over 10MB requires Pro', 'image-crop-size');
        return;
      }
      const scaleX = naturalW / displayW, scaleY = naturalH / displayH;
      document.getElementById('cropDims').textContent =
        `${Math.round(cropX * scaleX)}, ${Math.round(cropY * scaleY)} → ${Math.round(cropW * scaleX)} × ${Math.round(cropH * scaleY)}px`;
    }

    // Drag move
    cropBox.addEventListener('mousedown', e => {
      if (e.target.classList.contains('crop-handle')) return;
      isDragging = true;
      startX = e.clientX - cropX; startY = e.clientY - cropY;
      e.preventDefault();
    });

    // Resize corners
    cropBox.querySelectorAll('.crop-handle').forEach(h => {
      h.addEventListener('mousedown', e => {
        isResizing = true; dragCorner = h.dataset.corner;
        startX = e.clientX; startY = e.clientY;
        startCrop = { x: cropX, y: cropY, w: cropW, h: cropH };
        e.preventDefault(); e.stopPropagation();
      });
    });

    document.addEventListener('mousemove', e => {
      if (!isDragging && !isResizing) return;
      if (isDragging) {
        cropX = Math.max(0, Math.min(displayW - cropW, e.clientX - startX));
        cropY = Math.max(0, Math.min(displayH - cropH, e.clientY - startY));
      } else if (isResizing) {
        const dx = e.clientX - startX, dy = e.clientY - startY;
        let nx = startCrop.x, ny = startCrop.y, nw = startCrop.w, nh = startCrop.h;
        if (dragCorner.includes('r')) nw = Math.max(20, startCrop.w + dx);
        if (dragCorner.includes('b')) nh = Math.max(20, startCrop.h + dy);
        if (dragCorner.includes('l')) { nx = startCrop.x + dx; nw = Math.max(20, startCrop.w - dx); }
        if (dragCorner.includes('t')) { ny = startCrop.y + dy; nh = Math.max(20, startCrop.h - dy); }
        if (currentRatio !== 'free') {
          const [rw, rh] = currentRatio.split(':').map(Number);
          nh = Math.round(nw * rh / rw);
        }
        cropX = Math.max(0, Math.min(nx, displayW - 20));
        cropY = Math.max(0, Math.min(ny, displayH - 20));
        cropW = Math.min(nw, displayW - cropX);
        cropH = Math.min(nh, displayH - cropY);
      }
      updateCropBox();
    });
    document.addEventListener('mouseup', () => { isDragging = false; isResizing = false; });

    document.querySelectorAll('[data-ratio]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-ratio]').forEach(b => b.classList.remove('btn-secondary'));
        btn.classList.add('btn-secondary');
        currentRatio = btn.dataset.ratio;
        if (currentRatio !== 'free') {
          const [rw, rh] = currentRatio.split(':').map(Number);
          cropH = Math.round(cropW * rh / rw);
          if (cropY + cropH > displayH) { cropH = displayH - cropY; cropW = Math.round(cropH * rw / rh); }
          updateCropBox();
        }
      });
    });

    cropBtn.addEventListener('click', () => {
      const scaleX = naturalW / displayW, scaleY = naturalH / displayH;
      const sx = Math.round(cropX * scaleX), sy = Math.round(cropY * scaleY);
      const sw = Math.round(cropW * scaleX), sh = Math.round(cropH * scaleY);
      const canvas = document.createElement('canvas');
      canvas.width = sw; canvas.height = sh;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(cropImg, sx, sy, sw, sh, 0, 0, sw, sh);
      canvas.toBlob(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const base = origFile.name.replace(/\.[^.]+$/, '');
        a.href = url; a.download = `${base}-cropped.jpg`; a.click();
        URL.revokeObjectURL(url);
        alertArea.innerHTML = `<div class="alert alert-success">✅ Cropped ${sw}×${sh}px image downloaded.</div>`;
      }, 'image/jpeg', 0.92);
    });

    fileInput.addEventListener('change', () => { if (fileInput.files[0]) loadFile(fileInput.files[0]); });
    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', e => {
      e.preventDefault(); dropZone.classList.remove('dragover');
      const f = e.dataTransfer.files[0];
      if (f?.type.startsWith('image/')) loadFile(f);
    });
