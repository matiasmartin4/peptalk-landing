"""Genera assets/body.svg: cuerpo humano de frente con órganos por sistema.

Cada sistema es un <g data-sys="..."> con sus órganos. app.js calcula la
posición de cada punto a partir de la geometría del grupo (o de su elemento
.anchor), así que nada depende de coordenadas fijas en el JS.

Uso: python3 scripts/body.py
"""
from pathlib import Path

CX = 200
W, H = 400, 900


def catmull(points, closed=True, t=1.0):
    """Curva suave que pasa por todos los puntos (Catmull-Rom → Bézier)."""
    n = len(points)
    f = lambda p: f"{p[0]:.1f} {p[1]:.1f}"
    d = f"M{f(points[0])}"
    last = n if closed else n - 1
    for i in range(last):
        p0 = points[(i - 1) % n] if closed or i > 0 else points[i]
        p1, p2 = points[i], points[(i + 1) % n]
        p3 = points[(i + 2) % n] if closed or i + 2 < n else p2
        c1 = (p1[0] + (p2[0] - p0[0]) / 6 * t, p1[1] + (p2[1] - p0[1]) / 6 * t)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6 * t, p2[1] - (p3[1] - p1[1]) / 6 * t)
        d += f" C{f(c1)} {f(c2)} {f(p2)}"
    return d + (" Z" if closed else "")


def mirror(pts):
    return [(2 * CX - x, y) for x, y in pts]


def sym(half, closed=True):
    """Media figura (del eje hacia la derecha) → figura completa simétrica."""
    right = [(CX + dx, y) for dx, y in half]
    left = mirror(right[1:-1])[::-1]
    return catmull(right + left, closed)


def pair(pts, closed=True):
    """Órgano par: devuelve el de la derecha y su espejo."""
    return catmull(pts, closed), catmull(mirror(pts), closed)


# ---------------------------------------------------------------- silueta ---
# (distancia al eje, altura). Proporción ≈ 7,2 cabezas.
SILHOUETTE = [
    (0, 18), (24, 22), (38, 36), (44, 58), (45, 80), (42, 100), (36, 118), (27, 130), (19, 138),
    (18, 152), (19, 166),                                    # cuello
    (38, 180), (64, 189), (90, 198),                         # trapecio
    (106, 212), (115, 236), (117, 262),                      # deltoides
    (118, 296), (121, 330),                                  # brazo
    (127, 352), (134, 388), (141, 420),                      # antebrazo
    (146, 436), (152, 456), (153, 478), (147, 496), (137, 504), (129, 496), (126, 476), (124, 458), (121, 444),  # mano
    (115, 422), (106, 388), (99, 354), (94, 330),            # antebrazo interno
    (91, 300), (87, 272), (83, 252),                         # axila
    (80, 268), (78, 300), (73, 336), (70, 364), (74, 392), (83, 420), (88, 448),  # torso y cadera
    (89, 480), (86, 520), (80, 566), (73, 608), (72, 634),   # muslo
    (76, 664), (77, 700), (70, 746), (60, 792), (54, 824),   # pantorrilla
    (60, 840), (62, 856), (52, 866), (34, 868), (22, 862), (20, 846), (23, 826),  # pie
    (22, 790), (18, 746), (16, 700), (18, 664), (17, 634),   # pierna interna
    (15, 596), (12, 550), (8, 506), (3, 478), (0, 470),
]
BODY = sym(SILHOUETTE)

# Líneas de definición muscular (siempre tenues, dan volumen).
DEFINITION = [
    catmull([(CX - 4, 190), (CX - 30, 194), (CX - 58, 200)], False),          # clavículas
    catmull([(CX + 4, 190), (CX + 30, 194), (CX + 58, 200)], False),
    catmull([(CX - 72, 236), (CX - 52, 262), (CX - 22, 268), (CX - 3, 258)], False),  # pectorales
    catmull([(CX + 72, 236), (CX + 52, 262), (CX + 22, 268), (CX + 3, 258)], False),
    catmull([(CX, 270), (CX, 420)], False),                                  # línea alba
    catmull([(CX - 34, 300), (CX - 22, 304), (CX - 8, 302)], False),         # abdominales
    catmull([(CX + 34, 300), (CX + 22, 304), (CX + 8, 302)], False),
    catmull([(CX - 32, 336), (CX - 20, 339), (CX - 8, 338)], False),
    catmull([(CX + 32, 336), (CX + 20, 339), (CX + 8, 338)], False),
    catmull([(CX - 62, 380), (CX - 40, 420), (CX - 14, 456)], False),        # ingle
    catmull([(CX + 62, 380), (CX + 40, 420), (CX + 14, 456)], False),
    catmull([(CX - 62, 520), (CX - 50, 580), (CX - 42, 622)], False),        # cuádriceps
    catmull([(CX + 62, 520), (CX + 50, 580), (CX + 42, 622)], False),
    catmull([(CX - 98, 232), (CX - 96, 262)], False),                        # deltoides
    catmull([(CX + 98, 232), (CX + 96, 262)], False),
]
NAVEL = (CX, 382)

