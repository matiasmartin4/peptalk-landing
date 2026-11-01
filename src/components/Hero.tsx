/* Hero: buscador con sugerencias (combobox), pila de fichas destacadas y fila de confianza. */
import { useEffect, useRef, useState } from "react";
import { CardSwap, swapSize } from "./CardSwap";
import { AgencyGrid, EvMeter, Icon, SysTile, scrollToId, useReveal } from "./ui";
import { PT, agList, bySlug, matches, peptides, reduceMotion } from "../lib/catalog";
import type { Peptide } from "../lib/catalog";
import { openPeptide, useStore } from "../lib/store";

const FREQ = ["BPC-157", "Semaglutida", "TB-500", "GHK-Cu"];

function Search() {
  const { setLibQuery } = useStore();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const input = useRef<HTMLInputElement>(null);
  const items = q.trim().length >= 2 ? peptides.filter((p) => matches(p, q)).slice(0, 6) : [];
  const total = items.length ? items.length + 1 : 0;   // + "ver todos"

  useEffect(() => {   // "/" enfoca el buscador desde cualquier lado
    const key = (e: KeyboardEvent) => {
      if (e.key === "/" && !/INPUT|TEXTAREA|SELECT/.test((document.activeElement as HTMLElement).tagName)) { e.preventDefault(); input.current?.focus(); }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, []);

  const toLibrary = () => { setOpen(false); setLibQuery(q); scrollToId("biblioteca"); };
  const pick = (i: number) => {
    if (i >= 0 && i < items.length) { setOpen(false); openPeptide(items[i].slug); }
    else toLibrary();
  };
  const onKey = (e: React.KeyboardEvent) => {
    if ((e.key === "ArrowDown" || e.key === "ArrowUp") && open && total) {
      e.preventDefault();
      setActive((a) => (a + (e.key === "ArrowDown" ? 1 : -1) + total) % total);
    } else if (e.key === "Enter") { e.preventDefault(); pick(active); }
    else if (e.key === "Escape") setOpen(false);
  };
  const shown = open && q.trim().length >= 2;

  return (
    <>
      <div className="search" id="heroSearch">
        <label htmlFor="q" className="sr">Buscar un péptido</label>
        <Icon name="search" className="search-ico" />
        <input ref={input} id="q" type="search" autoComplete="off" placeholder="Buscá un péptido: nombre, código o alias" role="combobox"
          aria-expanded={shown} aria-controls="sugg" aria-autocomplete="list" aria-activedescendant={shown && active >= 0 ? `sg${active}` : undefined}
          value={q} onChange={(e) => { setQ(e.target.value); setActive(-1); setOpen(true); }} onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)} onKeyDown={onKey} />
        <kbd className="kbd" aria-hidden="true">/</kbd>
        <button className="search-go" aria-label="Buscar" onClick={toLibrary}><Icon name="arrow-right" /></button>
        <ul className="sugg" id="sugg" role="listbox" hidden={!shown}>
          {items.length ? (
            <>
              {items.map((p, i) => (
                <li key={p.slug} role="option" id={`sg${i}`} aria-selected={i === active} onMouseDown={(e) => { e.preventDefault(); pick(i); }}>
                  <SysTile icon={p.sysIcon} size="sm" /><div><b>{p.name}</b><br /><small>{p.alias}</small></div><span className="sugg-sys">{p.sysName}</span>
                </li>
              ))}
              <li role="option" id={`sg${items.length}`} aria-selected={active === items.length} onMouseDown={(e) => { e.preventDefault(); toLibrary(); }}>
                <small>Ver todos los resultados para «{q.trim()}» →</small>
              </li>
            </>
          ) : <li className="sugg-empty">No encontramos «{q.trim()}». Probá con otro nombre o alias.</li>}
        </ul>
      </div>
      <div className="freq">
        <span>Búsquedas frecuentes:</span>
        {FREQ.map((f) => <button key={f} className="chip-sm" onClick={() => { setQ(f); setOpen(true); input.current?.focus(); }}>{f}</button>)}
      </div>
    </>
  );
}

