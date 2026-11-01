-- pt_draft_fields listaba "sequence" dos veces (ya estaba en el catálogo y la 900 la volvió a sumar)
create or replace function pt_draft_fields() returns text[] language sql immutable as $$
  select array['name', 'alias', 'sys', 'type', 'tags', 'summary', 'summary_plain', 'ev', 'ev_note', 'refs', 'checked',
               'usage_process', 'cas_number', 'molecular_formula', 'molecular_weight', 'sequence', 'sequence_meta',
               'preparation_form', 'storage']
$$;
