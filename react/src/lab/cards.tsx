/* peptalk — laboratorio de tarjetas de péptido (para elegir dirección; no es el sitio).
   Tres variantes con datos reales de PT.peptides:
   A · Veredicto  — abre con lo que la gente busca: si está aprobado en Argentina.
   B · Secuencia  — la cadena de aminoácidos real dibujada; cada péptido tiene su forma.
   C · Bento      — tamaños mixtos: los destacados ocupan más y cuentan más. */
import { createRoot } from "react-dom/client";

type Status = { v: string };
type Peptide = { slug: string; name: string; alias: string; sys: string; type: string; ev: string; summary: string; checked: string; status: Record<string, Status> };
type System = { id: string; name: string; icon: string };
type LabPT = { peptides: Peptide[]; systems: System[]; featured: string[]; evidence: { v: string; name: string }[] };
const PT = (window as unknown as { PT: LabPT }).PT;
const sysById = Object.fromEntries(PT.systems.map((s) => [s.id, s]));
const evName = Object.fromEntries(PT.evidence.map((e) => [e.v, e.name]));
const Icon = ({ name }: { name: string }) => <svg className="i" aria-hidden="true"><use href={`../assets/icons.svg#${name}`} /></svg>;
const st = (p: Peptide, a: string) => (p.status[a] && p.status[a].v) || "Pendiente";
const fmt = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("es-AR", { day: "numeric", month: "short" });

/* el veredicto en palabras: qué dice ANMAT, que es lo que importa acá */
const verdict = (p: Peptide) => {
  const v = st(p, "ANMAT");
  if (v === "Aprobado") return { tone: "ok", text: "Aprobado en Argentina" };
  if (v === "Cosmético") return { tone: "cosm", text: "Ingrediente cosmético en Argentina" };
  if (v === "No aprobado") return { tone: "no", text: "Sin aprobación en Argentina" };
  if (v === "En investigación") return { tone: "inv", text: "En investigación en Argentina" };
  return { tone: "pend", text: "Argentina: lo estamos confirmando" };
};
const DOT: Record<string, string> = { Aprobado: "d-aprob", "En investigación": "d-inv", "No aprobado": "d-noap", Prohibido: "d-proh", Cosmético: "d-cosm", "No listado": "d-nolist", Pendiente: "d-pend" };

const Row = ({ p, a, label }: { p: Peptide; a: string; label: string }) => (
  <div className="lab-row"><span>{label}</span><b><i className={`dot ${DOT[st(p, a)]}`} />{st(p, a)}</b></div>
);
const firstSentence = (s: string) => (s.match(/^.*?[.!?](\s|$)/) || [s])[0].trim();

/* ── A · Veredicto ─────────────────────────────────────── */
function CardA({ p }: { p: Peptide }) {
  const s = sysById[p.sys], v = verdict(p);
  return (
    <article className={`va tone-${v.tone}`}>
      <header>
        <span className="va-sys"><Icon name={s.icon} />{s.name}</span>
        <span className={`va-grade g-${p.ev === "—" ? "none" : p.ev}`} title={evName[p.ev]}><b>{p.ev === "—" ? "?" : p.ev}</b><small>evidencia</small></span>
      </header>
      <h3>{p.name}</h3>
      <p className="va-alias">{p.alias}</p>
      <p className="va-verdict">{v.text}</p>
      <div className="lab-rows"><Row p={p} a="ANMAT" label="ANMAT" /><Row p={p} a="FDA" label="FDA (EE. UU.)" /></div>
      <footer><span>Fuentes al {fmt(p.checked)}</span><span className="va-go">Ver ficha <Icon name="arrow-right" /></span></footer>
    </article>
  );
}

/* ── B · Secuencia ───────────────────────────────────────
   Secuencias públicas (UniProt / DrugBank) para el prototipo; X = aminoácido no
   estándar (Aib). A VERIFICAR antes de usarlas: se cargarían en peptides.sequence. */
const SEQ: Record<string, string> = {
  "bpc-157": "GEPPPGKPADDAGLV",
  semaglutida: "HXEGTFTSDVSSYLEGQAAKEFIAWLVRGRG",
  "tb-500": "LKKTETQ",
  "ghk-cu": "GHK",
  tirzepatida: "YXEGTFTSDYSIXLDKIAQKAFVQWLIAGGPSSGAPPPS",
  epitalon: "AEDG",
  "timosina-alfa-1": "SDAAVDTSSEITTKDLKEKKEVVEEAEN",
  oxitocina: "CYIQNCPLG",
};
/* el color dice la química del aminoácido, no decora: tinta = hidrofóbico,
   naranja = carga positiva, ámbar = carga negativa, crema = polar, gris = G/P */
const cls = (a: string) =>
  "AVILMFW".includes(a) ? "hyd" : "KRH".includes(a) ? "pos" : "DE".includes(a) ? "neg" : "STNQCY".includes(a) ? "pol" : a === "X" ? "odd" : "gp";
