import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { App as AntdApp, ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import { App } from '@/app/App'
import { buildAntdTheme, useThemePreset, themeStore } from '@/theme'
import '@/styles/index.css'

if (import.meta.env.DEV) {
  ;(window as unknown as Record<string, unknown>).themeStore = themeStore
}

dayjs.locale('zh-cn')

function Root() {
  const preset = useThemePreset()
  return (
    <ConfigProvider locale={zhCN} theme={buildAntdTheme(preset)}>
      <AntdApp>
        <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <App />
        </HashRouter>
      </AntdApp>
    </ConfigProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
)
