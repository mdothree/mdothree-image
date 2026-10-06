// Page controller: convert.html
import { formatBytes, downloadBlob, canvasToBlob, createOutputCanvas, extensionFor, disableUnsupportedFormats, isImageFile, baseName } from '../utils/canvasUtils.js';
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

    disableUnsupportedFormats(targetFormat);

    function showAlert(type, msg) {
      alertArea.innerHTML = '';
      const div = document.createElement('div');
      div.className = `alert alert-${type}`;
      div.textContent = msg;
      alertArea.appendChild(div);
    }

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
          <span class="file-item-name"></span>
          <span class="file-item-size">${f.type.split('/')[1]?.toUpperCase() || '?'} · ${formatBytes(f.size)}</span>
          <button class="file-item-remove" data-i="${i}" aria-label="Remove">✕</button>`;
        li.querySelector('.file-item-name').textContent = f.name; // user data: text only
        fileList.appendChild(li);
      });
      fileList.querySelectorAll('.file-item-remove').forEach(btn =>
        btn.addEventListener('click', () => { files.splice(parseInt(btn.dataset.i), 1); renderList(); }));
      controls.classList.toggle('hidden', files.length === 0);
    }

    function addFiles(newFiles) {
      const all = Array.from(newFiles);
      const images = all.filter(isImageFile);
      alertArea.innerHTML = '';
      if (images.length < all.length) {
        const n = all.length - images.length;
        showAlert('error', `❌ ${n} file${n > 1 ? 's were' : ' was'} skipped — only image files can be converted.`);
      }
      files = [...files, ...images];
      renderList();
    }

    fileInput.addEventListener('change', () => { addFiles(fileInput.files); fileInput.value = ''; });
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
      const fmt = targetFormat.value;
      const quality = parseInt(qualitySlider.value) / 100;
      // Declared outside try: it was block-scoped inside it and read after
      // the finally, which threw a ReferenceError and suppressed every result
      // message and the history entry.
      let done = 0, lastExt = extensionFor(fmt);
      try {
        for (const file of files) {
          try {
            const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
            // White background only for JPEG (no alpha); PNG/WebP keep transparency.
            const { canvas, ctx } = createOutputCanvas(bitmap.width, bitmap.height, fmt);
            ctx.drawImage(bitmap, 0, 0);
            if (bitmap.close) bitmap.close();
            // canvasToBlob rejects on a null blob instead of hanging forever.
            const blob = await canvasToBlob(canvas, fmt, quality);
            lastExt = extensionFor(blob.type); // name by what was actually encoded
            downloadBlob(blob, `${baseName(file.name)}.${lastExt}`);
            done++;
            await new Promise(r => setTimeout(r, 150));
          } catch (e) {
            console.error(e);
          }
        }
      } finally { convertBtn.disabled = false; }
      if (done === 0) {
        showAlert('error', '❌ No images could be converted. Check the file format.');
      } else if (done < files.length) {
        showAlert('warning', `⚠️ Converted ${done}/${files.length} images. Some files could not be processed.`);
      } else {
        showAlert('success', `✅ Converted ${done} image${done !== 1 ? 's' : ''} to ${lastExt.toUpperCase()}.`);
      }
      await saveToHistory('image-convert', { count: done, targetFormat: fmt });
    });