function Chain({ seq }: { seq: string }) {
  const W = 300, n = seq.length, rows = n > 20 ? 2 : 1, per = Math.ceil(n / rows);
  const step = Math.min(30, (W - 24) / per), r = Math.max(4.5, Math.min(13, step * 0.42));
  const H = rows === 1 ? 70 : 100;
  const beads = [...seq].map((a, i) => {
    const row = Math.floor(i / per), k = i % per;
    /* la segunda fila vuelve de derecha a izquierda: es una sola cadena plegada */
    const x = 12 + r + (row ? per - 1 - k : k) * step;
    const y = (rows === 1 ? H / 2 : 30 + row * 40) + Math.sin(k * 0.9) * (rows === 1 ? 10 : 6);
    return { a, x, y };
  });
  return (
    <svg className="chain" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Cadena de ${n} aminoácidos`}>
      <polyline points={beads.map((b) => `${b.x},${b.y}`).join(" ")} />
      {beads.map((b, i) => (
        <g key={i} className={cls(b.a)}>
          <circle cx={b.x} cy={b.y} r={r} />
          {r >= 9 && <text x={b.x} y={b.y + 3.6}>{b.a === "X" ? "·" : b.a}</text>}
        </g>
      ))}
    </svg>
  );
}
function CardB({ p }: { p: Peptide }) {
  const s = sysById[p.sys], v = verdict(p), seq = SEQ[p.slug];
  return (
    <article className="vb">
      <div className="vb-art">
        {seq ? <Chain seq={seq} /> : <span className="vb-none">Secuencia a cargar</span>}
        {seq && <span className="vb-len">{seq.length} aminoácidos</span>}
      </div>
      <div className="vb-body">
        <span className="va-sys"><Icon name={s.icon} />{s.name}</span>
        <h3>{p.name}</h3>
        <p className={`vb-verdict tone-${v.tone}`}><i className={`dot ${DOT[st(p, "ANMAT")]}`} />{v.text}</p>
        <div className="vb-foot"><span className={`va-grade sm g-${p.ev === "—" ? "none" : p.ev}`}><b>{p.ev}</b></span><span>{evName[p.ev]}</span></div>
      </div>
    </article>
  );
}

/* ── C · Bento ─────────────────────────────────────────── */
function Bento({ list }: { list: Peptide[] }) {
  const featured = new Set(PT.featured);
  return (
    <div className="vc">
      {list.map((p) => featured.has(p.slug) ? (
        <article key={p.slug} className={`vc-big tone-${verdict(p).tone}`}>
          <span className="va-sys"><Icon name={sysById[p.sys].icon} />{sysById[p.sys].name}</span>
          <h3>{p.name}</h3>
          <p className="vc-sum">{firstSentence(p.summary)}</p>
          <div className="lab-rows"><Row p={p} a="ANMAT" label="Argentina" /><Row p={p} a="FDA" label="EE. UU." /></div>
          <div className="vb-foot"><span className={`va-grade sm g-${p.ev === "—" ? "none" : p.ev}`}><b>{p.ev}</b></span><span>{evName[p.ev]}</span></div>
        </article>
      ) : (
        <article key={p.slug} className="vc-small">
          <h3>{p.name}</h3>
          <p className={`vb-verdict tone-${verdict(p).tone}`}><i className={`dot ${DOT[st(p, "ANMAT")]}`} />{verdict(p).text}</p>
          <span className={`va-grade sm g-${p.ev === "—" ? "none" : p.ev}`}><b>{p.ev}</b></span>
        </article>
      ))}
    </div>
  );
}

function Lab() {
  const list = PT.peptides.slice(0, 8);
  const more = PT.peptides.slice(0, 12);
  return (
    <main className="lab">
      <h1>Tarjetas de péptido · tres direcciones</h1>
      <p className="lab-lead">Mismos datos, tres maneras de que no se vean todas iguales. La variedad sale de los datos (estado, evidencia, secuencia), no de adornos.</p>
      <section><h2>A · Veredicto</h2><p>Abre con la respuesta: si está aprobado en Argentina. Las aprobadas se invierten (fondo oscuro) y la evidencia es una nota grande.</p>
        <div className="grid">{list.map((p) => <CardA key={p.slug} p={p} />)}</div></section>
      <section><h2>B · Secuencia</h2><p>La cadena real de aminoácidos, coloreada por química. Ninguna se parece a otra porque ningún péptido es igual. Secuencias del prototipo a verificar.</p>
        <div className="grid">{list.map((p) => <CardB key={p.slug} p={p} />)}</div></section>
      <section><h2>C · Bento</h2><p>Los destacados grandes, con el resumen; el resto compacto. Se ve un catálogo con jerarquía en vez de una grilla pareja.</p>
        <Bento list={more} /></section>
    </main>
  );
}

createRoot(document.getElementById("lab")!).render(<Lab />);

