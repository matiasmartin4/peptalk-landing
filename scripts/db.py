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
SITE = ROOT / "research/site.json"


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

    def get(path):
        req = urllib.request.Request(f"{url}/rest/v1/{path}", headers={"apikey": key})  # clave secret (sb_secret_…): va sólo en apikey
        return json.load(urllib.request.urlopen(req, timeout=30))

    settings = {r["key"]: r["value"] for r in get("site_settings?select=key,value")}
    sec = settings.get("secciones", {})
    rows = get("peptides?published=eq.true&order=sort.asc,name.asc&select=*")
    media = {}
    for m in get("peptide_media?select=*&order=sort.asc,created_at.asc"):
        media.setdefault(m["slug"], []).append(m)
    public = f"{url}/storage/v1/object/public/media/"

    # El repo es público: acá sólo pasa lo que el sitio muestra. Lo oculto se queda en la base.
    out = []
    for r in rows:
        p = {"slug": r["slug"], "name": r["name"], "alias": r["alias"], "sys": r["sys"], "type": r["type"], "ev": r["ev"],
             "evNote": r["ev_note"], "summary": r["summary"], "status": r["status"], "refs": r["refs"], "checked": r["checked"]}
        if r["tags"]:
            p["tags"] = r["tags"]
        if sec.get("resumen_simple") and r["summary_plain"]:
            p["summaryPlain"] = r["summary_plain"]
        if sec.get("uso") and r["usage_process"]:
            p["usage"] = r["usage_process"]
        if sec.get("dosis") and r["dosing"] and r["dosing_reviewed_by"]:
            p["dosing"] = r["dosing"]
        if sec.get("especificaciones"):
            specs = {k: r[k] for k in ("cas_number", "molecular_formula", "molecular_weight", "sequence", "preparation_form", "storage") if r[k]}
            if specs:
                p["specs"] = specs
        items = media.get(r["slug"], [])
        if sec.get("imagenes"):
            imgs = [{"src": public + m["path"], "alt": m["alt"], "caption": m["caption"], "credit": m["credit"], "cover": m["is_cover"]}
                    for m in items if m["kind"] == "imagen"]
            if imgs:
                p["images"] = imgs
        if sec.get("videos"):
            vids = [{"url": m["url"], "caption": m["caption"]} for m in items if m["kind"] == "video"]
            if vids:
                p["videos"] = vids
        out.append(p)
    SOURCE.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n")
    SITE.write_text(json.dumps({"agencies": settings.get("agencias_visibles", ["ANMAT", "FDA", "EMA", "WADA"])},
                               ensure_ascii=False, indent=2) + "\n")
    print(f"{len(out)} fichas publicadas → {SOURCE.relative_to(ROOT)}")


if __name__ == "__main__":
    {"seed": seed, "export": export}[sys.argv[1] if len(sys.argv) > 1 else ""]()
