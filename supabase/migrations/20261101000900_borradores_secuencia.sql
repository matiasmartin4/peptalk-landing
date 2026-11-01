-- peptalk · al aprobar una ficha nueva, jsonb_populate_record no aplica los valores por
-- defecto: cada columna nueva con NOT NULL tiene que estar en la lista de valores iniciales.
-- Además, un borrador ya puede proponer la secuencia (con su fuente en sequence_meta).
create or replace function pt_draft_fields() returns text[] language sql immutable as $$
  select array['name', 'alias', 'sys', 'type', 'tags', 'summary', 'summary_plain', 'ev', 'ev_note', 'refs', 'checked',
               'usage_process', 'sequence', 'sequence_meta', 'cas_number', 'molecular_formula', 'molecular_weight', 'sequence', 'preparation_form', 'storage']
$$;

create or replace function pt_approve_draft(draft_id uuid, note text default null) returns void
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
                         'usage_process', '', 'dosing', '', 'sequence_meta', '{}'::jsonb, 'checked', current_date, 'sort', 1000, 'created_at', now(), 'updated_at', now())
      || row || jsonb_build_object('published', false, 'updated_by', auth.uid()))).*;
  end if;

  update drafts set state = 'aprobado', review_note = note, reviewed_by = auth.uid(), reviewed_at = now() where id = draft_id;
end $$;

