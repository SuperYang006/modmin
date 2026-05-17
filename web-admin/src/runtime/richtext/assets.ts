import { useEffect, useMemo, useState } from 'react'
import { parseUploadedAssetValue, resolveAssetUrl, type UploadedAssetValue } from '@/services/asset'
import { sanitizeRichTextHtml } from '@/runtime/richtext/html'

function escapeHtmlAttribute(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function getFallbackAssetSource(asset: UploadedAssetValue) {
  return asset.fileID || asset.fullPath || asset.path
}

export function buildRichTextImageHtml(asset: UploadedAssetValue, displayUrl: string) {
  const src = displayUrl || getFallbackAssetSource(asset)
  const alt = asset.name || '图片'

  return [
    `<img src="${escapeHtmlAttribute(src)}"`,
    ` alt="${escapeHtmlAttribute(alt)}"`,
    ` title="${escapeHtmlAttribute(alt)}"`,
    ' style="width: 100%"',
    ' />',
  ].join('')
}

function parseRichTextImageAsset(image: HTMLImageElement) {
  const raw = {
    fileID: image.getAttribute('data-modmin-file-id') || '',
    path: image.getAttribute('data-modmin-path') || '',
    fullPath: image.getAttribute('data-modmin-full-path') || image.getAttribute('src') || '',
    name: image.getAttribute('data-modmin-name') || image.getAttribute('alt') || '图片',
    contentType: image.getAttribute('data-modmin-content-type') || 'image/*',
    size: Number(image.getAttribute('data-modmin-size') || ''),
  }

  return parseUploadedAssetValue({
    ...raw,
    size: Number.isFinite(raw.size) && raw.size >= 0 ? raw.size : undefined,
  })
}

function getRichTextImageAssetKey(asset: UploadedAssetValue) {
  return getFallbackAssetSource(asset)
}

export function useResolvedRichTextHtml(value: unknown) {
  const sanitizedHtml = useMemo(() => sanitizeRichTextHtml(value), [value])
  const [resolvedHtml, setResolvedHtml] = useState(sanitizedHtml)

  useEffect(() => {
    let active = true
    setResolvedHtml(sanitizedHtml)

    if (typeof document === 'undefined') {
      return () => {
        active = false
      }
    }

    const template = document.createElement('template')
    template.innerHTML = sanitizedHtml
    const imageEntries = Array.from(template.content.querySelectorAll('img'))
      .map((image) => ({ image, asset: parseRichTextImageAsset(image) }))
      .filter((entry): entry is { image: HTMLImageElement; asset: UploadedAssetValue } => Boolean(entry.asset))

    if (!imageEntries.length) {
      return () => {
        active = false
      }
    }

    void Promise.all(
      imageEntries.map(async ({ asset }) => {
        const key = getRichTextImageAssetKey(asset)
        if (!key) return null

        try {
          const url = await resolveAssetUrl(asset)
          return [key, url] as const
        } catch {
          return [key, ''] as const
        }
      }),
    ).then((items) => {
      if (!active) return

      const urlMap = new Map(items.filter((item): item is readonly [string, string] => Boolean(item)))
      imageEntries.forEach(({ image, asset }) => {
        const key = getRichTextImageAssetKey(asset)
        const nextUrl = key ? urlMap.get(key) : ''
        if (nextUrl) {
          image.setAttribute('src', nextUrl)
          image.setAttribute('data-modmin-file-id', asset.fileID)
          image.setAttribute('data-modmin-path', asset.path)
          image.setAttribute('data-modmin-full-path', asset.fullPath)
          image.setAttribute('data-modmin-name', asset.name)
          image.setAttribute('data-modmin-content-type', asset.contentType || 'image/*')
          if (asset.size !== undefined) {
            image.setAttribute('data-modmin-size', String(asset.size))
          }
        }
      })
      setResolvedHtml(template.innerHTML)
    })

    return () => {
      active = false
    }
  }, [sanitizedHtml])

  return resolvedHtml
}
