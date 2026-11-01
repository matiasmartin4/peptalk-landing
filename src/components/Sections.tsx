/* Secciones de contenido: estados, newsletter, derivación, guías, metodología y pie. */
import { useEffect, useRef, useState } from "react";
import { BrandSelect } from "./BrandSelect";
import { XLogo } from "./Nav";
import { Dot, EvMeter, Icon, useReveal } from "./ui";
import { AGENCIES, PT, agList, peptides, shownStatuses } from "../lib/catalog";
import { useStore } from "../lib/store";

/* ---------- formularios: guardan con pt_submit_lead (la única función pública de la base) ---------- */
const db = PT.supabase;
const dbReady = !!(db && db.url);
const send = (data: object) =>
  fetch(`${db!.url}/rest/v1/rpc/pt_submit_lead`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: db!.anonKey },
    body: JSON.stringify({ p: data }),
  }).then((r) => { if (!r.ok) throw new Error(String(r.status)); });
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function States() {
  const copy = useReveal<HTMLDivElement>(), l1 = useReveal<HTMLDivElement>(), l2 = useReveal<HTMLDivElement>();
  return (
    <section className="band" id="estados">
      <div className="wrap states">
        <div className="states-copy" ref={copy}>
          <span className="kicker">Cómo leer los estados</span>
          <h2>Estados y evidencia, sin vueltas</h2>
          <p>Siempre en el mismo orden: <b>{AGENCIES.join(" → ")}</b>. Cada estado lleva fuente y fecha. Si todavía no lo verificamos, dice «Pendiente» y se muestra igual.</p>
          <p>Que un péptido esté aprobado para un uso no significa que esté aprobado para todos. Que se venda «solo para investigación» no es una aprobación.</p>
          {AGENCIES.includes("EMA") && <p>En la columna EMA contamos como «Aprobado» tanto la autorización centralizada de la EMA como las nacionales de países de la Unión Europea; la ficha aclara cuál es.</p>}
        </div>
        <div className="legend-card" ref={l1}>
          <h3>Estados por agencia</h3>
          <ul className="legend">{shownStatuses.map((s) => <li key={s.v}><Dot v={s.v} /><b>{s.v}</b><small>{s.desc}</small></li>)}</ul>
        </div>
        <div className="legend-card" ref={l2}>
          <h3>Nivel de evidencia</h3>
          <p className="muted small">Mide qué tipo de evidencia hay. No dice si funciona ni si es seguro.</p>
          <ul className="legend">{PT.evidence.map((e) => <li key={e.v}><EvMeter ev={e.v} /><span><b>{e.v === "—" ? "Pendiente" : e.v}</b> · {e.name}</span></li>)}</ul>
        </div>
      </div>
    </section>
  );
}

export function News() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [bad, setBad] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const a = useReveal<HTMLDivElement>(), b = useReveal<HTMLFormElement>();
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const ok = EMAIL.test(email.trim());
    setBad(!ok);
    if (!ok) { setMsg("Revisá el email."); input.current?.focus(); return; }
    if (!dbReady) { setMsg("Todavía no abrimos las suscripciones. Volvé pronto."); return; }
    setMsg("Enviando…");
    send({ kind: "newsletter", email: email.trim() })
      .then(() => { setEmail(""); setMsg("Listo, te vamos a mandar el próximo resumen."); })
      .catch(() => setMsg("No pudimos suscribirte. Probá de nuevo en un rato."));
  };
  return (
    <section className="wrap section" id="novedades">
      <div className="news">
        <div className="news-main" ref={a}>
          <span className="kicker">Resumen semanal</span>
          <h2>Lo que pasa con los péptidos, una vez por semana</h2>
          <p>Regulación, estudios nuevos y novedades de Argentina (ANMAT, Boletín Oficial, sociedades médicas), con la fuente de cada cosa. Estamos preparando el primer número.</p>
          <ul className="news-cats">
            <li><span className="tag">Regulación</span>Cambios en {agList()}.</li>
            <li><span className="tag">Investigación</span>Ensayos y estudios publicados, con DOI.</li>
            <li><span className="tag">Argentina</span>Lo local: disposiciones, alertas y sociedades médicas.</li>
          </ul>
        </div>
        <form className="newsletter" noValidate onSubmit={submit} ref={b}>
          <h3>Recibí el resumen semanal</h3>
          <p className="muted small">Un email por semana. Te das de baja cuando quieras.</p>
          <label htmlFor="nEmail" className="sr">Tu email</label>
          <div className="nl-row">
            <input ref={input} id="nEmail" type="email" placeholder="tu@email.com" autoComplete="email" required aria-invalid={bad || undefined} value={email} onChange={(e) => setEmail(e.target.value)} />
            <button className="btn btn-orange" type="submit">Suscribirme</button>
          </div>
          <p className="form-msg" role="status">{msg}</p>
        </form>
      </div>
    </section>
  );
}

