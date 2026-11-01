/* Tarjeta de péptido: arriba la cadena de aminoácidos real (cada péptido tiene su forma
   porque ningún péptido es igual), abajo el veredicto en Argentina y la evidencia.
   La variedad sale de los datos, no de adornos: las aprobadas se invierten (fondo oscuro),
   las cosméticas van en crema, las pendientes con borde punteado. */
import { AGENCIES, PT, evInfo, verdict } from "../lib/catalog";
import type { Peptide } from "../lib/catalog";
import { Dot, Icon } from "./ui";

/* el color dice la química del aminoácido, no decora: tinta = hidrofóbico,
   naranja = carga positiva, ámbar = carga negativa, crema = polar, gris = G/P,
   punteado = no estándar (Aib y similares, escritos como X) */
const kind = (a: string) =>
  "AVILMFW".includes(a) ? "hyd" : "KRH".includes(a) ? "pos" : "DE".includes(a) ? "neg" : "STNQCY".includes(a) ? "pol" : a === "X" ? "odd" : "gp";

export function Chain({ seq }: { seq: string }) {
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
        <g key={i} className={kind(b.a)}>
          <circle cx={b.x} cy={b.y} r={r} />
          {r >= 9 && <text x={b.x} y={b.y + 3.6}>{b.a === "X" ? "·" : b.a}</text>}
        </g>
      ))}
    </svg>
  );
}

export function PeptideCard({ p, i = 0 }: { p: Peptide; i?: number }) {
  const v = verdict(p), seq = p.sequence;
  const grade = p.ev === "—" ? "none" : p.ev;
  return (
    <a className={`pcard tone-${v.tone}`} href={`#p/${p.slug}`} style={{ animationDelay: `${Math.min(i * 25, 300)}ms` }}>
      <span className="pcard-art">
        {seq ? <Chain seq={seq} /> : <span className="pcard-noseq"><span className="sys-tile"><Icon name={p.sysIcon} /></span>{p.type}</span>}
        {seq && <span className="pcard-len">{seq.length} aminoácidos</span>}
        <span className={`pgrade g-${grade}`} title={evInfo[p.ev]?.name}><b>{p.ev === "—" ? "?" : p.ev}</b><small>evidencia</small></span>
      </span>
      <span className="pcard-body">
        <span className="pcard-sys"><Icon name={p.sysIcon} />{p.sysName}</span>
        <h3>{p.name}</h3>
        <span className="pcard-alias">{p.alias}</span>
        <span className="pcard-verdict">{v.text}</span>
        <span className="pcard-rows">
          {AGENCIES.map((a) => (
            <span className="pcard-row" key={a}><span>{a} <small>{PT.agencyInfo[a].name}</small></span><b><Dot v={p.st[a]} />{p.st[a]}</b></span>
          ))}
        </span>
        <span className="pcard-foot"><span>{evInfo[p.ev]?.name}</span><span className="pcard-go">Ver ficha<Icon name="arrow-right" /></span></span>
      </span>
    </a>
  );
}
