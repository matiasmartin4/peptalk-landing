// Servidor MCP para Grok (o cualquier cliente MCP): lee el catálogo y deja propuestas.
// Transporte HTTP "streamable" sin sesión: cada POST trae un mensaje JSON-RPC y se responde en JSON.
// Autenticación: Authorization: Bearer ptk_… (token generado en Usuarios del backoffice).
// Cada llamada corre en una transacción con la identidad del agente (rol authenticated +
// sub del agente), así que valen las mismas reglas de la base que en el backoffice:
// un agente lee y propone; aprobar y publicar lo hace una persona.
import postgres from 'npm:postgres@3.4.5';

const sql = postgres(Deno.env.get('SUPABASE_DB_URL')!, { prepare: false, max: 3, idle_timeout: 20 });
const PROTOCOLS = ['2025-06-18', '2025-03-26', '2024-11-05'];

type Tx = postgres.TransactionSql;
type Args = Record<string, unknown>;

const STATUS = ['Aprobado', 'En investigación', 'No aprobado', 'Prohibido', 'Cosmético', 'No listado', 'Pendiente'];
const fuente = { type: 'string', description: 'Link a la fuente primaria (paper, resolución, ficha de la agencia). Empieza con https://' };

const TOOLS = [
  {
    name: 'buscar_peptidos',
    description: 'Lista las fichas del catálogo (publicadas o no). Filtra por nombre, alias o slug. Usala antes de proponer para no duplicar fichas.',
    inputSchema: { type: 'object', properties: { texto: { type: 'string', description: 'Parte del nombre, alias o slug. Vacío = todas.' } } },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'leer_ficha',
    description: 'Ficha completa de un péptido: resumen, estados por agencia (ANMAT, FDA, EMA, WADA) con fuente, evidencia, referencias, especificaciones, notas internas y propuestas pendientes sobre esa ficha.',
    inputSchema: { type: 'object', properties: { slug: { type: 'string' } }, required: ['slug'] },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'referencia',
    description: 'Valores válidos: campos que se pueden proponer, sistemas, tipos, niveles de evidencia y estados por agencia. Consultala antes de proponer cambios o fichas nuevas.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'proponer_nota',
    description: 'Deja una nota interna sobre una ficha (un hallazgo, un paper nuevo, una duda). Queda pendiente hasta que un editor la apruebe.',
    inputSchema: {
      type: 'object',
      properties: { slug: { type: 'string' }, texto: { type: 'string' }, fuente_url: fuente, motivo: { type: 'string' } },
      required: ['slug', 'texto'],
    },
  },
  {
    name: 'proponer_cambio',
    description: 'Propone cambiar campos de una ficha existente y/o el estado regulatorio de una agencia. No se aplica hasta que un editor lo apruebe. La dosis y la publicación no se pueden proponer.',
    inputSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string' },
        campos: { type: 'object', description: 'Campo → valor nuevo. Ver "referencia" para los campos permitidos.' },
        estados: {
          type: 'object',
          description: 'Agencia → {v, url, note}. v es uno de: ' + STATUS.join(', ') + '. url obligatoria salvo "Pendiente".',
        },
        motivo: { type: 'string', description: 'Por qué el cambio, en una o dos oraciones.' },
        fuente_url: fuente,
      },
      required: ['slug', 'motivo'],
    },
  },
  {
    name: 'proponer_peptido_nuevo',
    description: 'Propone una ficha nueva. Entra sin publicar y sólo si un editor la aprueba. Obligatorios: slug (minúsculas y guiones), name, sys, type y status con las cuatro agencias.',
    inputSchema: {
      type: 'object',
      properties: { ficha: { type: 'object', description: 'Campos de la ficha; ver "referencia".' }, motivo: { type: 'string' }, fuente_url: fuente },
      required: ['ficha', 'motivo'],
    },
  },
  {
    name: 'proponer_novedad',
    description: 'Propone una novedad para el sitio y el newsletter semanal (resolución, estudio, alerta). Una persona la revisa antes de publicarla.',
    inputSchema: {
      type: 'object',
      properties: {
        titulo: { type: 'string' },
        resumen: { type: 'string', description: 'Dos o tres líneas, en castellano rioplatense.' },
        tipo: { type: 'string', enum: ['regulatorio', 'estudio', 'alerta', 'mercado'] },
        fuente_nombre: { type: 'string' },
        fuente_url: fuente,
        fecha: { type: 'string', description: 'Fecha del hecho, AAAA-MM-DD.' },
        peptidos: { type: 'array', items: { type: 'string' }, description: 'Slugs de las fichas relacionadas.' },
      },
      required: ['titulo', 'resumen', 'tipo', 'fuente_url'],
    },
  },
  {
    name: 'mis_propuestas',
    description: 'Tus propuestas (notas, cambios, fichas nuevas y novedades) con su estado y el comentario del revisor. Sirve para aprender qué se aprueba y qué no.',
    inputSchema: { type: 'object', properties: { estado: { type: 'string', enum: ['pendiente', 'aprobado', 'descartado', 'todas'] } } },
    annotations: { readOnlyHint: true },
  },
];