type RefErr = Partial<Record<"name" | "contact" | "prov" | "adult" | "c1" | "c2", string>>;
const EMPTY = { name: "", email: "", phone: "", prov: "", pep: "", mod: "Teleconsulta", motivo: "", adult: false, c1: false, c2: false };

export function Referral() {
  const { refPep, setRefPep } = useStore();
  const [f, setF] = useState(EMPTY);
  const [err, setErr] = useState<RefErr>({});
  const [msg, setMsg] = useState("");
  const [sending, setSending] = useState(false);
  const summary = useRef<HTMLDivElement>(null);
  const box = useReveal<HTMLDivElement>();
  const set = (k: keyof typeof EMPTY, v: string | boolean) => setF((x) => ({ ...x, [k]: v }));

  // la ficha puede mandar acá el péptido que se estaba leyendo
  useEffect(() => { if (refPep) { set("pep", refPep); setRefPep(""); } }, [refPep]);

  const validate = () => {
    const e: RefErr = {};
    if (!f.name.trim()) e.name = "Escribí tu nombre.";
    const email = f.email.trim(), phone = f.phone.trim();
    if (!email && !phone) e.contact = "Dejanos un email o un teléfono.";
    else if (email && !EMAIL.test(email)) e.contact = "Revisá el email.";
    else if (phone && phone.replace(/\D/g, "").length < 8) e.contact = "Revisá el teléfono.";
    if (!f.prov) e.prov = "Elegí tu provincia.";
    if (!f.adult) e.adult = "Tenés que ser mayor de 18 años.";
    if (!f.c1) e.c1 = "Necesitamos tu consentimiento para tratar los datos.";
    if (!f.c2) e.c2 = "Necesitamos tu consentimiento para pasarle los datos al médico.";
    return e;
  };
  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    const e = validate();
    setErr(e);
    if (Object.keys(e).length) { setTimeout(() => summary.current?.focus()); return; }
    if (!dbReady) { setMsg("Las derivaciones abren pronto. Todavía no estamos recibiendo pedidos online."); return; }
    setSending(true);
    send({
      kind: "derivacion", name: f.name.trim(), email: f.email.trim(), phone: f.phone.trim(), prov: f.prov,
      pep: f.pep.trim(), mod: f.mod, motivo: f.motivo.trim(), consent: { adult: f.adult, c1: f.c1, c2: f.c2 },
    }).then(() => { setF(EMPTY); setMsg("Listo, recibimos tu pedido. Te vamos a confirmar por email."); })
      .catch(() => setMsg("No pudimos enviar el pedido. Probá de nuevo en un rato."))
      .finally(() => setSending(false));
  };
  const keys = Object.keys(err) as (keyof RefErr)[];
  const Err = ({ k }: { k: keyof RefErr }) => <small className="err">{err[k] || ""}</small>;

  return (
    <section className="wrap section" id="derivacion">
      <div className="referral" ref={box}>
        <div className="ref-copy">
          <span className="kicker kicker-light">Derivación</span>
          <h2>¿Querés hablarlo con un especialista?</h2>
          <p>Te ponemos en contacto con un médico matriculado en Argentina. No es una consulta online ni un diagnóstico.</p>
          <ul className="checks"><li>Sin costo de peptalk</li><li>Teleconsulta o presencial, en tu provincia</li><li>Tus datos solo se usan para esta derivación</li></ul>
          <div className="isnot"><div><small>Es</small><b>Contacto con un profesional</b></div><div><small>No es</small><b>Diagnóstico · Receta · Urgencias</b></div></div>
          <p className="urg">Urgencias: llamá al <a href="tel:107">107</a> (SAME).</p>
          <ol className="steps"><li><span>1</span>Recibimos tu pedido</li><li><span>2</span>Se lo pasamos al médico</li><li><span>3</span>El médico te contacta</li></ol>
        </div>

        <form className="ref-form" noValidate onSubmit={submit}>
          <h3>Pedí una derivación</h3>
          <div className="err-summary" tabIndex={-1} ref={summary} hidden={!keys.length}><b>Revisá estos datos:</b> {keys.map((k) => err[k]).join(" ")}</div>
          <div className="field"><label htmlFor="fName">Nombre</label><input id="fName" autoComplete="name" value={f.name} aria-invalid={!!err.name || undefined} onChange={(e) => set("name", e.target.value)} /><Err k="name" /></div>
          <div className="field-2">
            <div className="field"><label htmlFor="fEmail">Email</label><input id="fEmail" type="email" autoComplete="email" value={f.email} aria-invalid={!!err.contact || undefined} onChange={(e) => set("email", e.target.value)} /></div>
            <div className="field"><label htmlFor="fPhone">Teléfono</label><input id="fPhone" type="tel" autoComplete="tel" value={f.phone} aria-invalid={!!err.contact || undefined} onChange={(e) => set("phone", e.target.value)} /></div>
          </div>
          <small className="hint">Completá al menos uno.</small><Err k="contact" />
          <div className="field"><label htmlFor="fProv" onClick={(e) => { e.preventDefault(); document.getElementById("fProv")?.focus(); }}>Provincia</label>
            <BrandSelect id="fProv" ariaLabel="Provincia" invalid={!!err.prov} value={f.prov} onChange={(v) => set("prov", v)}
              options={[{ value: "", label: "Elegí una opción" }, ...PT.provinces.map((p) => ({ value: p, label: p }))]} />
            <Err k="prov" /></div>
          <div className="field"><label htmlFor="fPep">Péptido de interés <em>(opcional)</em></label><input id="fPep" list="pepList" value={f.pep} onChange={(e) => set("pep", e.target.value)} />
            <datalist id="pepList">{peptides.map((p) => <option key={p.slug} value={p.name} />)}</datalist></div>
          <fieldset className="field"><legend>¿Cómo preferís la consulta?</legend>
            <div className="mod">
              {[["Teleconsulta", "Videollamada"], ["Presencial", "En consultorio"]].map(([v, d]) => (
                <label key={v}><input type="radio" name="mod" value={v} checked={f.mod === v} onChange={() => set("mod", v)} /><span><b>{v}</b><small>{d}</small></span></label>
              ))}
            </div>
          </fieldset>
          <div className="field"><label htmlFor="fMotivo">Motivo breve <em>(opcional)</em></label>
            <textarea id="fMotivo" maxLength={300} rows={3} value={f.motivo} onChange={(e) => set("motivo", e.target.value)} />
            <small className="hint row"><span>No incluyas historia clínica ni estudios.</span><span>{f.motivo.length}/300</span></small></div>
          <label className="check"><input type="checkbox" checked={f.adult} aria-invalid={!!err.adult || undefined} onChange={(e) => set("adult", e.target.checked)} /> <span>Soy mayor de 18 años.</span></label><Err k="adult" />
          <label className="check"><input type="checkbox" checked={f.c1} aria-invalid={!!err.c1 || undefined} onChange={(e) => set("c1", e.target.checked)} /> <span>Acepto que peptalk trate los datos que cargo, incluidos datos de salud, solo para gestionar esta derivación.</span></label><Err k="c1" />
          <label className="check"><input type="checkbox" checked={f.c2} aria-invalid={!!err.c2 || undefined} onChange={(e) => set("c2", e.target.checked)} /> <span>Acepto que peptalk comparta estos datos con el profesional que me va a contactar.</span></label><Err k="c2" />
          <button className="btn btn-orange btn-block" type="submit" disabled={sending}>{sending ? "Enviando…" : "Enviar pedido"}</button>
          <p className="form-msg" role="status">{msg}</p>
        </form>
      </div>
    </section>
  );
}

