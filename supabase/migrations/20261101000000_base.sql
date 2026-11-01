-- peptalk · base del backoffice: usuarios con rol, configuración del sitio e historial.
-- Los permisos viven en la base (RLS): el navegador sólo ve lo que su rol permite.
-- Orden de migraciones: base → catálogo → tienda → novedades → contactos → archivos.

create extension if not exists pgcrypto;

/* ---------- usuarios y roles ---------- */
create type pt_role as enum ('admin', 'editor', 'medico', 'agente');

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  email text not null,
  name text not null default '',
  role pt_role not null default 'editor',
  active boolean not null default false,          -- nadie entra hasta que un admin lo activa
  -- datos del médico (para derivar por zona; la agenda llega en la etapa de reservas)
  license text,                                   -- matrícula
  provinces text[] not null default '{}',
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

/* ---------- historial de cambios (todas las tablas de contenido) ---------- */
create table audit (
  id bigint generated always as identity primary key,
  tbl text not null, row_key text not null, action text not null,
  actor uuid, old jsonb, new jsonb,
  at timestamptz not null default now()
);
create index on audit (tbl, row_key, at desc);

create function pt_audit() returns trigger language plpgsql security definer set search_path = public as $$
declare r jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
begin
  insert into audit (tbl, row_key, action, actor, old, new)
  values (tg_table_name, coalesce(r->>'id', r->>'slug', r->>'key'), lower(tg_op), auth.uid(),
          case when tg_op <> 'INSERT' then to_jsonb(old) end, case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return coalesce(new, old);
end $$;

create function pt_touch() returns trigger language plpgsql as $$
begin new.updated_at := now(); new.updated_by := coalesce(auth.uid(), new.updated_by); return new; end $$;

/* ---------- configuración del sitio ---------- */
-- Qué se muestra en el sitio público. La exportación sólo baja lo que está visible:
-- un campo oculto nunca llega a peptides.js.
create table site_settings (
  key text primary key,
  value jsonb not null,
  description text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles
);
insert into site_settings (key, value, description) values
  ('agencias_visibles', '["ANMAT", "FDA", "EMA", "WADA"]', 'Agencias cuyo estado se muestra en las fichas del sitio.'),
  ('secciones', '{"resumen_simple": false, "imagenes": false, "videos": false, "especificaciones": false, "uso": false, "dosis": false}',
   'Secciones de la ficha que se publican. Dosis sólo sale si además la revisó un médico.'),
  ('tienda', '{"activa": false, "moneda": "ARS", "aviso": "", "envio": "", "entrega": "", "edad_minima": 18}',
   'Tienda: apagada hasta que haya autorización para vender en Argentina.');
create trigger touch_settings before update on site_settings for each row execute function pt_touch();
create trigger audit_settings after update on site_settings for each row execute function pt_audit();

/* ---------- permisos base ---------- */
alter table profiles enable row level security;
alter table audit enable row level security;
alter table site_settings enable row level security;

create policy "uno se ve a sí mismo; el equipo ve a todos" on profiles for select using (id = auth.uid() or pt_is('admin', 'editor'));
create policy "admin gestiona usuarios" on profiles for update using (pt_is('admin')) with check (pt_is('admin'));
create policy "equipo lee el historial" on audit for select using (pt_is('admin', 'editor'));
create policy "equipo lee la configuración" on site_settings for select using (pt_is('admin', 'editor', 'agente'));
create policy "admin cambia la configuración" on site_settings for update using (pt_is('admin')) with check (pt_is('admin'));

-- el rol y la activación los cambia un admin, y nadie se baja a sí mismo
create function pt_profiles_guard() returns trigger language plpgsql as $$
begin
  if new.id = auth.uid() and (new.role <> old.role or not new.active) then raise exception 'no podés cambiar tu propio rol'; end if;
  return new;
end $$;
create trigger profiles_guard before update on profiles for each row execute function pt_profiles_guard();
create trigger audit_profiles after update or delete on profiles for each row execute function pt_audit();
