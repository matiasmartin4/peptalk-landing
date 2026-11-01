"""Une y valida la investigación de péptidos y genera peptides.js.

Fuente de verdad: research/peptides.json (una entrada por péptido, con estado por
agencia, fuente, evidencia, resumen y referencias). Si se pasan archivos de lotes,
se fusionan primero en ese JSON (por slug, el lote pisa lo anterior).

Uso:
  python3 scripts/peptides.py                       # valida y regenera peptides.js
  python3 scripts/peptides.py lote1.json lote2.json # fusiona lotes y regenera
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "research/peptides.json"
OUT = ROOT / "peptides.js"

AGENCIES = ["ANMAT", "FDA", "EMA", "WADA"]
STATUSES = {"Aprobado", "En investigación", "No aprobado", "Prohibido", "Cosmético", "No listado", "Pendiente"}
EVIDENCE = {"A", "B", "C", "D", "E", "—"}
TYPES = {"Péptido", "Análogo peptídico", "Polipéptido", "Cosmético"}
SYSTEMS = set(re.findall(r"\{ id: '([a-z]+)'", (ROOT / "data.js").read_text()))
# orden de la biblioteca: primero los del mockup original, después el resto alfabético
ORDER = ["bpc-157", "semaglutida", "tb-500", "ghk-cu", "tirzepatida", "epitalon", "timosina-alfa-1", "oxitocina", "kpv", "aod-9604",
         "fragmento-176-191", "selank", "semax", "dsip", "bremelanotida", "kisspeptina", "cjc-1295", "ipamorelina", "ll-37",
         "palmitoil-pentapeptido-4", "bivalirudina", "nesiritida"]


def validate(p):
    errs = []
    for k in ("slug", "name", "alias", "sys", "type", "ev", "summary", "status", "checked"):
        if not p.get(k):
            errs.append(f"falta {k}")
    if p.get("sys") not in SYSTEMS:
        errs.append(f"sistema desconocido {p.get('sys')}")
    if p.get("type") not in TYPES:
        errs.append(f"tipo {p.get('type')}")
    if p.get("ev") not in EVIDENCE:
        errs.append(f"evidencia {p.get('ev')}")
    for a in AGENCIES:
        s = (p.get("status") or {}).get(a)
        if not s:
            errs.append(f"{a}: sin estado")
            continue
        if s.get("v") not in STATUSES:
            errs.append(f"{a}: valor {s.get('v')}")
        if s.get("v") != "Pendiente" and not str(s.get("url", "")).startswith("http"):
            errs.append(f"{a}: estado sin URL de fuente")
        if a == "WADA" and s.get("v") not in {"Prohibido", "No listado", "Pendiente"}:
            errs.append(f"WADA: valor {s.get('v')}")
    for r in p.get("refs") or []:
        if not str(r.get("url", "")).startswith("http"):
            errs.append(f"referencia sin URL: {r.get('title')}")
    return errs


def main():
    data = json.loads(SOURCE.read_text()) if SOURCE.exists() else []
    by = {p["slug"]: p for p in data}
    for f in sys.argv[1:]:
        for p in json.loads(Path(f).read_text()):
            by[p["slug"]] = p
    items = sorted(by.values(), key=lambda p: (ORDER.index(p["slug"]) if p["slug"] in ORDER else len(ORDER), p["name"].lower()))

    bad = 0
    for p in items:
        errs = validate(p)
        if errs:
            bad += 1
            print(f"✗ {p.get('slug')}: " + "; ".join(errs))
    SOURCE.parent.mkdir(exist_ok=True)
    SOURCE.write_text(json.dumps(items, ensure_ascii=False, indent=2) + "\n")

    keep = ("slug", "name", "alias", "sys", "type", "ev", "evNote", "summary", "status", "refs", "checked")
    slim = [{k: p[k] for k in keep if k in p} for p in items]
    for p in slim:  # la web no usa 'confidence'; queda en research/peptides.json
        p["status"] = {a: {k: v for k, v in s.items() if k != "confidence"} for a, s in p["status"].items()}
    OUT.write_text("/* Generado por scripts/peptides.py desde research/peptides.json. No editar a mano. */\n"
                   "window.PT.peptides = " + json.dumps(slim, ensure_ascii=False, separators=(",", ":")) + ";\n")
    print(f"{len(items)} péptidos · {bad} con errores · {OUT.name} {OUT.stat().st_size // 1024} KB")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
