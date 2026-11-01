# peptalk · landing

Landing en React (Vite + TypeScript), publicada en GitHub Pages con el dominio peptalkarg.com por el workflow `.github/workflows/deploy.yml`. El backoffice (`admin/`) sigue siendo HTML y JS sin compilar.

- `src/`: la landing. `App.tsx` arma las secciones; `components/` tiene una por archivo (Nav, Hero, Systems, Library, PeptideCard, Drawer, Sections, BrandSelect, CardSwap) y `lib/catalog.ts` deriva los datos del catálogo.
- `styles.css` y `brand/tokens/tokens.css`: los estilos (los importa `src/main.tsx`).
- `data.js` (sistemas, agencias, estados, evidencia, conexión a Supabase) y `peptides.js` (generado): datos que no pasan por Vite, para que el backoffice pueda publicar sin tocar código.

Para sumar un péptido o verificar un estado se edita solo `data.js`. Las fichas tienen URL propia: `peptalkarg.com/#p/<slug>`.

Probar en local: `npm install` y `npm run dev` (http://localhost:5173; el backoffice queda en /admin/). Compilar: `npm run build`.

## Design system (`brand/`)

Página: https://peptalkarg.com/brand/

- `brand/tokens/tokens.json`: fuente única (formato W3C Design Tokens). Colores, degradés, tipografía, espaciado, radios, sombras, movimiento y reglas del logo.
- `brand/tokens/tokens.css` y `tailwind.preset.js`: generados. Dos capas: base (`--pt-color-brand-orange`) y semántica (`--pt-accent`, `--pt-text-muted`), con tema oscuro vía `data-theme="dark"`.
- `brand/logo/`: logo, logotipo, isotipo e íconos en SVG (texto en Inter ExtraBold pasado a trazos) y PNG.
- `brand/backgrounds/`, `brand/applications/`: fondos 1920 × 1080, banner 1500 × 500, avatar, portada de presentación e imagen OG.
- `brand/fonts/`: Inter (licencia OFL), servida desde el sitio.

Regenerar todo después de cambiar `tokens.json`:

```
python3 -m venv .venv && .venv/bin/pip install fonttools uharfbuzz
.venv/bin/python brand/scripts/build.py          # con PNG (usa Google Chrome)
.venv/bin/python brand/scripts/build.py --no-png  # solo tokens y SVG
```

## Tarjetas y pila del hero

- `src/components/PeptideCard.tsx`: arriba la cadena de aminoácidos real (`sequence` en la ficha; sin secuencia muestra el tipo), abajo el veredicto en Argentina y la evidencia. Las aprobadas por ANMAT van invertidas.
- `src/components/CardSwap.tsx`: pila de Bencho (MIT, bencho.dev/licence) con las fichas destacadas. `--fill-slab` → `--pt-surface`, `--fill-on` → `--ink`; `--t` es la posición de cada tarjeta y la escribe el componente.

## Cuerpo 3D e íconos

- `body3d.js`: cuerpo de partículas con Three.js r149 (`vendor/three.min.js`, cargado recién cuando la sección de sistemas se acerca a la pantalla). La anatomía son volúmenes (elipsoides y conos redondeados) fundidos en una sola piel con unión suave y muestreados en superficie; las zonas que se encienden por sistema están en `data.js` (`systems[].zones`).
- Sin WebGL se muestra `assets/body.svg`, generado con `python3 scripts/body.py`.
- Íconos: Lucide (ISC), en el sprite `assets/icons.svg`. Para sumar uno, bajar el SVG de lucide-static a una carpeta y correr `python3 scripts/icons.py <carpeta>`.

## Contenido de la biblioteca

- `research/peptides.json`: fuente de verdad de los 40 péptidos (estado por agencia con nota, fuente, URL y confianza; evidencia; resumen; referencias).
- `python3 scripts/peptides.py [lotes.json…]`: fusiona, valida (valores permitidos, sistemas, URL de cada fuente) y genera `peptides.js`.
- `docs/investigacion-peptidos.md`: método, tabla resumen y lista de lo que falta confirmar.

## Backoffice (`admin/`)

Página: https://peptalkarg.com/admin/ (sin indexar). Sin conexión configurada corre en modo demo con las fichas actuales en memoria.

- Base: Supabase, proyecto `peptalk` (ref `ksclxrhwaeddlxrdnfxi`, São Paulo, org MM-Proyectos). Esquema y permisos en `supabase/migrations/` (base, catálogo, tienda, novedades, contactos, archivos y accesos); carga inicial en `supabase/seed.sql` (`python3 scripts/db.py seed`). Aplicar cambios: `supabase db push --linked` (contraseña de la base en `~/.peptalk-db-password`, fuera del repo).
- Ficha: además de lo que se ve hoy, guarda resumen simple, proceso de uso, dosis (sólo se publica si la firmó un médico con su usuario), especificaciones, etiquetas, imágenes (bucket público `media`) y videos. Qué sale al sitio lo decide `site_settings` (`agencias_visibles`, `secciones`); lo oculto nunca baja al repo, que es público.
- Tienda (oculta, `site_settings.tienda.activa = false`): productos por concentración, precio y precio tachado, descuentos por cantidad, stock, certificado de análisis por lote y relacionados.
- Novedades y newsletter: novedades con fuente (Grok las propone, una persona las aprueba) y ediciones semanales con banner, cuerpo editable con imágenes y las novedades o fichas de la semana; una edición enviada queda bloqueada.
- Ingreso: link mágico al email (o contraseña, opcional). El registro está cerrado: sólo entran personas invitadas, y a un email no habilitado no se le manda nada ni se le dice si existe. La sesión vence a los 7 días del último ingreso. Configuración de auth en `supabase/config.toml` (`supabase config push`); las plantillas de mail en castellano (`supabase/templates/`) se activan cuando se conecte un SMTP propio.
- Roles: **admin** (todo), **editor** (fichas, documentos, aprueba borradores, publica), **médico** (sólo sus contactos), **agente** (Grok: lee el catálogo y deja borradores). Los permisos viven en la base (RLS); el navegador sólo ve lo que su rol permite. Un usuario nuevo entra desactivado hasta que un admin lo activa.
- Borradores: lo que propone un agente no toca la ficha hasta que un editor lo aprueba (`pt_approve_draft`).
- Contactos: los formularios del sitio guardan con `pt_submit_lead`, la única función pública; el sitio no puede leer la tabla.
- Historial: cada cambio en fichas, notas, documentos, borradores y contactos queda en `audit` con autor y fecha.
- Publicar: el botón llama a la función `supabase/functions/publish`, que dispara `.github/workflows/publicar.yml`: baja las fichas publicadas (`scripts/db.py export`), corre `peptides.py` y `bust.py` y commitea. GitHub Pages redeploya solo.
- Pantallas: catálogo y ficha (con imágenes y videos, resumen simple, especificaciones, uso y dosis), borradores, novedades, newsletter (editor tipo documento con Tiptap, `vendor/tiptap.min.js`, banner, secciones y vista previa del mail), contactos, revisión médica (el médico sólo ve la cola de dosis), usuarios y configuración (agencias y secciones visibles, tienda). `admin/admin.js` es el núcleo; `admin/media.js` y `admin/newsletter.js` se enganchan con `PTA.extend`.
- Imágenes: se achican en el navegador (WebP, lado mayor 2000 px) antes de subir al bucket `media`.
- Probar migraciones y permisos por rol (50 casos) en un Postgres local: `./scripts/test_db.sh`.

Puesta en marcha (una vez):

1. Crear el proyecto en supabase.com (región São Paulo) y correr `supabase/migrations/*.sql` y `supabase/seed.sql` en el SQL Editor (o `supabase db push`).
2. Poner la URL y la clave anon en `admin/config.js` y en `data.js` (`supabase`).
3. Invitar a los usuarios desde Authentication → Users; al primero hacerlo admin con `update profiles set role = 'admin', active = true where email = '…';`.
4. Publicación: secretos `SUPABASE_URL` y `SUPABASE_SERVICE_KEY` en GitHub (Settings → Secrets → Actions); en Supabase, desplegar la función `publish` con los secretos `GITHUB_TOKEN` (fine-grained, Contents: write) y `GITHUB_REPO=matiasmartin4/peptalk-landing`.

## Grok por MCP (`supabase/functions/mcp`)

Servidor MCP por HTTP, sin sesión, en `https://ksclxrhwaeddlxrdnfxi.supabase.co/functions/v1/mcp`.

- **Entrada:** `Authorization: Bearer ptk_…`. Los tokens se generan y revocan en Usuarios → Conexión de Grok (sólo admin). En la base queda el hash; el token se ve una sola vez.
- **Identidad:** cada llamada corre como el usuario agente dueño del token (rol `authenticated` con su `sub`), así que valen las mismas reglas que en el backoffice. Un agente desactivado o un token revocado dejan de entrar en el acto.
- **Herramientas:** `buscar_peptidos`, `leer_ficha`, `referencia`, `proponer_nota`, `proponer_cambio`, `proponer_peptido_nuevo`, `proponer_novedad`, `mis_propuestas`. Todo lo que escribe queda como propuesta en Borradores o Novedades; la dosis y la publicación no se pueden proponer.
- **Deploy:** `supabase functions deploy mcp --project-ref ksclxrhwaeddlxrdnfxi --use-api --no-verify-jwt` (el token no es un JWT de Supabase).
- **Conectar Grok:** en la API de xAI se pasa como herramienta MCP remota con la URL de arriba y el token como `authorization`. Cualquier otro cliente MCP (Claude, Cursor) se conecta igual.
