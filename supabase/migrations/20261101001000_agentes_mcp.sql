-- peptalk · acceso de agentes (Grok) por MCP.
-- Un admin genera un token para un usuario con rol "agente". El servidor MCP (función "mcp")
-- recibe ese token, busca a qué agente pertenece y trabaja como ese usuario: mismas reglas
-- (RLS y guardas) que si entrara al backoffice. Sólo se guarda el hash; el token se ve una vez.

create table agent_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  label text not null default '',                      -- p. ej. "Grok · API de xAI"
  token_hash text not null unique,                     -- sha256 en hex
  hint text not null,                                  -- últimos 4 caracteres, para reconocerlo
  created_by uuid references profiles default auth.uid(),
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
create index on agent_tokens (user_id);
create trigger audit_agent_tokens after insert or update or delete on agent_tokens for each row execute function pt_audit();

alter table agent_tokens enable row level security;
create policy "admin ve los tokens" on agent_tokens for select using (pt_is('admin'));
-- se crean y revocan sólo por las funciones de abajo
revoke insert, update, delete on agent_tokens from authenticated;

create function pt_token_hash(token text) returns text language sql immutable as $$
  select encode(sha256(convert_to(token, 'UTF8')), 'hex')
$$;

-- devuelve el token en claro una sola vez (no queda guardado)
create function pt_create_agent_token(agent uuid, label text default '') returns text
language plpgsql security definer set search_path = public as $$
declare tok text := 'ptk_' || replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
begin
  if not pt_is('admin') then raise exception 'sin permiso' using errcode = '42501'; end if;
  if not exists (select 1 from profiles where id = agent and role = 'agente') then
    raise exception 'los tokens son sólo para usuarios con rol agente';
  end if;
  insert into agent_tokens (user_id, label, token_hash, hint, created_by)
  values (agent, coalesce(label, ''), pt_token_hash(tok), right(tok, 4), auth.uid());
  return tok;
end $$;

create function pt_revoke_agent_token(token_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not pt_is('admin') then raise exception 'sin permiso' using errcode = '42501'; end if;
  update agent_tokens set revoked_at = now() where id = token_id and revoked_at is null;
  if not found then raise exception 'el token no existe o ya estaba revocado'; end if;
end $$;

-- la usa el servidor MCP (conectado como postgres, antes de asumir la identidad del agente)
create function pt_agent_for_token(token text) returns uuid
language sql security definer set search_path = public as $$
  update agent_tokens t set last_used_at = now()
  from profiles p
  where t.token_hash = pt_token_hash(token) and t.revoked_at is null
    and p.id = t.user_id and p.role = 'agente' and p.active
  returning t.user_id
$$;
revoke execute on function pt_agent_for_token(text) from anon, authenticated, public;
