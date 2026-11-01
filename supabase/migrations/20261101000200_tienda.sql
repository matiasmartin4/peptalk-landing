-- peptalk · tienda (OCULTA). Hoy no se vende: no hay autorización en Argentina.
-- Se deja el modelo completo para no rehacer las fichas el día que se active
-- (site_settings.tienda.activa). Modelado sobre una ficha de producto de referencia:
-- presentación por concentración, precio y precio tachado, descuento por cantidad,
-- stock, certificado de análisis por lote y productos relacionados.

create table products (
  id uuid primary key default gen_random_uuid(),
  slug text not null references peptides on update cascade on delete restrict,
  sku text not null unique,
  name text not null,                                  -- p. ej. "BPC-157 10 mg"
  strength_mg numeric(10, 3),                          -- concentración por vial
  strength_label text,                                 -- para presentaciones que no son mg
  form text,                                           -- polvo liofilizado, solución, crema…
  storage text,
  purity_pct numeric(5, 2) check (purity_pct between 0 and 100),
  price numeric(12, 2) check (price >= 0),
  compare_at_price numeric(12, 2) check (compare_at_price >= 0),   -- precio tachado
  currency text not null default 'ARS' check (currency in ('ARS', 'USD')),
  stock_status text not null default 'sin_stock' check (stock_status in ('disponible', 'sin_stock', 'proximamente', 'discontinuado')),
  stock_qty int check (stock_qty >= 0),
  active boolean not null default false,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles,
  check (compare_at_price is null or price is null or compare_at_price >= price)
);
create index on products (slug, sort);

-- descuentos por cantidad: 3+ unidades 10 %, 5+ 15 %…
create table product_price_tiers (
  product_id uuid not null references products on delete cascade,
  min_qty int not null check (min_qty > 1),
  discount_pct numeric(5, 2) not null check (discount_pct > 0 and discount_pct < 100),
  primary key (product_id, min_qty)
);

-- certificado de análisis por lote; el PDF va en documents (kind 'coa')
create table product_coas (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products on delete cascade,
  lab text not null,
  lot text not null,
  received_on date,
  reported_on date,
  purity_pct numeric(5, 2) check (purity_pct between 0 and 100),
  identity_confirmed boolean,
  net_content_mg numeric(10, 3),
  appearance text,
  method text,                                         -- HPLC-UV, LC-MS…
  document_id uuid references documents on delete set null,
  is_current boolean not null default true,
  created_at timestamptz not null default now(),
  unique (product_id, lot)
);
create unique index product_coas_current on product_coas (product_id) where is_current;

create table product_related (
  product_id uuid not null references products on delete cascade,
  related_id uuid not null references products on delete cascade,
  sort int not null default 0,
  primary key (product_id, related_id),
  check (product_id <> related_id)
);

create trigger touch_products before update on products for each row execute function pt_touch();
create trigger audit_products after insert or update or delete on products for each row execute function pt_audit();
create trigger audit_coas after insert or update or delete on product_coas for each row execute function pt_audit();

alter table products enable row level security;
alter table product_price_tiers enable row level security;
alter table product_coas enable row level security;
alter table product_related enable row level security;

create policy "equipo ve la tienda" on products for select using (pt_is('admin', 'editor'));
create policy "editores gestionan la tienda" on products for all using (pt_is('admin', 'editor')) with check (pt_is('admin', 'editor'));
create policy "equipo ve descuentos" on product_price_tiers for select using (pt_is('admin', 'editor'));
create policy "editores gestionan descuentos" on product_price_tiers for all using (pt_is('admin', 'editor')) with check (pt_is('admin', 'editor'));
create policy "equipo ve certificados" on product_coas for select using (pt_is('admin', 'editor'));
create policy "editores gestionan certificados" on product_coas for all using (pt_is('admin', 'editor')) with check (pt_is('admin', 'editor'));
create policy "equipo ve relacionados" on product_related for select using (pt_is('admin', 'editor'));
create policy "editores gestionan relacionados" on product_related for all using (pt_is('admin', 'editor')) with check (pt_is('admin', 'editor'));
