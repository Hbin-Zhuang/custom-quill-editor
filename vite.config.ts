import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
const inject = require('@rollup/plugin-inject')

// https://vitejs.dev/config/
export default defineConfig({
  // 匹配 nginx 子路径
  // dev环境: `/` 或者 `./`
  // build环境: 根目录: `./`, 子路径: `/custom-quill-editor/`
  base: process.env.NODE_ENV === 'production' ? '/custom-quill-editor/' : './',
  plugins: [
    vue(),
    vueJsx(),
    inject({
      'window.Quill': 'quill',
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
      // output: {
      //   globals: {
      //     quill: 'Quill',
      //   },
      // },
      // 排除打包构建的库
      // external: ['quill-image-resize-module']
    },
  },
})
