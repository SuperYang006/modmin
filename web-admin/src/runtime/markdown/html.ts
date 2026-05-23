import DOMPurify from 'dompurify'
import Vditor from 'vditor'

function getSanitizer(): typeof DOMPurify {
  return DOMPurify
}

export async function renderMarkdownToHtml(mdText: string): Promise<string> {
  if (!mdText) return ''

  const rawHtml = await Vditor.md2html(mdText, { mode: 'light' as const })
  const sanitizer = getSanitizer()
  return sanitizer.sanitize(rawHtml, {
    ALLOWED_TAGS: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p', 'br', 'hr',
      'ul', 'ol', 'li',
      'blockquote', 'pre', 'code',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'div', 'span',
      'strong', 'em', 'b', 'i', 'u', 's', 'del', 'ins', 'sub', 'sup',
      'a', 'img',
      'figure', 'figcaption',
      'input',
    ],
    ALLOWED_ATTR: [
      'href', 'target', 'rel',
      'src', 'alt', 'title', 'width', 'height',
      'class',
      'type', 'checked', 'disabled',
    ],
    ALLOW_DATA_ATTR: false,
  })
}
