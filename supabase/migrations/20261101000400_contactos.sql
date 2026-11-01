-- peptalk · contactos: suscriptos al newsletter y pedidos de derivación a un médico.

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
create index on leads (doctor);

-- único punto de entrada público: valida y guarda (el sitio no puede leer ni tocar la tabla)
create function pt_submit_lead(p jsonb) returns void language plpgsql security definer set search_path = public as $$
declare
  v_kind text := p->>'kind';
  v_email text := lower(nullif(trim(p->>'email'), ''));
  v_phone text := nullif(trim(p->>'phone'), '');
begin
  if v_email is not null and (v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' or length(v_email) > 200) then raise exception 'email inválido'; end if;
  if v_kind = 'newsletter' then
    if v_email is null then raise exception 'falta el email'; end if;
    insert into leads (kind, email, consent) values ('newsletter', v_email, jsonb_build_object('at', now()))
    on conflict (lower(email)) where kind = 'newsletter' do update set state = 'nuevo' where leads.state = 'baja';
  elsif v_kind = 'derivacion' then
    if coalesce(trim(p->>'name'), '') = '' then raise exception 'falta el nombre'; end if;
    if v_email is null and v_phone is null then raise exception 'falta un contacto'; end if;
    if not coalesce((p->'consent'->>'adult')::boolean and (p->'consent'->>'c1')::boolean and (p->'consent'->>'c2')::boolean, false) then
      raise exception 'falta el consentimiento';
    end if;
    insert into leads (kind, name, email, phone, province, peptide, modality, message, consent)
    values ('derivacion', left(trim(p->>'name'), 120), v_email, left(v_phone, 40), left(p->>'prov', 60), left(p->>'pep', 80),
            left(p->>'mod', 20), left(p->>'motivo', 300), p->'consent' || jsonb_build_object('at', now()));
  else
    raise exception 'tipo inválido';
  end if;
end $$;

create trigger audit_leads after update or delete on leads for each row execute function pt_audit();

alter table leads enable row level security;
create policy "admin ve contactos; el médico, los suyos" on leads for select using (pt_is('admin') or (pt_is('medico') and doctor = auth.uid()));
create policy "admin gestiona contactos" on leads for update using (pt_is('admin')) with check (pt_is('admin'));
create policy "médico actualiza los suyos" on leads for update using (pt_is('medico') and doctor = auth.uid()) with check (pt_is('medico') and doctor = auth.uid());
create policy "admin borra contactos" on leads for delete using (pt_is('admin'));

-- el médico sólo cambia estado y nota de sus contactos
create function pt_leads_guard() returns trigger language plpgsql as $$
begin
  if pt_role() = 'medico' and (new.doctor is distinct from old.doctor or row(new.name, new.email, new.phone, new.province, new.peptide, new.modality, new.message, new.consent, new.kind)
       is distinct from row(old.name, old.email, old.phone, old.province, old.peptide, old.modality, old.message, old.consent, old.kind)) then
    raise exception 'sin permiso' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger leads_guard before update on leads for each row execute function pt_leads_guard();
