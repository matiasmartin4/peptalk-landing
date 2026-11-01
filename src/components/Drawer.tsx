/* Ficha completa en un panel lateral, enlazable por #p/<slug>. Atrapa el foco, cierra con
   Escape o tocando afuera; si se abrió desde la página, cerrar vuelve atrás en el historial. */
import { useEffect, useRef, useState } from "react";
import { AgencyGrid, EvMeter, Icon, SysTile, scrollToId } from "./ui";
import { AGENCIES, bySlug, fmtDate, host, pendingCount } from "../lib/catalog";
import { useStore } from "../lib/store";

const slugFromHash = () => (location.hash.match(/^#p\/([\w-]+)$/) || [])[1] || "";

export function Drawer() {
  const { setRefPep } = useStore();
  const [slug, setSlug] = useState(slugFromHash);
  const el = useRef<HTMLElement>(null), closeBtn = useRef<HTMLButtonElement>(null);
  const lastFocus = useRef<Element | null>(null);
  // si se entró por link directo, cerrar limpia el hash en vez de volver atrás (saldría del sitio)
  const cameFromPage = useRef(false);
  const p = slug ? bySlug[slug] : null;

  useEffect(() => {
    const onHash = () => { const s = slugFromHash(); if (s) cameFromPage.current = true; setSlug(s); };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const close = () => {
    if (cameFromPage.current) history.back();
    else { history.replaceState(null, "", location.pathname); setSlug(""); }
  };

  useEffect(() => {
    if (!p) return;
    lastFocus.current = document.activeElement;
    document.body.style.overflow = "hidden";
    closeBtn.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "Tab") {   // foco atrapado en la ficha
        const f = el.current!.querySelectorAll<HTMLElement>("a,button,input,select,textarea,[tabindex]");
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = "";
      (lastFocus.current as HTMLElement | null)?.focus?.();
    };
  }, [p]);

  const toReferral = (e: React.MouseEvent) => {
    e.preventDefault();
    setRefPep(p!.name);
    cameFromPage.current = false;
    history.replaceState(null, "", "#derivacion");
    setSlug("");
    setTimeout(() => scrollToId("derivacion"));
  };

  if (!p) return null;
  const pend = pendingCount(p);
  return (
    <>
      <div className="scrim" onClick={close} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="dTitle" ref={el}>
        <button className="drawer-x" aria-label="Cerrar ficha" onClick={close} ref={closeBtn}><Icon name="x" /></button>
        <div>
          <div className="d-hero">
            <Icon name={p.sysIcon} className="card-mark" />
            <div className="crumbs">Péptidos › {p.sysName}</div>
            <div className="d-id"><SysTile icon={p.sysIcon} size="lg" /><div><h2 id="dTitle">{p.name}</h2><div className="alias">{p.alias}</div></div></div>
            <div className="badges">
              <span className="tag"><Icon name={p.sysIcon} />{p.sysName}</span>
              <span className="tag tag-ghost"><Icon name="dna" />{p.type}</span>
              <span className="rev"><Icon name="stethoscope" />Pendiente de revisión médica</span>
            </div>
          </div>
          <div className="d-stats">
            <div><small>Evidencia</small><EvMeter ev={p.ev} withLabel /></div>
            <div><small>Estados con fuente</small><b className="big">{AGENCIES.length - pend}<span>/{AGENCIES.length}</span></b></div>
          </div>
          <div className="d-block">
            <h3><Icon name="book-open" />Resumen clave</h3>
            <p>{p.summary || `Ficha en preparación. Estamos reuniendo las fuentes primarias sobre ${p.name}.`}</p>
            {p.evNote && <p className="d-note"><Icon name="microscope" />{p.evNote}</p>}
          </div>
          <div className="d-block"><h3><Icon name="scale" />Estado regulatorio</h3><AgencyGrid p={p} detail /></div>
          {p.refs && p.refs.length > 0 && (
            <div className="d-block"><h3><Icon name="file-text" />Referencias</h3>
              <ol className="refs">{p.refs.map((r) => <li key={r.url}><a href={r.url} target="_blank" rel="noopener">{r.title}</a><small>{r.source || host(r.url)}</small></li>)}</ol>
            </div>
          )}
          <p className="d-review"><Icon name="calendar-check" />Fuentes revisadas el {fmtDate(p.checked)}. Investigación preliminar asistida por IA, pendiente de revisión médica.</p>
          <div className="d-cta">
            <span className="d-cta-ic"><Icon name="stethoscope" /></span>
            <div><b>Consultá con un especialista</b><p>Te ponemos en contacto con un médico matriculado en Argentina, por teleconsulta o presencial.</p>
              <a className="btn btn-orange" href="#derivacion" onClick={toReferral}>Pedir una derivación<Icon name="arrow-right" /></a></div>
          </div>
          <p className="d-foot">Información, no indicación. No indicamos dosis, usos ni dónde conseguir productos.</p>
        </div>
      </aside>
    </>
  );
}
