import { ANALYTICS_ENABLED } from '../../../common/constant'

export function gtagRenderer(name, params: any = null) {
  if (!ANALYTICS_ENABLED) return

  try {
    electron.ipcRenderer.send('gtag', {
      name,
      params: {
        ...(params ?? {}),
        screen_w: window.screen?.width ?? null,
        screen_h: window.screen?.height ?? null,
        screen_dpr: window.devicePixelRatio
      }
    })
  } catch (err) {
    console.log('gtag error', err)
  }
}
