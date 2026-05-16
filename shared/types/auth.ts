export interface AdminUserInfo {
  userId: string
  userName: string
  nickName: string
  roleCode: string
  avatar?: { fileID: string; path: string; fullPath: string; name: string; contentType: string; size?: number } | null
}

export interface ClientSourceInfo {
  clientIp: string
  userAgent: string
}

export interface LoginRequestData {
  userName: string
  password: string
}

export interface LoginResult {
  ticket: string
  accessToken: string
  refreshToken: string
  expireTime: number
  userInfo: AdminUserInfo
  clientInfo?: ClientSourceInfo
}

export interface RefreshTokenResult {
  ticket: string
  accessToken: string
  refreshToken: string
  expireTime: number
  userInfo: AdminUserInfo
  clientInfo?: ClientSourceInfo
}

export interface CurrentUserResult {
  userInfo: AdminUserInfo
}

export interface ValidateSessionResult {
  valid: boolean
  expireTime: number
  userInfo: AdminUserInfo
}
