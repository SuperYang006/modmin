import { uploadAsset, resolveAssetUrl } from '@/services/asset'

const MAX_IMAGE_SIZE = 5 * 1024 * 1024

export async function uploadMarkdownImage(
  file: File,
  collectionName: string,
  fieldKey: string,
): Promise<string> {
  if (file.size > MAX_IMAGE_SIZE) {
    throw new Error('图片大小不能超过 5MB')
  }

  const uploaded = await uploadAsset(file, collectionName, fieldKey)
  const url = await resolveAssetUrl(uploaded)
  const alt = uploaded.name || '图片'
  return `![${alt}](${url})`
}
