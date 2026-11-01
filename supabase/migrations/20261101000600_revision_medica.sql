-- peptalk · revisión médica de dosis. El médico no ve el catálogo: sólo esta cola,
-- con lo mínimo para revisar (nombre, proceso de uso y dosis) y quién la revisó.

create function pt_dosing_queue() returns table (
  slug text, name text, usage_process text, dosing text, reviewed_by_me boolean, reviewed_at timestamptz, updated_at timestamptz
) language sql stable security definer set search_path = public as $$
  select p.slug, p.name, p.usage_process, p.dosing, p.dosing_reviewed_by = auth.uid(), p.dosing_reviewed_at, p.updated_at
  from peptides p
  where pt_is('medico') and p.dosing <> ''
  order by p.dosing_reviewed_at is not null, p.updated_at desc
$$;

revoke all on function pt_dosing_queue() from public, anon;
grant execute on function pt_dosing_queue() to authenticated;