class Uso extends Error {}   // error del pedido: se le devuelve al agente para que corrija
const str = (a: Args, k: string, required = false) => {
  const v = a[k];
  if (v == null || v === '') { if (required) throw new Uso(`falta "${k}"`); return null; }
  if (typeof v !== 'string') throw new Uso(`"${k}" tiene que ser texto`);
  return v.trim();
};
const obj = (a: Args, k: string) => {
  const v = a[k];
  if (v == null) return null;
  if (typeof v !== 'object' || Array.isArray(v)) throw new Uso(`"${k}" tiene que ser un objeto`);
  return v as Args;
};
async function draftFields(tx: Tx) {
  const [{ f }] = await tx`select pt_draft_fields() as f`;
  return f as string[];
}
async function exists(tx: Tx, slug: string) {
  const r = await tx`select 1 from peptides where slug = ${slug}`;
  if (!r.length) throw new Uso(`no hay ninguna ficha "${slug}"; buscala con buscar_peptidos`);
}

const handlers: Record<string, (tx: Tx, a: Args) => Promise<unknown>> = {
  async buscar_peptidos(tx, a) {
    const q = `%${str(a, 'texto') ?? ''}%`;
    return tx`select slug, name, alias, sys, type, ev, published,
                     (select jsonb_object_agg(k, v->>'v') from jsonb_each(status) s(k, v)) as estados, updated_at
              from peptides where name ilike ${q} or alias ilike ${q} or slug ilike ${q}
              order by sort, name limit 100`;
  },

  async leer_ficha(tx, a) {
    const slug = str(a, 'slug', true)!;
    const [p] = await tx`select * from peptides where slug = ${slug}`;
    if (!p) throw new Uso(`no hay ninguna ficha "${slug}"`);
    const notas = await tx`select body, source_url, created_at from peptide_notes where slug = ${slug} order by created_at desc limit 20`;
    const pendientes = await tx`select kind, payload, reason, created_at from drafts where slug = ${slug} and state = 'pendiente' order by created_at desc`;
    return { ficha: p, notas, propuestas_pendientes: pendientes };
  },

  async referencia(tx) {
    return {
      campos_proponibles: await draftFields(tx),
      sistemas: ['cerebro', 'hormonas', 'inmune', 'corazon', 'digestivo', 'sexual', 'piel', 'huesos'],
      tipos: ['Péptido', 'Análogo peptídico', 'Polipéptido', 'Cosmético'],
      evidencia: { A: 'ensayos controlados replicados', B: 'al menos un ensayo controlado', C: 'estudios humanos no controlados', D: 'sólo preclínico', E: 'sin estudios publicados', '—': 'pendiente de revisión' },
      estados_por_agencia: { ANMAT: STATUS, FDA: STATUS, EMA: STATUS, WADA: ['Prohibido', 'No listado', 'Pendiente'] },
      formato_status: '{"ANMAT": {"v": "Aprobado", "url": "https://…", "note": "…"}, …}; url obligatoria salvo "Pendiente"',
      formato_refs: '[{"title": "…", "url": "https://…", "source": "PubMed"}]',
      secuencia: 'una letra por aminoácido (ACDEFGHIKLMNPQRSTVWY), X para no estándar',
    };
  },

  async proponer_nota(tx, a) {
    const slug = str(a, 'slug', true)!;
    await exists(tx, slug);
    const [d] = await tx`insert into drafts (slug, kind, payload, source_url, reason)
      values (${slug}, 'nota', ${tx.json({ body: str(a, 'texto', true) })}, ${str(a, 'fuente_url')}, ${str(a, 'motivo') ?? ''})
      returning id, state`;
    return { ok: true, borrador: d.id, estado: d.state };
  },

  async proponer_cambio(tx, a) {
    const slug = str(a, 'slug', true)!;
    await exists(tx, slug);
    const campos = obj(a, 'campos') ?? {}, estados = obj(a, 'estados');
    const fields = await draftFields(tx);
    const malos = Object.keys(campos).filter((k) => !fields.includes(k));
    if (malos.length) throw new Uso(`no se pueden proponer: ${malos.join(', ')}. Permitidos: ${fields.join(', ')}`);
    if (!Object.keys(campos).length && !estados) throw new Uso('no hay nada para cambiar: mandá "campos" o "estados"');
    const payload: Args = { set: campos };
    if (estados) payload.status = estados;
    const [d] = await tx`insert into drafts (slug, kind, payload, source_url, reason)
      values (${slug}, 'cambio', ${tx.json(payload)}, ${str(a, 'fuente_url')}, ${str(a, 'motivo', true)})
      returning id, state`;
    return { ok: true, borrador: d.id, estado: d.state };
  },

  async proponer_peptido_nuevo(tx, a) {
    const ficha = obj(a, 'ficha');
    if (!ficha) throw new Uso('falta "ficha"');
    const fields = await draftFields(tx);
    const malos = Object.keys(ficha).filter((k) => !fields.includes(k) && k !== 'slug' && k !== 'status');
    if (malos.length) throw new Uso(`la ficha trae campos no permitidos: ${malos.join(', ')}`);
    for (const k of ['slug', 'name', 'sys', 'type', 'status']) if (ficha[k] == null) throw new Uso(`a la ficha le falta "${k}"`);
    const ya = await tx`select slug from peptides where slug = ${String(ficha.slug)}`;
    if (ya.length) throw new Uso(`ya existe la ficha "${ficha.slug}"; proponé un cambio en su lugar`);
    const [d] = await tx`insert into drafts (kind, payload, source_url, reason)
      values ('nuevo', ${tx.json(ficha)}, ${str(a, 'fuente_url')}, ${str(a, 'motivo', true)})
      returning id, state`;
    return { ok: true, borrador: d.id, estado: d.state };
  },

  async proponer_novedad(tx, a) {
    const slugs = (a.peptidos ?? []) as string[];
    if (!Array.isArray(slugs)) throw new Uso('"peptidos" tiene que ser una lista de slugs');
    for (const s of slugs) await exists(tx, s);
    const fecha = str(a, 'fecha');
    if (fecha && !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new Uso('"fecha" va como AAAA-MM-DD');
    const [n] = await tx`insert into news (title, summary, kind, source_name, source_url, happened_on)
      values (${str(a, 'titulo', true)}, ${str(a, 'resumen', true)}, ${str(a, 'tipo', true)}, ${str(a, 'fuente_nombre') ?? ''},
              ${str(a, 'fuente_url', true)}, ${fecha})
      returning id, state`;
    for (const s of slugs) await tx`insert into news_peptides (news_id, slug) values (${n.id}, ${s})`;
    return { ok: true, novedad: n.id, estado: n.state };
  },

  async mis_propuestas(tx, a) {
    const e = str(a, 'estado') ?? 'todas';
    const todas = e === 'todas';
    const borradores = await tx`select id, kind, slug, coalesce(payload->>'name', '') as nombre, reason, state, review_note, created_at, reviewed_at
      from drafts where author = auth.uid() and (${todas} or state = ${e}) order by created_at desc limit 50`;
    const estadoNovedad = { pendiente: 'propuesta', aprobado: 'aprobada', descartado: 'descartada' }[e] ?? '';
    const novedades = await tx`select id, title, kind, state, published, created_at, reviewed_at
      from news where author = auth.uid() and (${todas} or state = ${estadoNovedad}) order by created_at desc limit 50`;
    return { borradores, novedades };
  },
};

/* ---------- JSON-RPC ---------- */
type Msg = { jsonrpc: '2.0'; id?: string | number | null; method?: string; params?: Args };
const ok = (id: Msg['id'], result: unknown) => ({ jsonrpc: '2.0', id, result });
const fail = (id: Msg['id'], code: number, message: string) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });
const text = (v: unknown, isError = false) => ({ content: [{ type: 'text', text: typeof v === 'string' ? v : JSON.stringify(v, null, 1) }], isError });

