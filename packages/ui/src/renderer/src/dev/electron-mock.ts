/**
 * 纯浏览器调试辅助（dev only）：
 * 在 Electron 窗口外（例如直接用浏览器打开 vite dev server 的 5173 页面）时，
 * preload 不会运行，window.electron 不存在，导致渲染进程崩溃 / 页面空白。
 * 本模块在 dev 模式下注入一个最小可用 mock，让 UI 骨架与配置类页面能够渲染。
 * 注意：mock 不提供真实后端能力（任务运行、数据库、配置读写均需 Electron main 进程）。
 */

// 各 IPC channel 的默认返回值。只覆盖能让主要页面渲染的最小集合，
// 未列出的 channel 一律返回 null（页面需自行容错）。
const DEFAULT_INVOKE_RESULTS: Record<string, unknown> = {
  ping: 'pong',
  'get-os-platform': 'darwin',
  'check-update': null,
  'fetch-config-file-content': () => ({
    config: {
      'boss.json': {},
      'dingtalk.json': {},
      'llm.json': [],
      'common-job-condition-config.json': {},
      'target-company-list.json': []
    }
  }),
  'fetch-resume-content': () => ({ content: {} }),
  'list-resumes': () => [],
  'set-active-resume': () => [],
  'delete-resume': () => [],
  'parse-resume-docx': () => ({
    expectJob: '',
    content: {
      name: '',
      workYearDesc: '',
      expectJob: '',
      userDescription: '',
      expectSalary: ['', ''],
      geekWorkExpList: [],
      geekProjExpList: []
    }
  }),
  'choose-file': () => ({ canceled: true, filePaths: [] }),
  'read-storage-file': () => null,
  'get-auto-start-chat-record': () => [],
  'get-mark-as-not-suit-record': () => [],
  'get-company-library': () => [],
  'get-boss-library': () => [],
  'get-job-library': () => [],
  'get-match-report': () => [],
  'get-task-manager-list': () => [],
  'get-job-history-by-encrypt-id': () => [],
  'common-job-condition-config': () => ({}),
  'llm-config': () => [],
  'check-is-resume-content-valid': () => true,
  'check-if-llm-config-list-valid': () => true,
  'check-if-auto-remind-prompt-valid': () => true,
  'resume-content-enough-detect': () => true,
  'pre-enter-setting-ui': () => null,
  'send-feed-back-to-github-issue': () => null,
  'write-storage-file': () => null,
  'save-config-file-from-ui': () => null,
  'save-llm-config': () => null,
  'save-resume-content': () => null,
  'overwrite-auto-remind-prompt-with-default': () => null,
  'save-common-job-condition-config': () => null,
  'run-geek-auto-start-chat-with-boss': () => null,
  'stop-geek-auto-start-chat-with-boss': () => null,
  'run-read-no-reply-auto-reminder': () => null,
  'stop-read-no-reply-auto-reminder': () => null,
  'open-site-with-boss-cookie': () => null,
  'launch-bosszhipin-login-page-with-preload-extension': () => null,
  'kill-bosszhipin-login-page-with-preload-extension': () => null,
  'login-with-cookie-assistant': () => null,
  'check-boss-zhipin-cookie-file': () => false,
  'get-llm-config-for-test': () => null,
  'request-llm-for-test': () => ({ ok: false, message: 'browser mock: llm request unavailable' }),
  'setup-dependencies': () => null,
  'download-browser-with-downloader': () => null,
  'exit-app-immediately': () => null,
  'open-external-link': () => null,
  'gtag': () => null,
  'start-worker': () => null,
  'send-to-daemon': () => null
}

function makeMockElectron() {
  const ipcRenderer = {
    on: () => () => {},
    once: () => () => {},
    off: () => {},
    removeListener: () => {},
    removeAllListeners: () => {},
    send: () => {},
    sendSync: () => null,
    postMessage: () => {},
    invoke: async (channel, ...args) => {
      const entry = DEFAULT_INVOKE_RESULTS[channel]
      if (entry !== undefined) {
        return typeof entry === 'function' ? entry(...args) : entry
      }
      console.warn('[electron-mock] unhandled invoke channel:', channel)
      return null
    }
  }
  return {
    ipcRenderer,
    webFrame: { setZoomFactor: () => {}, getZoomFactor: () => 1 },
    process: {
      platform: 'darwin',
      versions: { electron: '39.2.7', node: '22.0.0', chrome: '140.0.0.0' },
      env: {},
      type: 'renderer',
      isMac: true,
      isWindows: false,
      isLinux: false
    }
  }
}

if (import.meta.env.DEV && !window.electron) {
  // 收集运行时错误（仅浏览器调试用），供 `window.__pageErrors()` 查询
  const g = window as unknown as { __pageErrors: () => string[] }
  const errs: string[] = []
  g.__pageErrors = () => errs
  window.addEventListener('error', (e) => {
    errs.push('ERR: ' + (e.error?.stack ?? e.message ?? String(e.error)))
  })
  window.addEventListener('unhandledrejection', (e) => {
    errs.push('REJ: ' + (e.reason?.stack ?? e.reason?.message ?? String(e.reason)))
  })

  window.electron = makeMockElectron() as unknown as typeof window.electron
  window.api = {}
  console.warn('[electron-mock] window.electron mock injected (browser dev only)')
}
