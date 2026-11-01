-- peptalk · secuencias: la cadena (una letra por aminoácido, X = no estándar) ya vive en
-- peptides.sequence; acá va cómo se obtuvo, para que la ficha sea verificable.
alter table peptides add column sequence_meta jsonb not null default '{}'
  check (jsonb_typeof(sequence_meta) = 'object');
comment on column peptides.sequence_meta is
  '{nonstandard, modifications, kind (lineal|ciclico|mezcla|...), source, source_url, confidence, note}';
alter table peptides add constraint peptides_sequence_letters check (sequence is null or sequence ~ '^[ACDEFGHIKLMNPQRSTVWYX]+$');