# ---------------------------------------------------------------- órganos ---
BRAIN_L = catmull([(CX - 2, 36), (CX - 20, 34), (CX - 34, 46), (CX - 37, 64), (CX - 30, 82), (CX - 14, 90), (CX - 2, 86)], True)
BRAIN_R = catmull(mirror([(CX - 2, 36), (CX - 20, 34), (CX - 34, 46), (CX - 37, 64), (CX - 30, 82), (CX - 14, 90), (CX - 2, 86)]), True)
GYRI = [
    catmull([(CX - 28, 52), (CX - 18, 48), (CX - 22, 60), (CX - 10, 58)], False),
    catmull([(CX - 30, 70), (CX - 20, 66), (CX - 24, 78), (CX - 12, 74)], False),
    catmull([(CX + 28, 52), (CX + 18, 48), (CX + 22, 60), (CX + 10, 58)], False),
    catmull([(CX + 30, 70), (CX + 20, 66), (CX + 24, 78), (CX + 12, 74)], False),
]
SPINAL = catmull([(CX, 92), (CX, 180), (CX + 1, 300), (CX, 440)], False)
NERVES = [catmull([(CX, 200), (CX - 40, 214), (CX - 96, 240), (CX - 110, 330), (CX - 132, 430)], False),
          catmull([(CX, 200), (CX + 40, 214), (CX + 96, 240), (CX + 110, 330), (CX + 132, 430)], False),
          catmull([(CX - 4, 440), (CX - 30, 520), (CX - 44, 640), (CX - 44, 820)], False),
          catmull([(CX + 4, 440), (CX + 30, 520), (CX + 44, 640), (CX + 44, 820)], False)]

THYROID = catmull([(CX - 2, 166), (CX - 9, 158), (CX - 12, 166), (CX - 10, 176), (CX - 3, 177), (CX, 172), (CX + 3, 177), (CX + 10, 176), (CX + 12, 166), (CX + 9, 158), (CX + 2, 166)], True)
PITUITARY = (CX, 84, 3.5)
ADRENALS = pair([(CX - 34, 352), (CX - 28, 340), (CX - 20, 350)])
PANCREAS = catmull([(CX - 8, 372), (CX + 10, 364), (CX + 34, 360), (CX + 46, 364), (CX + 34, 372), (CX + 12, 376)], True)

LUNG_R = catmull([(CX - 8, 214), (CX - 24, 220), (CX - 44, 238), (CX - 54, 274), (CX - 56, 312), (CX - 44, 326), (CX - 20, 320), (CX - 10, 300), (CX - 8, 250)], True)
LUNG_L = catmull([(CX + 8, 214), (CX + 24, 220), (CX + 44, 238), (CX + 54, 274), (CX + 56, 312), (CX + 44, 326), (CX + 30, 322), (CX + 28, 300), (CX + 14, 286), (CX + 8, 250)], True)
TRACHEA = catmull([(CX, 166), (CX, 214)], False)

HEART = catmull([(CX + 2, 256), (CX + 14, 252), (CX + 28, 262), (CX + 32, 282), (CX + 22, 300), (CX + 6, 306), (CX - 8, 298), (CX - 14, 280), (CX - 8, 262)], True)
AORTA = catmull([(CX + 6, 258), (CX + 4, 236), (CX - 8, 232), (CX - 6, 260), (CX - 3, 320), (CX - 2, 440)], False)
ARTERIES = [
    catmull([(CX - 2, 440), (CX - 22, 470), (CX - 36, 560), (CX - 40, 650), (CX - 38, 820)], False),
    catmull([(CX - 2, 440), (CX + 22, 470), (CX + 36, 560), (CX + 40, 650), (CX + 38, 820)], False),
    catmull([(CX - 6, 236), (CX - 34, 210), (CX - 88, 226), (CX - 104, 300), (CX - 118, 380), (CX - 134, 460)], False),
    catmull([(CX + 4, 236), (CX + 34, 210), (CX + 88, 226), (CX + 104, 300), (CX + 118, 380), (CX + 134, 460)], False),
    catmull([(CX - 4, 232), (CX - 12, 180), (CX - 16, 140)], False),
    catmull([(CX + 4, 232), (CX + 12, 180), (CX + 16, 140)], False),
]

