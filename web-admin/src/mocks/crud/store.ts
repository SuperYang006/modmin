export type CrudRecord = Record<string, unknown> & { _id: string }

const articleSeed: CrudRecord[] = [
  {
    _id: 'article_001',
    title: '微信云开发后台模板设计说明',
    status: 'draft',
    createTime: '2026-05-02 18:00',
    summary: '这是第一版后台模板设计说明。',
    featured: 'true',
    coverImage: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=480&q=80',
    attachment: 'design-v1.pdf',
    metadata: { source: 'mock', level: 1 },
  },
  {
    _id: 'article_002',
    title: '内容审核流程第一版',
    status: 'published',
    createTime: '2026-05-02 18:15',
    summary: '定义基础审批流和状态回写。',
    featured: 'false',
    coverImage: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=480&q=80',
    attachment: 'workflow-v1.pdf',
    metadata: { source: 'mock', level: 2 },
  },
  {
    _id: 'article_003',
    title: '仪表盘组件协议定义',
    status: 'draft',
    createTime: '2026-05-02 18:30',
    summary: '仪表盘组件和数据源协议初稿。',
    featured: 'true',
    coverImage: 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&w=480&q=80',
    attachment: 'dashboard-spec.pdf',
    metadata: { source: 'mock', level: 3 },
  },
]

const articleTagSeed: CrudRecord[] = [
  { _id: 'tag_001', name: '前端', code: 'frontend', sortOrder: 10, enabled: true, remark: '前端相关' },
  { _id: 'tag_002', name: '后端', code: 'backend', sortOrder: 20, enabled: true, remark: '后端相关' },
  { _id: 'tag_003', name: '设计', code: 'design', sortOrder: 30, enabled: false, remark: '已下线' },
]

const stores = new Map<string, CrudRecord[]>([
  ['article', articleSeed],
  ['article_tag', articleTagSeed],
])

const sequences = new Map<string, number>()

function getStore(collectionName: string): CrudRecord[] {
  let store = stores.get(collectionName)
  if (!store) {
    store = []
    stores.set(collectionName, store)
  }
  return store
}

function nextId(collectionName: string): string {
  const current = sequences.get(collectionName) ?? getStore(collectionName).length
  const next = current + 1
  sequences.set(collectionName, next)
  return `${collectionName}_mock_${String(next).padStart(3, '0')}`
}

export function listRecords(collectionName: string): CrudRecord[] {
  return getStore(collectionName)
}

export function findRecord(collectionName: string, id: string): CrudRecord | null {
  return getStore(collectionName).find((item) => item._id === id) ?? null
}

export function insertRecord(collectionName: string, record: Record<string, unknown>): CrudRecord {
  const store = getStore(collectionName)
  const newRecord: CrudRecord = {
    ...record,
    _id: nextId(collectionName),
    modmin_createTime: Date.now(),
  }
  store.unshift(newRecord)
  return newRecord
}

export function updateRecord(
  collectionName: string,
  id: string,
  record: Record<string, unknown>,
): CrudRecord | null {
  const store = getStore(collectionName)
  const index = store.findIndex((item) => item._id === id)
  if (index < 0) return null
  store[index] = { ...store[index], ...record, _id: store[index]._id }
  return store[index]
}

export function removeRecord(collectionName: string, id: string): boolean {
  const store = getStore(collectionName)
  const index = store.findIndex((item) => item._id === id)
  if (index < 0) return false
  store.splice(index, 1)
  return true
}
