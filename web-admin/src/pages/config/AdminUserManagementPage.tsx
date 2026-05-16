import { useEffect, useState } from 'react'
import { Avatar, Button, Drawer, Form, Input, message, Modal, Select, Space, Table, Tag, Upload } from 'antd'
import { PlusOutlined, UserOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { PageSectionHeader } from '@/components/layout/PageSectionHeader'
import { listAdminUsers, saveAdminUser, deleteAdminUser, disableAdminUser } from '@/runtime/loader/adminUsers'
import type { AdminUserItem } from '@/runtime/loader/adminUsers'
import { listRoles } from '@/runtime/loader/roles'
import type { RoleItem } from '@/runtime/loader/roles'
import { displayRoleName } from '@/runtime/roles/displayRoleName'
import { getStoredAuthSession, patchStoredSessionUserInfo } from '@/auth/session'
import { uploadAsset, useResolvedAssetUrl } from '@/services/asset'
import type { UploadedAssetValue } from '@/services/asset'
import dayjs from 'dayjs'

function AvatarCell({ avatar }: { avatar?: UploadedAssetValue }) {
  const { url } = useResolvedAssetUrl(avatar ?? null)
  return <Avatar size={32} src={url || undefined} icon={!url ? <UserOutlined /> : undefined} />
}

interface AvatarUploadProps {
  value: UploadedAssetValue | null
  uploading: boolean
  onChange: (value: UploadedAssetValue | null) => void
  onUploadingChange: (uploading: boolean) => void
}

function AvatarUpload({ value, uploading, onChange, onUploadingChange }: AvatarUploadProps) {
  const { url } = useResolvedAssetUrl(value)

  async function handleUpload(file: File) {
    onUploadingChange(true)
    try {
      const uploaded = await uploadAsset(file, 'modmin_admin_users', 'avatar')
      onChange(uploaded)
    } catch (error) {
      void message.error(error instanceof Error ? error.message : '上传失败')
    } finally {
      onUploadingChange(false)
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <Upload
        accept="image/*"
        showUploadList={false}
        disabled={uploading}
        beforeUpload={(file) => {
          void handleUpload(file)
          return Upload.LIST_IGNORE
        }}
      >
        <div
          style={{
            width: 80,
            height: 80,
            border: '1px dashed #d9d9d9',
            borderRadius: '50%',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: uploading ? 'default' : 'pointer',
            background: '#fafafa',
            position: 'relative',
          }}
        >
          {url ? (
            <img src={url} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ textAlign: 'center', color: '#999', fontSize: 12 }}>
              <PlusOutlined style={{ fontSize: 18 }} />
              <div style={{ marginTop: 4 }}>{uploading ? '上传中' : '上传头像'}</div>
            </div>
          )}
        </div>
      </Upload>
      {value && (
        <Button size="small" danger onClick={() => onChange(null)}>
          移除头像
        </Button>
      )}
    </div>
  )
}

