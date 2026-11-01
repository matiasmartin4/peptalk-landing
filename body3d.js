/* peptalk — cuerpo de partículas (Three.js r149).
   La silueta sale de volúmenes anatómicos (elipsoides y cápsulas) muestreados en
   su superficie. Cada partícula sabe cuánto pertenece a cada sistema según las
   zonas de data.js; el sistema activo se enciende y el mouse aparta las partículas.

   API: PTBody.mount(container, systems, { onPick, onReady }) → { select(id) } | null (sin WebGL) */
(function () {
  'use strict';

  /* ---------- anatomía (metros; pies en y = 0) ---------- */
  // Una sola piel: los volúmenes se funden con unión suave (smin), así las uniones
  // (cuello, axilas, muñecas, tobillos) quedan continuas como en un cuerpo real.
  // e: elipsoide [cx, cy, cz, rx, ry, rz] · c: cono redondeado [ax, ay, az, bx, by, bz, ra, rb]
  // g: grupo (cada brazo y pierna se funde por dentro y se une al tronco con poca mezcla)
  // k: radio de fusión con lo anterior del grupo · m: se espeja (lado izquierdo)
  var DEF = [
    { g: 'torso', e: [0, 1.69, 0.005, 0.076, 0.104, 0.094] },              // cráneo
    { g: 'torso', k: .04, e: [0, 1.705, -0.02, 0.079, 0.088, 0.088] },      // occipital
    { g: 'torso', k: .035, e: [0, 1.618, 0.038, 0.052, 0.042, 0.052] },     // mandíbula y mentón
    { g: 'torso', k: .012, e: [0, 1.672, 0.094, 0.011, 0.022, 0.016] },     // nariz
    { g: 'torso', k: .01, m: 1, e: [0.077, 1.68, -0.005, 0.012, 0.03, 0.019] }, // orejas
    { g: 'torso', k: .035, c: [0, 1.49, -0.01, 0, 1.63, 0.0, 0.054, 0.046] },  // cuello
    { g: 'torso', k: .06, m: 1, c: [0.02, 1.535, -0.025, 0.165, 1.462, -0.015, 0.04, 0.034] }, // trapecio
    { g: 'torso', k: .06, e: [0, 1.33, -0.005, 0.158, 0.17, 0.1] },        // caja torácica
    { g: 'torso', k: .04, m: 1, e: [0.072, 1.37, 0.055, 0.074, 0.055, 0.042] }, // pectorales
    { g: 'torso', k: .03, m: 1, e: [0.075, 1.36, -0.06, 0.08, 0.1, 0.045] },    // dorsales / escápulas
    { g: 'torso', k: .045, m: 1, e: [0.185, 1.43, -0.008, 0.058, 0.066, 0.058] }, // deltoides
    { g: 'torso', k: .08, e: [0, 1.12, 0.0, 0.128, 0.15, 0.088] },         // abdomen y cintura
    { g: 'torso', k: .07, e: [0, 0.955, -0.008, 0.162, 0.105, 0.1] },      // pelvis y caderas
    { g: 'torso', k: .04, m: 1, e: [0.068, 0.93, -0.052, 0.078, 0.088, 0.066] }, // glúteos

    { g: 'arm', m: 1, c: [0.195, 1.42, -0.01, 0.228, 1.135, -0.015, 0.045, 0.034] },  // brazo
    { g: 'arm', m: 1, k: .03, e: [0.208, 1.285, 0.012, 0.036, 0.075, 0.038] },        // bíceps
    { g: 'arm', m: 1, k: .03, e: [0.206, 1.3, -0.03, 0.035, 0.08, 0.034] },           // tríceps
    { g: 'arm', m: 1, k: .025, c: [0.228, 1.135, -0.015, 0.258, 0.88, 0.015, 0.035, 0.024] }, // antebrazo
    { g: 'arm', m: 1, k: .03, e: [0.234, 1.065, -0.004, 0.038, 0.075, 0.036] },       // músculos del antebrazo
    { g: 'arm', m: 1, k: .02, e: [0.264, 0.83, 0.02, 0.017, 0.047, 0.04] },           // palma
    { g: 'arm', m: 1, k: .015, e: [0.266, 0.756, 0.026, 0.013, 0.048, 0.034] },       // dedos
    { g: 'arm', m: 1, k: .012, c: [0.256, 0.835, 0.052, 0.252, 0.785, 0.07, 0.012, 0.009] }, // pulgar

    { g: 'leg', m: 1, c: [0.088, 0.93, -0.005, 0.086, 0.53, 0.012, 0.084, 0.054] },   // muslo
    { g: 'leg', m: 1, k: .04, e: [0.092, 0.73, 0.03, 0.062, 0.15, 0.058] },           // cuádriceps
    { g: 'leg', m: 1, k: .03, e: [0.08, 0.72, -0.03, 0.058, 0.14, 0.05] },            // isquiotibiales
    { g: 'leg', m: 1, k: .03, e: [0.086, 0.5, 0.02, 0.046, 0.05, 0.048] },            // rodilla
    { g: 'leg', m: 1, k: .03, c: [0.086, 0.5, 0.0, 0.092, 0.085, -0.012, 0.046, 0.03] }, // pierna
    { g: 'leg', m: 1, k: .035, e: [0.092, 0.36, -0.03, 0.05, 0.11, 0.048] },          // gemelos
    { g: 'leg', m: 1, k: .03, e: [0.097, 0.042, 0.04, 0.04, 0.034, 0.105] },          // pie
    { g: 'leg', m: 1, k: .025, e: [0.093, 0.055, -0.03, 0.032, 0.042, 0.035] }        // talón
  ];
  var JOIN = 0.022;   // fusión entre tronco y extremidades
  var HEIGHT = 1.8;

  var GROUPS = (function () {
    var by = {};
    DEF.forEach(function (d) {
      var sides = d.m ? [1, -1] : [1];
      sides.forEach(function (sx) {
        var g = d.g === 'torso' ? 'torso' : d.g + (sx > 0 ? 'R' : 'L');
        var p = { k: d.k || 0 };
        if (d.e) p.e = [d.e[0] * sx, d.e[1], d.e[2], d.e[3], d.e[4], d.e[5]];
        else p.c = [d.c[0] * sx, d.c[1], d.c[2], d.c[3] * sx, d.c[4], d.c[5], d.c[6], d.c[7]];
        (by[g] = by[g] || []).push(p);
      });
    });
    return Object.keys(by).map(function (g) {
      var lo = [9, 9, 9], hi = [-9, -9, -9];
      by[g].forEach(function (p) {
        var pts = p.e ? [[p.e[0] - p.e[3], p.e[1] - p.e[4], p.e[2] - p.e[5]], [p.e[0] + p.e[3], p.e[1] + p.e[4], p.e[2] + p.e[5]]]
          : [[p.c[0] - p.c[6], p.c[1] - p.c[6], p.c[2] - p.c[6]], [p.c[0] + p.c[6], p.c[1] + p.c[6], p.c[2] + p.c[6]],
             [p.c[3] - p.c[7], p.c[4] - p.c[7], p.c[5] - p.c[7]], [p.c[3] + p.c[7], p.c[4] + p.c[7], p.c[5] + p.c[7]]];
        pts.forEach(function (q) { for (var i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], q[i]); hi[i] = Math.max(hi[i], q[i]); } });
      });
      return { name: g, parts: by[g], lo: lo, hi: hi };
    });
  })();

  var smin = function (a, b, k) {
    if (k <= 0) return Math.min(a, b);
    var h = Math.max(k - Math.abs(a - b), 0) / k;
    return Math.min(a, b) - h * h * k * 0.25;
  };
  var partDist = function (p, x, y, z) {
    if (p.e) {  // elipsoide (aproximación de Íñigo Quílez)
      var e = p.e, px = (x - e[0]) / e[3], py = (y - e[1]) / e[4], pz = (z - e[2]) / e[5];
      var k0 = Math.sqrt(px * px + py * py + pz * pz);
      var k1 = Math.sqrt(px * px / (e[3] * e[3]) + py * py / (e[4] * e[4]) + pz * pz / (e[5] * e[5]));
      return k1 > 1e-9 ? k0 * (k0 - 1) / k1 : -Math.min(e[3], e[4], e[5]);
    }
    var c = p.c, abx = c[3] - c[0], aby = c[4] - c[1], abz = c[5] - c[2];
    var t = ((x - c[0]) * abx + (y - c[1]) * aby + (z - c[2]) * abz) / (abx * abx + aby * aby + abz * abz);
    t = Math.max(0, Math.min(1, t));
    var qx = c[0] + abx * t - x, qy = c[1] + aby * t - y, qz = c[2] + abz * t - z;
    return Math.sqrt(qx * qx + qy * qy + qz * qz) - (c[6] + (c[7] - c[6]) * t);
  };
  // distancia con signo a la piel (negativa = adentro)
  var bodyDist = function (x, y, z) {
    var d = 1;
    for (var g = 0; g < GROUPS.length; g++) {
      var G = GROUPS[g];
      var bx = Math.max(G.lo[0] - x, 0, x - G.hi[0]), by = Math.max(G.lo[1] - y, 0, y - G.hi[1]), bz = Math.max(G.lo[2] - z, 0, z - G.hi[2]);
      if (Math.sqrt(bx * bx + by * by + bz * bz) > d + JOIN) continue;  // la caja ya está más lejos que lo encontrado
      var dg = 1;
      for (var i = 0; i < G.parts.length; i++) dg = smin(dg, partDist(G.parts[i], x, y, z), G.parts[i].k);
      d = smin(d, dg, JOIN);
    }
    return d;
  };
  var normalAt = function (x, y, z) {  // gradiente por tetraedro (4 evaluaciones)
    var h = 0.002, a = bodyDist(x + h, y - h, z - h), b = bodyDist(x - h, y - h, z + h), c = bodyDist(x - h, y + h, z - h), d = bodyDist(x + h, y + h, z + h);
    var nx = a - b - c + d, ny = -a - b + c + d, nz = -a + b - c + d, l = Math.hypot(nx, ny, nz) || 1;
    return [nx / l, ny / l, nz / l];
  };

  var buildCloud = function (systems, total, interior) {
    // 1) grilla gruesa: sólo se muestrea en las celdas que cruza la piel
    var CELL = 0.02, X0 = -0.34, Y0 = -0.01, Z0 = -0.17, NX = 34, NY = 93, NZ = 20, cells = [];
    for (var ix = 0; ix < NX; ix++) for (var iy = 0; iy < NY; iy++) for (var iz = 0; iz < NZ; iz++) {
      var cx = X0 + (ix + .5) * CELL, cy = Y0 + (iy + .5) * CELL, cz = Z0 + (iz + .5) * CELL;
      if (Math.abs(bodyDist(cx, cy, cz)) < CELL * 0.9) cells.push(cx, cy, cz);
    }
    var nCells = cells.length / 3, pts = [], SHELL = 0.0035, guard = total * 12;
    // 2) puntos uniformes en una cáscara fina, proyectados sobre la piel
    while (pts.length < total && guard-- > 0) {
      var ci = ((Math.random() * nCells) | 0) * 3;
      var x = cells[ci] + (Math.random() - .5) * CELL, y = cells[ci + 1] + (Math.random() - .5) * CELL, z = cells[ci + 2] + (Math.random() - .5) * CELL;
      var d = bodyDist(x, y, z);
      if (Math.abs(d) > SHELL) continue;
      var n = normalAt(x, y, z);
      var q = [x - n[0] * d, y - n[1] * d, z - n[2] * d];
      q.n = n;
      pts.push(q);
    }
    // 3) volumen interior tenue en el tronco: deja "ver" los órganos encendidos
    var surfaceCount = pts.length; guard = interior * 40;
    while (pts.length < surfaceCount + interior && guard-- > 0) {
      var p = [(Math.random() - .5) * 0.34, 0.86 + Math.random() * 0.86, (Math.random() - .5) * 0.22];
      if (bodyDist(p[0], p[1], p[2]) < -0.012) pts.push(p);
    }

    var n = pts.length, nor = new Float32Array(n * 3), pos = new Float32Array(n * 3), w0 = new Float32Array(n * 4), w1 = new Float32Array(n * 4), rnd = new Float32Array(n), surf = new Float32Array(n);
    pts.forEach(function (q, i) {
      pos[i * 3] = q[0]; pos[i * 3 + 1] = q[1] - HEIGHT / 2; pos[i * 3 + 2] = q[2];
      if (q.n) { nor[i * 3] = q.n[0]; nor[i * 3 + 1] = q.n[1]; nor[i * 3 + 2] = q.n[2]; }
      rnd[i] = Math.random();
      surf[i] = i < surfaceCount ? 1 : 0;
      systems.forEach(function (sys, si) {
        var best = 0;
        sys.zones.forEach(function (z) {
          var dd = Math.hypot(q[0] - z[0], q[1] - z[1], (q[2] - z[2]) * .6);
          best = Math.max(best, 1 - Math.min(1, Math.max(0, (dd - z[3] * .45) / (z[3] * .9))));
        });
        (si < 4 ? w0 : w1)[i * 4 + (si % 4)] = best * best * (3 - 2 * best);
      });
    });
    return { pos: pos, nor: nor, w0: w0, w1: w1, rnd: rnd, surf: surf, count: n };
  };

  /* ---------- shaders ---------- */
  var VERT = [
    'attribute vec4 aW0; attribute vec4 aW1; attribute float aRand; attribute float aSurf; attribute vec3 aNormal;',
    'uniform float uTime; uniform vec3 uMouse; uniform float uHover; uniform vec4 uAct0; uniform vec4 uAct1;',
    'uniform vec4 uHov0; uniform vec4 uHov1; uniform float uSize; uniform float uPR; uniform float uMotion;',
    'varying float vActive; varying float vNear; varying float vAlpha; varying float vHover; varying float vRim;',
    'void main() {',
    '  vec3 p = position;',
    '  vec3 nv = normalize(normalMatrix * (aNormal + vec3(0.0, 0.0, 1e-4)));',
    '  vRim = pow(1.0 - abs(nv.z), 3.0) * aSurf;',
    '  float key = max(dot(nv, normalize(vec3(-0.45, 0.6, 0.65))), 0.0);',
    '  float face = smoothstep(-0.35, 0.4, nv.z);',
    '  float breath = sin(uTime * 1.25) * 0.006 * uMotion;',
    '  p.xz *= 1.0 + breath * smoothstep(0.7, 0.15, abs(p.y - 0.4));',
    '  p += 0.0025 * uMotion * vec3(sin(uTime * 0.9 + aRand * 40.0), cos(uTime * 1.1 + aRand * 31.0), sin(uTime * 0.7 + aRand * 17.0));',
    '  float d = distance(p.xy, uMouse.xy);',
    '  float f = smoothstep(0.2, 0.0, d) * uHover;',
    '  vec2 dir = normalize(p.xy - uMouse.xy + 1e-4);',
    '  p.xy += dir * f * 0.045;',
    '  p.z += f * 0.05 * sin(uTime * 5.0 + aRand * 6.2832);',
    '  vActive = dot(aW0, uAct0) + dot(aW1, uAct1);',
    '  vHover = dot(aW0, uHov0) + dot(aW1, uHov1);',
    '  vNear = f;',
    '  float lit = mix(0.16, (0.18 + 0.62 * key + 0.4 * vRim) * mix(0.32, 1.0, face), aSurf);',
    '  vAlpha = lit * (0.8 + 0.2 * sin(uTime * 2.0 + aRand * 60.0) * uMotion + 0.2 * (1.0 - uMotion));',
    '  vec4 mv = modelViewMatrix * vec4(p, 1.0);',
    '  gl_Position = projectionMatrix * mv;',
    '  float s = uSize * (0.55 + aRand * 0.7) * (1.0 + vActive * 0.9 + vHover * 0.4 + f * 1.0) * mix(0.75, 1.0, aSurf);',
    '  gl_PointSize = s * uPR / -mv.z;',
    '}'
  ].join('\n');
  var FRAG = [
    'varying float vActive; varying float vNear; varying float vAlpha; varying float vHover; varying float vRim;',
    'void main() {',
    '  float r = length(gl_PointCoord - 0.5);',
    '  if (r > 0.5) discard;',
    '  float soft = smoothstep(0.5, 0.0, r);',
    '  vec3 base = mix(vec3(1.0, 0.76, 0.58), vec3(1.0, 0.9, 0.8), vRim);',
    '  vec3 hot = mix(vec3(1.0, 0.36, 0.0), vec3(1.0, 0.62, 0.28), soft);',
    '  vec3 col = mix(base, hot, clamp(vActive + vHover * 0.45 + vNear * 0.6, 0.0, 1.0));',
    '  float a = vAlpha * soft * (1.0 + vActive * 0.9 + vHover * 0.35 + vNear * 0.6);',
    '  gl_FragColor = vec4(col * a, a);',
    '}'
  ].join('\n');

  var hasWebGL = function () {
    try { var c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); } catch (e) { return false; }
  };

  function mount(container, systems, opts) {
    if (!window.THREE || !hasWebGL()) return null;
    var THREE = window.THREE;
    opts = opts || {};
    var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    var small = matchMedia('(max-width: 900px)').matches;

    var renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'high-performance' });
    var pr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(pr);
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);
    renderer.domElement.setAttribute('aria-hidden', 'true');

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(28, 1, 0.1, 20);
    camera.position.set(0, 0.02, 4.25);

    var group = new THREE.Group();
    scene.add(group);

    var cloud = buildCloud(systems, small ? 26000 : 46000, small ? 3000 : 6000);
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(cloud.pos, 3));
    geo.setAttribute('aNormal', new THREE.BufferAttribute(cloud.nor, 3));
    geo.setAttribute('aW0', new THREE.BufferAttribute(cloud.w0, 4));
    geo.setAttribute('aW1', new THREE.BufferAttribute(cloud.w1, 4));
    geo.setAttribute('aRand', new THREE.BufferAttribute(cloud.rnd, 1));
    geo.setAttribute('aSurf', new THREE.BufferAttribute(cloud.surf, 1));

    var uniforms = {
      uTime: { value: 0 }, uMouse: { value: new THREE.Vector3(9, 9, 0) }, uHover: { value: 0 },
      uAct0: { value: new THREE.Vector4() }, uAct1: { value: new THREE.Vector4() },
      uHov0: { value: new THREE.Vector4() }, uHov1: { value: new THREE.Vector4() },
      uSize: { value: small ? 13 : 12 }, uPR: { value: pr }, uMotion: { value: reduce ? 0 : 1 }
    };
    var mat = new THREE.ShaderMaterial({ uniforms: uniforms, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    group.add(new THREE.Points(geo, mat));

    // polvo de fondo
    var dustN = small ? 350 : 700, dust = new Float32Array(dustN * 3);
    for (var i = 0; i < dustN; i++) { dust[i * 3] = (Math.random() - .5) * 3.2; dust[i * 3 + 1] = (Math.random() - .5) * 2.4; dust[i * 3 + 2] = (Math.random() - .5) * 1.5 - .4; }
    var dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dust, 3));
    var dustMat = new THREE.PointsMaterial({ color: 0xFFB066, size: 0.008, transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending });
    var dustPts = new THREE.Points(dustGeo, dustMat);
    scene.add(dustPts);

    /* marcadores HTML proyectados desde la primera zona de cada sistema */
    var layer = document.createElement('div');
    layer.className = 'body-markers';
    container.appendChild(layer);
    var markers = systems.map(function (s) {
      var b = document.createElement('button');
      b.className = 'marker'; b.type = 'button'; b.dataset.sys = s.id;
      b.setAttribute('aria-label', s.name);
      b.innerHTML = '<span class="marker-dot"></span><span class="marker-label">' + s.name + '</span>';
      b.addEventListener('click', function () { if (opts.onPick) opts.onPick(s.id); });
      b.addEventListener('mouseenter', function () { setHover(s.id); });
      b.addEventListener('mouseleave', function () { setHover(null); });
      layer.appendChild(b);
      var z = s.zones[0];
      return { el: b, local: new THREE.Vector3(z[0], z[1] - HEIGHT / 2, z[2] + z[3] * .6) };
    });

    /* estado */
    var activeIdx = -1, hoverIdx = -1, target = { act: new Float32Array(8), hov: new Float32Array(8) }, cur = { act: new Float32Array(8), hov: new Float32Array(8) };
    var pointer = { x: 0, y: 0, inside: false }, hoverAmt = 0;
    var mouseLocal = new THREE.Vector3(9, 9, 0);
    var ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), hit = new THREE.Vector3();

    function idxOf(id) { for (var i = 0; i < systems.length; i++) if (systems[i].id === id) return i; return -1; }
    function setHover(id) {
      hoverIdx = idxOf(id);
      for (var i = 0; i < 8; i++) target.hov[i] = i === hoverIdx && i !== activeIdx ? 1 : 0;
      container.style.cursor = hoverIdx >= 0 ? 'pointer' : '';
    }
    function select(id) {
      activeIdx = idxOf(id);
      for (var i = 0; i < 8; i++) target.act[i] = i === activeIdx ? 1 : 0;
      markers.forEach(function (m, i) { m.el.classList.toggle('on', i === activeIdx); m.el.setAttribute('aria-pressed', i === activeIdx); });
      setHover(hoverIdx >= 0 ? systems[hoverIdx].id : null);
    }
    // sistema más cercano al punto del mouse (en el plano del cuerpo)
    function pickAt(p) {
      var best = -1, bestD = Infinity;
      systems.forEach(function (s, i) {
        s.zones.forEach(function (z) {
          var d = Math.hypot(p.x - z[0], p.y - (z[1] - HEIGHT / 2)) / z[3];
          if (d < bestD) { bestD = d; best = i; }
        });
      });
      return bestD < 1.3 ? best : -1;
    }

    var canvas = renderer.domElement;
    canvas.addEventListener('pointermove', function (e) {
      var r = canvas.getBoundingClientRect();
      pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      pointer.inside = true;
      ray.setFromCamera(pointer, camera);
      if (ray.ray.intersectPlane(plane, hit)) {
        mouseLocal.copy(group.worldToLocal(hit.clone()));
        var i = pickAt(mouseLocal);
        setHover(i >= 0 ? systems[i].id : null);
      }
    });
    canvas.addEventListener('pointerleave', function () { pointer.inside = false; setHover(null); });
    canvas.addEventListener('click', function () { if (hoverIdx >= 0 && opts.onPick) opts.onPick(systems[hoverIdx].id); });

    /* tamaño */
    function resize() {
      var w = container.clientWidth, h = container.clientHeight;
      renderer.setSize(w, h, false);
      canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
      camera.aspect = w / h;
      camera.position.z = 4.25 * Math.max(1, 0.6 / camera.aspect);
      camera.updateProjectionMatrix();
    }
    resize();
    var ro = new ResizeObserver(resize);
    ro.observe(container);

    /* loop: sólo corre visible */
    var visible = false, raf = 0, clock = new THREE.Clock(), v = new THREE.Vector3();
    function frame() {
      raf = 0;
      if (!visible || document.hidden) return;
      var t = clock.getElapsedTime(), k = 0.08;
      uniforms.uTime.value = t;
      for (var i = 0; i < 8; i++) { cur.act[i] += (target.act[i] - cur.act[i]) * k; cur.hov[i] += (target.hov[i] - cur.hov[i]) * k; }
      uniforms.uAct0.value.set(cur.act[0], cur.act[1], cur.act[2], cur.act[3]);
      uniforms.uAct1.value.set(cur.act[4], cur.act[5], cur.act[6], cur.act[7]);
      uniforms.uHov0.value.set(cur.hov[0], cur.hov[1], cur.hov[2], cur.hov[3]);
      uniforms.uHov1.value.set(cur.hov[4], cur.hov[5], cur.hov[6], cur.hov[7]);
      hoverAmt += ((pointer.inside ? 1 : 0) - hoverAmt) * 0.08;
      uniforms.uHover.value = hoverAmt;
      uniforms.uMouse.value.lerp(mouseLocal, 0.25);

      var sway = reduce ? 0 : Math.sin(t * 0.35) * 0.12;
      group.rotation.y += ((pointer.inside ? pointer.x * 0.35 : sway) - group.rotation.y) * 0.04;
      group.rotation.x += ((pointer.inside ? -pointer.y * 0.06 : 0) - group.rotation.x) * 0.04;
      if (!reduce) { dustPts.rotation.y = t * 0.02; dustPts.position.y = Math.sin(t * 0.2) * 0.03; }

      renderer.render(scene, camera);

      var w = canvas.clientWidth, h = canvas.clientHeight;
      group.updateMatrixWorld();
      markers.forEach(function (m) {
        v.copy(m.local); group.localToWorld(v); v.project(camera);
        m.el.style.transform = 'translate(' + ((v.x + 1) / 2 * w).toFixed(1) + 'px,' + ((1 - v.y) / 2 * h).toFixed(1) + 'px)';
      });
      raf = requestAnimationFrame(frame);
    }
    function wake() { if (!raf) raf = requestAnimationFrame(frame); }
    // los observers quedan referenciados en la instancia: sin referencia, el GC puede descartarlos
    var io = new IntersectionObserver(function (en) { visible = en[en.length - 1].isIntersecting; if (visible) wake(); }, { rootMargin: '100px' });
    io.observe(container);
    document.addEventListener('visibilitychange', wake);
    // si la página abre ya scrolleada (#sistemas), no esperar al primer aviso del observer
    requestAnimationFrame(function () {
      var r = container.getBoundingClientRect();
      if (r.bottom > 0 && r.top < innerHeight) { visible = true; wake(); }
    });

    if (opts.onReady) opts.onReady();
    return { select: function (id) { select(id); wake(); }, _observers: [io, ro] };
  }

  window.PTBody = { mount: mount };
})();
