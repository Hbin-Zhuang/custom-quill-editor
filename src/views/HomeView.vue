<template>
  <main class="home">
    <div class="editor-wrap">
      <custom-quill-editor v-model:content="html" :options="options" @change="handleChange" />
    </div>
  </main>
</template>

<script setup lang="ts" name="HomeView">
  import { ref } from 'vue'
  import CustomQuillEditor from '../components/custom-quill-editor.vue'
  // options 类型
  interface IOptions {
    placeholder?: string
    imageHandler: (item: IImageItem, cb: Callback) => void
  }
  // 回调函数 类型
  type Callback = (url: string) => void
  // 图片对象 类型
  interface IImageItem {
    id: string
    url?: string
    blob: Blob
    minify: (options?: IMinifyOpt) => Promise<Blob>
  }
  // 图片压缩参数 类型
  interface IMinifyOpt {
    maxWidth: number
    maxHeight: number
    quality: number
  }
  // 富文本内容
  const html = ref('')
  // 自定义图片处理
  const options: IOptions = {
    imageHandler,
  }
  // 自定义图片处理函数
  async function imageHandler(item: IImageItem, callback: Callback) {
    // minify(blob = 上传的文件, options = { maxWidth: 800, maxHeight: 800, quality: 0.8 }) 默认参数
    const blob = await item.minify()
    // 显示图片示例
    // const fileReader = new FileReader()
    // fileReader.onload = (e: ProgressEvent<FileReader>) => {
    //   callback(e.target!.result as string)
    // }
    // fileReader.readAsDataURL(blob)

    // TODO 将 blob 上传到 OSS/服务器 后, 获取到 imgUrl
    // callback(imgUrl)

    setTimeout(() => {
      callback('https://img1.baidu.com/it/u=780668329,2450662419&fm=253&fmt=auto&app=138&f=JPEG?w=750&h=500')
    }, 800)
  }
  // 富文本内容 change 事件
  function handleChange(content: string) {
    console.log('change', content)
  }
  // selection-change 事件
  function handleSelectionChange() {
    console.log('selection-change', arguments)
  }
  // blur 事件
  function handleBlur(editor: any) {
    console.log('blur', editor)
  }
  // focus 事件
  function handleFocus(editor: any) {
    console.log('focus', editor)
  }
  // ready 事件
  function handleReady(editor: any) {
    console.log('ready: ', editor)
  }
</script>

<style scoped>
  .home {
    width: 100%;
    height: 100vh;
  }

  .editor-wrap {
    width: 100%;
    height: 700px;
  }
</style>
