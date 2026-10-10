// Safe markdown for the interactive blocks (WP5c). Raw HTML in the source is escaped, never rendered;
// links only keep http(s), mailto, # and relative hrefs (no javascript:). Own Marked instance, so the
// global `marked` that other lanes may configure is untouched.
import { Marked } from 'marked';

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = (s: string): string => s.replace(/[&<>"']/g, c => ESC[c]!);

const safeHref = (href: string): string | null => {
  const h = href.trim();
  if (/^(https?:|mailto:|#|\.{0,2}\/|[\w.-]+(\/|$|#|\?))/i.test(h) && !/^\s*(javascript|data|vbscript):/i.test(h)) return h;
  return null;
};

const md = new Marked({ gfm: true, breaks: false, async: false });
md.use({
  renderer: {
    html({ text }) { return escapeHtml(text); },
    link({ href, title, tokens }) {
      const inner = this.parser.parseInline(tokens);
      const h = safeHref(href);
      if (!h) return inner;
      const t = title ? ` title="${escapeHtml(title)}"` : '';
      const ext = /^https?:/i.test(h) ? ' target="_blank" rel="noopener"' : '';
      return `<a href="${escapeHtml(h)}"${t}${ext}>${inner}</a>`;
    },
    image({ text }) { return escapeHtml(text); },   // no remote images inside task text
  },
});

/** Block-level markdown -> HTML string (paragraphs, lists, code). */
export function renderMd(src: string | null | undefined): string {
  if (!src) return '';
  return md.parse(String(src)) as string;
}

/** Inline markdown -> HTML string (no wrapping <p>): option texts, step titles, prompts. */
export function renderInline(src: string | null | undefined): string {
  if (!src) return '';
  return md.parseInline(String(src)) as string;
}

/** Plain text of a markdown string (for aria labels and comparisons). */
export function plainText(src: string | null | undefined): string {
  return renderInline(src).replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
}
