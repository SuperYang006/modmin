import { useEffect, useState } from 'react'
import { Button, Drawer, Form, Input, InputNumber, message, Modal, Select, Space, Tag, Tooltip } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { PageShell, PageHeader, PanelCard, ConfigDataTable } from '@/components/ui'
import { ModelIconPicker } from '@/components/common/ModelIconPicker'
import { getModelIconComponent, MODEL_ICON_OPTIONS } from '@/components/common/modelIcons'
import { listMenuGroups } from '@/runtime/loader/listMenuGroups'
import { saveMenuGroup } from '@/runtime/loader/saveMenuGroup'
import { deleteMenuGroup } from '@/runtime/loader/deleteMenuGroup'
import { listCollectionSchemas } from '@/runtime/loader/listCollectionSchemas'
import { assignMenuGroup } from '@/runtime/loader/assignMenuGroup'
import type { CollectionSchemaSummary, MenuGroupItem, SaveMenuGroupPayload } from '@/types/schema'

export function MenuGroupManagementPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [groups, setGroups] = useState<MenuGroupItem[]>([])
  const [collections, setCollections] = useState<CollectionSchemaSummary[]>([])
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<MenuGroupItem | null>(null)
  const [form] = Form.useForm()

  async function fetchList() {
    setLoading(true)
    const [groupsRes, collectionsRes] = await Promise.all([
      listMenuGroups(),
      listCollectionSchemas(),
    ])
    setLoading(false)

    if (groupsRes.code !== 0) {
      message.error(groupsRes.message || '加载菜单分组失败')
      return
    }

    if (collectionsRes.code !== 0) {
      message.error(collectionsRes.message || '加载模型列表失败')
      return
    }

    setGroups(groupsRes.data.list)
    setCollections(collectionsRes.data.list)
  }

  useEffect(() => {
    void fetchList()
  }, [])

  function handleCreate() {
    setEditingItem(null)
    form.resetFields()
    form.setFieldsValue({ status: 'enabled', collectionNames: [] })
    setDrawerOpen(true)
  }

  function handleEdit(item: MenuGroupItem) {
    setEditingItem(item)
    const assignedCollections = collections
      .filter((c) => c.menuGroupId === item.groupId)
      .map((c) => c.collectionName)
    form.setFieldsValue({
      title: item.title,
      icon: item.icon || '',
      status: item.status,
      sortOrder: item.sortOrder,
      collectionNames: assignedCollections,
    })
    setDrawerOpen(true)
  }

  function handleDelete(item: MenuGroupItem) {
    Modal.confirm({
      title: `确定删除分组「${item.title}」吗？`,
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        const response = await deleteMenuGroup({ groupId: item.groupId })

        if (response.code !== 0) {
          message.error(response.message || '删除失败')
          return
        }

        message.success('删除成功')
        setGroups((prev) => prev.filter((g) => g.groupId !== item.groupId))
      },
    })
  }

  async function handleSubmit() {
    let values: {
      title: string
      icon?: string
      status: 'enabled' | 'disabled'
      sortOrder?: number
      collectionNames: string[]
    }

    try {
      values = await form.validateFields()
    } catch {
      return
    }

    setSaving(true)
    const payload: SaveMenuGroupPayload = {
      groupId: editingItem?.groupId,
      title: values.title.trim(),
      icon: values.icon?.trim() || undefined,
      status: values.status,
      sortOrder: values.sortOrder,
    }
    const response = await saveMenuGroup(payload)

    if (response.code !== 0) {
      setSaving(false)
      message.error(response.message || '保存失败')
      return
    }

    const nextItem = response.data.item
    const selectedCollectionNames = values.collectionNames ?? []

    // 计算需要加入和移出该分组的模型（新建时无已分配记录）
    const previouslyAssigned = editingItem
      ? collections.filter((c) => c.menuGroupId === editingItem.groupId).map((c) => c.collectionName)
      : []
    const toAssign = selectedCollectionNames.filter((name) => !previouslyAssigned.includes(name))
    const toUnassign = previouslyAssigned.filter((name) => !selectedCollectionNames.includes(name))

    const assignTasks: Promise<unknown>[] = []
    if (toAssign.length > 0) {
      assignTasks.push(assignMenuGroup({ collectionNames: toAssign, menuGroupId: nextItem.groupId }))
    }
    if (toUnassign.length > 0) {
      assignTasks.push(assignMenuGroup({ collectionNames: toUnassign, menuGroupId: null }))
    }

    if (assignTasks.length > 0) {
      const results = await Promise.all(assignTasks)
      const failed = results.find((r) => (r as { code: number }).code !== 0) as { message?: string } | undefined
      if (failed) {
        setSaving(false)
        message.error(failed.message || '模型分配失败')
        return
      }
    }

    // 更新本地 collections 的 menuGroupId
    setCollections((prev) =>
      prev.map((c) => {
        if (toAssign.includes(c.collectionName)) return { ...c, menuGroupId: nextItem.groupId }
        if (toUnassign.includes(c.collectionName)) return { ...c, menuGroupId: undefined }
        return c
      }),
    )

    setSaving(false)
    message.success(editingItem ? '更新成功' : '创建成功')
    setGroups((prev) => {
      const exists = prev.some((g) => g.groupId === nextItem.groupId)
      const nextList = exists
        ? prev.map((g) => (g.groupId === nextItem.groupId ? nextItem : g))
        : [...prev, nextItem]
      return [...nextList].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    })
    setDrawerOpen(false)
  }

  const columns: ColumnsType<MenuGroupItem> = [
    {
      title: '分组名称',
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: '图标',
      dataIndex: 'icon',
      key: 'icon',
      width: 80,
      render: (value: string) => {
        const Icon = getModelIconComponent(value)
        const label = MODEL_ICON_OPTIONS.find((item) => item.value === value)?.label
        return <Tooltip title={label}><Icon /></Tooltip>
      },
    },
    {
      title: '模型数',
      key: 'modelCount',
      width: 80,
      render: (_: unknown, record: MenuGroupItem) =>
        collections.filter((c) => c.menuGroupId === record.groupId).length,
    },
    {
      title: '排序',
      dataIndex: 'sortOrder',
      key: 'sortOrder',
      width: 80,
      render: (value: number) => value ?? '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (value: string) =>
        value === 'enabled' ? <Tag color="success">启用</Tag> : <Tag>停用</Tag>,
    },
    {
      title: '操作',
      key: 'actions',
      width: 140,
      fixed: 'right',
      render: (_: unknown, record: MenuGroupItem) => (
        <Space size={4}>
          <Button size="small" type="primary" onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Button size="small" danger onClick={() => handleDelete(record)}>
            删除
          </Button>
        </Space>
      ),
    },
  ]

  const collectionOptions = collections.map((c) => ({
    label: c.modelName || c.collectionName,
    value: c.collectionName,
  }))

  return (
    <PageShell>
      <PageHeader
        title="菜单分组"
        description="菜单分组用于将业务目录按域聚合。创建分组后，可在业务目录管理中将目录绑定到对应分组。"
        extra={<Button type="primary" onClick={handleCreate}>新建分组</Button>}
      />
      <PanelCard noPadding>
        <ConfigDataTable<MenuGroupItem>
          rowKey="groupId"
          loading={loading}
          columns={columns}
          dataSource={groups}
        />
      </PanelCard>

      <Drawer
        title={editingItem ? '编辑菜单分组' : '新建菜单分组'}
        open={drawerOpen}
        size={480}
        onClose={() => setDrawerOpen(false)}
        footer={
          <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
            <Button onClick={() => setDrawerOpen(false)}>取消</Button>
            <Button type="primary" loading={saving} onClick={() => void handleSubmit()}>
              保存
            </Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="title"
            label="分组名称"
            rules={[{ required: true, message: '请输入分组名称' }]}
          >
            <Input placeholder="如 内容域、运营域" />
          </Form.Item>
          <Form.Item name="icon" label="图标">
            <ModelIconPicker />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select options={[{ label: '启用', value: 'enabled' }, { label: '停用', value: 'disabled' }]} />
          </Form.Item>
          <Form.Item name="sortOrder" label="排序">
            <InputNumber min={0} step={10} style={{ width: '100%' }} placeholder="数字越小越靠前，如 10、20、30" />
          </Form.Item>
          <Form.Item name="collectionNames" label="包含的模型">
            <Select
              mode="multiple"
              placeholder="选择要加入该分组的模型"
              options={collectionOptions}
              allowClear
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>
        </Form>
      </Drawer>
    </PageShell>
  )
}
