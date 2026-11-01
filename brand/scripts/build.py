"""peptalk brand build.

Genera, a partir de tokens/tokens.json y fonts/Inter-ExtraBold.otf:
  tokens/tokens.css, tokens/tailwind.preset.js
  logo/*.svg, backgrounds/*.svg, applications/*.svg
  y los PNG de cada uno (Chrome headless).

Requisitos: python3 con fonttools y uharfbuzz; Google Chrome instalado.
Uso: python3 brand/scripts/build.py [--no-png]
"""
import json
import math
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import uharfbuzz as hb
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
TOKENS = json.loads((ROOT / "tokens/tokens.json").read_text())
FONT = ROOT / "fonts/Inter-ExtraBold.otf"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"


# ---------------------------------------------------------------- tokens ----

def resolve(value):
    """Reemplaza referencias {a.b.c} por su valor."""
    if isinstance(value, str):
        m = re.fullmatch(r"\{([\w.-]+)\}", value)
        if m:
            node = TOKENS
            for part in m.group(1).split("."):
                node = node[part]
            return resolve(node["$value"])
    return value


def flatten(node, path=(), inherited_type=None):
    """Recorre el árbol y devuelve [(path, value, type)] de cada token."""
    t = node.get("$type", inherited_type)
    if "$value" in node:
        return [(path, resolve(node["$value"]), t)]
    out = []
    for k, v in node.items():
        if not k.startswith("$") and isinstance(v, dict):
            out += flatten(v, path + (k,), t)
    return out


def css_value(value, kind):
    if kind == "gradient":
        stops = ", ".join(f"{s['color']} {round(s['position'] * 100)}%" for s in value)
        return f"linear-gradient(225deg, {stops})"
    if kind == "fontFamily":
        return ", ".join(f'"{f}"' if " " in f else f for f in value)
    if kind == "cubicBezier":
        return "cubic-bezier(" + ", ".join(str(n) for n in value) + ")"
    return str(value)


def color(name):
    group, key = name.split(".")
    return resolve(TOKENS["color"][group][key]["$value"])


# Capa semántica: lo que consumen los componentes. Cambia con el tema.
SEMANTIC = {
    "light": {
        "bg": "var(--pt-color-support-paper)",
        "surface": "var(--pt-color-support-white)",
        "surface-warm": "var(--pt-color-brand-cream)",
        "surface-muted": "var(--pt-color-support-sand)",
        "border": "var(--pt-color-support-line)",
        "border-warm": "var(--pt-color-brand-amber)",
        "text": "var(--pt-color-brand-ink)",
        "text-soft": "var(--pt-color-support-ink-soft)",
        "text-muted": "var(--pt-color-brand-gray)",
        "accent": "var(--pt-color-brand-orange)",
        "accent-text": "var(--pt-color-support-rust)",
        "on-accent": "var(--pt-color-brand-ink)",
        "inverse": "var(--pt-color-brand-ink)",
        "on-inverse": "var(--pt-color-support-white)",
        "focus": "var(--pt-color-brand-orange)",
    },
    "dark": {
        "bg": "var(--pt-color-support-night)",
        "surface": "var(--pt-color-support-night-2)",
        "surface-warm": "#2A1D15",
        "surface-muted": "#262019",
        "border": "rgba(255,255,255,.12)",
        "border-warm": "rgba(255,176,102,.45)",
        "text": "#F7F3EE",
        "text-soft": "rgba(255,255,255,.78)",
        "text-muted": "rgba(255,255,255,.6)",
        "accent": "var(--pt-color-brand-orange)",
        "accent-text": "var(--pt-color-brand-orange-light)",
        "on-accent": "var(--pt-color-brand-ink)",
        "inverse": "var(--pt-color-brand-cream)",
        "on-inverse": "var(--pt-color-brand-ink)",
        "focus": "var(--pt-color-brand-orange-light)",
    },
}


