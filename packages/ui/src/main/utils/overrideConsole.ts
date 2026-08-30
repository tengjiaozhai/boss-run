import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'
import dayjs from 'dayjs'

export default function overrideConsole() {
  const originConsoleLog = console.log.bind(console)
  const originConsoleWarn = console.warn.bind(console)
  const originConsoleError = console.error.bind(console)

  const runtimeFolderPath = path.join(os.homedir(), '.geekgeekrun')
  const logDirPath = path.join(runtimeFolderPath, 'log')
  if (!fs.existsSync(logDirPath)) {
    fs.mkdirSync(logDirPath, { recursive: true })
  }

  // 使用 appendFileSync 追加日志：写完立即关闭文件句柄，
  // 避免主进程与守护进程同时以追加模式持有同一文件时在 Windows 上触发 EPERM
  const appendLog = (filename: string, content: string) => {
    try {
      fs.appendFileSync(path.join(logDirPath, filename), content)
    } catch {
      // 日志写入失败不影响主流程
    }
  }

  console.log = (...args: any[]) => {
    const lineHead = `${dayjs().format('YYYY-MM-DD HH:mm:ss.SSS')} [log][PID=${process.pid}]`
    originConsoleLog(lineHead, ...args)
    appendLog(
      'log.log',
      [
        lineHead,
        args.map((arg) => {
          try {
            return JSON.stringify(arg)
          } catch (err) {
            return `[[${JSON.stringify(err?.toString())}]]`
          }
        })
      ].join(' ') + '\n'
    )
  }
  console.warn = (...args: any[]) => {
    const lineHead = `${dayjs().format('YYYY-MM-DD HH:mm:ss.SSS')} [warn][PID=${process.pid}]`
    originConsoleWarn(lineHead, ...args)
    appendLog(
      'warn.log',
      [
        lineHead,
        args.map((arg) => {
          try {
            return JSON.stringify(arg)
          } catch (err) {
            return `[[${JSON.stringify(err?.toString())}]]`
          }
        })
      ].join(' ') + '\n'
    )
  }
  console.error = (...args: any[]) => {
    const lineHead = `${dayjs().format('YYYY-MM-DD HH:mm:ss.SSS')} [warn][PID=${process.pid}]`
    originConsoleError(lineHead, ...args)
    appendLog(
      'error.log',
      [
        lineHead,
        args.map((arg) => {
          try {
            return JSON.stringify(arg)
          } catch (err) {
            return `[[${JSON.stringify(err?.toString())}]]`
          }
        })
      ].join(' ') + '\n'
    )
  }
}
