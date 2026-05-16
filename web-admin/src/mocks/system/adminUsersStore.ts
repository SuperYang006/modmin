import type { AdminUserItem, SaveAdminUserPayload } from '@/runtime/loader/adminUsers'

const adminUsersStore: AdminUserItem[] = [
  {
    userId: 'admin_user_001',
    userName: 'admin',
    nickName: '系统管理员',
    roleCode: 'role_super_admin',
    status: 'enabled',
    createTime: Date.now() - 7 * 24 * 60 * 60 * 1000,
  },
  {
    userId: 'admin_user_002',
    userName: 'operator',
    nickName: '运营小助手',
    roleCode: 'role_operator',
    status: 'enabled',
    createTime: Date.now() - 3 * 24 * 60 * 60 * 1000,
  },
]

let adminUserSequence = adminUsersStore.length

export function listAdminUsersFromStore(): AdminUserItem[] {
  return adminUsersStore
    .slice()
    .sort((a, b) => (a.createTime || 0) - (b.createTime || 0))
}

type UpsertResult = { item: AdminUserItem } | { error: { code: number; message: string } }

export function upsertAdminUserInStore(payload: SaveAdminUserPayload): UpsertResult {
  const userName = payload.userName.trim()
  const nickName = payload.nickName?.trim() || userName
  const roleCode = payload.roleCode?.trim() || 'role_operator'
  const status = payload.status === 'disabled' ? 'disabled' : 'enabled'
  const avatarProvided = Object.prototype.hasOwnProperty.call(payload, 'avatar')
  const avatar = payload.avatar ?? undefined

  if (payload.userId) {
    const index = adminUsersStore.findIndex((item) => item.userId === payload.userId)
    if (index < 0) {
      return { error: { code: 40404, message: '用户不存在' } }
    }
    const next: AdminUserItem = {
      ...adminUsersStore[index],
      userName,
      nickName,
      roleCode,
      status,
    }
    if (avatarProvided) {
      next.avatar = avatar ?? undefined
    }
    adminUsersStore[index] = next
    return { item: next }
  }

  if (!payload.password) {
    return { error: { code: 40001, message: '新增用户时密码不能为空' } }
  }
  if (adminUsersStore.some((item) => item.userName === userName)) {
    return { error: { code: 40901, message: '用户名已存在' } }
  }

  adminUserSequence += 1
  const next: AdminUserItem = {
    userId: `admin_user_mock_${adminUserSequence}`,
    userName,
    nickName,
    roleCode,
    status,
    createTime: Date.now(),
    avatar: avatar ?? undefined,
  }
  adminUsersStore.push(next)
  return { item: next }
}

export function removeAdminUserFromStore(userId: string): { ok: true } | { error: { code: number; message: string } } {
  const index = adminUsersStore.findIndex((item) => item.userId === userId)
  if (index < 0) {
    return { error: { code: 40404, message: '用户不存在' } }
  }
  adminUsersStore.splice(index, 1)
  return { ok: true }
}

export function disableAdminUserInStore(userId: string): { item: AdminUserItem } | { error: { code: number; message: string } } {
  const index = adminUsersStore.findIndex((item) => item.userId === userId)
  if (index < 0) {
    return { error: { code: 40404, message: '用户不存在' } }
  }
  const next: AdminUserItem = { ...adminUsersStore[index], status: 'disabled' }
  adminUsersStore[index] = next
  return { item: next }
}
