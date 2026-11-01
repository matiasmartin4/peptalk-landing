/* peptalk — cuerpo de partículas (Three.js r149).
   La silueta sale de volúmenes anatómicos (elipsoides y cápsulas) muestreados en
   su superficie. Cada partícula sabe cuánto pertenece a cada sistema según las
   zonas de data.js; el sistema activo se enciende y el mouse aparta las partículas.

   API: PTBody.mount(container, systems, { onPick, onReady }) → { select(id) } | null (sin WebGL) */
(function () {
  'use strict';

  /* ---------- anatomía (metros; pies en y = 0) ---------- */
  // e: elipsoide [cx, cy, cz, rx, ry, rz] · c: cápsula [ax, ay, az, bx, by, bz, ra, rb]
  var PARTS = [
    { e: [0, 1.655, 0, 0.088, 0.115, 0.102] },            // cabeza
    { e: [0, 1.575, 0.035, 0.06, 0.05, 0.06] },            // mandíbula
    { c: [0, 1.47, 0, 0, 1.56, 0.005, 0.054, 0.048] },     // cuello
    { e: [0, 1.31, 0, 0.175, 0.17, 0.105] },               // tórax
    { e: [0, 1.4, 0, 0.2, 0.06, 0.085] },                  // hombros / trapecio
    { e: [0, 1.1, 0.005, 0.14, 0.16, 0.095] },             // abdomen
    { e: [0, 0.93, 0, 0.165, 0.1, 0.105] },                // pelvis
    { e: [-0.2, 1.405, 0, 0.065, 0.065, 0.065] },          // deltoides
    { e: [0.2, 1.405, 0, 0.065, 0.065, 0.065] },
    { c: [-0.215, 1.39, 0, -0.245, 1.11, 0.01, 0.052, 0.04] },   // brazos
    { c: [0.215, 1.39, 0, 0.245, 1.11, 0.01, 0.052, 0.04] },
    { c: [-0.245, 1.11, 0.01, -0.275, 0.86, 0.04, 0.04, 0.028] }, // antebrazos
    { c: [0.245, 1.11, 0.01, 0.275, 0.86, 0.04, 0.04, 0.028] },
    { e: [-0.282, 0.79, 0.045, 0.028, 0.068, 0.017] },     // manos
    { e: [0.282, 0.79, 0.045, 0.028, 0.068, 0.017] },
    { c: [-0.088, 0.9, 0, -0.098, 0.5, 0.012, 0.085, 0.056] },   // muslos
    { c: [0.088, 0.9, 0, 0.098, 0.5, 0.012, 0.085, 0.056] },
    { c: [-0.098, 0.5, 0.012, -0.1, 0.09, -0.008, 0.05, 0.032] }, // piernas
    { c: [0.098, 0.5, 0.012, 0.1, 0.09, -0.008, 0.05, 0.032] },
    { e: [-0.1, 0.38, -0.018, 0.05, 0.11, 0.05] },         // gemelos
    { e: [0.1, 0.38, -0.018, 0.05, 0.11, 0.05] },
    { e: [-0.102, 0.035, 0.045, 0.04, 0.033, 0.1] },       // pies
    { e: [0.102, 0.035, 0.045, 0.04, 0.033, 0.1] }
  ];
  var HEIGHT = 1.8;

  // función de distancia aproximada (negativa = adentro)
  var sdf = function (part, x, y, z) {
    if (part.e) {
      var e = part.e, dx = (x - e[0]) / e[3], dy = (y - e[1]) / e[4], dz = (z - e[2]) / e[5];
      return (Math.sqrt(dx * dx + dy * dy + dz * dz) - 1) * Math.min(e[3], e[4], e[5]);
    }
    var c = part.c, abx = c[3] - c[0], aby = c[4] - c[1], abz = c[5] - c[2];
    var t = ((x - c[0]) * abx + (y - c[1]) * aby + (z - c[2]) * abz) / (abx * abx + aby * aby + abz * abz);
    t = Math.max(0, Math.min(1, t));
    var px = c[0] + abx * t - x, py = c[1] + aby * t - y, pz = c[2] + abz * t - z;
    return Math.sqrt(px * px + py * py + pz * pz) - (c[6] + (c[7] - c[6]) * t);
  };
  var area = function (p) {
    if (p.e) return 4 * Math.PI * Math.pow((p.e[3] * p.e[4] + p.e[3] * p.e[5] + p.e[4] * p.e[5]) / 3, 1);
    var c = p.c, len = Math.hypot(c[3] - c[0], c[4] - c[1], c[5] - c[2]);
    return 2 * Math.PI * (c[6] + c[7]) / 2 * len + 2 * Math.PI * (c[6] * c[6] + c[7] * c[7]);
  };
  var randDir = function () {
    var u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u);
    return [s * Math.cos(a), u, s * Math.sin(a)];
  };
  var samplePart = function (p) {
    if (p.e) {
      var d = randDir(), e = p.e, nx = d[0] / e[3], ny = d[1] / e[4], nz = d[2] / e[5], nl = Math.hypot(nx, ny, nz);
      var q = [e[0] + d[0] * e[3], e[1] + d[1] * e[4], e[2] + d[2] * e[5]];
      q.n = [nx / nl, ny / nl, nz / nl];
      return q;
    }
    var c = p.c, t = Math.random(), r = c[6] + (c[7] - c[6]) * t;
    var ax = [c[3] - c[0], c[4] - c[1], c[5] - c[2]], len = Math.hypot(ax[0], ax[1], ax[2]);
    ax = ax.map(function (v) { return v / len; });
    var ref = Math.abs(ax[1]) < .9 ? [0, 1, 0] : [1, 0, 0];
    var u = [ax[1] * ref[2] - ax[2] * ref[1], ax[2] * ref[0] - ax[0] * ref[2], ax[0] * ref[1] - ax[1] * ref[0]];
    var ul = Math.hypot(u[0], u[1], u[2]); u = u.map(function (v) { return v / ul; });
    var w = [ax[1] * u[2] - ax[2] * u[1], ax[2] * u[0] - ax[0] * u[2], ax[0] * u[1] - ax[1] * u[0]];
    var a = Math.random() * Math.PI * 2, ca = Math.cos(a) * r, sa = Math.sin(a) * r;
    var out = [c[0] + ax[0] * len * t + u[0] * ca + w[0] * sa, c[1] + ax[1] * len * t + u[1] * ca + w[1] * sa, c[2] + ax[2] * len * t + u[2] * ca + w[2] * sa];
    out.n = [(u[0] * ca + w[0] * sa) / r, (u[1] * ca + w[1] * sa) / r, (u[2] * ca + w[2] * sa) / r];
    return out;
  };
  var insideOther = function (pt, self) {
    for (var i = 0; i < PARTS.length; i++) if (PARTS[i] !== self && sdf(PARTS[i], pt[0], pt[1], pt[2]) < -0.004) return true;
    return false;
  };

  var buildCloud = function (systems, total, interior) {
    var areas = PARTS.map(area), sum = areas.reduce(function (a, b) { return a + b; }, 0);
    var pts = [];
    PARTS.forEach(function (p, i) {
      var n = Math.round(total * areas[i] / sum), tries = 0;
      while (n > 0 && tries++ < n * 6) { var q = samplePart(p); if (!insideOther(q, p)) { pts.push(q); n--; } }
    });
    // volumen interior tenue: da profundidad y deja "ver" los órganos encendidos
    var surfaceCount = pts.length;
    for (var k = 0; k < interior; k++) {
      var part = PARTS[(Math.random() * 9) | 0], q2 = samplePart(part), s = Math.pow(Math.random(), .6);
      var cx = part.e ? part.e[0] : (part.c[0] + part.c[3]) / 2, cy = part.e ? part.e[1] : (part.c[1] + part.c[4]) / 2, cz = part.e ? part.e[2] : (part.c[2] + part.c[5]) / 2;
      pts.push([cx + (q2[0] - cx) * s, cy + (q2[1] - cy) * s, cz + (q2[2] - cz) * s]);
    }

    var n = pts.length, nor = new Float32Array(n * 3), pos = new Float32Array(n * 3), w0 = new Float32Array(n * 4), w1 = new Float32Array(n * 4), rnd = new Float32Array(n), surf = new Float32Array(n);
    pts.forEach(function (q, i) {
      pos[i * 3] = q[0]; pos[i * 3 + 1] = q[1] - HEIGHT / 2; pos[i * 3 + 2] = q[2];
      if (q.n && i < surfaceCount) { nor[i * 3] = q.n[0]; nor[i * 3 + 1] = q.n[1]; nor[i * 3 + 2] = q.n[2]; }
      rnd[i] = Math.random();
      surf[i] = i < surfaceCount ? 1 : 0;
      systems.forEach(function (sys, si) {
        var best = 0;
        sys.zones.forEach(function (z) {
          var d = Math.hypot(q[0] - z[0], q[1] - z[1], (q[2] - z[2]) * .6);
          best = Math.max(best, 1 - Math.min(1, Math.max(0, (d - z[3] * .45) / (z[3] * .9))));
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
    '  vRim = pow(1.0 - abs(nv.z), 2.2) * aSurf;',
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
    '  vAlpha = (mix(0.32, 0.7, aSurf) + vRim * 1.9) * (0.7 + 0.3 * sin(uTime * 2.0 + aRand * 60.0) * uMotion + 0.3 * (1.0 - uMotion));',
    '  vec4 mv = modelViewMatrix * vec4(p, 1.0);',
    '  gl_Position = projectionMatrix * mv;',
    '  float s = uSize * (0.55 + aRand * 0.7) * (1.0 + vActive * 1.3 + vHover * 0.5 + f * 1.4 + vRim * 0.5) * mix(0.7, 1.0, aSurf);',
    '  gl_PointSize = s * uPR / -mv.z;',
    '}'
  ].join('\n');
  var FRAG = [
    'varying float vActive; varying float vNear; varying float vAlpha; varying float vHover; varying float vRim;',
    'void main() {',
    '  float r = length(gl_PointCoord - 0.5);',
    '  if (r > 0.5) discard;',
    '  float soft = smoothstep(0.5, 0.0, r);',
    '  vec3 base = mix(vec3(1.0, 0.80, 0.64), vec3(1.0, 0.94, 0.86), vRim);',
    '  vec3 hot = mix(vec3(1.0, 0.42, 0.0), vec3(1.0, 0.78, 0.45), soft);',
    '  vec3 col = mix(base, hot, clamp(vActive + vHover * 0.45 + vNear * 0.6, 0.0, 1.0));',
    '  float a = vAlpha * soft * (0.9 + vActive * 1.4 + vHover * 0.5 + vNear * 1.0);',
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
    new ResizeObserver(resize).observe(container);

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
    new IntersectionObserver(function (en) { visible = en[0].isIntersecting; if (visible) wake(); }, { rootMargin: '100px' }).observe(container);
    document.addEventListener('visibilitychange', wake);

    if (opts.onReady) opts.onReady();
    return { select: function (id) { select(id); wake(); } };
  }

  window.PTBody = { mount: mount };
})();
