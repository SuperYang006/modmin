const { spawn, spawnSync } = require('node:child_process')
const path = require('node:path')
const fs = require('node:fs')

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', shell: false, ...options })
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${command} ${args.join(' ')} exited with ${code}`))
    })
  })
}

function normalizeCloudPath(input) {
  let p = String(input || '').trim()
  if (!p || p === '/' || p === '.') return '/'
  p = p.replace(/^\/+|\/+$/g, '')
  if (p.split('/').some((seg) => !seg || seg === '..' || !/^[a-zA-Z0-9_.\-]+$/.test(seg))) {
    return null
  }
  return `${p}/`
}

function verifyBasePathMatches(distDir, cloudPath) {
  const indexPath = path.join(distDir, 'index.html')
  if (!fs.existsSync(indexPath)) return `${indexPath} 不存在`

  const html = fs.readFileSync(indexPath, 'utf8')
  const matches = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map((m) => m[1])
  if (matches.length === 0) return null

  const distEntries = new Set(fs.readdirSync(distDir))
  const expectedSubDir = cloudPath === '/' ? null : cloudPath.replace(/\/$/, '')

  const wrong = []
  for (const p of matches) {
    if (!p.startsWith('/')) { wrong.push(p); continue }
    const firstSeg = p.split('/')[1] || ''
    if (expectedSubDir) {
      if (firstSeg !== expectedSubDir) wrong.push(p)
    } else if (!distEntries.has(firstSeg)) {
      wrong.push(p)
    }
  }
  if (wrong.length === 0) return null

  const actualPrefix = matches[0].startsWith('/') ? `/${matches[0].split('/')[1]}/` : './'
  const expectedDisplay = expectedSubDir ? `/${cloudPath}` : '/'
  return [
    `index.html 里的资源前缀为 "${actualPrefix}"，与目标目录 "${expectedDisplay}" 不匹配。`,
    `请修改 web-admin/.env.local 的 VITE_BASE_PATH=${expectedDisplay} 后重新构建。`,
    `示例不匹配资源：${wrong.slice(0, 3).join(', ')}`,
  ].join('\n')
}

async function buildWeb(repoRoot) {
  await run('npm', ['--prefix', 'web-admin', 'run', 'build'], { cwd: repoRoot })
}

async function deployWebHosting({ repoRoot, envId, cloudPath }) {
  const normalizedPath = normalizeCloudPath(cloudPath)
  if (!normalizedPath) {
    throw new Error('无效的静态托管目录路径')
  }

  const distDir = path.resolve(repoRoot, 'web-admin/dist')
  const mismatch = verifyBasePathMatches(distDir, normalizedPath)
  if (mismatch) {
    throw new Error(mismatch)
  }

  await run('npx', ['tcb', 'hosting', 'deploy', 'web-admin/dist', normalizedPath, '-e', envId], {
    cwd: repoRoot,
  })
}

function getHostingDomain(envId, repoRoot) {
  const result = spawnSync('npx', ['tcb', 'hosting', 'detail', '-e', envId], {
    cwd: repoRoot,
    encoding: 'utf8',
  })
  if (result.status !== 0) return null
  const match = (result.stdout || '').match(/Static website domain:\s*(https?:\/\/\S+)/i)
  return match ? match[1].replace(/\/$/, '') : null
}

module.exports = {
  normalizeCloudPath,
  verifyBasePathMatches,
  buildWeb,
  deployWebHosting,
  getHostingDomain,
}
