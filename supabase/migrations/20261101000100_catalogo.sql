-- peptalk · catálogo: fichas, notas internas, imágenes y videos, documentos y borradores.

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
  name text not null check (length(trim(name)) > 0),
  alias text not null default '',
  sys text not null check (sys in ('cerebro', 'hormonas', 'inmune', 'corazon', 'digestivo', 'sexual', 'piel', 'huesos')),
  type text not null check (type in ('Péptido', 'Análogo peptídico', 'Polipéptido', 'Cosmético')),
  tags text[] not null default '{}',                  -- p. ej. 'nuevo', 'destacado'

  -- lo que se lee
  summary text not null default '',                   -- resumen de la ficha
  summary_plain text not null default '',             -- "en pocas palabras": más simple y explícito
  ev text not null default '—' check (ev in ('A', 'B', 'C', 'D', 'E', '—')),
  ev_note text not null default '',
  status jsonb not null check (pt_valid_status(status)),   -- {ANMAT: {v, note, source, url, confidence}, ...}
  refs jsonb not null default '[]' check (jsonb_typeof(refs) = 'array'),

  -- uso (oculto hasta que se decida publicarlo; la dosis además exige revisión médica)
  usage_process text not null default '',             -- cómo es el proceso de uso
  dosing text not null default '',                    -- dosis de referencia
  dosing_reviewed_by uuid references profiles,
  dosing_reviewed_at timestamptz,

  -- especificaciones
  cas_number text,
  molecular_formula text,
  molecular_weight numeric(10, 2),                    -- g/mol
  sequence text,
  preparation_form text,                              -- p. ej. polvo liofilizado
  storage text,                                       -- p. ej. refrigerado, 2–8 °C

  checked date not null default current_date,         -- última revisión de fuentes
  published boolean not null default false,
  sort int not null default 1000,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles,
  check (dosing = '' or dosing_reviewed_by is null or dosing_reviewed_at is not null)
);

-- si cambia la dosis, se pierde la revisión médica anterior
create function pt_dosing_guard() returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.dosing is distinct from old.dosing and new.dosing_reviewed_by is not distinct from old.dosing_reviewed_by then
    new.dosing_reviewed_by := null; new.dosing_reviewed_at := null;
  end if;
  -- la revisión la firma el propio médico (vía pt_review_dosing); nadie la asigna en nombre de otro
  if new.dosing_reviewed_by is not null and new.dosing_reviewed_by is distinct from (case when tg_op = 'UPDATE' then old.dosing_reviewed_by end)
     and (pt_role() is distinct from 'medico' or new.dosing_reviewed_by <> auth.uid()) then
    raise exception 'la dosis sólo la revisa un médico, con su propio usuario' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger dosing_guard before insert or update on peptides for each row execute function pt_dosing_guard();
create trigger touch_peptides before update on peptides for each row execute function pt_touch();
create trigger audit_peptides after insert or update or delete on peptides for each row execute function pt_audit();

-- el médico marca la dosis como revisada (sólo eso: no ve ni edita el resto del catálogo)
create function pt_review_dosing(peptide text) returns void language plpgsql security definer set search_path = public as $$
begin
  if not pt_is('medico') then raise exception 'sólo un médico revisa dosis' using errcode = '42501'; end if;
  update peptides set dosing_reviewed_by = auth.uid(), dosing_reviewed_at = now() where slug = peptide and dosing <> '';
  if not found then raise exception 'esa ficha no tiene dosis cargada'; end if;
end $$;

create table peptide_notes (
  id uuid primary key default gen_random_uuid(),
  slug text not null references peptides on update cascade on delete cascade,
  body text not null check (length(body) between 1 and 5000),
  source_url text check (source_url ~ '^https?://'),
  author uuid references profiles,
  created_at timestamptz not null default now()
);
create index on peptide_notes (slug, created_at desc);
create trigger audit_notes after insert or update or delete on peptide_notes for each row execute function pt_audit();

-- imágenes (bucket público "media") y videos (link a YouTube/Vimeo)
create table peptide_media (
  id uuid primary key default gen_random_uuid(),
  slug text not null references peptides on update cascade on delete cascade,
  kind text not null check (kind in ('imagen', 'video')),
  path text,                                          -- imagen: objeto en el bucket "media"
  url text check (url ~ '^https?://'),                -- video: link
  alt text not null default '',                       -- descripción para accesibilidad
  caption text not null default '',
  credit text not null default '',                    -- autor o licencia de la imagen
  is_cover boolean not null default false,
  sort int not null default 0,
  created_by uuid references profiles,
  created_at timestamptz not null default now(),
  check ((kind = 'imagen' and path is not null) or (kind = 'video' and url is not null))
);
create unique index peptide_media_one_cover on peptide_media (slug) where is_cover;
create index on peptide_media (slug, sort);
create trigger audit_media after insert or update or delete on peptide_media for each row execute function pt_audit();

