"""Versiona por hash los CSS/JS para que el navegador no mezcle archivos viejos y nuevos.

Correr antes de cada commit que toque los datos (data.js, peptides.js) o el backoffice: python3 scripts/bust.py
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


# La landing la compila Vite (sus archivos ya salen con hash); acá sólo los datos, que no pasan por Vite.
stamp("index.html", ["data.js", "peptides.js"])
stamp("admin/index.html", ["admin.css", "admin.js", "media.js", "newsletter.js", "config.js", "../data.js"], base="admin/")
print("ok")
