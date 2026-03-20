// Page controller: convert.html
import { formatBytes } from '../utils/canvasUtils.js';
    import { initPaywall, isPremium, requirePremium, FREE_LIMITS } from '../stripe-paywall.js';
    import { saveToHistory } from '../config/firebase.js';

    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const controls = document.getElementById('controls');
    const convertBtn = document.getElementById('convertBtn');
    const clearBtn = document.getElementById('clearBtn');
    const fileList = document.getElementById('fileList');
    const alertArea = document.getElementById('alertArea');
    const qualitySlider = document.getElementById('quality');
    const qualityVal = document.getElementById('qualityVal');
    const targetFormat = document.getElementById('targetFormat');
    let files = [];
    initPaywall().then(p => { if(p) { const b=document.getElementById('freeBanner'); if(b) b.remove(); } });

    qualitySlider.addEventListener('input', () => { qualityVal.textContent = qualitySlider.value + '%'; });

    targetFormat.addEventListener('change', () => {
      document.getElementById('qualityGroup').style.opacity = targetFormat.value === 'image/png' ? '0.4' : '1';
    });

    function renderList() {
      fileList.innerHTML = '';
      files.forEach((f, i) => {
        const li = document.createElement('li');
        li.className = 'file-item';
        li.innerHTML = `
          <span class="file-item-icon">🖼️</span>
          <span class="file-item-name">${f.name}</span>
          <span class="file-item-size">${f.type.split('/')[1]?.toUpperCase() || '?'} · ${formatBytes(f.size)}</span>
          <button class="file-item-remove" data-i="${i}">✕</button>`;
        fileList.appendChild(li);
      });
      fileList.querySelectorAll('.file-item-remove').forEach(btn =>
        btn.addEventListener('click', () => { files.splice(parseInt(btn.dataset.i), 1); renderList(); }));
      controls.classList.toggle('hidden', files.length === 0);
    }

    function addFiles(newFiles) {
      files = [...files, ...Array.from(newFiles).filter(f => f.type.startsWith('image/'))];
      renderList();
    }

    fileInput.addEventListener('change', () => addFiles(fileInput.files));
    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', e => { e.preventDefault(); dropZone.classList.remove('dragover'); addFiles(e.dataTransfer.files); });
    clearBtn.addEventListener('click', () => { files = []; renderList(); alertArea.innerHTML = ''; });

    convertBtn.addEventListener('click', async () => {
      if (!files.length) return;
      if (files.length > FREE_LIMITS.imagesBatch && !isPremium()) {
        requirePremium('Batch converting more than 1 image at a time', 'image-convert-batch');
        return;
      }
      convertBtn.disabled = true;
      alertArea.innerHTML = '';
      try {
      const fmt = targetFormat.value;
      const ext = fmt.split('/')[1].replace('jpeg', 'jpg');
      const quality = parseInt(qualitySlider.value) / 100;
      let done = 0;

      for (const file of files) {
        try {
          const bitmap = await createImageBitmap(file);
          const canvas = document.createElement('canvas');
          canvas.width = bitmap.width; canvas.height = bitmap.height;
          const ctx = canvas.getContext('2d');
          if (fmt !== 'image/png') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
          ctx.drawImage(bitmap, 0, 0);
          await new Promise(res => canvas.toBlob(blob => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            const base = file.name.replace(/\.[^.]+$/, '');
            a.href = url; a.download = `${base}.${ext}`; a.click();
            URL.revokeObjectURL(url);
            done++;
            res();
          }, fmt, quality));
          await new Promise(r => setTimeout(r, 150));
        } catch (e) {
          console.error(e);
        }
      }
      convertBtn.disabled = false;
      } finally { convertBtn.disabled = false; }
      if (done === 0) {
        alertArea.innerHTML = `<div class="alert alert-error">❌ No images could be converted. Check file format.</div>`;
      } else if (done < files.length) {
        alertArea.innerHTML = `<div class="alert alert-warning">⚠️ Converted ${done}/${files.length} images. Some files could not be processed.</div>`;
      } else {
        alertArea.innerHTML = `<div class="alert alert-success">✅ Converted ${done} image${done !== 1 ? 's' : ''} to ${ext.toUpperCase()}.</div>`;
      }
      await saveToHistory('image-convert', { count: done, targetFormat: fmt });
    });
