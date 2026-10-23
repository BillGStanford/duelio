function bodyOf(html: string) {
  const m = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  return m ? m[1] : html;
}

/** Wikipedia's own Parsoid HTML, reduced to inert reading markup. */
export function sanitizeWikipediaHtml(html: string) {
  return bodyOf(html)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|noscript|iframe|object|embed|form|textarea|select|template|svg|button)\b[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<(link|meta|base|input)\b[^>]*>/gi, '')
    .replace(/\s(on[a-z]+|srcdoc|formaction)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s(href|src|xlink:href|action)\s*=\s*(["'])\s*(?:javascript|vbscript):[\s\S]*?\2/gi, ' $1="#"')
    .replace(/\shref\s*=\s*(["'])\s*data:[\s\S]*?\1/gi, ' href="#"')
    .replace(/(["'\s,])\/\/(upload\.wikimedia\.org|commons\.wikimedia\.org|en\.wikipedia\.org)/g, '$1https://$2')
    .replace(/\sloading="lazy"/g, '')
    .trim();
}
