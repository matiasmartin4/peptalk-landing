"""Arma assets/icons.svg (sprite de Lucide) a partir de SVG sueltos de lucide-static.

Uso: python3 scripts/icons.py <carpeta-con-svgs>
En HTML: <svg class="i"><use href="assets/icons.svg#brain"/></svg>
Lucide · ISC License · https://lucide.dev
"""
import re
import sys
from pathlib import Path

src = Path(sys.argv[1])
out = ['<svg xmlns="http://www.w3.org/2000/svg"><!-- Lucide icons · ISC License · lucide.dev -->']
for f in sorted(src.glob("*.svg")):
    body = re.sub(r"<!--.*?-->", "", f.read_text(), flags=re.S)
    inner = re.search(r"<svg[^>]*>(.*)</svg>", body, re.S).group(1)
    inner = re.sub(r"\s+", " ", inner).strip()
    out.append(f'<symbol id="{f.stem}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">{inner}</symbol>')
out.append("</svg>")
dest = Path(__file__).resolve().parent.parent / "assets/icons.svg"
dest.write_text("\n".join(out) + "\n")
print(dest, len(out) - 2, "íconos")
