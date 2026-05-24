import { useEffect, useState } from 'react'
import { Button, Drawer, Form, Input, message, Select, Space, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { PageShell, PageHeader, PanelCard, ConfigDataTable } from '@/components/ui'
import { listRoles, saveRole } from '@/runtime/loader/roles'
import type { RoleItem } from '@/runtime/loader/roles'
import { RolePermissionDrawer } from './components/RolePermissionDrawer'

export function RoleManagementPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [roles, setRoles] = useState<RoleItem[]>([])
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<RoleItem | null>(null)
  const [permDrawer, setPermDrawer] = useState<{ roleCode: string; roleName: string } | null>(null)
  const [form] = Form.useForm()

  useEffect(() => {
    void fetchList()
  }, [])

  async function fetchList() {
    setLoading(true)
    const res = await listRoles()
    setLoading(false)
    if (res.code !== 0) {
      void message.error(res.message || '加载角色列表失败')
      return
    }
    setRoles(res.data.list)
  }

  function handleCreate() {
    setEditingItem(null)
    form.resetFields()
    form.setFieldsValue({ status: 'enabled' })
    setDrawerOpen(true)
  }

  function handleEdit(item: RoleItem) {
    setEditingItem(item)
    form.setFieldsValue({
      roleCode: item.roleCode,
      roleName: item.roleName,
      description: item.description,
      status: item.status,
    })
    setDrawerOpen(true)
  }

  async function handleSubmit() {
    let values: { roleCode: string; roleName: string; description?: string; status: 'enabled' | 'disabled' }
    try {
      values = await form.validateFields()
    } catch {
      return
    }

    setSaving(true)
    const res = await saveRole({
      roleCode: editingItem ? editingItem.roleCode : values.roleCode,
      roleName: values.roleName,
      description: values.description || '',
      status: values.status,
    })
    setSaving(false)

    if (res.code !== 0) {
      void message.error(res.message || '保存失败')
      return
    }

    void message.success(editingItem ? '更新成功' : '创建成功')
    const nextItem = res.data.item
    setRoles((prev) => {
      const exists = prev.some((r) => r.roleCode === nextItem.roleCode)
      return exists
        ? prev.map((r) => (r.roleCode === nextItem.roleCode ? nextItem : r))
        : [...prev, nextItem]
    })
    setDrawerOpen(false)
  }

  const columns: ColumnsType<RoleItem> = [
    { title: '角色编码', dataIndex: 'roleCode', key: 'roleCode' },
    {
      title: '角色名称',
      dataIndex: 'roleName',
      key: 'roleName',
      render: (v: string, record: RoleItem) => (
        <Space size={6}>
          <span>{v}</span>
          {record.builtin && <span className="role-builtin-tag">内置</span>}
        </Space>
      ),
    },
    { title: '描述', dataIndex: 'description', key: 'description', render: (v: string) => v || '-' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (v: string) => v === 'enabled' ? <Tag color="success">启用</Tag> : <Tag>停用</Tag>,
    },
    {
      title: '操作',
      key: 'actions',
      width: 180,
      fixed: 'right',
      render: (_: unknown, record: RoleItem) => (
        <Space size={4}>
          <Button size="small" type="primary" onClick={() => handleEdit(record)}>编辑</Button>
          <Button
            size="small"
            disabled={record.roleCode === 'role_super_admin'}
            onClick={() => setPermDrawer({ roleCode: record.roleCode, roleName: record.roleName })}
          >
            配置权限
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <PageShell>
      <PageHeader
        title="角色管理"
        description="管理系统角色，并为每个角色配置可访问的业务模型权限。超级管理员拥有全量权限。"
        extra={<Button type="primary" onClick={handleCreate}>新建角色</Button>}
      />
      <PanelCard noPadding>
        <ConfigDataTable<RoleItem>
          rowKey="roleCode"
          loading={loading}
          columns={columns}
          dataSource={roles}
        />
      </PanelCard>

      <Drawer
        title={editingItem ? '编辑角色' : '新建角色'}
        open={drawerOpen}
        width={480}
        onClose={() => setDrawerOpen(false)}
        footer={
          <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
            <Button onClick={() => setDrawerOpen(false)}>取消</Button>
            <Button type="primary" loading={saving} onClick={() => void handleSubmit()}>保存</Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="roleCode"
            label="角色编码"
            rules={[{ required: true, message: '请输入角色编码' }]}
          >
            <Input placeholder="如 role_editor" disabled={!!editingItem} />
          </Form.Item>
          <Form.Item
            name="roleName"
            label="角色名称"
            rules={[{ required: true, message: '请输入角色名称' }]}
          >
            <Input placeholder="如 内容编辑" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} placeholder="可选，描述该角色的职责" />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select
              disabled={!!editingItem?.builtin}
              options={[{ label: '启用', value: 'enabled' }, { label: '停用', value: 'disabled' }]}
            />
          </Form.Item>
        </Form>
      </Drawer>

      {permDrawer && (
        <RolePermissionDrawer
          roleCode={permDrawer.roleCode}
          roleName={permDrawer.roleName}
          open={true}
          onClose={() => setPermDrawer(null)}
        />
      )}
    </PageShell>
  )
}
