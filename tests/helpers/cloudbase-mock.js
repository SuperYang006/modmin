// 内存版 @cloudbase/node-sdk mock，仅覆盖 modmin 云函数实际用到的表面。
// 数据存储为 Map<collectionName, Array<doc>>，每条文档至少含 _id。

let storage = new Map()
let idCounter = 0

function genId() {
  idCounter += 1
  return `mock_id_${idCounter}`
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value))
}

function getByPath(source, path) {
  return String(path)
    .split('.')
    .reduce((current, key) => (current && typeof current === 'object' ? current[key] : undefined), source)
}

// db.command 操作符。返回带 __op 标记的对象，由 matchWhere 识别。
const command = {
  in(values) { return { __op: 'in', values } },
  neq(value) { return { __op: 'neq', value } },
  and(...args) { return { __op: 'and', args } },
  gte(value) { return { __op: 'gte', value } },
  lte(value) { return { __op: 'lte', value } },
}

function matchValue(actual, condition) {
  if (condition === null || typeof condition !== 'object' || !condition.__op) {
    return actual === condition
  }
  switch (condition.__op) {
    case 'in':
      return Array.isArray(condition.values) && condition.values.includes(actual)
    case 'neq':
      return actual !== condition.value
    case 'gte':
      return actual !== undefined && actual !== null && actual >= condition.value
    case 'lte':
      return actual !== undefined && actual !== null && actual <= condition.value
    case 'and':
      return condition.args.every((sub) => matchValue(actual, sub))
    default:
      return false
  }
}

function matchWhere(doc, where) {
  for (const [key, cond] of Object.entries(where || {})) {
    if (!matchValue(getByPath(doc, key), cond)) return false
  }
  return true
}

function getCollectionDocs(name) {
  if (!storage.has(name)) storage.set(name, [])
  return storage.get(name)
}

function buildQuery(collectionName, state = { where: null, limit: null, skip: 0, orderBy: null }) {
  return {
    where(filter) {
      const next = filter
      const merged = state.where ? { ...state.where, ...next } : next
      return buildQuery(collectionName, { ...state, where: merged })
    },
    limit(n) { return buildQuery(collectionName, { ...state, limit: n }) },
    skip(n) { return buildQuery(collectionName, { ...state, skip: n }) },
    orderBy(field, direction) {
      return buildQuery(collectionName, { ...state, orderBy: { field, direction } })
    },
    field() { return buildQuery(collectionName, state) },
    async get() {
      let rows = getCollectionDocs(collectionName).slice()
      if (state.where) rows = rows.filter((doc) => matchWhere(doc, state.where))
      if (state.orderBy) {
        const { field, direction } = state.orderBy
        rows.sort((a, b) => {
          const av = a[field]
          const bv = b[field]
          if (av === bv) return 0
          const cmp = av > bv ? 1 : -1
          return direction === 'desc' ? -cmp : cmp
        })
      }
      if (state.skip) rows = rows.slice(state.skip)
      if (state.limit !== null && state.limit !== undefined) rows = rows.slice(0, state.limit)
      return { data: clone(rows) }
    },
    async count() {
      let rows = getCollectionDocs(collectionName)
      if (state.where) rows = rows.filter((doc) => matchWhere(doc, state.where))
      return { total: rows.length }
    },
    async add(doc) {
      const _id = doc._id || genId()
      const stored = { ...clone(doc), _id }
      getCollectionDocs(collectionName).push(stored)
      return { id: _id }
    },
    doc(id) {
      return {
        async get() {
          const found = getCollectionDocs(collectionName).find((d) => d._id === id)
          return { data: found ? [clone(found)] : [] }
        },
        async update(patch) {
          const docs = getCollectionDocs(collectionName)
          const idx = docs.findIndex((d) => d._id === id)
          if (idx < 0) return { updated: 0 }
          docs[idx] = { ...docs[idx], ...clone(patch), _id: docs[idx]._id }
          return { updated: 1 }
        },
        async remove() {
          const docs = getCollectionDocs(collectionName)
          const idx = docs.findIndex((d) => d._id === id)
          if (idx < 0) return { deleted: 0 }
          docs.splice(idx, 1)
          return { deleted: 1 }
        },
      }
    },
  }
}

function makeDatabase() {
  return {
    command,
    collection(name) { return buildQuery(name) },
  }
}

const SYMBOL_CURRENT_ENV = Symbol('SYMBOL_CURRENT_ENV')

function init() {
  return {
    database: makeDatabase,
    auth() {
      return {
        createTicket(userId) { return `mock_ticket_for_${userId}` },
      }
    },
  }
}

export function __resetDb(seed = {}) {
  storage = new Map()
  idCounter = 0
  for (const [collectionName, docs] of Object.entries(seed)) {
    const list = getCollectionDocs(collectionName)
    for (const doc of docs) {
      list.push({ ...clone(doc), _id: doc._id || genId() })
    }
  }
}

export function __getDocs(collectionName) {
  return clone(getCollectionDocs(collectionName))
}

export const cloudbaseMock = {
  init,
  SYMBOL_CURRENT_ENV,
}

export default cloudbaseMock
