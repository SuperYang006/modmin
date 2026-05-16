import cloudbase from '@cloudbase/js-sdk'

let tcbAppPromise: Promise<any> | null = null

function resolveAuth(app: any) {
  if (typeof app.auth === 'function') {
    return app.auth()
  }

  return app.auth
}

export async function getTcbApp() {
  if (!tcbAppPromise) {
    tcbAppPromise = (async () => {
      const env = import.meta.env.VITE_MODMIN_ENV_ID
      const region = import.meta.env.VITE_MODMIN_REGION

      if (!env) {
        throw new Error('VITE_MODMIN_ENV_ID is not configured')
      }

      return cloudbase.init({
        env,
        region,
      })
    })()
  }

  return tcbAppPromise
}

export async function signInWithCustomTicket(ticket: string) {
  const app = await getTcbApp()
  const auth = resolveAuth(app)

  if (!auth) {
    throw new Error('CloudBase Auth 初始化失败，未获取到 auth 实例')
  }

  if (typeof auth.signInWithCustomTicket !== 'function') {
    throw new Error('当前 CloudBase JS SDK 不支持 signInWithCustomTicket')
  }

  return auth.signInWithCustomTicket(() => Promise.resolve(ticket))
}
