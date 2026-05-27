const { spawn } = require('node:child_process')
const path = require('node:path')
const fs = require('node:fs')
const { FUNCTION_NAMES } = require('./build-cloudbaserc.js')

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

function isRetryableDeployError(error) {
  const text = `${error?.message || ''}\n${error?.stdout || ''}\n${error?.stderr || ''}`
  return /ETIMEDOUT|FetchError|ECONNRESET|network\s+error|socket hang up|scf\.tencentcloudapi\.com/i.test(text)
}

async function deploySingleFunction({ repoRoot, envId, jwtSecret, functionName, maxAttempts = 3, logger = console }) {
  const args = ['tcb', 'fn', 'deploy', '--force', '--yes', functionName]
  const env = {
    ...process.env,
    MODMIN_ENV_ID: envId,
    MODMIN_JWT_SECRET: jwtSecret,
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      logger.log(`  → 开始部署函数：${functionName}（第 ${attempt}/${maxAttempts} 次）`)
      await runCapture('npx', args, { cwd: repoRoot, env, logger })
      logger.log(`  ✓ 函数部署完成：${functionName}`)
      return
    } catch (error) {
      if (!isRetryableDeployError(error) || attempt === maxAttempts) {
        throw error
      }
      const waitMs = attempt * 2000
      logger.warn(`  ! ${functionName} 第 ${attempt} 次部署失败，检测到可重试网络错误，${waitMs}ms 后重试`)
      await sleep(waitMs)
    }
  }
}

function syncCloudfunctionShared(repoRoot) {
  const sourceDir = path.join(repoRoot, 'cloudfunctions', 'shared')
  const functionRoot = path.join(repoRoot, 'cloudfunctions')
  const functionNames = fs
    .readdirSync(functionRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('modmin_'))
    .map((entry) => entry.name)

  const sourceFiles = fs
    .readdirSync(sourceDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.js'))
    .map((entry) => entry.name)

  for (const functionName of functionNames) {
    const targetDir = path.join(functionRoot, functionName, 'shared')
    fs.mkdirSync(targetDir, { recursive: true })

    for (const fileName of sourceFiles) {
      fs.copyFileSync(path.join(sourceDir, fileName), path.join(targetDir, fileName))
    }
  }

  return { functionCount: functionNames.length, fileCount: sourceFiles.length }
}

async function deployFunctions({ repoRoot, envId, jwtSecret, logger = console }) {
  for (const functionName of FUNCTION_NAMES) {
    await deploySingleFunction({ repoRoot, envId, jwtSecret, functionName, logger })
  }
}

module.exports = {
  run,
  runCapture,
  syncCloudfunctionShared,
  deployFunctions,
}
