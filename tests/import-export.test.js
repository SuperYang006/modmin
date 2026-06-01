import { beforeEach, describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { buildCollectionDoc, buildRoleDoc, buildRolePermission } from './helpers/fixtures.js'
import { loadCloudFunction, resetDb, getDocs } from './helpers/load-fn.js'
import { signTestToken, TOKEN_CUSTOM, TOKEN_SUPER_ADMIN } from './helpers/jwt.js'

function call(fn, action, data, token = TOKEN_SUPER_ADMIN()) {
  return fn.main({ action, data, context: token ? { accessToken: token } : undefined, meta: { requestId: 'import_export_req' } })
}

function encodeJsonRows(rows) {
  return Buffer.from(JSON.stringify(rows), 'utf8').toString('base64')
}

function encodeCsvRows(rows) {
  const worksheet = XLSX.utils.json_to_sheet(rows)
  const csvText = XLSX.utils.sheet_to_csv(worksheet)
  return Buffer.from(csvText, 'utf8').toString('base64')
}

function encodeXlsxRows(rows) {
  const worksheet = XLSX.utils.json_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1')
  return XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' })
}

describe('modmin_import_export', () => {
  let fn

  beforeEach(() => {
    resetDb({
      modmin_collections: [
        buildCollectionDoc({
          collectionName: 'article',
          modelName: '文章',
          fields: [
            { fieldKey: 'title', label: '标题', type: 'text', required: true },
            { fieldKey: 'count', label: '数量', type: 'number' },
          ],
        }),
      ],
      modmin_admin_roles: [
        buildRoleDoc({ roleCode: 'role_operator', roleName: '运营' }),
      ],
      modmin_role_permissions: [
        buildRolePermission({ roleCode: 'role_operator', collectionName: 'article', canList: true, canCreate: true, canUpdate: true }),
      ],
      article: [
        {
          _id: 'article_1',
          title: '原始标题',
          count: 1,
          modmin_isDeleted: false,
          modmin_createTime: Date.now(),
          modmin_updateTime: Date.now(),
        },
      ],
      modmin_webhooks: [],
      modmin_webhook_deliveries: [],
      modmin_audit_logs: [],
      modmin_import_export_jobs: [],
    })
    fn = loadCloudFunction('modmin_import_export')
  })

  it('lists transfer collections for role with CRUD permissions', async () => {
    const res = await call(fn, 'listTransferCollections', {}, TOKEN_CUSTOM('role_operator'))
    expect(res.code).toBe(0)
    expect(res.data.list).toHaveLength(1)
    expect(res.data.list[0].collectionName).toBe('article')
    expect(res.data.list[0].permissions.canExport).toBe(true)
    expect(res.data.list[0].permissions.canUpsert).toBe(true)
  })

  it('exports records as json', async () => {
    const res = await call(fn, 'exportRecords', {
      collectionName: 'article',
      format: 'json',
      fieldKeys: ['title', 'count'],
      headerMode: 'label',
    })

    expect(res.code).toBe(0)
    const decoded = JSON.parse(Buffer.from(res.data.fileContentBase64, 'base64').toString('utf8'))
    expect(decoded).toHaveLength(1)
    expect(decoded[0]).toMatchObject({ 标题: '原始标题', 数量: 1 })
    expect(getDocs('modmin_import_export_jobs')).toHaveLength(1)
    expect(getDocs('modmin_audit_logs').some((item) => item.eventType === 'data_export.create')).toBe(true)
  })

  it('exports records with filters applied', async () => {
    resetDb({
      modmin_collections: [
        buildCollectionDoc({
          collectionName: 'article',
          modelName: '文章',
          fields: [
            { fieldKey: 'title', label: '标题', type: 'text' },
            { fieldKey: 'count', label: '数量', type: 'number' },
          ],
        }),
      ],
      article: [
        {
          _id: 'article_1',
          title: '原始标题',
          count: 1,
          modmin_isDeleted: false,
          modmin_createTime: Date.now(),
          modmin_updateTime: Date.now(),
        },
        {
          _id: 'article_2',
          title: '筛选命中',
          count: 5,
          modmin_isDeleted: false,
          modmin_createTime: Date.now(),
          modmin_updateTime: Date.now(),
        },
      ],
      modmin_webhooks: [],
      modmin_webhook_deliveries: [],
      modmin_audit_logs: [],
      modmin_import_export_jobs: [],
    })
    fn = loadCloudFunction('modmin_import_export')

    const res = await call(fn, 'exportRecords', {
      collectionName: 'article',
      format: 'json',
      fieldKeys: ['title', 'count'],
      headerMode: 'label',
      filters: [
        { field: 'count', operator: 'gte', value: 5 },
      ],
    })

    expect(res.code).toBe(0)
    const decoded = JSON.parse(Buffer.from(res.data.fileContentBase64, 'base64').toString('utf8'))
    expect(decoded).toEqual([{ 标题: '筛选命中', 数量: 5 }])
  })

  it('exports records beyond default single-page limit', async () => {
    resetDb({
      modmin_collections: [
        buildCollectionDoc({
          collectionName: 'article',
          modelName: '文章',
          fields: [{ fieldKey: 'title', label: '标题', type: 'text' }],
        }),
      ],
      article: Array.from({ length: 150 }, (_, index) => ({
        _id: `article_${index + 1}`,
        title: `文章_${index + 1}`,
        modmin_isDeleted: false,
        modmin_createTime: index + 1,
        modmin_updateTime: index + 1,
      })),
      modmin_import_export_jobs: [],
    })
    fn = loadCloudFunction('modmin_import_export')

    const res = await call(fn, 'exportRecords', {
      collectionName: 'article',
      format: 'json',
      fieldKeys: ['title'],
      headerMode: 'label',
      sort: { field: 'modmin_createTime', order: 'asc' },
    })

    expect(res.code).toBe(0)
    const decoded = JSON.parse(Buffer.from(res.data.fileContentBase64, 'base64').toString('utf8'))
    expect(decoded).toHaveLength(150)
    expect(decoded[0]).toEqual({ 标题: '文章_1' })
    expect(decoded[149]).toEqual({ 标题: '文章_150' })
  })

  it('lists recent jobs for current operator only when not super admin', async () => {
    resetDb({
      modmin_collections: [
        buildCollectionDoc({
          collectionName: 'article',
          modelName: '文章',
          fields: [{ fieldKey: 'title', label: '标题', type: 'text' }],
        }),
      ],
      modmin_admin_roles: [buildRoleDoc({ roleCode: 'role_operator', roleName: '运营' })],
      modmin_role_permissions: [
        buildRolePermission({ roleCode: 'role_operator', collectionName: 'article', canList: true, canCreate: true, canUpdate: true }),
      ],
      modmin_import_export_jobs: [
        {
          jobId: 'job_a',
          jobType: 'export',
          collectionName: 'article',
          format: 'json',
          status: 'success',
          operator: { userId: 'user_a', userName: 'user_a', nickName: 'A', roleCode: 'role_operator' },
          createTime: 200,
          updateTime: 200,
        },
        {
          jobId: 'job_b',
          jobType: 'import_preview',
          collectionName: 'article',
          format: 'json',
          status: 'previewed',
          operator: { userId: 'user_b', userName: 'user_b', nickName: 'B', roleCode: 'role_operator' },
          createTime: 100,
          updateTime: 100,
        },
      ],
    })
    fn = loadCloudFunction('modmin_import_export')
    const token = signTestToken({
      userId: 'user_a',
      userName: 'user_a',
      nickName: 'A',
      roleCode: 'role_operator',
    })

    const res = await call(fn, 'listTransferJobs', { limit: 20 }, token)
    expect(res.code).toBe(0)
    expect(res.data.list.map((item) => item.jobId)).toEqual(['job_a'])
  })

  it('paginates transfer jobs from database query instead of recent 500 slice', async () => {
    resetDb({
      modmin_collections: [
        buildCollectionDoc({
          collectionName: 'article',
          modelName: '文章',
          fields: [{ fieldKey: 'title', label: '标题', type: 'text' }],
        }),
      ],
      modmin_import_export_jobs: Array.from({ length: 550 }, (_, index) => ({
        jobId: `job_${index + 1}`,
        jobType: 'export',
        collectionName: 'article',
        format: 'json',
        status: 'success',
        operator: { userId: 'user_super', userName: 'superadmin', nickName: '超管', roleCode: 'role_super_admin' },
        createTime: 1000 - index,
        updateTime: 1000 - index,
      })),
    })
    fn = loadCloudFunction('modmin_import_export')

    const res = await call(fn, 'listTransferJobs', { pageNo: 26, pageSize: 20 })
    expect(res.code).toBe(0)
    expect(res.data.pagination.total).toBe(550)
    expect(res.data.list).toHaveLength(20)
    expect(res.data.list[0].jobId).toBe('job_501')
    expect(res.data.list[19].jobId).toBe('job_520')
  })

  it('rejects job detail for another operator', async () => {
    resetDb({
      modmin_collections: [
        buildCollectionDoc({
          collectionName: 'article',
          modelName: '文章',
          fields: [{ fieldKey: 'title', label: '标题', type: 'text' }],
        }),
      ],
      modmin_admin_roles: [buildRoleDoc({ roleCode: 'role_operator', roleName: '运营' })],
      modmin_role_permissions: [
        buildRolePermission({ roleCode: 'role_operator', collectionName: 'article', canList: true, canCreate: true, canUpdate: true }),
      ],
      modmin_import_export_jobs: [
        {
          jobId: 'job_other',
          jobType: 'export',
          collectionName: 'article',
          format: 'json',
          status: 'success',
          operator: { userId: 'user_b', userName: 'user_b', nickName: 'B', roleCode: 'role_operator' },
          createTime: 100,
          updateTime: 100,
        },
      ],
    })
    fn = loadCloudFunction('modmin_import_export')
    const token = signTestToken({
      userId: 'user_a',
      userName: 'user_a',
      nickName: 'A',
      roleCode: 'role_operator',
    })

    const res = await call(fn, 'getTransferJobDetail', { jobId: 'job_other' }, token)
    expect(res.code).toBe(40301)
  })

  it('uses full record set when matching updateOnly import', async () => {
    resetDb({
      modmin_collections: [
        buildCollectionDoc({
          collectionName: 'article',
          modelName: '文章',
          fields: [
            { fieldKey: 'title', label: '标题', type: 'text', required: true },
            { fieldKey: 'count', label: '数量', type: 'number' },
          ],
        }),
      ],
      article: Array.from({ length: 150 }, (_, index) => ({
        _id: `article_${index + 1}`,
        title: `文章_${index + 1}`,
        count: index + 1,
        modmin_isDeleted: false,
        modmin_createTime: index + 1,
        modmin_updateTime: index + 1,
      })),
      modmin_import_export_jobs: [],
    })
    fn = loadCloudFunction('modmin_import_export')

    const fileBase64 = encodeJsonRows([
      { 标题: '文章_150', 数量: 999 },
    ])

    const previewRes = await call(fn, 'previewImport', {
      collectionName: 'article',
      fileID: 'mock_file_id',
      format: 'json',
      mode: 'updateOnly',
      matchFieldKey: 'title',
      mockFileBase64: fileBase64,
      mockFileName: 'article.json',
    })

    expect(previewRes.code).toBe(0)
    expect(previewRes.data.summary.validRows).toBe(1)
    expect(previewRes.data.errors).toHaveLength(0)

    const confirmRes = await call(fn, 'confirmImport', {
      jobId: previewRes.data.job.jobId,
      collectionName: 'article',
      fileID: 'mock_file_id',
      format: 'json',
      mode: 'updateOnly',
      matchFieldKey: 'title',
      mockFileBase64: fileBase64,
      mockFileName: 'article.json',
    })

    expect(confirmRes.code).toBe(0)
    const updated = getDocs('article').find((item) => item.title === '文章_150')
    expect(updated?.count).toBe(999)
  })

  it('previews and confirms json import for createOnly', async () => {
    const fileBase64 = encodeJsonRows([
      { 标题: '新增文章', 数量: 12 },
    ])

    const previewRes = await call(fn, 'previewImport', {
      collectionName: 'article',
      fileID: 'mock_file_id',
      format: 'json',
      mode: 'createOnly',
      mockFileBase64: fileBase64,
      mockFileName: 'article.json',
    })

    expect(previewRes.code).toBe(0)
    expect(previewRes.data.summary).toMatchObject({
      totalRows: 1,
      validRows: 1,
      errorRows: 0,
      conflictRows: 0,
    })
    expect(getDocs('modmin_audit_logs').some((item) => item.eventType === 'data_import.preview')).toBe(true)

    const confirmRes = await call(fn, 'confirmImport', {
      jobId: previewRes.data.job.jobId,
      collectionName: 'article',
      fileID: 'mock_file_id',
      format: 'json',
      mode: 'createOnly',
      mockFileBase64: fileBase64,
      mockFileName: 'article.json',
    })

    expect(confirmRes.code).toBe(0)
    expect(confirmRes.data.summary.validRows).toBe(1)
    expect(getDocs('article')).toHaveLength(2)
    expect(confirmRes.data.job.jobType).toBe('import_confirm')
    expect(confirmRes.data.job.sourcePreviewJobId).toBe(previewRes.data.job.jobId)
    expect(confirmRes.data.job.jobId).not.toBe(previewRes.data.job.jobId)
    expect(getDocs('modmin_import_export_jobs')).toHaveLength(2)
    expect(getDocs('modmin_import_export_jobs').some((item) => item.jobType === 'import_preview' && item.jobId === previewRes.data.job.jobId)).toBe(true)
    expect(getDocs('modmin_import_export_jobs').some((item) => item.jobType === 'import_confirm' && item.sourcePreviewJobId === previewRes.data.job.jobId)).toBe(true)
    expect(getDocs('modmin_audit_logs').some((item) => item.eventType === 'record.create')).toBe(true)
    expect(getDocs('modmin_audit_logs').some((item) => item.eventType === 'data_import.execute')).toBe(true)
  })

  it('rejects confirm when preview still has errors and skipErrorRows is not enabled', async () => {
    const fileBase64 = encodeJsonRows([
      { 标题: '可导入', 数量: 8 },
      { 数量: 2 },
    ])

    const previewRes = await call(fn, 'previewImport', {
      collectionName: 'article',
      fileID: 'mock_file_id',
      format: 'json',
      mode: 'createOnly',
      mockFileBase64: fileBase64,
      mockFileName: 'article.json',
    })

    expect(previewRes.code).toBe(0)
    expect(previewRes.data.summary).toMatchObject({
      totalRows: 2,
      validRows: 1,
      errorRows: 1,
      conflictRows: 0,
    })

    const confirmRes = await call(fn, 'confirmImport', {
      jobId: previewRes.data.job.jobId,
      collectionName: 'article',
      fileID: 'mock_file_id',
      format: 'json',
      mode: 'createOnly',
      mockFileBase64: fileBase64,
      mockFileName: 'article.json',
    })

    expect(confirmRes.code).toBe(40002)
    expect(getDocs('article')).toHaveLength(1)
  })

  it('supports skipErrorRows and marks import as partialSuccess', async () => {
    const fileBase64 = encodeJsonRows([
      { 标题: '跳过错误后导入', 数量: 8 },
      { 数量: 2 },
    ])

    const previewRes = await call(fn, 'previewImport', {
      collectionName: 'article',
      fileID: 'mock_file_id',
      format: 'json',
      mode: 'createOnly',
      mockFileBase64: fileBase64,
      mockFileName: 'article.json',
    })

    expect(previewRes.code).toBe(0)

    const confirmRes = await call(fn, 'confirmImport', {
      jobId: previewRes.data.job.jobId,
      collectionName: 'article',
      fileID: 'mock_file_id',
      format: 'json',
      mode: 'createOnly',
      skipErrorRows: true,
      mockFileBase64: fileBase64,
      mockFileName: 'article.json',
    })

    expect(confirmRes.code).toBe(0)
    expect(confirmRes.data.job.status).toBe('partialSuccess')
    expect(confirmRes.data.job.sourcePreviewJobId).toBe(previewRes.data.job.jobId)
    expect(confirmRes.data.summary).toMatchObject({
      totalRows: 2,
      validRows: 1,
      errorRows: 1,
      conflictRows: 0,
    })
    expect(getDocs('article').some((item) => item.title === '跳过错误后导入' && item.count === 8)).toBe(true)
    expect(getDocs('modmin_import_export_jobs').some((item) => item.jobType === 'import_preview' && item.jobId === previewRes.data.job.jobId)).toBe(true)
    expect(getDocs('modmin_import_export_jobs').some((item) => item.jobType === 'import_confirm' && item.status === 'partialSuccess' && item.sourcePreviewJobId === previewRes.data.job.jobId)).toBe(true)
  })

  it('rejects mockFileBase64 when test override is disabled', async () => {
    const previous = process.env.MODMIN_ALLOW_IMPORT_EXPORT_MOCK_FILE_BASE64
    process.env.MODMIN_ALLOW_IMPORT_EXPORT_MOCK_FILE_BASE64 = 'false'
    fn = loadCloudFunction('modmin_import_export')

    const fileBase64 = encodeJsonRows([
      { 标题: '仅 base64', 数量: 3 },
    ])

    const res = await call(fn, 'previewImport', {
      collectionName: 'article',
      fileID: '',
      format: 'json',
      mode: 'createOnly',
      mockFileBase64: fileBase64,
      mockFileName: 'article.json',
    })

    process.env.MODMIN_ALLOW_IMPORT_EXPORT_MOCK_FILE_BASE64 = previous
    fn = loadCloudFunction('modmin_import_export')

    expect(res.code).toBe(40001)
  })

  it('supports manual column mapping on preview', async () => {
    const fileBase64 = encodeJsonRows([
      { 标题名称: '手动映射文章', 数量值: 20 },
    ])

    const res = await call(fn, 'previewImport', {
      collectionName: 'article',
      fileID: 'mock_file_id',
      format: 'json',
      mode: 'createOnly',
      columnMappings: [
        { columnKey: '标题名称', columnLabel: '标题名称', fieldKey: 'title' },
        { columnKey: '数量值', columnLabel: '数量值', fieldKey: 'count' },
      ],
      mockFileBase64: fileBase64,
      mockFileName: 'article.json',
    })

    expect(res.code).toBe(0)
    expect(res.data.summary.validRows).toBe(1)
    expect(res.data.errors).toHaveLength(0)
  })

  it('confirms import after manual column mapping', async () => {
    const fileBase64 = encodeJsonRows([
      { 标题名称: '映射后导入', 数量值: 30 },
    ])

    const previewRes = await call(fn, 'previewImport', {
      collectionName: 'article',
      fileID: 'mock_file_id',
      format: 'json',
      mode: 'createOnly',
      columnMappings: [
        { columnKey: '标题名称', columnLabel: '标题名称', fieldKey: 'title' },
        { columnKey: '数量值', columnLabel: '数量值', fieldKey: 'count' },
      ],
      mockFileBase64: fileBase64,
      mockFileName: 'article.json',
    })

    expect(previewRes.code).toBe(0)

    const confirmRes = await call(fn, 'confirmImport', {
      jobId: previewRes.data.job.jobId,
      collectionName: 'article',
      fileID: 'mock_file_id',
      format: 'json',
      mode: 'createOnly',
      columnMappings: [
        { columnKey: '标题名称', columnLabel: '标题名称', fieldKey: 'title' },
        { columnKey: '数量值', columnLabel: '数量值', fieldKey: 'count' },
      ],
      mockFileBase64: fileBase64,
      mockFileName: 'article.json',
    })

    expect(confirmRes.code).toBe(0)
    expect(getDocs('article').some((item) => item.title === '映射后导入' && item.count === 30)).toBe(true)
  })

  it('rejects confirm when file differs from preview file', async () => {
    const previewBase64 = encodeJsonRows([
      { 标题: '预检文件', 数量: 1 },
    ])
    const confirmBase64 = encodeJsonRows([
      { 标题: '确认文件', 数量: 2 },
    ])

    const previewRes = await call(fn, 'previewImport', {
      collectionName: 'article',
      fileID: 'mock_file_a',
      format: 'json',
      mode: 'createOnly',
      mockFileBase64: previewBase64,
      mockFileName: 'article_a.json',
    })

    expect(previewRes.code).toBe(0)

    const confirmRes = await call(fn, 'confirmImport', {
      jobId: previewRes.data.job.jobId,
      collectionName: 'article',
      fileID: 'mock_file_b',
      format: 'json',
      mode: 'createOnly',
      mockFileBase64: confirmBase64,
      mockFileName: 'article_b.json',
    })

    expect(confirmRes.code).toBe(40002)
  })

  it('avoids duplicate createOnly inserts when rerunning same preview job', async () => {
    const fileBase64 = encodeJsonRows([
      { 标题: '重跑防重', 数量: 7 },
    ])

    const previewRes = await call(fn, 'previewImport', {
      collectionName: 'article',
      fileID: 'mock_file_id',
      format: 'json',
      mode: 'createOnly',
      mockFileBase64: fileBase64,
      mockFileName: 'article.json',
    })

    expect(previewRes.code).toBe(0)

    resetDb({
      modmin_collections: [
        buildCollectionDoc({
          collectionName: 'article',
          modelName: '文章',
          fields: [
            { fieldKey: 'title', label: '标题', type: 'text', required: true },
            { fieldKey: 'count', label: '数量', type: 'number' },
          ],
        }),
      ],
      modmin_admin_roles: [
        buildRoleDoc({ roleCode: 'role_operator', roleName: '运营' }),
      ],
      modmin_role_permissions: [
        buildRolePermission({ roleCode: 'role_operator', collectionName: 'article', canList: true, canCreate: true, canUpdate: true }),
      ],
      article: [
        {
          _id: 'article_1',
          title: '原始标题',
          count: 1,
          modmin_isDeleted: false,
          modmin_createTime: Date.now(),
          modmin_updateTime: Date.now(),
        },
        {
          _id: 'article_replayed',
          title: '重跑防重',
          count: 7,
          modmin_isDeleted: false,
          modmin_createTime: Date.now(),
          modmin_createBy: 'user_super',
          modmin_updateTime: Date.now(),
          modmin_updateBy: 'user_super',
          modmin_importJobId: previewRes.data.job.jobId,
          modmin_importRowNo: 2,
        },
      ],
      modmin_webhooks: [],
      modmin_webhook_deliveries: [],
      modmin_audit_logs: [],
      modmin_import_export_jobs: [
        {
          ...previewRes.data.job,
          status: 'failed',
          executionState: {
            cursor: 0,
            completedRowNos: [],
          },
        },
      ],
    })
    fn = loadCloudFunction('modmin_import_export')

    const confirmRes = await call(fn, 'confirmImport', {
      jobId: previewRes.data.job.jobId,
      collectionName: 'article',
      fileID: 'mock_file_id',
      format: 'json',
      mode: 'createOnly',
      mockFileBase64: fileBase64,
      mockFileName: 'article.json',
    })

    expect(confirmRes.code).toBe(0)
    expect(confirmRes.data.summary.validRows).toBe(1)
    expect(getDocs('article').filter((item) => item.title === '重跑防重')).toHaveLength(1)
  })

  it('parses chinese csv headers without mojibake', async () => {
    const fileBase64 = encodeCsvRows([
      { 标题: '中文列导入', 数量: 9 },
    ])

    const res = await call(fn, 'previewImport', {
      collectionName: 'article',
      fileID: 'mock_file_id',
      format: 'csv',
      mode: 'createOnly',
      mockFileBase64: fileBase64,
      mockFileName: 'article.csv',
    })

    expect(res.code).toBe(0)
    expect(res.data.columnMappings.some((item) => item.columnLabel === '标题' && item.fieldKey === 'title')).toBe(true)
    expect(res.data.summary.validRows).toBe(1)
  })

  it('previews xlsx import successfully', async () => {
    const fileBase64 = encodeXlsxRows([
      { 标题: 'XLSX 导入', 数量: 18 },
    ])

    const res = await call(fn, 'previewImport', {
      collectionName: 'article',
      fileID: 'mock_file_id',
      format: 'xlsx',
      mode: 'createOnly',
      mockFileBase64: fileBase64,
      mockFileName: 'article.xlsx',
    })

    expect(res.code).toBe(0)
    expect(res.data.summary.validRows).toBe(1)
    expect(res.data.columnMappings.some((item) => item.columnLabel === '标题' && item.fieldKey === 'title')).toBe(true)
  })

  it('download template excludes system reserved fields', async () => {
    resetDb({
      modmin_collections: [
        buildCollectionDoc({
          collectionName: 'article',
          modelName: '文章',
          fields: [
            { fieldKey: '_id', label: '记录 ID', type: 'text' },
            { fieldKey: 'title', label: '标题', type: 'text', required: true },
            { fieldKey: 'modmin_createTime', label: '创建时间', type: 'datetime' },
          ],
        }),
      ],
      modmin_admin_roles: [buildRoleDoc({ roleCode: 'role_operator', roleName: '运营' })],
      modmin_role_permissions: [
        buildRolePermission({ roleCode: 'role_operator', collectionName: 'article', canList: true, canCreate: true, canUpdate: true }),
      ],
      modmin_import_export_jobs: [],
    })
    fn = loadCloudFunction('modmin_import_export')

    const res = await call(fn, 'downloadImportTemplate', {
      collectionName: 'article',
      format: 'json',
    })

    expect(res.code).toBe(0)
    expect(res.data.fields.map((item) => item.fieldKey)).toEqual(['title'])
    const decoded = JSON.parse(Buffer.from(res.data.fileContentBase64, 'base64').toString('utf8'))
    expect(Object.keys(decoded[0])).toEqual(['标题'])
  })

  it('rejects export when role has no list permission', async () => {
    resetDb({
      modmin_collections: [buildCollectionDoc({ collectionName: 'article', modelName: '文章' })],
      modmin_admin_roles: [buildRoleDoc({ roleCode: 'role_readonly', roleName: '只读' })],
      modmin_role_permissions: [
        buildRolePermission({ roleCode: 'role_readonly', collectionName: 'article', canCreate: true }),
      ],
      article: [],
      modmin_import_export_jobs: [],
    })
    fn = loadCloudFunction('modmin_import_export')

    const res = await call(fn, 'exportRecords', {
      collectionName: 'article',
      format: 'json',
      fieldKeys: ['title'],
      headerMode: 'label',
    }, TOKEN_CUSTOM('role_readonly'))

    expect(res.code).toBe(40301)
  })

  it('rejects export when fieldKeys is empty', async () => {
    const res = await call(fn, 'exportRecords', {
      collectionName: 'article',
      format: 'json',
      fieldKeys: [],
      headerMode: 'label',
    })

    expect(res.code).toBe(40001)
  })

  it('exports records as csv with parseable chinese headers', async () => {
    const res = await call(fn, 'exportRecords', {
      collectionName: 'article',
      format: 'csv',
      fieldKeys: ['title', 'count'],
      headerMode: 'label',
    })

    expect(res.code).toBe(0)
    const csvText = Buffer.from(res.data.fileContentBase64, 'base64').toString('utf8')
    expect(csvText.charCodeAt(0)).toBe(0xfeff)
    const workbook = XLSX.read(csvText.replace(/^﻿/, ''), { type: 'string' })
    const parsed = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]])
    expect(parsed).toEqual([{ 标题: '原始标题', 数量: 1 }])
  })

  it('rejects preview when rows exceed MAX_IMPORT_ROWS', async () => {
    const fileBase64 = encodeJsonRows(
      Array.from({ length: 1001 }, (_, index) => ({ 标题: `批量_${index + 1}`, 数量: index })),
    )

    const res = await call(fn, 'previewImport', {
      collectionName: 'article',
      fileID: 'mock_file_id',
      format: 'json',
      mode: 'createOnly',
      mockFileBase64: fileBase64,
      mockFileName: 'article.json',
    })

    expect(res.code).toBe(40002)
    expect(getDocs('article')).toHaveLength(1)
  })

  it('rejects confirm when mode differs from preview job', async () => {
    const fileBase64 = encodeJsonRows([
      { 标题: '原始标题', 数量: 50 },
    ])

    const previewRes = await call(fn, 'previewImport', {
      collectionName: 'article',
      fileID: 'mock_file_id',
      format: 'json',
      mode: 'updateOnly',
      matchFieldKey: 'title',
      mockFileBase64: fileBase64,
      mockFileName: 'article.json',
    })

    expect(previewRes.code).toBe(0)

    const confirmRes = await call(fn, 'confirmImport', {
      jobId: previewRes.data.job.jobId,
      collectionName: 'article',
      fileID: 'mock_file_id',
      format: 'json',
      mode: 'upsert',
      matchFieldKey: 'title',
      mockFileBase64: fileBase64,
      mockFileName: 'article.json',
    })

    expect(confirmRes.code).toBe(40002)
    expect(getDocs('article').find((item) => item.title === '原始标题')?.count).toBe(1)
  })

  it('upsert updates matched record and inserts unmatched record', async () => {
    const fileBase64 = encodeJsonRows([
      { 标题: '原始标题', 数量: 88 },
      { 标题: '全新文章', 数量: 5 },
    ])

    const previewRes = await call(fn, 'previewImport', {
      collectionName: 'article',
      fileID: 'mock_file_id',
      format: 'json',
      mode: 'upsert',
      matchFieldKey: 'title',
      mockFileBase64: fileBase64,
      mockFileName: 'article.json',
    })

    expect(previewRes.code).toBe(0)
    expect(previewRes.data.summary.validRows).toBe(2)

    const confirmRes = await call(fn, 'confirmImport', {
      jobId: previewRes.data.job.jobId,
      collectionName: 'article',
      fileID: 'mock_file_id',
      format: 'json',
      mode: 'upsert',
      matchFieldKey: 'title',
      mockFileBase64: fileBase64,
      mockFileName: 'article.json',
    })

    expect(confirmRes.code).toBe(0)
    const articles = getDocs('article')
    expect(articles).toHaveLength(2)
    expect(articles.find((item) => item.title === '原始标题')?.count).toBe(88)
    expect(articles.find((item) => item.title === '全新文章')?.count).toBe(5)
  })

  it('marks rows missing required field as errors during preview', async () => {
    const fileBase64 = encodeJsonRows([
      { 数量: 3 },
    ])

    const res = await call(fn, 'previewImport', {
      collectionName: 'article',
      fileID: 'mock_file_id',
      format: 'json',
      mode: 'createOnly',
      mockFileBase64: fileBase64,
      mockFileName: 'article.json',
    })

    expect(res.code).toBe(0)
    expect(res.data.summary).toMatchObject({ totalRows: 1, validRows: 0, errorRows: 1 })
    expect(res.data.errors[0].message).toContain('必填')
  })

  it('rejects export when collectionName is missing', async () => {
    const res = await call(fn, 'exportRecords', {
      format: 'json',
      fieldKeys: ['title'],
      headerMode: 'label',
    })

    expect(res.code).toBe(40001)
  })
})
