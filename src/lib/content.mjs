// Carga de notas propias escritas a mano en content/*.md
// Formato de cada archivo:
//
//   ---
//   titulo: Mi título
//   fecha: 2026-08-30 15:00
//   resumen: Una o dos frases que resumen la nota.
//   foto: https://.../imagen.jpg        (opcional)
//   enlace: https://.../fuente          (opcional, se muestra como "Ver fuente")
//   destacada: si                       (opcional: la fija como nota principal del día)
//   ---
//
//   Aquí va el texto de la nota. Párrafos separados por una línea en blanco.
//   Se admite **negrita**, *cursiva*, [enlaces](https://...), ## subtítulos y - listas.

import fs from "node:fs";
import path from "node:path";
import { sha1short, panamaDayKey, escapeHtml } from "./util.mjs";

function slugify(s) {
  return String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "nota";
}

function parseFrontmatter(raw) {
  const m = raw.match(/^﻿?---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: raw.trim() };
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^\s*([A-Za-zñ_][\w-]*)\s*:\s*(.*)$/);
    if (!kv) continue;
    let val = kv[2].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    meta[kv[1].toLowerCase()] = val;
  }
  return { meta, body: m[2].trim() };
}

function truthy(v) {
  return /^(s[ií]|si|true|1|x|yes)$/i.test(String(v || "").trim());
}

// fecha flexible -> Date (interpretada en horario de Panamá, UTC-5)
function parseDate(value, fallback) {
  const s = String(value || "").trim();
  if (!s) return fallback;
  let m;
  if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})/))) {
    return new Date(
      `${m[1]}-${m[2]}-${m[3]}T${m[4].padStart(2, "0")}:${m[5]}:00-05:00`
    );
  }
  if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/))) {
    return new Date(`${m[1]}-${m[2]}-${m[3]}T12:00:00-05:00`);
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? fallback : d;
}

// --- Markdown mínimo y seguro -------------------------------------------
// Detecta la estructura sobre el texto crudo, luego escapa y aplica el
// formato en línea (negrita, cursiva, enlaces…).
function inlineMd(escaped) {
  return escaped
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[\s(>])\*([^*\n]+)\*(?=[\s).,;:!?]|<|$)/g, "$1<em>$2</em>")
    .replace(/(^|[\s(>])_([^_\n]+)_(?=[\s).,;:!?]|<|$)/g, "$1<em>$2</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+|\/[^\s)]*|#[^\s)]*)\)/g,
      (_m, text, href) =>
        `<a href="${href}"${/^https?:/i.test(href) ? ' rel="noopener" target="_blank"' : ""}>${text}</a>`
    );
}

function fmt(str) {
  return inlineMd(escapeHtml(String(str)));
}

export function mdToHtml(src) {
  const raw = String(src || "").replace(/\r\n/g, "\n").trim();
  const blocks = raw.split(/\n\s*\n/).map((b) => b.replace(/\s+$/g, "")).filter(Boolean);
  const out = [];

  for (const block of blocks) {
    const lines = block.split("\n");
    const first = lines[0];

    if (/^#{1,3}\s+/.test(first)) {
      const level = first.match(/^(#{1,3})/)[1].length === 1 ? 2 : first.match(/^(#{1,3})/)[1].length;
      out.push(`<h${level}>${fmt(first.replace(/^#{1,3}\s+/, ""))}</h${level}>`);
    } else if (/^\s*>\s?/.test(first)) {
      const text = lines.map((l) => l.replace(/^\s*>\s?/, "")).join(" ");
      out.push(`<blockquote>${fmt(text)}</blockquote>`);
    } else if (/^\s*[-*]\s+/.test(first)) {
      const items = [];
      for (const l of lines) {
        const m = l.match(/^\s*[-*]\s+(.*)$/);
        if (m) items.push(m[1]);
        else if (items.length) items[items.length - 1] += " " + l.trim();
      }
      out.push("<ul>" + items.map((it) => `<li>${fmt(it)}</li>`).join("") + "</ul>");
    } else {
      // salto de línea simple = espacio; párrafo nuevo = línea en blanco
      out.push(`<p>${fmt(lines.join(" "))}</p>`);
    }
  }
  return out.join("\n");
}

// ----------------------------------------------------------------------
export function loadManualPosts(dir, { timezone = "America/Panama", now = new Date() } = {}) {
  let files = [];
  try {
    files = fs.readdirSync(dir).filter((f) => /\.md$/i.test(f) && !f.startsWith("_") && f.toLowerCase() !== "readme.md");
  } catch {
    return [];
  }

  const posts = [];
  for (const file of files) {
    const raw = fs.readFileSync(path.join(dir, file), "utf8");
    const { meta, body } = parseFrontmatter(raw);
    const title = (meta.titulo || meta.title || "").trim();
    if (!title) {
      console.warn(`[qhp] content/${file}: sin "titulo:", se omite.`);
      continue;
    }
    const slug = slugify(meta.slug || file.replace(/\.md$/i, "") || title);
    const when = parseDate(meta.fecha || meta.date, now);

    posts.push({
      id: "manual-" + slug,
      slug,
      isManual: true,
      title,
      summary: (meta.resumen || meta.summary || "").trim(),
      url: `/nota/${slug}/`,
      externalUrl: /^https?:\/\//i.test(meta.enlace || "") ? meta.enlace.trim() : "",
      image: /^https?:\/\//i.test(meta.foto || meta.image || "") ? (meta.foto || meta.image).trim() : "",
      featured: truthy(meta.destacada || meta.featured),
      bodyHtml: mdToHtml(body),
      source: "Que Hay Panamá",
      sourceHome: "/",
      via: null,
      publishedAt: when.toISOString(),
      day: panamaDayKey(when, timezone),
      firstSeenAt: when.toISOString(),
    });
  }
  posts.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  return posts;
}
