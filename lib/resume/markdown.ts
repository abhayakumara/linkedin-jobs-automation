// Tiny, dependency-free Markdown → HTML renderer covering what resumes use:
// headings, bold/italic, links, bullet lists, and paragraphs. Not a full parser.

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function inline(s: string): string {
  return escapeHtml(s)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

export function markdownToHtml(md: string): string {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let inList = false;

  const closeList = () => {
    if (inList) {
      out.push("</ul>");
      inList = false;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^\s*[-•*]\s+/.test(line)) {
      if (!inList) {
        out.push("<ul>");
        inList = true;
      }
      out.push(`<li>${inline(line.replace(/^\s*[-•*]\s+/, ""))}</li>`);
      continue;
    }
    closeList();
    if (!line.trim()) continue;
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`);
    } else if (/^([-*_])\1{2,}$/.test(line.trim())) {
      out.push("<hr/>");
    } else {
      out.push(`<p>${inline(line)}</p>`);
    }
  }
  closeList();
  return out.join("\n");
}

// Wrap rendered resume HTML in a clean, print-friendly document.
export function resumeHtmlDocument(md: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"/>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a2e; font-size: 11pt;
         line-height: 1.45; margin: 0; padding: 40px 48px; }
  h1 { font-size: 22pt; margin: 0 0 2px; letter-spacing: -0.3px; }
  h2 { font-size: 12.5pt; margin: 18px 0 6px; padding-bottom: 3px; border-bottom: 1.5px solid #3366ff;
       color: #1a37e1; text-transform: uppercase; letter-spacing: 0.5px; }
  h3 { font-size: 11.5pt; margin: 10px 0 2px; }
  p { margin: 3px 0; }
  ul { margin: 4px 0 8px; padding-left: 18px; }
  li { margin: 2px 0; }
  a { color: #1a37e1; text-decoration: none; }
  strong { color: #0b1020; }
  hr { border: none; border-top: 1px solid #ddd; margin: 10px 0; }
  code { background: #f1f3f9; padding: 1px 4px; border-radius: 3px; font-size: 0.9em; }
</style></head><body>${markdownToHtml(md)}</body></html>`;
}