export function AdminUserManagementPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [users, setUsers] = useState<AdminUserItem[]>([])
  const [roles, setRoles] = useState<RoleItem[]>([])
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<AdminUserItem | null>(null)
  const [avatarValue, setAvatarValue] = useState<UploadedAssetValue | null>(null)
  const [form] = Form.useForm()
  const currentUserId = getStoredAuthSession()?.userInfo.userId

  useEffect(() => {
    void fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    const [usersRes, rolesRes] = await Promise.all([listAdminUsers(), listRoles()])
    setLoading(false)
    if (usersRes.code !== 0) { void message.error(usersRes.message || '加载用户列表失败'); return }
    if (rolesRes.code !== 0) { void message.error(rolesRes.message || '加载角色列表失败'); return }
    setUsers(usersRes.data.list)
    setRoles(rolesRes.data.list.filter((r) => r.status === 'enabled'))
  }

  function handleCreate() {
    setEditingItem(null)
    setAvatarValue(null)
    form.resetFields()
    const defaultRoleCode = roles.find((role) => role.roleCode === 'role_operator')?.roleCode || roles[0]?.roleCode
    form.setFieldsValue({ status: 'enabled', ...(defaultRoleCode ? { roleCode: defaultRoleCode } : {}) })
    setDrawerOpen(true)
  }

  function handleEdit(item: AdminUserItem) {
    setEditingItem(item)
    setAvatarValue(item.avatar ?? null)
    form.setFieldsValue({
      userName: item.userName,
      nickName: item.nickName,
      roleCode: item.roleCode,
      status: item.status,
      password: '',
    })
    setDrawerOpen(true)
  }

  function handleDelete(item: AdminUserItem) {
    Modal.confirm({
      title: `确定删除用户「${item.nickName}」吗？`,
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        const res = await deleteAdminUser(item.userId)
        if (res.code !== 0) { void message.error(res.message || '删除失败'); return }
        void message.success('删除成功')
        setUsers((prev) => prev.filter((u) => u.userId !== item.userId))
      },
    })
  }

  function handleDisable(item: AdminUserItem) {
    Modal.confirm({
      title: `确定禁用用户「${item.nickName}」吗？禁用后该用户将立即无法登录。`,
      okText: '禁用',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        const res = await disableAdminUser(item.userId)
        if (res.code !== 0) { void message.error(res.message || '禁用失败'); return }
        void message.success('已禁用')
        setUsers((prev) => prev.map((u) => u.userId === item.userId ? { ...u, status: 'disabled' } : u))
      },
    })
  }

  async function handleSubmit() {
    let values: {
      userName: string
      nickName?: string
      roleCode: string
      status: 'enabled' | 'disabled'
      password?: string
    }
    try {
      values = await form.validateFields()
    } catch {
      return
    }

    setSaving(true)
    const res = await saveAdminUser({
      userId: editingItem?.userId,
      userName: values.userName,
      nickName: values.nickName,
      roleCode: values.roleCode,
      status: values.status,
      password: values.password || undefined,
      avatar: avatarValue,
    })
    setSaving(false)

    if (res.code !== 0) { void message.error(res.message || '保存失败'); return }

    void message.success(editingItem ? '更新成功' : '创建成功')
    const nextItem = res.data.item
    // 如果编辑的是当前登录用户，同步更新顶部栏
    if (nextItem.userId === currentUserId) {
      patchStoredSessionUserInfo({
        nickName: nextItem.nickName,
        avatar: nextItem.avatar ?? null,
      })
    }
    setUsers((prev) => {
      const exists = prev.some((u) => u.userId === nextItem.userId)
      return exists
        ? prev.map((u) => (u.userId === nextItem.userId ? nextItem : u))
        : [...prev, nextItem]
    })
    setDrawerOpen(false)
  }

  const roleOptions = roles.map((r) => ({ label: r.roleName || r.roleCode, value: r.roleCode }))

  const columns: ColumnsType<AdminUserItem> = [
    {
      title: '头像',
      dataIndex: 'avatar',
      key: 'avatar',
      width: 64,
      render: (_: unknown, record: AdminUserItem) => <AvatarCell avatar={record.avatar} />,
    },
    { title: '登录名', dataIndex: 'userName', key: 'userName' },
    { title: '显示名', dataIndex: 'nickName', key: 'nickName' },
    {
      title: '角色',
      dataIndex: 'roleCode',
      key: 'roleCode',
      render: (code: string) => displayRoleName(code, roles.find((r) => r.roleCode === code)?.roleName),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (v: string) => v === 'enabled' ? <Tag color="success">启用</Tag> : <Tag>停用</Tag>,
    },
    {
      title: '创建时间',
      dataIndex: 'createTime',
      key: 'createTime',
      width: 160,
      render: (v: number) => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      fixed: 'right',
      render: (_: unknown, record: AdminUserItem) => {
        const isSelf = record.userId === currentUserId
        return (
          <Space size={4}>
            <Button size="small" type="primary" onClick={() => handleEdit(record)}>编辑</Button>
            {!isSelf && record.status === 'enabled' && (
              <Button size="small" onClick={() => handleDisable(record)}>禁用</Button>
            )}
            {!isSelf && (
              <Button size="small" danger onClick={() => handleDelete(record)}>删除</Button>
            )}
          </Space>
        )
      },
    },
  ]

  return (
    <div className="config-page">
      <section className="page-card">
        <PageSectionHeader
          description="管理后台管理员账号，设置登录凭证与角色。"
          actions={<Button type="primary" onClick={handleCreate}>新建用户</Button>}
        />
        <Table
          rowKey="userId"
          loading={loading}
          columns={columns}
          dataSource={users}
          pagination={false}
        />
      </section>

      <Drawer
        title={editingItem ? '编辑用户' : '新建用户'}
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
            name="userName"
            label="登录名"
            rules={[{ required: true, message: '请输入登录名' }]}
          >
            <Input placeholder="用于登录，创建后不可修改" disabled={!!editingItem} />
          </Form.Item>
          <Form.Item name="nickName" label="显示名">
            <Input placeholder="展示用的名称，默认同登录名" />
          </Form.Item>
          <Form.Item label="头像">
            <AvatarUpload value={avatarValue} uploading={uploading} onChange={setAvatarValue} onUploadingChange={setUploading} />
          </Form.Item>
          <Form.Item
            name="roleCode"
            label="角色"
            rules={[{ required: true, message: '请选择角色' }]}
          >
            <Select options={roleOptions} placeholder="选择角色" />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select options={[{ label: '启用', value: 'enabled' }, { label: '停用', value: 'disabled' }]} />
          </Form.Item>
          <Form.Item
            name="password"
            label={editingItem ? '新密码（留空则不修改）' : '密码'}
            rules={editingItem ? [] : [{ required: true, message: '请输入密码' }]}
          >
            <Input.Password placeholder={editingItem ? '留空则不修改密码' : '请设置登录密码'} />
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  )
}
