// Utilidades: fechas en horario de Panamá, limpieza de texto, escapes.
import { createHash } from "node:crypto";

// ---------------------------------------------------------------------------
// Texto / HTML
// ---------------------------------------------------------------------------

const NAMED_ENTITIES = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú",
  Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú",
  ntilde: "ñ", Ntilde: "Ñ", uuml: "ü", Uuml: "Ü",
  iquest: "¿", iexcl: "¡", ordf: "ª", ordm: "º", deg: "°",
  laquo: "«", raquo: "»", ldquo: "“", rdquo: "”",
  lsquo: "‘", rsquo: "’", sbquo: "‚", bdquo: "„",
  ndash: "–", mdash: "—", hellip: "…", middot: "·",
  bull: "•", eur: "€", euro: "€", pound: "£", cent: "¢", copy: "©",
  reg: "®", trade: "™", times: "×", divide: "÷", frac12: "½",
  frac14: "¼", frac34: "¾", plusmn: "±", micro: "µ", para: "¶",
  sect: "§", dagger: "†", Dagger: "‡", permil: "‰", prime: "′",
  Prime: "″", oline: "‾", frasl: "⁄", hearts: "♥", spades: "♠",
};

export function decodeEntities(str = "") {
  return String(str)
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => safeCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => safeCodePoint(parseInt(d, 10)))
    .replace(/&([a-zA-Z][a-zA-Z0-9]*);/g, (m, name) =>
      Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, name)
        ? NAMED_ENTITIES[name]
        : m
    );
}

function safeCodePoint(cp) {
  try {
    if (!Number.isFinite(cp) || cp < 0 || cp > 0x10ffff) return "";
    return String.fromCodePoint(cp);
  } catch {
    return "";
  }
}

export function stripCdata(str = "") {
  return String(str).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
}

export function stripTags(str = "") {
  return String(str).replace(/<[^>]*>/g, " ");
}

// De un fragmento de RSS (con CDATA, HTML y entidades) a texto plano limpio.
export function cleanText(str = "") {
  let out = stripCdata(String(str));
  out = decodeEntities(out); // por si el HTML viene escapado (&lt;p&gt;)
  out = stripTags(out);
  out = decodeEntities(out);
  return out.replace(/\s+/g, " ").trim();
}

export function truncate(str = "", max = 220) {
  const s = String(str).trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.5 ? cut.slice(0, lastSpace) : cut).replace(/[.,;:–—\s]+$/, "") + "…";
}

export function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function escapeXml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function sha1short(str, len = 12) {
  return createHash("sha1").update(String(str)).digest("hex").slice(0, len);
}

// ---------------------------------------------------------------------------
// Fechas (horario de Panamá, UTC-5 todo el año)
// ---------------------------------------------------------------------------

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const MESES_ABBR = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
const DIAS_ABBR = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];

export function toDate(value) {
  if (value instanceof Date) return value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Partes de la fecha en el huso de Panamá.
export function panamaParts(date, timeZone = "America/Panama") {
  const d = toDate(date) || new Date();
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false, weekday: "short",
  });
  const parts = Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour === "24" ? "0" : parts.hour),
    minute: Number(parts.minute),
  };
}

// "2026-08-29" en horario de Panamá.
export function panamaDayKey(date, timeZone = "America/Panama") {
  const p = panamaParts(date, timeZone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

// "sábado 29 de agosto de 2026" a partir de una fecha real.
export function formatLongDate(date, timeZone = "America/Panama") {
  const d = toDate(date) || new Date();
  const raw = new Intl.DateTimeFormat("es-PA", {
    timeZone, weekday: "long", day: "numeric", month: "long", year: "numeric",
  }).format(d);
  return raw.replace(",", "");
}

// "SÁB 29 AGO 2026" a partir de una fecha real.
export function formatShortDate(date, timeZone = "America/Panama") {
  const p = panamaParts(date, timeZone);
  const d = toDate(date) || new Date();
  const wd = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(d);
  const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const diaAbbr = DIAS_ABBR[map[wd] ?? 0];
  return `${diaAbbr} ${p.day} ${MESES_ABBR[p.month - 1]} ${p.year}`;
}

// "29 de agosto de 2026" a partir de una clave "YYYY-MM-DD".
export function formatDayKeyLong(dayKey) {
  const [y, m, d] = dayKey.split("-").map(Number);
  return `${d} de ${MESES[m - 1]} de ${y}`;
}

// "29 AGO" corto, para listas.
export function formatDayKeyShort(dayKey) {
  const [, m, d] = dayKey.split("-").map(Number);
  return `${d} ${MESES_ABBR[m - 1]}`;
}

// "29 AGO 2026"
export function formatDayKeyMedium(dayKey) {
  const [y, m, d] = dayKey.split("-").map(Number);
  return `${d} ${MESES_ABBR[m - 1]} ${y}`;
}

export function dayKeyToPath(dayKey) {
  const [y, m, d] = dayKey.split("-");
  return `${y}/${m}/${d}/`;
}

// "hace 5 min" / "hace 3 h" / "ayer" / "hace 4 días" / "29 ago"
export function timeAgo(date, now = new Date(), timeZone = "America/Panama") {
  const d = toDate(date);
  if (!d) return "";
  const diffMs = now.getTime() - d.getTime();
  const min = Math.round(diffMs / 60000);
  if (min < -2) {
    // fecha en el futuro (p. ej. una nota propia programada para más tarde)
    return panamaDayKey(d, timeZone) === panamaDayKey(now, timeZone)
      ? "hoy"
      : formatDayKeyShort(panamaDayKey(d, timeZone)).toLowerCase();
  }
  if (min < 1) return "hace un momento";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const todayKey = panamaDayKey(now, timeZone);
  const thatKey = panamaDayKey(d, timeZone);
  const dayDiff = Math.round(
    (Date.parse(todayKey + "T12:00:00Z") - Date.parse(thatKey + "T12:00:00Z")) / 86400000
  );
  if (dayDiff <= 1) return "ayer";
  if (dayDiff < 7) return `hace ${dayDiff} días`;
  return formatDayKeyShort(thatKey).toLowerCase();
}

export { MESES, MESES_ABBR };
