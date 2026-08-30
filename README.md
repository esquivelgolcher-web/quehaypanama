# Que Hay Panamá

Web de noticias de Panamá que se **actualiza sola**. Cada pocas horas lee los
canales públicos de **La Prensa** y **La Estrella de Panamá**, elige entre 5 y 10
titulares del día, arma una página limpia y la publica. Cada día queda archivado
en su propia dirección, así se va formando un historial que Google y las IA pueden
indexar.

- Diseño editorial, claro y responsive (se ve bien en celular).
- Sin base de datos, sin servidor, sin dependencias: solo Node y GitHub.
- Cada titular enlaza a la nota original. **No se copian los artículos completos.**

---

## 1. Probarlo en tu computadora (opcional)

Necesitas [Node.js](https://nodejs.org) 20 o superior.

```bash
npm run dev
```

Eso genera el sitio en `dist/` y lo abre en `http://localhost:4321`.
Para solo regenerar sin abrir el navegador: `npm run build`.

---

## 2. Publicarlo gratis en GitHub Pages

### 2.1. Subir el proyecto a GitHub

1. Crea una cuenta en <https://github.com> si no tienes.
2. Crea un repositorio nuevo (por ejemplo `quehaypanama`). Puede ser público.
3. Sube **todo el contenido de esta carpeta** al repositorio (con GitHub Desktop,
   con `git`, o arrastrando los archivos en la web).

### 2.2. Activar Pages y los permisos

En el repositorio, entra a **Settings** (Configuración):

1. **Settings → Pages → Build and deployment → Source**: elige **GitHub Actions**.
2. **Settings → Actions → General → Workflow permissions**: marca
   **Read and write permissions** y guarda. (Esto deja que el robot guarde el
   historial en `data/archive.json`.)

### 2.3. Primera publicación

1. Entra a la pestaña **Actions**.
2. Abre el workflow **“Actualizar y publicar”** y pulsa **Run workflow**.
3. En 1–2 minutos el sitio queda publicado. La URL aparece en
   **Settings → Pages** (algo como `https://TU-USUARIO.github.io/quehaypanama/`).

A partir de ahí se actualiza solo (ver punto 4).

---

## 3. Usar tu dominio propio

1. Edita **`site.config.json`** y pon tu dominio en las dos líneas:

   ```json
   "domain": "tudominio.com",
   "baseUrl": "https://tudominio.com",
   ```

   (El archivo `dist/CNAME` se genera solo con ese valor en cada publicación.)

2. En tu proveedor de dominio, crea estos registros DNS apuntando a GitHub Pages:

   | Tipo  | Nombre | Valor |
   |-------|--------|-------|
   | A     | `@`    | `185.199.108.153` |
   | A     | `@`    | `185.199.109.153` |
   | A     | `@`    | `185.199.110.153` |
   | A     | `@`    | `185.199.111.153` |
   | CNAME | `www`  | `TU-USUARIO.github.io` |

3. En **Settings → Pages → Custom domain**, escribe tu dominio y guarda.
   Marca **Enforce HTTPS** cuando se habilite (puede tardar unos minutos).

4. Haz commit del cambio en `site.config.json`. La próxima publicación ya usará
   tu dominio en los enlaces, el sitemap y el RSS.

---

## 4. Cómo se actualiza solo

El archivo `.github/workflows/update.yml` corre **cada 3 horas** (y también cuando
subes cambios, o manualmente desde *Actions → Run workflow*). En cada corrida:

1. Lee los feeds de La Prensa y La Estrella.
2. Agrega al historial las notas nuevas del día (tope de 10 por día, repartidas
   entre las dos fuentes).
3. Regenera todo el sitio y lo publica en Pages.
4. Guarda el historial actualizado en `data/archive.json`.

> GitHub pausa los workflows programados si el repositorio pasa 60 días sin
> actividad. Cualquier commit los reactiva.

---

## 5. Personalizar

Casi todo se controla desde **`site.config.json`**:

| Campo | Para qué sirve |
|-------|----------------|
| `title`, `tagline`, `description` | Nombre y textos de cabecera / SEO |
| `home.min` / `home.max` | Mínimo y máximo de notas en la portada y por día (5–10) |
| `images` | `true` muestra las fotos de La Prensa (foto grande en la nota principal, miniatura en el resto). `false` deja todo en texto |
| `maxAgeDays` | Ignora noticias más viejas que estos días (por defecto 14) |
| `recentEditionsOnHome` | Cuántas “ediciones anteriores” listar en la portada |
| `social` | Tus redes sociales (aparecen en el pie y en “Sobre este sitio”) |
| `sources` | Los feeds de origen (ver abajo) |

**Agregar TikTok (u otra red) después:** añade una línea al arreglo `social` en
`site.config.json` y publica. Ejemplo:

```json
{ "name": "TikTok", "handle": "@tu_usuario", "url": "https://www.tiktok.com/@tu_usuario" }
```

El orden en el que las pongas es el orden en el que se muestran.

**Cambiar el logo:** reemplaza `public/logo.svg` por tu archivo (mismo nombre).
Si prefieres PNG, guárdalo como `public/logo.svg` igual no sirve — en ese caso
ponlo como `public/logo.png` y cambia `/assets/logo.svg` por `/assets/logo.png`
en `src/templates.mjs`.

**Colores y tipografía:** están al inicio de `src/styles.css` como variables
(`--maroon`, `--gold`, `--paper`, y las fuentes). Los colores actuales salen del
logo: guinda `#8A1E2D` y mostaza `#E3B21E`.

**Imagen para redes (WhatsApp, X, Facebook):** crea una imagen de 1200×630 px y
guárdala como `public/og.png`. El sitio la usará automáticamente al compartir.

**Agregar o cambiar una fuente de noticias:** edita el arreglo `sources` en
`site.config.json`. Cada fuente necesita `name`, `homepage`, `type: "rss"` y la
`url` del feed. Ejemplo para seguir una sección concreta de La Prensa:

```json
{ "name": "La Prensa · Economía", "homepage": "https://www.prensa.com",
  "type": "rss",
  "url": "https://www.prensa.com/arc/outboundfeeds/rss/category/economia/?outputType=xml" }
```

---

## 6. Publicar notas propias

Además de las noticias automáticas, puedes publicar tus propias notas. Cada
archivo `.md` dentro de la carpeta **`content/`** se convierte en una nota de
Que Hay Panamá: aparece en la portada y el archivo junto a las demás (marcada en
mostaza) y tiene su propia página en `tudominio.com/nota/<nombre-del-archivo>/`.

**Para publicar una:** desde GitHub, entra a la carpeta `content`, pulsa
**Add file → Create new file**, ponle un nombre como `comunicado.md` y pega:

```markdown
---
titulo: Título de la nota
fecha: 2026-09-01 09:00
resumen: Frase corta que se ve en la portada.
foto:
enlace:
destacada: no
---

El texto de la nota. Párrafos separados por una línea en blanco.
Se admite **negrita**, *cursiva*, [enlaces](https://...), ## subtítulos,
- listas y > citas.
```

Guarda ("Commit"). En unos minutos aparece publicada.

- `titulo` es lo único obligatorio. `fecha` vacía = fecha de publicación.
- `destacada: si` la fija como nota principal del día.
- Para borrarla del sitio, borra su archivo `.md`.
- Los archivos que empiezan con `_` no se publican (`content/_ejemplo.md` es la
  plantilla). Hay una guía completa en `content/README.md`.

---

## 7. Estructura del proyecto

```
site.config.json          Configuración (dominio, textos, redes, fuentes, límites)
content/                   Tus notas propias (un .md por nota)
public/                    Archivos que se copian tal cual (logo, og.png…)
src/
  build.mjs               Script principal: lee feeds → historial → dist/
  templates.mjs           Plantillas HTML y de RSS/sitemap
  styles.css              Estilos (variables de color y tipografía arriba)
  serve.mjs               Servidor local para previsualizar
  lib/rss.mjs             Lector de RSS/Atom sin dependencias
  lib/content.mjs         Lector de las notas propias (content/*.md)
  lib/util.mjs            Fechas (horario de Panamá), limpieza de texto
data/archive.json         Historial acumulado de noticias (lo guarda el robot)
dist/                     Sitio generado (no se sube; se crea en cada publicación)
.github/workflows/update.yml   La tarea programada
```

---

## 8. Sobre el contenido y los derechos

Que Hay Panamá es un **agregador**: muestra titular, un resumen corto tomado del
propio feed y un enlace a la nota original. No aloja ni reproduce los artículos
completos, y todo el tráfico va al medio que hizo el trabajo periodístico. Si un
medio pide ajustes, lo más sano es atender el pedido (quitar su fuente del
`site.config.json` basta para dejar de traer sus notas).

Las **fotos** se muestran directamente desde el servidor de La Prensa (no se
copian a este sitio) y en tamaño reducido. Si prefieres no mostrarlas, pon
`"images": false` en `site.config.json`. La Estrella no trae foto en su canal,
así que esas notas van solo con texto.

## 9. Límites conocidos

- **La Estrella de Panamá** no publica un RSS propio, así que sus notas se traen
  vía **Google Noticias** (`site:laestrella.com.pa`). Por eso a veces aparecen
  columnas de opinión y los enlaces pasan primero por `news.google.com` antes de
  redirigir al artículo. Si más adelante La Estrella habilita un RSS, se cambia
  una sola línea en `site.config.json`.
- Las fotos vienen del CDN de La Prensa. Si alguna no carga, esa nota se muestra
  solo con texto (no queda un hueco).
- Si un feed no responde en una corrida, el sitio se reconstruye con el historial
  guardado y no se rompe.
