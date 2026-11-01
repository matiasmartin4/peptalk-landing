-- peptalk · novedades y newsletter semanal.
-- Una novedad es un hecho con fuente (resolución, estudio, alerta). Grok las propone;
-- una persona las aprueba. El newsletter se arma en el backoffice: banner, cuerpo con
-- formato e imágenes (editor tipo documento) y las novedades / fichas nuevas de la semana.

create table news (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  summary text not null default '',                    -- dos o tres líneas
  body text not null default '',
  kind text not null default 'estudio' check (kind in ('regulatorio', 'estudio', 'alerta', 'mercado', 'peptalk')),
  source_name text not null default '',
  source_url text check (source_url ~ '^https?://'),
  happened_on date,                                    -- fecha del hecho (no de la carga)
  image_path text,                                     -- bucket "media"
  state text not null default 'propuesta' check (state in ('propuesta', 'aprobada', 'descartada')),
  published boolean not null default false,            -- visible en el sitio (sólo si está aprobada)
  author uuid not null default auth.uid() references profiles,
  reviewed_by uuid references profiles,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles,
  check (not published or state = 'aprobada'),
  check (state = 'propuesta' or kind = 'peptalk' or source_url is not null)   -- toda novedad aprobada lleva fuente
);
create index on news (state, happened_on desc);

create table news_peptides (
  news_id uuid not null references news on delete cascade,
  slug text not null references peptides on update cascade on delete cascade,
  primary key (news_id, slug)
);

create table newsletter_issues (
  id uuid primary key default gen_random_uuid(),
  title text not null,                                 -- título interno / de la página
  subject text not null default '',                    -- asunto del mail
  preheader text not null default '',                  -- texto de vista previa en la bandeja
  week_of date not null,
  banner_path text,                                    -- bucket "media"
  banner_alt text not null default '',
  body jsonb not null default '{"type": "doc", "content": []}',   -- documento del editor (texto con formato, imágenes)
  body_html text not null default '',                  -- versión lista para mail y web, generada desde body
  state text not null default 'borrador' check (state in ('borrador', 'lista', 'enviada')),
  sent_at timestamptz,
  sent_count int,
  created_by uuid not null default auth.uid() references profiles,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles,
  check (state <> 'enviada' or sent_at is not null)
);
create index on newsletter_issues (week_of desc);

-- lo que entra en cada edición, en orden: novedades, fichas (nuevas o destacadas) o un bloque libre
create table newsletter_items (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references newsletter_issues on delete cascade,
  sort int not null default 0,
  kind text not null check (kind in ('novedad', 'peptido')),
  news_id uuid references news on delete cascade,
  slug text references peptides on update cascade on delete cascade,
  heading text,                                        -- reemplaza el título original si hace falta
  blurb text,                                          -- texto propio para esta edición
  check ((kind = 'novedad' and news_id is not null) or (kind = 'peptido' and slug is not null))
);
create index on newsletter_items (issue_id, sort);

-- una edición enviada no se toca
create function pt_issue_guard() returns trigger language plpgsql as $$
begin
  if old.state = 'enviada' then raise exception 'esa edición ya se envió' using errcode = '42501'; end if;
  return new;
end $$;
create trigger issue_guard before update on newsletter_issues for each row execute function pt_issue_guard();
create function pt_issue_items_guard() returns trigger language plpgsql as $$
begin
  if (select state from newsletter_issues where id = coalesce(new.issue_id, old.issue_id)) = 'enviada' then
    raise exception 'esa edición ya se envió' using errcode = '42501';
  end if;
  return coalesce(new, old);
end $$;
create trigger issue_items_guard before insert or update or delete on newsletter_items for each row execute function pt_issue_items_guard();

-- el agente propone; la revisión la hace una persona
create function pt_news_guard() returns trigger language plpgsql as $$
begin
  if pt_role() = 'agente' and (new.state <> 'propuesta' or new.published or new.reviewed_by is not null) then
    raise exception 'un agente sólo propone novedades' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and new.state <> old.state then
    new.reviewed_by := auth.uid(); new.reviewed_at := now();
  end if;
  return new;
end $$;
create trigger news_guard before insert or update on news for each row execute function pt_news_guard();

create trigger touch_news before update on news for each row execute function pt_touch();
create trigger touch_issues before update on newsletter_issues for each row execute function pt_touch();
create trigger audit_news after insert or update or delete on news for each row execute function pt_audit();
create trigger audit_issues after insert or update or delete on newsletter_issues for each row execute function pt_audit();

alter table news enable row level security;
alter table news_peptides enable row level security;
alter table newsletter_issues enable row level security;
alter table newsletter_items enable row level security;

create policy "equipo lee novedades" on news for select using (pt_is('admin', 'editor', 'agente'));
create policy "equipo propone novedades" on news for insert with check (pt_is('admin', 'editor', 'agente') and author = auth.uid());
create policy "editores revisan novedades" on news for update using (pt_is('admin', 'editor')) with check (pt_is('admin', 'editor'));
create policy "editores borran novedades" on news for delete using (pt_is('admin', 'editor'));

create policy "equipo lee vínculos" on news_peptides for select using (pt_is('admin', 'editor', 'agente'));
create policy "equipo vincula sus propuestas" on news_peptides for insert with check (
  pt_is('admin', 'editor') or (pt_is('agente') and exists (select 1 from news n where n.id = news_id and n.author = auth.uid() and n.state = 'propuesta')));
create policy "editores desvinculan" on news_peptides for delete using (pt_is('admin', 'editor'));

create policy "editores ven el newsletter" on newsletter_issues for select using (pt_is('admin', 'editor'));
create policy "editores arman el newsletter" on newsletter_issues for all using (pt_is('admin', 'editor')) with check (pt_is('admin', 'editor'));
create policy "editores ven las secciones" on newsletter_items for select using (pt_is('admin', 'editor'));
create policy "editores arman las secciones" on newsletter_items for all using (pt_is('admin', 'editor')) with check (pt_is('admin', 'editor'));
