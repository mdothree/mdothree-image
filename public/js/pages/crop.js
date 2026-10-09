// Page controller: crop.html
import { initPaywall, isPremium, requirePremium, FREE_LIMITS } from '../stripe-paywall.js';
import { downloadBlob, canvasToBlob, createOutputCanvas, outputTypeFor, extensionFor, isImageFile, baseName } from '../utils/canvasUtils.js';
const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const cropArea = document.getElementById('cropArea');
    const cropImg = document.getElementById('cropImg');
    const cropWrap = document.getElementById('cropWrap');
    const cropBox = document.getElementById('cropBox');
    const cropBtn = document.getElementById('cropBtn');
    const alertArea = document.getElementById('alertArea');
    let origFile = null;
    let naturalW = 0, naturalH = 0, displayW = 0, displayH = 0;
    initPaywall();
    let cropX = 0, cropY = 0, cropW = 0, cropH = 0;
    let isDragging = false, isResizing = false, dragCorner = null;
    let startX = 0, startY = 0, startCrop = {};
    let currentRatio = 'free';

    function showAlert(type, msg) {
      alertArea.innerHTML = '';
      const div = document.createElement('div');
      div.className = `alert alert-${type}`;
      div.textContent = msg;
      alertArea.appendChild(div);
    }

    function loadFile(file) {
      if (!isImageFile(file)) { showAlert('error', "❌ That file isn't an image. Drop a JPG, PNG, WebP or GIF."); return; }
      alertArea.innerHTML = '';
      origFile = file;
      if (cropImg._previewUrl) URL.revokeObjectURL(cropImg._previewUrl);
      const url = URL.createObjectURL(file);
      cropImg._previewUrl = url;
      cropImg.src = url;
      cropImg.onerror = () => showAlert('error', `❌ Your browser can't decode this image (${file.type || 'unknown type'}).`);
      cropImg.onload = () => {
        naturalW = cropImg.naturalWidth; naturalH = cropImg.naturalHeight;
        // Un-hide BEFORE measuring: a hidden <img> reports offsetWidth 0, which
        // made the scale Infinity and the readout "NaN × NaNpx".
        dropZone.style.display = 'none';
        cropArea.classList.remove('hidden');
        displayW = cropImg.offsetWidth || cropImg.getBoundingClientRect().width;
        displayH = cropImg.offsetHeight || cropImg.getBoundingClientRect().height;
        if (!displayW || !displayH) {
          showAlert('error', "❌ Couldn't measure this image for cropping. Try another file or reload the page.");
          return;
        }
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
      const scaleX = naturalW / displayW, scaleY = naturalH / displayH;
      if (!isFinite(scaleX) || !isFinite(scaleY) || !(cropW > 0) || !(cropH > 0)) {
        document.getElementById('cropDims').textContent = 'Drag on the image to select an area to crop.';
        return;
      }
      document.getElementById('cropDims').textContent =
        `${Math.round(cropX * scaleX)}, ${Math.round(cropY * scaleY)} → ${Math.round(cropW * scaleX)} × ${Math.round(cropH * scaleY)}px`;
    }

    // Drag move
    // Pointer events (not mouse-only) so cropping works on touch screens.
    cropBox.style.touchAction = 'none';
    cropBox.addEventListener('pointerdown', e => {
      if (e.target.classList.contains('crop-handle')) return;
      isDragging = true;
      startX = e.clientX - cropX; startY = e.clientY - cropY;
      e.preventDefault();
    });

    // Resize corners
    cropBox.querySelectorAll('.crop-handle').forEach(h => {
      h.style.touchAction = 'none';
      h.addEventListener('pointerdown', e => {
        isResizing = true; dragCorner = h.dataset.corner;
        startX = e.clientX; startY = e.clientY;
        startCrop = { x: cropX, y: cropY, w: cropW, h: cropH };
        e.preventDefault(); e.stopPropagation();
      });
    });

    document.addEventListener('pointermove', e => {
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
    const endDrag = () => { isDragging = false; isResizing = false; };
    document.addEventListener('pointerup', endDrag);
    document.addEventListener('pointercancel', endDrag);

    // The displayed image size changes with the window; keep the crop box
    // mapped to the same image region instead of using a stale size.
    window.addEventListener('resize', () => {
      if (!naturalW || !displayW || !displayH) return;
      const nw = cropImg.offsetWidth, nh = cropImg.offsetHeight;
      if (!nw || !nh || (nw === displayW && nh === displayH)) return;
      const fx = nw / displayW, fy = nh / displayH;
      cropX *= fx; cropY *= fy; cropW *= fx; cropH *= fy;
      displayW = nw; displayH = nh;
      updateCropBox();
    });

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

    cropBtn.addEventListener('click', async () => {
      if (!origFile || !naturalW) { showAlert('error', '❌ Choose an image first.'); return; }
      if (!displayW || !displayH || !(cropW >= 1) || !(cropH >= 1) || ![cropX, cropY, cropW, cropH].every(Number.isFinite)) {
        showAlert('error', '❌ No crop area selected. Drag the box or its corners over the image, then try again.');
        return;
      }
      if (!isPremium() && origFile.size > FREE_LIMITS.pdfFileSizeMB * 1024 * 1024) {
        // Checked once here, not on every crop-box move (which re-opened the modal continuously).
        requirePremium('Cropping images over 10MB requires Pro', 'image-crop-size');
        return;
      }
      const scaleX = naturalW / displayW, scaleY = naturalH / displayH;
      const sx = Math.round(cropX * scaleX), sy = Math.round(cropY * scaleY);
      const sw = Math.max(1, Math.round(cropW * scaleX)), sh = Math.max(1, Math.round(cropH * scaleY));
      // Keep the input format when the browser can encode it (PNG stays
      // lossless + transparent); JPEG output gets a white background.
      const fmt = outputTypeFor(origFile.type);
      const { canvas, ctx } = createOutputCanvas(sw, sh, fmt);
      ctx.drawImage(cropImg, sx, sy, sw, sh, 0, 0, sw, sh);
      try {
        const blob = await canvasToBlob(canvas, fmt, 0.92);
        downloadBlob(blob, `${baseName(origFile.name)}-cropped.${extensionFor(blob.type)}`);
        showAlert('success', `✅ Cropped ${sw}×${sh}px image downloaded.`);
      } catch (err) {
        showAlert('error', `❌ Could not export the crop: ${err.message}`);
      }
    });

    fileInput.addEventListener('change', () => { if (fileInput.files[0]) loadFile(fileInput.files[0]); fileInput.value = ''; });
    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', e => {
      e.preventDefault(); dropZone.classList.remove('dragover');
      const f = e.dataTransfer.files[0];
      if (f) loadFile(f);
    });