function Guide({ tag, title }: { tag: string; title: string }) {
  const r = useReveal<HTMLElement>();
  return <article className="guide" ref={r}><span className="tag">{tag}</span><h3>{title}</h3><p className="muted small">Próximamente</p></article>;
}
export function Guides() {
  return (
    <section className="wrap section" id="guias">
      <div className="sec-head"><div><span className="kicker">Aprender</span><h2>Guías para entender antes de preguntar</h2></div></div>
      <div className="guides">
        <Guide tag="Básicos" title="Péptidos 101: qué son y en qué se diferencian de otros medicamentos" />
        <Guide tag="Regulación" title="Qué significa «solo para investigación» (RUO) y por qué no es una aprobación" />
        <Guide tag="Argentina" title="Cómo se aprueba un medicamento en Argentina: el rol de la ANMAT" />
      </div>
    </section>
  );
}

function Step({ num, title, text }: { num: string; title: string; text: string }) {
  const r = useReveal<HTMLLIElement>();
  return <li ref={r}><span className="num">{num}</span><h3>{title}</h3><p>{text}</p></li>;
}
export function Method() {
  const d = useReveal<HTMLDivElement>();
  return (
    <section className="wrap section" id="metodo">
      <div className="sec-head"><div><span className="kicker">Cómo trabajamos</span><h2>Tres pasos para cada dato</h2></div></div>
      <ol className="method">
        <Step num="01" title="Buscamos fuentes primarias" text="Registros oficiales, resoluciones y estudios publicados. No usamos tiendas ni foros como fuente." />
        <Step num="02" title="Verifica peptalk lab y revisa un médico" text="Cada estado se contrasta con su fuente y la ficha pasa por revisión profesional." />
        <Step num="03" title="Re-verificamos y registramos cada cambio" text="Los estados cambian. Cada actualización queda con fecha para que sepas qué cambió." />
      </ol>
      <div className="disclaimer" ref={d}>
        <b>Información, no indicación</b>
        <p>Este contenido es informativo y no reemplaza la consulta con un profesional. No indicamos dosis, usos ni dónde conseguir productos. Si tenés una urgencia, llamá al 107 (SAME) o a tu servicio de emergencias.</p>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="foot">
      <div className="wrap foot-in">
        <div className="foot-brand">
          <img src="/brand/logo/peptalk-logo-white.svg" alt="peptalk" width={150} height={40} loading="lazy" />
          <p>Información sobre péptidos, con fuentes y fechas.</p>
          <div className="foot-social"><a href="https://x.com/Peptalkarg" target="_blank" rel="noopener" aria-label="peptalk en X"><XLogo /><span>@Peptalkarg</span></a></div>
        </div>
        <div><h4>Biblioteca</h4><a href="#biblioteca">Péptidos</a><a href="#sistemas">Sistemas</a><a href="#estados">Estados por agencia</a></div>
        <div><h4>Aprender</h4><a href="#novedades">Novedades</a><a href="#guias">Guías</a><a href="#estados">Cómo leer la evidencia</a></div>
        <div><h4>peptalk</h4><a href="#metodo">Metodología</a><a href="#derivacion">Derivación</a></div>
      </div>
      <div className="wrap foot-b">
        <span>peptalk no vende productos ni presta servicios médicos.</span>
        <span>© 2026 peptalk · Hecho en Argentina</span>
      </div>
    </footer>
  );
}

