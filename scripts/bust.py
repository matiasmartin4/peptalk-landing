"""Versiona por hash los CSS/JS para que el navegador no mezcle archivos viejos y nuevos.

Correr antes de cada commit que toque CSS o JS: python3 scripts/bust.py
"""
import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def h(rel):
    return hashlib.md5((ROOT / rel).read_bytes()).hexdigest()[:8]


def stamp(path, rels, base=""):
    text = (ROOT / path).read_text()
    for rel in rels:
        text = re.sub(re.escape(rel) + r"(\?v=[0-9a-f]+)?", f"{rel}?v={h(base + rel)}", text)
    (ROOT / path).write_text(text)


# app.js carga body3d.js: primero se versiona esa referencia y después app.js en el HTML.
stamp("app.js", ["body3d.js"])
stamp("index.html", ["brand/tokens/tokens.css", "styles.css", "data.js", "peptides.js", "app.js"])
stamp("admin/index.html", ["admin.css", "admin.js", "media.js", "newsletter.js", "config.js", "../data.js"], base="admin/")
print("ok")