/* cara de una ficha destacada en la pila */
const SpotFace = ({ p }: { p: Peptide }) => (
  <>
    <div className="spot-top"><span className="spot-eyebrow"><Icon name="microscope" />Ficha destacada</span><span className="spot-sys">{p.sysName}</span></div>
    <div className="spot-body">
      <div className="spot-id"><SysTile icon={p.sysIcon} size="lg" /><div><h3>{p.name}</h3><p>{p.alias}</p></div></div>
      <AgencyGrid p={p} />
      <div className="spot-foot"><EvMeter ev={p.ev} withLabel /><a className="spot-cta" href={`#p/${p.slug}`}>Ver ficha<Icon name="arrow-up-right" /></a></div>
    </div>
  </>
);

function Spot() {
  const list = PT.featured.map((s) => bySlug[s]).filter(Boolean);
  const { w, h } = swapSize(list.length);
  const box = useRef<HTMLDivElement>(null);
  const control = useRef<null | { next: () => void }>(null);
  const [scale, setScale] = useState(1);
  const [front, setFront] = useState(list[0]?.slug);

  /* en pantallas angostas el bloque entero se achica, no se recorta */
  useEffect(() => {
    const el = box.current!.parentElement!;
    const fit = () => setScale(Math.min(1, el.clientWidth / w));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [w]);

  if (!list.length) return null;
  const i = Math.max(0, list.findIndex((p) => p.slug === front));
  return (
    <div className="spot" role="region" aria-label="Fichas destacadas">
      <div ref={box} className="spot-stack" style={{ width: w * scale, height: h * scale }}>
        <div style={{ transform: `scale(${scale})`, transformOrigin: "0 0" }}>
          <CardSwap cards={list.map((p) => ({ id: p.slug, title: p.name, face: <SpotFace p={p} /> }))} auto={!reduceMotion} every={6} onFront={setFront} control={control} />
        </div>
      </div>
      <div className="spot-controls">
        <span className="spot-count" aria-live="polite"><b>{list[i].name}</b> · {i + 1} de {list.length}</span>
        <button type="button" className="spot-next" onClick={() => control.current?.next()}>Siguiente ficha</button>
      </div>
    </div>
  );
}

function Trust() {
  const a = useReveal<HTMLDivElement>(), b = useReveal<HTMLDivElement>(), c = useReveal<HTMLDivElement>();
  return (
    <div className="wrap trust">
      <div ref={a}><span className="ti"><Icon name="file-text" /></span><div><b>Fuentes citadas en cada ficha</b><p>Boletín Oficial, {agList(true)} y estudios con DOI.</p></div></div>
      <div ref={b}><span className="ti"><Icon name="stethoscope" /></span><div><b>Revisión médica con matrícula</b><p>Un profesional revisa cada ficha antes de publicarla.</p></div></div>
      <div ref={c}><span className="ti"><Icon name="calendar-check" /></span><div><b>Estados con fecha de verificación</b><p>Si no lo verificamos todavía, lo decimos.</p></div></div>
    </div>
  );
}

export function Hero() {
  return (
    <section className="hero">
      <div className="hero-glow" aria-hidden="true" />
      <div className="wrap hero-in">
        <div className="hero-copy">
          <span className="eyebrow"><i />Biblioteca de péptidos · Argentina</span>
          <h1>Qué es cada péptido, qué dice la evidencia y <span className="hl">en qué estado está.</span></h1>
          <p className="lead">Fichas claras, en castellano, con el estado ante {agList()}. Cada dato con su fuente y su fecha de verificación. Sin promesas, sin vender nada.</p>
          <Search />
        </div>
        <div className="hero-art">
          <img className="molecule" src="/brand/logo/peptalk-isotipo.svg" alt="" aria-hidden="true" width={240} height={200} />
          <Spot />
        </div>
      </div>
      <Trust />
    </section>
  );
}
