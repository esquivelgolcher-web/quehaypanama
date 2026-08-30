// Plantillas HTML/XML. Sin dependencias: solo template strings.
import {
  escapeHtml,
  escapeXml,
  truncate,
  timeAgo,
  formatShortDate,
  formatLongDate,
  formatDayKeyLong,
  formatDayKeyMedium,
  formatDayKeyShort,
  dayKeyToPath,
} from "./lib/util.mjs";

const FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,400&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap";

function jsonLdScript(objs) {
  const list = (Array.isArray(objs) ? objs : [objs]).filter(Boolean);
  return list
    .map(
      (o) =>
        `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, "\\u003c")}</script>`
    )
    .join("\n");
}

// --- redes sociales (desde site.config.json > social) --------------------
function socialList(cfg) {
  return Array.isArray(cfg.social) ? cfg.social.filter((s) => s && s.url) : [];
}
function socialUrls(cfg) {
  return socialList(cfg).map((s) => s.url);
}
function contactUrl(cfg) {
  const list = socialList(cfg);
  const ig = list.find((s) => /instagram/i.test(s.name || ""));
  return (ig || list[0] || { url: "#" }).url;
}

// El "resizer" de Arc (La Prensa) respeta width/height en la URL aunque no
// coincida la firma "auth", así que pedimos una versión pequeña en vez de la
// original de 6000 px.
function sizedImage(u, w, h) {
  if (!u || !/\/resizer\//i.test(u)) return u;
  let out = u
    .replace(/([?&])width=\d+/i, `$1width=${w}`)
    .replace(/([?&])height=\d+/i, `$1height=${h}`);
  if (!/[?&]width=/i.test(out)) out += (out.includes("?") ? "&" : "?") + `width=${w}`;
  if (!/[?&]height=/i.test(out)) out += `&height=${h}`;
  if (!/[?&]smart=/i.test(out)) out += "&smart=true";
  return out;
}

export function shell({
  cfg,
  title,
  description,
  path = "/",
  ogType = "website",
  ogImage = "",
  jsonLd = [],
  mastheadExtra = "",
  bodyClass = "",
  main = "",
}) {
  const canonical = cfg.baseUrl + path;
  const desc = truncate(description || cfg.description, 300);
  const img = ogImage ? (ogImage.startsWith("http") ? ogImage : cfg.baseUrl + ogImage) : "";

  return `<!doctype html>
<html lang="es" prefix="og: https://ogp.me/ns#">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(desc)}">
<link rel="canonical" href="${escapeHtml(canonical)}">
<meta name="theme-color" content="#fbf7ee" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#14100b" media="(prefers-color-scheme: dark)">
<meta property="og:site_name" content="${escapeHtml(cfg.title)}">
<meta property="og:type" content="${ogType}">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(desc)}">
<meta property="og:url" content="${escapeHtml(canonical)}">
<meta property="og:locale" content="${escapeHtml(cfg.locale || "es_PA")}">
${img ? `<meta property="og:image" content="${escapeHtml(img)}">` : ""}
<meta name="twitter:card" content="${img ? "summary_large_image" : "summary"}">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(desc)}">
${img ? `<meta name="twitter:image" content="${escapeHtml(img)}">` : ""}
<link rel="icon" href="/assets/logo.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/assets/logo.svg">
<link rel="alternate" type="application/rss+xml" title="${escapeHtml(cfg.title)}" href="/rss.xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS_HREF}">
<link rel="stylesheet" href="/assets/styles.css">
${jsonLd.length ? jsonLdScript(jsonLd) : ""}
</head>
<body class="${bodyClass}">
<div class="page">
<div class="topband"></div>
<a class="skip-link" href="#main">Saltar al contenido</a>
<header class="masthead">
  <div class="wrap">
    <a class="brand" href="/">
      <img class="brand__logo" src="/assets/logo.svg" alt="" width="54" height="54">
      <span class="brand__name">Que Hay <em>Panamá</em></span>
    </a>
    <p class="dateline">
      <span class="dateline__left">${escapeHtml(cfg.kicker || "Medio digital independiente")}</span>
      <span class="dateline__mid">${escapeHtml(cfg.city || "Panamá")}</span>
      <span class="dateline__right">${escapeHtml(formatShortDate(new Date(), cfg.timezone))}</span>
    </p>
    ${mastheadExtra}
  </div>
</header>
<main id="main">
  <div class="wrap">
${main}
  </div>
</main>
${footer(cfg)}
</div>
</body>
</html>`;
}

function footer(cfg) {
  const year = new Date().getFullYear();
  return `<footer class="site-foot">
  <div class="wrap">
    <div class="foot-lead">
      <img class="brand__logo" src="/assets/logo.svg" alt="" width="34" height="34">
      <span class="brand__name">Que Hay <em>Panamá</em></span>
    </div>
    <p class="foot-note">
      <strong>Que Hay Panamá</strong> es un medio digital independiente. Los titulares y
      resúmenes pertenecen a cada medio y cada enlace lleva a su publicación original.
    </p>
    <nav class="foot-links">
      <a href="/">Portada</a>
      <a href="/archivo/">Archivo</a>
      <a href="/rss.xml">RSS</a>
      <a href="/sobre/">Sobre este sitio</a>
    </nav>
    <nav class="foot-social" aria-label="Redes sociales de Que Hay Panamá">
      <span>Síguenos</span>
      ${socialList(cfg)
        .map(
          (s) =>
            `<a href="${escapeHtml(s.url)}" rel="me noopener" target="_blank">${escapeHtml(
              s.name
            )} &#8599;</a>`
        )
        .join("\n      ")}
    </nav>
    <p class="foot-legal">&copy; ${year} Que Hay Panamá &middot; Hecho en Panamá &middot; Se actualiza solo varias veces al día</p>
  </div>
