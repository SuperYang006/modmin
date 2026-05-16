export function displayRoleName(roleCode?: string, roleName?: string) {
  if (roleName) return roleName
  if (!roleCode) return '管理员'
  return roleCode
}
