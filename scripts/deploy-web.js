#!/usr/bin/env node
// 交互式部署 web-admin/dist 到 CloudBase 静态托管。
// 用法：
//   npm run deploy:web                    # 交互选择目录
//   npm run deploy:web -- --path web/     # 跳过交互直接部署到指定目录
//   npm run deploy:web -- --path /        # 部署到根目录
//   npm run deploy:web -- --skip-build    # 跳过 npm run build:web（dist 已就绪时）
//   npm run deploy:web -- --dry-run       # 只构建+校验，不真正上传（用于排查）
//   npm run deploy:web -- --clean         # 上传前先清空目标目录（避免残留旧 hash 资源）

const { spawn, spawnSync } = require('node:child_process')
const readline = require('node:readline/promises')
const path = require('node:path')
const fs = require('node:fs')
const { stdin, stdout } = require('node:process')
const {
  normalizeCloudPath,
  verifyBasePathMatches,
  buildWeb,
  deployWebHosting,
  getHostingDomain,
} = require('./lib/web.js')

const ENV_ID = process.env.MODMIN_ENV_ID

if (!ENV_ID) {
  console.error('\n[错误] 缺少 MODMIN_ENV_ID 环境变量。')
  console.error('示例：MODMIN_ENV_ID=your-env-id npm run deploy:web\n')
  process.exit(1)
}

// 进程级兜底：任何阶段收到 SIGINT 都干净退出，避免吃掉 Ctrl+C
process.on('SIGINT', () => {
  console.log('\n已取消')
  process.exit(130)
})

function parseArgs(argv) {
  const args = { path: null, skipBuild: false, dryRun: false, clean: false }
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--path' || a === '-p') {
      args.path = argv[i + 1]
      i += 1
    } else if (a === '--skip-build') {
      args.skipBuild = true
    } else if (a === '--dry-run') {
      args.dryRun = true
    } else if (a === '--clean') {
      args.clean = true
    }
  }
  return args
}

function listExistingDirs() {
  const result = spawnSync('npx', ['tcb', 'hosting', 'list', '-e', ENV_ID], {
    encoding: 'utf8',
  })
  if (result.status !== 0) {
    const stderr = (result.stderr || '').trim()
    const tail = stderr.split('\n').slice(-3).join('\n')
    return { dirs: [], error: tail || 'tcb hosting list 返回非 0 退出码', raw: result.stdout || '' }
  }

  const stdout = result.stdout || ''
  const dirs = new Set()
  let dataRowCount = 0

  // 主格式：表格行如 "│  1  │  modmin/index.html  │ ... │"
  for (const line of stdout.split('\n')) {
    const match = line.match(/│\s*\d+\s*│\s*([^│]+?)\s*│/)
    if (!match) continue
    dataRowCount += 1
    const key = match[1].trim()
    if (!key || key === 'Key') continue
    const firstSeg = key.split('/')[0]
    if (firstSeg && firstSeg !== key) dirs.add(firstSeg)
  }

  // 兜底格式：纯文本行（无表格符），形如 "modmin/index.html" 或 "  1  modmin/index.html"
  if (dataRowCount === 0) {
    for (const raw of stdout.split('\n')) {
      const line = raw.trim()
      if (!line || line.startsWith('-') || line.startsWith('npm warn')) continue
      const match = line.match(/(?:^|\s)([a-zA-Z0-9_.\-]+\/[\S]+)/)
      if (!match) continue
      const key = match[1]
      const firstSeg = key.split('/')[0]
      if (firstSeg && firstSeg !== key) dirs.add(firstSeg)
    }
  }

  return { dirs: [...dirs].sort(), error: null, raw: stdout, dataRowCount }
}

async function promptForCloudPath(dryRun) {
  const rl = readline.createInterface({ input: stdin, output: stdout })
  rl.on('SIGINT', () => {
    console.log('\n已取消')
    rl.close()
    process.exit(130) // 130 是 Ctrl+C 的标准退出码
  })

  async function ask(prompt) {
    const raw = await rl.question(prompt)
    if (raw === undefined) {
      // stdin 已关闭（如管道结束、Ctrl+D），按取消处理
      console.log('\n已取消')
      rl.close()
      process.exit(0)
    }
    return raw.trim()
  }

  console.log('\n正在读取静态托管现有目录...')
  const { dirs, error, raw, dataRowCount } = listExistingDirs()
  if (error) {
    console.warn('  ⚠ 读取目录列表失败，可能未登录或环境 ID 不正确：')
    console.warn(`    ${error}`)
    console.warn('  将仅提供"根目录"和"新建目录"两个选项。可先运行 `npm run tcb:login` 后重试。\n')
  } else if (dirs.length === 0) {
    const rawLineCount = (raw || '').split('\n').length
    console.warn(`  ⚠ 未识别到任何子目录（解析了 ${rawLineCount} 行原始输出，命中 ${dataRowCount || 0} 行数据行）`)
    console.warn(`  如果你的静态托管确实有内容，把下方命令的输出贴给开发者排查正则：`)
    console.warn(`    npx tcb hosting list -e ${ENV_ID}\n`)
  }

  console.log('请选择部署目标：')
  console.log('  0) 部署到根目录 /')
  dirs.forEach((d, i) => console.log(`  ${i + 1}) ${d}/`))
  console.log(`  ${dirs.length + 1}) 新建目录...`)

  const answer = await ask('\n输入序号: ')
  const index = Number(answer)
  let cloudPath = null

  if (index === 0) {
    cloudPath = '/'
  } else if (index >= 1 && index <= dirs.length) {
    cloudPath = `${dirs[index - 1]}/`
  } else if (index === dirs.length + 1) {
    const name = await ask('新目录名（如 admin、web）: ')
    cloudPath = normalizeCloudPath(name)
    if (!cloudPath) {
      console.error('[错误] 目录名无效，仅允许字母、数字、下划线、横线、点')
      rl.close()
      process.exit(1)
    }
  } else {
    console.error('[错误] 无效的序号')
    rl.close()
    process.exit(1)
  }

  const action = dryRun ? '[dry-run] 模拟部署' : '部署'
  const confirm = (await ask(`\n将${action} web-admin/dist → ${cloudPath}（envId=${ENV_ID}）。确认？(y/N) `)).toLowerCase()
  rl.close()
  if (confirm !== 'y' && confirm !== 'yes') {
    console.log('已取消')
    process.exit(0)
  }
  return cloudPath
}

