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
  'img',
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

const ALLOWED_ATTRIBUTES = new Set([
  'alt',
  'colspan',
  'data-modmin-content-type',
  'data-modmin-file-id',
  'data-modmin-full-path',
  'data-modmin-name',
  'data-modmin-path',
  'data-modmin-size',
  'height',
  'href',
  'loading',
  'rel',
  'rowspan',
  'src',
  'style',
  'target',
  'title',
  'width',
])

function isSafeHref(value: string) {
  const trimmed = value.trim().toLowerCase()
  return trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('mailto:')
}

function isSafeImageSrc(value: string) {
  const trimmed = value.trim().toLowerCase()
  return (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('cloud://')
  )
}

function isSafeColorValue(value: string) {
  const trimmed = value.trim()
  return (
    /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(trimmed) ||
    /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(\s*,\s*(0|1|0?\.\d+))?\s*\)$/.test(trimmed)
  )
}

function isSafeCssSizeValue(value: string) {
  const trimmed = value.trim().toLowerCase()
  return trimmed === 'auto' || /^\d{1,4}(\.\d{1,2})?(%|px)?$/.test(trimmed)
}

function sanitizeStyleAttribute(value: string, tagName: string) {
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
      continue
    }

    if (
      tagName === 'img' &&
      (property === 'width' || property === 'height' || property === 'max-width') &&
      isSafeCssSizeValue(propertyValue)
    ) {
      safeDeclarations.push(`${property}: ${propertyValue}`)
    }
  }

  return safeDeclarations.join('; ')
}

function isSafeDimension(value: string) {
  return /^\d{1,4}(%|px)?$/.test(value.trim())
}

function isSafeDataAttribute(attributeName: string, value: string) {
  if (attributeName === 'data-modmin-size') {
    return value === '' || /^\d+$/.test(value)
  }

  if (attributeName === 'data-modmin-content-type') {
    return value === '' || value.startsWith('image/')
  }

  if (attributeName === 'data-modmin-file-id' || attributeName === 'data-modmin-full-path') {
    return value === '' || isSafeImageSrc(value)
  }

  return !/[<>"'`]/.test(value)
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

    if ((attributeName === 'href' || attributeName === 'target' || attributeName === 'rel') && tagName !== 'a') {
      element.removeAttribute(attribute.name)
      continue
    }

    if (
      (attributeName === 'src' ||
        attributeName === 'alt' ||
        attributeName === 'title' ||
        attributeName === 'width' ||
        attributeName === 'height' ||
        attributeName === 'loading' ||
        attributeName.startsWith('data-modmin-')) &&
      tagName !== 'img'
    ) {
      element.removeAttribute(attribute.name)
      continue
    }

    if (attributeName === 'style') {
      const safeStyle = sanitizeStyleAttribute(attribute.value, tagName)
      if (safeStyle) {
        element.setAttribute('style', safeStyle)
      } else {
        element.removeAttribute(attribute.name)
      }
      continue
    }

    if (attributeName === 'href' && !isSafeHref(attribute.value)) {
      element.removeAttribute(attribute.name)
      continue
    }

    if (attributeName === 'src' && !isSafeImageSrc(attribute.value)) {
      element.removeAttribute(attribute.name)
      continue
    }

    if ((attributeName === 'width' || attributeName === 'height') && !isSafeDimension(attribute.value)) {
      element.removeAttribute(attribute.name)
      continue
    }

    if (attributeName === 'loading' && !['lazy', 'eager'].includes(attribute.value)) {
      element.removeAttribute(attribute.name)
      continue
    }

    if (attributeName.startsWith('data-modmin-') && !isSafeDataAttribute(attributeName, attribute.value)) {
      element.removeAttribute(attribute.name)
    }
  }

  if (tagName === 'a' && element.getAttribute('href')) {
    element.setAttribute('target', '_blank')
    element.setAttribute('rel', 'noopener noreferrer')
  }

  if (tagName === 'img') {
    element.setAttribute('loading', element.getAttribute('loading') || 'lazy')
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

export function serializeRichTextHtmlForStorage(value: unknown) {
  if (typeof document === 'undefined') {
    return typeof value === 'string' ? value : ''
  }

  const template = document.createElement('template')
  template.innerHTML = sanitizeRichTextHtml(value)

  for (const image of Array.from(template.content.querySelectorAll('img'))) {
    const stableSrc =
      image.getAttribute('data-modmin-file-id') ||
      image.getAttribute('data-modmin-full-path') ||
      image.getAttribute('src') ||
      ''

    if (stableSrc && isSafeImageSrc(stableSrc)) {
      image.setAttribute('src', stableSrc)
    }
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

export function hasRichTextContent(value: unknown) {
  if (getRichTextPlainText(value)) {
    return true
  }

  if (typeof document === 'undefined') {
    return typeof value === 'string' && /<img\b/i.test(value)
  }

  const template = document.createElement('template')
  template.innerHTML = sanitizeRichTextHtml(value)
  return Boolean(
    template.content.querySelector(
      'img[src], img[data-modmin-file-id], img[data-modmin-full-path], img[data-modmin-path]',
    ),
  )
}