def build_css():
    lines = ["/* peptalk design tokens · generado por brand/scripts/build.py desde tokens.json. No editar a mano. */", "",
             "@font-face { font-family: \"Inter\"; font-style: normal; font-weight: 100 900; font-display: swap; src: url(\"../fonts/InterVariable.woff2\") format(\"woff2\"); }", "",
             ":root {"]
    for path, value, kind in flatten(TOKENS):
        lines.append(f"  --pt-{'-'.join(path)}: {css_value(value, kind)};")
    lines.append("")
    lines.append("  /* semántica · tema claro */")
    lines += [f"  --pt-{k}: {v};" for k, v in SEMANTIC["light"].items()]
    lines.append("}")
    lines.append("")
    lines.append("[data-theme=\"dark\"] {")
    lines += [f"  --pt-{k}: {v};" for k, v in SEMANTIC["dark"].items()]
    lines.append("}")
    (ROOT / "tokens/tokens.css").write_text("\n".join(lines) + "\n")


def build_tailwind():
    def group(prefix):
        return {"-".join(p[len(prefix):]) or "DEFAULT": f"var(--pt-{'-'.join(p)})"
                for p, _, _ in flatten(TOKENS) if p[:len(prefix)] == prefix}
    preset = {
        "theme": {
            "extend": {
                "colors": {
                    **{k: f"var(--pt-color-brand-{k})" for k in TOKENS["color"]["brand"] if not k.startswith("$")},
                    **{k: f"var(--pt-color-support-{k})" for k in TOKENS["color"]["support"] if not k.startswith("$")},
                    **{k: f"var(--pt-{k})" for k in SEMANTIC["light"]},
                },
                "fontFamily": {"sans": "var(--pt-font-family-sans)"},
                "fontSize": group(("font", "size")),
                "fontWeight": group(("font", "weight")),
                "letterSpacing": group(("font", "tracking")),
                "lineHeight": group(("font", "leading")),
                "spacing": group(("space",)),
                "borderRadius": group(("radius",)),
                "boxShadow": group(("shadow",)),
                "backgroundImage": {f"pt-{k}": f"var(--pt-gradient-{k})" for k in TOKENS["gradient"] if not k.startswith("$")},
                "transitionTimingFunction": {"pt": "var(--pt-motion-ease)"},
                "maxWidth": {"container": "var(--pt-layout-container)"},
            }
        }
    }
    body = json.dumps(preset, indent=2, ensure_ascii=False)
    (ROOT / "tokens/tailwind.preset.js").write_text(
        "/* peptalk · preset de Tailwind. Requiere importar tokens.css. Generado por build.py. */\n"
        f"module.exports = {body};\n")


# -------------------------------------------------------------- wordmark ----

def wordmark(text="peptalk", tracking=-0.045, font_path=FONT):
    """Compone el texto con harfbuzz (kerning de Inter) y lo pasa a trazos.
    Devuelve (path_d, ancho, ascender, descender) en unidades de 1 em = 1000."""
    blob = hb.Blob.from_file_path(str(font_path))
    face = hb.Face(blob)
    font = hb.Font(face)
    buf = hb.Buffer()
    buf.add_str(text)
    buf.guess_segment_properties()
    hb.shape(font, buf, {"kern": True, "liga": True})

    tt = TTFont(str(font_path))
    upem = tt["head"].unitsPerEm
    glyphs = tt.getGlyphSet()
    order = tt.getGlyphOrder()
    scale = 1000 / upem
    pen = SVGPathPen(glyphs, ntos=lambda n: f"{n:.1f}".rstrip("0").rstrip("."))
    x = 0
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        name = order[info.codepoint]
        glyphs[name].draw(TransformPen(pen, (scale, 0, 0, -scale, x + pos.x_offset * scale, 0)))
        x += pos.x_advance * scale + tracking * 1000
    width = x - tracking * 1000
    os2 = tt["OS/2"]
    return pen.getCommands(), width, os2.sCapHeight * scale, tt["hhea"].descent * scale


# --------------------------------------------------------------- isotipo ----

