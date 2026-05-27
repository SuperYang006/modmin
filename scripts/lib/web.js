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

function runCapture(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { shell: false, ...options })
    let stdout = ''
    let stderr = ''
    const logger = options.logger || null

    function flushBufferedLines(factory, bufferRef, text) {
      bufferRef.value += text
      const parts = bufferRef.value.split(/\r?\n|\r/g)
      bufferRef.value = parts.pop() || ''
      for (const part of parts) {
        const line = part.trim()
        if (!line || !logger) continue
        factory(line)
      }
    }

    const stdoutBuffer = { value: '' }
    const stderrBuffer = { value: '' }

    child.stdout?.on('data', (chunk) => {
      const text = String(chunk)
      stdout += text
      process.stdout.write(text)
      flushBufferedLines((line) => logger?.log?.(line), stdoutBuffer, text)
    })

    child.stderr?.on('data', (chunk) => {
      const text = String(chunk)
      stderr += text
      process.stderr.write(text)
      flushBufferedLines((line) => logger?.warn?.(line), stderrBuffer, text)
    })

    child.on('error', reject)
    child.on('exit', (code) => {
      const trailingStdout = stdoutBuffer.value.trim()
      const trailingStderr = stderrBuffer.value.trim()
      if (trailingStdout && logger?.log) {
        logger.log(trailingStdout)
      }
      if (trailingStderr && logger?.warn) {
        logger.warn(trailingStderr)
      }
      if (code === 0) {
        resolve({ stdout, stderr })
        return
      }
      const error = new Error(`${command} ${args.join(' ')} exited with ${code}`)
      error.stdout = stdout
      error.stderr = stderr
      error.exitCode = code
      reject(error)
    })
  })
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isRetryableHostingError(error) {
  const text = `${error?.message || ''}\n${error?.stdout || ''}\n${error?.stderr || ''}`
  return /EPIPE|ETIMEDOUT|ECONNRESET|socket hang up|FetchError|File transfer in progress|cos\./i.test(text)
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

async function deployWebHosting({ repoRoot, envId, cloudPath, logger = console, maxAttempts = 3 }) {
  const normalizedPath = normalizeCloudPath(cloudPath)
  if (!normalizedPath) {
    throw new Error('无效的静态托管目录路径')
  }

  const distDir = path.resolve(repoRoot, 'web-admin/dist')
  const mismatch = verifyBasePathMatches(distDir, normalizedPath)
  if (mismatch) {
    throw new Error(mismatch)
  }

  const args = ['tcb', 'hosting', 'deploy', 'web-admin/dist', normalizedPath, '-e', envId]

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      logger.log(`  → 开始上传静态资源（第 ${attempt}/${maxAttempts} 次）`)
      await runCapture('npx', args, { cwd: repoRoot, logger })
      logger.log('  ✓ 静态资源上传完成')
      return
    } catch (error) {
      if (!isRetryableHostingError(error) || attempt === maxAttempts) {
        throw error
      }
      const waitMs = attempt * 2000
      logger.warn(`  ! 静态资源上传失败，检测到可重试网络错误，${waitMs}ms 后重试`)
      await sleep(waitMs)
    }
  }
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