-- documentos internos (bucket privado "docs"): papers, resoluciones, certificados de análisis
create table documents (
  id uuid primary key default gen_random_uuid(),
  slug text references peptides on update cascade on delete cascade,
  kind text not null default 'otro' check (kind in ('paper', 'regulatorio', 'coa', 'otro')),
  title text not null,
  path text not null unique,
  mime text,
  size bigint,
  uploaded_by uuid references profiles,
  created_at timestamptz not null default now()
);
create index on documents (slug, created_at desc);
create trigger audit_documents after insert or update or delete on documents for each row execute function pt_audit();

/* ---------- borradores: nada de un agente se aplica sin revisión ---------- */
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
create trigger audit_drafts after insert or update or delete on drafts for each row execute function pt_audit();

-- campos que un borrador puede tocar (la dosis y la publicación no: las decide una persona)
create function pt_draft_fields() returns text[] language sql immutable as $$
  select array['name', 'alias', 'sys', 'type', 'tags', 'summary', 'summary_plain', 'ev', 'ev_note', 'refs', 'checked',
               'usage_process', 'cas_number', 'molecular_formula', 'molecular_weight', 'sequence', 'preparation_form', 'storage']
$$;

create function pt_approve_draft(draft_id uuid, note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare d drafts; k text; v jsonb; row jsonb;
begin
  if not pt_is('admin', 'editor') then raise exception 'sin permiso' using errcode = '42501'; end if;
  select * into d from drafts where id = draft_id and state = 'pendiente' for update;
  if not found then raise exception 'el borrador no existe o ya se revisó'; end if;

  if d.kind = 'nota' then
    insert into peptide_notes (slug, body, source_url, author) values (d.slug, d.payload->>'body', d.source_url, d.author);

  elsif d.kind = 'cambio' then
    for k, v in select * from jsonb_each(coalesce(d.payload->'set', '{}')) loop
      if not k = any(pt_draft_fields()) then raise exception 'el borrador quiere cambiar un campo no permitido: %', k; end if;
      execute format('update peptides set %I = (jsonb_populate_record(null::peptides, jsonb_build_object(%L, $1))).%I where slug = $2', k, k, k)
        using v, d.slug;
    end loop;
    if d.payload ? 'status' then
      update peptides set status = status || (d.payload->'status') where slug = d.slug;
    end if;

  else  -- ficha nueva: entra sin publicar
    row := d.payload;
    for k in select jsonb_object_keys(row) loop
      if not (k = any(pt_draft_fields()) or k in ('slug', 'status')) then raise exception 'la ficha nueva trae un campo no permitido: %', k; end if;
    end loop;
    insert into peptides select (jsonb_populate_record(null::peptides,
      jsonb_build_object('ev', '—', 'alias', '', 'summary', '', 'summary_plain', '', 'ev_note', '', 'refs', '[]'::jsonb, 'tags', '{nuevo}'::text[],
                         'usage_process', '', 'dosing', '', 'checked', current_date, 'sort', 1000, 'created_at', now(), 'updated_at', now())
      || row || jsonb_build_object('published', false, 'updated_by', auth.uid()))).*;
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

/* ---------- permisos ---------- */
alter table peptides enable row level security;
alter table peptide_notes enable row level security;
alter table peptide_media enable row level security;
alter table documents enable row level security;
alter table drafts enable row level security;

create policy "equipo lee el catálogo" on peptides for select using (pt_is('admin', 'editor', 'agente'));
create policy "editores cargan fichas" on peptides for insert with check (pt_is('admin', 'editor'));
create policy "editores editan fichas" on peptides for update using (pt_is('admin', 'editor')) with check (pt_is('admin', 'editor'));
create policy "admin borra fichas" on peptides for delete using (pt_is('admin'));

create policy "equipo lee notas" on peptide_notes for select using (pt_is('admin', 'editor', 'agente'));
create policy "editores escriben notas" on peptide_notes for insert with check (pt_is('admin', 'editor') and author = auth.uid());
create policy "autor o admin borra nota" on peptide_notes for delete using (pt_is('admin') or (pt_is('editor') and author = auth.uid()));

create policy "equipo ve imágenes y videos" on peptide_media for select using (pt_is('admin', 'editor', 'agente'));
create policy "editores cargan imágenes y videos" on peptide_media for insert with check (pt_is('admin', 'editor') and created_by = auth.uid());
create policy "editores ordenan imágenes y videos" on peptide_media for update using (pt_is('admin', 'editor')) with check (pt_is('admin', 'editor'));
create policy "editores borran imágenes y videos" on peptide_media for delete using (pt_is('admin', 'editor'));

create policy "equipo lee documentos" on documents for select using (pt_is('admin', 'editor', 'agente'));
create policy "editores suben documentos" on documents for insert with check (pt_is('admin', 'editor') and uploaded_by = auth.uid());
create policy "editores borran documentos" on documents for delete using (pt_is('admin', 'editor'));

create policy "equipo lee borradores" on drafts for select using (pt_is('admin', 'editor', 'agente'));
create policy "equipo propone borradores" on drafts for insert
  with check (pt_is('admin', 'editor', 'agente') and author = auth.uid() and state = 'pendiente' and reviewed_by is null);