def metaball(c1, r1, c2, r2, v=0.5, handle=2.4):
    """Puente suave entre dos círculos (técnica de metaball de Paper.js)."""
    d = math.dist(c1, c2)
    u1 = u2 = 0
    if d < r1 + r2:
        u1 = math.acos((r1 * r1 + d * d - r2 * r2) / (2 * r1 * d))
        u2 = math.acos((r2 * r2 + d * d - r1 * r1) / (2 * r2 * d))
    between = math.atan2(c2[1] - c1[1], c2[0] - c1[0])
    spread = math.acos((r1 - r2) / d)
    a1 = between + u1 + (spread - u1) * v
    a2 = between - u1 - (spread - u1) * v
    a3 = between + math.pi - u2 - (math.pi - u2 - spread) * v
    a4 = between - math.pi + u2 + (math.pi - u2 - spread) * v
    pt = lambda c, r, a: (c[0] + r * math.cos(a), c[1] + r * math.sin(a))
    p1, p2, p3, p4 = pt(c1, r1, a1), pt(c1, r1, a2), pt(c2, r2, a3), pt(c2, r2, a4)
    d2 = min(v * handle, math.dist(p1, p3) / (r1 + r2)) * min(1, d * 2 / (r1 + r2))
    h1, h2 = pt(p1, r1 * d2, a1 - math.pi / 2), pt(p2, r1 * d2, a2 + math.pi / 2)
    h3, h4 = pt(p3, r2 * d2, a3 + math.pi / 2), pt(p4, r2 * d2, a4 - math.pi / 2)
    f = lambda p: f"{p[0]:.2f} {p[1]:.2f}"
    return f"M{f(p1)} C{f(h1)} {f(h3)} {f(p3)} L{f(p4)} C{f(h4)} {f(h2)} {f(p2)} Z"


# Geometría en un lienzo de 240 × 200. La esfera define el área de respeto.
ISO_W, ISO_H = 240, 200
C1, R1 = (60, 118), 52     # gota grande, abajo a la izquierda
C2, R2 = (180, 58), 46     # gota de arriba a la derecha
C3, R3 = (142, 160), 37    # esfera
BRIDGE = metaball(C1, R1, C2, R2, v=0.42, handle=2.4)


def iso_defs(uid):
    g = TOKENS["gradient"]
    stop = lambda s: f'<stop offset="{s["position"]}" stop-color="{s["color"]}"/>'
    return f"""
    <linearGradient id="{uid}-body" x1="212" y1="20" x2="20" y2="176" gradientUnits="userSpaceOnUse">{''.join(stop(s) for s in g['isotipo']['$value'])}</linearGradient>
    <radialGradient id="{uid}-sphere" cx="{C3[0] - 14}" cy="{C3[1] - 16}" r="{R3 * 1.6}" fx="{C3[0] - 18}" fy="{C3[1] - 20}" gradientUnits="userSpaceOnUse">{''.join(stop(s) for s in g['sphere']['$value'])}</radialGradient>
    <radialGradient id="{uid}-shade" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#C42A00" stop-opacity=".55"/><stop offset="1" stop-color="#C42A00" stop-opacity="0"/></radialGradient>
    <radialGradient id="{uid}-hi" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#FFF1DC" stop-opacity=".55"/><stop offset="1" stop-color="#FFF4E0" stop-opacity="0"/></radialGradient>
    <radialGradient id="{uid}-cast" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#A32400" stop-opacity=".45"/><stop offset="1" stop-color="#A32400" stop-opacity="0"/></radialGradient>
    <clipPath id="{uid}-clip"><circle cx="{C1[0]}" cy="{C1[1]}" r="{R1}"/><circle cx="{C2[0]}" cy="{C2[1]}" r="{R2}"/><path d="{BRIDGE}"/></clipPath>"""


