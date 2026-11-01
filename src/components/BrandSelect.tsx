/* Desplegable de marca: botón + listbox accesible (nada de <select> nativo).
   Teclado: flechas, Inicio/Fin, Enter/Espacio, Escape, búsqueda tipeando.
   Se abre hacia arriba si no hay lugar abajo. */
import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Icon } from "./ui";
import { norm } from "../lib/catalog";

export type Option = { value: string; label: string; deco?: ReactNode };

export function BrandSelect({ value, onChange, options, label, ariaLabel, compact, invalid, id }: {
  value: string; onChange: (v: string) => void; options: Option[];
  label?: string; ariaLabel: string; compact?: boolean; invalid?: boolean; id?: string;
}) {
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [up, setUp] = useState(false);
  const [active, setActive] = useState(0);
  const wrap = useRef<HTMLDivElement>(null), btn = useRef<HTMLButtonElement>(null), list = useRef<HTMLUListElement>(null);
  const typed = useRef({ s: "", at: 0 });
  const sel = Math.max(0, options.findIndex((o) => o.value === value));
  const cur = options[sel];

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!wrap.current!.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  const show = () => {
    const r = btn.current!.getBoundingClientRect();
    setUp(window.innerHeight - r.bottom < Math.min(320, options.length * 40 + 16) && r.top > 340);
    setActive(sel);
    setOpen(true);
    requestAnimationFrame(() => list.current?.focus({ preventScroll: true }));
  };
  const close = (refocus?: boolean) => { setOpen(false); if (refocus) btn.current?.focus(); };
  const choose = (i: number) => { if (options[i] && i !== sel) onChange(options[i].value); close(true); };

  useEffect(() => {   // la opción activa siempre a la vista
    if (!open) return;
    const li = list.current?.children[active] as HTMLElement | undefined;
    li?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const onListKey = (e: React.KeyboardEvent) => {
    const n = options.length;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(n - 1, a + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === "Home") { e.preventDefault(); setActive(0); }
    else if (e.key === "End") { e.preventDefault(); setActive(n - 1); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(active); }
    else if (e.key === "Escape") { e.preventDefault(); close(true); }
    else if (e.key === "Tab") close();
    else if (e.key.length === 1) {   // búsqueda por tipeo
      const now = Date.now(), t = typed.current;
      t.s = (now - t.at > 700 ? "" : t.s) + norm(e.key); t.at = now;
      const k = options.findIndex((o) => norm(o.label).startsWith(t.s));
      if (k >= 0) setActive(k);
    }
  };

  return (
    <div ref={wrap} className={`bsel${compact ? " bsel-compact" : ""}${open ? " open" : ""}${up ? " up" : ""}${sel > 0 && value ? " is-set" : ""}`}>
      <button ref={btn} id={id} type="button" className="bsel-btn" aria-haspopup="listbox" aria-expanded={open} aria-controls={uid}
        aria-label={ariaLabel} aria-invalid={invalid || undefined}
        onClick={() => (open ? close(true) : show())}
        onKeyDown={(e) => { if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) { e.preventDefault(); show(); } }}>
        {label && <span className="bsel-label">{label}</span>}
        <span className="bsel-val">{cur?.deco}{cur?.label}</span>
        <Icon name="chevron-down" className="bsel-chev" />
      </button>
      <ul ref={list} className="bsel-list" id={uid} role="listbox" tabIndex={-1} aria-label={ariaLabel} hidden={!open}
        aria-activedescendant={open ? `${uid}-${active}` : undefined} onKeyDown={onListKey}>
        {options.map((o, i) => (
          <li key={o.value} id={`${uid}-${i}`} role="option" aria-selected={i === sel} className={i === active ? "active" : undefined}
            onClick={() => choose(i)} onMouseMove={() => i !== active && setActive(i)}>
            {o.deco}<span>{o.label}</span><Icon name="check" className="bsel-check" />
          </li>
        ))}
      </ul>
    </div>
  );
}
