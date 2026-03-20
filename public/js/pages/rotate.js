// Page controller: rotate.html
import { initPaywall, isPremium, requirePremium, FREE_LIMITS } from '../stripe-paywall.js';
const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const previewCanvas = document.getElementById('previewCanvas');
    const angleSlider = document.getElementById('angle');
    const angleVal = document.getElementById('angleVal');
    const bgColor = document.getElementById('bgColor');
    const downloadBtn = document.getElementById('downloadBtn');
    const alertArea = document.getElementById('alertArea');

    let origBitmap = null, origFile = null;
initPaywall();
    let rotation = 0, flipX = false, flipY = false, useTransparent = false;

    document.getElementById('bgTransparent').addEventListener('click', () => {
      useTransparent = !useTransparent;
      document.getElementById('bgTransparent').classList.toggle('btn-secondary', useTransparent);
      render();
    });

    function loadFile(file) {
      origFile = file;
      createImageBitmap(file).then(bmp => {
        if (!isPremium() && file.size > FREE_LIMITS.pdfFileSizeMB * 1024 * 1024) {
          requirePremium('Rotating images over 10MB requires Pro', 'image-rotate-size');
          return;
        }
        origBitmap = bmp;
        document.getElementById('controls').style.display = 'block';
        document.getElementById('previewPanel').style.display = 'block';
        render();
      });
    }

    function render() {
      if (!origBitmap) return;
      const rad = rotation * Math.PI / 180;
      const cos = Math.abs(Math.cos(rad)), sin = Math.abs(Math.sin(rad));
      const w = origBitmap.width, h = origBitmap.height;
      const outW = Math.round(w * cos + h * sin);
      const outH = Math.round(w * sin + h * cos);

      const maxPrev = 500;
      const scale = Math.min(1, maxPrev / Math.max(outW, outH));
      previewCanvas.width = Math.round(outW * scale);
      previewCanvas.height = Math.round(outH * scale);

      const ctx = previewCanvas.getContext('2d');
      ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
      if (!useTransparent) { ctx.fillStyle = bgColor.value; ctx.fillRect(0, 0, previewCanvas.width, previewCanvas.height); }
      ctx.save();
      ctx.translate(previewCanvas.width / 2, previewCanvas.height / 2);
      ctx.rotate(rad);
      ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
      ctx.drawImage(origBitmap, -w * scale / 2, -h * scale / 2, w * scale, h * scale);
      ctx.restore();
    }

    angleSlider.addEventListener('input', () => {
      rotation = parseInt(angleSlider.value);
      angleVal.textContent = rotation + '°';
      render();
    });

    document.getElementById('rot90l').addEventListener('click', () => { rotation = (rotation - 90 + 360) % 360; angleSlider.value = rotation > 180 ? rotation - 360 : rotation; angleVal.textContent = rotation + '°'; render(); });
    document.getElementById('rot90r').addEventListener('click', () => { rotation = (rotation + 90) % 360; angleSlider.value = rotation > 180 ? rotation - 360 : rotation; angleVal.textContent = rotation + '°'; render(); });
    document.getElementById('rot180').addEventListener('click', () => { rotation = (rotation + 180) % 360; angleSlider.value = rotation > 180 ? rotation - 360 : rotation; angleVal.textContent = rotation + '°'; render(); });
    document.getElementById('flipH').addEventListener('click', () => { flipX = !flipX; document.getElementById('flipH').classList.toggle('btn-secondary', flipX); render(); });
    document.getElementById('flipV').addEventListener('click', () => { flipY = !flipY; document.getElementById('flipV').classList.toggle('btn-secondary', flipY); render(); });
    document.getElementById('resetBtn').addEventListener('click', () => { rotation = 0; flipX = false; flipY = false; angleSlider.value = 0; angleVal.textContent = '0°'; document.getElementById('flipH').classList.remove('btn-secondary'); document.getElementById('flipV').classList.remove('btn-secondary'); render(); });
    bgColor.addEventListener('input', render);

    downloadBtn.addEventListener('click', () => {
      if (!origBitmap) return;
      const rad = rotation * Math.PI / 180;
      const cos = Math.abs(Math.cos(rad)), sin = Math.abs(Math.sin(rad));
      const w = origBitmap.width, h = origBitmap.height;
      const outW = Math.round(w * cos + h * sin);
      const outH = Math.round(w * sin + h * cos);
      const canvas = document.createElement('canvas');
      canvas.width = outW; canvas.height = outH;
      const ctx = canvas.getContext('2d');
      if (!useTransparent) { ctx.fillStyle = bgColor.value; ctx.fillRect(0, 0, outW, outH); }
      ctx.save();
      ctx.translate(outW / 2, outH / 2);
      ctx.rotate(rad);
      ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
      ctx.drawImage(origBitmap, -w / 2, -h / 2);
      ctx.restore();
      const fmt = useTransparent ? 'image/png' : 'image/jpeg';
      const ext = useTransparent ? 'png' : 'jpg';
      canvas.toBlob(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const base = origFile.name.replace(/\.[^.]+$/, '');
        a.href = url; a.download = `${base}-rotated.${ext}`; a.click();
        URL.revokeObjectURL(url);
        alertArea.innerHTML = `<div class="alert alert-success">✅ Downloaded.</div>`;
      }, fmt, 0.92);
    });

    fileInput.addEventListener('change', () => { if (fileInput.files[0]) loadFile(fileInput.files[0]); });
    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', e => {
      e.preventDefault(); dropZone.classList.remove('dragover');
      const f = e.dataTransfer.files[0];
      if (f?.type.startsWith('image/')) loadFile(f);
    });