def iso_body(uid):
    return f"""
  <g clip-path="url(#{uid}-clip)">
    <rect width="{ISO_W}" height="{ISO_H}" fill="url(#{uid}-body)"/>
    <ellipse cx="{C1[0] + 4}" cy="{C1[1] + 30}" rx="62" ry="40" fill="url(#{uid}-shade)"/>
    <ellipse cx="{C2[0] + 22}" cy="{C2[1] + 32}" rx="44" ry="30" fill="url(#{uid}-shade)" opacity=".7"/>
    <ellipse cx="{C3[0] - 4}" cy="{C3[1] - 18}" rx="40" ry="26" fill="url(#{uid}-cast)"/>
    <ellipse cx="{C1[0] - 16}" cy="{C1[1] - 22}" rx="34" ry="22" fill="url(#{uid}-hi)" transform="rotate(-30 {C1[0] - 16} {C1[1] - 22})"/>
    <ellipse cx="{C2[0] - 12}" cy="{C2[1] - 22}" rx="32" ry="20" fill="url(#{uid}-hi)" transform="rotate(-30 {C2[0] - 12} {C2[1] - 22})"/>
  </g>
  <circle cx="{C3[0]}" cy="{C3[1]}" r="{R3}" fill="url(#{uid}-sphere)"/>
  <ellipse cx="{C3[0] - 12}" cy="{C3[1] - 14}" rx="15" ry="10" fill="url(#{uid}-hi)" opacity=".7" transform="rotate(-35 {C3[0] - 12} {C3[1] - 14})"/>"""


def svg(w, h, defs, body, title):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:g} {h:g}" width="{w:g}" height="{h:g}" role="img" aria-label="{title}">'
            f"<title>{title}</title><defs>{defs}</defs>{body}</svg>\n")


def place_iso(uid, x, y, size_h):
    """Isotipo escalado a alto size_h, con esquina superior izquierda en (x, y)."""
    s = size_h / ISO_H
    return f'<g transform="translate({x:.2f} {y:.2f}) scale({s:.4f})">{iso_body(uid)}</g>'


WM_PATH, WM_W, WM_CAP, WM_DESC = wordmark()


def place_wordmark(x, baseline, cap_h, fill):
    s = cap_h / WM_CAP
    return f'<path transform="translate({x:.2f} {baseline:.2f}) scale({s:.4f})" fill="{fill}" d="{WM_PATH}"/>', WM_W * s


def lockup(text_fill):
    """Logo horizontal: isotipo + logotipo. Proporciones tomadas de la guía."""
    iso_h = 200
    cap = iso_h * 0.42                 # alto de mayúscula del logotipo
    gap = iso_h * 0.16
    iso_w = ISO_W * iso_h / ISO_H
    baseline = iso_h * 0.66
    wm, wm_w = place_wordmark(iso_w + gap, baseline, cap, text_fill)
    w = iso_w + gap + wm_w
    return w, iso_h, place_iso("pt", 0, 0, iso_h) + wm


def write(rel, content):
    path = ROOT / rel
    path.write_text(content)
    return path


# ----------------------------------------------------------- piezas ----

INK, CREAM, PAPER, NIGHT = color("brand.ink"), color("brand.cream"), color("support.paper"), color("support.night")


def build_logos():
    out = []
    w, h, body = lockup(INK)
    out.append(write("logo/peptalk-logo.svg", svg(w, h, iso_defs("pt"), body, "peptalk")))
    w, h, body = lockup("#FFFFFF")
    out.append(write("logo/peptalk-logo-white.svg", svg(w, h, iso_defs("pt"), body, "peptalk")))
    out.append(write("logo/peptalk-isotipo.svg", svg(ISO_W, ISO_H, iso_defs("pt"), iso_body("pt"), "peptalk")))

    # Logotipo solo (sin isotipo), para banners como en la guía.
    for name, fill in (("peptalk-logotipo.svg", INK), ("peptalk-logotipo-white.svg", "#FFFFFF")):
        cap = 100
        p, ww = place_wordmark(0, cap, cap, fill)
        desc = -WM_DESC * cap / WM_CAP
        out.append(write("logo/" + name, svg(ww, cap + desc, "", p, "peptalk")))

    # Íconos de app: isotipo centrado en cuadrado con radio 22,5 %.
    for name, bg, glow in (("peptalk-icon-dark.svg", "#0B0908", True), ("peptalk-icon-light.svg", CREAM, False)):
        S = 1024
        r = S * 0.225
        iso_h = S * 0.5
        iso_w = ISO_W * iso_h / ISO_H
        halo = ('<radialGradient id="halo" cx="0.5" cy="0.52" r="0.5"><stop offset="0" stop-color="#FF6A00" stop-opacity=".38"/><stop offset="1" stop-color="#FF6A00" stop-opacity="0"/></radialGradient>'
                if glow else "")
        body = (f'<rect width="{S}" height="{S}" rx="{r}" fill="{bg}"/>' +
                (f'<rect width="{S}" height="{S}" rx="{r}" fill="url(#halo)"/>' if glow else
                 f'<rect x="1" y="1" width="{S - 2}" height="{S - 2}" rx="{r}" fill="none" stroke="{color("brand.amber")}" stroke-width="2"/>') +
                place_iso("pt", (S - iso_w) / 2, (S - iso_h) / 2 + S * 0.01, iso_h))
        out.append(write("logo/" + name, svg(S, S, iso_defs("pt") + halo, body, "peptalk")))
    return out


