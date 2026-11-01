/* peptalk — backoffice · novedades y newsletter.
   #novedades   hechos con fuente; Grok (o el equipo) los propone y una persona los aprueba.
   #newsletter  ediciones semanales.
   #n/<id>      editor de una edición: datos del mail, banner, cuerpo tipo documento (Tiptap)
                con imágenes, secciones de novedades y fichas, y vista previa del mail. */
(function () {
  'use strict';
  const { $, $$, esc, icon, toast, options, fmtDate, fmtWhen, isUrl, slugify } = PTA;
  const KINDS = { estudio: 'Estudio', regulatorio: 'Regulatorio', alerta: 'Alerta', mercado: 'Mercado', peptalk: 'peptalk' };
  const ISSUE_STATES = { borrador: 'Borrador', lista: 'Lista para enviar', enviada: 'Enviada' };
  const SITE = 'https://peptalkarg.com';
  // lunes de la semana, en hora local (toISOString usaría UTC y de noche cae en otro día)
  const monday = (d = new Date()) => {
    const x = new Date(d);
    x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  };
  const clip = (s, n) => (s && s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s || '');

  /* ---------- datos ---------- */
  PTA.extend({
    real: ({ sb, q, uid }) => ({
      news: (state) => q(sb.from('news')
        .select('*, author:profiles!news_author_fkey(name,email,role), reviewer:profiles!news_reviewed_by_fkey(name,email), peptides:news_peptides(slug)')
        .eq('state', state).order('happened_on', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false })),
      async newsCount() { const { count } = await sb.from('news').select('id', { count: 'exact', head: true }).eq('state', 'propuesta'); return count || 0; },
      async saveNews(id, row, slugs) {
        const saved = id ? await q(sb.from('news').update(row).eq('id', id).select().single())
          : await q(sb.from('news').insert(Object.assign({ author: uid() }, row)).select().single());
        await q(sb.from('news_peptides').delete().eq('news_id', saved.id));
        if (slugs.length) await q(sb.from('news_peptides').insert(slugs.map((slug) => ({ news_id: saved.id, slug }))));
        return saved;
      },
      reviewNews: (id, state) => q(sb.from('news').update(state === 'aprobada' ? { state } : { state, published: false }).eq('id', id)),
      publishNews: (id, published) => q(sb.from('news').update({ published }).eq('id', id)),
      deleteNews: (id) => q(sb.from('news').delete().eq('id', id)),

      issues: () => q(sb.from('newsletter_issues').select('id,title,subject,week_of,state,sent_at,updated_at').order('week_of', { ascending: false })),
      issue: (id) => q(sb.from('newsletter_issues').select('*, items:newsletter_items(*)').eq('id', id).single()),
      createIssue: (row) => q(sb.from('newsletter_issues').insert(Object.assign({ created_by: uid() }, row)).select().single()),
      async saveIssue(id, patch, items) {
        const saved = await q(sb.from('newsletter_issues').update(patch).eq('id', id).select().single());
        await q(sb.from('newsletter_items').delete().eq('issue_id', id));
        if (items.length) await q(sb.from('newsletter_items').insert(items.map((it, i) => Object.assign({ issue_id: id, sort: i + 1 }, it))));
        return saved;
      }
    }),
    demo: ({ ok, fail, now, ago, me, people }) => {
      const grok = people.find((p) => p.role === 'agente');
      const who = (id) => { const p = people.find((x) => x.id === id); return p && { name: p.name, email: p.email, role: p.role }; };
      const news = [
        { id: 'nw1', title: 'Ejemplo de demo: propuesta de Grok', summary: 'Así se ve una novedad que propone Grok: título, resumen corto, fuente y fichas relacionadas.', body: '',
          kind: 'regulatorio', source_name: 'ANMAT', source_url: 'https://www.argentina.gob.ar/anmat', happened_on: ago(30).slice(0, 10), image_path: null,
          state: 'propuesta', published: false, author: grok.id, created_at: ago(5), peptides: [{ slug: 'bpc-157' }] },
        { id: 'nw2', title: 'Ejemplo de demo: novedad aprobada', summary: 'Una novedad aprobada puede entrar en el newsletter y, si se marca, mostrarse en el sitio.', body: '',
          kind: 'estudio', source_name: 'PubMed', source_url: 'https://pubmed.ncbi.nlm.nih.gov/', happened_on: ago(80).slice(0, 10), image_path: null,
          state: 'aprobada', published: false, author: people[1].id, reviewed_by: people[0].id, reviewed_at: ago(20), created_at: ago(90), peptides: [{ slug: 'semaglutida' }] }
      ];
      const issues = [], items = [];
      const can = (...r) => r.includes(me().role);
      return {
        news: (state) => ok(news.filter((n) => n.state === state).map((n) => Object.assign({}, n, { author: who(n.author), reviewer: who(n.reviewed_by) }))),
        newsCount: () => ok(news.filter((n) => n.state === 'propuesta').length),
        saveNews(id, row, slugs) {
          let n = id && news.find((x) => x.id === id);
          if (!n) { n = { id: 'nw' + Date.now(), state: 'propuesta', published: false, author: me().id, created_at: now() }; news.unshift(n); }
          Object.assign(n, row, { peptides: slugs.map((slug) => ({ slug })) });
          return ok(n);
        },
        reviewNews(id, state) {
          if (!can('admin', 'editor')) return fail('No tenés permiso para hacer esto.');
          const n = news.find((x) => x.id === id);
          if (state === 'aprobada' && n.kind !== 'peptalk' && !n.source_url) return fail('Para aprobarla tiene que tener el link a la fuente.');
          Object.assign(n, { state, reviewed_by: me().id, reviewed_at: now() }, state === 'aprobada' ? {} : { published: false });
          return ok();
        },
        publishNews(id, published) { Object.assign(news.find((x) => x.id === id), { published }); return ok(); },
        deleteNews(id) { news.splice(news.findIndex((x) => x.id === id), 1); return ok(); },

        issues: () => ok(issues.slice().sort((a, b) => (a.week_of < b.week_of ? 1 : -1))),
        issue(id) { const i = issues.find((x) => x.id === id); return i ? ok(Object.assign({}, i, { items: items.filter((x) => x.issue_id === id) })) : fail('No existe esa edición.'); },
        createIssue(row) {
          const i = Object.assign({ id: 'is' + Date.now(), subject: '', preheader: '', banner_path: null, banner_alt: '', body: { type: 'doc', content: [] },
            body_html: '', state: 'borrador', created_at: now(), updated_at: now() }, row);
          issues.push(i);
          return ok(i);
        },
        saveIssue(id, patch, list) {
          const i = issues.find((x) => x.id === id);
          if (i.state === 'enviada') return fail('Esa edición ya se envió.');
          Object.assign(i, patch, { updated_at: now() });
          for (let k = items.length - 1; k >= 0; k--) if (items[k].issue_id === id) items.splice(k, 1);
          list.forEach((it, n) => items.push(Object.assign({ id: 'it' + Date.now() + n, issue_id: id, sort: n + 1 }, it)));
          return ok(i);
        }
      };
    }
  });

  PTA.hooks.count.push(async () => {
    if (!PTA.can('admin', 'editor')) return;
    const n = await PTA.api.newsCount().catch(() => 0), b = $('#newsCount');
    b.hidden = !n;
    b.textContent = n;
  });

  /* ---------- novedades ---------- */
  async function viewNews(el, state = 'propuesta') {
    const api = PTA.api, review = PTA.can('admin', 'editor');
    const [list, peptides] = await Promise.all([api.news(state), api.peptides()]);
    const names = Object.fromEntries(peptides.map((p) => [p.slug, p.name]));
    el.innerHTML = `
      <header class="head"><div><h1>Novedades</h1><p>Hechos con fuente: estudios, resoluciones, alertas. Grok las propone y una persona las aprueba antes de usarlas.</p></div>
        <div class="actions"><button class="btn primary" type="button" id="newNews">${icon('plus')}Nueva novedad</button></div></header>
      <div id="newsFormWrap"></div>
      <div class="toolbar"><div class="tabs" role="tablist">
        ${[['propuesta', 'Propuestas'], ['aprobada', 'Aprobadas'], ['descartada', 'Descartadas']].map(([v, l]) => `<button type="button" role="tab" data-state="${v}" aria-selected="${v === state}">${l}</button>`).join('')}
      </div></div>
      <div class="drafts">${list.length ? list.map((n) => `
        <article class="draft news-item" data-id="${esc(n.id)}">
          ${n.image_path ? `<img class="news-img" src="${esc(api.mediaUrl(n.image_path))}" alt="">` : ''}
          <div class="draft-head">
            <span class="tag ${n.kind === 'alerta' ? 'bad' : n.kind === 'regulatorio' ? 'warn' : ''}">${KINDS[n.kind]}</span>
            <h3>${esc(n.title)}</h3>${PTA.authorTag(n.author)}
            <time>${n.happened_on ? fmtDate(n.happened_on) : fmtWhen(n.created_at)}</time>
          </div>
          ${n.summary ? `<p style="margin:0;font-size:13px">${esc(n.summary)}</p>` : ''}
          <div class="draft-meta">
            ${n.source_url ? `<a href="${esc(n.source_url)}" target="_blank" rel="noopener">${esc(n.source_name || 'Ver fuente')}</a>` : '<span class="tag bad">Sin fuente</span>'}
            ${(n.peptides || []).map((x) => `<a href="#p/${esc(x.slug)}">${esc(names[x.slug] || x.slug)}</a>`).join('')}
            ${n.reviewer ? `<span>${state === 'aprobada' ? 'Aprobada' : 'Revisada'} por ${esc(n.reviewer.name || n.reviewer.email)}</span>` : ''}
          </div>
          ${review ? `<div class="draft-actions">
            <button class="btn sm" type="button" data-act="edit">Editar</button>
            ${state === 'propuesta' ? '<span style="flex:1"></span><button class="btn sm" type="button" data-act="discard">Descartar</button><button class="btn sm accent" type="button" data-act="approve">Aprobar</button>' : ''}
            ${state === 'aprobada' ? `<span style="flex:1"></span><label class="switch"><input type="checkbox" data-act="publish"${n.published ? ' checked' : ''}>Mostrar en el sitio</label>` : ''}
            ${state === 'descartada' ? '<span style="flex:1"></span><button class="btn sm" type="button" data-act="restore">Volver a propuestas</button><button class="btn sm danger" type="button" data-act="delete">Borrar</button>' : ''}
          </div>` : ''}
        </article>`).join('') : `<div class="card empty">${state === 'propuesta' ? 'No hay novedades para revisar.' : 'Todavía no hay novedades acá.'}</div>`}
      </div>`;

    $$('[data-state]', el).forEach((b) => b.addEventListener('click', () => viewNews(el, b.dataset.state)));
    $('#newNews').addEventListener('click', () => newsForm(el, null, peptides, () => viewNews(el, 'propuesta')));
    el.querySelector('.drafts').addEventListener('click', async (e) => {
      const b = e.target.closest('[data-act]');
      if (!b || b.dataset.act === 'publish') return;
      const id = b.closest('[data-id]').dataset.id, n = list.find((x) => String(x.id) === id);
      if (b.dataset.act === 'edit') return newsForm(el, n, peptides, () => viewNews(el, state));
      b.disabled = true;
      try {
        if (b.dataset.act === 'approve') { await api.reviewNews(id, 'aprobada'); toast('Aprobada. Ya se puede sumar al newsletter.'); }
        if (b.dataset.act === 'discard') { await api.reviewNews(id, 'descartada'); toast('Descartada.'); }
        if (b.dataset.act === 'restore') { await api.reviewNews(id, 'propuesta'); toast('Volvió a propuestas.'); }
        if (b.dataset.act === 'delete') { await api.deleteNews(id); toast('Borrada.'); }
        PTA.hooks.count.forEach((fn) => fn());
        viewNews(el, state);
      } catch (err) { toast(err.message, true); b.disabled = false; }
    });
    el.querySelector('.drafts').addEventListener('change', async (e) => {
      const input = e.target.closest('[data-act="publish"]');
      if (!input) return;
      try { await api.publishNews(input.closest('[data-id]').dataset.id, input.checked); toast(input.checked ? 'Se va a ver en el sitio en la próxima publicación.' : 'Ya no se muestra en el sitio.'); }
      catch (err) { toast(err.message, true); input.checked = !input.checked; }
    });
  }

  function newsForm(el, n, peptides, done) {
    const wrap = $('#newsFormWrap', el);
    const linked = new Set((n && n.peptides || []).map((x) => x.slug));
    let image = n ? n.image_path : null;
    wrap.innerHTML = `
      <form class="card" id="newsForm" novalidate style="margin-bottom:16px">
        <h2>${n ? 'Editar novedad' : 'Nueva novedad'} <small>${n ? '' : 'Entra como propuesta'}</small></h2>
        <div class="stack">
          <label class="field"><span>Título</span><input type="text" name="title" required></label>
          <div class="grid3">
            <label class="field"><span>Tipo</span><select name="kind">${options(Object.entries(KINDS), n ? n.kind : 'estudio')}</select></label>
            <label class="field"><span>Fecha del hecho</span><input type="date" name="happened_on"></label>
            <label class="field"><span>Fuente</span><input type="text" name="source_name" placeholder="ANMAT, PubMed…"></label>
          </div>
          <label class="field"><span>Link a la fuente <em>(obligatorio para aprobarla)</em></span><input type="url" name="source_url" placeholder="https://"></label>
          <label class="field"><span>Resumen <em>(dos o tres líneas; es lo que va en el newsletter)</em></span><textarea name="summary" rows="3"></textarea></label>
          <label class="field"><span>Detalle <em>(opcional)</em></span><textarea name="body" rows="4"></textarea></label>
          <div class="grid2">
            <div class="field"><span>Imagen <em>(opcional)</em></span><div id="newsImg"></div></div>
            <div class="field"><span>Fichas relacionadas</span>
              <input type="search" id="pepSearch" placeholder="Buscar ficha" aria-label="Buscar ficha">
              <div class="pick" id="pepPick"></div></div>
          </div>
        </div>
        <div class="toolbar" style="margin:14px 0 0;justify-content:flex-end"><button class="btn" type="button" id="cancelNews">Cancelar</button><button class="btn primary" type="submit">Guardar</button></div>
      </form>`;
    const f = $('#newsForm', wrap).elements;
    ['title', 'happened_on', 'source_name', 'source_url', 'summary', 'body'].forEach((k) => { f[k].value = (n && n[k]) || ''; });

    const drawImg = () => {
      $('#newsImg', wrap).innerHTML = image
        ? `<div class="banner-prev"><img src="${esc(PTA.api.mediaUrl(image))}" alt=""><button class="btn sm" type="button" id="rmImg">${icon('trash')}Quitar</button></div>`
        : `<label class="drop">${icon('image')}<b>Subir imagen</b><input type="file" id="newsFile" accept="image/*" hidden></label>`;
      if (image) $('#rmImg', wrap).addEventListener('click', () => { image = null; drawImg(); });
      else $('#newsFile', wrap).addEventListener('change', async (e) => {
        try { toast('Subiendo imagen…'); image = (await PTA.uploadImage('novedades', e.target.files[0], 1600)).path; drawImg(); toast('Listo.'); }
        catch (err) { toast(err.message, true); }
      });
    };
    drawImg();

    const drawPick = () => {
      const qy = slugify($('#pepSearch', wrap).value);
      const list = peptides.filter((p) => linked.has(p.slug) || !qy || slugify(p.name + ' ' + p.alias).includes(qy)).slice(0, 60);
      $('#pepPick', wrap).innerHTML = list.map((p) => `<label><input type="checkbox" value="${esc(p.slug)}"${linked.has(p.slug) ? ' checked' : ''}>${esc(p.name)}</label>`).join('');
    };
    drawPick();
    $('#pepSearch', wrap).addEventListener('input', drawPick);
    $('#pepPick', wrap).addEventListener('change', (e) => { const c = e.target; if (c.checked) linked.add(c.value); else linked.delete(c.value); });

    $('#cancelNews', wrap).addEventListener('click', () => { wrap.innerHTML = ''; });
    $('#newsForm', wrap).addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = f.title.value.trim(), url = f.source_url.value.trim();
      $$('[aria-invalid]', wrap).forEach((i) => i.removeAttribute('aria-invalid'));
      if (!title) { f.title.setAttribute('aria-invalid', 'true'); toast('Falta el título.', true); return; }
      if (url && !isUrl(url)) { f.source_url.setAttribute('aria-invalid', 'true'); toast('El link de la fuente no es válido.', true); return; }
      try {
        await PTA.api.saveNews(n && n.id, {
          title, kind: f.kind.value, happened_on: f.happened_on.value || null, source_name: f.source_name.value.trim(), source_url: url || null,
          summary: f.summary.value.trim(), body: f.body.value.trim(), image_path: image
        }, [...linked]);
        toast('Guardada.');
        PTA.hooks.count.forEach((fn) => fn());
        done();
      } catch (err) { toast(err.message, true); }
    });
    f.title.focus();
    wrap.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  /* ---------- ediciones ---------- */
  async function viewIssues(el) {
    const list = await PTA.api.issues();
    el.innerHTML = `
      <header class="head"><div><h1>Newsletter</h1><p>Una edición por semana: banner, texto con imágenes y las novedades y fichas nuevas.</p></div>
        <div class="actions"><button class="btn primary" type="button" id="newIssue">${icon('plus')}Nueva edición</button></div></header>
      <div class="table-wrap"><table>
        <thead><tr><th>Semana</th><th>Edición</th><th>Estado</th><th>Actualizada</th></tr></thead>
        <tbody>${list.length ? list.map((i) => `
          <tr class="row-link" data-id="${esc(i.id)}">
            <td class="num">${fmtDate(i.week_of)}</td>
            <td><a href="#n/${esc(i.id)}"><b>${esc(i.title)}</b></a><span class="sub">${esc(i.subject || 'Sin asunto')}</span></td>
            <td><span class="tag ${i.state === 'enviada' ? 'ok' : i.state === 'lista' ? 'warn' : ''}">${ISSUE_STATES[i.state]}</span></td>
            <td class="num">${fmtWhen(i.updated_at)}</td>
          </tr>`).join('') : '<tr><td colspan="4" class="empty">Todavía no hay ediciones. Creá la primera.</td></tr>'}</tbody>
      </table></div>`;
    $('tbody', el).addEventListener('click', (e) => { const tr = e.target.closest('tr[data-id]'); if (tr && !e.target.closest('a')) location.hash = 'n/' + tr.dataset.id; });
    $('#newIssue').addEventListener('click', async () => {
      const week = monday();
      try {
        const i = await PTA.api.createIssue({ title: `Semana del ${fmtDate(week)}`, subject: 'Lo nuevo en péptidos esta semana', week_of: week });
        location.hash = 'n/' + i.id;
      } catch (err) { toast(err.message, true); }
    });
  }

  async function viewIssue(el, id) {
    const api = PTA.api;
    const [issue, approved, peptides] = await Promise.all([api.issue(id), api.news('aprobada'), api.peptides()]);
    const sent = issue.state === 'enviada', dis = sent ? ' disabled' : '';
    const newsById = Object.fromEntries(approved.map((n) => [n.id, n]));
    const pepBySlug = Object.fromEntries(peptides.map((p) => [p.slug, p]));
    let banner = issue.banner_path;
    let items = (issue.items || []).sort((a, b) => a.sort - b.sort).map((it) => ({ kind: it.kind, news_id: it.news_id, slug: it.slug, heading: it.heading || '', blurb: it.blurb || '' }));
    // las fichas marcadas como nuevas van primero en el selector
    const pepOptions = peptides.slice().sort((a, b) => ((b.tags || []).includes('nuevo') - (a.tags || []).includes('nuevo')) || a.name.localeCompare(b.name));

    el.innerHTML = `
      <a class="back" href="#newsletter">${icon('back')}Newsletter</a>
      <header class="head"><div><h1 id="issueTitle">${esc(issue.title)}</h1><p>Semana del ${fmtDate(issue.week_of)} · ${ISSUE_STATES[issue.state]}</p></div>
        <div class="actions">
          <select id="issueState" aria-label="Estado"${dis}>${options(Object.entries(ISSUE_STATES).filter(([k]) => sent || k !== 'enviada'), issue.state)}</select>
          <button class="btn" type="button" disabled title="El envío se conecta cuando elijamos el proveedor de mails">${icon('send')}Enviar</button>
        </div></header>
      ${sent ? '<div class="banner info">Esta edición ya se envió: queda como registro y no se puede modificar.</div>' : ''}
      <div class="issue-grid">
        <div>
          <section class="card"><h2>El mail</h2><div class="stack">
            <div class="grid2">
              <label class="field"><span>Título de la edición</span><input type="text" name="title"${dis}></label>
              <label class="field"><span>Semana</span><input type="date" name="week_of"${dis}></label>
            </div>
            <label class="field"><span>Asunto</span><input type="text" name="subject" maxlength="120"${dis}></label>
            <label class="field"><span>Texto de vista previa <em>(lo que se ve al lado del asunto en la bandeja)</em></span><input type="text" name="preheader" maxlength="140"${dis}></label>
          </div></section>

          <section class="card"><h2>Banner <small>1200 × 400 px recomendado</small></h2>
            <div id="bannerBox"></div>
            <label class="field" style="margin-top:10px"><span>Descripción del banner <em>(para quien no ve imágenes)</em></span><input type="text" name="banner_alt"${dis}></label>
          </section>

          <section class="card"><h2>Contenido</h2>
            ${sent ? '' : `<div class="rt-toolbar" id="rtBar" role="toolbar" aria-label="Formato">
              <button type="button" data-cmd="bold" aria-label="Negrita">${icon('bold')}</button>
              <button type="button" data-cmd="italic" aria-label="Cursiva">${icon('italic')}</button>
              <button type="button" data-cmd="underline" aria-label="Subrayado"><u>S</u></button>
              <span class="sep"></span>
              <button type="button" data-cmd="h2" aria-label="Título">T1</button>
              <button type="button" data-cmd="h3" aria-label="Subtítulo">T2</button>
              <button type="button" data-cmd="ul" aria-label="Lista">${icon('ul')}</button>
              <button type="button" data-cmd="ol" aria-label="Lista numerada">${icon('ol')}</button>
              <button type="button" data-cmd="quote" aria-label="Cita">${icon('quote')}</button>
              <button type="button" data-cmd="hr" aria-label="Separador">${icon('hr')}</button>
              <span class="sep"></span>
              <button type="button" data-cmd="left" aria-label="Alinear a la izquierda">${icon('al')}</button>
              <button type="button" data-cmd="center" aria-label="Centrar">${icon('ac')}</button>
              <span class="sep"></span>
              <button type="button" data-cmd="link" aria-label="Link">${icon('link')}</button>
              <button type="button" data-cmd="image" aria-label="Imagen">${icon('image')}</button>
              <span class="sep"></span>
              <button type="button" data-cmd="undo" aria-label="Deshacer">${icon('undo')}</button>
              <button type="button" data-cmd="redo" aria-label="Rehacer">${icon('redo')}</button>
              <input type="file" id="rtImage" accept="image/*" hidden>
            </div>
            <div class="rt-link" id="rtLink" hidden><input type="url" placeholder="https://" aria-label="Dirección del link"><button class="btn sm" type="button" data-link="set">Aplicar</button><button class="btn sm ghost" type="button" data-link="unset">Quitar link</button></div>`}
            <div class="rt" id="rtBody"></div>
            <p class="hint">Podés pegar o arrastrar imágenes adentro del texto.</p>
          </section>

          <section class="card"><h2>Secciones <small>novedades y fichas que van después del texto</small></h2>
            <div class="stack" id="items"></div>
            ${sent ? '' : `<div class="item-add">
              <select id="addNews" aria-label="Novedad aprobada"><option value="">Sumar una novedad aprobada…</option>${approved.map((n) => `<option value="${esc(n.id)}">${esc(clip(n.title, 70))}</option>`).join('')}</select>
              <select id="addPep" aria-label="Ficha"><option value="">Sumar una ficha…</option>${pepOptions.map((p) => `<option value="${esc(p.slug)}">${esc(p.name)}${(p.tags || []).includes('nuevo') ? ' · nueva' : ''}</option>`).join('')}</select>
            </div>`}
          </section>
          ${sent ? '' : '<div class="savebar" id="issueSave" hidden><span>Tenés cambios sin guardar.</span><button class="btn" type="button" id="issueDiscard">Descartar</button><button class="btn accent" type="button" id="issueSaveBtn">Guardar</button></div>'}
        </div>
        <aside class="preview-col">
          <div class="preview-head">${icon('eye')}Vista previa del mail</div>
          <div class="mail" id="mailPreview"></div>
        </aside>
      </div>`;

    const field = (n) => $(`[name="${n}"]`, el);
    ['title', 'week_of', 'subject', 'preheader', 'banner_alt'].forEach((k) => { field(k).value = issue[k] || ''; });

    /* banner */
    const drawBanner = () => {
      $('#bannerBox', el).innerHTML = banner
        ? `<div class="banner-prev wide"><img src="${esc(api.mediaUrl(banner))}" alt="">${sent ? '' : `<div><label class="btn sm">${icon('upload')}Reemplazar<input type="file" id="bannerFile" accept="image/*" hidden></label><button class="btn sm" type="button" id="bannerRm">${icon('trash')}Quitar</button></div>`}</div>`
        : sent ? '<p class="muted">Sin banner.</p>' : `<label class="drop">${icon('image')}<b>Subir banner</b>Se achica solo a 1600 px de ancho<input type="file" id="bannerFile" accept="image/*" hidden></label>`;
      const file = $('#bannerFile', el), rm = $('#bannerRm', el);
      if (file) file.addEventListener('change', async (e) => {
        try { toast('Subiendo banner…'); banner = (await PTA.uploadImage(`newsletter/${id}`, e.target.files[0], 1600)).path; drawBanner(); sync(); toast('Listo.'); }
        catch (err) { toast(err.message, true); }
      });
      if (rm) rm.addEventListener('click', () => { banner = null; drawBanner(); sync(); });
    };
    drawBanner();

    /* editor tipo documento */
    const uploadInto = async (files, pos) => {
      for (const file of files) {
        if (!file.type.startsWith('image/')) continue;
        try {
          toast(`Subiendo ${file.name}…`);
          const { url } = await PTA.uploadImage(`newsletter/${id}`, file, 1400);
          const chain = ed.chain().focus();
          (pos == null ? chain : chain.setTextSelection(pos)).setImage({ src: url, alt: file.name.replace(/\.\w+$/, '') }).run();
          toast('Listo.');
        } catch (err) { toast(err.message, true); }
      }
    };
    const filesOf = (dt) => Array.from((dt && dt.files) || []).filter((f) => f.type.startsWith('image/'));
    const ed = new Tiptap.Editor({
      element: $('#rtBody', el),
      editable: !sent,
      extensions: [
        Tiptap.StarterKit.configure({ heading: { levels: [2, 3] }, link: { openOnClick: false, autolink: true, defaultProtocol: 'https' } }),
        Tiptap.Image,
        Tiptap.TextAlign.configure({ types: ['heading', 'paragraph'] }),
        Tiptap.Placeholder.configure({ placeholder: 'Escribí la edición: un saludo, lo más importante de la semana, lo que quieras contar…' })
      ],
      content: issue.body && issue.body.content && issue.body.content.length ? issue.body : '',
      editorProps: {
        handlePaste: (view, event) => { const f = filesOf(event.clipboardData); if (!f.length) return false; uploadInto(f); return true; },
        handleDrop: (view, event) => {
          const f = filesOf(event.dataTransfer); if (!f.length) return false;
          const at = view.posAtCoords({ left: event.clientX, top: event.clientY });
          uploadInto(f, at && at.pos);
          return true;
        }
      },
      onUpdate: () => sync(),
      onSelectionUpdate: () => paintBar(),
      onTransaction: () => paintBar()
    });

    const CMDS = {
      bold: (c) => c.toggleBold(), italic: (c) => c.toggleItalic(), underline: (c) => c.toggleUnderline(),
      h2: (c) => c.toggleHeading({ level: 2 }), h3: (c) => c.toggleHeading({ level: 3 }),
      ul: (c) => c.toggleBulletList(), ol: (c) => c.toggleOrderedList(), quote: (c) => c.toggleBlockquote(), hr: (c) => c.setHorizontalRule(),
      left: (c) => c.setTextAlign('left'), center: (c) => c.setTextAlign('center'), undo: (c) => c.undo(), redo: (c) => c.redo()
    };
    const ACTIVE = {
      bold: () => ed.isActive('bold'), italic: () => ed.isActive('italic'), underline: () => ed.isActive('underline'),
      h2: () => ed.isActive('heading', { level: 2 }), h3: () => ed.isActive('heading', { level: 3 }), ul: () => ed.isActive('bulletList'),
      ol: () => ed.isActive('orderedList'), quote: () => ed.isActive('blockquote'), link: () => ed.isActive('link'),
      center: () => ed.isActive({ textAlign: 'center' })
    };
    function paintBar() { $$('#rtBar [data-cmd]', el).forEach((b) => { const f = ACTIVE[b.dataset.cmd]; if (f) b.setAttribute('aria-pressed', f()); }); }
    if (!sent) {
      const linkBar = $('#rtLink', el), linkInput = $('input', linkBar);
      $('#rtBar', el).addEventListener('click', (e) => {
        const b = e.target.closest('[data-cmd]');
        if (!b) return;
        const cmd = b.dataset.cmd;
        if (cmd === 'image') return $('#rtImage', el).click();
        if (cmd === 'link') {
          linkBar.hidden = !linkBar.hidden;
          linkInput.value = ed.getAttributes('link').href || '';
          if (!linkBar.hidden) linkInput.focus();
          return;
        }
        CMDS[cmd](ed.chain().focus()).run();
      });
      $('#rtImage', el).addEventListener('change', (e) => { uploadInto(Array.from(e.target.files)); e.target.value = ''; });
      linkBar.addEventListener('click', (e) => {
        const b = e.target.closest('[data-link]');
        if (!b) return;
        const href = linkInput.value.trim();
        if (b.dataset.link === 'unset') ed.chain().focus().extendMarkRange('link').unsetLink().run();
        else if (!isUrl(href) && !/^mailto:/.test(href)) { toast('Escribí un link que empiece con https://', true); return; }
        else ed.chain().focus().extendMarkRange('link').setLink({ href }).run();
        linkBar.hidden = true;
      });
      linkInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('[data-link="set"]', linkBar).click(); } });
    }

    /* secciones */
    const itemTitle = (it) => it.kind === 'novedad' ? (newsById[it.news_id] || {}).title : (pepBySlug[it.slug] || {}).name;
    const drawItems = () => {
      $('#items', el).innerHTML = items.length ? items.map((it, i) => `
        <div class="item" data-i="${i}">
          <div class="item-head"><span class="tag ${it.kind === 'novedad' ? 'warn' : ''}">${it.kind === 'novedad' ? 'Novedad' : 'Ficha'}</span>
            <b>${esc(itemTitle(it) || 'No disponible (¿se descartó?)')}</b>
            ${sent ? '' : `<span class="item-tools">
              <button class="btn icon ghost sm" type="button" data-mv="-1" aria-label="Subir"${i ? '' : ' disabled'}>${icon('up')}</button>
              <button class="btn icon ghost sm" type="button" data-mv="1" aria-label="Bajar"${i < items.length - 1 ? '' : ' disabled'}>${icon('down')}</button>
              <button class="btn icon ghost sm" type="button" data-rm aria-label="Quitar">${icon('x')}</button></span>`}</div>
          <input type="text" data-k="heading" placeholder="Título para esta edición (opcional)" aria-label="Título para esta edición" value="${esc(it.heading)}"${dis}>
          <textarea data-k="blurb" rows="2" placeholder="Texto propio (si queda vacío, va el resumen)" aria-label="Texto para esta edición"${dis}>${esc(it.blurb)}</textarea>
        </div>`).join('') : '<p class="muted" style="margin:0;font-size:13px">Sin secciones. Sumá novedades aprobadas o fichas.</p>';
    };
    drawItems();
    if (!sent) {
      $('#items', el).addEventListener('click', (e) => {
        const row = e.target.closest('.item'), i = row && +row.dataset.i;
        if (!row) return;
        const mv = e.target.closest('[data-mv]');
        if (mv) { const j = i + +mv.dataset.mv; [items[i], items[j]] = [items[j], items[i]]; }
        else if (e.target.closest('[data-rm]')) items.splice(i, 1);
        else return;
        drawItems(); sync();
      });
      $('#items', el).addEventListener('input', (e) => {
        const input = e.target.closest('[data-k]');
        if (!input) return;
        items[+input.closest('.item').dataset.i][input.dataset.k] = input.value;
        sync();
      });
      $('#addNews', el).addEventListener('change', (e) => {
        if (!e.target.value) return;
        if (items.some((it) => it.news_id === e.target.value)) toast('Esa novedad ya está en la edición.', true);
        else { items.push({ kind: 'novedad', news_id: e.target.value, slug: null, heading: '', blurb: '' }); drawItems(); sync(); }
        e.target.value = '';
      });
      $('#addPep', el).addEventListener('change', (e) => {
        if (!e.target.value) return;
        if (items.some((it) => it.slug === e.target.value)) toast('Esa ficha ya está en la edición.', true);
        else { items.push({ kind: 'peptido', news_id: null, slug: e.target.value, heading: '', blurb: '' }); drawItems(); sync(); }
        e.target.value = '';
      });
    }

    /* vista previa: así se va a ver el mail */
    const preview = () => {
      const subject = field('subject').value.trim(), pre = field('preheader').value.trim();
      const cards = items.map((it) => {
        const n = it.kind === 'novedad' && newsById[it.news_id], p = it.kind === 'peptido' && pepBySlug[it.slug];
        if (!n && !p) return '';
        const title = it.heading || (n ? n.title : p.name);
        const text = it.blurb || (n ? n.summary : clip(p.summary_plain || p.summary || '', 220));
        const href = n ? (n.source_url || SITE) : `${SITE}/#p/${p.slug}`;
        return `<div class="mail-card"><small>${n ? esc(KINDS[n.kind]) : 'Ficha'}</small><h4>${esc(title)}</h4>${text ? `<p>${esc(text)}</p>` : ''}<a href="${esc(href)}" target="_blank" rel="noopener">${n ? 'Ver la fuente' : 'Leer la ficha'} →</a></div>`;
      }).join('');
      $('#mailPreview', el).innerHTML = `
        <div class="mail-inbox"><b>${esc(subject || 'Sin asunto')}</b><span>${esc(pre)}</span></div>
        <div class="mail-sheet">
          <div class="mail-logo"><img src="../brand/logo/peptalk-logo.svg" alt="peptalk" width="96" height="26"></div>
          ${banner ? `<img class="mail-banner" src="${esc(api.mediaUrl(banner))}" alt="${esc(field('banner_alt').value)}">` : ''}
          <div class="mail-body">${ed.isEmpty ? '<p class="muted">El texto de la edición aparece acá.</p>' : ed.getHTML()}</div>
          ${cards ? `<div class="mail-cards">${cards}</div>` : ''}
          <div class="mail-foot">Recibís este mail porque te suscribiste en peptalkarg.com. Información, no consejo médico.<br><u>Darme de baja</u></div>
        </div>`;
    };

    /* guardar */
    const snapshot = () => JSON.stringify({ f: ['title', 'week_of', 'subject', 'preheader', 'banner_alt'].map((k) => field(k).value), banner, body: ed.getJSON(), items, state: $('#issueState', el).value });
    let base = snapshot();
    const isDirty = () => snapshot() !== base;
    function sync() {
      preview();
      if (!sent) $('#issueSave', el).hidden = !isDirty();
    }
    PTA.setDirty(isDirty);
    ['title', 'week_of', 'subject', 'preheader', 'banner_alt'].forEach((k) => field(k).addEventListener('input', sync));
    $('#issueState', el).addEventListener('change', sync);
    preview();

    if (!sent) {
      $('#issueDiscard', el).addEventListener('click', () => { ed.destroy(); PTA.rerender(); });
      $('#issueSaveBtn', el).addEventListener('click', async (e) => {
        const title = field('title').value.trim();
        if (!title || !field('week_of').value) { toast('Completá el título y la semana.', true); return; }
        if ($('#issueState', el).value === 'lista' && !field('subject').value.trim()) { toast('Para marcarla lista falta el asunto.', true); return; }
        e.currentTarget.disabled = true;
        try {
          await api.saveIssue(id, {
            title, week_of: field('week_of').value, subject: field('subject').value.trim(), preheader: field('preheader').value.trim(),
            banner_path: banner, banner_alt: field('banner_alt').value.trim(), body: ed.getJSON(), body_html: ed.getHTML(), state: $('#issueState', el).value
          }, items.map((it) => ({ kind: it.kind, news_id: it.news_id || null, slug: it.slug || null, heading: it.heading.trim() || null, blurb: it.blurb.trim() || null })));
          base = snapshot();
          $('#issueTitle', el).textContent = title;
          sync();
          toast('Guardada.');
        } catch (err) { toast(err.message, true); }
        finally { e.currentTarget.disabled = false; }
      });
    }
  }

  Object.assign(PTA.views, { novedades: viewNews, newsletter: viewIssues, n: viewIssue });
  PTA.sections.n = 'newsletter';
})();