function summarizeDist(distDir) {
  let fileCount = 0
  let totalBytes = 0
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.isFile()) {
        fileCount += 1
        totalBytes += fs.statSync(full).size
      }
    }
  }
  walk(distDir)
  return {
    fileCount,
    sizeKb: (totalBytes / 1024).toFixed(1),
    topLevel: fs.readdirSync(distDir).sort(),
  }
}

function buildAccessUrl(cloudPath) {
  const domain = getHostingDomain(ENV_ID, path.resolve(__dirname, '..'))
  if (!domain) return null
  if (cloudPath === '/') return `${domain}/`
  return `${domain}/${cloudPath}` // cloudPath 形如 "modmin/"，已带末尾斜杠
}

async function main() {
  const args = parseArgs(process.argv)

  let cloudPath = args.path ? normalizeCloudPath(args.path) : null
  if (args.path && !cloudPath) {
    console.error('[错误] --path 取值无效，仅允许字母、数字、下划线、横线、点')
    process.exit(1)
  }
  if (!cloudPath) cloudPath = await promptForCloudPath(args.dryRun)

  if (!args.skipBuild) {
    console.log('\n→ 构建前端')
    await buildWeb(path.resolve(__dirname, '..'))
  } else {
    const distPath = path.resolve(__dirname, '..', 'web-admin/dist')
    if (!fs.existsSync(distPath)) {
      console.error('[错误] --skip-build 模式下 web-admin/dist 不存在，请先构建')
      process.exit(1)
    }
  }

  const distDir = path.resolve(__dirname, '..', 'web-admin/dist')
  const mismatch = verifyBasePathMatches(distDir, cloudPath)
  if (mismatch) {
    console.error('\n[错误] base path 与部署目录不一致：')
    console.error(mismatch)
    process.exit(1)
  }

  if (args.dryRun) {
    const summary = summarizeDist(distDir)
    console.log(`\n→ [dry-run] 将上传 ${summary.fileCount} 个文件（${summary.sizeKb} KB）到静态托管 ${cloudPath}`)
    console.log(`  顶层条目：${summary.topLevel.join(', ')}`)
    if (args.clean) {
      console.log(`  --clean 已启用：上传前会先 tcb hosting delete ${cloudPath} --dir`)
    }
    const accessUrl = buildAccessUrl(cloudPath)
    if (accessUrl) console.log(`  将可通过访问：${accessUrl}`)
    console.log('  未真正调用 tcb hosting deploy，无任何远端写入。')
    return
  }

  if (args.clean) {
    if (cloudPath === '/') {
      console.warn('\n⚠ --clean 在根目录部署模式下被忽略（避免清掉同环境其它子站点）')
    } else {
      const cleanTarget = cloudPath.replace(/\/$/, '')
      console.log(`\n→ 清理目标目录 ${cloudPath}（避免残留旧 hash 资源）`)
      try {
        await run('npx', ['tcb', 'hosting', 'delete', cleanTarget, '--dir', '-e', ENV_ID])
      } catch (err) {
        // 目录不存在时 delete 会失败，这是正常的（首次部署），打印一行即可继续
        console.warn(`  忽略：${err.message}`)
      }
    }
  }

  console.log(`\n→ 上传到静态托管 ${cloudPath}`)
  await deployWebHosting({
    repoRoot: path.resolve(__dirname, '..'),
    envId: ENV_ID,
    cloudPath,
  })
  console.log(`\n✓ 部署完成：${cloudPath}`)
  const accessUrl = buildAccessUrl(cloudPath)
  if (accessUrl) {
    console.log(`  访问地址：${accessUrl}`)
    console.log(`  注：如果访问时资源没有正确加载，有可能是缓存问题，强制刷新浏览器/清除缓存即可。`)
  } else {
    console.log(`  注：未能自动获取静态托管域名。可手工在 CloudBase 控制台「静态托管」页查看。`)
  }
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