def arcs(w, h, theme):
    """Fondo de marca: arcos de planeta con borde incandescente, como en la guía."""
    if theme == "dark":
        base, inner, rim, edge, glow = NIGHT, "#2A0E03", "#FF5A00", "#FFC27A", "#FF6A00"
    elif theme == "light":
        base, inner, rim, edge, glow = color("brand.cream"), "#FFE4C6", "#FFB066", "#FFFFFF", "#FFB066"
    else:  # orange
        base, inner, rim, edge, glow = "#1A0A04", "#FF7A12", "#FF5200", "#FFD08A", "#FF6A00"
    big = max(w, h)
    circles = [  # (cx, cy, r) relativos al lado mayor
        (-0.18 * big, h + 0.62 * big, 1.05 * big),
        (w + 0.30 * big, -0.48 * big, 0.80 * big),
    ]
    defs = (f'<radialGradient id="fill" cx="0.5" cy="0.5" r="0.5">'
            f'<stop offset="0" stop-color="{inner}" stop-opacity="0"/><stop offset=".86" stop-color="{inner}"/>'
            f'<stop offset=".965" stop-color="{rim}"/><stop offset=".995" stop-color="{edge}"/><stop offset="1" stop-color="{edge}"/></radialGradient>'
            f'<filter id="blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="{big * 0.018:.1f}"/></filter>'
            f'<radialGradient id="vignette" cx="0.5" cy="0.45" r="0.75"><stop offset=".55" stop-color="{base}" stop-opacity="0"/><stop offset="1" stop-color="{base}" stop-opacity=".55"/></radialGradient>')
    body = f'<rect width="{w}" height="{h}" fill="{base}"/>'
    for cx, cy, r in circles:
        body += f'<circle cx="{cx:.0f}" cy="{cy:.0f}" r="{r:.0f}" fill="none" stroke="{glow}" stroke-width="{big * 0.03:.0f}" opacity=".55" filter="url(#blur)"/>'
        body += f'<circle cx="{cx:.0f}" cy="{cy:.0f}" r="{r:.0f}" fill="url(#fill)"/>'
    body += f'<rect width="{w}" height="{h}" fill="url(#vignette)"/>'
    return defs, body


def build_backgrounds():
    out = []
    for theme in ("dark", "light", "orange"):
        defs, body = arcs(1920, 1080, theme)
        out.append(write(f"backgrounds/peptalk-bg-{theme}.svg", svg(1920, 1080, defs, body, f"Fondo peptalk {theme}")))
    return out


