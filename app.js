/* peptalk — lógica de la landing.
   Módulos: util · catalog · ui (íconos, estados, evidencia) · select · nav · search · spot ·
   systems · library · legend · drawer · forms · reveal.
   Sin dependencias. El contenido sale de data.js (window.PT); el cuerpo 3D, de body3d.js?v=c84e667e + Three.js r149. */
(function () {
  'use strict';

  /* ---------- util ---------- */
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var norm = function (s) { return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); };
  var plural = function (n, one, many) { return n + ' ' + (n === 1 ? one : many); };
  var reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var loadScript = function (src) {
    return new Promise(function (ok, fail) {
      if ($('script[src="' + src + '"]')) return ok();
      var s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = fail;
      document.head.appendChild(s);
    });
  };

  /* ---------- catalog: datos derivados ---------- */
  var PT = window.PT;
  var sysById = {};
  PT.systems.forEach(function (s) { sysById[s.id] = s; });
  var statusCls = {};
  PT.statuses.forEach(function (s) { statusCls[s.v] = s.cls; });
  var evInfo = {};
  PT.evidence.forEach(function (e) { evInfo[e.v] = e; });

  var peptides = PT.peptides.map(function (p) {
    var st = p.status || {};
    var sys = sysById[p.sys];
    return Object.assign({}, p, {
      sysName: sys ? sys.name : '',
      sysIcon: sys ? sys.icon : 'dna',
      ev: p.ev || '—',
      // status por agencia: { v, note, source, url, confidence } (ver research/peptides.json)
      st: PT.agencies.reduce(function (o, a) { o[a] = (st[a] && st[a].v) || 'Pendiente'; return o; }, {}),
      stInfo: PT.agencies.reduce(function (o, a) { o[a] = st[a] || null; return o; }, {}),
      haystack: norm(p.name + ' ' + p.alias + ' ' + p.slug)
    });
  });
  var bySlug = {};
  peptides.forEach(function (p) { bySlug[p.slug] = p; });
  PT.systems.forEach(function (s) { s.count = peptides.filter(function (p) { return p.sys === s.id; }).length; });
  var matches = function (p, q) { q = norm(q.trim()); return q.length < 2 || p.haystack.indexOf(q) !== -1; };
  // estados que efectivamente aparecen en las agencias visibles (Pendiente siempre)
  var shownStatuses = PT.statuses.filter(function (s) {
    return s.v === 'Pendiente' || peptides.some(function (p) { return PT.agencies.some(function (a) { return p.st[a] === s.v; }); });
  });
  // textos que nombran las agencias: se arman con las visibles (configurables desde el backoffice)
  var agList = function (tail) {
    var a = PT.agencies;
    return tail ? a.join(', ') : a.length > 1 ? a.slice(0, -1).join(', ') + ' y ' + a[a.length - 1] : a[0];
  };
  $$('[data-ag-list]').forEach(function (el) { el.textContent = agList(el.hasAttribute('data-tail')); });
  $$('[data-ag-order]').forEach(function (el) { el.textContent = PT.agencies.join(' → '); });
  $$('[data-ag]').forEach(function (el) { el.hidden = PT.agencies.indexOf(el.dataset.ag) < 0; });
  var pendingCount = function (p) { return PT.agencies.filter(function (a) { return p.st[a] === 'Pendiente'; }).length; };
  var fmtDate = function (iso) { if (!iso) return '—'; var d = iso.split('-'); return d[2] + '/' + d[1] + '/' + d[0]; };
  var host = function (url) { try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };

  /* ---------- ui: piezas reutilizables ---------- */
  var icon = function (name, cls) { return '<svg class="i' + (cls ? ' ' + cls : '') + '" aria-hidden="true"><use href="assets/icons.svg#' + name + '"/></svg>'; };
  var dot = function (v) { return '<i class="dot ' + statusCls[v] + '"></i>'; };
  var evBadge = function (ev) { return '<span class="ev ' + (ev === '—' ? 'ev-none' : 'ev-' + ev) + '">Evidencia ' + ev + '</span>'; };
  // medidor de evidencia: 5 barras, A llena todo, E una, pendiente ninguna
  var EV_LEVEL = { A: 5, B: 4, C: 3, D: 2, E: 1, '—': 0 };
  var evMeter = function (ev, withLabel) {
    var lvl = EV_LEVEL[ev], bars = '';
    for (var i = 1; i <= 5; i++) bars += '<i class="' + (i <= lvl ? 'on' : '') + '" style="height:' + (6 + i * 3) + 'px"></i>';
    return '<span class="ev-meter' + (lvl ? '' : ' pending') + '" title="' + esc(evInfo[ev].name) + '"><span class="bars">' + bars + '</span>' +
      (withLabel ? '<span class="ev-txt"><b>' + (lvl ? 'Evidencia ' + ev : 'Evidencia') + '</b><small>' + esc(evInfo[ev].name) + '</small></span>' : '') + '</span>';
  };
  // franja compacta: una pastilla por agencia, el punto dice el estado
  var agencyStrip = function (p) {
    return '<div class="ag-strip" style="--n:' + PT.agencies.length + '">' + PT.agencies.map(function (a) {
      return '<span class="ag" title="' + a + ': ' + esc(p.st[a]) + '">' + dot(p.st[a]) + a + '</span>';
    }).join('') + '</div>';
  };
  // grilla detallada: agencia, jurisdicción y estado
  var agencyGrid = function (p, detail) {
    return '<div class="ag-grid' + (detail ? ' ag-detail' : '') + '">' + PT.agencies.map(function (a) {
      var info = PT.agencyInfo[a], x = p.stInfo[a];
      var more = detail && x ? (x.note ? '<p class="ag-note">' + esc(x.note) + '</p>' : '') +
        (x.url ? '<a class="ag-src" href="' + esc(x.url) + '" target="_blank" rel="noopener">' + icon('external-link') + esc(x.source || host(x.url)) + '</a>' : '') : '';
      return '<div class="ag-cell"><span class="ag-h">' + icon(info.icon) + '<b>' + a + '</b><small>' + info.name + '</small></span>' +
        '<span class="ag-v">' + dot(p.st[a]) + esc(p.st[a]) + '</span>' + more + '</div>';
    }).join('') + '</div>';
  };
  var sysTile = function (p, size) { return '<span class="sys-tile' + (size ? ' ' + size : '') + '">' + icon(p.sysIcon || p.icon) + '</span>'; };

  /* ---------- select: desplegable de marca sobre un <select> nativo ----------
     El <select> queda en el DOM (formularios, valor, eventos 'change'); se oculta
     y se dibuja un botón + listbox accesible. Para sincronizar tras cambiar el
     valor por código: select.dispatchEvent(new Event('pt:sync')). */
  var openSelect = null;
  document.addEventListener('pointerdown', function (e) { if (openSelect && !openSelect.wrap.contains(e.target)) openSelect.close(); });

  var brandSelect = function (sel, opts) {
    opts = opts || {};
    var wrap = document.createElement('div'), uid = 'bs' + Math.random().toString(36).slice(2, 8);
    wrap.className = 'bsel' + (opts.compact ? ' bsel-compact' : '');
    var label = sel.dataset.label;
    wrap.innerHTML =
      '<button type="button" class="bsel-btn" aria-haspopup="listbox" aria-expanded="false" aria-controls="' + uid + '">' +
      (label ? '<span class="bsel-label">' + esc(label) + '</span>' : '') + '<span class="bsel-val"></span>' + icon('chevron-down', 'bsel-chev') + '</button>' +
      '<ul class="bsel-list" id="' + uid + '" role="listbox" tabindex="-1" hidden></ul>';
    sel.parentNode.insertBefore(wrap, sel);
    wrap.appendChild(sel);
    sel.classList.add('sr'); sel.tabIndex = -1; sel.setAttribute('aria-hidden', 'true');
    var btn = $('.bsel-btn', wrap), list = $('.bsel-list', wrap), val = $('.bsel-val', wrap), active = -1, typed = '', typedAt = 0;
    var aria = sel.getAttribute('aria-label') || (sel.id && $('label[for="' + sel.id + '"]') ? $('label[for="' + sel.id + '"]').textContent : label);
    btn.setAttribute('aria-label', aria);
    list.setAttribute('aria-label', aria);
    if (sel.id) { var lab = $('label[for="' + sel.id + '"]'); if (lab) lab.addEventListener('click', function (e) { e.preventDefault(); btn.focus(); }); }

    var render = function () {
      list.innerHTML = Array.prototype.map.call(sel.options, function (o, i) {
        var deco = opts.decorate ? opts.decorate(o) : '';
        return '<li role="option" id="' + uid + '-' + i + '" data-i="' + i + '" aria-selected="' + (i === sel.selectedIndex) + '"' + (o.disabled ? ' aria-disabled="true"' : '') + '>' +
          deco + '<span>' + esc(o.text) + '</span>' + icon('check', 'bsel-check') + '</li>';
      }).join('');
    };
    var sync = function () {
      var o = sel.options[sel.selectedIndex];
      val.innerHTML = o ? (opts.decorate ? opts.decorate(o) : '') + esc(o.text) : '';
      wrap.classList.toggle('is-set', sel.selectedIndex > 0 && !!sel.value);
      btn.setAttribute('aria-invalid', sel.getAttribute('aria-invalid') === 'true');
      $$('[role=option]', list).forEach(function (li, i) { li.setAttribute('aria-selected', i === sel.selectedIndex); });
    };
    var move = function (i) {
      var items = $$('[role=option]', list);
      if (!items.length) return;
      active = Math.max(0, Math.min(items.length - 1, i));
      items.forEach(function (li, k) { li.classList.toggle('active', k === active); });
      list.setAttribute('aria-activedescendant', items[active].id);
      var li = items[active], top = li.offsetTop, bottom = top + li.offsetHeight;
      if (top < list.scrollTop) list.scrollTop = top; else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight;
    };
    var api = {
      wrap: wrap,
      open: function () {
        if (openSelect && openSelect !== api) openSelect.close();
        render(); list.hidden = false; wrap.classList.add('open'); btn.setAttribute('aria-expanded', 'true');
        // abre hacia arriba si no hay lugar abajo
        var r = btn.getBoundingClientRect();
        wrap.classList.toggle('up', window.innerHeight - r.bottom < Math.min(320, list.scrollHeight + 16) && r.top > 340);
        move(Math.max(0, sel.selectedIndex));
        list.focus({ preventScroll: true });
        openSelect = api;
      },
      close: function (refocus) {
        list.hidden = true; wrap.classList.remove('open'); btn.setAttribute('aria-expanded', 'false');
        if (openSelect === api) openSelect = null;
        if (refocus) btn.focus();
      }
    };
    var choose = function (i) {
      if (sel.options[i] && !sel.options[i].disabled && i !== sel.selectedIndex) {
        sel.selectedIndex = i;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      }
      sync(); api.close(true);
    };

    btn.addEventListener('click', function () { if (list.hidden) api.open(); else api.close(true); });
    btn.addEventListener('keydown', function (e) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].indexOf(e.key) !== -1) { e.preventDefault(); api.open(); }
    });
    list.addEventListener('keydown', function (e) {
      var n = sel.options.length;
      if (e.key === 'ArrowDown') { e.preventDefault(); move(active + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); move(active - 1); }
      else if (e.key === 'Home') { e.preventDefault(); move(0); }
      else if (e.key === 'End') { e.preventDefault(); move(n - 1); }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(active); }
      else if (e.key === 'Escape') { e.preventDefault(); api.close(true); }
      else if (e.key === 'Tab') api.close();
      else if (e.key.length === 1) { // búsqueda por tipeo
        var now = Date.now(); typed = (now - typedAt > 700 ? '' : typed) + norm(e.key); typedAt = now;
        for (var k = 0; k < n; k++) if (norm(sel.options[k].text).indexOf(typed) === 0) { move(k); break; }
      }
    });
    list.addEventListener('click', function (e) { var li = e.target.closest('[role=option]'); if (li) choose(+li.dataset.i); });
    list.addEventListener('mousemove', function (e) { var li = e.target.closest('[role=option]'); if (li && +li.dataset.i !== active) move(+li.dataset.i); });
    sel.addEventListener('change', sync);
    sel.addEventListener('pt:sync', sync);
    new MutationObserver(sync).observe(sel, { attributes: true, attributeFilter: ['aria-invalid'] });
    render(); sync();
    return api;
  };

  /* ---------- nav ---------- */
  (function nav() {
    var bar = $('#nav'), burger = $('#burger'), links = $('#navLinks');
    var setOpen = function (open) { links.classList.toggle('open', open); burger.setAttribute('aria-expanded', open); };
    burger.addEventListener('click', function () { setOpen(!links.classList.contains('open')); });
    links.addEventListener('click', function (e) { if (e.target.tagName === 'A') setOpen(false); });
    // barra flotante: aparece cuando la cabecera sale de pantalla
    var pill = $('#pillbar'), menuBtn = $('#pillMenu'), panel = $('#pillPanel');
    var setMenu = function (open) { panel.hidden = !open; menuBtn.setAttribute('aria-expanded', open); };
    var onScroll = function () {
      bar.classList.toggle('scrolled', window.scrollY > 8);
      var show = window.scrollY > bar.offsetTop + bar.offsetHeight + 120;
      if (show !== pill.classList.contains('show')) {
        pill.classList.toggle('show', show);
        pill.setAttribute('aria-hidden', !show);
        pill.inert = !show;
        if (!show) setMenu(false);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    menuBtn.addEventListener('click', function () { setMenu(panel.hidden); });
    panel.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
    document.addEventListener('pointerdown', function (e) { if (!panel.hidden && !pill.contains(e.target)) setMenu(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) { setMenu(false); menuBtn.focus(); } });
    $('#pillSearch').addEventListener('click', function () { $('#biblioteca').scrollIntoView(); setTimeout(function () { $('#libQ').focus({ preventScroll: true }); }, 450); });

    var anchors = $$('a', links).concat($$('.pill-links a'));
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
            return '<li role="option" id="sg' + i + '" data-slug="' + p.slug + '" aria-selected="' + (i === active) + '">' + sysTile(p, 'sm') + '<div><b>' + esc(p.name) + '</b><br><small>' + esc(p.alias) + '</small></div><span class="sugg-sys">' + esc(p.sysName) + '</span></li>';
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

    document.addEventListener('keydown', function (e) {
      if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); input.focus(); }
    });
  })();

  /* ---------- spot: ficha destacada que rota en el hero ---------- */
  (function spot() {
    var el = $('#spot'), list = PT.featured.map(function (s) { return bySlug[s]; }).filter(Boolean), i = 0, timer = 0, paused = false;
    if (!list.length) return;

    var render = function () {
      var p = list[i];
      el.innerHTML =
        '<div class="spot-top"><span class="spot-eyebrow">' + icon('microscope') + 'Ficha destacada</span>' +
        '<span class="spot-pager">' + list.map(function (_, k) { return '<button type="button" data-k="' + k + '" aria-label="Ver ficha ' + (k + 1) + '"' + (k === i ? ' aria-current="true"' : '') + '></button>'; }).join('') + '</span></div>' +
        '<div class="spot-body">' +
          '<div class="spot-id">' + sysTile(p, 'lg') + '<div><span class="spot-sys">' + esc(p.sysName) + '</span><h3>' + esc(p.name) + '</h3><p>' + esc(p.alias) + '</p></div></div>' +
          agencyGrid(p) +
          '<div class="spot-foot">' + evMeter(p.ev, true) +
          '<a class="spot-cta" href="#p/' + p.slug + '" data-slug="' + p.slug + '">Ver ficha' + icon('arrow-up-right') + '</a></div>' +
        '</div>' +
        '<div class="spot-progress"><i' + (paused || reduceMotion ? ' class="still"' : '') + '></i></div>';
    };
    var go = function (k) { i = (k + list.length) % list.length; el.classList.remove('swap'); void el.offsetWidth; el.classList.add('swap'); render(); schedule(); };
    var schedule = function () {
      clearTimeout(timer);
      if (!paused && !reduceMotion) timer = setTimeout(function () { go(i + 1); }, 6000);
    };
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-k]'); if (b) { go(+b.dataset.k); return; }
      var a = e.target.closest('[data-slug]'); if (a) { e.preventDefault(); Drawer.open(a.dataset.slug); }
    });
    var pause = function (v) { paused = v; var bar = $('.spot-progress i', el); if (bar) bar.classList.toggle('still', v); schedule(); };
    el.addEventListener('mouseenter', function () { pause(true); });
    el.addEventListener('mouseleave', function () { pause(false); });
    el.addEventListener('focusin', function () { pause(true); });
    el.addEventListener('focusout', function () { pause(false); });
    render(); schedule();
  })();

  /* ---------- systems: lista + cuerpo 3D + tarjeta ---------- */
  (function systems() {
    var listEl = $('#sysList'), card = $('#sysCard'), stage = $('#bodyStage');
    var current = 'digestivo', body = null, fallback = null;

    listEl.innerHTML = PT.systems.map(function (s) {
      return '<li role="presentation"><button role="tab" data-sys="' + s.id + '"><span class="sys-ic">' + icon(s.icon) + '</span>' + esc(s.name) + '<span class="n">' + s.count + '</span></button></li>';
    }).join('');

    var select = function (id) {
      current = id;
      var s = sysById[id];
      $$('button', listEl).forEach(function (b) { b.setAttribute('aria-selected', b.dataset.sys === id); });
      if (body) body.select(id);
      if (fallback) $$('.sys', fallback).forEach(function (g) { g.classList.toggle('on', g.dataset.sys === id); });
      var some = peptides.filter(function (p) { return p.sys === id; }).slice(0, 6);
      card.innerHTML =
        '<div class="top"><span class="sys-ic">' + icon(s.icon) + '</span><div><h3>' + esc(s.name) + '</h3><div class="cnt">' + plural(s.count, 'péptido', 'péptidos') + ' en la biblioteca</div></div></div>' +
        '<p>' + esc(s.desc) + '</p>' +
        '<div class="lbl">Algunos de este sistema</div>' +
        '<div class="pep-pills">' + some.map(function (p) { return '<button data-slug="' + p.slug + '">' + esc(p.name) + '</button>'; }).join('') + '</div>' +
        '<button class="btn btn-orange" data-go="' + id + '">Ver péptidos de ' + esc(s.name) + icon('arrow-right') + '</button>';
    };

    // sin WebGL: silueta SVG generada por scripts/body.py
    var useFallback = function () {
      return fetch('assets/body.svg').then(function (r) { return r.text(); }).then(function (svg) {
        stage.innerHTML = svg;
        stage.classList.add('is-svg');
        fallback = $('svg', stage);
        fallback.addEventListener('click', function (e) { var g = e.target.closest('.sys'); if (g) select(g.dataset.sys); });
        select(current);
      });
    };
    var boot = function () {
      loadScript('vendor/three.min.js').then(function () { return loadScript('body3d.js?v=c84e667e'); }).then(function () {
        stage.innerHTML = '';
        body = window.PTBody.mount(stage, PT.systems, { onPick: select });
        if (!body) throw new Error('sin WebGL');
        stage.classList.add('is-3d');
        body.select(current);
      }).catch(useFallback);
    };
    // Three.js se carga recién cuando la sección está por entrar en pantalla
    var io = new IntersectionObserver(function (en) { if (en[0].isIntersecting) { io.disconnect(); boot(); } }, { rootMargin: '600px' });
    io.observe(stage);

    listEl.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) select(b.dataset.sys); });
    card.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.dataset.slug) Drawer.open(b.dataset.slug);
      if (b.dataset.go) { Library.setSystem(b.dataset.go); $('#biblioteca').scrollIntoView(); }
    });
    select(current);
  })();

  /* ---------- library (filtros + resultados) ---------- */
  var Library = (function library() {
    var DEFAULTS = { q: '', sys: 'all', anmat: 'all', fda: 'all', wada: 'all', evid: 'all' };
    var state = Object.assign({ view: 'cards' }, DEFAULTS);
    var qEl = $('#libQ'), chipsEl = $('#sysChips'), results = $('#results'), empty = $('#empty'), countEl = $('#count'), clearBtn = $('#clearAll'), activeEl = $('#activeFilters');
    $$('#filters select').forEach(function (s) { if (s.dataset.f !== 'evid' && PT.agencies.indexOf(s.dataset.label) < 0) s.remove(); });
    var selects = $$('#filters select');

    $('#libMeta').textContent = plural(peptides.length, 'péptido', 'péptidos') + ' · ' + PT.systems.length + ' sistemas · Fuentes revisadas el ' + fmtDate(peptides.reduce(function (m, p) { return p.checked > m ? p.checked : m; }, ''));

    var statusDeco = function (o) { return o.value === 'all' ? '' : dot(o.value); };
    var evDeco = function (o) { return o.value === 'all' ? '' : '<span class="ev-mini ' + (o.value === '—' ? 'ev-none' : 'ev-' + o.value) + '">' + o.value + '</span>'; };
    selects.forEach(function (sel) {
      var isEv = sel.dataset.f === 'evid';
      sel.innerHTML = isEv
        ? '<option value="all">Todas</option>' + PT.evidence.map(function (e) { return '<option value="' + e.v + '">' + (e.v === '—' ? 'Pendiente' : e.name) + '</option>'; }).join('')
        : '<option value="all">Todos</option>' + shownStatuses.map(function (s) { return '<option value="' + s.v + '">' + s.v + '</option>'; }).join('');
      brandSelect(sel, { decorate: isEv ? evDeco : statusDeco, compact: true });
      sel.addEventListener('change', function () { state[sel.dataset.f] = sel.value; render(); });
    });

    var renderChips = function () {
      var all = [{ id: 'all', name: 'Todos', count: peptides.length, icon: 'layout-grid' }].concat(PT.systems);
      chipsEl.innerHTML = all.map(function (s) {
        return '<button class="chip" data-sys="' + s.id + '" aria-pressed="' + (state.sys === s.id) + '">' + icon(s.icon) + '<span>' + esc(s.name) + '</span><span class="n">' + s.count + '</span></button>';
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
      var pend = pendingCount(p);
      return '<button class="card" data-slug="' + p.slug + '" data-sys="' + p.sys + '" style="animation-delay:' + Math.min(i * 25, 300) + 'ms">' +
        '<span class="card-band">' + icon(p.sysIcon, 'card-mark') + sysTile(p) + '<span class="card-sys">' + esc(p.sysName) + '</span>' + evMeter(p.ev) + '</span>' +
        '<span class="card-main"><h3>' + esc(p.name) + '</h3><span class="alias">' + esc(p.alias) + '</span>' +
        '<span class="card-type">' + icon(p.type === 'Cosmético' ? 'sparkles' : 'dna') + esc(p.type) + '</span></span>' +
        agencyStrip(p) +
        '<span class="card-f"><span class="verif">' + icon(pend ? 'clock' : 'file-text') + (pend ? plural(pend, 'estado pendiente', 'estados pendientes') : 'Fuentes al ' + fmtDate(p.checked)) + '</span>' +
        '<span class="go">' + icon('arrow-up-right') + '</span></span></button>';
    };
    var tableHtml = function (list) {
      return '<div class="table-wrap"><table><thead><tr><th>Péptido</th><th>Sistema</th>' + PT.agencies.map(function (a) { return '<th>' + a + '</th>'; }).join('') + '<th>Evidencia</th></tr></thead><tbody>' +
        list.map(function (p) {
          return '<tr data-slug="' + p.slug + '" tabindex="0"><td><span class="t-pep">' + sysTile(p, 'sm') + '<span><b>' + esc(p.name) + '</b><small>' + esc(p.alias) + '</small></span></span></td><td>' + esc(p.sysName) + '</td>' +
            PT.agencies.map(function (a) { return '<td><span class="st">' + dot(p.st[a]) + esc(p.st[a]) + '</span></td>'; }).join('') + '<td>' + evMeter(p.ev) + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    };

    // filtros activos como fichas que se pueden quitar
    var LABELS = { anmat: 'ANMAT', fda: 'FDA', wada: 'WADA', evid: 'Evidencia' };
    var renderActive = function () {
      var tags = [];
      if (state.q.trim()) tags.push(['q', '«' + state.q.trim() + '»']);
      if (state.sys !== 'all') tags.push(['sys', sysById[state.sys].name]);
      ['anmat', 'fda', 'wada', 'evid'].forEach(function (k) {
        if (state[k] !== 'all') tags.push([k, LABELS[k] + ': ' + (k === 'evid' ? (state[k] === '—' ? 'Pendiente' : state[k]) : state[k])]);
      });
      activeEl.innerHTML = tags.map(function (t) { return '<button class="af" data-k="' + t[0] + '" aria-label="Quitar filtro ' + esc(t[1]) + '">' + esc(t[1]) + icon('x') + '</button>'; }).join('');
      clearBtn.hidden = !tags.length;
    };
    activeEl.addEventListener('click', function (e) {
      var b = e.target.closest('.af'); if (!b) return;
      var k = b.dataset.k;
      state[k] = DEFAULTS[k];
      if (k === 'q') qEl.value = '';
      var sel = $('#filters select[data-f="' + k + '"]');
      if (sel) { sel.value = 'all'; sel.dispatchEvent(new Event('pt:sync')); }
      render();
    });

    var render = function () {
      renderChips();
      renderActive();
      var list = filtered();
      countEl.innerHTML = '<b>' + list.length + '</b> de ' + plural(peptides.length, 'péptido', 'péptidos');
      empty.hidden = list.length > 0;
      results.innerHTML = !list.length ? '' : state.view === 'cards' ? '<div class="cards">' + list.map(cardHtml).join('') + '</div>' : tableHtml(list);
    };

    var clear = function () {
      Object.assign(state, DEFAULTS);
      qEl.value = '';
      selects.forEach(function (s) { s.value = 'all'; s.dispatchEvent(new Event('pt:sync')); });
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
  $('#legendStates').innerHTML = shownStatuses.map(function (s) { return '<li>' + dot(s.v) + '<b>' + s.v + '</b><small>' + s.desc + '</small></li>'; }).join('');
  $('#legendEv').innerHTML = PT.evidence.map(function (e) { return '<li>' + evMeter(e.v) + '<span><b>' + (e.v === '—' ? 'Pendiente' : e.v) + '</b> · ' + e.name + '</span></li>'; }).join('');

  /* ---------- drawer (ficha, enlazable por #p/slug) ---------- */
  var Drawer = (function drawer() {
    var el = $('#drawer'), body = $('#drawerBody'), scrim = $('#scrim'), lastFocus = null, pushed = false;
    // si la ficha se abrió desde la página volvemos atrás; si se entró por link, limpiamos el hash
    var close = function () { if (pushed) history.back(); else { history.replaceState(null, '', location.pathname); hide(); } };

    var show = function (slug) {
      var p = bySlug[slug]; if (!p) return;
      lastFocus = document.activeElement;
      var pend = pendingCount(p);
      body.innerHTML =
        '<div class="d-hero">' + icon(p.sysIcon, 'card-mark') +
          '<div class="crumbs">Péptidos › ' + esc(p.sysName) + '</div>' +
          '<div class="d-id">' + sysTile(p, 'lg') + '<div><h2 id="dTitle">' + esc(p.name) + '</h2><div class="alias">' + esc(p.alias) + '</div></div></div>' +
          '<div class="badges"><span class="tag">' + icon(p.sysIcon) + esc(p.sysName) + '</span><span class="tag tag-ghost">' + icon('dna') + esc(p.type) + '</span><span class="rev">' + icon('stethoscope') + 'Pendiente de revisión médica</span></div>' +
        '</div>' +
        '<div class="d-stats">' +
          '<div><small>Evidencia</small>' + evMeter(p.ev, true) + '</div>' +
          '<div><small>Estados con fuente</small><b class="big">' + (PT.agencies.length - pend) + '<span>/' + PT.agencies.length + '</span></b></div>' +
        '</div>' +
        '<div class="d-block"><h3>' + icon('book-open') + 'Resumen clave</h3><p>' + (p.summary ? esc(p.summary) : 'Ficha en preparación. Estamos reuniendo las fuentes primarias sobre ' + esc(p.name) + '.') + '</p>' +
          (p.evNote ? '<p class="d-note">' + icon('microscope') + esc(p.evNote) + '</p>' : '') + '</div>' +
        '<div class="d-block"><h3>' + icon('scale') + 'Estado regulatorio</h3>' + agencyGrid(p, true) + '</div>' +
        (p.refs && p.refs.length ? '<div class="d-block"><h3>' + icon('file-text') + 'Referencias</h3><ol class="refs">' + p.refs.map(function (r) {
          return '<li><a href="' + esc(r.url) + '" target="_blank" rel="noopener">' + esc(r.title) + '</a><small>' + esc(r.source || host(r.url)) + '</small></li>';
        }).join('') + '</ol></div>' : '') +
        '<p class="d-review">' + icon('calendar-check') + 'Fuentes revisadas el ' + fmtDate(p.checked) + '. Investigación preliminar asistida por IA, pendiente de revisión médica.</p>' +
        '<div class="d-cta"><span class="d-cta-ic">' + icon('stethoscope') + '</span><div><b>Consultá con un especialista</b><p>Te ponemos en contacto con un médico matriculado en Argentina, por teleconsulta o presencial.</p><a class="btn btn-orange" href="#derivacion" data-ref="' + esc(p.name) + '">Pedir una derivación' + icon('arrow-right') + '</a></div></div>' +
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
  var db = PT.supabase;
  var dbReady = !!(db && db.url);
  var send = function (data) {
    return fetch(db.url + '/rest/v1/rpc/pt_submit_lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: db.anonKey },
      body: JSON.stringify({ p: data })
    }).then(function (r) { if (!r.ok) throw new Error(r.status); });
  };
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  (function newsletter() {
    var form = $('#newsForm'), input = $('#nEmail'), msg = $('#newsMsg');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var ok = EMAIL.test(input.value.trim());
      input.setAttribute('aria-invalid', !ok);
      if (!ok) { msg.textContent = 'Revisá el email.'; input.focus(); return; }
      if (!dbReady) { msg.textContent = 'Todavía no abrimos las suscripciones. Volvé pronto.'; return; }
      msg.textContent = 'Enviando…';
      send({ kind: 'newsletter', email: input.value.trim() })
        .then(function () { form.reset(); msg.textContent = 'Listo, te vamos a mandar el próximo resumen.'; })
        .catch(function () { msg.textContent = 'No pudimos suscribirte. Probá de nuevo en un rato.'; });
    });
  })();

  (function referral() {
    var form = $('#refForm'), summary = $('#errSummary'), msg = $('#refMsg'), motivo = $('#fMotivo'), prov = $('#fProv');
    prov.insertAdjacentHTML('beforeend', PT.provinces.map(function (p) { return '<option>' + p + '</option>'; }).join(''));
    brandSelect(prov);
    $('#pepList').innerHTML = peptides.map(function (p) { return '<option value="' + esc(p.name) + '">'; }).join('');
    motivo.addEventListener('input', function () { $('#motivoLen').textContent = motivo.value.length + '/300'; });

    var validate = function (f) {
      var err = {};
      if (!f.name.value.trim()) err.name = 'Escribí tu nombre.';
      var email = f.email.value.trim(), phone = f.phone.value.trim();
      if (!email && !phone) err.contact = 'Dejanos un email o un teléfono.';
      else if (email && !EMAIL.test(email)) err.contact = 'Revisá el email.';
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
      if (!dbReady) { msg.textContent = 'Las derivaciones abren pronto. Todavía no estamos recibiendo pedidos online.'; return; }
      var btn = $('#refSubmit'); btn.disabled = true; btn.textContent = 'Enviando…';
      send({
        kind: 'derivacion', name: f.name.value.trim(), email: f.email.value.trim(), phone: f.phone.value.trim(), prov: f.prov.value,
        pep: f.pep.value.trim(), mod: f.mod.value, motivo: motivo.value.trim(),
        consent: { adult: f.adult.checked, c1: f.c1.checked, c2: f.c2.checked }
      }).then(function () {
        form.reset(); prov.dispatchEvent(new Event('pt:sync')); $('#motivoLen').textContent = '0/300';
        msg.textContent = 'Listo, recibimos tu pedido. Te vamos a confirmar por email.';
      }).catch(function () {
        msg.textContent = 'No pudimos enviar el pedido. Probá de nuevo en un rato.';
      }).then(function () { btn.disabled = false; btn.textContent = 'Enviar pedido'; });
    });
  })();

  /* ---------- reveal ---------- */
  (function reveal() {
    if (!('IntersectionObserver' in window) || reduceMotion) return;
    var els = $$('.trust > div, .dark-panel, .legend-card, .states-copy, .news > *, .referral, .guide, .method li, .disclaimer');
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    els.forEach(function (el) { el.classList.add('reveal'); io.observe(el); });
  })();
})();
