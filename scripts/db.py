"""Puente entre research/peptides.json y la base del backoffice (Supabase).

  python3 scripts/db.py seed     # escribe supabase/seed.sql con las fichas actuales (carga inicial)
  python3 scripts/db.py export   # baja las fichas publicadas a research/peptides.json
                                 # (necesita SUPABASE_URL y SUPABASE_SERVICE_KEY en el entorno)

Después de export, scripts/peptides.py valida y regenera peptides.js como siempre.
"""
import json
import os
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "research/peptides.json"
SEED = ROOT / "supabase/seed.sql"


def lit(v):
    if v is None:
        return "null"
    if not isinstance(v, str):
        v = json.dumps(v, ensure_ascii=False)
    return "'" + v.replace("'", "''") + "'"


def seed():
    rows = []
    for i, p in enumerate(json.loads(SOURCE.read_text())):
        vals = [p["slug"], p["name"], p.get("alias", ""), p["sys"], p["type"], p["ev"], p.get("evNote", ""), p["summary"],
                p["status"], p.get("refs", []), p["checked"]]
        rows.append("(" + ", ".join(lit(v) for v in vals) + f", true, {i})")
    SEED.write_text("-- Generado por scripts/db.py seed desde research/peptides.json\n"
                    "insert into peptides (slug, name, alias, sys, type, ev, ev_note, summary, status, refs, checked, published, sort) values\n"
                    + ",\n".join(rows) + "\non conflict (slug) do nothing;\n")
    print(f"{len(rows)} fichas → {SEED.relative_to(ROOT)}")


def export():
    url, key = os.environ["SUPABASE_URL"].rstrip("/"), os.environ["SUPABASE_SERVICE_KEY"]
    req = urllib.request.Request(f"{url}/rest/v1/peptides?published=eq.true&order=sort.asc,name.asc&select=*",
                                 headers={"apikey": key, "Authorization": f"Bearer {key}"})
    rows = json.load(urllib.request.urlopen(req, timeout=30))
    out = [{"slug": r["slug"], "name": r["name"], "alias": r["alias"], "sys": r["sys"], "type": r["type"], "ev": r["ev"],
            "evNote": r["ev_note"], "summary": r["summary"], "status": r["status"], "refs": r["refs"], "checked": r["checked"]}
           for r in rows]
    SOURCE.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n")
    print(f"{len(out)} fichas publicadas → {SOURCE.relative_to(ROOT)}")


if __name__ == "__main__":
    {"seed": seed, "export": export}[sys.argv[1] if len(sys.argv) > 1 else ""]()
