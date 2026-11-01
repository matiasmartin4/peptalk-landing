/* Biblioteca: búsqueda, filtros (agencias visibles + evidencia), sistemas, vista de
   tarjetas o tabla, filtros activos que se pueden quitar. La consulta y el sistema vienen
   del store: el buscador del hero y el mapa del cuerpo también los cambian. */
import { useState } from "react";
import { BrandSelect } from "./BrandSelect";
import type { Option } from "./BrandSelect";
import { PeptideCard } from "./PeptideCard";
import { Dot, EvMeter, Icon, SysTile } from "./ui";
import { AGENCIES, PT, fmtDate, lastChecked, matches, peptides, plural, shownStatuses, sysById, sysCount } from "../lib/catalog";
import { openPeptide, useStore } from "../lib/store";

const statusOpts: Option[] = [{ value: "all", label: "Todos" }, ...shownStatuses.map((s) => ({ value: s.v, label: s.v, deco: <Dot v={s.v} /> }))];
const evOpts: Option[] = [
  { value: "all", label: "Todas" },
  ...PT.evidence.map((e) => ({ value: e.v, label: e.v === "—" ? "Pendiente" : e.name, deco: <span className={`ev-mini ${e.v === "—" ? "ev-none" : "ev-" + e.v}`}>{e.v}</span> })),
];

export function Library() {
  const { libQuery: q, setLibQuery: setQ, libSys: sys, setLibSys: setSys } = useStore();
  const [ag, setAg] = useState<Record<string, string>>({});   // filtro por agencia: { ANMAT: 'Aprobado' }
  const [evid, setEvid] = useState("all");
  const [view, setView] = useState<"cards" | "table">("cards");

  const list = peptides.filter((p) =>
    (sys === "all" || p.sys === sys) &&
    AGENCIES.every((a) => !ag[a] || ag[a] === "all" || p.st[a] === ag[a]) &&
    (evid === "all" || p.ev === evid) &&
    matches(p, q));

  // filtros activos como fichas que se pueden quitar
  const tags: [string, string, () => void][] = [];
  if (q.trim()) tags.push(["q", `«${q.trim()}»`, () => setQ("")]);
  if (sys !== "all") tags.push(["sys", sysById[sys].name, () => setSys("all")]);
  AGENCIES.forEach((a) => { if (ag[a] && ag[a] !== "all") tags.push([a, `${a}: ${ag[a]}`, () => setAg({ ...ag, [a]: "all" })]); });
  if (evid !== "all") tags.push(["evid", `Evidencia: ${evid === "—" ? "Pendiente" : evid}`, () => setEvid("all")]);
  const clear = () => { setQ(""); setSys("all"); setAg({}); setEvid("all"); };
  const chips = [{ id: "all", name: "Todos", icon: "layout-grid", n: peptides.length }, ...PT.systems.map((s) => ({ id: s.id, name: s.name, icon: s.icon, n: sysCount[s.id] }))];

  return (
    <section className="wrap section" id="biblioteca">
      <div className="lib-head">
        <div>
          <span className="kicker">Biblioteca</span>
          <h2>Biblioteca de péptidos</h2>
          <p className="muted">{plural(peptides.length, "péptido", "péptidos")} · {PT.systems.length} sistemas · Fuentes revisadas el {fmtDate(lastChecked)}</p>
        </div>
      </div>

      <div className="lib-bar">
        <div className="lib-row">
          <div className="mini-search">
            <Icon name="search" />
            <label htmlFor="libQ" className="sr">Filtrar por nombre o alias</label>
            <input id="libQ" type="search" placeholder="Filtrar por nombre o alias" autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="filters">
            {AGENCIES.map((a) => <BrandSelect key={a} compact label={a} ariaLabel={`Estado ${a}`} value={ag[a] || "all"} options={statusOpts} onChange={(v) => setAg({ ...ag, [a]: v })} />)}
            <BrandSelect compact label="Evidencia" ariaLabel="Nivel de evidencia" value={evid} options={evOpts} onChange={setEvid} />
          </div>
          <div className="seg" role="group" aria-label="Vista">
            <button className={view === "cards" ? "on" : undefined} aria-pressed={view === "cards"} aria-label="Vista de tarjetas" onClick={() => setView("cards")}><Icon name="layout-grid" /></button>
            <button className={view === "table" ? "on" : undefined} aria-pressed={view === "table"} aria-label="Vista de tabla" onClick={() => setView("table")}><Icon name="list" /></button>
          </div>
        </div>
        <div className="chips-wrap"><div className="chips" role="group" aria-label="Filtrar por sistema">
          {chips.map((s) => (
            <button key={s.id} className="chip" aria-pressed={sys === s.id} onClick={() => setSys(s.id)}><Icon name={s.icon} /><span>{s.name}</span><span className="n">{s.n}</span></button>
          ))}
        </div></div>
      </div>

      <div className="lib-status">
        <p className="small" aria-live="polite"><b>{list.length}</b> de {plural(peptides.length, "péptido", "péptidos")}</p>
        <div className="active-filters">
          {tags.map(([k, label, off]) => <button key={k} className="af" aria-label={`Quitar filtro ${label}`} onClick={off}>{label}<Icon name="x" /></button>)}
        </div>
        {tags.length > 0 && <button className="btn-link" onClick={clear}><Icon name="rotate-ccw" /> Limpiar todo</button>}
      </div>

      {list.length > 0 && view === "cards" && <div className="pcards">{list.map((p, i) => <PeptideCard key={p.slug} p={p} i={i} />)}</div>}
      {list.length > 0 && view === "table" && (
        <div className="table-wrap"><table>
          <thead><tr><th>Péptido</th><th>Sistema</th>{AGENCIES.map((a) => <th key={a}>{a}</th>)}<th>Evidencia</th></tr></thead>
          <tbody>{list.map((p) => (
            <tr key={p.slug} tabIndex={0} onClick={() => openPeptide(p.slug)} onKeyDown={(e) => { if (e.key === "Enter") openPeptide(p.slug); }}>
              <td><span className="t-pep"><SysTile icon={p.sysIcon} size="sm" /><span><b>{p.name}</b><small>{p.alias}</small></span></span></td>
              <td>{p.sysName}</td>
              {AGENCIES.map((a) => <td key={a}><span className="st"><Dot v={p.st[a]} />{p.st[a]}</span></td>)}
              <td><EvMeter ev={p.ev} /></td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
      {!list.length && (
        <div className="empty">
          <b>No hay péptidos con estos filtros</b>
          <p>Probá quitar algún filtro o buscar por otro nombre.</p>
          <button className="btn btn-ghost" onClick={clear}>Limpiar filtros</button>
        </div>
      )}
      <p className="note"><i className="dot d-pend" /> Los estados marcados como «Pendiente» todavía no fueron verificados por peptalk lab. Se muestran igual, para que sepas qué falta.</p>
    </section>
  );
}
