import { useEffect, useMemo, useRef, useState } from 'react'
import type { RuntimeField } from '@/types/runtime'

/** 单列偏好配置 */
export interface ColumnPref {
  key: string
  visible: boolean
  order: number
}

/** hook 返回值 */
export interface UseColumnPreferencesResult {
  /** 当前可见且已排序的字段列表（直接传给 Table columns） */
  visibleFields: RuntimeField[]
  /** 完整列配置状态（用于 UI 渲染） */
  columnState: ColumnPref[]
  /** 切换某列的显隐 */
  toggleColumn: (key: string) => void
  /** 拖拽排序回调（from/to 为数组索引） */
  reorderColumns: (from: number, to: number) => void
  /** 重置为 schema 默认配置 */
  reset: () => void
}

const STORAGE_VERSION = 1
const STORAGE_PREFIX = 'modmin_col_pref_'

/** 从 schema 字段列表生成默认偏好 */
function buildDefaults(fields: RuntimeField[]): ColumnPref[] {
  return fields
    .filter((f) => f.listConfig?.visible !== false && !f.hidden)
    .map((f, idx) => ({
      key: f.fieldKey,
      visible: true,
      order: f.listConfig?.sortOrder ?? (idx + 1) * 10,
    }))
}

/** 从 localStorage 读取偏好 */
function loadPrefs(collectionName: string): ColumnPref[] | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${collectionName}`)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed?.version !== STORAGE_VERSION || !Array.isArray(parsed.columns)) return null
    return parsed.columns as ColumnPref[]
  } catch {
    return null
  }
}

/** 写入 localStorage */
function savePrefs(collectionName: string, columns: ColumnPref[]) {
  try {
    localStorage.setItem(
      `${STORAGE_PREFIX}${collectionName}`,
      JSON.stringify({ version: STORAGE_VERSION, columns }),
    )
  } catch {
    // ignore quota errors
  }
}

/** 清除 localStorage */
function clearPrefs(collectionName: string) {
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}${collectionName}`)
  } catch {
    // ignore
  }
}

/** 比较两个字段列表的 key 是否一致（用于避免不必要的重新初始化） */
function fieldKeysEqual(a: RuntimeField[], b: RuntimeField[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i].fieldKey !== b[i].fieldKey) return false
  }
  return true
}

/**
 * 管理业务数据列表的列偏好（显隐 + 排序 + 持久化）
 *
 * @param collectionName 集合名（作为存储隔离 key）
 * @param allFields schema 中的全部字段
 */
export function useColumnPreferences(
  collectionName: string,
  allFields: RuntimeField[],
): UseColumnPreferencesResult {
  // 用 ref 记录上一次的 fields，避免每次渲染都重新初始化
  const prevFieldsRef = useRef<RuntimeField[]>(allFields)
  const prevCollectionRef = useRef<string>(collectionName)

  // 初始状态：只在首次或 collectionName 变化时计算
  const [columnState, setColumnState] = useState<ColumnPref[]>(() => {
    const defaults = buildDefaults(allFields)
    if (!collectionName) return defaults
    const saved = loadPrefs(collectionName)
    if (!saved) return defaults
    return mergePrefs(saved, allFields, defaults)
  })

  // collectionName 或 fields 变化时重新加载（但避免引用不稳定导致的循环）
  useEffect(() => {
    const collectionChanged = prevCollectionRef.current !== collectionName
    const fieldsChanged = !fieldKeysEqual(prevFieldsRef.current, allFields)

    prevCollectionRef.current = collectionName
    prevFieldsRef.current = allFields

    if (!collectionChanged && !fieldsChanged) {
      return
    }

    const defaults = buildDefaults(allFields)
    if (!collectionName) {
      setColumnState(defaults)
      return
    }

    const saved = loadPrefs(collectionName)
    if (!saved) {
      setColumnState(defaults)
      return
    }

    setColumnState(mergePrefs(saved, allFields, defaults))
  }, [collectionName, allFields])

  // 状态变化时持久化（用 JSON 字符串比较避免引用问题）
  const prevStateJsonRef = useRef<string>('')
  useEffect(() => {
    if (!collectionName) return
    const json = JSON.stringify(columnState)
    if (json === prevStateJsonRef.current) return
    prevStateJsonRef.current = json
    savePrefs(collectionName, columnState)
  }, [collectionName, columnState])

  // 计算可见且已排序的字段列表
  const visibleFields = useMemo(() => {
    const visibleKeys = new Set(
      columnState.filter((c) => c.visible).map((c) => c.key),
    )
    const orderedKeys = columnState
      .filter((c) => c.visible)
      .sort((a, b) => a.order - b.order)
      .map((c) => c.key)

    return orderedKeys
      .map((key) => allFields.find((f) => f.fieldKey === key))
      .filter((f): f is RuntimeField => f !== undefined && visibleKeys.has(f.fieldKey))
  }, [columnState, allFields])

  const toggleColumn = (key: string) => {
    setColumnState((prev) =>
      prev.map((c) => (c.key === key ? { ...c, visible: !c.visible } : c)),
    )
  }

  const reorderColumns = (from: number, to: number) => {
    setColumnState((prev) => {
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next.map((c, idx) => ({ ...c, order: (idx + 1) * 10 }))
    })
  }

  const reset = () => {
    clearPrefs(collectionName)
    setColumnState(buildDefaults(allFields))
  }

  return {
    visibleFields,
    columnState,
    toggleColumn,
    reorderColumns,
    reset,
  }
}

/** 合并保存的偏好与当前 schema 字段 */
function mergePrefs(
  saved: ColumnPref[],
  allFields: RuntimeField[],
  defaults: ColumnPref[],
): ColumnPref[] {
  const savedMap = new Map(saved.map((c) => [c.key, c]))
  const merged: ColumnPref[] = []
  const seenKeys = new Set<string>()

  // 先按 saved 顺序
  for (const pref of saved) {
    const field = allFields.find((f) => f.fieldKey === pref.key)
    if (field && field.listConfig?.visible !== false && !field.hidden) {
      merged.push(pref)
      seenKeys.add(pref.key)
    }
  }

  // 补充 schema 中新增的字段
  for (const def of defaults) {
    if (!seenKeys.has(def.key)) {
      merged.push(def)
    }
  }

  // 重新计算 order
  return merged.map((c, idx) => ({ ...c, order: (idx + 1) * 10 }))
}
