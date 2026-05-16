const { spawn } = require('node:child_process')
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

async function deployFunctions({ repoRoot, envId, jwtSecret }) {
  await run('npx', ['tcb', 'fn', 'deploy', '--all', '--force', '--yes'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      MODMIN_ENV_ID: envId,
      MODMIN_JWT_SECRET: jwtSecret,
    },
  })
}

module.exports = {
  run,
  syncCloudfunctionShared,
  deployFunctions,
}
