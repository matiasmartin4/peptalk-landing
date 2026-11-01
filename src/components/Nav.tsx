/* Navegación: banner superior, cabecera (hoja redondeada) y barra flotante tipo pill
   que aparece al bajar, con su menú. Marca la sección visible. */
import { useEffect, useRef, useState } from "react";
import { Icon, scrollToId } from "./ui";
import { agList } from "../lib/catalog";

const XLogo = () => (
  <svg className="i x-logo" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" stroke="none" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
);
export { XLogo };

const MAIN = [["biblioteca", "Péptidos"], ["sistemas", "Sistemas"], ["estados", "Estados"], ["guias", "Guías"], ["metodo", "Metodología"]];

/* sección visible: la que cruza la franja del medio de la pantalla */
function useActiveSection(ids: string[]) {
  const [active, setActive] = useState("");
  useEffect(() => {
    const io = new IntersectionObserver((entries) => entries.forEach((en) => { if (en.isIntersecting) setActive(en.target.id); }), { rootMargin: "-45% 0px -50% 0px" });
    ids.forEach((id) => { const el = document.getElementById(id); if (el) io.observe(el); });
    return () => io.disconnect();
  }, [ids.join()]);
  return active;
}

export function Nav() {
  const [menu, setMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [pill, setPill] = useState(false);
  const [panel, setPanel] = useState(false);
  const header = useRef<HTMLElement>(null), pillEl = useRef<HTMLDivElement>(null), menuBtn = useRef<HTMLButtonElement>(null);
  const active = useActiveSection(MAIN.map((m) => m[0]));

  useEffect(() => {
    const onScroll = () => {
      const h = header.current!;
      setScrolled(window.scrollY > 8);
      const show = window.scrollY > h.offsetTop + h.offsetHeight + 120;
      setPill(show);
      if (!show) setPanel(false);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!panel) return;
    const away = (e: PointerEvent) => { if (!pillEl.current!.contains(e.target as Node)) setPanel(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { setPanel(false); menuBtn.current?.focus(); } };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [panel]);

  const searchLibrary = () => { scrollToId("biblioteca"); setTimeout(() => document.getElementById("libQ")?.focus({ preventScroll: true }), 450); };

  return (
    <>
      <div className="topbar">
        <p><span className="tb-txt">Información sobre péptidos, con fuente y fecha · no reemplaza una consulta médica</span><a className="tb-cta" href="#metodo">Cómo trabajamos<Icon name="chevron-right" /></a></p>
      </div>

      <header className={`nav${scrolled ? " scrolled" : ""}`} id="nav" ref={header}>
        <div className="wrap nav-in">
          <a href="#" className="brand" aria-label="peptalk, inicio"><img src="/brand/logo/peptalk-logo.svg" alt="peptalk" width={128} height={34} /></a>
          <nav className={`nav-links${menu ? " open" : ""}`} id="navLinks" aria-label="Principal" onClick={(e) => { if ((e.target as HTMLElement).tagName === "A") setMenu(false); }}>
            {MAIN.map(([id, label]) => <a key={id} href={`#${id}`} className={active === id ? "active" : undefined}>{label}</a>)}
          </nav>
          <a href="#derivacion" className="btn btn-dark nav-cta">Consultar con un especialista</a>
          <button className="burger" aria-label="Abrir menú" aria-expanded={menu} aria-controls="navLinks" onClick={() => setMenu(!menu)}><span /><span /></button>
        </div>
      </header>

      {/* barra flotante: aparece cuando la cabecera sale de pantalla */}
      <div className={`pillbar${pill ? " show" : ""}`} aria-hidden={!pill} {...(!pill && { inert: "" })} ref={pillEl}>
        <div className="pill">
          <nav className="pill-links" aria-label="Atajos">
            {MAIN.slice(0, 4).map(([id, label]) => <a key={id} href={`#${id}`} className={active === id ? "active" : undefined}>{label}</a>)}
          </nav>
          <a href="#" className="pill-brand" aria-label="peptalk, volver arriba"><img src="/brand/logo/peptalk-logo-white.svg" alt="peptalk" width={112} height={30} /></a>
          <div className="pill-actions">
            <button className="pill-ic" type="button" aria-label="Buscar un péptido" onClick={searchLibrary}><Icon name="search" /></button>
            <a href="#derivacion" className="pill-cta">Consultar</a>
            <button ref={menuBtn} className="pill-menu" type="button" aria-label="Abrir menú" aria-expanded={panel} aria-controls="pillPanel" onClick={() => setPanel(!panel)}><Icon name="grip" /></button>
          </div>
        </div>
        <div className="pill-panel" id="pillPanel" hidden={!panel} onClick={(e) => { if ((e.target as HTMLElement).closest("a")) setPanel(false); }}>
          <a href="#biblioteca"><Icon name="flask-conical" /><span><b>Biblioteca</b><small>Todos los péptidos y sus estados</small></span></a>
          <a href="#sistemas"><Icon name="heart-pulse" /><span><b>Sistemas del cuerpo</b><small>Explorá por zona</small></span></a>
          <a href="#estados"><Icon name="scale" /><span><b>Cómo leer los estados</b><small>{agList()}</small></span></a>
          <a href="#novedades"><Icon name="newspaper" /><span><b>Resumen semanal</b><small>Regulación e investigación</small></span></a>
          <a href="#guias"><Icon name="book-open" /><span><b>Guías</b><small>Para entender antes de preguntar</small></span></a>
          <a href="#metodo"><Icon name="shield-check" /><span><b>Metodología</b><small>Fuentes y verificación</small></span></a>
          <a href="#derivacion"><Icon name="stethoscope" /><span><b>Consultar con un especialista</b><small>Derivación sin costo</small></span></a>
          <a href="https://x.com/Peptalkarg" target="_blank" rel="noopener"><XLogo /><span><b>@Peptalkarg</b><small>Seguinos en X</small></span></a>
        </div>
      </div>
    </>
  );
}
