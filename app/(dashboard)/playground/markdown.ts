// TEMPORARY PAGE — a deliberately tiny Markdown-to-HTML renderer, just enough
// for docs/open_items.md (headings, bullets, bold, inline code, links,
// strikethrough). Hand-rolled so the playground stays dependency-free and
// deletable in one commit. Input is our own repo file — trusted.

function escapeHtml(s: string): string {
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function inline(s: string): string {
  return escapeHtml(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/~~([^~]+)~~/g, "<del>$1</del>")
    .replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" class="underline underline-offset-2">$1</a>',
    );
}

export function renderMarkdown(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let inList = false;
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      out.push(`<p>${inline(paragraph.join(" "))}</p>`);
      paragraph = [];
    }
  };
  const closeList = () => {
    if (inList) {
      out.push("</ul>");
      inList = false;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    const bullet = /^-\s+(.*)$/.exec(line);
    const continuation = /^\s{2,}(\S.*)$/.exec(raw);

    if (heading) {
      flushParagraph();
      closeList();
      const level = heading[1].length;
      out.push(`<h${level + 2}>${inline(heading[2])}</h${level + 2}>`); // h1→h3 etc., page owns h1/h2
    } else if (bullet) {
      flushParagraph();
      if (!inList) {
        out.push("<ul>");
        inList = true;
      }
      out.push(`<li>${inline(bullet[1])}</li>`);
    } else if (inList && continuation) {
      // Wrapped bullet text: append to the previous <li>.
      const last = out.pop()!;
      out.push(last.replace(/<\/li>$/, ` ${inline(continuation[1])}</li>`));
    } else if (line === "" || line === "---") {
      flushParagraph();
      closeList();
    } else {
      closeList();
      paragraph.push(line.trim());
    }
  }
  flushParagraph();
  closeList();
  return out.join("\n");
}
