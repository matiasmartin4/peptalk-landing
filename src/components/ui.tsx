/* peptalk — piezas reutilizables de la landing. */
import { useEffect, useRef } from "react";
import { AGENCIES, PT, evInfo, host, statusCls, reduceMotion } from "../lib/catalog";
import type { Peptide } from "../lib/catalog";

export const Icon = ({ name, className }: { name: string; className?: string }) => (
  <svg className={`i${className ? " " + className : ""}`} aria-hidden="true"><use href={`/assets/icons.svg#${name}`} /></svg>
);

export const Dot = ({ v }: { v: string }) => <i className={`dot ${statusCls[v] || ""}`} />;

export const SysTile = ({ icon, size }: { icon: string; size?: "sm" | "lg" }) => (
  <span className={`sys-tile${size ? " " + size : ""}`}><Icon name={icon} /></span>
);

/* medidor de evidencia: 5 barras, A llena todo, E una, pendiente ninguna */
const EV_LEVEL: Record<string, number> = { A: 5, B: 4, C: 3, D: 2, E: 1, "—": 0 };
export function EvMeter({ ev, withLabel }: { ev: string; withLabel?: boolean }) {
  const lvl = EV_LEVEL[ev] ?? 0, info = evInfo[ev] || { name: "" };
  return (
    <span className={`ev-meter${lvl ? "" : " pending"}`} title={info.name}>
      <span className="bars">{[1, 2, 3, 4, 5].map((i) => <i key={i} className={i <= lvl ? "on" : ""} style={{ height: 6 + i * 3 }} />)}</span>
      {withLabel && <span className="ev-txt"><b>{lvl ? `Evidencia ${ev}` : "Evidencia"}</b><small>{info.name}</small></span>}
    </span>
  );
}

/* grilla de agencias: jurisdicción y estado; en la ficha, también nota y fuente */
export function AgencyGrid({ p, detail }: { p: Peptide; detail?: boolean }) {
  return (
    <div className={`ag-grid${detail ? " ag-detail" : ""}`}>
      {AGENCIES.map((a) => {
        const info = PT.agencyInfo[a], x = p.stInfo[a];
        return (
          <div className="ag-cell" key={a}>
            <span className="ag-h"><Icon name={info.icon} /><b>{a}</b><small>{info.name}</small></span>
            <span className="ag-v"><Dot v={p.st[a]} />{p.st[a]}</span>
            {detail && x && x.note && <p className="ag-note">{x.note}</p>}
            {detail && x && x.url && <a className="ag-src" href={x.url} target="_blank" rel="noopener"><Icon name="external-link" />{x.source || host(x.url)}</a>}
          </div>
        );
      })}
    </div>
  );
}

/* aparición suave al entrar en pantalla (nada si el sistema pide menos movimiento) */
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || reduceMotion || !("IntersectionObserver" in window)) return;
    el.classList.add("reveal");
    const io = new IntersectionObserver(([en]) => { if (en.isIntersecting) { el.classList.add("in"); io.disconnect(); } }, { rootMargin: "0px 0px -8% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}

export const loadScript = (src: string) =>
  new Promise<void>((ok, fail) => {
    if (document.querySelector(`script[src="${src}"]`)) return ok();
    const s = document.createElement("script");
    s.src = src; s.onload = () => ok(); s.onerror = fail;
    document.head.appendChild(s);
  });

export const scrollToId = (id: string) => document.getElementById(id)?.scrollIntoView();
