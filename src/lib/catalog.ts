/* peptalk — catálogo: lee window.PT (data.js + peptides.js, que genera el backoffice)
   y arma los datos derivados que usa toda la landing. */

export type Agency = "ANMAT" | "FDA" | "EMA" | "WADA";
export type StatusInfo = { v: string; note?: string; source?: string; url?: string };
export type Ref = { title: string; source?: string; url: string };
export type RawPeptide = {
  slug: string; name: string; alias: string; sys: string; type: string; ev: string; evNote?: string;
  summary: string; summaryPlain?: string; status: Partial<Record<Agency, StatusInfo>>; refs?: Ref[]; checked: string;
  tags?: string[]; sequence?: string;
};
export type System = { id: string; name: string; desc: string; icon: string; zones: number[][] };
type PTData = {
  systems: System[]; featured: string[]; agencies: Agency[];
  agencyInfo: Record<Agency, { name: string; icon: string }>;
  statuses: { v: string; cls: string; desc: string }[];
  evidence: { v: string; name: string }[];
  provinces: string[];
  supabase?: { url: string; anonKey: string };
  peptides: RawPeptide[];
};

export const PT = (window as unknown as { PT: PTData }).PT;

export type Peptide = RawPeptide & {
  sysName: string; sysIcon: string;
  st: Record<string, string>;                       // estado por agencia visible ('Pendiente' si falta)
  stInfo: Record<string, StatusInfo | null>;
  haystack: string;
};

export const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
export const fmtDate = (iso?: string) => { if (!iso) return "—"; const d = iso.split("-"); return `${d[2]}/${d[1]}/${d[0]}`; };
export const host = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; } };
export const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

export const sysById: Record<string, System> = Object.fromEntries(PT.systems.map((s) => [s.id, s]));
export const statusCls: Record<string, string> = Object.fromEntries(PT.statuses.map((s) => [s.v, s.cls]));
export const evInfo: Record<string, { v: string; name: string }> = Object.fromEntries(PT.evidence.map((e) => [e.v, e]));
export const AGENCIES = PT.agencies;

export const peptides: Peptide[] = PT.peptides.map((p) => {
  const st = p.status || {}, sys = sysById[p.sys];
  return {
    ...p,
    ev: p.ev || "—",
    sysName: sys ? sys.name : "",
    sysIcon: sys ? sys.icon : "dna",
    st: Object.fromEntries(AGENCIES.map((a) => [a, (st[a] && st[a]!.v) || "Pendiente"])),
    stInfo: Object.fromEntries(AGENCIES.map((a) => [a, st[a] || null])),
    haystack: norm(`${p.name} ${p.alias} ${p.slug}`),
  };
});
export const bySlug: Record<string, Peptide> = Object.fromEntries(peptides.map((p) => [p.slug, p]));
export const sysCount: Record<string, number> = Object.fromEntries(PT.systems.map((s) => [s.id, peptides.filter((p) => p.sys === s.id).length]));

export const matches = (p: Peptide, q: string) => { const n = norm(q.trim()); return n.length < 2 || p.haystack.includes(n); };
export const pendingCount = (p: Peptide) => AGENCIES.filter((a) => p.st[a] === "Pendiente").length;
// estados que efectivamente aparecen en las agencias visibles (Pendiente siempre)
export const shownStatuses = PT.statuses.filter((s) => s.v === "Pendiente" || peptides.some((p) => AGENCIES.some((a) => p.st[a] === s.v)));
// textos que nombran las agencias: se arman con las visibles (configurables desde el backoffice)
export const agList = (tail = false) =>
  tail ? AGENCIES.join(", ") : AGENCIES.length > 1 ? `${AGENCIES.slice(0, -1).join(", ")} y ${AGENCIES[AGENCIES.length - 1]}` : AGENCIES[0];
export const lastChecked = peptides.reduce((m, p) => (p.checked > m ? p.checked : m), "");

/* el veredicto en palabras: qué dice ANMAT, que es lo que la gente viene a buscar */
export type Tone = "ok" | "cosm" | "no" | "inv" | "pend";
export const verdict = (p: Peptide): { tone: Tone; text: string } => {
  const v = p.st.ANMAT;
  if (v === "Aprobado") return { tone: "ok", text: "Aprobado en Argentina" };
  if (v === "Cosmético") return { tone: "cosm", text: "Ingrediente cosmético en Argentina" };
  if (v === "No aprobado") return { tone: "no", text: "Sin aprobación en Argentina" };
  if (v === "En investigación") return { tone: "inv", text: "En investigación en Argentina" };
  return { tone: "pend", text: "Argentina: lo estamos confirmando" };
};
