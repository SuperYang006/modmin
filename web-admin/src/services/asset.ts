import { useEffect, useState } from 'react'
import { getTcbApp } from '@/services/tcb'

type ApiMode = 'mock' | 'http' | 'tcb'

const apiMode: ApiMode = (import.meta.env.VITE_API_MODE as ApiMode | undefined) ?? 'mock'
const SIGNED_URL_EXPIRES_IN_SECONDS = 600
const SIGNED_URL_REFRESH_BUFFER_MS = 60 * 1000

export interface UploadedAssetValue {
  fileID: string
  path: string
  fullPath: string
  name: string
  contentType: string
  size?: number
}

export function isImageAsset(asset: UploadedAssetValue | null) {
  return Boolean(asset?.contentType && asset.contentType.startsWith('image/'))
}

interface AssetUrlCacheItem {
  url: string
  expiresAt: number
}

interface SignedUrlResultItem {
  fileID: string
  signedUrl: string
  error: string | null
}

const assetUrlCache = new Map<string, AssetUrlCacheItem>()
const inflightAssetUrlRequests = new Map<string, Promise<string>>()

function getAssetCacheKey(asset: UploadedAssetValue) {
  return asset.fileID || asset.fullPath || asset.path
}

function inferNameFromPath(path: string) {
  return path.split('/').pop() || 'file'
}

function inferPathFromFileID(fileID: string) {
  const match = fileID.match(/^cloud:\/\/[^/]+\/(.+)$/)
  return match?.[1] || ''
}

function inferFullPath(fileID: string, path: string) {
  return fileID || path
}

function inferPathFromUrl(url: string) {
  try {
    const pathname = new URL(url).pathname
    return pathname.startsWith('/') ? pathname.slice(1) : pathname
  } catch {
    return ''
  }
}

function isUsableCache(item?: AssetUrlCacheItem) {
  return Boolean(item && item.expiresAt > Date.now() + SIGNED_URL_REFRESH_BUFFER_MS)
}

export function parseUploadedAssetValue(value: unknown): UploadedAssetValue | null {
  if (!value) {
    return null
  }

  let asset: Record<string, unknown> | null = null

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as Record<string, unknown>
      if (parsed && typeof parsed === 'object') {
        asset = parsed
      }
    } catch {
      if (value.startsWith('cloud://')) {
        const path = inferPathFromFileID(value)
        return {
          fileID: value,
          path,
          fullPath: inferFullPath(value, path),
          name: inferNameFromPath(path || value),
          contentType: '',
        }
      }

      if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('blob:')) {
        return {
          fileID: '',
          path: '',
          fullPath: value,
          name: inferNameFromPath(value),
          contentType: '',
        }
      }
    }
  }

  if (!asset && typeof value === 'object') {
    asset = value as Record<string, unknown>
  }

  if (!asset) {
    return null
  }

  const fileID = typeof asset.fileID === 'string' ? asset.fileID : ''
  const legacyUrl = typeof asset.url === 'string' ? asset.url : ''
  const path =
    typeof asset.path === 'string'
      ? asset.path
      : fileID
        ? inferPathFromFileID(fileID)
        : legacyUrl
          ? inferPathFromUrl(legacyUrl)
        : ''
  const fullPath =
    typeof asset.fullPath === 'string'
      ? asset.fullPath
      : fileID || legacyUrl || path
  const name =
    typeof asset.name === 'string' && asset.name
      ? asset.name
      : inferNameFromPath(path || fullPath || fileID)
  const contentType = typeof asset.contentType === 'string' ? asset.contentType : ''
  const size = typeof asset.size === 'number' && asset.size >= 0 ? asset.size : undefined

  if (!fileID && !path && !fullPath && !legacyUrl) {
    return null
  }

  return {
    fileID,
    path,
    fullPath,
    name,
    contentType,
    size,
  }
}

export function parseUploadedAssetValues(value: unknown): UploadedAssetValue[] {
  if (!value) {
    return []
  }

  if (Array.isArray(value)) {
    return value.map((item) => parseUploadedAssetValue(item)).filter((item): item is UploadedAssetValue => Boolean(item))
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => parseUploadedAssetValue(item))
          .filter((item): item is UploadedAssetValue => Boolean(item))
      }
    } catch {
      const single = parseUploadedAssetValue(value)
      return single ? [single] : []
    }
  }

  const single = parseUploadedAssetValue(value)
  return single ? [single] : []
}

