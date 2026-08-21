import {defineConfig} from 'vite'
import {resolve} from 'node:path'

// 预览应用直接引用 monorepo 内 xuf-lka 源码，无需先构建包
export default defineConfig({
  resolve: {
    alias: {
      '@xuf/lka': resolve(__dirname, '../../packages/xuf-lka/src/index.ts'),
    },
  },
  server: {
    open: true,
  },
})
