# peptalk · landing

Sitio estático (sin build ni dependencias), publicado en GitHub Pages con el dominio peptalkarg.com.

- `index.html`: estructura y textos fijos.
- `styles.css`: tokens de diseño arriba (colores, radios, sombras) y estilos por sección.
- `data.js`: todo el contenido de la biblioteca (péptidos, sistemas, estados, evidencia) y los endpoints de formularios.
- `app.js`: lógica por módulos (buscador, mapa del cuerpo, biblioteca, ficha, formularios).

Para sumar un péptido o verificar un estado se edita solo `data.js`. Las fichas tienen URL propia: `peptalkarg.com/#p/<slug>`.

Probar en local: `python3 -m http.server` y abrir http://localhost:8000.
