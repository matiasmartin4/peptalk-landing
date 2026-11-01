/* Sistemas del cuerpo: lista, cuerpo 3D de partículas (body3d.js + Three.js, cargados
   recién cuando la sección se acerca) y tarjeta del sistema elegido. Sin WebGL, silueta SVG. */
import { useEffect, useRef, useState } from "react";
import { Icon, loadScript, scrollToId, useReveal } from "./ui";
import { PT, peptides, plural, sysById, sysCount } from "../lib/catalog";
import { openPeptide, useStore } from "../lib/store";

type BodyApi = { select: (id: string) => void };
declare global { interface Window { PTBody?: { mount: (el: HTMLElement, systems: unknown, opts: { onPick: (id: string) => void }) => BodyApi | null } } }

export function Systems() {
  const { setLibSys } = useStore();
  const [current, setCurrent] = useState("digestivo");
  const [mode, setMode] = useState<"loading" | "3d" | "svg">("loading");
  const stage = useRef<HTMLDivElement>(null);
  const body = useRef<BodyApi | null>(null);
  const svg = useRef<SVGSVGElement | null>(null);
  const panel = useReveal<HTMLDivElement>();

  useEffect(() => {
    const el = stage.current!;
    el.innerHTML = '<div class="body-loading">Cargando cuerpo 3D…</div>';
    const useFallback = () =>
      fetch("/assets/body.svg").then((r) => r.text()).then((txt) => {
        el.innerHTML = txt;
        svg.current = el.querySelector("svg");
        svg.current?.addEventListener("click", (e) => { const g = (e.target as Element).closest(".sys") as HTMLElement | null; if (g) setCurrent(g.dataset.sys!); });
        setMode("svg");
      });
    const boot = () =>
      loadScript("/vendor/three.min.js").then(() => loadScript("/body3d.js")).then(() => {
        el.innerHTML = "";
        body.current = window.PTBody!.mount(el, PT.systems, { onPick: setCurrent });
        if (!body.current) throw new Error("sin WebGL");
        setMode("3d");
      }).catch(useFallback);
    // Three.js se carga recién cuando la sección está por entrar en pantalla
    const io = new IntersectionObserver(([en]) => { if (en.isIntersecting) { io.disconnect(); boot(); } }, { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    body.current?.select(current);
    svg.current?.querySelectorAll<SVGElement>(".sys").forEach((g) => g.classList.toggle("on", g.dataset.sys === current));
  }, [current, mode]);

  const s = sysById[current];
  const some = peptides.filter((p) => p.sys === current).slice(0, 6);
  return (
    <section className="wrap" id="sistemas">
      <div className="dark-panel" ref={panel}>
        <div className="dp-head">
          <div><span className="kicker">Sistemas del cuerpo</span><h2>Explorá por sistema</h2></div>
          <p>Elegí un sistema o tocá una zona del cuerpo para ver qué péptidos se estudian ahí.</p>
        </div>
        <div className="dp-grid">
          <ul className="sys-list" role="tablist" aria-label="Sistemas del cuerpo">
            {PT.systems.map((x) => (
              <li role="presentation" key={x.id}>
                <button role="tab" aria-selected={x.id === current} onClick={() => setCurrent(x.id)}>
                  <span className="sys-ic"><Icon name={x.icon} /></span>{x.name}<span className="n">{sysCount[x.id]}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="body-wrap">
            {/* el contenido lo maneja body3d.js (o el SVG): React no lo toca después de montar */}
            <div className={`body-stage${mode === "3d" ? " is-3d" : mode === "svg" ? " is-svg" : ""}`} ref={stage} />
            <p className="body-hint">Pasá el mouse por el cuerpo y tocá una zona</p>
          </div>
          <div className="sys-card" aria-live="polite">
            <div className="top"><span className="sys-ic"><Icon name={s.icon} /></span><div><h3>{s.name}</h3><div className="cnt">{plural(sysCount[s.id], "péptido", "péptidos")} en la biblioteca</div></div></div>
            <p>{s.desc}</p>
            <div className="lbl">Algunos de este sistema</div>
            <div className="pep-pills">{some.map((p) => <button key={p.slug} onClick={() => openPeptide(p.slug)}>{p.name}</button>)}</div>
            <button className="btn btn-orange" onClick={() => { setLibSys(current); scrollToId("biblioteca"); }}>Ver péptidos de {s.name}<Icon name="arrow-right" /></button>
          </div>
        </div>
      </div>
    </section>
  );
}
