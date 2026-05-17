const ALLOWED_TAGS = new Set([
  'a',
  'b',
  'blockquote',
  'br',
  'code',
  'div',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'hr',
  'i',
  'li',
  'ol',
  'p',
  'pre',
  's',
  'span',
  'strong',
  'table',
  'tbody',
  'td',
  'th',
  'thead',
  'tr',
  'u',
  'ul',
])

const ALLOWED_ATTRIBUTES = new Set(['href', 'target', 'rel', 'colspan', 'rowspan', 'style'])

function isSafeHref(value: string) {
  const trimmed = value.trim().toLowerCase()
  return trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('mailto:')
}

function isSafeColorValue(value: string) {
  const trimmed = value.trim()
  return (
    /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(trimmed) ||
    /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(\s*,\s*(0|1|0?\.\d+))?\s*\)$/.test(trimmed)
  )
}

function sanitizeStyleAttribute(value: string) {
  const declarations = value
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean)
  const safeDeclarations: string[] = []

  for (const declaration of declarations) {
    const separatorIndex = declaration.indexOf(':')
    if (separatorIndex <= 0) continue

    const property = declaration.slice(0, separatorIndex).trim().toLowerCase()
    const propertyValue = declaration.slice(separatorIndex + 1).trim()

    if ((property === 'color' || property === 'background-color') && isSafeColorValue(propertyValue)) {
      safeDeclarations.push(`${property}: ${propertyValue}`)
    }
  }

  return safeDeclarations.join('; ')
}

function sanitizeNode(node: Node) {
  if (node.nodeType === Node.COMMENT_NODE) {
    node.parentNode?.removeChild(node)
    return
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return
  }

  const element = node as HTMLElement
  const tagName = element.tagName.toLowerCase()

  if (!ALLOWED_TAGS.has(tagName)) {
    const parent = element.parentNode

    while (element.firstChild) {
      parent?.insertBefore(element.firstChild, element)
    }

    parent?.removeChild(element)
    return
  }

  for (const attribute of Array.from(element.attributes)) {
    const attributeName = attribute.name.toLowerCase()

    if (!ALLOWED_ATTRIBUTES.has(attributeName)) {
      element.removeAttribute(attribute.name)
      continue
    }

    if (attributeName === 'style') {
      const safeStyle = sanitizeStyleAttribute(attribute.value)
      if (safeStyle) {
        element.setAttribute('style', safeStyle)
      } else {
        element.removeAttribute(attribute.name)
      }
      continue
    }

    if (attributeName === 'href' && !isSafeHref(attribute.value)) {
      element.removeAttribute(attribute.name)
    }
  }

  if (tagName === 'a' && element.getAttribute('href')) {
    element.setAttribute('target', '_blank')
    element.setAttribute('rel', 'noopener noreferrer')
  }
}

export function sanitizeRichTextHtml(value: unknown) {
  if (typeof document === 'undefined') {
    return typeof value === 'string' ? value : ''
  }

  const rawHtml = typeof value === 'string' ? value : ''
  const template = document.createElement('template')
  template.innerHTML = rawHtml

  const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT)
  const nodes: Node[] = []

  while (walker.nextNode()) {
    nodes.push(walker.currentNode)
  }

  for (const node of nodes) {
    sanitizeNode(node)
  }

  return template.innerHTML
}

export function getRichTextPlainText(value: unknown) {
  if (typeof document === 'undefined') {
    return typeof value === 'string' ? value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : ''
  }

  const template = document.createElement('template')
  template.innerHTML = sanitizeRichTextHtml(value)
  return (template.content.textContent || '').replace(/\s+/g, ' ').trim()
}
