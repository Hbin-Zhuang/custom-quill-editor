import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import resolve from '@rollup/plugin-node-resolve';
const inject = require('@rollup/plugin-inject')

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueJsx(),
    inject({
      'window.Quill': 'quill'
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: true,
  },
  // 自定义生产环境构建选项
  build: {
    rollupOptions: {
      plugins: [
        resolve(),
      ],
      output: {
        globals: {
          quill: 'Quill',
          Quill: 'quill',
        }
      },
      // 确保外部化处理那些你不想打包进库的依赖
      external: ['quill', 'quill-image-resize-module']
    }
  },
})
