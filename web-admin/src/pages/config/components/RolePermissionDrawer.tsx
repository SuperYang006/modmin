import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Checkbox, Drawer, Empty, Input, message, Modal, Space, Spin, Table, Tag, Tooltip } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { getRolePermissions, saveRolePermissions } from '@/runtime/loader/rolePermissions'
import type { RolePermissionRow } from '@/runtime/loader/rolePermissions'

interface Props {
  roleCode: string
  roleName: string
  open: boolean
  onClose: () => void
}

type PermKey = 'canList' | 'canCreate' | 'canUpdate' | 'canDelete'

const PERM_COLS: Array<{ key: PermKey; label: string }> = [
  { key: 'canList', label: '查看' },
  { key: 'canCreate', label: '新增' },
  { key: 'canUpdate', label: '编辑' },
  { key: 'canDelete', label: '删除' },
]

const ALL_PERM_KEYS: PermKey[] = PERM_COLS.map((c) => c.key)

function rowFullyChecked(row: RolePermissionRow) {
  return ALL_PERM_KEYS.every((k) => row[k])
}

function rowPartiallyChecked(row: RolePermissionRow) {
  const checked = ALL_PERM_KEYS.filter((k) => row[k]).length
  return checked > 0 && checked < ALL_PERM_KEYS.length
}

function countEnabledRows(rows: RolePermissionRow[]) {
  return rows.filter((r) => ALL_PERM_KEYS.some((k) => r[k])).length
}

function diffCount(current: RolePermissionRow[], initial: RolePermissionRow[]) {
  const map = new Map(initial.map((r) => [r.collectionName, r]))
  let count = 0
  for (const row of current) {
    const before = map.get(row.collectionName)
    if (!before) {
      if (ALL_PERM_KEYS.some((k) => row[k])) count += 1
      continue
    }
    if (ALL_PERM_KEYS.some((k) => row[k] !== before[k])) count += 1
  }
  return count
}

