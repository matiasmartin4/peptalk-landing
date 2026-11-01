// "Publicar en el sitio": dispara el workflow de GitHub que baja las fichas publicadas,
// regenera peptides.js y redeploya GitHub Pages. Sólo admin o editor.
// Secretos: GITHUB_TOKEN (fine-grained, Contents: write sobre el repo) y GITHUB_REPO (dueño/repo).
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: role } = await sb.rpc('pt_role');
  if (role !== 'admin' && role !== 'editor') return json({ error: 'sin permiso' }, 403);

  const res = await fetch(`https://api.github.com/repos/${Deno.env.get('GITHUB_REPO')}/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${Deno.env.get('GITHUB_TOKEN')}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'peptalk-backoffice',
    },
    body: JSON.stringify({ event_type: 'publicar' }),
  });
  return res.ok ? json({ ok: true }) : json({ error: `GitHub respondió ${res.status}` }, 502);
});