</footer>`;
}

// ---------------------------------------------------------------------------
// Nota individual
// ---------------------------------------------------------------------------
export function renderStory(
  item,
  { lead = false, level = 3, now = new Date(), timezone, images = true } = {}
) {
  const url = escapeHtml(item.url);
  const title = escapeHtml(item.title);
  const dek = item.summary ? `<p class="story__dek">${escapeHtml(truncate(item.summary, 230))}</p>` : "";
  const ago = escapeHtml(timeAgo(item.publishedAt, now, timezone));
  const via = item.via ? `<span class="via">vía ${escapeHtml(item.via)}</span>` : "";
  const H = `h${level}`;
  const hasImg = images && !!item.image;

  // La foto grande arriba solo en la nota principal; miniatura al lado en el resto.
  // Si la imagen no carga (bloqueo del CDN, 404…), el elemento se quita solo.
  const figure =
    hasImg && lead
      ? `<figure class="story__figure"><img src="${escapeHtml(
          sizedImage(item.image, 1200, 675)
        )}" alt="" width="1200" height="675" loading="lazy" decoding="async" onerror="this.closest('figure').remove()"></figure>\n  `
      : "";
  const thumb =
    hasImg && !lead
      ? `\n    <img class="story__thumb" src="${escapeHtml(
          sizedImage(item.image, 320, 320)
        )}" alt="" width="320" height="320" loading="lazy" decoding="async" onerror="this.remove()">`
      : "";

  // Nota propia -> enlace interno a su página. Nota agregada -> enlace externo a la fuente.
  const linkAttrs = item.isManual ? "" : ' target="_blank" rel="noopener noreferrer"';
  const footText = item.isManual
    ? `Leer la nota <span class="arrow">&#8594;</span>`
    : `Leer en ${escapeHtml(item.source)} <span class="arrow">&#8599;</span>`;

  const body = `<div class="story__body">
    <p class="story__meta">
      <span class="badge${item.isManual ? " badge--own" : ""}">${escapeHtml(item.source)}</span>
      <span>${ago}</span>
      ${via}
    </p>
    <${H} class="story__title"><a href="${url}"${linkAttrs}>${title}</a></${H}>
    ${dek}
    <p class="story__foot"><a href="${url}"${linkAttrs}>${footText}</a></p>
  </div>`;

  return `<li class="story${lead ? " story--lead" : ""}">
  ${figure}<div class="story__row">
    ${body}${thumb}
  </div>
</li>`;
}