export function RolePermissionDrawer({ roleCode, roleName, open, onClose }: Props) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [rows, setRows] = useState<RolePermissionRow[]>([])
  const initialRowsRef = useRef<RolePermissionRow[]>([])
  const [keyword, setKeyword] = useState('')

  useEffect(() => {
    if (!open || !roleCode) return
    setKeyword('')
    setLoading(true)
    void getRolePermissions(roleCode).then((res) => {
      setLoading(false)
      if (res.code !== 0) {
        void message.error(res.message || '加载权限失败')
        return
      }
      setRows(res.data.list)
      initialRowsRef.current = res.data.list.map((r) => ({ ...r }))
    })
  }, [open, roleCode])

  const filteredRows = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    if (!kw) return rows
    return rows.filter(
      (r) =>
        r.modelName.toLowerCase().includes(kw) ||
        r.collectionName.toLowerCase().includes(kw),
    )
  }, [rows, keyword])

  const dirtyCount = useMemo(() => diffCount(rows, initialRowsRef.current), [rows])
  const enabledCount = useMemo(() => countEnabledRows(rows), [rows])

  function updateRow(collectionName: string, patch: Partial<RolePermissionRow>) {
    setRows((prev) =>
      prev.map((row) => (row.collectionName === collectionName ? { ...row, ...patch } : row)),
    )
  }

  function togglePerm(collectionName: string, key: PermKey, value: boolean) {
    updateRow(collectionName, { [key]: value } as Partial<RolePermissionRow>)
  }

  function toggleRowAll(collectionName: string, value: boolean) {
    const patch: Partial<RolePermissionRow> = {}
    for (const k of ALL_PERM_KEYS) patch[k] = value
    updateRow(collectionName, patch)
  }

  function toggleColumn(key: PermKey, value: boolean) {
    const targets = new Set(filteredRows.map((r) => r.collectionName))
    setRows((prev) =>
      prev.map((row) => (targets.has(row.collectionName) ? { ...row, [key]: value } : row)),
    )
  }

  function isColumnAllChecked(key: PermKey) {
    return filteredRows.length > 0 && filteredRows.every((row) => row[key])
  }

  function isColumnIndeterminate(key: PermKey) {
    const checked = filteredRows.filter((row) => row[key]).length
    return checked > 0 && checked < filteredRows.length
  }

  function applyPreset(preset: 'all' | 'none' | 'readonly') {
    const targets = new Set(filteredRows.map((r) => r.collectionName))
    setRows((prev) =>
      prev.map((row) => {
        if (!targets.has(row.collectionName)) return row
        if (preset === 'all') return { ...row, canList: true, canCreate: true, canUpdate: true, canDelete: true }
        if (preset === 'none') return { ...row, canList: false, canCreate: false, canUpdate: false, canDelete: false }
        return { ...row, canList: true, canCreate: false, canUpdate: false, canDelete: false }
      }),
    )
  }

  async function handleSave() {
    setSaving(true)
    const res = await saveRolePermissions(roleCode, rows)
    setSaving(false)
    if (res.code !== 0) {
      void message.error(res.message || '保存失败')
      return
    }
    void message.success('保存成功')
    initialRowsRef.current = rows.map((r) => ({ ...r }))
    onClose()
  }

  function handleClose() {
    if (dirtyCount === 0) {
      onClose()
      return
    }
    Modal.confirm({
      title: '放弃未保存的修改？',
      content: `当前有 ${dirtyCount} 个模型的权限变更尚未保存。`,
      okText: '放弃',
      okButtonProps: { danger: true },
      cancelText: '继续编辑',
      onOk: onClose,
    })
  }

  const columns: ColumnsType<RolePermissionRow> = [
    {
      title: (
        <Checkbox
          checked={filteredRows.length > 0 && filteredRows.every(rowFullyChecked)}
          indeterminate={
            filteredRows.some((r) => rowFullyChecked(r) || rowPartiallyChecked(r)) &&
            !filteredRows.every(rowFullyChecked)
          }
          onChange={(e) => applyPreset(e.target.checked ? 'all' : 'none')}
          disabled={filteredRows.length === 0}
        />
      ),
      key: 'rowToggle',
      width: 48,
      align: 'center',
      render: (_: unknown, row: RolePermissionRow) => (
        <Tooltip title={rowFullyChecked(row) ? '取消该模型全部权限' : '授予该模型全部权限'}>
          <Checkbox
            checked={rowFullyChecked(row)}
            indeterminate={rowPartiallyChecked(row)}
            onChange={(e) => toggleRowAll(row.collectionName, e.target.checked)}
          />
        </Tooltip>
      ),
    },
    {
      title: '模型',
      dataIndex: 'modelName',
      key: 'modelName',
      render: (_: unknown, row: RolePermissionRow) => (
        <div className="role-perm-model-cell">
          <span className="role-perm-model-name">{row.modelName}</span>
          <span className="role-perm-model-code">{row.collectionName}</span>
        </div>
      ),
    },
    ...PERM_COLS.map(({ key, label }) => ({
      key,
      width: 96,
      align: 'center' as const,
      title: (
        <div className="role-perm-col-header">
          <span>{label}</span>
          <Checkbox
            checked={isColumnAllChecked(key)}
            indeterminate={isColumnIndeterminate(key)}
            onChange={(e) => toggleColumn(key, e.target.checked)}
            disabled={filteredRows.length === 0}
          />
        </div>
      ),
      render: (_: unknown, row: RolePermissionRow) => (
        <Checkbox
          checked={row[key]}
          onChange={(e) => togglePerm(row.collectionName, key, e.target.checked)}
        />
      ),
    })),
  ]

  return (
    <Drawer
      title={
        <Space size={8}>
          <span>配置权限</span>
          <span className="role-name-tag">{roleName}</span>
        </Space>
      }
      open={open}
      size={760}
      onClose={handleClose}
      mask={{ closable: dirtyCount === 0 }}
      footer={
        <div className="role-perm-footer">
          <span className="role-perm-footer-meta">
            已授权 <strong>{enabledCount}</strong> / {rows.length} 个模型
            {dirtyCount > 0 && <Tag color="orange" style={{ marginLeft: 8 }}>未保存 {dirtyCount}</Tag>}
          </span>
          <Space>
            <Button onClick={handleClose}>取消</Button>
            <Button
              type="primary"
              loading={saving}
              disabled={dirtyCount === 0}
              onClick={() => void handleSave()}
            >
              保存
            </Button>
          </Space>
        </div>
      }
    >
      <Spin spinning={loading}>
        <div className="role-perm-toolbar">
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="搜索模型名称或集合名"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ width: 260 }}
          />
          <Space size={8}>
            <Tooltip title="当前筛选下的模型授予全部权限">
              <Button size="small" onClick={() => applyPreset('all')} disabled={filteredRows.length === 0}>
                全部授权
              </Button>
            </Tooltip>
            <Tooltip title="当前筛选下的模型仅保留查看权限">
              <Button size="small" onClick={() => applyPreset('readonly')} disabled={filteredRows.length === 0}>
                仅查看
              </Button>
            </Tooltip>
            <Tooltip title="当前筛选下的模型清空全部权限">
              <Button size="small" danger onClick={() => applyPreset('none')} disabled={filteredRows.length === 0}>
                全部清空
              </Button>
            </Tooltip>
          </Space>
        </div>
        <Table
          rowKey="collectionName"
          columns={columns}
          dataSource={filteredRows}
          pagination={false}
          size="middle"
          sticky
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={keyword ? '没有匹配的模型' : '暂无可配置的业务模型'}
              />
            ),
          }}
        />
      </Spin>
    </Drawer>
  )
}