export async function uploadAsset(file: File, collectionName: string, fieldKey: string): Promise<UploadedAssetValue> {
  if (apiMode === 'mock') {
    const objectUrl = URL.createObjectURL(file)

    return {
      fileID: '',
      path: `mock/${collectionName}/${fieldKey}/${Date.now()}_${file.name}`,
      fullPath: objectUrl,
      name: file.name,
      contentType: file.type || '',
      size: file.size,
    }
  }

  if (apiMode === 'http') {
    const localServerUrl = import.meta.env.VITE_LOCAL_SERVER_URL ?? 'http://localhost:3100'
    const extension = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')) : ''
    const cloudPath = `modmin/${collectionName}/${fieldKey}/${Date.now()}_${Math.random().toString(36).slice(2)}${extension}`

    const formData = new FormData()
    formData.append('file', file)
    formData.append('cloudPath', cloudPath)

    const response = await fetch(`${localServerUrl}/modmin_upload`, {
      method: 'POST',
      body: formData,
    })

    const result = await response.json() as { code: number; message: string; data: UploadedAssetValue | null }

    if (result.code !== 0 || !result.data) {
      throw new Error(result.message || '上传失败')
    }

    return result.data
  }

  const app = await getTcbApp()
  const extension = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')) : ''
  const path = `modmin/${collectionName}/${fieldKey}/${Date.now()}_${Math.random().toString(36).slice(2)}${extension}`
  if (typeof app.uploadFile !== 'function') {
    throw new Error('当前 CloudBase JS SDK 不支持 uploadFile')
  }

  const result = await app.uploadFile({
    cloudPath: path,
    filePath: file,
  })

  const fileID = result?.fileID || result

  if (!fileID || typeof fileID !== 'string') {
    throw new Error('上传失败')
  }

  return {
    fileID,
    path,
    fullPath: fileID,
    name: file.name,
    contentType: file.type || '',
    size: file.size,
  }
}

async function createSignedUrl(asset: UploadedAssetValue) {
  const cacheKey = getAssetCacheKey(asset)

  if (!cacheKey) {
    return asset.fullPath || ''
  }

  if (asset.fullPath.startsWith('http://') || asset.fullPath.startsWith('https://') || asset.fullPath.startsWith('blob:')) {
    assetUrlCache.set(cacheKey, {
      url: asset.fullPath,
      expiresAt: Number.MAX_SAFE_INTEGER,
    })
    return asset.fullPath
  }

  const fileID = asset.fileID || asset.fullPath

  if (!fileID || !fileID.startsWith('cloud://')) {
    throw new Error('文件 fileID 缺失，无法生成访问地址')
  }

  if (apiMode === 'http') {
    const localServerUrl = import.meta.env.VITE_LOCAL_SERVER_URL ?? 'http://localhost:3100'
    const response = await fetch(`${localServerUrl}/modmin_get_temp_url`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fileList: [{ fileID, maxAge: SIGNED_URL_EXPIRES_IN_SECONDS }] }),
    })
    const result = await response.json() as { code: number; message: string; data: { fileList: Array<{ fileID: string; tempFileURL?: string; download_url?: string }> } | null }
    if (result.code !== 0 || !result.data) {
      throw new Error(result.message || '获取临时链接失败')
    }
    const signedUrl = result.data.fileList?.[0]?.tempFileURL || result.data.fileList?.[0]?.download_url
    if (!signedUrl) throw new Error('获取临时链接失败')
    const expiresAt = Date.now() + SIGNED_URL_EXPIRES_IN_SECONDS * 1000
    assetUrlCache.set(cacheKey, { url: signedUrl, expiresAt })
    return signedUrl
  }

  const app = await getTcbApp()

  if (typeof app.getTempFileURL !== 'function') {
    throw new Error('当前 CloudBase JS SDK 不支持 getTempFileURL')
  }

  const result = await app.getTempFileURL({
    fileList: [
      {
        fileID,
        maxAge: SIGNED_URL_EXPIRES_IN_SECONDS,
      },
    ],
  })

  const signedUrl = result?.fileList?.[0]?.tempFileURL || result?.fileList?.[0]?.download_url

  if (!signedUrl) {
    throw new Error('生成文件访问地址失败')
  }

  const expiresAt = Date.now() + SIGNED_URL_EXPIRES_IN_SECONDS * 1000
  assetUrlCache.set(cacheKey, {
    url: signedUrl,
    expiresAt,
  })

  return signedUrl
}

export async function resolveAssetUrl(asset: UploadedAssetValue | null) {
  if (!asset) {
    return ''
  }

  const cacheKey = getAssetCacheKey(asset)

  if (!cacheKey) {
    return ''
  }

  const cached = assetUrlCache.get(cacheKey)
  if (isUsableCache(cached)) {
    return cached?.url || ''
  }

  const inflight = inflightAssetUrlRequests.get(cacheKey)
  if (inflight) {
    return inflight
  }

  const request = createSignedUrl(asset).finally(() => {
    inflightAssetUrlRequests.delete(cacheKey)
  })

  inflightAssetUrlRequests.set(cacheKey, request)
  return request
}

