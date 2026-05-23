import Vditor from 'vditor'

type VditorOptions = NonNullable<ConstructorParameters<typeof Vditor>[1]>

const TOOLBAR: VditorOptions['toolbar'] = [
  'headings',
  'bold',
  'italic',
  'strike',
  '|',
  'quote',
  'line',
  '|',
  'list',
  'ordered-list',
  'check',
  'outdent',
  'indent',
  '|',
  'code',
  'inline-code',
  'table',
  'link',
  'upload',
  '|',
  'undo',
  'redo',
  '|',
  'preview',
  'fullscreen',
  'outline',
]

export interface VditorConfig {
  value?: string
  placeholder?: string
  disabled?: boolean
  uploadHandler?: (files: File[]) => Promise<string | null>
  input?: (value: string) => void
  focus?: (value: string) => void
  blur?: (value: string) => void
  after?: () => void
}

export function createVditorOptions(cfg: VditorConfig): VditorOptions {
  const upload = cfg.uploadHandler
    ? { handler: cfg.uploadHandler as Exclude<VditorOptions['upload'], undefined>['handler'], max: 5 * 1024 * 1024 }
    : undefined

  return {
    mode: 'ir',
    value: cfg.value || '',
    lang: 'zh_CN',
    theme: 'classic',
    icon: 'ant',
    height: 'calc(100vh - 176px)',
    minHeight: 420,
    placeholder: cfg.placeholder || '请输入 Markdown 内容',
    toolbar: TOOLBAR,
    cache: { enable: false },
    toolbarConfig: { pin: false },
    preview: {
      mode: 'both',
      markdown: {
        codeBlockPreview: false,
      },
    },
    upload,
    input: cfg.input,
    focus: cfg.focus,
    blur: cfg.blur,
    after: cfg.after,
  }
}