// ---------------------------------------------------------------------------
// Portada
// ---------------------------------------------------------------------------
export function homePage({ cfg, stories, editions, updatedAgo, now }) {
  const items = stories
    .map((s, i) =>
      renderStory(s, { lead: i === 0, level: 3, now, timezone: cfg.timezone, images: cfg.images !== false })
    )
    .join("\n");

  const edits = editions
    .map(
      (e) =>
        `<li><a href="/${dayKeyToPath(e.day)}"><span class="date">${escapeHtml(
          formatDayKeyMedium(e.day)
        )}</span><span class="count">${e.count} ${e.count === 1 ? "nota" : "notas"} &#8594;</span></a></li>`
    )
    .join("\n");

  const mastheadExtra = `<h1 class="tagline">${escapeHtml(cfg.tagline)}</h1>
    <p class="updated"><span class="dot"></span> Actualizado ${escapeHtml(updatedAgo)} &middot; <a href="/rss.xml">RSS</a></p>`;

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: cfg.title,
      url: cfg.baseUrl + "/",
      description: cfg.description,
      inLanguage: "es-PA",
      publisher: {
        "@type": "Organization",
        name: cfg.title,
        url: cfg.baseUrl + "/",
        logo: cfg.baseUrl + "/assets/logo.svg",
        sameAs: socialUrls(cfg),
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "Últimas noticias de Panamá",
      itemListOrder: "https://schema.org/ItemListOrderDescending",
      numberOfItems: stories.length,
      itemListElement: stories.map((s, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: s.url,
        name: s.title,
      })),
    },
  ];

  const main = `<section class="section">
  <h2 class="kicker">Lo último</h2>
  <ol class="stories">
${items}
  </ol>
</section>

<section class="section">
  <h2 class="kicker">Ediciones anteriores</h2>
  <ul class="editions">
${edits}
  </ul>
  <a class="more-link" href="/archivo/">Ver archivo completo &#8594;</a>
</section>`;

  return shell({
    cfg,
    title: `${cfg.title} — Noticias de Panamá, hoy`,
    description: cfg.description,
    path: "/",
    ogType: "website",
    jsonLd,
    mastheadExtra,
    bodyClass: "is-home",
    main,
  });
}

// ---------------------------------------------------------------------------
// Página de un día
// ---------------------------------------------------------------------------
export function dayPage({ cfg, day, stories, prevDay, nextDay, now }) {
  const longDate = formatDayKeyLong(day);
  const items = stories
    .map((s) =>
      renderStory(s, { lead: false, level: 3, now, timezone: cfg.timezone, images: cfg.images !== false })
    )
    .join("\n");

  const prev = prevDay
    ? `<a class="p" href="/${dayKeyToPath(prevDay)}">&#8592; ${escapeHtml(formatDayKeyShort(prevDay))}</a>`
    : `<span class="p">&#8592; inicio del archivo</span>`;
  const next = nextDay
    ? `<a class="n" href="/${dayKeyToPath(nextDay)}">${escapeHtml(formatDayKeyShort(nextDay))} &#8594;</a>`
    : `<span class="n">día más reciente</span>`;

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: `Noticias de Panamá — ${longDate}`,
      url: cfg.baseUrl + "/" + dayKeyToPath(day),
      inLanguage: "es-PA",
      isPartOf: { "@type": "WebSite", name: cfg.title, url: cfg.baseUrl + "/" },
      about: "Noticias de Panamá",
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      numberOfItems: stories.length,
      itemListElement: stories.map((s, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: s.url,
        name: s.title,
      })),
    },
  ];

  const main = `<article>
  <h1 class="tagline" style="font-style:normal">Portada del ${escapeHtml(longDate)}</h1>
  <p class="updated"><span class="dot"></span> ${stories.length} ${
    stories.length === 1 ? "noticia seleccionada" : "noticias seleccionadas"
  } de La Prensa y La Estrella</p>

  <section class="section" style="margin-top:1.6rem">
    <h2 class="kicker">La selección del día</h2>
    <ol class="stories">
${items}
    </ol>
  </section>

  <nav class="daynav">
    ${prev}
    <a href="/archivo/">Todas las ediciones</a>
    ${next}
  </nav>
</article>`;

  return shell({
    cfg,
    title: `Noticias de Panamá — ${longDate} · ${cfg.title}`,
    description: `Resumen de ${stories.length} noticias de Panamá publicadas el ${longDate} por La Prensa y La Estrella de Panamá, con enlace a cada fuente.`,
    path: "/" + dayKeyToPath(day),
    ogType: "article",
    jsonLd,
    main,
  });
}