THYMUS = catmull([(CX, 222), (CX - 8, 220), (CX - 12, 232), (CX - 6, 246), (CX, 240), (CX + 6, 246), (CX + 12, 232), (CX + 8, 220)], True)
SPLEEN = catmull([(CX + 46, 330), (CX + 58, 334), (CX + 62, 350), (CX + 54, 360), (CX + 46, 350)], True)
NODES = [(CX - 16, 160), (CX + 16, 160), (CX - 22, 152), (CX + 22, 152), (CX - 78, 258), (CX + 78, 258), (CX - 72, 268), (CX + 72, 268),
         (CX - 38, 452), (CX + 38, 452), (CX - 30, 462), (CX + 30, 462)]

LIVER = catmull([(CX - 58, 322), (CX - 30, 314), (CX + 2, 316), (CX + 20, 326), (CX + 8, 340), (CX - 22, 356), (CX - 50, 366), (CX - 62, 350)], True)
STOMACH = catmull([(CX + 10, 324), (CX + 26, 320), (CX + 44, 332), (CX + 48, 354), (CX + 38, 376), (CX + 18, 384), (CX + 6, 378), (CX + 16, 366), (CX + 28, 356), (CX + 24, 340), (CX + 12, 336)], True)
ESOPHAGUS = catmull([(CX + 1, 170), (CX + 2, 250), (CX + 8, 300), (CX + 14, 326)], False)
COLON = catmull([(CX - 12, 446), (CX - 42, 440), (CX - 46, 410), (CX - 44, 386), (CX - 20, 382), (CX + 20, 382), (CX + 44, 386), (CX + 46, 412), (CX + 40, 438), (CX + 18, 446), (CX + 6, 456)], False)
SMALL_INT = catmull([(CX - 30, 396), (CX + 28, 396), (CX + 30, 406), (CX - 28, 408), (CX - 30, 418), (CX + 30, 418), (CX + 28, 428), (CX - 24, 430)], False)
KIDNEYS = pair([(CX - 30, 356), (CX - 40, 362), (CX - 44, 380), (CX - 38, 396), (CX - 28, 396), (CX - 24, 378)])

BLADDER = catmull([(CX, 446), (CX - 14, 450), (CX - 16, 464), (CX - 6, 472), (CX + 6, 472), (CX + 16, 464), (CX + 14, 450)], True)
GONADS = [(CX - 18, 476, 5.5), (CX + 18, 476, 5.5)]
REPRO_DUCTS = [catmull([(CX - 14, 458), (CX - 22, 466), (CX - 18, 476)], False), catmull([(CX + 14, 458), (CX + 22, 466), (CX + 18, 476)], False)]

# esqueleto
VERTEBRAE = [(CX, y) for y in range(186, 452, 13)]
RIBS = []
for i, y in enumerate(range(218, 318, 16)):
    w = 40 + i * 2.6 - (i > 3) * (i - 3) * 4
    RIBS += [catmull([(CX - 4, y), (CX - w * .6, y - 6), (CX - w, y + 8), (CX - w * .9, y + 22)], False),
             catmull([(CX + 4, y), (CX + w * .6, y - 6), (CX + w, y + 8), (CX + w * .9, y + 22)], False)]
STERNUM = catmull([(CX, 202), (CX, 296)], False)
PELVIS = catmull([(CX - 8, 470), (CX - 30, 462), (CX - 58, 428), (CX - 62, 414), (CX - 40, 420), (CX - 16, 440), (CX, 446), (CX + 16, 440), (CX + 40, 420), (CX + 62, 414), (CX + 58, 428), (CX + 30, 462), (CX + 8, 470)], True)
BONES = [
    ((CX - 56, 478), (CX - 44, 630)), ((CX + 56, 478), (CX + 44, 630)),      # fémur
    ((CX - 44, 652), (CX - 40, 820)), ((CX + 44, 652), (CX + 40, 820)),      # tibia
    ((CX - 102, 220), (CX - 108, 336)), ((CX + 102, 220), (CX + 108, 336)),  # húmero
    ((CX - 110, 352), (CX - 130, 430)), ((CX + 110, 352), (CX + 130, 430)),  # radio
]
PATELLA = [(CX - 45, 640, 7), (CX + 45, 640, 7)]

SKIN_PATCH = catmull([(CX + 118, 380), (CX + 130, 384), (CX + 132, 398), (CX + 122, 404), (CX + 114, 396)], True)


# ------------------------------------------------------------------- SVG ----

def p(d, cls="o"):
    return f'<path class="{cls}" d="{d}"/>'


def c(x, y, r, cls="o"):
    return f'<circle class="{cls}" cx="{x:.1f}" cy="{y:.1f}" r="{r}"/>'


