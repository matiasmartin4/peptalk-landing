/* peptalk — backoffice · imágenes y videos.
   - PTA.uploadImage(carpeta, archivo): achica la imagen en el navegador (WebP, lado mayor 2000 px)
     y la sube al bucket público "media". La usan las fichas, las novedades y el newsletter.
   - PTA.mountMedia(contenedor, slug, editable): tarjeta de la ficha con portada, galería y videos. */
(function () {
  'use strict';
  const { $, $$, esc, icon, toast } = PTA;
  const MAX_BYTES = 8 * 1048576;

  // Achica y pasa a WebP (los GIF quedan como están para no perder la animación)
  async function prepare(file, maxSide = 2000) {
    if (!/^image\/(jpeg|png|webp|avif)$/.test(file.type)) return file;
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.type === 'image/webp' && file.size < 1.5 * 1048576) return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/webp', 0.86));
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.webp', { type: 'image/webp' });
  }

  PTA.uploadImage = async (folder, file, maxSide) => {
    if (!file.type.startsWith('image/')) throw new Error(`${file.name} no es una imagen.`);
    const ready = await prepare(file, maxSide);
    if (ready.size > MAX_BYTES) throw new Error(`${file.name} pesa más de 8 MB incluso achicada.`);
    return PTA.api.uploadMedia(folder, ready);
  };

  // YouTube y Vimeo: id para la miniatura
  const youtubeId = (url) => (url.match(/(?:youtu\.be\/|v=|shorts\/|embed\/)([\w-]{11})/) || [])[1];
  const isVideoUrl = (url) => /^https?:\/\/(www\.|m\.)?(youtube\.com|youtu\.be|vimeo\.com)\//.test(url);

  PTA.extend({
    real: ({ sb, q, uid }) => ({
      async uploadMedia(folder, file) {
        const path = `${folder}/${crypto.randomUUID()}.${file.name.split('.').pop().toLowerCase()}`;
        await q(sb.storage.from('media').upload(path, file, { contentType: file.type, cacheControl: '31536000' }));
        return { path, url: sb.storage.from('media').getPublicUrl(path).data.publicUrl };
      },
      mediaUrl: (path) => sb.storage.from('media').getPublicUrl(path).data.publicUrl,
      media: (slug) => q(sb.from('peptide_media').select('*').eq('slug', slug).order('sort').order('created_at')),
      addMedia: (row) => q(sb.from('peptide_media').insert(Object.assign({ created_by: uid() }, row))),
      updateMedia: (id, patch) => q(sb.from('peptide_media').update(patch).eq('id', id)),
      async setCover(slug, id) {
        await q(sb.from('peptide_media').update({ is_cover: false }).eq('slug', slug).eq('is_cover', true));
        if (id) await q(sb.from('peptide_media').update({ is_cover: true }).eq('id', id));
      },
      async deleteMedia(m) {
        if (m.path) await q(sb.storage.from('media').remove([m.path]));
        return q(sb.from('peptide_media').delete().eq('id', m.id));
      }
    }),
    demo: ({ ok, now }) => {
      const items = [], blobs = {};
      return {
        uploadMedia(folder, file) { const path = `${folder}/${Date.now()}-${file.name}`; blobs[path] = URL.createObjectURL(file); return ok({ path, url: blobs[path] }); },
        mediaUrl: (path) => blobs[path] || '',
        media: (slug) => ok(items.filter((m) => m.slug === slug).sort((a, b) => a.sort - b.sort)),
        addMedia(row) { items.push(Object.assign({ id: 'm' + Date.now() + Math.random(), alt: '', caption: '', credit: '', is_cover: false, sort: 0, created_at: now() }, row)); return ok(); },
        updateMedia(id, patch) { Object.assign(items.find((m) => m.id === id), patch); return ok(); },
        setCover(slug, id) { items.forEach((m) => { if (m.slug === slug) m.is_cover = m.id === id; }); return ok(); },
        deleteMedia(m) { items.splice(items.findIndex((x) => x.id === m.id), 1); return ok(); }
      };
    }
  });

  PTA.mountMedia = async (card, slug, edit) => {
    const api = PTA.api;
    let list = await api.media(slug);
    const draw = () => {
      const imgs = list.filter((m) => m.kind === 'imagen'), vids = list.filter((m) => m.kind === 'video');
      card.innerHTML = `
        <h2>Imágenes y videos</h2>
        ${edit ? `<label class="drop" id="imgDrop">${icon('image')}<b>Subir imágenes</b>JPG, PNG o WebP · se achican solas<input type="file" id="imgFile" accept="image/*" multiple hidden></label>` : ''}
        <div class="gallery">${imgs.map((m) => `
          <figure class="thumb${m.is_cover ? ' cover' : ''}" data-id="${esc(m.id)}">
            <img src="${esc(api.mediaUrl(m.path))}" alt="${esc(m.alt)}" loading="lazy">
            ${m.is_cover ? '<span class="tag ok">Portada</span>' : ''}
            ${edit ? `<div class="thumb-actions">
              <button class="btn icon sm" type="button" data-act="cover" aria-label="Usar como portada" title="Usar como portada">${icon('star')}</button>
              <button class="btn icon sm" type="button" data-act="left" aria-label="Mover antes">${icon('back')}</button>
              <button class="btn icon sm" type="button" data-act="del" aria-label="Borrar imagen">${icon('trash')}</button></div>` : ''}
            <input type="text" data-k="alt" placeholder="Descripción (para accesibilidad)" aria-label="Descripción de la imagen" value="${esc(m.alt)}"${edit ? '' : ' disabled'}>
            <input type="text" data-k="credit" placeholder="Autor o licencia" aria-label="Crédito de la imagen" value="${esc(m.credit)}"${edit ? '' : ' disabled'}>
          </figure>`).join('')}</div>
        ${imgs.length ? '' : '<p class="muted" style="margin:10px 0 0;font-size:13px">Sin imágenes.</p>'}
        <div class="videos">${vids.map((m) => {
          const yt = youtubeId(m.url);
          return `<div class="video-row" data-id="${esc(m.id)}">
            ${yt ? `<img src="https://i.ytimg.com/vi/${yt}/mqdefault.jpg" alt="" loading="lazy">` : `<span class="video-ph">${icon('video')}</span>`}
            <div><a href="${esc(m.url)}" target="_blank" rel="noopener">${esc(m.caption || m.url)}</a><small>${esc(new URL(m.url).hostname.replace('www.', ''))}</small></div>
            ${edit ? `<button class="btn icon ghost sm" type="button" data-act="del" aria-label="Quitar video">${icon('trash')}</button>` : ''}
          </div>`;
        }).join('')}</div>
        ${edit ? `<form class="video-add" id="videoForm">
          <input type="url" name="url" placeholder="Link de YouTube o Vimeo" aria-label="Link del video">
          <input type="text" name="caption" placeholder="Título (opcional)" aria-label="Título del video">
          <button class="btn sm" type="submit">${icon('video')}Agregar video</button></form>` : ''}`;
      if (edit) bind();
    };
    const reload = async () => { list = await api.media(slug); draw(); };

    const bind = () => {
      const upload = async (files) => {
        let sort = list.reduce((m, x) => Math.max(m, x.sort), 0);
        for (const file of files) {
          try {
            toast(`Subiendo ${file.name}…`);
            const { path } = await PTA.uploadImage(slug, file);
            await api.addMedia({ slug, kind: 'imagen', path, sort: ++sort });
          } catch (err) { toast(err.message, true); }
        }
        // la primera imagen de la ficha queda como portada
        const imgs = (await api.media(slug)).filter((m) => m.kind === 'imagen');
        if (imgs.length && !imgs.some((m) => m.is_cover)) await api.setCover(slug, imgs[0].id);
        await reload();
        toast('Listo.');
      };
      const drop = $('#imgDrop', card);
      $('#imgFile', card).addEventListener('change', (e) => { upload(Array.from(e.target.files)); e.target.value = ''; });
      drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
      drop.addEventListener('dragleave', () => drop.classList.remove('over'));
      drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); upload(Array.from(e.dataTransfer.files)); });

      card.onclick = async (e) => {
        const b = e.target.closest('[data-act]'), row = b && b.closest('[data-id]');
        if (!row) return;
        const m = list.find((x) => String(x.id) === row.dataset.id);
        try {
          if (b.dataset.act === 'cover') await api.setCover(slug, m.id);
          if (b.dataset.act === 'del') {
            await api.deleteMedia(m);
            if (m.is_cover) { const next = list.find((x) => x.kind === 'imagen' && x.id !== m.id); if (next) await api.setCover(slug, next.id); }
          }
          if (b.dataset.act === 'left') {
            const imgs = list.filter((x) => x.kind === 'imagen'), i = imgs.indexOf(m);
            if (i > 0) { imgs.splice(i, 1); imgs.splice(i - 1, 0, m); await Promise.all(imgs.map((x, k) => api.updateMedia(x.id, { sort: k + 1 }))); }
          }
          await reload();
        } catch (err) { toast(err.message, true); }
      };

      $$('.thumb input', card).forEach((input) => input.addEventListener('change', async () => {
        try { await api.updateMedia(input.closest('[data-id]').dataset.id, { [input.dataset.k]: input.value.trim() }); toast('Guardado.'); }
        catch (err) { toast(err.message, true); }
      }));

      $('#videoForm', card).addEventListener('submit', async (e) => {
        e.preventDefault();
        const f = e.currentTarget.elements, url = f.url.value.trim();
        if (!isVideoUrl(url)) { f.url.setAttribute('aria-invalid', 'true'); toast('Pegá un link de YouTube o Vimeo.', true); return; }
        try {
          await api.addMedia({ slug, kind: 'video', url, caption: f.caption.value.trim(), sort: list.length + 1 });
          await reload();
        } catch (err) { toast(err.message, true); }
      });
    };
    draw();
  };
})();