async function asAgent<T>(uid: string, fn: (tx: Tx) => Promise<T>) {
  return await sql.begin(async (tx) => {
    const claims = JSON.stringify({ sub: uid, role: 'authenticated' });
    await tx`select set_config('role', 'authenticated', true), set_config('request.jwt.claims', ${claims}, true),
                    set_config('request.jwt.claim.sub', ${uid}, true)`;
    return await fn(tx);
  }) as T;
}

async function handle(m: Msg, uid: string) {
  switch (m.method) {
    case 'initialize': {
      const asked = String(m.params?.protocolVersion ?? '');
      return ok(m.id, {
        protocolVersion: PROTOCOLS.includes(asked) ? asked : PROTOCOLS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'peptalk', version: '1.0.0' },
        instructions: 'Catálogo de péptidos de peptalk (Argentina). Podés leer todo y proponer notas, cambios, fichas nuevas y novedades; ' +
          'nada se publica sin revisión de una persona. Siempre con fuente primaria (ANMAT, FDA, EMA, WADA, PubMed). ' +
          'Escribí en castellano rioplatense, sin indicar dosis ni dónde comprar.',
      });
    }
    case 'ping': return ok(m.id, {});
    case 'tools/list': return ok(m.id, { tools: TOOLS });
    case 'tools/call': {
      const name = String(m.params?.name ?? ''), fn = handlers[name];
      if (!fn) return fail(m.id, -32602, `herramienta desconocida: ${name}`);
      try { return ok(m.id, text(await asAgent(uid, (tx) => fn(tx, (m.params?.arguments ?? {}) as Args)))); }
      catch (e) {
        // los errores de la base (permisos, validaciones) también le sirven al agente para corregir
        const msg = e instanceof Uso ? e.message : (e as { message?: string }).message ?? 'error';
        if (!(e instanceof Uso)) console.error(name, e);
        return ok(m.id, text(`No se pudo: ${msg}`, true));
      }
    }
    default: return fail(m.id, -32601, `método no soportado: ${m.method}`);
  }
}

const reply = (body: unknown, status = 200) =>
  new Response(body == null ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return reply(fail(null, -32000, 'usá POST'), 405);

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const [row] = token.startsWith('ptk_') ? await sql`select pt_agent_for_token(${token}) as uid` : [];
  if (!row?.uid) {
    return new Response(JSON.stringify(fail(null, -32001, 'token inválido o revocado')), {
      status: 401, headers: { 'Content-Type': 'application/json', 'WWW-Authenticate': 'Bearer' },
    });
  }

  let body: Msg | Msg[];
  try { body = await req.json(); } catch { return reply(fail(null, -32700, 'JSON inválido'), 400); }
  const msgs = Array.isArray(body) ? body : [body];
  const out = [];
  for (const m of msgs) if (m.id !== undefined && m.method) out.push(await handle(m, row.uid));
  // sólo notificaciones (p. ej. notifications/initialized): 202 sin cuerpo
  if (!out.length) return reply(null, 202);
  return reply(Array.isArray(body) ? out : out[0]);
});
