/* peptalk — backoffice.
   Habla con Supabase: login, tablas protegidas por rol (RLS), archivos privados y la
   función "publish" que regenera el sitio. Sin URL en config.js, o con ?demo, corre en
   modo demo con las fichas actuales en memoria (nada se guarda).

   Vistas (por hash): #catalogo · #p/<slug> · #borradores · #contactos · #dosis · #usuarios · #configuracion.
   Otros módulos (media.js, newsletter.js) suman vistas y funciones de datos con PTA.extend. */
(function () {
  'use strict';

  const cfg = window.PT_ADMIN || {};
  const DEMO = !cfg.supabaseUrl || new URLSearchParams(location.search).has('demo');

  /* ---------- utilidades ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (n) => `<svg class="i" aria-hidden="true"><use href="#i-${n}"/></svg>`;
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const isUrl = (v) => /^https?:\/\/\S+$/.test(v || '');
  const slugify = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const fmtDate = (d) => d ? new Date(d.length === 10 ? d + 'T12:00:00' : d).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
  const fmtWhen = (d) => {
    const m = (Date.now() - new Date(d)) / 60000;
    if (m < 1) return 'recién';
    if (m < 60) return `hace ${Math.round(m)} min`;
    if (m < 1440) return `hace ${Math.round(m / 60)} h`;
    return fmtDate(d);
  };
  // JSON con claves ordenadas: la base reordena las claves de los jsonb, así que comparar texto literal da falsos cambios
  const stable = (v) => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((key) => [key, x[key]])) : x));
  const fmtSize = (b) => b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';

  const AGENCIES = ['ANMAT', 'FDA', 'EMA', 'WADA'];   // el backoffice edita todas; el sitio muestra las de la configuración
  const ROLE_NAME = { admin: 'Admin', editor: 'Editor', medico: 'Médico', agente: 'Agente' };
  const SYS = Object.fromEntries(PT.systems.map((s) => [s.id, s.name]));
  const STATUS_CLS = Object.fromEntries(PT.statuses.map((s) => [s.v, s.cls]));
  const VALUES = PT.statuses.map((s) => s.v);
  const WADA_VALUES = ['Prohibido', 'No listado', 'Pendiente'];
  const TYPES = ['Péptido', 'Análogo peptídico', 'Polipéptido', 'Cosmético'];
  const LEAD_STATES = { nuevo: 'Nuevo', contactado: 'Contactado', derivado: 'Derivado', cerrado: 'Cerrado', baja: 'Baja' };
  const FIELD_NAME = {
    name: 'Nombre', alias: 'Otros nombres', sys: 'Sistema', type: 'Tipo', tags: 'Etiquetas', ev: 'Evidencia', ev_note: 'Nota de evidencia',
    summary: 'Resumen', summary_plain: 'Resumen simple', refs: 'Referencias', checked: 'Revisado el', status: 'Estados', published: 'Publicada',
    usage_process: 'Proceso de uso', dosing: 'Dosis', dosing_reviewed_by: 'Revisión médica', cas_number: 'CAS', molecular_formula: 'Fórmula',
    molecular_weight: 'Peso molecular', sequence: 'Secuencia', preparation_form: 'Presentación', storage: 'Conservación', sort: 'Orden'
  };
  const SPEC_FIELDS = [['cas_number', 'Número CAS'], ['molecular_formula', 'Fórmula molecular'], ['molecular_weight', 'Peso molecular (g/mol)'],
    ['sequence', 'Secuencia'], ['preparation_form', 'Presentación'], ['storage', 'Conservación']];
  const options = (list, cur) => list.map((o) => {
    const [v, label] = Array.isArray(o) ? o : [o, o];
    return `<option value="${esc(v)}"${v === cur ? ' selected' : ''}>${esc(label)}</option>`;
  }).join('');

  let toastTimer = 0;
  const toast = (msg, err) => {
    const t = $('#toast');
    t.textContent = msg;
    t.className = 'toast on' + (err ? ' err' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.className = 'toast'; }, err ? 5000 : 2800);
  };

  /* ---------- acceso a datos: Supabase ---------- */
  const humanError = (e) => ({
    42501: 'No tenés permiso para hacer esto.',
    23514: 'Hay un dato que no cumple las reglas: revisá los estados (todo estado confirmado lleva link a la fuente).',
    23505: 'Ya existe una ficha con ese identificador.'
  }[e.code] || e.message || 'Algo falló. Probá de nuevo.');

  const supabaseApi = () => {
    const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
    const q = async (p) => { const { data, error } = await p; if (error) throw new Error(humanError(error)); return data; };
    let uid = null;
    return {
      async session() {
        const { data } = await sb.auth.getSession();
        uid = data.session ? data.session.user.id : null;
        return uid ? q(sb.from('profiles').select('*').eq('id', uid).single()) : null;
      },
      async signIn(email, password) {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw new Error('Email o contraseña incorrectos.');
        return this.session();
      },
      signOut: () => sb.auth.signOut(),
      async resetPassword(email) {
        const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
        if (error) throw new Error(humanError(error));
      },
      onRecovery: (fn) => sb.auth.onAuthStateChange((ev) => { if (ev === 'PASSWORD_RECOVERY') fn(); }),
      async updatePassword(password) { const { error } = await sb.auth.updateUser({ password }); if (error) throw new Error(humanError(error)); },

      peptides: () => q(sb.from('peptides').select('slug,name,alias,sys,type,ev,status,checked,published,updated_at,tags,summary,summary_plain').order('sort').order('name')),
      peptide: (slug) => q(sb.from('peptides').select('*').eq('slug', slug).single()),
      savePeptide: (slug, patch) => q(sb.from('peptides').update(patch).eq('slug', slug).select().single()),
      createPeptide: (row) => q(sb.from('peptides').insert(row).select().single()),

      notes: (slug) => q(sb.from('peptide_notes').select('*, author:profiles(name,email,role)').eq('slug', slug).order('created_at', { ascending: false })),
      addNote: (slug, body, url) => q(sb.from('peptide_notes').insert({ slug, body, source_url: url || null, author: uid })),
      deleteNote: (id) => q(sb.from('peptide_notes').delete().eq('id', id)),

      docs: (slug) => q(sb.from('documents').select('*').eq('slug', slug).order('created_at', { ascending: false })),
      async uploadDoc(slug, file, title) {
        const path = `${slug}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]+/g, '_')}`;
        await q(sb.storage.from('docs').upload(path, file, { contentType: file.type || 'application/octet-stream' }));
        return q(sb.from('documents').insert({ slug, title: title || file.name, path, mime: file.type, size: file.size, uploaded_by: uid }));
      },
      async docUrl(doc) { return (await q(sb.storage.from('docs').createSignedUrl(doc.path, 300))).signedUrl; },
      async deleteDoc(doc) { await q(sb.storage.from('docs').remove([doc.path])); return q(sb.from('documents').delete().eq('id', doc.id)); },

      history: (slug) => q(sb.from('audit').select('action,actor,at,old,new').eq('tbl', 'peptides').eq('row_key', slug).order('at', { ascending: false }).limit(12)),

      drafts: (state) => q(sb.from('drafts')
        .select('*, author:profiles!drafts_author_fkey(name,email,role), reviewer:profiles!drafts_reviewed_by_fkey(name,email), peptide:peptides(slug,name,alias,sys,type,ev,ev_note,summary,status,refs,checked)')
        .eq('state', state).order('created_at', { ascending: false })),
      async draftCount() { const { count } = await sb.from('drafts').select('id', { count: 'exact', head: true }).eq('state', 'pendiente'); return count || 0; },
      approve: (id, note) => q(sb.rpc('pt_approve_draft', { draft_id: id, note: note || null })),
      reject: (id, note) => q(sb.rpc('pt_reject_draft', { draft_id: id, note: note || null })),

      leads: (kind) => q(sb.from('leads').select('*').eq('kind', kind).order('created_at', { ascending: false })),
      updateLead: (id, patch) => q(sb.from('leads').update(patch).eq('id', id)),

      profiles: () => q(sb.from('profiles').select('*').order('created_at')),
      updateProfile: (id, patch) => q(sb.from('profiles').update(patch).eq('id', id)),

      async publish() {
        const { error } = await sb.functions.invoke('publish');
        if (error) throw new Error('No se pudo publicar. Probá de nuevo en un rato.');
      },

      settings: async () => Object.fromEntries((await q(sb.from('site_settings').select('key,value'))).map((r) => [r.key, r.value])),
      saveSetting: (key, value) => q(sb.from('site_settings').update({ value }).eq('key', key)),
      dosingQueue: () => q(sb.rpc('pt_dosing_queue')),
      reviewDosing: (slug) => q(sb.rpc('pt_review_dosing', { peptide: slug })),

      _sb: sb, _q: q, _uid: () => uid
    };
  };

  /* ---------- acceso a datos: demo en memoria (mismas funciones) ---------- */
  const demoApi = () => {
    const now = () => new Date().toISOString();
    const ago = (h) => new Date(Date.now() - h * 3600000).toISOString();
    const people = [
      { id: 'u-admin', email: 'admin@peptalkarg.com', name: 'Admin de prueba', role: 'admin', active: true, created_at: ago(900) },
      { id: 'u-editor', email: 'editor@peptalkarg.com', name: 'Editor de prueba', role: 'editor', active: true, created_at: ago(800) },
      { id: 'u-grok', email: 'grok@peptalkarg.com', name: 'Grok', role: 'agente', active: true, created_at: ago(700) },
      { id: 'u-med', email: 'medico@peptalkarg.com', name: 'Médico de prueba', role: 'medico', active: true, created_at: ago(600) },
      { id: 'u-new', email: 'nuevo@peptalkarg.com', name: '', role: 'editor', active: false, created_at: ago(2) }
    ];
    let me = people[0];
    const who = (id) => { const p = people.find((x) => x.id === id); return p && { name: p.name, email: p.email, role: p.role }; };
    const pep = (window.PT.peptides || []).map((p, i) => ({
      slug: p.slug, name: p.name, alias: p.alias || '', sys: p.sys, type: p.type, ev: p.ev, ev_note: p.evNote || '', summary: p.summary,
      status: p.status, refs: p.refs || [], checked: p.checked, published: true, sort: i, updated_at: ago(48), tags: [], summary_plain: '',
      usage_process: '', dosing: '', dosing_reviewed_by: null, dosing_reviewed_at: null, cas_number: null, molecular_formula: null,
      molecular_weight: null, sequence: null, preparation_form: null, storage: null
    }));
    const find = (slug) => pep.find((p) => p.slug === slug);
    const notes = [], docs = [], audit = [];
    const settings = {
      agencias_visibles: ['ANMAT', 'FDA'],
      secciones: { resumen_simple: false, imagenes: false, videos: false, especificaciones: false, uso: false, dosis: false },
      tienda: { activa: false, moneda: 'ARS', aviso: '', envio: '', entrega: '', edad_minima: 18 }
    };
    // la demo tiene una dosis cargada para ver el circuito de revisión médica
    Object.assign(find('bpc-157') || {}, { usage_process: 'Ejemplo de demo: texto del proceso de uso.', dosing: 'Ejemplo de demo: texto de dosis a revisar.' });
    const drafts = [
      { id: 'd1', slug: 'bpc-157', kind: 'nota', state: 'pendiente', author: 'u-grok', created_at: ago(3), source_url: 'https://pubmed.ncbi.nlm.nih.gov/',
        reason: 'Ejemplo de demo', payload: { body: 'Ejemplo de demo: así se ve una nota que propone Grok. Al aprobarla queda en la ficha como nota interna, con Grok como autor.' } },
      { id: 'd2', slug: 'semaglutida', kind: 'cambio', state: 'pendiente', author: 'u-grok', created_at: ago(20), source_url: 'https://www.argentina.gob.ar/anmat',
        reason: 'Ejemplo de demo: propone actualizar la fecha de revisión y la nota de ANMAT.',
        payload: { set: { checked: now().slice(0, 10) }, status: { ANMAT: Object.assign({}, (find('semaglutida') || { status: {} }).status.ANMAT, { note: 'Ejemplo de demo: texto propuesto para la nota de ANMAT.' }) } } }
    ];
    const leads = [
      { id: 'l1', kind: 'derivacion', name: 'Persona de prueba', email: 'persona@example.com', phone: '', province: 'Córdoba', peptide: 'Semaglutida', modality: 'Teleconsulta', message: 'Consulta de ejemplo.', state: 'nuevo', doctor: null, internal_note: '', created_at: ago(5) },
      { id: 'l2', kind: 'derivacion', name: 'Otra persona de prueba', email: '', phone: '+54 9 11 0000-0000', province: 'Buenos Aires', peptide: '', modality: 'Presencial', message: '', state: 'derivado', doctor: 'u-med', internal_note: 'Ejemplo', created_at: ago(30) },
      { id: 'l3', kind: 'newsletter', email: 'lectora@example.com', state: 'nuevo', created_at: ago(10) },
      { id: 'l4', kind: 'newsletter', email: 'lector@example.com', state: 'nuevo', created_at: ago(50) }
    ];
    const log = (slug, action, old, nu) => audit.unshift({ slug, action, actor: me.id, at: now(), old: old && clone(old), new: nu && clone(nu) });
    const ok = (v) => new Promise((r) => setTimeout(() => r(clone(v === undefined ? null : v)), 120));
    const fail = (m) => Promise.reject(new Error(m));

    return {
      session: () => ok(null),
      signIn(email) { const p = people.find((x) => x.email === email.toLowerCase()); if (!p) return fail('Email o contraseña incorrectos.'); me = p; return ok(p); },
      signOut: () => ok(),
      resetPassword: () => ok(),
      onRecovery() {},
      updatePassword: () => ok(),

      peptides: () => ok(pep),
      peptide: (slug) => find(slug) ? ok(find(slug)) : fail('No existe esa ficha.'),
      savePeptide(slug, patch) {
        const p = find(slug), old = clone(p);
        Object.assign(p, patch, { updated_at: now() });
        if (p.dosing !== old.dosing) Object.assign(p, { dosing_reviewed_by: null, dosing_reviewed_at: null });
        log(slug, 'update', old, p);
        return ok(p);
      },
      createPeptide(row) {
        if (find(row.slug)) return fail('Ya existe una ficha con ese identificador.');
        const p = Object.assign({ alias: '', ev: '—', ev_note: '', summary: '', refs: [], checked: now().slice(0, 10), sort: 1000, updated_at: now() }, row);
        pep.push(p); log(p.slug, 'insert', null, p); return ok(p);
      },

      notes: (slug) => ok(notes.filter((n) => n.slug === slug).map((n) => Object.assign({}, n, { author: who(n.author_id) }))),
      addNote(slug, body, url) { notes.unshift({ id: 'n' + Date.now(), slug, body, source_url: url || null, author_id: me.id, created_at: now() }); return ok(); },
      deleteNote(id) { notes.splice(notes.findIndex((n) => n.id === id), 1); return ok(); },

      docs: (slug) => ok(docs.filter((d) => d.slug === slug)),
      uploadDoc(slug, file, title) { docs.unshift({ id: 'f' + Date.now(), slug, title: title || file.name, path: URL.createObjectURL(file), mime: file.type, size: file.size, created_at: now() }); return ok(); },
      docUrl: (doc) => ok(doc.path),
      deleteDoc(doc) { docs.splice(docs.findIndex((d) => d.id === doc.id), 1); return ok(); },

      history: (slug) => ok(audit.filter((a) => a.slug === slug).slice(0, 12)),

      drafts: (state) => ok(drafts.filter((d) => d.state === state).map((d) => Object.assign({}, d, { author: who(d.author), reviewer: who(d.reviewed_by), peptide: d.slug && find(d.slug) }))),
      draftCount: () => ok(drafts.filter((d) => d.state === 'pendiente').length),
      approve(id, note) {
        const d = drafts.find((x) => x.id === id);
        if (d.kind === 'nota') notes.unshift({ id: 'n' + Date.now(), slug: d.slug, body: d.payload.body, source_url: d.source_url, author_id: d.author, created_at: now() });
        if (d.kind === 'cambio') { const p = find(d.slug), old = clone(p); Object.assign(p, d.payload.set || {}); p.status = Object.assign({}, p.status, d.payload.status || {}); p.updated_at = now(); log(d.slug, 'update', old, p); }
        Object.assign(d, { state: 'aprobado', review_note: note, reviewed_by: me.id, reviewed_at: now() });
        return ok();
      },
      reject(id, note) { Object.assign(drafts.find((x) => x.id === id), { state: 'descartado', review_note: note, reviewed_by: me.id, reviewed_at: now() }); return ok(); },

      leads: (kind) => ok(leads.filter((l) => l.kind === kind && (me.role !== 'medico' || l.doctor === me.id))),
      updateLead(id, patch) { Object.assign(leads.find((l) => l.id === id), patch); return ok(); },

      profiles: () => ok(people),
      updateProfile(id, patch) {
        if (id === me.id && (patch.role || patch.active === false)) return fail('No podés cambiar tu propio rol.');
        Object.assign(people.find((p) => p.id === id), patch); return ok();
      },

      publish: () => ok(),
      settings: () => ok(settings),
      saveSetting(key, value) { if (me.role !== 'admin') return fail('No tenés permiso para hacer esto.'); settings[key] = value; return ok(); },
      dosingQueue: () => ok(pep.filter((p) => p.dosing).map((p) => ({ slug: p.slug, name: p.name, usage_process: p.usage_process, dosing: p.dosing,
        reviewed_by_me: p.dosing_reviewed_by === me.id, reviewed_at: p.dosing_reviewed_at, updated_at: p.updated_at }))),
      reviewDosing(slug) { Object.assign(find(slug), { dosing_reviewed_by: me.id, dosing_reviewed_at: now() }); return ok(); },
      _demo: { people, pep, find, ok, fail, now, ago, me: () => me }
    };
  };

  const loadScript = (src) => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });

  let api = null, me = null, people = [];
  const can = (...roles) => !!me && roles.includes(me.role);
  const personName = (id) => { const p = people.find((x) => x.id === id); return p ? (p.name || p.email) : 'Sistema'; };
  const authorTag = (a) => !a ? '' : a.role === 'agente'
    ? `<span class="tag bot">${icon('bot')}${esc(a.name || a.email)}</span>`
    : `<span>${esc(a.name || a.email)}</span>`;

  /* ---------- ingreso ---------- */
  function showLogin(msg) {
    $('#app').hidden = true;
    $('#login').hidden = false;
    $('#loginMsg').textContent = msg || '';
  }

  function initLogin() {
    const form = $('#loginForm');
    if (DEMO) $('#demoNote').hidden = false;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = form.email.value.trim(), pw = form.password.value;
      if (!email || !pw) { $('#loginMsg').textContent = 'Completá email y contraseña.'; return; }
      const btn = $('button[type=submit]', form);
      btn.disabled = true;
      try {
        const profile = await api.signIn(email, pw);
        await enter(profile);
      } catch (err) {
        $('#loginMsg').textContent = err.message;
      } finally { btn.disabled = false; }
    });
    $('#forgot').addEventListener('click', async () => {
      const email = form.email.value.trim();
      if (!email) { $('#loginMsg').textContent = 'Escribí tu email y volvé a tocar "Olvidé mi contraseña".'; form.email.focus(); return; }
      try { await api.resetPassword(email); $('#loginMsg').textContent = ''; toast('Si el email está registrado, te llega un link para crear una contraseña nueva.'); }
      catch (err) { $('#loginMsg').textContent = err.message; }
    });
    api.onRecovery(() => {
      showLogin();
      form.innerHTML = `<img src="../brand/logo/peptalk-logo.svg" alt="peptalk" width="132" height="36"><h1>Nueva contraseña</h1>
        <label class="field"><span>Contraseña nueva <em>(mínimo 10 caracteres)</em></span><input name="np" type="password" autocomplete="new-password" minlength="10" required></label>
        <p class="form-msg" id="loginMsg" role="alert"></p><button class="btn primary block" type="button" id="setPw">Guardar y entrar</button>`;
      $('#setPw').addEventListener('click', async () => {
        if (form.np.value.length < 10) { $('#loginMsg').textContent = 'Usá al menos 10 caracteres.'; return; }
        try { await api.updatePassword(form.np.value); location.replace(location.pathname); }
        catch (err) { $('#loginMsg').textContent = err.message; }
      });
    });
  }

  async function enter(profile) {
    if (!profile) return showLogin();
    if (!profile.active) {
      await api.signOut();
      return showLogin('Tu usuario todavía no está activo. Pedile a un admin que lo active.');
    }
    me = profile;
    $('#login').hidden = true;
    $('#app').hidden = false;
    $('#meName').textContent = me.name || me.email;
    $('#meRole').textContent = ROLE_NAME[me.role] + (DEMO ? ' · demo' : '');
    $$('#nav a').forEach((a) => { a.hidden = !a.dataset.roles.split(' ').includes(me.role); });
    people = can('admin', 'editor') ? await api.profiles().catch(() => []) : [me];
    PTA.settings = can('admin', 'editor', 'agente') ? await api.settings().catch(() => ({})) : {};
    refreshCount();
    route();
  }

  async function refreshCount() {
    PTA.hooks.count.forEach((fn) => fn());
    if (!can('admin', 'editor', 'agente')) return;
    const n = await api.draftCount().catch(() => 0);
    const b = $('#draftCount');
    b.hidden = !n;
    b.textContent = n;
  }

  /* ---------- navegación ---------- */
  let dirty = null, current = '';
  const home = () => (me.role === 'medico' ? 'contactos' : 'catalogo');
  const allowed = (view) => { const a = $(`#nav a[data-view="${view}"]`); return !!a && !a.hidden; };

  function route() {
    if (!me) return;
    if (dirty && dirty()) {
      if (location.hash !== current) { history.replaceState(null, '', current); toast('Guardá o descartá los cambios antes de salir.', true); }
      return;
    }
    dirty = null;
    const [name, arg] = (location.hash.slice(1) || home()).split('/');
    const views = Object.assign({ catalogo: viewCatalog, p: viewPeptide, borradores: viewDrafts, contactos: viewLeads, dosis: viewDosing,
      usuarios: viewUsers, configuracion: viewSettings }, PTA.views);
    const section = PTA.sections[name] || (name === 'p' ? 'catalogo' : name);
    const view = views[name];
    if (!view || !allowed(section) || (PTA.sections[name] || name === 'p') && !arg) { location.replace('#' + home()); return; }
    current = location.hash || '#' + home();
    $$('#nav a').forEach((a) => { if (a.dataset.view === section) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    const el = $('#view');
    el.innerHTML = '<div class="empty">Cargando…</div>';
    Promise.resolve(view(el, arg && decodeURIComponent(arg))).catch((err) => { el.innerHTML = `<div class="banner">${esc(err.message)}</div>`; });
  }
  window.addEventListener('hashchange', route);
  window.addEventListener('beforeunload', (e) => { if (dirty && dirty()) { e.preventDefault(); e.returnValue = ''; } });

  async function publish(btn) {
    btn.disabled = true;
    try { await api.publish(); toast(DEMO ? 'En la demo no se publica nada.' : 'Publicando. El sitio se actualiza en 2 o 3 minutos.'); }
    catch (err) { toast(err.message, true); }
    finally { btn.disabled = false; }
  }

  const dotsFor = (status) => `<span class="dots">${AGENCIES.map((a) => {
    const v = (status[a] || {}).v || 'Pendiente';
    return `<span class="dot ${STATUS_CLS[v]}" title="${a}: ${esc(v)}"></span>`;
  }).join('')}</span>`;
  const evBadge = (ev) => `<span class="ev${ev === '—' ? ' none' : ''}" title="Evidencia ${esc(ev)}">${esc(ev)}</span>`;

  // si una sección de la ficha sale o no en el sitio (site_settings.secciones)
  const visTag = (key) => (PTA.settings.secciones || {})[key]
    ? '<span class="tag ok">Visible en el sitio</span>' : '<span class="tag">Oculto en el sitio</span>';

  /* ---------- catálogo ---------- */
  async function viewCatalog(el) {
    const rows = await api.peptides();
    const pendings = (p) => AGENCIES.filter((a) => ((p.status[a] || {}).v || 'Pendiente') === 'Pendiente').length;
    el.innerHTML = `
      <header class="head">
        <div><h1>Catálogo</h1><p>${rows.length} fichas · ${rows.filter((r) => r.published).length} publicadas en el sitio</p></div>
        <div class="actions">${can('admin', 'editor') ? `<button class="btn" type="button" id="newPep">${icon('plus')}Nueva ficha</button><button class="btn accent" type="button" id="publish">${icon('send')}Publicar en el sitio</button>` : ''}</div>
      </header>
      <form class="card" id="newForm" hidden style="margin-bottom:16px">
        <h2>Nueva ficha <small>Arranca sin publicar y con los estados en Pendiente</small></h2>
        <div class="grid2">
          <label class="field"><span>Nombre</span><input type="text" name="name" required></label>
          <label class="field"><span>Identificador <em>(para la URL)</em></span><input type="text" name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*"></label>
          <label class="field"><span>Sistema</span><select name="sys">${options(PT.systems.map((s) => [s.id, s.name]))}</select></label>
          <label class="field"><span>Tipo</span><select name="type">${options(TYPES)}</select></label>
        </div>
        <div class="toolbar" style="margin:14px 0 0;justify-content:flex-end"><button class="btn" type="button" id="cancelNew">Cancelar</button><button class="btn primary" type="submit">Crear y editar</button></div>
      </form>
      <div class="toolbar">
        <input type="search" id="q" placeholder="Buscar por nombre o alias" aria-label="Buscar">
        <select id="fSys" aria-label="Sistema"><option value="">Todos los sistemas</option>${options(PT.systems.map((s) => [s.id, s.name]))}</select>
        <select id="fState" aria-label="Filtro"><option value="">Todas las fichas</option><option value="pend">Con estados pendientes</option><option value="draft">Sin publicar</option></select>
        <span class="meta" id="meta"></span>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>Péptido</th><th>Sistema</th><th>Evid.</th><th>ANMAT · FDA · EMA · WADA</th><th>Revisado</th><th>Sitio</th></tr></thead>
        <tbody id="rows"></tbody>
      </table></div>`;

    const draw = () => {
      const q = slugify($('#q').value), sys = $('#fSys').value, st = $('#fState').value;
      const list = rows.filter((p) => (!q || slugify(p.name + ' ' + p.alias).includes(q)) && (!sys || p.sys === sys)
        && (!st || (st === 'pend' ? pendings(p) > 0 : !p.published)));
      $('#meta').textContent = list.length === rows.length ? '' : `${list.length} de ${rows.length}`;
      $('#rows').innerHTML = list.length ? list.map((p) => `
        <tr class="row-link" data-slug="${esc(p.slug)}">
          <td><a href="#p/${esc(p.slug)}"><b>${esc(p.name)}</b></a><span class="sub">${esc(p.alias)}</span></td>
          <td>${esc(SYS[p.sys])}</td>
          <td>${evBadge(p.ev)}</td>
          <td>${dotsFor(p.status)}${pendings(p) ? ` <span class="tag warn">${pendings(p)} pendiente${pendings(p) > 1 ? 's' : ''}</span>` : ''}</td>
          <td class="num">${fmtDate(p.checked)}</td>
          <td>${p.published ? '<span class="tag ok">Publicada</span>' : '<span class="tag">Sin publicar</span>'}</td>
        </tr>`).join('') : '<tr><td colspan="6" class="empty">No hay fichas con esos filtros.</td></tr>';
    };
    ['#q', '#fSys', '#fState'].forEach((s) => $(s).addEventListener('input', draw));
    $('#rows').addEventListener('click', (e) => { const tr = e.target.closest('tr[data-slug]'); if (tr && !e.target.closest('a')) location.hash = 'p/' + tr.dataset.slug; });
    draw();

    if (!can('admin', 'editor')) return;
    $('#publish').addEventListener('click', (e) => publish(e.currentTarget));
    const nf = $('#newForm'), f = nf.elements;
    $('#newPep').addEventListener('click', () => { nf.hidden = false; f.name.focus(); });
    $('#cancelNew').addEventListener('click', () => { nf.hidden = true; nf.reset(); });
    f.name.addEventListener('input', () => { if (!f.slug.dataset.touched) f.slug.value = slugify(f.name.value); });
    f.slug.addEventListener('input', () => { f.slug.dataset.touched = 1; });
    nf.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!f.name.value.trim() || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(f.slug.value)) { toast('Completá el nombre y un identificador válido (minúsculas y guiones).', true); return; }
      const status = Object.fromEntries(AGENCIES.map((a) => [a, { v: 'Pendiente' }]));
      try {
        const p = await api.createPeptide({ slug: f.slug.value, name: f.name.value.trim(), sys: f.sys.value, type: f.type.value, status, published: false });
        location.hash = 'p/' + p.slug;
      } catch (err) { toast(err.message, true); }
    });
  }

  /* ---------- ficha ---------- */
  async function viewPeptide(el, slug) {
    const [p, notes, docs, hist] = await Promise.all([api.peptide(slug), api.notes(slug), api.docs(slug), api.history(slug)]);
    const edit = can('admin', 'editor');
    const dis = edit ? '' : ' disabled';
    el.innerHTML = `
      <a class="back" href="#catalogo">${icon('back')}Catálogo</a>
      <header class="head">
        <div><h1>${esc(p.name)}</h1><p>${esc(p.slug)} · actualizada ${fmtWhen(p.updated_at)}</p></div>
        <div class="actions"><label class="switch"><input type="checkbox" name="published" form="pepForm"${p.published ? ' checked' : ''}${dis}>Publicada en el sitio</label></div>
      </header>
      ${edit ? '' : '<div class="banner info">Tu rol puede leer el catálogo. Los cambios se proponen como borradores.</div>'}
      <div class="editor">
        <form id="pepForm" novalidate>
          <section class="card"><h2>General</h2><div class="stack">
            <div class="grid2">
              <label class="field"><span>Nombre</span><input type="text" name="name"${dis}></label>
              <label class="field"><span>Otros nombres</span><input type="text" name="alias"${dis}></label>
            </div>
            <div class="grid2">
              <label class="field"><span>Sistema</span><select name="sys"${dis}>${options(PT.systems.map((s) => [s.id, s.name]), p.sys)}</select></label>
              <label class="field"><span>Tipo</span><select name="type"${dis}>${options(TYPES, p.type)}</select></label>
            </div>
            <label class="field"><span>Etiquetas <em>(separadas por coma; por ejemplo: nuevo, destacado)</em></span><input type="text" name="tags"${dis}></label>
          </div></section>
          <section class="card"><h2>Resumen y evidencia</h2><div class="stack">
            <label class="field"><span>Resumen <em>(lo que se lee en la ficha del sitio)</em></span><textarea name="summary" rows="6"${dis}></textarea></label>
            <div class="grid3">
              <label class="field"><span>Nota de evidencia</span><textarea name="ev_note" rows="3"${dis}></textarea></label>
              <label class="field"><span>Nivel</span><select name="ev"${dis}>${options(PT.evidence.map((e) => [e.v, `${e.v} · ${e.name}`]), p.ev)}</select></label>
              <label class="field"><span>Revisado el</span><input type="date" name="checked"${dis}></label>
            </div>
          </div></section>
          <section class="card"><h2>En pocas palabras ${visTag('resumen_simple')}</h2>
            <label class="field"><span>Resumen simple <em>(para cualquier persona, sin tecnicismos)</em></span><textarea name="summary_plain" rows="3"${dis}></textarea></label>
          </section>
          <section class="card"><h2>Estado regulatorio <small>Todo estado confirmado lleva link a la fuente</small></h2><div class="stack" id="agencies">
            ${AGENCIES.map((a) => `
              <div class="agency" data-ag="${a}">
                <div class="agency-head"><span class="dot"></span>${a} <small>${esc(PT.agencyInfo[a].name)}</small>
                  <select data-k="v" aria-label="Estado en ${a}"${dis}>${options(a === 'WADA' ? WADA_VALUES : VALUES, (p.status[a] || {}).v || 'Pendiente')}</select></div>
                <div class="grid2">
                  <label class="field"><span>Fuente</span><input type="text" data-k="source"${dis}></label>
                  <label class="field"><span>Link a la fuente</span><input type="url" data-k="url" placeholder="https://"${dis}></label>
                </div>
                <label class="field"><span>Nota</span><textarea data-k="note" rows="2"${dis}></textarea></label>
              </div>`).join('')}
          </div></section>
          <section class="card"><h2>Referencias <small id="refCount"></small>${edit ? `<button class="btn sm" type="button" id="addRef">${icon('plus')}Agregar</button>` : ''}</h2><div class="stack" id="refs"></div></section>
          <section class="card"><h2>Especificaciones ${visTag('especificaciones')}</h2>
            <div class="grid2">${SPEC_FIELDS.map(([k, label]) => `<label class="field"><span>${label}</span><input type="text" name="${k}"${dis}></label>`).join('')}</div>
          </section>
          <section class="card"><h2>Uso y dosis ${visTag('uso')}</h2>
            <div class="stack">
              <label class="field"><span>Proceso de uso</span><textarea name="usage_process" rows="4"${dis}></textarea></label>
              <label class="field"><span>Dosis de referencia ${visTag('dosis')}</span><textarea name="dosing" rows="3"${dis}></textarea></label>
              <p class="hint" id="dosingState"></p>
            </div>
          </section>
          <div class="savebar" id="savebar" hidden><span>Tenés cambios sin guardar.</span><button class="btn" type="button" id="discard">Descartar</button><button class="btn accent" type="submit">Guardar</button></div>
        </form>
        <aside class="side-col">
          <section class="card" id="mediaCard"></section>
          <section class="card"><h2>Notas <small>internas</small></h2>
            ${edit ? `<form id="noteForm" class="stack" style="margin-bottom:14px">
              <textarea name="body" rows="3" placeholder="Novedad, duda, algo para revisar…" aria-label="Nota nueva"></textarea>
              <input type="url" name="url" placeholder="Link a la fuente (opcional)" aria-label="Link a la fuente">
              <button class="btn sm" type="submit" style="justify-self:end">Agregar nota</button></form>` : ''}
            <div id="notes"></div></section>
          <section class="card"><h2>Documentos</h2>
            ${edit ? `<label class="drop" id="drop">${icon('upload')}<b>Subir archivo</b>PDF, imagen o documento, hasta 25 MB<input type="file" id="file" hidden></label>` : ''}
            <div id="docs" style="margin-top:10px"></div></section>
          <section class="card"><h2>Historial</h2><div class="hist" id="hist"></div></section>
        </aside>
      </div>`;

    const form = $('#pepForm');
    ['name', 'alias', 'summary', 'summary_plain', 'ev_note', 'checked', 'usage_process', 'dosing'].concat(SPEC_FIELDS.map((f) => f[0]))
      .forEach((k) => { form.elements[k].value = p[k] == null ? '' : p[k]; });
    form.elements.tags.value = (p.tags || []).join(', ');
    const drawDosing = () => {
      $('#dosingState').innerHTML = !p.dosing ? 'La dosis se publica sólo si un médico la revisa con su usuario. Si se cambia, la revisión se pierde.'
        : p.dosing_reviewed_by ? `${icon('steth')} Revisada por ${esc(personName(p.dosing_reviewed_by))} · ${fmtDate(p.dosing_reviewed_at)}`
        : `${icon('steth')} Sin revisión médica: no se publica hasta que un médico la revise.`;
    };
    drawDosing();
    if (PTA.mountMedia) PTA.mountMedia($('#mediaCard'), slug, edit);
    $$('.agency', form).forEach((box) => {
      const s = p.status[box.dataset.ag] || {};
      ['source', 'url', 'note'].forEach((k) => { $(`[data-k="${k}"]`, box).value = s[k] || ''; });
    });
    const paintDots = () => $$('.agency', form).forEach((box) => { $('.dot', box).className = 'dot ' + STATUS_CLS[$('[data-k="v"]', box).value]; });
    paintDots();

    const refRow = (r) => `<div class="ref-row">
        <input type="text" data-k="title" placeholder="Título" aria-label="Título" value="${esc(r.title)}"${dis}>
        <input type="text" data-k="source" placeholder="Fuente (PubMed, doi…)" aria-label="Fuente" value="${esc(r.source)}"${dis}>
        <input type="url" data-k="url" placeholder="https://" aria-label="Link" value="${esc(r.url)}"${dis}>
        ${edit ? `<button class="btn icon ghost" type="button" data-del aria-label="Quitar referencia">${icon('x')}</button>` : `<a class="btn icon ghost" href="${esc(r.url)}" target="_blank" rel="noopener" aria-label="Abrir">${icon('send')}</a>`}
      </div>`;
    const drawRefs = (refs) => { $('#refs').innerHTML = refs.map(refRow).join('') || '<p class="muted" style="margin:0">Sin referencias.</p>'; $('#refCount').textContent = refs.length ? `${refs.length}` : ''; };
    drawRefs(p.refs || []);

    const collect = () => ({
      name: form.elements.name.value.trim(), alias: form.elements.alias.value.trim(), sys: form.elements.sys.value, type: form.elements.type.value,
      summary: form.elements.summary.value.trim(), ev_note: form.elements.ev_note.value.trim(), ev: form.elements.ev.value,
      summary_plain: form.elements.summary_plain.value.trim(), usage_process: form.elements.usage_process.value.trim(), dosing: form.elements.dosing.value.trim(),
      tags: [...new Set(form.elements.tags.value.split(',').map((t) => slugify(t)).filter(Boolean))],
      ...Object.fromEntries(SPEC_FIELDS.map(([k]) => {
        const v = form.elements[k].value.trim();
        return [k, !v ? null : k === 'molecular_weight' ? Number(v.replace(',', '.')) : v];
      })),
      checked: form.elements.checked.value || p.checked, published: form.elements.published.checked,
      status: Object.fromEntries($$('.agency', form).map((box) => {
        const s = Object.assign({}, p.status[box.dataset.ag] || {});
        ['v', 'source', 'url', 'note'].forEach((k) => { const v = $(`[data-k="${k}"]`, box).value.trim(); if (v || s[k] !== undefined) s[k] = v; });
        return [box.dataset.ag, s];
      })),
      refs: $$('.ref-row', form).map((row) => ({ title: $('[data-k="title"]', row).value.trim(), source: $('[data-k="source"]', row).value.trim(), url: $('[data-k="url"]', row).value.trim() }))
        .filter((r) => r.title || r.url)
    });
    const validate = () => {
      const errs = [];
      $$('[aria-invalid]', form).forEach((i) => i.removeAttribute('aria-invalid'));
      const bad = (input, msg) => { input.setAttribute('aria-invalid', 'true'); errs.push(msg); };
      if (!form.elements.name.value.trim()) bad(form.elements.name, 'Falta el nombre.');
      const mw = form.elements.molecular_weight.value.trim();
      if (mw && !(Number(mw.replace(',', '.')) > 0)) bad(form.elements.molecular_weight, 'El peso molecular tiene que ser un número.');
      $$('.agency', form).forEach((box) => {
        const url = $('[data-k="url"]', box);
        if ($('[data-k="v"]', box).value !== 'Pendiente' && !isUrl(url.value.trim())) bad(url, `${box.dataset.ag}: un estado confirmado necesita el link a la fuente.`);
      });
      $$('.ref-row', form).forEach((row) => { const u = $('[data-k="url"]', row); if (u.value.trim() && !isUrl(u.value.trim())) bad(u, 'Hay una referencia con un link inválido.'); });
      return errs;
    };

    let base = JSON.stringify(collect());
    const isDirty = () => JSON.stringify(collect()) !== base;
    const sync = () => { $('#savebar').hidden = !isDirty(); paintDots(); };
    dirty = isDirty;
    form.addEventListener('input', sync);
    form.addEventListener('change', sync);
    form.elements.published.addEventListener('change', sync);
    if (edit) {
      $('#addRef').addEventListener('click', () => { if (!$('.ref-row', form)) $('#refs').innerHTML = ''; $('#refs').insertAdjacentHTML('beforeend', refRow({})); $('#refs .ref-row:last-child input').focus(); sync(); });
      $('#refs').addEventListener('click', (e) => { if (e.target.closest('[data-del]')) { e.target.closest('.ref-row').remove(); sync(); } });
      $('#discard').addEventListener('click', () => { dirty = null; route(); });
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const errs = validate();
        if (errs.length) { toast(errs[0], true); $('[aria-invalid]', form).focus(); return; }
        const btn = $('#savebar .accent');
        btn.disabled = true;
        try {
          const saved = await api.savePeptide(slug, collect());
          Object.assign(p, saved);
          drawDosing();
          base = JSON.stringify(collect());
          sync();
          toast(saved.published ? 'Guardado. Tocá "Publicar en el sitio" para que se vea.' : 'Guardado.');
          drawHist(await api.history(slug));
        } catch (err) { toast(err.message, true); }
        finally { btn.disabled = false; }
      });
    }

    // notas
    const drawNotes = (list) => {
      $('#notes').innerHTML = list.length ? list.map((n) => `
        <article class="note" data-id="${esc(n.id)}">
          <p>${esc(n.body)}</p>
          <footer>${authorTag(n.author)}<span>· ${fmtWhen(n.created_at)}</span>${n.source_url ? `<a href="${esc(n.source_url)}" target="_blank" rel="noopener">fuente</a>` : ''}
            ${can('admin') || (edit && n.author && n.author.email === me.email) ? `<button class="btn icon ghost sm" type="button" data-del-note aria-label="Borrar nota">${icon('trash')}</button>` : ''}</footer>
        </article>`).join('') : '<p class="muted" style="margin:0;font-size:13px">Todavía no hay notas.</p>';
    };
    drawNotes(notes);
    $('#notes').addEventListener('click', async (e) => {
      if (!e.target.closest('[data-del-note]')) return;
      try { await api.deleteNote(e.target.closest('.note').dataset.id); drawNotes(await api.notes(slug)); } catch (err) { toast(err.message, true); }
    });
    if (edit) $('#noteForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.currentTarget, body = f.body.value.trim(), url = f.url.value.trim();
      if (!body) { f.body.focus(); return; }
      if (url && !isUrl(url)) { f.url.setAttribute('aria-invalid', 'true'); toast('El link de la fuente no es válido.', true); return; }
      try { await api.addNote(slug, body, url); f.reset(); f.url.removeAttribute('aria-invalid'); drawNotes(await api.notes(slug)); } catch (err) { toast(err.message, true); }
    });

    // documentos
    const drawDocs = (list) => {
      $('#docs').innerHTML = list.length ? list.map((d) => `
        <div class="doc" data-id="${esc(d.id)}">${icon('file')}
          <div><b title="${esc(d.title)}">${esc(d.title)}</b><small>${d.size ? fmtSize(d.size) + ' · ' : ''}${fmtDate(d.created_at)}</small></div>
          <button class="btn icon ghost sm" type="button" data-open aria-label="Abrir">${icon('download')}</button>
          ${edit ? `<button class="btn icon ghost sm" type="button" data-del-doc aria-label="Borrar">${icon('trash')}</button>` : ''}
        </div>`).join('') : '<p class="muted" style="margin:0;font-size:13px">Sin documentos.</p>';
      $('#docs').onclick = async (e) => {
        const row = e.target.closest('.doc'), doc = row && list.find((d) => String(d.id) === row.dataset.id);
        if (!doc) return;
        try {
          if (e.target.closest('[data-open]')) window.open(await api.docUrl(doc), '_blank', 'noopener');
          if (e.target.closest('[data-del-doc]')) { await api.deleteDoc(doc); drawDocs(await api.docs(slug)); }
        } catch (err) { toast(err.message, true); }
      };
    };
    drawDocs(docs);
    if (edit) {
      const upload = async (files) => {
        for (const file of files) {
          if (file.size > 25 * 1048576) { toast(`${file.name} pesa más de 25 MB.`, true); continue; }
          try { toast(`Subiendo ${file.name}…`); await api.uploadDoc(slug, file); } catch (err) { toast(err.message, true); }
        }
        drawDocs(await api.docs(slug));
        toast('Listo.');
      };
      const drop = $('#drop');
      $('#file').addEventListener('change', (e) => { upload(Array.from(e.target.files)); e.target.value = ''; });
      drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
      drop.addEventListener('dragleave', () => drop.classList.remove('over'));
      drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); upload(Array.from(e.dataTransfer.files)); });
    }

    // historial
    const drawHist = (list) => {
      $('#hist').innerHTML = list.length ? list.map((h) => {
        const keys = h.action === 'update' && h.old && h.new
          ? Object.keys(FIELD_NAME).filter((k) => stable(h.old[k]) !== stable(h.new[k])).map((k) => FIELD_NAME[k]) : [];
        const what = h.action === 'insert' ? 'creó la ficha' : h.action === 'delete' ? 'borró la ficha' : keys.length ? 'cambió ' + keys.join(', ').toLowerCase() : 'guardó sin cambios';
        return `<div><b>${esc(personName(h.actor))}</b><span>${esc(what)} · ${fmtWhen(h.at)}</span></div>`;
      }).join('') : '<span class="muted">Sin cambios registrados desde que se cargó.</span>';
    };
    drawHist(hist);
  }

  /* ---------- borradores ---------- */
  async function viewDrafts(el, state = 'pendiente') {
    const list = await api.drafts(state);
    const review = can('admin', 'editor');
    const label = { nota: 'Nota', cambio: 'Cambio en la ficha', nuevo: 'Ficha nueva' };
    const short = (v) => Array.isArray(v) ? `${v.length} referencia${v.length === 1 ? '' : 's'}` : v == null || v === '' ? '—' : /^\d{4}-\d{2}-\d{2}$/.test(v) ? fmtDate(v) : String(v);
    const statusLine = (s) => s ? `${s.v || 'Pendiente'}${s.note ? ' — ' + s.note : ''}` : '—';
    const body = (d) => {
      if (d.kind === 'nota') return `<div class="draft-body">${esc(d.payload.body)}</div>`;
      if (d.kind === 'nuevo') return `<div class="draft-body">${esc(d.payload.name)} · ${esc(SYS[d.payload.sys] || d.payload.sys)} · ${esc(d.payload.type)}\n\n${esc(d.payload.summary || '')}</div>`;
      const p = d.peptide || {}, rows = [];
      Object.entries(d.payload.set || {}).forEach(([k, v]) => rows.push([FIELD_NAME[k] || k, short(p[k]), short(v)]));
      Object.entries(d.payload.status || {}).forEach(([a, s]) => rows.push([a, statusLine((p.status || {})[a]), statusLine(s)]));
      return `<table class="diff"><tbody>${rows.map((r) => `<tr><td>${esc(r[0])}</td><td class="old">${esc(r[1])}</td><td class="new">${esc(r[2])}</td></tr>`).join('')}</tbody></table>`;
    };
    el.innerHTML = `
      <header class="head"><div><h1>Borradores</h1><p>Lo que proponen Grok y el equipo. Nada se aplica hasta que alguien lo aprueba.</p></div></header>
      <div class="toolbar"><div class="tabs" role="tablist">
        ${[['pendiente', 'Pendientes'], ['aprobado', 'Aprobados'], ['descartado', 'Descartados']].map(([v, l]) => `<button type="button" role="tab" data-state="${v}" aria-selected="${v === state}">${l}</button>`).join('')}
      </div></div>
      <div class="drafts">${list.length ? list.map((d) => `
        <article class="draft" data-id="${esc(d.id)}">
          <div class="draft-head">
            <span class="tag ${d.kind === 'nota' ? '' : 'warn'}">${label[d.kind]}</span>
            <h3>${d.peptide ? `<a href="#p/${esc(d.peptide.slug)}">${esc(d.peptide.name)}</a>` : esc(d.payload.name || '')}</h3>
            ${authorTag(d.author)}
            <time datetime="${esc(d.created_at)}">${fmtWhen(d.created_at)}</time>
          </div>
          ${body(d)}
          <div class="draft-meta">${d.reason ? `<span>${esc(d.reason)}</span>` : ''}${d.source_url ? `<a href="${esc(d.source_url)}" target="_blank" rel="noopener">Ver fuente</a>` : '<span>Sin fuente</span>'}</div>
          ${state === 'pendiente' && review ? `<div class="draft-actions">
              <input type="text" placeholder="Comentario (opcional)" aria-label="Comentario">
              <button class="btn" type="button" data-act="reject">Descartar</button>
              <button class="btn accent" type="button" data-act="approve">Aprobar</button></div>`
            : state !== 'pendiente' ? `<div class="draft-meta"><span>${state === 'aprobado' ? 'Aprobado' : 'Descartado'} por ${esc(d.reviewer ? d.reviewer.name || d.reviewer.email : '—')} · ${fmtWhen(d.reviewed_at)}</span>${d.review_note ? `<span>“${esc(d.review_note)}”</span>` : ''}</div>` : ''}
        </article>`).join('') : `<div class="card empty">${state === 'pendiente' ? 'No hay nada para revisar.' : 'Todavía no hay borradores acá.'}</div>`}
      </div>`;
    $$('[data-state]', el).forEach((b) => b.addEventListener('click', () => viewDrafts(el, b.dataset.state)));
    el.querySelector('.drafts').addEventListener('click', async (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const card = b.closest('.draft'), note = $('input', card).value.trim();
      $$('button', card).forEach((x) => { x.disabled = true; });
      try {
        await (b.dataset.act === 'approve' ? api.approve(card.dataset.id, note) : api.reject(card.dataset.id, note));
        toast(b.dataset.act === 'approve' ? 'Aprobado y aplicado a la ficha.' : 'Descartado.');
        refreshCount();
        viewDrafts(el, state);
      } catch (err) { toast(err.message, true); $$('button', card).forEach((x) => { x.disabled = false; }); }
    });
  }

  /* ---------- contactos ---------- */
  async function viewLeads(el, kind = 'derivacion') {
    const list = await api.leads(kind);
    const admin = can('admin');
    const doctors = people.filter((p) => p.role === 'medico' && p.active);
    el.innerHTML = `
      <header class="head"><div><h1>Contactos</h1><p>${admin ? 'Pedidos de derivación y suscriptos al resumen semanal.' : 'Las personas que te derivaron.'}</p></div>
        <div class="actions"><button class="btn" type="button" id="csv">${icon('download')}Exportar CSV</button></div></header>
      <div class="toolbar">
        ${admin ? `<div class="tabs" role="tablist">${[['derivacion', 'Derivaciones'], ['newsletter', 'Newsletter']].map(([v, l]) => `<button type="button" role="tab" data-kind="${v}" aria-selected="${v === kind}">${l}</button>`).join('')}</div>` : ''}
        <select id="fLead" aria-label="Estado"><option value="">Todos los estados</option>${options(Object.entries(LEAD_STATES))}</select>
        <input type="search" id="qLead" placeholder="Buscar" aria-label="Buscar">
        <span class="meta" id="metaLead"></span>
      </div>
      <div class="table-wrap"><table>
        <thead>${kind === 'newsletter'
          ? '<tr><th>Email</th><th>Alta</th><th>Estado</th></tr>'
          : `<tr><th>Recibido</th><th>Persona</th><th>Provincia</th><th>Interés</th><th>Motivo</th><th>Estado</th>${admin ? '<th>Médico</th>' : ''}<th>Nota interna</th></tr>`}</thead>
        <tbody id="leadRows"></tbody>
      </table></div>`;

    let shown = [];
    const draw = () => {
      const st = $('#fLead').value, q = slugify($('#qLead').value);
      shown = list.filter((l) => (!st || l.state === st) && (!q || slugify([l.name, l.email, l.phone, l.province, l.peptide].join(' ')).includes(q)));
      $('#metaLead').textContent = `${shown.length} de ${list.length}`;
      $('#leadRows').innerHTML = shown.length ? shown.map((l) => kind === 'newsletter' ? `
        <tr data-id="${esc(l.id)}"><td>${esc(l.email)}</td><td class="num">${fmtDate(l.created_at)}</td>
          <td><select data-k="state" aria-label="Estado">${options([['nuevo', 'Activa'], ['baja', 'Baja']], l.state)}</select></td></tr>` : `
        <tr data-id="${esc(l.id)}">
          <td class="num">${fmtWhen(l.created_at)}</td>
          <td><b>${esc(l.name)}</b><span class="sub">${esc([l.email, l.phone].filter(Boolean).join(' · '))}</span></td>
          <td>${esc(l.province)}</td>
          <td>${esc(l.peptide || '—')}<span class="sub">${esc(l.modality)}</span></td>
          <td><span class="sub" title="${esc(l.message)}">${esc(l.message || '—')}</span></td>
          <td><select data-k="state" aria-label="Estado">${options(Object.entries(LEAD_STATES), l.state)}</select></td>
          ${admin ? `<td><select data-k="doctor" aria-label="Médico"><option value="">Sin asignar</option>${options(doctors.map((d) => [d.id, d.name || d.email]), l.doctor)}</select></td>` : ''}
          <td><input type="text" data-k="internal_note" aria-label="Nota interna" value="${esc(l.internal_note)}"></td>
        </tr>`).join('') : `<tr><td colspan="8" class="empty">${list.length ? 'No hay contactos con esos filtros.' : 'Todavía no llegó ningún contacto.'}</td></tr>`;
    };
    $('#fLead').addEventListener('input', draw);
    $('#qLead').addEventListener('input', draw);
    $$('[data-kind]', el).forEach((b) => b.addEventListener('click', () => viewLeads(el, b.dataset.kind)));
    $('#leadRows').addEventListener('change', async (e) => {
      const input = e.target.closest('[data-k]');
      if (!input) return;
      const id = input.closest('tr').dataset.id, k = input.dataset.k, v = input.value || null;
      try {
        await api.updateLead(id, { [k]: v });
        Object.assign(list.find((l) => String(l.id) === id), { [k]: v });
        toast('Guardado.');
      } catch (err) { toast(err.message, true); }
    });
    $('#csv').addEventListener('click', () => {
      const cols = kind === 'newsletter' ? ['email', 'created_at', 'state'] : ['created_at', 'name', 'email', 'phone', 'province', 'peptide', 'modality', 'message', 'state', 'internal_note'];
      const cell = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
      const csv = '﻿' + [cols.join(';')].concat(shown.map((l) => cols.map((c) => cell(l[c])).join(';'))).join('\r\n');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      a.download = `peptalk-${kind}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
    draw();
  }

  /* ---------- usuarios ---------- */
  async function viewUsers(el) {
    people = await api.profiles();
    el.innerHTML = `
      <header class="head"><div><h1>Usuarios</h1><p>Quién entra al backoffice y qué puede hacer.</p></div></header>
      <div class="banner info">Para sumar a alguien: Supabase → Authentication → Users → Invite user. Entra desactivado; acá le ponés el rol y lo activás.</div>
      <div class="table-wrap"><table>
        <thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Activo</th><th>Alta</th></tr></thead>
        <tbody id="userRows">${people.map((u) => {
          const self = u.id === me.id, lock = self ? ' disabled' : '';
          return `<tr data-id="${esc(u.id)}">
            <td><input type="text" data-k="name" value="${esc(u.name)}" placeholder="Sin nombre" aria-label="Nombre"></td>
            <td>${esc(u.email)}${self ? ' <span class="tag">vos</span>' : ''}</td>
            <td><select data-k="role" aria-label="Rol"${lock}>${options(Object.entries(ROLE_NAME), u.role)}</select></td>
            <td><label class="switch"><input type="checkbox" data-k="active"${u.active ? ' checked' : ''}${lock} aria-label="Activo"></label></td>
            <td class="num">${fmtDate(u.created_at)}</td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>
      <div class="card" style="margin-top:16px"><h2>Qué puede hacer cada rol</h2>
        <div class="hist">
          <div><b>Admin</b><span>todo: catálogo, borradores, contactos y usuarios.</span></div>
          <div><b>Editor</b><span>edita fichas, sube documentos, aprueba borradores y publica.</span></div>
          <div><b>Médico</b><span>ve y actualiza sólo los contactos que tiene asignados.</span></div>
          <div><b>Agente</b><span>para Grok: lee el catálogo y deja borradores; no publica ni ve contactos.</span></div>
        </div></div>`;
    $('#userRows').addEventListener('change', async (e) => {
      const input = e.target.closest('[data-k]');
      if (!input) return;
      const id = input.closest('tr').dataset.id, k = input.dataset.k, v = input.type === 'checkbox' ? input.checked : input.value;
      try { await api.updateProfile(id, { [k]: v }); Object.assign(people.find((u) => u.id === id), { [k]: v }); toast('Guardado.'); }
      catch (err) { toast(err.message, true); viewUsers(el); }
    });
  }

  /* ---------- revisión médica (sólo médicos) ---------- */
  async function viewDosing(el) {
    const list = await api.dosingQueue();
    el.innerHTML = `
      <header class="head"><div><h1>Revisión médica</h1><p>Dosis cargadas en las fichas. Una dosis sólo se publica si la revisa un médico; si alguien la cambia, vuelve a esta lista.</p></div></header>
      <div class="drafts">${list.length ? list.map((d) => `
        <article class="draft" data-slug="${esc(d.slug)}">
          <div class="draft-head"><h3>${esc(d.name)}</h3>
            ${d.reviewed_at ? `<span class="tag ok">Revisada${d.reviewed_by_me ? ' por vos' : ''} · ${fmtDate(d.reviewed_at)}</span>` : '<span class="tag warn">Sin revisar</span>'}
            <time>${fmtWhen(d.updated_at)}</time></div>
          ${d.usage_process ? `<div><small class="muted">Proceso de uso</small><div class="draft-body">${esc(d.usage_process)}</div></div>` : ''}
          <div><small class="muted">Dosis</small><div class="draft-body">${esc(d.dosing)}</div></div>
          ${d.reviewed_at ? '' : '<div class="draft-actions"><span class="muted" style="flex:1;font-size:12px">Al marcarla, queda tu nombre y la fecha como revisión.</span><button class="btn accent" type="button" data-review>Marcar como revisada</button></div>'}
        </article>`).join('') : '<div class="card empty">No hay dosis para revisar.</div>'}</div>`;
    el.querySelector('.drafts').addEventListener('click', async (e) => {
      const b = e.target.closest('[data-review]');
      if (!b) return;
      b.disabled = true;
      try { await api.reviewDosing(b.closest('[data-slug]').dataset.slug); toast('Dosis marcada como revisada.'); viewDosing(el); }
      catch (err) { toast(err.message, true); b.disabled = false; }
    });
  }

  /* ---------- configuración del sitio (sólo admin) ---------- */
  const SECTIONS = [
    ['resumen_simple', 'Resumen simple', '"En pocas palabras" en la ficha.'],
    ['imagenes', 'Imágenes', 'Portada y galería de cada ficha.'],
    ['videos', 'Videos', 'Videos enlazados (YouTube, Vimeo).'],
    ['especificaciones', 'Especificaciones', 'CAS, fórmula, peso molecular, secuencia, presentación y conservación.'],
    ['uso', 'Proceso de uso', 'Cómo es el uso, explicado.'],
    ['dosis', 'Dosis', 'Sólo las que revisó un médico. Conviene consultarlo con un abogado antes de activarla.']
  ];
  async function viewSettings(el) {
    const st = PTA.settings = await api.settings();
    const sec = Object.assign({}, st.secciones), shop = Object.assign({}, st.tienda);
    el.innerHTML = `
      <header class="head"><div><h1>Configuración</h1><p>Qué muestra el sitio. Los cambios se ven después de tocar "Publicar en el sitio".</p></div></header>
      <section class="card"><h2>Agencias en las fichas</h2>
        <p class="hint" style="margin-top:-6px">Las fichas guardan las cuatro; acá elegís cuáles se muestran.</p>
        <div class="checks" id="ags">${AGENCIES.map((a) => `<label class="switch"><input type="checkbox" value="${a}"${(st.agencias_visibles || []).includes(a) ? ' checked' : ''}>${a} <small class="muted">${esc(PT.agencyInfo[a].name)}</small></label>`).join('')}</div>
      </section>
      <section class="card"><h2>Secciones de la ficha</h2>
        <div class="setting-list" id="secs">${SECTIONS.map(([k, label, desc]) => `
          <label class="setting"><span><b>${label}</b><small>${desc}</small></span><span class="switch"><input type="checkbox" data-k="${k}"${sec[k] ? ' checked' : ''}></span></label>`).join('')}</div>
      </section>
      <section class="card"><h2>Tienda <span class="tag">Apagada</span></h2>
        <p class="hint" style="margin-top:-6px">Los productos, precios y certificados se pueden cargar, pero no se muestran. Se activa cuando haya autorización para vender en Argentina.</p>
        <div class="grid2">
          <label class="field"><span>Moneda</span><select name="moneda">${options([['ARS', 'Pesos (ARS)'], ['USD', 'Dólares (USD)']], shop.moneda)}</select></label>
          <label class="field"><span>Edad mínima para comprar</span><input type="text" name="edad_minima" value="${esc(shop.edad_minima)}"></label>
          <label class="field"><span>Envío</span><textarea name="envio" rows="2">${esc(shop.envio)}</textarea></label>
          <label class="field"><span>Plazo de entrega</span><textarea name="entrega" rows="2">${esc(shop.entrega)}</textarea></label>
        </div>
        <label class="field" style="margin-top:12px"><span>Aviso legal del producto</span><textarea name="aviso" rows="2">${esc(shop.aviso)}</textarea></label>
      </section>
      <div class="toolbar" style="justify-content:flex-end;margin-top:16px"><button class="btn primary" type="button" id="saveSettings">Guardar configuración</button></div>`;
    $('#saveSettings').addEventListener('click', async (e) => {
      const ags = $$('#ags input:checked').map((i) => i.value);
      if (!ags.length) { toast('Elegí al menos una agencia.', true); return; }
      $$('#secs input').forEach((i) => { sec[i.dataset.k] = i.checked; });
      ['moneda', 'envio', 'entrega', 'aviso'].forEach((k) => { shop[k] = $(`[name="${k}"]`, el).value.trim(); });
      shop.edad_minima = parseInt($('[name="edad_minima"]', el).value, 10) || 18;
      e.currentTarget.disabled = true;
      try {
        await api.saveSetting('agencias_visibles', ags);
        await api.saveSetting('secciones', sec);
        await api.saveSetting('tienda', shop);
        PTA.settings = await api.settings();
        toast('Guardado. Tocá "Publicar en el sitio" para aplicarlo.');
      } catch (err) { toast(err.message, true); }
      finally { e.currentTarget.disabled = false; }
    });
  }

  /* ---------- módulos: media.js y newsletter.js se enganchan acá ---------- */
  const extensions = [];
  window.PTA = {
    DEMO, AGENCIES, SYS, $, $$, esc, icon, clone, isUrl, slugify, fmtDate, fmtWhen, fmtSize, options, toast, can, authorTag, personName,
    settings: {}, views: {}, sections: {}, hooks: { count: [] },
    get api() { return api; },
    get me() { return me; },
    setDirty: (fn) => { dirty = fn; },
    rerender: () => { dirty = null; route(); },
    // cada módulo agrega funciones de datos para Supabase y para la demo
    extend: (ext) => extensions.push(ext)
  };

  /* ---------- arranque ---------- */
  $('#logout').addEventListener('click', async () => {
    if (dirty && dirty()) { toast('Guardá o descartá los cambios antes de salir.', true); return; }
    await api.signOut();
    me = null;
    dirty = null;
    history.replaceState(null, '', location.pathname + location.search);
    $('#loginForm').reset();
    showLogin();
  });

  // espera a que carguen los módulos (están después de este script)
  document.addEventListener('DOMContentLoaded', async () => {
    if (DEMO) await loadScript('../peptides.js');
    api = DEMO ? demoApi() : supabaseApi();
    extensions.forEach((ext) => Object.assign(api, DEMO ? ext.demo(api._demo) : ext.real({ sb: api._sb, q: api._q, uid: api._uid, cfg })));
    initLogin();
    try { await enter(await api.session()); }
    catch (err) { showLogin(err.message); }
  });
})();