export async function preloadAssetUrls(values: unknown[]) {
  const assets = values
    .map((value) => parseUploadedAssetValue(value))
    .filter((asset): asset is UploadedAssetValue => Boolean(asset))

  if (!assets.length) {
    return
  }

  const directAssets = assets.filter(
    (asset) =>
      asset.fullPath.startsWith('http://') ||
      asset.fullPath.startsWith('https://') ||
      asset.fullPath.startsWith('blob:'),
  )
  directAssets.forEach((asset) => {
    const cacheKey = getAssetCacheKey(asset)
    if (cacheKey) {
      assetUrlCache.set(cacheKey, {
        url: asset.fullPath,
        expiresAt: Number.MAX_SAFE_INTEGER,
      })
    }
  })

  if (apiMode === 'mock') {
    return
  }

  const pendingAssets = assets.filter((asset) => {
    const cacheKey = getAssetCacheKey(asset)
    const cached = cacheKey ? assetUrlCache.get(cacheKey) : undefined
    return asset.fileID && cacheKey && !isUsableCache(cached) && !inflightAssetUrlRequests.has(cacheKey)
  })

  if (!pendingAssets.length) {
    return
  }

  const uniqueAssets = Array.from(new Map(pendingAssets.map((asset) => [asset.fileID, asset])).values())
  const expiresAt = Date.now() + SIGNED_URL_EXPIRES_IN_SECONDS * 1000

  let rawFileList: Array<{ fileID?: string; tempFileURL?: string; download_url?: string; code?: string; message?: string }> = []

  if (apiMode === 'http') {
    const localServerUrl = import.meta.env.VITE_LOCAL_SERVER_URL ?? 'http://localhost:3100'
    const response = await fetch(`${localServerUrl}/modmin_get_temp_url`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        fileList: uniqueAssets.map((asset) => ({ fileID: asset.fileID, maxAge: SIGNED_URL_EXPIRES_IN_SECONDS })),
      }),
    })
    const result = await response.json() as { code: number; data: { fileList: typeof rawFileList } | null }
    rawFileList = result?.data?.fileList || []
  } else {
    const app = await getTcbApp()
    if (typeof app.getTempFileURL !== 'function') {
      throw new Error('当前 CloudBase JS SDK 不支持 getTempFileURL')
    }
    const result = await app.getTempFileURL({
      fileList: uniqueAssets.map((asset) => ({ fileID: asset.fileID, maxAge: SIGNED_URL_EXPIRES_IN_SECONDS })),
    })
    rawFileList = result?.fileList || []
  }

  const signedUrlItems: SignedUrlResultItem[] = rawFileList.map(
    (item: { fileID?: string; tempFileURL?: string; download_url?: string; code?: string; message?: string }) => ({
      fileID: item.fileID || '',
      signedUrl: item.tempFileURL || item.download_url || '',
      error: item.code === 'SUCCESS' || !item.code ? null : item.message || '生成文件访问地址失败',
    }),
  )
  const urlMap = new Map<string, SignedUrlResultItem>(signedUrlItems.map((item) => [item.fileID, item]))

  uniqueAssets.forEach((asset) => {
    const cacheKey = getAssetCacheKey(asset)
    const signed = urlMap.get(asset.fileID)
    if (!cacheKey || !signed?.signedUrl || signed.error) {
      return
    }

    assetUrlCache.set(cacheKey, {
      url: signed.signedUrl,
      expiresAt,
    })
  })
}

export function useResolvedAssetUrl(value: unknown) {
  const asset = parseUploadedAssetValue(value)
  const [url, setUrl] = useState(() => {
    if (!asset) {
      return ''
    }

    const cacheKey = getAssetCacheKey(asset)
    if (!cacheKey) {
      return ''
    }

    return assetUrlCache.get(cacheKey)?.url || ''
  })
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    if (!asset) {
      setUrl('')
      setError('')
      return () => {
        active = false
      }
    }

    void resolveAssetUrl(asset)
      .then((nextUrl) => {
        if (active) {
          setUrl(nextUrl)
          setError('')
        }
      })
      .catch((nextError) => {
        if (active) {
          setUrl('')
          setError(nextError instanceof Error ? nextError.message : '文件地址解析失败')
        }
      })

    return () => {
      active = false
    }
  }, [asset?.fileID, asset?.path, asset?.fullPath])

  return {
    asset,
    url,
    error,
  }
}

export function useResolvedAssetUrlMap(assets: UploadedAssetValue[]) {
  const [urlMap, setUrlMap] = useState<Record<string, string>>({})

  const assetKeys = assets
    .map((asset) => getAssetCacheKey(asset))
    .filter(Boolean)
    .join('|')

  useEffect(() => {
    let active = true

    if (!assets.length) {
      setUrlMap({})
      return () => {
        active = false
      }
    }

    void Promise.all(
      assets.map(async (asset) => {
        const key = getAssetCacheKey(asset)
        if (!key) {
          return null
        }

        try {
          const nextUrl = await resolveAssetUrl(asset)
          return [key, nextUrl] as const
        } catch {
          return [key, ''] as const
        }
      }),
    ).then((items) => {
      if (!active) {
        return
      }

      setUrlMap(
        items.reduce<Record<string, string>>((acc, item) => {
          if (item) {
            acc[item[0]] = item[1]
          }
          return acc
        }, {}),
      )
    })

    return () => {
      active = false
    }
  }, [assetKeys])

  return urlMap
}
