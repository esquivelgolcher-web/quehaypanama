// ============================================================================
// Que Hay Panamá — generador del sitio
// Lee los feeds, actualiza el historial (data/archive.json) y escribe dist/.
// Sin dependencias externas. Requiere Node 20+.
// ============================================================================
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadSource } from "./lib/rss.mjs";
import { loadManualPosts } from "./lib/content.mjs";
import {
  sha1short,
  toDate,
  panamaDayKey,
  timeAgo,
  dayKeyToPath,
} from "./lib/util.mjs";
import {
  homePage,
  dayPage,
  archivePage,
  aboutPage,
  notFoundPage,
  notePage,
  rssFeed,
  sitemap,
} from "./templates.mjs";

const ROOT = path.resolve(fileURLToPath(import.meta.url), "../..");
const DIST = path.join(ROOT, "dist");
const DATA = path.join(ROOT, "data");
const PUBLIC = path.join(ROOT, "public");
const ARCHIVE_FILE = path.join(DATA, "archive.json");

const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, "site.config.json"), "utf8"));
const TZ = cfg.timezone || "America/Panama";
const NOW = new Date();

const CAP_PER_DAY = cfg.home?.max ?? 10;
const PER_SOURCE_SOFT = cfg.perSourceSoftCap ?? Math.ceil(CAP_PER_DAY * 0.6);
const MAX_AGE_DAYS = cfg.maxAgeDays ?? 14;

const log = (...a) => console.log("[qhp]", ...a);

