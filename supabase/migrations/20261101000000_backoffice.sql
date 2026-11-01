-- peptalk · backoffice, etapa 1: usuarios con rol, catálogo, notas, documentos,
-- borradores (lo que propone Grok u otro agente), contactos e historial.
-- Los permisos viven en la base (RLS): el navegador sólo ve lo que su rol permite.

create extension if not exists pgcrypto;

/* ---------- usuarios y roles ---------- */
create type pt_role as enum ('admin', 'editor', 'medico', 'agente');

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  email text not null,
  name text not null default '',
  role pt_role not null default 'editor',
  active boolean not null default false,          -- nadie entra hasta que un admin lo activa
  created_at timestamptz not null default now()
);

create function pt_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, name) values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', ''));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function pt_new_user();

-- rol del usuario actual, sólo si está activo
create function pt_role() returns pt_role language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid() and active
$$;
create function pt_is(variadic roles pt_role[]) returns boolean language sql stable as $$
  select coalesce(pt_role() = any(roles), false)
$$;

/* ---------- catálogo ---------- */
create function pt_valid_status(s jsonb) returns boolean language plpgsql immutable as $$
declare a text; v text;
begin
  foreach a in array array['ANMAT', 'FDA', 'EMA', 'WADA'] loop
    v := s->a->>'v';
    if v is null or v not in ('Aprobado', 'En investigación', 'No aprobado', 'Prohibido', 'Cosmético', 'No listado', 'Pendiente') then return false; end if;
    if a = 'WADA' and v not in ('Prohibido', 'No listado', 'Pendiente') then return false; end if;
    if v <> 'Pendiente' and coalesce(s->a->>'url', '') !~ '^https?://' then return false; end if;
  end loop;
  return true;
end $$;

create table peptides (
  slug text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  alias text not null default '',
  sys text not null check (sys in ('cerebro', 'hormonas', 'inmune', 'corazon', 'digestivo', 'sexual', 'piel', 'huesos')),
  type text not null check (type in ('Péptido', 'Análogo peptídico', 'Polipéptido', 'Cosmético')),
  ev text not null default '—' check (ev in ('A', 'B', 'C', 'D', 'E', '—')),
  ev_note text not null default '',
  summary text not null default '',
  status jsonb not null check (pt_valid_status(status)),   -- {ANMAT: {v, note, source, url, confidence}, ...}
  refs jsonb not null default '[]' check (jsonb_typeof(refs) = 'array'),
  checked date not null default current_date,
  published boolean not null default false,
  sort int not null default 1000,
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles
);

create table peptide_notes (
  id uuid primary key default gen_random_uuid(),
  slug text not null references peptides on update cascade on delete cascade,
  body text not null check (length(body) between 1 and 5000),
  source_url text check (source_url ~ '^https?://'),
  author uuid references profiles,
  created_at timestamptz not null default now()
);

create table documents (
  id uuid primary key default gen_random_uuid(),
  slug text not null references peptides on update cascade on delete cascade,
  title text not null,
  path text not null unique,                      -- objeto en el bucket privado "docs"
  mime text,
  size bigint,
  uploaded_by uuid references profiles,
  created_at timestamptz not null default now()
);

/* ---------- borradores: nada de un agente se publica sin revisión ---------- */
create table drafts (
  id uuid primary key default gen_random_uuid(),
  slug text references peptides on update cascade on delete cascade,  -- null en 'nuevo'
  kind text not null check (kind in ('nota', 'cambio', 'nuevo')),
  payload jsonb not null,
  source_url text check (source_url ~ '^https?://'),
  reason text not null default '',
  author uuid not null default auth.uid() references profiles,
  state text not null default 'pendiente' check (state in ('pendiente', 'aprobado', 'descartado')),
  review_note text,
  reviewed_by uuid references profiles,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (kind = 'nuevo' or slug is not null)
);
create index on drafts (state, created_at desc);

