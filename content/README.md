# Notas propias

Todo archivo `.md` que pongas en esta carpeta se publica como una nota de
**Que Hay Panamá**, mezclada en la portada y el archivo junto a las noticias
agregadas, y con su propia página en `tudominio.com/nota/<nombre-del-archivo>/`.

## Cómo publicar una

1. Crea un archivo `.md` con un nombre corto, sin espacios ni acentos
   (ej.: `comunicado-transito.md`). Ese nombre es la dirección de la nota.
2. Empieza con el bloque de datos entre `---` y `---`, y debajo el texto.
   Copia `_ejemplo.md` como plantilla.
3. Súbelo a GitHub (**Add file → Create new file**, o **Upload files**).
   En unos minutos aparece en el sitio.

## Campos

| Campo | Obligatorio | Notas |
|-------|-------------|-------|
| `titulo` | Sí | El titular. |
| `fecha` | No | `2026-08-30` o `2026-08-30 15:00` (hora de Panamá). Vacío = fecha de publicación. |
| `resumen` | No | Frase corta que se ve en la portada. |
| `foto` | No | URL de una imagen. |
| `enlace` | No | Si lo pones, la nota muestra un botón "Ver fuente". |
| `destacada` | No | `si` la fija como nota principal del día. |

## Texto

Párrafos separados por una línea en blanco. Se admite `**negrita**`,
`*cursiva*`, `[enlace](https://...)`, `## subtítulo`, `- listas` y `> citas`.

## Notas

- Los archivos que empiezan con `_` (como `_ejemplo.md`) no se publican.
- Para borrar una nota del sitio, borra su archivo `.md`.
- Estas notas no se guardan en `data/archive.json`; su original es el archivo `.md`.
