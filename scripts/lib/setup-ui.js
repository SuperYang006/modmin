const readline = require('node:readline/promises')
const { stdin, stdout } = require('node:process')

function createSetupUI() {
  const rl = readline.createInterface({ input: stdin, output: stdout })
  const useColor = Boolean(stdout.isTTY)

  function color(text, code) {
    if (!useColor) return text
    return `\u001b[${code}m${text}\u001b[0m`
  }

  rl.on('SIGINT', () => {
    console.log('\n已取消')
    rl.close()
    process.exit(130)
  })

  function section(title) {
    console.log(`\n${color(`▌ ${title}`, '96')}`)
  }

  function header(title) {
    const banner = [
      '  ███╗   ███╗ ██████╗ ██████╗ ███╗   ███╗██╗███╗   ██╗',
      '  ████╗ ████║██╔═══██╗██╔══██╗████╗ ████║██║████╗  ██║',
      '  ██╔████╔██║██║   ██║██║  ██║██╔████╔██║██║██╔██╗ ██║',
      '  ██║╚██╔╝██║██║   ██║██║  ██║██║╚██╔╝██║██║██║╚██╗██║',
      '  ██║ ╚═╝ ██║╚██████╔╝██████╔╝██║ ╚═╝ ██║██║██║ ╚████║',
      '  ╚═╝     ╚═╝ ╚═════╝ ╚═════╝ ╚═╝     ╚═╝╚═╝╚═╝  ╚═══╝',
    ]
    console.log('')
    banner.forEach((line, index) => {
      const tone = index < 2 ? '96' : '36'
      console.log(color(line, tone))
    })
    console.log(color(`\n   ${title}`, '1'))
    console.log(color('   ───────────────────────────────────────────────', '90'))
  }

  function footer(lines = []) {
    console.log(`\n${color('┌──────────────────────────────────────────────────┐', '90')}`)
    lines.forEach((line) => console.log(`${color('│', '90')} ${line}`))
    console.log(color('└──────────────────────────────────────────────────┘', '90'))
  }

  function card(title, rows = []) {
    console.log(`\n${color('┌──────────────────────────────────────────────────┐', '90')}`)
    console.log(`${color('│', '90')} ${color(title, '1')}`)
    console.log(color('├──────────────────────────────────────────────────┤', '90'))
    rows.forEach((row) => console.log(`${color('│', '90')} ${row}`))
    console.log(color('└──────────────────────────────────────────────────┘', '90'))
  }

  function activity(label) {
    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
    let index = 0
    const start = Date.now()
    process.stdout.write('\n')
    const timer = setInterval(() => {
      const seconds = Math.floor((Date.now() - start) / 1000)
      process.stdout.write(`\r  ${color(frames[index % frames.length], '36')} ${label}（${seconds}s）`)
      index += 1
    }, 120)

    function stop(statusText, statusColor = '32') {
      clearInterval(timer)
      const seconds = Math.floor((Date.now() - start) / 1000)
      process.stdout.write(`\r  ${color('●', statusColor)} ${label}（${seconds}s）${statusText ? ` ${statusText}` : ''}\n`)
    }

    return {
      success: (text = '完成') => stop(text, '32'),
      fail: (text = '失败') => stop(text, '31'),
    }
  }

  function info(message) {
    console.log(`  ${color('→', '36')} ${message}`)
  }

  function success(message) {
    console.log(`  ${color('✓', '32')} ${message}`)
  }

  function skip(message) {
    console.log(`  ${color('•', '90')} ${message}`)
  }

  function warn(message) {
    console.log(`  ${color('⚠', '33')} ${message}`)
  }

  function error(message) {
    console.error(`\n${color('[失败]', '31')} ${message}`)
  }

  function kv(label, value) {
    const paddedLabel = `${label}`.padEnd(18, ' ')
    console.log(`  ${color('·', '36')} ${color(paddedLabel, '90')} ${value}`)
  }

  function divider() {
    console.log(`  ${color('────────────────────────────────', '90')}`)
  }

  function paragraph(lines = []) {
    lines.forEach((line) => console.log(`  ${line}`))
  }

  async function promptWithReuse(label, {
    existingValue = '',
    defaultValue = '',
    secret = false,
    formatter,
    description,
  } = {}) {
    const effectiveDefault = existingValue || defaultValue

    console.log('')
    console.log(`  ${color(label, '1')}`)
    if (description) {
      console.log(`  ${color(description, '90')}`)
    }
    if (existingValue) {
      const display = typeof formatter === 'function' ? formatter(existingValue) : existingValue
      console.log(`  ${color('当前值:', '33')} ${display}`)
      console.log(`  ${color('操作:', '90')} 回车复用 / 输入新值覆盖`)
    } else if (effectiveDefault) {
      console.log(`  ${color('默认值:', '90')} ${effectiveDefault}`)
      console.log(`  ${color('操作:', '90')} 回车接受默认值 / 输入新值覆盖`)
    }

    if (secret) {
      const hidden = await promptHidden('  >')
      return hidden || effectiveDefault
    }

    const answer = await rl.question('  > ')
    if (!answer.trim()) {
      return effectiveDefault
    }
    return answer.trim()
  }

  async function confirmReuse(label, {
    currentValue = '',
    description = '',
    defaultYes = true,
  } = {}) {
    console.log('')
    console.log(`  ${color(label, '1')}`)
    if (description) {
      console.log(`  ${color(description, '90')}`)
    }
    if (currentValue) {
      console.log(`  ${color('当前值:', '33')} ${currentValue}`)
    }
    console.log(`  ${color('操作:', '90')} 回车或输入 y 复用 / 输入 n 重新生成或覆盖`)
    return confirm('  >', { defaultYes })
  }

  async function promptHidden(question) {
    if (!stdin.isTTY) {
      const answer = await rl.question(`${question}: `)
      return answer.trim()
    }

    stdout.write(`${question}: `)
    let value = ''
    const wasRaw = stdin.isRaw

    return new Promise((resolve) => {
      function cleanup() {
        stdin.removeListener('data', onData)
        if (!wasRaw) {
          stdin.setRawMode(false)
        }
        stdout.write('\n')
      }

      function onData(chunk) {
        const input = chunk.toString('utf8')

        if (input === '\r' || input === '\n') {
          cleanup()
          resolve(value.trim())
          return
        }

        if (input === '\u0003') {
          cleanup()
          console.log('已取消')
          process.exit(130)
        }

        if (input === '\u007f') {
          if (value.length > 0) {
            value = value.slice(0, -1)
          }
          return
        }

        value += input
      }

      if (!wasRaw) {
        stdin.setRawMode(true)
      }
      stdin.resume()
      stdin.on('data', onData)
    })
  }

  async function prompt(question, { defaultValue = '', secret = false } = {}) {
    if (secret) {
      console.log('')
      const hidden = await promptHidden(question)
      return hidden || defaultValue
    }

    const suffix = defaultValue ? ` (${defaultValue})` : ''
    console.log('')
    const answer = await rl.question(`${question}${suffix}: `)
    if (!answer.trim()) {
      return defaultValue
    }
    return answer.trim()
  }

  async function confirm(question, { defaultYes = false } = {}) {
    const defaultValue = defaultYes ? 'y' : 'n'
    const answer = await prompt(question, { defaultValue })
    return ['y', 'yes'].includes(String(answer).trim().toLowerCase())
  }

  function close() {
    rl.close()
  }

  return {
    section,
    header,
    footer,
    card,
    activity,
    info,
    success,
    skip,
    warn,
    error,
    kv,
    divider,
    paragraph,
    promptWithReuse,
    confirmReuse,
    prompt,
    confirm,
    close,
  }
}

module.exports = {
  createSetupUI,
}