def build_applications():
    out = []
    # Banner X / redes 1500 × 500: logotipo blanco centrado sobre fondo oscuro.
    W, H = 1500, 500
    defs, body = arcs(W, H, "dark")
    cap = 70
    p, ww = place_wordmark(0, 0, cap, "#FFFFFF")
    body += f'<g transform="translate({(W - ww) / 2:.1f} {H / 2 + cap / 2:.1f})">{p}</g>'
    out.append(write("applications/x-banner-1500x500.svg", svg(W, H, defs, body, "peptalk")))

    # Foto de perfil 400 × 400: círculo negro con isotipo.
    S = 400
    halo = '<radialGradient id="halo" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#FF6A00" stop-opacity=".35"/><stop offset="1" stop-color="#FF6A00" stop-opacity="0"/></radialGradient>'
    iso_h = S * 0.5
    iso_w = ISO_W * iso_h / ISO_H
    body = (f'<circle cx="{S / 2}" cy="{S / 2}" r="{S / 2}" fill="#0B0908"/><circle cx="{S / 2}" cy="{S / 2}" r="{S / 2}" fill="url(#halo)"/>'
            + place_iso("pt", (S - iso_w) / 2, (S - iso_h) / 2, iso_h))
    out.append(write("applications/avatar-400.svg", svg(S, S, iso_defs("pt") + halo, body, "peptalk")))

    # Portada de presentación 1920 × 1080 y OG 1200 × 630: logo completo sobre fondo claro.
    for name, W, H, scale in (("presentation-1920x1080.svg", 1920, 1080, 0.24), ("og-1200x630.svg", 1200, 630, 0.25)):
        defs, body = arcs(W, H, "light")
        lw, lh, logo = lockup(INK)
        s = H * scale / lh
        body += f'<g transform="translate({(W - lw * s) / 2:.1f} {(H - lh * s) / 2 - (H * 0.04 if name.startswith("og") else 0):.1f}) scale({s:.4f})">{logo}</g>'
        if name.startswith("og"):
            tag_cap = 22
            # subtítulo en Inter SemiBold pasado a trazos
            d, tw, tcap, _ = wordmark("Biblioteca de péptidos · Argentina", 0, ROOT / "fonts/Inter-SemiBold.otf")
            ts = tag_cap / tcap
            body += f'<path transform="translate({(W - tw * ts) / 2:.1f} {H * 0.78:.0f}) scale({ts:.4f})" fill="{color("brand.gray")}" d="{d}"/>'
        out.append(write("applications/" + name, svg(W, H, iso_defs("pt") + defs, body, "peptalk")))
    return out


# ------------------------------------------------------------------ PNG ----

def render_png(svg_path, sizes, scale=1):
    """Renderiza un SVG con Chrome headless. sizes = [(sufijo, ancho)]."""
    vb = re.search(r'viewBox="0 0 ([\d.]+) ([\d.]+)"', svg_path.read_text())
    vw, vh = float(vb.group(1)), float(vb.group(2))
    fonts = (ROOT / "fonts/InterVariable.woff2").as_uri()
    for suffix, width in sizes:
        height = round(width * vh / vw)
        out = svg_path.with_name(svg_path.stem + suffix + ".png")
        with tempfile.TemporaryDirectory() as tmp:
            html = Path(tmp) / "r.html"
            html.write_text(f"""<!doctype html><style>@font-face{{font-family:Inter;src:url({fonts})}}
              html,body{{margin:0;background:transparent}}img{{display:block;width:{width}px;height:{height}px}}</style>
              <img src="{svg_path.as_uri()}">""")
            subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--allow-file-access-from-files",
                            f"--force-device-scale-factor={scale}", "--default-background-color=00000000",
                            f"--window-size={width},{height}", f"--screenshot={out}", html.as_uri()],
                           check=True, capture_output=True, timeout=60)


def main():
    build_css()
    build_tailwind()
    logos = build_logos()
    bgs = build_backgrounds()
    apps = build_applications()
    print(f"tokens: tokens.css, tailwind.preset.js · {len(logos)} logos · {len(bgs)} fondos · {len(apps)} aplicaciones")
    if "--no-png" in sys.argv or not Path(CHROME).exists():
        return
    for p in logos:
        if "icon" in p.name:
            render_png(p, [("-1024", 1024), ("-512", 512), ("-180", 180), ("-32", 32)])
        elif "isotipo" in p.name:
            render_png(p, [("", 480), ("@2x", 960)])
        else:
            render_png(p, [("", 800), ("@2x", 1600)])
    for p in bgs + apps:
        vb = re.search(r'viewBox="0 0 ([\d.]+)', p.read_text())
        render_png(p, [("", int(float(vb.group(1))))])
    print("PNG listos")


if __name__ == "__main__":
    main()
