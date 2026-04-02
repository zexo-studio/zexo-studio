// ── Lightweight Markdown Renderer ────────────────────────────
// Converts markdown text to HTML. No dependencies.
// Handles: headers, bold, italic, code blocks, inline code,
// lists, blockquotes, links, horizontal rules, paragraphs.

export function renderMarkdown(text) {
  if (!text) return '';

  // Normalize line endings
  let md = text.replace(/\r\n/g, '\n');

  // Process code blocks first (protect them from other transforms)
  const codeBlocks = [];
  md = md.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const idx = codeBlocks.length;
    const escaped = escapeHtml(code.trimEnd());
    const header = lang
      ? `<div class="code-header"><span class="code-lang">${lang}</span><button class="copy-btn" onclick="copyCode(this)">Copy</button></div>`
      : `<div class="code-header"><span class="code-lang">code</span><button class="copy-btn" onclick="copyCode(this)">Copy</button></div>`;
    codeBlocks.push(`<pre>${header}<code>${escaped}</code></pre>`);
    return `\x00CODEBLOCK${idx}\x00`;
  });

  // Inline code (protect from other transforms)
  const inlineCodes = [];
  md = md.replace(/`([^`\n]+)`/g, (_, code) => {
    const idx = inlineCodes.length;
    inlineCodes.push(`<code>${escapeHtml(code)}</code>`);
    return `\x00INLINE${idx}\x00`;
  });

  // Split into lines for block-level processing
  const lines = md.split('\n');
  let html = '';
  let inList = false;
  let listType = '';
  let inBlockquote = false;
  let blockquoteContent = '';
  let paragraph = '';

  function flushParagraph() {
    if (paragraph.trim()) {
      html += `<p>${processInline(paragraph.trim())}</p>\n`;
      paragraph = '';
    }
  }

  function flushList() {
    if (inList) {
      html += `</${listType}>\n`;
      inList = false;
    }
  }

  function flushBlockquote() {
    if (inBlockquote) {
      html += `<blockquote>${processInline(blockquoteContent.trim())}</blockquote>\n`;
      inBlockquote = false;
      blockquoteContent = '';
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code block placeholder
    const cbMatch = line.match(/^\x00CODEBLOCK(\d+)\x00$/);
    if (cbMatch) {
      flushParagraph();
      flushList();
      flushBlockquote();
      html += codeBlocks[parseInt(cbMatch[1])] + '\n';
      continue;
    }

    // Headers
    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headerMatch) {
      flushParagraph();
      flushList();
      flushBlockquote();
      const level = headerMatch[1].length;
      html += `<h${level}>${processInline(headerMatch[2])}</h${level}>\n`;
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      flushParagraph();
      flushList();
      flushBlockquote();
      html += '<hr>\n';
      continue;
    }

    // Blockquote
    const bqMatch = line.match(/^>\s?(.*)$/);
    if (bqMatch) {
      flushParagraph();
      flushList();
      inBlockquote = true;
      blockquoteContent += bqMatch[1] + '\n';
      continue;
    } else if (inBlockquote) {
      flushBlockquote();
    }

    // Unordered list
    const ulMatch = line.match(/^[\s]*[-*+]\s+(.+)$/);
    if (ulMatch) {
      flushParagraph();
      if (!inList || listType !== 'ul') {
        flushList();
        html += '<ul>\n';
        inList = true;
        listType = 'ul';
      }
      html += `<li>${processInline(ulMatch[1])}</li>\n`;
      continue;
    }

    // Ordered list
    const olMatch = line.match(/^[\s]*(\d+)\.\s+(.+)$/);
    if (olMatch) {
      flushParagraph();
      if (!inList || listType !== 'ol') {
        flushList();
        html += '<ol>\n';
        inList = true;
        listType = 'ol';
      }
      html += `<li>${processInline(olMatch[2])}</li>\n`;
      continue;
    }

    // End list if not a list item
    if (inList && line.trim() === '') {
      flushList();
    }

    // Empty line = paragraph break
    if (line.trim() === '') {
      flushParagraph();
      continue;
    }

    // Regular text — accumulate into paragraph
    paragraph += (paragraph ? ' ' : '') + line;
  }

  // Flush remaining
  flushParagraph();
  flushList();
  flushBlockquote();

  // Restore inline code placeholders
  html = html.replace(/\x00INLINE(\d+)\x00/g, (_, idx) => inlineCodes[parseInt(idx)]);
  // Restore code block placeholders (shouldn't be any left, but just in case)
  html = html.replace(/\x00CODEBLOCK(\d+)\x00/g, (_, idx) => codeBlocks[parseInt(idx)]);

  return html;
}

// Process inline markdown elements
function processInline(text) {
  let result = text;

  // Bold + italic
  result = result.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  // Bold
  result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  result = result.replace(/__(.+?)__/g, '<strong>$1</strong>');
  // Italic
  result = result.replace(/\*(.+?)\*/g, '<em>$1</em>');
  result = result.replace(/_(.+?)_/g, '<em>$1</em>');
  // Strikethrough
  result = result.replace(/~~(.+?)~~/g, '<del>$1</del>');
  // Links
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

  return result;
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Global copy function for code blocks
window.copyCode = function(btn) {
  const pre = btn.closest('pre');
  const code = pre.querySelector('code');
  const text = code.textContent;

  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.textContent;
    btn.textContent = 'Copied!';
    btn.style.color = 'var(--success)';
    setTimeout(() => {
      btn.textContent = orig;
      btn.style.color = '';
    }, 1500);
  });
};
