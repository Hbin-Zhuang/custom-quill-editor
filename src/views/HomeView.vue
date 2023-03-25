<script setup lang="ts" name="HomeView">
import CustomVueEditor from '../components/custom-quill-editor.vue'
import { ref } from 'vue'

const html = ref('')
const options: any = {
  imageHandler
}

async function imageHandler(item: any, callback: any) {
  console.log('自定义图片处理：', item)
  const blob = await item.minify()
  // const fileReader = new FileReader()
  // fileReader.onload = (e: any) => {
  //   callback(e.target.result)
  // }
  // fileReader.readAsDataURL(blob)

  // setTimeout(() => {
  //   callback('http://up.deskcity.org/pic_source/2f/f4/42/2ff442798331f6cc6005098766304e39.jpg')
  // }, 1000)
}

function handleReady(editor: any) {
  console.log('ready: ', editor)
}
function handleChange(content: string) {
  console.log('text-change', content)
}
function handleBlur(editor: any) {
  console.log('blur', editor)
}
function handleFocus(editor: any) {
  console.log('focus', editor)
}
function handleSelectionChange() {
  console.log('selection-change', arguments)
}
</script>

<template>
  <main class="home">
    <div class="editor-wrap">
      <custom-vue-editor :options="options" v-model:content="html" @change="handleChange" />
    </div>
  </main>
</template>

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
