// 打包前清理旧的输出目录，避免残留产物导致文件锁或体积膨胀
import { rmSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const uiRoot = path.resolve(__dirname, '..')

// electron-builder.yml 中 directories.output 的目录名
const OUTPUT_DIR_NAMES = ['dist_build', 'dist_exe', 'dist_pkg', 'dist_verify']

for (const dirName of OUTPUT_DIR_NAMES) {
  const dirPath = path.join(uiRoot, dirName)
  if (existsSync(dirPath)) {
    try {
      rmSync(dirPath, { recursive: true, force: true })
      console.log(`[clean] removed ${dirPath}`)
    } catch (err) {
      // 文件被占用（如编辑器监视器）时无法删除，尝试仅清空 win-unpacked 下的 app.asar
      console.warn(`[clean] cannot remove ${dirPath}: ${err?.message ?? err}`)
      try {
        rmSync(path.join(dirPath, 'win-unpacked', 'resources', 'app.asar'), { force: true })
      } catch {}
    }
  }
}