def line(a, b, cls="o"):
    return f'<line class="{cls}" x1="{a[0]:.1f}" y1="{a[1]:.1f}" x2="{b[0]:.1f}" y2="{b[1]:.1f}"/>'


def group(sys, label, inner):
    return f'<g class="sys" data-sys="{sys}" aria-label="{label}">{inner}</g>'


def build():
    defs = """
  <linearGradient id="bdSkin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3B2C24"/><stop offset=".5" stop-color="#2A201B"/><stop offset="1" stop-color="#1B1512"/></linearGradient>
  <radialGradient id="bdLight" cx=".5" cy=".32" r=".5"><stop offset="0" stop-color="#FFD8AB" stop-opacity=".16"/><stop offset="1" stop-color="#FFD8AB" stop-opacity="0"/></radialGradient>
  <linearGradient id="bdEdge" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".45"/><stop offset=".22" stop-color="#000" stop-opacity="0"/><stop offset=".78" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".45"/></linearGradient>
  <linearGradient id="bdHot" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFC66B"/><stop offset=".5" stop-color="#FF7A12"/><stop offset="1" stop-color="#E63B00"/></linearGradient>
  <radialGradient id="bdFloor" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FF6A00" stop-opacity=".5"/><stop offset="1" stop-color="#FF6A00" stop-opacity="0"/></radialGradient>
  <filter id="bdGlow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <clipPath id="bdClip"><path d="BODY"/></clipPath>""".replace("BODY", BODY)

    skin = (p(BODY, "skin-fill") + f'<g clip-path="url(#bdClip)"><rect width="{W}" height="{H}" fill="url(#bdLight)"/><rect width="{W}" height="{H}" fill="url(#bdEdge)"/></g>')
    detail = "".join(p(d, "def") for d in DEFINITION) + c(*NAVEL, 2.2, "def")
    context = p(LUNG_R, "ctx") + p(LUNG_L, "ctx") + p(TRACHEA, "ctx line") + "".join(p(d, "ctx") for d in KIDNEYS)

    systems = [
        group("cerebro", "Cerebro y sueño",
              p(BRAIN_L, "o anchor") + p(BRAIN_R) + "".join(p(d, "o line") for d in GYRI) + p(SPINAL, "o line") + "".join(p(d, "o line thin") for d in NERVES)),
        group("hormonas", "Hormonas y metabolismo",
              p(THYROID, "o anchor") + c(*PITUITARY) + "".join(p(d) for d in ADRENALS) + p(PANCREAS)),
        group("inmune", "Inmune y defensa",
              p(THYMUS, "o anchor") + p(SPLEEN) + "".join(c(x, y, 2.8) for x, y in NODES)),
        group("corazon", "Corazón y sangre",
              "".join(p(d, "o line thin") for d in ARTERIES) + p(AORTA, "o line") + p(HEART, "o anchor")),
        group("digestivo", "Digestivo y peso",
              p(ESOPHAGUS, "o line") + p(LIVER) + p(STOMACH, "o anchor") + p(COLON, "o line wide") + p(SMALL_INT, "o line")),
        group("sexual", "Sexual y reproductivo",
              p(BLADDER, "o anchor") + "".join(c(*g) for g in GONADS) + "".join(p(d, "o line") for d in REPRO_DUCTS)),
        group("huesos", "Huesos y músculo",
              p(STERNUM, "o line") + "".join(p(d, "o line thin") for d in RIBS) + "".join(f'<rect class="o" x="{x - 4}" y="{y - 4}" width="8" height="8" rx="2"/>' for x, y in VERTEBRAE)
              + p(PELVIS) + "".join(line(a, b, "o bone") for a, b in BONES) + "".join(c(*k, cls="o anchor" if i == 0 else "o") for i, k in enumerate(PATELLA))),
        group("piel", "Piel y envejecimiento", p(BODY, "o rim") + p(SKIN_PATCH, "o anchor")),
    ]
    floor = f'<ellipse cx="{CX}" cy="878" rx="130" ry="14" fill="url(#bdFloor)"/>'
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" class="body" role="group" aria-label="Cuerpo humano por sistemas">'
           f'<defs>{defs}</defs>{floor}<g class="skin">{skin}</g><g class="detail">{detail}</g><g class="context">{context}</g>'
           f'<g class="systems">{"".join(systems)}</g><g class="hotspots"></g></svg>\n')
    out = Path(__file__).resolve().parent.parent / "assets/body.svg"
    out.parent.mkdir(exist_ok=True)
    out.write_text(svg)
    print(out, len(svg) // 1024, "KB")


if __name__ == "__main__":
    build()