// ---------------------------------------------------------------------------
// utilidades locales
// ---------------------------------------------------------------------------
function write(relPath, content) {
  const full = path.join(DIST, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

function normKey(s = "") {
  return String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripTracking(u) {
  try {
    const url = new URL(u);
    for (const k of [...url.searchParams.keys()]) {
      if (/^(utm_|fbclid$|gclid$|mc_|igsh$|ref$|ref_src$|s=|_ga$)/i.test(k)) {
        url.searchParams.delete(k);
      }
    }
    return url.toString();
  } catch {
    return u;
  }
}

function canonicalForId(u) {
  try {
    const x = new URL(u);
    return (x.host + x.pathname).toLowerCase().replace(/\/+$/, "");
  } catch {
    return String(u);
  }
}

function cleanTitle(t, sourceName) {
  let s = (t || "").replace(/\s+/g, " ").trim();
  const suffixes = [sourceName, "La Estrella de Panamá", "La Prensa", "Google Noticias"].filter(Boolean);
  for (const suf of suffixes) {
    const re = new RegExp("\\s+[-–|·]\\s+" + suf.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*$", "i");
    s = s.replace(re, "").trim();
  }
  return s;
}

function normalizeItem(raw, source) {
  let url = (raw.link || "").trim();
  if (!/^https?:\/\//i.test(url)) return null;
  url = stripTracking(url);

  const dt = toDate(raw.pubDate) || NOW;
  const ageDays = (NOW.getTime() - dt.getTime()) / 86400000;
  if (ageDays > MAX_AGE_DAYS) return null; // demasiado vieja para "noticias"
  const when = ageDays < -2 ? NOW : dt; // fecha futura rara -> ahora

  const title = cleanTitle(raw.title, source.name);
  if (!title) return null;
  const nk = normKey(title);
  if (nk.length < 8 || nk === normKey(source.name)) return null;

  let summary = (raw.description || "").replace(/\s+/g, " ").trim();
  if (summary) {
    const a = normKey(summary);
    const b = normKey(title);
    if (!a || a.length < 24 || a === b || a.startsWith(b) || b.startsWith(a)) summary = "";
  }

  let image = (raw.image || "").trim();
  if (!/^https?:\/\//i.test(image)) image = "";

  return {
    id: sha1short(canonicalForId(url)),
    title,
    url,
    source: source.name,
    sourceHome: source.homepage,
    via: source.via || null,
    summary,
    image,
    publishedAt: when.toISOString(),
    day: panamaDayKey(when, TZ),
    firstSeenAt: NOW.toISOString(),
  };
}

function interleaveBySource(items, cap) {
  const queues = new Map();
  for (const it of items) {
    if (!queues.has(it.source)) queues.set(it.source, []);
    queues.get(it.source).push(it);
  }
  const qs = [...queues.values()];
  const out = [];
  let i = 0;
  while (out.length < cap && qs.some((q) => q.length)) {
    const q = qs[i % qs.length];
    if (q.length) out.push(q.shift());
    i++;
  }
  return out;
}

function writeArchive(list) {
  fs.mkdirSync(DATA, { recursive: true });
  const body = list.map((x) => JSON.stringify(x)).join(",\n");
  fs.writeFileSync(ARCHIVE_FILE, `[\n${body}\n]\n`);
}

// ---------------------------------------------------------------------------
// 1. Cargar historial
// ---------------------------------------------------------------------------
let archive = [];
try {
  const parsed = JSON.parse(fs.readFileSync(ARCHIVE_FILE, "utf8"));
  if (Array.isArray(parsed)) archive = parsed;
} catch {
  log("Sin historial previo, empezando de cero.");
}
const byId = new Map(archive.map((it) => [it.id, it]));

// ---------------------------------------------------------------------------
// 2. Descargar feeds
// ---------------------------------------------------------------------------
let sourcesOk = 0;
let incoming = [];
for (const source of cfg.sources) {
  try {
    const raw = await loadSource(source);
    sourcesOk++;
    let n = 0;
    for (const r of raw) {
      const item = normalizeItem(r, source);
      if (item) {
        incoming.push(item);
        n++;
      }
    }
    log(`✓ ${source.name}: ${n} ítems`);
  } catch (err) {
    log(`✗ ${source.name}: ${err.message}`);
  }
}

// más recientes primero (para que el tope por día conserve lo nuevo)
incoming.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

// ---------------------------------------------------------------------------
// 3. Fusionar en el historial (con tope de 5-10 por día y balance de fuentes)
// ---------------------------------------------------------------------------
function dayStats(dayKey) {
  const items = archive.filter((it) => it.day === dayKey);
  const bySrc = {};
  for (const it of items) bySrc[it.source] = (bySrc[it.source] || 0) + 1;
  return { total: items.length, bySrc };
}

const titleSeen = new Set(archive.map((it) => it.source + "|" + normKey(it.title)));

let added = 0;
for (const it of incoming) {
  const existing = byId.get(it.id);
  if (existing) {
    if (!existing.summary && it.summary) existing.summary = it.summary;
    if (!existing.image && it.image) existing.image = it.image;
    continue;
  }
  const tkey = it.source + "|" + normKey(it.title);
  if (titleSeen.has(tkey)) continue; // misma noticia con otra URL

  const stats = dayStats(it.day);
  if (stats.total >= CAP_PER_DAY) continue;

  const thisSrc = stats.bySrc[it.source] || 0;
  const otherMax = Math.max(0, ...Object.entries(stats.bySrc)
    .filter(([s]) => s !== it.source)
    .map(([, n]) => n));
  // no dejar que una sola fuente acapare el día si la otra aún tiene menos
  if (thisSrc >= PER_SOURCE_SOFT && thisSrc > otherMax && stats.total >= Math.ceil(CAP_PER_DAY / 2)) {
    continue;
  }

  archive.push(it);
  byId.set(it.id, it);
  titleSeen.add(tkey);
  added++;
}

// ---------------------------------------------------------------------------
// 4. Ordenar, limitar
// ---------------------------------------------------------------------------
archive.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
if (archive.length > (cfg.archiveMaxItems ?? 4000)) {
  archive = archive.slice(0, cfg.archiveMaxItems ?? 4000);
}

if (sourcesOk === 0 && archive.length === 0) {
  console.error("[qhp] No se pudo leer ningún feed y no hay historial. Abortando.");
  process.exit(1);
}
if (sourcesOk === 0) {
  log("AVISO: ningún feed respondió; se reconstruye el sitio con el historial guardado.");
}

writeArchive(archive);
log(`Historial: ${archive.length} notas (${added} nuevas en esta corrida).`);

// --- notas propias (content/*.md) --------------------------------------
const manualPosts = loadManualPosts(path.join(ROOT, "content"), { timezone: TZ, now: NOW });
if (manualPosts.length) log(`Notas propias: ${manualPosts.length}`);

// Lista completa: notas propias + agregadas, más recientes primero.
const allItems = [...manualPosts, ...archive].sort((a, b) =>
  b.publishedAt.localeCompare(a.publishedAt)
);

// ---------------------------------------------------------------------------
// 5. Derivar datos para las páginas
// ---------------------------------------------------------------------------
const todayKey = panamaDayKey(NOW, TZ);

const pinRank = (x) => (x.isManual && x.featured ? 2 : x.isManual ? 1 : 0);

const byDay = new Map();
for (const it of allItems) {
  if (!byDay.has(it.day)) byDay.set(it.day, []);
  byDay.get(it.day).push(it);
}
for (const list of byDay.values()) {
  list.sort(
    (a, b) => pinRank(b) - pinRank(a) || b.publishedAt.localeCompare(a.publishedAt)
  );
}
const dayKeys = [...byDay.keys()].sort().reverse();

// Portada: notas propias de hoy fijadas arriba + la selección agregada de hoy.
let homeBase = byDay.has(todayKey) ? [...byDay.get(todayKey)] : [];
let di = 0;
while (
  homeBase.filter((x) => !x.isManual).length < (cfg.home?.min ?? 5) &&
  di < dayKeys.length
) {
  if (dayKeys[di] !== todayKey) homeBase = homeBase.concat(byDay.get(dayKeys[di]));
  di++;
}
const manualHome = homeBase
  .filter((x) => x.isManual)
  .sort((a, b) => pinRank(b) - pinRank(a) || b.publishedAt.localeCompare(a.publishedAt));
const feedHome = interleaveBySource(
  homeBase.filter((x) => !x.isManual),
  cfg.home?.max ?? 10
);
const homeItems = [...manualHome, ...feedHome];

const editions = dayKeys
  .filter((k) => k !== todayKey)
  .slice(0, cfg.recentEditionsOnHome ?? 14)
  .map((k) => ({ day: k, count: byDay.get(k).length }));

// ---------------------------------------------------------------------------
// 6. Preparar carpeta dist/ y copiar activos
// ---------------------------------------------------------------------------
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });

write("assets/styles.css", fs.readFileSync(path.join(ROOT, "src", "styles.css")));
write("assets/logo.svg", fs.readFileSync(path.join(PUBLIC, "logo.svg")));
write(".nojekyll", "");

// copiar el resto de public/ a la raíz de dist/
let hasCNAME = false;
let ogImage = "";
if (fs.existsSync(PUBLIC)) {
  for (const name of fs.readdirSync(PUBLIC)) {
    if (name === "logo.svg") continue;
    const src = path.join(PUBLIC, name);
    if (fs.statSync(src).isFile()) {
      write(name, fs.readFileSync(src));
      if (name === "CNAME") hasCNAME = true;
      if (name === "og.png") ogImage = "/og.png";
    }
  }
}
if (!hasCNAME && cfg.domain) write("CNAME", cfg.domain + "\n");

// ---------------------------------------------------------------------------
// 7. Escribir páginas
// ---------------------------------------------------------------------------
// "Actualizado ..." = última vez que se trajeron noticias (nota agregada más reciente)
const freshest = archive[0] || allItems[0];
const updatedAgo = freshest ? timeAgo(freshest.publishedAt, NOW, TZ) : "hoy";

write(
  "index.html",
  homePage({ cfg, stories: homeItems, editions, updatedAgo, now: NOW })
);

// Páginas de las notas propias
for (const post of manualPosts) {
  write(`nota/${post.slug}/index.html`, notePage({ cfg, post, now: NOW }));
}

for (let i = 0; i < dayKeys.length; i++) {
  const day = dayKeys[i];
  write(
    `${dayKeyToPath(day)}index.html`,
    dayPage({
      cfg,
      day,
      stories: byDay.get(day),
      prevDay: dayKeys[i + 1] || null, // más antiguo
      nextDay: dayKeys[i - 1] || null, // más reciente
      now: NOW,
    })
  );
}

// índice de archivo agrupado por año / mes
const groups = [];
for (const key of dayKeys) {
  const [y, m] = key.split("-").map(Number);
  let yg = groups.find((g) => g.year === y);
  if (!yg) groups.push((yg = { year: y, months: [] }));
  let mg = yg.months.find((g) => g.month === m);
  if (!mg) yg.months.push((mg = { month: m, days: [] }));
  mg.days.push({ day: key, count: byDay.get(key).length });
}
write(
  "archivo/index.html",
  archivePage({ cfg, groups, totalItems: allItems.length, totalDays: dayKeys.length })
);

write("sobre/index.html", aboutPage({ cfg }));
write("404.html", notFoundPage({ cfg }));

// ---------------------------------------------------------------------------
// 8. Feeds y SEO
// ---------------------------------------------------------------------------
write(
  "rss.xml",
  rssFeed({ cfg, items: allItems.slice(0, cfg.ownFeedItems ?? 50), now: NOW })
);

const isoDay = NOW.toISOString().slice(0, 10);
write(
  "sitemap.xml",
  sitemap({
    cfg,
    urls: [
      { path: "/", changefreq: "hourly", priority: "1.0", lastmod: isoDay },
      { path: "/archivo/", changefreq: "daily", priority: "0.6", lastmod: isoDay },
      { path: "/sobre/", changefreq: "monthly", priority: "0.3" },
      ...dayKeys.map((k) => ({
        path: "/" + dayKeyToPath(k),
        changefreq: k === todayKey ? "hourly" : "weekly",
        priority: k === todayKey ? "0.8" : "0.5",
        lastmod: k === todayKey ? isoDay : k,
      })),
      ...manualPosts.map((p) => ({
        path: p.url,
        changefreq: "monthly",
        priority: "0.7",
        lastmod: p.publishedAt.slice(0, 10),
      })),
    ],
  })
);

write(
  "robots.txt",
  `User-agent: *
Allow: /

Sitemap: ${cfg.baseUrl}/sitemap.xml
`
);

write(
  "llms.txt",
  `# ${cfg.title}

> ${cfg.description}

Idioma: español (Panamá). Actualización: automática, varias veces al día.
Medio digital independiente: reúne y resume noticias de otros medios y enlaza a la
fuente; no aloja los artículos completos.

## Páginas
- [Portada](${cfg.baseUrl}/): las últimas noticias del día
- [Archivo](${cfg.baseUrl}/archivo/): historial diario completo (${allItems.length} notas)
- [RSS](${cfg.baseUrl}/rss.xml): feed de las últimas notas
- [Sobre este sitio](${cfg.baseUrl}/sobre/)

## Fuentes
- La Prensa — https://www.prensa.com
- La Estrella de Panamá — https://www.laestrella.com.pa (vía Google Noticias)

## Uso
Los titulares y resúmenes pertenecen a cada medio citado. Al citar, atribuye la nota
a "La Prensa" o "La Estrella de Panamá" y menciona "Que Hay Panamá" como agregador.
`
);

// ---------------------------------------------------------------------------
log(
  `Listo. ${dayKeys.length} ediciones, portada con ${homeItems.length} notas. dist/ generado.`
);
