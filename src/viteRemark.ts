import type { Plugin as VitePlugin } from 'vite'
import type { Transformer } from 'unified'
import { RemarkPlugin } from './types'

declare module 'vite' {
  export interface Plugin {
    remarkTransform?: Transformer
  }
}

// Vite plugins can hook into Remark.
export function getViteRemark(plugins: readonly VitePlugin[]) {
  const viteRemarkPlugins = plugins.filter((p) => p.remarkTransform)
  return {
    // Remark plugins that run before all others.
    pre: <RemarkPlugin>{
      plugins: viteRemarkPlugins
        .filter((p) => p.enforce === 'pre')
        .map((p) => () => p.remarkTransform)
    },
    // Remark plugins that run after all others.
    post: <RemarkPlugin>{
      plugins: viteRemarkPlugins
        .filter((p) => p.enforce !== 'pre')
        .map((p) => () => p.remarkTransform)
    }
  }
}