-- aplica un borrador. 'cambio' admite payload {set: {alias, summary, ev, ev_note, refs, checked, name, sys, type}, status: {AGENCIA: {...}}}
create function pt_approve_draft(draft_id uuid, note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare d drafts; s jsonb;
begin
  if not pt_is('admin', 'editor') then raise exception 'sin permiso' using errcode = '42501'; end if;
  select * into d from drafts where id = draft_id and state = 'pendiente' for update;
  if not found then raise exception 'el borrador no existe o ya se revisó'; end if;

  if d.kind = 'nota' then
    insert into peptide_notes (slug, body, source_url, author) values (d.slug, d.payload->>'body', d.source_url, d.author);
  elsif d.kind = 'cambio' then
    s := coalesce(d.payload->'set', '{}');
    update peptides set
      name = coalesce(s->>'name', name), alias = coalesce(s->>'alias', alias), sys = coalesce(s->>'sys', sys),
      type = coalesce(s->>'type', type), ev = coalesce(s->>'ev', ev), ev_note = coalesce(s->>'ev_note', ev_note),
      summary = coalesce(s->>'summary', summary), refs = coalesce(s->'refs', refs),
      checked = coalesce((s->>'checked')::date, checked),
      status = status || coalesce(d.payload->'status', '{}'),
      updated_at = now(), updated_by = auth.uid()
    where slug = d.slug;
  else
    s := d.payload;
    insert into peptides (slug, name, alias, sys, type, ev, ev_note, summary, status, refs, published, updated_by)
    values (s->>'slug', s->>'name', coalesce(s->>'alias', ''), s->>'sys', s->>'type', coalesce(s->>'ev', '—'),
            coalesce(s->>'ev_note', ''), coalesce(s->>'summary', ''), s->'status', coalesce(s->'refs', '[]'), false, auth.uid());
  end if;

  update drafts set state = 'aprobado', review_note = note, reviewed_by = auth.uid(), reviewed_at = now() where id = draft_id;
end $$;

create function pt_reject_draft(draft_id uuid, note text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not pt_is('admin', 'editor') then raise exception 'sin permiso' using errcode = '42501'; end if;
  update drafts set state = 'descartado', review_note = note, reviewed_by = auth.uid(), reviewed_at = now()
  where id = draft_id and state = 'pendiente';
  if not found then raise exception 'el borrador no existe o ya se revisó'; end if;
end $$;

/* ---------- contactos (newsletter y pedidos de derivación) ---------- */
create table leads (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('newsletter', 'derivacion')),
  name text, email text, phone text, province text, peptide text, modality text, message text,
  consent jsonb not null default '{}',
  state text not null default 'nuevo' check (state in ('nuevo', 'contactado', 'derivado', 'cerrado', 'baja')),
  doctor uuid references profiles,
  internal_note text,
  created_at timestamptz not null default now()
);
create unique index leads_newsletter_email on leads (lower(email)) where kind = 'newsletter';
create index on leads (kind, state, created_at desc);

-- único punto de entrada público: valida y guarda (el sitio no puede leer ni tocar la tabla)
create function pt_submit_lead(p jsonb) returns void language plpgsql security definer set search_path = public as $$
declare kind text := p->>'kind'; email text := nullif(trim(p->>'email'), ''); phone text := nullif(trim(p->>'phone'), '');
begin
  if email is not null and (email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' or length(email) > 200) then raise exception 'email inválido'; end if;
  if kind = 'newsletter' then
    if email is null then raise exception 'falta el email'; end if;
    insert into leads (kind, email) values ('newsletter', lower(email)) on conflict do nothing;
  elsif kind = 'derivacion' then
    if coalesce(trim(p->>'name'), '') = '' then raise exception 'falta el nombre'; end if;
    if email is null and phone is null then raise exception 'falta un contacto'; end if;
    if not coalesce((p->'consent'->>'adult')::boolean and (p->'consent'->>'c1')::boolean and (p->'consent'->>'c2')::boolean, false) then
      raise exception 'falta el consentimiento';
    end if;
    insert into leads (kind, name, email, phone, province, peptide, modality, message, consent)
    values ('derivacion', left(trim(p->>'name'), 120), email, left(phone, 40), left(p->>'prov', 60), left(p->>'pep', 80),
            left(p->>'mod', 20), left(p->>'motivo', 300), p->'consent' || jsonb_build_object('at', now()));
  else
    raise exception 'tipo inválido';
  end if;
end $$;

/* ---------- historial de cambios ---------- */
create table audit (
  id bigint generated always as identity primary key,
  tbl text not null, row_key text not null, action text not null,
  actor uuid, old jsonb, new jsonb,
  at timestamptz not null default now()
);
create index on audit (tbl, row_key, at desc);

create function pt_audit() returns trigger language plpgsql security definer set search_path = public as $$
declare r jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end; k text := coalesce(r->>'id', r->>'slug');
begin
  insert into audit (tbl, row_key, action, actor, old, new)
  values (tg_table_name, k, lower(tg_op), auth.uid(),
          case when tg_op <> 'INSERT' then to_jsonb(old) end, case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return coalesce(new, old);
end $$;
create trigger audit_peptides after insert or update or delete on peptides for each row execute function pt_audit();
create trigger audit_notes after insert or update or delete on peptide_notes for each row execute function pt_audit();
create trigger audit_documents after insert or update or delete on documents for each row execute function pt_audit();
create trigger audit_drafts after insert or update or delete on drafts for each row execute function pt_audit();
create trigger audit_leads after update or delete on leads for each row execute function pt_audit();
create trigger audit_profiles after update or delete on profiles for each row execute function pt_audit();

create function pt_touch() returns trigger language plpgsql as $$
begin new.updated_at := now(); new.updated_by := coalesce(auth.uid(), new.updated_by); return new; end $$;
create trigger touch_peptides before update on peptides for each row execute function pt_touch();

/* ---------- permisos (RLS) ---------- */
alter table profiles enable row level security;
alter table peptides enable row level security;
alter table peptide_notes enable row level security;
alter table documents enable row level security;
alter table drafts enable row level security;
alter table leads enable row level security;
alter table audit enable row level security;

create policy "uno se ve a sí mismo" on profiles for select using (id = auth.uid() or pt_is('admin', 'editor'));
create policy "admin gestiona usuarios" on profiles for update using (pt_is('admin')) with check (pt_is('admin'));

create policy "equipo lee el catálogo" on peptides for select using (pt_is('admin', 'editor', 'agente'));
create policy "editores cargan" on peptides for insert with check (pt_is('admin', 'editor'));
create policy "editores editan" on peptides for update using (pt_is('admin', 'editor')) with check (pt_is('admin', 'editor'));
create policy "admin borra" on peptides for delete using (pt_is('admin'));

create policy "equipo lee notas" on peptide_notes for select using (pt_is('admin', 'editor', 'agente'));
create policy "editores escriben notas" on peptide_notes for insert with check (pt_is('admin', 'editor') and author = auth.uid());
create policy "autor o admin borra nota" on peptide_notes for delete using (pt_is('admin') or (pt_is('editor') and author = auth.uid()));

create policy "equipo lee documentos" on documents for select using (pt_is('admin', 'editor', 'agente'));
create policy "editores suben" on documents for insert with check (pt_is('admin', 'editor') and uploaded_by = auth.uid());
create policy "editores borran documentos" on documents for delete using (pt_is('admin', 'editor'));

create policy "equipo lee borradores" on drafts for select using (pt_is('admin', 'editor', 'agente'));
create policy "equipo propone" on drafts for insert
  with check (pt_is('admin', 'editor', 'agente') and author = auth.uid() and state = 'pendiente' and reviewed_by is null);

create policy "admin ve contactos" on leads for select using (pt_is('admin') or (pt_is('medico') and doctor = auth.uid()));
create policy "admin gestiona contactos" on leads for update using (pt_is('admin')) with check (pt_is('admin'));
create policy "médico actualiza los suyos" on leads for update using (pt_is('medico') and doctor = auth.uid()) with check (pt_is('medico') and doctor = auth.uid());

create policy "admin ve historial" on audit for select using (pt_is('admin', 'editor'));

-- el médico sólo puede tocar estado y nota de sus contactos
revoke update on leads from authenticated;
grant update (state, internal_note, doctor) on leads to authenticated;
create function pt_leads_guard() returns trigger language plpgsql as $$
begin
  if pt_role() = 'medico' and new.doctor is distinct from old.doctor then raise exception 'sin permiso' using errcode = '42501'; end if;
  return new;
end $$;
create trigger leads_guard before update on leads for each row execute function pt_leads_guard();

-- el rol y la activación sólo los cambia un admin, y nadie se baja a sí mismo
revoke update on profiles from authenticated;
grant update (name, role, active) on profiles to authenticated;
create function pt_profiles_guard() returns trigger language plpgsql as $$
begin
  if new.id = auth.uid() and (new.role <> old.role or not new.active) then raise exception 'no podés cambiar tu propio rol'; end if;
  return new;
end $$;
create trigger profiles_guard before update on profiles for each row execute function pt_profiles_guard();

revoke all on function pt_approve_draft(uuid, text), pt_reject_draft(uuid, text) from public, anon;
grant execute on function pt_approve_draft(uuid, text), pt_reject_draft(uuid, text) to authenticated;
revoke all on function pt_submit_lead(jsonb) from public;
grant execute on function pt_submit_lead(jsonb) to anon, authenticated;

/* ---------- archivos: bucket privado ---------- */
insert into storage.buckets (id, name, public, file_size_limit) values ('docs', 'docs', false, 26214400) on conflict do nothing;
create policy "equipo lee archivos" on storage.objects for select using (bucket_id = 'docs' and pt_is('admin', 'editor', 'agente'));
create policy "editores suben archivos" on storage.objects for insert with check (bucket_id = 'docs' and pt_is('admin', 'editor'));
create policy "editores borran archivos" on storage.objects for delete using (bucket_id = 'docs' and pt_is('admin', 'editor'));
