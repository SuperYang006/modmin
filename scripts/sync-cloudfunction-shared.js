#!/usr/bin/env node

const fs = require('node:fs')
const path = require('node:path')

const repoRoot = path.resolve(__dirname, '..')
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

console.log(`✓ synced shared cloudfunction files to ${functionNames.length} functions`)