// ---------------------------------------------------------------------------
// Índice del archivo
// ---------------------------------------------------------------------------
export function archivePage({ cfg, groups, totalItems, totalDays }) {
  const MESES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
  ];
  const body = groups
    .map((yr) => {
      const months = yr.months
        .map((mo) => {
          const days = mo.days
            .map(
              (d) =>
                `<li><a href="/${dayKeyToPath(d.day)}"><span class="date">${escapeHtml(
                  formatDayKeyMedium(d.day)
                )}</span><span class="count">${d.count} ${
                  d.count === 1 ? "nota" : "notas"
                } &#8594;</span></a></li>`
            )
            .join("\n");
          return `<p class="archive-month">${MESES[mo.month - 1]}</p>
<ul class="editions">
${days}
</ul>`;
        })
        .join("\n");
      return `<h2 class="archive-year">${yr.year}</h2>\n${months}`;
    })
    .join("\n");

  const main = `<div class="prose">
  <h1>Archivo</h1>
  <p>Cada día, Que Hay Panamá guarda su selección de noticias de Panamá. Aquí está el
  historial completo: ${totalItems} notas en ${totalDays} ediciones.</p>
</div>
<section class="section" style="margin-top:2rem">
${body}
</section>`;

  return shell({
    cfg,
    title: `Archivo de noticias de Panamá · ${cfg.title}`,
    description: `Historial diario de noticias de Panamá: ${totalItems} notas archivadas de La Prensa y La Estrella de Panamá.`,
    path: "/archivo/",
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: "Archivo de noticias de Panamá",
        url: cfg.baseUrl + "/archivo/",
        inLanguage: "es-PA",
        isPartOf: { "@type": "WebSite", name: cfg.title, url: cfg.baseUrl + "/" },
      },
    ],
    main,
  });
}

// ---------------------------------------------------------------------------
// Nota propia (content/*.md)
// ---------------------------------------------------------------------------
export function notePage({ cfg, post }) {
  const dateLong = formatLongDate(post.publishedAt, cfg.timezone);
  const figure = post.image
    ? `<figure class="note__figure"><img src="${escapeHtml(
        sizedImage(post.image, 1400, 788)
      )}" alt="" loading="lazy" decoding="async" onerror="this.closest('figure').remove()"></figure>`
    : "";
  const sourceBtn = post.externalUrl
    ? `<p class="note__source"><a href="${escapeHtml(
        post.externalUrl
      )}" target="_blank" rel="noopener noreferrer">Ver fuente <span class="arrow">&#8599;</span></a></p>`
    : "";

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      headline: post.title,
      datePublished: post.publishedAt,
      dateModified: post.publishedAt,
      inLanguage: "es-PA",
      mainEntityOfPage: cfg.baseUrl + post.url,
      author: { "@type": "Organization", name: cfg.title, url: cfg.baseUrl + "/" },
      publisher: {
        "@type": "Organization",
        name: cfg.title,
        url: cfg.baseUrl + "/",
        logo: cfg.baseUrl + "/assets/logo.svg",
      },
      ...(post.image ? { image: [post.image] } : {}),
      ...(post.summary ? { description: post.summary } : {}),
    },
  ];

  const main = `<article class="prose note">
  <p class="kicker" style="margin-bottom:0.9rem">Que Hay Panamá &middot; Nota propia</p>
  <h1>${escapeHtml(post.title)}</h1>
  <p class="note__meta"><time datetime="${escapeHtml(post.publishedAt)}">${escapeHtml(dateLong)}</time></p>
  ${figure}
  ${post.summary ? `<p class="note__lead">${escapeHtml(post.summary)}</p>` : ""}
  ${post.bodyHtml || ""}
  ${sourceBtn}
  <nav class="daynav">
    <a class="p" href="/">&#8592; Portada</a>
    <a href="/archivo/">Archivo</a>
    <a class="n" href="/${dayKeyToPath(post.day)}">Edición del día &#8594;</a>
  </nav>
</article>`;

  return shell({
    cfg,
    title: `${post.title} · ${cfg.title}`,
    description: post.summary || `${post.title} — Que Hay Panamá.`,
    path: post.url,
    ogType: "article",
    ogImage: post.image ? sizedImage(post.image, 1200, 630) : "",
    jsonLd,
    main,
  });
}

