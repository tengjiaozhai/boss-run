import { resolve, join } from 'path'
import { defineConfig, externalizeDepsPlugin, loadEnv } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'
import { presetUno, presetAttributify, presetIcons } from 'unocss'
import transformerDirective from '@unocss/transformer-directives'
import Replace from 'unplugin-replace/vite'
import { copyFileSync, mkdirSync, existsSync } from 'fs'

// 复制 default-storage-file 目录到输出目录
const copyStorageFilesPlugin = () => ({
  name: 'copy-storage-files',
  writeBundle(options) {
    const outDir = options.dir || 'out/main'
    const sourceDir = resolve(__dirname, '../geek-auto-start-chat-with-boss/default-storage-file')
    const targetDir = join(outDir, 'default-storage-file')
    
    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true })
    }
    
    copyFileSync(
      join(sourceDir, 'match-report-template.md'),
      join(targetDir, 'match-report-template.md')
    )
    copyFileSync(
      join(sourceDir, 'greeting-message-template.md'),
      join(targetDir, 'greeting-message-template.md')
    )
  }
})

process.env = { ...process.env, ...loadEnv(process.env.NODE_ENV!, process.cwd()) }
const mainPlugins = [
  externalizeDepsPlugin({
    exclude: [
      '@geekgeekrun/utils',
      'find-chrome-bin',
      '@geekgeekrun/launch-bosszhipin-login-page-with-preload-extension'
    ]
  }),
  copyStorageFilesPlugin(),
  Replace({
    delimiters: ['', ''],
    sourcemap: true,
    include: ['**/src/main/utils/gtag/Analytics.ts'],
    values: [
      {
        find: /<measurement_id>/g,
        replacement: process.env.VITE_APP_GTAG_MEASUREMENT_ID as string
      },
      {
        find: /<api_secret>/g,
        replacement: process.env.VITE_APP_GTAG_API_SECRET as string
      }
    ]
  })
]
const preloadPlugins = [externalizeDepsPlugin()]
const rendererPlugins = [
  vue(),
  UnoCSS({
    presets: [presetUno(), presetAttributify(), presetIcons()],
    transformers: [transformerDirective()]
  })
]
if (process.env.NODE_ENV) {
  ;[mainPlugins, preloadPlugins, rendererPlugins].forEach((pluginList) => {
    pluginList.push(
      Replace({
        delimiters: ['', ''],
        sourcemap: true,
        include: ['**'],
        values: [
          {
            find: /process.env.NODE_ENV/g,
            replacement: `'${process.env.NODE_ENV}'` as string
          }
        ]
      })
    )
  })
}

export default defineConfig({
  main: {
    define: {
      'globalThis.__GGR_CONFIG_DIR__': JSON.stringify(
        resolve(__dirname, '../geek-auto-start-chat-with-boss/config')
      )
    },
    build: {
      rollupOptions: {
        external: []
      },
      minify: process.env.NODE_ENV === 'development' ? undefined : 'terser',
      watch: process.env.NODE_ENV === 'development' ? {} : undefined
    },
    plugins: mainPlugins
  },
  preload: {
    plugins: preloadPlugins,
    build: {
      minify: process.env.NODE_ENV === 'development' ? undefined : 'terser',
      watch: process.env.NODE_ENV === 'development' ? {} : undefined
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: rendererPlugins,
    build: {
      minify: process.env.NODE_ENV === 'development' ? undefined : 'terser'
    }
  }
})
