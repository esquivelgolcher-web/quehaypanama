// Lector de RSS/Atom minimalista, sin dependencias.
// Suficiente para feeds regulares como los de Arc XP (La Prensa) y Google Noticias.
import { cleanText, decodeEntities, stripCdata } from "./util.mjs";

const UA =
  "Mozilla/5.0 (compatible; QueHayPanamaBot/1.0; +https://quehaypanama.com/sobre)";

export async function fetchText(url, { timeoutMs = 15000, retries = 1 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        signal: ctrl.signal,
        redirect: "follow",
        headers: {
          "User-Agent": UA,
          Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
          "Accept-Language": "es-PA,es;q=0.9",
        },
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`);
      return await res.text();
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      if (attempt < retries) await new Promise((r) => setTimeout(r, 1200));
    }
  }
  throw lastErr;
}

// --- helpers de extracción -------------------------------------------------

function firstTag(block, name) {
  // admite prefijos de namespace: (?:\w+:)?name
  const re = new RegExp(`<(?:[\\w-]+:)?${name}(\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[\\w-]+:)?${name}>`, "i");
  const m = block.match(re);
  return m ? m[2] : "";
}

function selfClosingAttr(block, name, attr) {
  const re = new RegExp(`<(?:[\\w-]+:)?${name}\\b[^>]*?\\b${attr}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i");
  const m = block.match(re);
  return m ? (m[2] ?? m[3] ?? "") : "";
}

function allSelfClosing(block, name) {
  const re = new RegExp(`<(?:[\\w-]+:)?${name}\\b[^>]*?>`, "gi");
  return block.match(re) || [];
}

function attrOf(tag, attr) {
  const m = tag.match(new RegExp(`\\b${attr}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i"));
  return m ? (m[2] ?? m[3] ?? "") : "";
}

function looksLikeImage(url = "") {
  return /\.(jpe?g|png|webp|gif|avif)(\?|$)/i.test(url) || /\/resizer\//i.test(url) || /image/i.test(url);
}

function extractImage(block) {
  // media:content / media:thumbnail: elige la primera que parezca imagen (o la mayor).
  const media = [...allSelfClosing(block, "media:content"), ...allSelfClosing(block, "media:thumbnail")];
  let best = "";
  let bestW = -1;
  for (const tag of media) {
    const url = decodeEntities(attrOf(tag, "url"));
    if (!url) continue;
    const type = attrOf(tag, "medium") || attrOf(tag, "type");
    if (type && !/image/i.test(type)) continue;
    const w = Number(attrOf(tag, "width")) || 0;
    if (w > bestW || (!best && (looksLikeImage(url) || type))) {
      best = url;
      bestW = w;
    }
  }
  if (best) return best;

  const enclosure = allSelfClosing(block, "enclosure").find((t) => /image/i.test(attrOf(t, "type")));
  if (enclosure) return decodeEntities(attrOf(enclosure, "url"));

  const imageBlock = firstTag(block, "image");
  if (imageBlock) {
    const u = firstTag(imageBlock, "url");
    if (u) return decodeEntities(cleanText(u));
  }

  const desc = stripCdata(firstTag(block, "description") + firstTag(block, "encoded"));
  const img = desc.match(/<img[^>]+src\s*=\s*("([^"]+)"|'([^']+)')/i);
  if (img) return decodeEntities(img[2] ?? img[3] ?? "");

  return "";
}

// --- parser principal ----------------------------------------------------

export function parseFeed(xml) {
  const text = String(xml || "");
  const isAtom = /<feed[\s>]/i.test(text) && !/<rss[\s>]/i.test(text);
  const blockRe = isAtom
    ? /<entry\b[\s\S]*?<\/entry>/gi
    : /<item\b[\s\S]*?<\/item>/gi;

  const blocks = text.match(blockRe) || [];
  const items = [];

  for (const block of blocks) {
    const title = cleanText(firstTag(block, "title"));
    if (!title) continue;

    let link = "";
    if (isAtom) {
      const linkTags = allSelfClosing(block, "link");
      const alt = linkTags.find((t) => /rel\s*=\s*["']?alternate/i.test(t)) || linkTags[0];
      link = alt ? decodeEntities(attrOf(alt, "href")) : "";
    } else {
      link = cleanText(firstTag(block, "link"));
    }

    const guid = cleanText(firstTag(block, "guid") || firstTag(block, "id"));
    if (!link && guid && /^https?:\/\//i.test(guid)) link = guid;
    if (!link) continue;

    const pubDate =
      cleanText(firstTag(block, "pubDate")) ||
      cleanText(firstTag(block, "published")) ||
      cleanText(firstTag(block, "updated")) ||
      cleanText(firstTag(block, "date")) ||
      "";

    const rawDesc =
      firstTag(block, "description") ||
      firstTag(block, "summary") ||
      firstTag(block, "encoded"); // content:encoded
    const description = cleanText(rawDesc);

    const creator = cleanText(firstTag(block, "creator")); // dc:creator
    const image = extractImage(block);

    items.push({ title, link, guid: guid || link, pubDate, description, creator, image });
  }

  return items;
}

export async function loadSource(source, { timeoutMs = 15000 } = {}) {
  const xml = await fetchText(source.url, { timeoutMs });
  const raw = parseFeed(xml);
  return raw.map((it) => ({ ...it, sourceName: source.name, sourceHome: source.homepage, via: source.via || null }));
}