// ---------------------------------------------------------------------------
// Sobre este sitio
// ---------------------------------------------------------------------------
export function aboutPage({ cfg }) {
  const main = `<div class="prose">
  <h1>Sobre Que Hay Panamá</h1>
  <p><strong>Que Hay Panamá</strong> es un medio digital independiente. Cada día reúne
  entre 5 y 10 de las noticias más relevantes de Panamá y las presenta en un solo lugar:
  titular, un resumen de una o dos frases y el enlace directo a la nota original.</p>

  <h2>De dónde salen las noticias</h2>
  <p>El sitio lee automáticamente los canales públicos de
  <a href="https://www.prensa.com" rel="noopener">La Prensa</a> y de
  <a href="https://www.laestrella.com.pa" rel="noopener">La Estrella de Panamá</a>
  (esta última a través de Google Noticias) varias veces al día. Un programa selecciona
  las notas del día, arma esta página y la publica sola.</p>

  <h2>Qué NO hacemos</h2>
  <p>No copiamos los artículos completos ni alojamos su contenido. Todo el crédito y el
  tráfico van al medio que hizo el trabajo periodístico: cada titular enlaza a su fuente.
  Si eres editor de alguno de estos medios y quieres que ajustemos algo, escríbenos por
  <a href="${escapeHtml(contactUrl(cfg))}" rel="noopener" target="_blank">Instagram</a>.</p>

  <h2>Síguenos</h2>
  <ul>
${socialList(cfg)
  .map(
    (s) =>
      `    <li>${escapeHtml(s.name)} — <a href="${escapeHtml(s.url)}" rel="me noopener" target="_blank">${escapeHtml(
        s.handle || s.url
      )}</a></li>`
  )
  .join("\n")}
  </ul>
</div>`;

  return shell({
    cfg,
    title: `Sobre este sitio · ${cfg.title}`,
    description:
      "Qué es Que Hay Panamá, de dónde salen las noticias y cómo se actualiza el sitio automáticamente.",
    path: "/sobre/",
    main,
  });
}

// ---------------------------------------------------------------------------
// 404
// ---------------------------------------------------------------------------
export function notFoundPage({ cfg }) {
  const main = `<div class="notfound">
  <p class="code">404</p>
  <p class="tagline" style="font-style:normal">Esta página no existe o ya no está.</p>
  <p style="margin-top:1.5rem"><a class="more-link" href="/">Volver a la portada &#8594;</a></p>
</div>`;
  return shell({
    cfg,
    title: `Página no encontrada · ${cfg.title}`,
    description: "La página que buscas no existe.",
    path: "/404.html",
    main,
  });
}

// ---------------------------------------------------------------------------
// RSS propio
// ---------------------------------------------------------------------------
export function rssFeed({ cfg, items, now = new Date() }) {
  const entries = items
    .map((it) => {
      const desc = truncate(it.summary || it.title, 320);
      return `  <item>
    <title>${escapeXml(it.title)}</title>
    <link>${escapeXml(it.url)}</link>
    <guid isPermaLink="false">qhp-${escapeXml(it.id)}</guid>
    <pubDate>${new Date(it.publishedAt).toUTCString()}</pubDate>
    <source url="${escapeXml(it.sourceHome || cfg.baseUrl)}">${escapeXml(it.source)}</source>
    <description>${escapeXml(desc + (it.via ? ` (vía ${it.via})` : ""))}</description>
  </item>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>${escapeXml(cfg.title)}</title>
  <link>${escapeXml(cfg.baseUrl)}/</link>
  <description>${escapeXml(cfg.description)}</description>
  <language>es-PA</language>
  <lastBuildDate>${now.toUTCString()}</lastBuildDate>
  <atom:link href="${escapeXml(cfg.baseUrl)}/rss.xml" rel="self" type="application/rss+xml"/>
${entries}
</channel>
</rss>
`;
}

// ---------------------------------------------------------------------------
// Sitemap
// ---------------------------------------------------------------------------
export function sitemap({ cfg, urls }) {
  const body = urls
    .map(
      (u) =>
        `  <url><loc>${escapeXml(cfg.baseUrl + u.path)}</loc>` +
        (u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : "") +
        (u.changefreq ? `<changefreq>${u.changefreq}</changefreq>` : "") +
        (u.priority != null ? `<priority>${u.priority}</priority>` : "") +
        `</url>`
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;
}
