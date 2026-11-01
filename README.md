# peptalk · landing

Sitio estático (sin build ni dependencias), publicado en GitHub Pages con el dominio peptalkarg.com.

- `index.html`: estructura y textos fijos.
- `styles.css`: tokens de diseño arriba (colores, radios, sombras) y estilos por sección.
- `data.js`: todo el contenido de la biblioteca (péptidos, sistemas, estados, evidencia) y los endpoints de formularios.
- `app.js`: lógica por módulos (buscador, mapa del cuerpo, biblioteca, ficha, formularios).

Para sumar un péptido o verificar un estado se edita solo `data.js`. Las fichas tienen URL propia: `peptalkarg.com/#p/<slug>`.

Probar en local: `python3 -m http.server` y abrir http://localhost:8000.

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

## Cuerpo 3D e íconos

- `body3d.js`: cuerpo de partículas con Three.js r149 (`vendor/three.min.js`, cargado recién cuando la sección de sistemas se acerca a la pantalla). La anatomía son volúmenes (elipsoides y cápsulas) muestreados en superficie; las zonas que se encienden por sistema están en `data.js` (`systems[].zones`).
- Sin WebGL se muestra `assets/body.svg`, generado con `python3 scripts/body.py`.
- Íconos: Lucide (ISC), en el sprite `assets/icons.svg`. Para sumar uno, bajar el SVG de lucide-static a una carpeta y correr `python3 scripts/icons.py <carpeta>`.

## Contenido de la biblioteca

- `research/peptides.json`: fuente de verdad de los 40 péptidos (estado por agencia con nota, fuente, URL y confianza; evidencia; resumen; referencias).
- `python3 scripts/peptides.py [lotes.json…]`: fusiona, valida (valores permitidos, sistemas, URL de cada fuente) y genera `peptides.js`.
- `docs/investigacion-peptidos.md`: método, tabla resumen y lista de lo que falta confirmar.
