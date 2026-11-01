/* peptalk — lógica de la landing.
   Módulos: util · catalog · nav · search · systems · library · legend · drawer · forms · reveal.
   Sin dependencias. El contenido sale de data.js (window.PT). */
(function () {
  'use strict';

  /* ---------- util ---------- */
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var norm = function (s) { return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); };
  var icon = function (d) { return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + d + '"/></svg>'; };
  var plural = function (n, one, many) { return n + ' ' + (n === 1 ? one : many); };

  /* ---------- catalog: datos derivados ---------- */
  var PT = window.PT;
  var sysById = {};
  PT.systems.forEach(function (s) { sysById[s.id] = s; });
  var statusCls = {};
  PT.statuses.forEach(function (s) { statusCls[s.v] = s.cls; });

  var peptides = PT.peptides.map(function (p) {
    var st = p.status || {};
    var sys = sysById[p.sys];
    return Object.assign({}, p, {
      sysName: sys ? sys.name : '',
      sysIcon: sys ? sys.icon : '',
      ev: p.ev || '—',
      st: { ANMAT: st.ANMAT || 'Pendiente', FDA: st.FDA || 'Pendiente', EMA: st.EMA || 'Pendiente', WADA: st.WADA || 'Pendiente' },
      haystack: norm(p.name + ' ' + p.alias + ' ' + p.slug)
    });
  });
  var bySlug = {};
  peptides.forEach(function (p) { bySlug[p.slug] = p; });
  PT.systems.forEach(function (s) { s.count = peptides.filter(function (p) { return p.sys === s.id; }).length; });

  var matches = function (p, q) { q = norm(q.trim()); return q.length < 2 || p.haystack.indexOf(q) !== -1; };
  var evBadge = function (ev) { return '<span class="ev ' + (ev === '—' ? 'ev-none' : 'ev-' + ev) + '">Evidencia ' + ev + '</span>'; };
  var stBadge = function (v) { return '<i class="dot ' + statusCls[v] + '"></i>' + esc(v); };
  var agencyGrid = function (p) {
    return '<div class="agencies">' + PT.agencies.map(function (a) {
      return '<div><small>' + a + '</small><b>' + stBadge(p.st[a]) + '</b></div>';
    }).join('') + '</div>';
  };

  /* ---------- nav ---------- */
  (function nav() {
    var bar = $('#nav'), burger = $('#burger'), links = $('#navLinks');
    var setOpen = function (open) { links.classList.toggle('open', open); burger.setAttribute('aria-expanded', open); };
    burger.addEventListener('click', function () { setOpen(!links.classList.contains('open')); });
    links.addEventListener('click', function (e) { if (e.target.tagName === 'A') setOpen(false); });
    window.addEventListener('scroll', function () { bar.classList.toggle('scrolled', window.scrollY > 8); }, { passive: true });

    // resalta la sección visible
    var anchors = $$('a', links);
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        anchors.forEach(function (a) { a.classList.toggle('active', a.getAttribute('href') === '#' + en.target.id); });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    anchors.forEach(function (a) { var t = $(a.getAttribute('href')); if (t) io.observe(t); });
  })();

  /* ---------- search (combobox del hero) ---------- */
  (function search() {
    var input = $('#q'), list = $('#sugg'), go = $('#qGo');
    var items = [], active = -1;

    var close = function () { list.hidden = true; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); active = -1; };
    var render = function () {
      var q = input.value.trim();
      if (q.length < 2) { close(); return; }
      items = peptides.filter(function (p) { return matches(p, q); }).slice(0, 6);
      list.innerHTML = items.length
        ? items.map(function (p, i) {
            return '<li role="option" id="sg' + i + '" data-slug="' + p.slug + '" aria-selected="' + (i === active) + '"><div><b>' + esc(p.name) + '</b><br><small>' + esc(p.alias) + '</small></div><span class="sugg-sys">' + esc(p.sysName) + '</span></li>';
          }).join('') + '<li role="option" id="sgAll" data-all="1"><small>Ver todos los resultados para «' + esc(q) + '» →</small></li>'
        : '<li class="sugg-empty">No encontramos «' + esc(q) + '». Probá con otro nombre o alias.</li>';
      list.hidden = false;
      input.setAttribute('aria-expanded', 'true');
    };
    var toLibrary = function () { close(); Library.setQuery(input.value); $('#biblioteca').scrollIntoView(); };
    var pick = function (li) {
      if (!li) return toLibrary();
      if (li.dataset.slug) { close(); Drawer.open(li.dataset.slug); }
      else if (li.dataset.all) toLibrary();
    };

    input.addEventListener('input', function () { active = -1; render(); });
    input.addEventListener('focus', render);
    input.addEventListener('keydown', function (e) {
      var opts = $$('li[role=option]', list);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (list.hidden || !opts.length) return;
        e.preventDefault();
        active = (active + (e.key === 'ArrowDown' ? 1 : -1) + opts.length) % opts.length;
        opts.forEach(function (o, i) { o.setAttribute('aria-selected', i === active); });
        input.setAttribute('aria-activedescendant', opts[active].id);
      } else if (e.key === 'Enter') {
        e.preventDefault(); pick(opts[active]);
      } else if (e.key === 'Escape') close();
    });
    list.addEventListener('mousedown', function (e) { var li = e.target.closest('li[role=option]'); if (li) { e.preventDefault(); pick(li); } });
    input.addEventListener('blur', function () { setTimeout(close, 120); });
    go.addEventListener('click', toLibrary);
    $$('.freq [data-q]').forEach(function (b) { b.addEventListener('click', function () { input.value = b.dataset.q; input.focus(); render(); }); });

    // atajo «/» para buscar
    document.addEventListener('keydown', function (e) {
      if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); input.focus(); }
    });
  })();

  /* ---------- systems (mapa del cuerpo) ---------- */
  (function systems() {
    var listEl = $('#sysList'), hotEl = $('#hotspots'), card = $('#sysCard');
    var current = 'digestivo';
    var svgNS = 'http://www.w3.org/2000/svg';

    listEl.innerHTML = PT.systems.map(function (s) {
      return '<li role="presentation"><button role="tab" data-sys="' + s.id + '"><span class="sys-ic">' + icon(s.icon) + '</span>' + esc(s.name) + '<span class="n">' + s.count + '</span></button></li>';
    }).join('');

    PT.systems.forEach(function (s) {
      var g = document.createElementNS(svgNS, 'g');
      g.setAttribute('class', 'hot'); g.setAttribute('data-sys', s.id);
      g.setAttribute('tabindex', '0'); g.setAttribute('role', 'button'); g.setAttribute('aria-label', s.name);
      g.innerHTML = '<circle class="pulse" cx="' + s.x + '" cy="' + s.y + '" r="9"/><circle class="ring" cx="' + s.x + '" cy="' + s.y + '" r="11"/><circle class="core" cx="' + s.x + '" cy="' + s.y + '" r="4"/>';
      hotEl.appendChild(g);
    });

    var select = function (id) {
      current = id;
      var s = sysById[id];
      $$('button', listEl).forEach(function (b) { b.setAttribute('aria-selected', b.dataset.sys === id); });
      $$('.hot', hotEl).forEach(function (h) { h.classList.toggle('on', h.dataset.sys === id); });
      var some = peptides.filter(function (p) { return p.sys === id; }).slice(0, 6);
      card.innerHTML =
        '<div class="top"><span class="sys-ic">' + icon(s.icon) + '</span><div><h3>' + esc(s.name) + '</h3><div class="cnt">' + plural(s.count, 'péptido', 'péptidos') + ' en la biblioteca</div></div></div>' +
        '<p>' + esc(s.desc) + '</p>' +
        '<div class="lbl">Algunos de este sistema</div>' +
        '<div class="pep-pills">' + some.map(function (p) { return '<button data-slug="' + p.slug + '">' + esc(p.name) + '</button>'; }).join('') + '</div>' +
        '<button class="btn btn-orange" data-go="' + id + '">Ver péptidos de ' + esc(s.name) + '</button>';
    };

    listEl.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) select(b.dataset.sys); });
    hotEl.addEventListener('click', function (e) { var g = e.target.closest('.hot'); if (g) select(g.dataset.sys); });
    hotEl.addEventListener('keydown', function (e) { var g = e.target.closest('.hot'); if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); select(g.dataset.sys); } });
    card.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.dataset.slug) Drawer.open(b.dataset.slug);
      if (b.dataset.go) { Library.setSystem(b.dataset.go); $('#biblioteca').scrollIntoView(); }
    });
    select(current);
  })();

  /* ---------- library (filtros + resultados) ---------- */
  var Library = (function library() {
    var state = { q: '', sys: 'all', anmat: 'all', fda: 'all', wada: 'all', evid: 'all', view: 'cards' };
    var qEl = $('#libQ'), chipsEl = $('#sysChips'), results = $('#results'), empty = $('#empty'), countEl = $('#count'), clearBtn = $('#clearAll');

    $('#libMeta').textContent = plural(peptides.length, 'péptido', 'péptidos') + ' · ' + PT.systems.length + ' sistemas · Estados en verificación';

    var statusOpts = '<option value="all">todos</option>' + PT.statuses.map(function (s) { return '<option>' + s.v + '</option>'; }).join('');
    $$('.filters select').forEach(function (sel) {
      sel.innerHTML = sel.dataset.f === 'evid'
        ? '<option value="all">todas</option>' + PT.evidence.map(function (e) { return '<option value="' + e.v + '">' + (e.v === '—' ? 'Pendiente' : e.v + ' · ' + e.name) + '</option>'; }).join('')
        : statusOpts;
      sel.addEventListener('change', function () { state[sel.dataset.f] = sel.value; render(); });
    });

    var renderChips = function () {
      var all = [{ id: 'all', name: 'Todos', count: peptides.length }].concat(PT.systems);
      chipsEl.innerHTML = all.map(function (s) {
        return '<button class="chip" data-sys="' + s.id + '" aria-pressed="' + (state.sys === s.id) + '">' + esc(s.name) + '<span class="n">' + s.count + '</span></button>';
      }).join('');
    };
    chipsEl.addEventListener('click', function (e) { var b = e.target.closest('.chip'); if (b) { state.sys = b.dataset.sys; render(); } });
    qEl.addEventListener('input', function () { state.q = qEl.value; render(); });
    $$('.seg button').forEach(function (b) {
      b.addEventListener('click', function () {
        state.view = b.dataset.view;
        $$('.seg button').forEach(function (x) { var on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on); });
        render();
      });
    });

    var filtered = function () {
      return peptides.filter(function (p) {
        return (state.sys === 'all' || p.sys === state.sys) &&
          (state.anmat === 'all' || p.st.ANMAT === state.anmat) &&
          (state.fda === 'all' || p.st.FDA === state.fda) &&
          (state.wada === 'all' || p.st.WADA === state.wada) &&
          (state.evid === 'all' || p.ev === state.evid) &&
          matches(p, state.q);
      });
    };

    var cardHtml = function (p, i) {
      return '<button class="card" data-slug="' + p.slug + '" style="animation-delay:' + Math.min(i * 25, 300) + 'ms">' +
        '<div class="card-top"><span class="s">' + icon(p.sysIcon) + esc(p.sysName) + '</span>' + evBadge(p.ev) + '</div>' +
        '<h3>' + esc(p.name) + '</h3><div class="alias">' + esc(p.alias) + '</div>' +
        '<div class="type">' + esc(p.type) + '</div>' + agencyGrid(p) +
        '<div class="card-f"><span>Sin verificar</span><span class="link">Ver ficha →</span></div></button>';
    };
    var tableHtml = function (list) {
      return '<div class="table-wrap"><table><thead><tr><th>Péptido</th><th>Sistema</th>' + PT.agencies.map(function (a) { return '<th>' + a + '</th>'; }).join('') + '<th>Evidencia</th></tr></thead><tbody>' +
        list.map(function (p) {
          return '<tr data-slug="' + p.slug + '" tabindex="0"><td><b>' + esc(p.name) + '</b><small>' + esc(p.alias) + '</small></td><td>' + esc(p.sysName) + '</td>' +
            PT.agencies.map(function (a) { return '<td><span class="st">' + stBadge(p.st[a]) + '</span></td>'; }).join('') + '<td>' + evBadge(p.ev) + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    };

    var render = function () {
      renderChips();
      var list = filtered();
      var dirty = state.q || ['sys', 'anmat', 'fda', 'wada', 'evid'].some(function (k) { return state[k] !== 'all'; });
      clearBtn.hidden = !dirty;
      countEl.textContent = 'Mostrando ' + plural(list.length, 'péptido', 'péptidos');
      empty.hidden = list.length > 0;
      results.innerHTML = !list.length ? '' : state.view === 'cards' ? '<div class="cards">' + list.map(cardHtml).join('') + '</div>' : tableHtml(list);
    };

    var clear = function () {
      Object.assign(state, { q: '', sys: 'all', anmat: 'all', fda: 'all', wada: 'all', evid: 'all' });
      qEl.value = ''; $$('.filters select').forEach(function (s) { s.value = 'all'; });
      render();
    };
    clearBtn.addEventListener('click', clear);
    $('#clearEmpty').addEventListener('click', clear);
    results.addEventListener('click', function (e) { var el = e.target.closest('[data-slug]'); if (el) Drawer.open(el.dataset.slug); });
    results.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.dataset.slug) Drawer.open(e.target.dataset.slug); });

    render();
    return {
      setQuery: function (q) { state.q = q; qEl.value = q; render(); },
      setSystem: function (id) { state.sys = id; render(); }
    };
  })();

  /* ---------- legend ---------- */
  $('#legendStates').innerHTML = PT.statuses.map(function (s) { return '<li><i class="dot ' + s.cls + '"></i><b>' + s.v + '</b><small>' + s.desc + '</small></li>'; }).join('');
  $('#legendEv').innerHTML = PT.evidence.map(function (e) { return '<li><span class="ev ' + (e.v === '—' ? 'ev-none' : 'ev-' + e.v) + '">' + e.v + '</span><span>' + e.name + '</span></li>'; }).join('');

  /* ---------- drawer (ficha, enlazable por #p/slug) ---------- */
  var Drawer = (function drawer() {
    var el = $('#drawer'), body = $('#drawerBody'), scrim = $('#scrim'), lastFocus = null, pushed = false;
    // si la ficha se abrió desde la página volvemos atrás; si se entró por link, limpiamos el hash
    var close = function () { if (pushed) history.back(); else { history.replaceState(null, '', location.pathname); hide(); } };

    var show = function (slug) {
      var p = bySlug[slug]; if (!p) return;
      lastFocus = document.activeElement;
      body.innerHTML =
        '<div class="crumbs">Inicio › Péptidos › ' + esc(p.sysName) + '</div>' +
        '<h2 id="dTitle">' + esc(p.name) + '</h2><div class="alias">' + esc(p.alias) + '</div>' +
        '<div class="badges"><span class="tag">' + esc(p.sysName) + '</span>' + evBadge(p.ev) + '<span class="pill">Pendiente de revisión médica</span></div>' +
        agencyGrid(p) +
        '<div class="meta">Publicado: — · Actualizado: — · Estados verificados: —</div>' +
        '<div class="d-block"><h3>Resumen clave</h3><p>Ficha en preparación. peptalk lab está reuniendo las fuentes primarias para explicar qué es ' + esc(p.name) + ' y qué se sabe hasta hoy.</p></div>' +
        '<div class="d-block"><h3>De un vistazo</h3><div class="d-rows">' +
          '<div><span>Tipo</span><b>' + esc(p.type) + '</b></div>' +
          '<div><span>Sistema</span><b>' + esc(p.sysName) + '</b></div>' +
          PT.agencies.map(function (a) { return '<div><span>' + a + '</span><b class="st">' + stBadge(p.st[a]) + '</b></div>'; }).join('') +
        '</div></div>' +
        '<div class="d-cta"><b>Consultá con un especialista</b><p>Te ponemos en contacto con un médico matriculado en Argentina, por teleconsulta o presencial.</p><a class="btn btn-orange" href="#derivacion" data-ref="' + esc(p.name) + '">Pedir una derivación</a></div>' +
        '<p class="d-foot">Información, no indicación. No indicamos dosis, usos ni dónde conseguir productos.</p>';
      el.hidden = false; scrim.hidden = false;
      document.body.style.overflow = 'hidden';
      $('#drawerX').focus();
    };
    var hide = function () {
      if (el.hidden) return;
      el.hidden = true; scrim.hidden = true;
      document.body.style.overflow = '';
      if (lastFocus) lastFocus.focus();
    };
    var fromHash = function () {
      var m = location.hash.match(/^#p\/([\w-]+)$/);
      if (m) show(m[1]); else { pushed = false; hide(); }
    };

    $('#drawerX').addEventListener('click', close);
    scrim.addEventListener('click', close);
    document.addEventListener('keydown', function (e) {
      if (el.hidden) return;
      if (e.key === 'Escape') close();
      if (e.key === 'Tab') { // foco atrapado en la ficha
        var f = $$('a,button,input,select,textarea,[tabindex]', el);
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    });
    body.addEventListener('click', function (e) {
      var a = e.target.closest('[data-ref]'); if (!a) return;
      e.preventDefault();
      $('#fPep').value = a.dataset.ref;
      pushed = false; hide(); history.replaceState(null, '', '#derivacion');
      $('#derivacion').scrollIntoView();
    });
    window.addEventListener('hashchange', fromHash);
    fromHash();

    return { open: function (slug) { pushed = true; location.hash = 'p/' + slug; } };
  })();

  /* ---------- forms ---------- */
  var send = function (url, data) {
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(data) })
      .then(function (r) { if (!r.ok) throw new Error(r.status); });
  };

  (function newsletter() {
    var form = $('#newsForm'), input = $('#nEmail'), msg = $('#newsMsg');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value.trim());
      input.setAttribute('aria-invalid', !ok);
      if (!ok) { msg.textContent = 'Revisá el email.'; input.focus(); return; }
      if (!PT.endpoints.newsletter) { msg.textContent = 'Todavía no abrimos las suscripciones. Volvé pronto.'; return; }
      msg.textContent = 'Enviando…';
      send(PT.endpoints.newsletter, { email: input.value.trim() })
        .then(function () { form.reset(); msg.textContent = 'Listo, te vamos a mandar el próximo resumen.'; })
        .catch(function () { msg.textContent = 'No pudimos suscribirte. Probá de nuevo en un rato.'; });
    });
  })();

  (function referral() {
    var form = $('#refForm'), summary = $('#errSummary'), msg = $('#refMsg'), motivo = $('#fMotivo');
    $('#fProv').insertAdjacentHTML('beforeend', PT.provinces.map(function (p) { return '<option>' + p + '</option>'; }).join(''));
    $('#pepList').innerHTML = peptides.map(function (p) { return '<option value="' + esc(p.name) + '">'; }).join('');
    motivo.addEventListener('input', function () { $('#motivoLen').textContent = motivo.value.length + '/300'; });

    var validate = function (f) {
      var err = {};
      if (!f.name.value.trim()) err.name = 'Escribí tu nombre.';
      var email = f.email.value.trim(), phone = f.phone.value.trim();
      if (!email && !phone) err.contact = 'Dejanos un email o un teléfono.';
      else if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) err.contact = 'Revisá el email.';
      else if (phone && phone.replace(/\D/g, '').length < 8) err.contact = 'Revisá el teléfono.';
      if (!f.prov.value) err.prov = 'Elegí tu provincia.';
      if (!f.adult.checked) err.adult = 'Tenés que ser mayor de 18 años.';
      if (!f.c1.checked) err.c1 = 'Necesitamos tu consentimiento para tratar los datos.';
      if (!f.c2.checked) err.c2 = 'Necesitamos tu consentimiento para pasarle los datos al médico.';
      return err;
    };

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var f = form.elements, err = validate(f), keys = Object.keys(err);
      $$('.err', form).forEach(function (s) { s.textContent = err[s.dataset.for] || ''; });
      ['name', 'prov', 'adult', 'c1', 'c2'].forEach(function (k) { f[k].setAttribute('aria-invalid', !!err[k]); });
      f.email.setAttribute('aria-invalid', !!err.contact); f.phone.setAttribute('aria-invalid', !!err.contact);
      if (keys.length) {
        summary.hidden = false;
        summary.innerHTML = '<b>Revisá estos datos:</b> ' + keys.map(function (k) { return err[k]; }).join(' ');
        summary.focus();
        return;
      }
      summary.hidden = true;
      if (!PT.endpoints.referral) { msg.textContent = 'Las derivaciones abren pronto. Todavía no estamos recibiendo pedidos online.'; return; }
      var btn = $('#refSubmit'); btn.disabled = true; btn.textContent = 'Enviando…';
      send(PT.endpoints.referral, {
        name: f.name.value.trim(), email: f.email.value.trim(), phone: f.phone.value.trim(), prov: f.prov.value,
        pep: f.pep.value.trim(), mod: f.mod.value, motivo: motivo.value.trim()
      }).then(function () {
        form.reset(); $('#motivoLen').textContent = '0/300';
        msg.textContent = 'Listo, recibimos tu pedido. Te vamos a confirmar por email.';
      }).catch(function () {
        msg.textContent = 'No pudimos enviar el pedido. Probá de nuevo en un rato.';
      }).then(function () { btn.disabled = false; btn.textContent = 'Enviar pedido'; });
    });
  })();

  /* ---------- reveal ---------- */
  (function reveal() {
    if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var els = $$('.trust > div, .dark-panel, .legend-card, .states-copy, .news > *, .referral, .guide, .method li, .disclaimer');
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    els.forEach(function (el) { el.classList.add('reveal'); io.observe(el); });
  })();
})();
