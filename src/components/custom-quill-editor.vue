<template>
  <div class="editor-wrap">
    <div id="editor"></div>
    <input
      ref="input"
      style="display: none"
      type="file"
      accept="image/*"
      @change="handleChooseFile"
    />
  </div>
</template>

<script setup lang="ts" name="CustomVueEditor">
import { ref, computed, watch, nextTick, onMounted, getCurrentInstance } from 'vue'
import { useVModel } from '@vueuse/core'
import Quill from 'quill'
import ImageResize from 'quill-image-resize-module'
import 'quill/dist/quill.core.css' // import styles
import 'quill/dist/quill.snow.css' // for snow theme
import 'quill/dist/quill.bubble.css' // for bubble theme

Quill.register('modules/imageResize', ImageResize)
const Delta = Quill.import('delta')
const IMG_PREFIX = 'placeholder-img-'

const { ctx } = getCurrentInstance() as any
const emit = defineEmits(['update:content', 'change', 'blur', 'focus', 'selection-change', 'ready'])

const props = defineProps({
  content: {
    type: String,
    default: ''
  },
  readOnly: {
    type: Boolean,
    default: false
  },
  options: {
    type: Object,
    default: () => ({})
  }
})
// 同步到value
const syncedContent = useVModel(props, 'content', emit, { passive: true })

let editor: any = null
const _content = ref('')

const toolbarOptions = computed(() => {
  return [
    ['bold', 'italic', 'underline', 'strike'],
    ['blockquote', 'code-block'],
    [{ font: [] }],
    [{ align: [] }],
    [{ color: [] }, { background: [] }],
    [{ header: [1, 2, 3, 4, 5, 6, false] }],
    [{ list: 'ordered' }, { list: 'bullet' }],
    [{ script: 'sub' }, { script: 'super' }],
    [{ indent: '-1' }, { indent: '+1' }],
    ['image'],
    ['clean']
  ]
})

watch(
  () => props.readOnly,
  () => {
    if (editor) {
      editor.enable(!props.readOnly)
    }
  }
)

watch(
  () => syncedContent.value,
  (newVal) => {
    if (editor) {
      if (newVal !== _content.value) {
        _content.value = newVal
        editor.clipboard.dangerouslyPasteHTML(newVal, 'silent')
      }
    }
  }
)

onMounted(() => {
  nextTick(() => {
    initEditor()
  })
})

function initEditor() {
  editor = new Quill('#editor', {
    placeholder: props.options.placeholder || '请输入内容',
    theme: 'snow',
    readOnly: props.readOnly,
    modules: {
      clipboard: true,
      toolbar: toolbarOptions.value,
      imageResize: {
        modules: ['Resize', 'DisplaySize', 'Toolbar']
      }
    }
  })
  _content.value = syncedContent.value
  editor.clipboard.dangerouslyPasteHTML(syncedContent.value, 'silent')
  handleImageMonitor()
  handleEventMonitor()
}

function getContent() {
  if (editor) {
    let content = editor.root.innerHTML
    if (content === '<p><br></p>') {
      content = ''
    }
    return content
  }
  return ''
}

function handleEventMonitor() {
  editor.on('text-change', () => {
    _content.value = getContent()
    emit('change', _content.value)
  })
  editor.on('selection-change', (range: any) => {
    if (range == null) {
      emit('blur', editor)
    } else {
      emit('focus', editor)
    }
    emit('selection-change', range)
  })
  emit('ready', editor)
}

function handleImageMonitor() {
  editor.clipboard.addMatcher('img', (_: any, delta: any) => {
    return handlePasteImages(delta)
  })
  editor.root.addEventListener('drop', handleDrop, false)
  const toolbar = editor.getModule('toolbar')
  toolbar.addHandler('image', () => {
    ;(ctx.$refs.input as any).click()
  })
}

function handleDrop(e: any) {
  e.preventDefault()
  if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
    if (document.caretRangeFromPoint) {
      const selection = document.getSelection()
      const range = document.caretRangeFromPoint(e.clientX, e.clientY)
      if (selection && range) {
        selection.setBaseAndExtent(
          range.startContainer,
          range.startOffset,
          range.startContainer,
          range.startOffset
        )
      }
    }
    const promises = Array.prototype.map.call(e.dataTransfer.files, (file: any) => {
      const type = Object.prototype.toString.call(file).slice(8, -1)
      let realFile = file
      if (
        type === 'DataTransferItem' &&
        file.type.match(/^image\/(gif|jpe?g|a?png|svg|webp|bmp)/i)
      ) {
        realFile = file.getAsFile()
      }
      if (realFile instanceof File) {
        return new Promise((resolve) => {
          const item = {
            id: uuid(),
            blob: realFile,
            attributes: { width: 100, height: 100 }
          }
          const idx = getIndex()
          const delta = new Delta()
          delta.retain(idx)
          delta.insert('\n')
          delta.insert({ image: `/${IMG_PREFIX}${item.id}` }, item.attributes)
          delta.insert('\n')
          editor.updateContents(delta)
          resolve(item)
        })
      }
      return null
    })
    asyncResolveImages(promises)
  }
}

function handlePasteImages(delta: any) {
  const ops: any = delta.ops || []
  const newDelta = new Delta()
  const promises = ops
    .map((op: any) => {
      if (op.insert && op.insert.image) {
        const url = op.insert.image
        const item: any = {
          id: uuid(),
          attributes: { width: 100, height: 100, ...op.attributes }
        }
        if (/^file:\/\//.test(url)) {
          newDelta.insert({ image: `/${IMG_PREFIX}${item.id}` }, item.attributes)
          return null
        } else if (/^data:image\//.test(url)) {
          // 处理Base64编码的图片 先插入一张占位图
          newDelta.insert({ image: `/${IMG_PREFIX}${item.id}` }, item.attributes)
          return new Promise((r: any) => {
            item.blob = base64ToBlob(url)
            handleGetFileSize(item.blob).then((size: any) => {
              item.attributes = { ...item.attributes, ...size }
              r(item)
            })
          })
        } else if (/^https?:\/\//.test(url)) {
          item.url = url
          const pic = /\?/.test(url)
            ? `${url}&${IMG_PREFIX}${item.id}=`
            : `${url}?${IMG_PREFIX}${item.id}=`
          newDelta.insert({ image: pic }, item.attributes)
          return new Promise((r: any) => {
            urlToBlob(url).then((blob: any) => {
              item.blob = blob
              handleGetFileSize(item.blob).then((size: any) => {
                item.attributes = { ...item.attributes, ...size }
                r(item)
              })
            })
          })
        }
      }
      return null
    })
    .filter(Boolean)
  setTimeout(() => {
    asyncResolveImages(promises)
  }, 0)
  return newDelta
}

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0,
      v = c == 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

function base64ToBlob(base64: string) {
  const results: any = /^data:([^;]+);base64,(.*)$/.exec(base64)
  if (results && results.length === 3) {
    const mineType = results[1]
    const value = results[2]
    const bytes = window.atob(value)
    const ab = new ArrayBuffer(bytes.length)
    const i8a = new Uint8Array(ab)
    for (let i = 0; i < bytes.length; i++) {
      i8a[i] = bytes.charCodeAt(i)
    }
    const blob = new Blob([ab], { type: mineType })
    return blob
  }
  return null
}

function urlToBlob(url: string) {
  return new Promise((r: any) => {
    const xhr = new XMLHttpRequest()
    xhr.open('get', url, true)
    xhr.responseType = 'blob'
    xhr.onload = function () {
      r(this.response)
    }
    xhr.onerror = function () {
      r(null)
    }
    xhr.send()
  })
}

function minify(blob: Blob, options: any) {
  return new Promise((resolve) => {
    const opt = { maxWidth: 800, maxHeight: 800, quality: 0.8, ...options }
    const maxWidth = opt.maxWidth
    const maxHeight = opt.maxHeight
    const quality = opt.quality
    const image = new Image()
    image.src = window.URL.createObjectURL(blob)
    image.onload = function () {
      // 等比显示宽高
      if (image.width > maxWidth) {
        image.height *= maxWidth / image.width
        image.width = maxWidth
      }
      if (image.height > maxHeight) {
        image.width *= maxHeight / image.height
        image.height = maxHeight
      }
      const canvas = document.createElement('canvas')
      canvas.width = image.width
      canvas.height = image.height
      const ctx = canvas.getContext('2d')
      let newBlob: any = null
      if (ctx) {
        ctx.drawImage(image, 0, 0, image.width, image.height)
        const base64URL = canvas.toDataURL(blob.type, quality)
        // base64ToBlob 不一定访问的到
        console.log('base64ToBlob: ', base64ToBlob)
        newBlob = base64ToBlob(base64URL)
      }
      window.URL.revokeObjectURL(image.src)
      resolve(newBlob)
    }
    image.onerror = function () {
      window.URL.revokeObjectURL(image.src)
      resolve(null)
    }
  })
}

function uploadItem(item: any, cursorIndex: number) {
  return new Promise((r: any) => {
    const delta = new Delta()
    if (!item || !item.blob) {
      if (cursorIndex !== -1) {
        // 删除掉占位符图片
        delta.retain(cursorIndex).delete(1)
        r(delta)
      }
      return
    }
    const imageHandler = props.options.imageHandler
    if (typeof imageHandler === 'function') {
      const newItem = {
        ...item,
        minify: (options: any) => {
          return minify(item.blob, options)
        }
      }
      imageHandler(newItem, (url: string) => {
        if (cursorIndex !== -1) {
          // 先删除占位符图片
          delta.retain(cursorIndex).delete(1)
          const finalUrl = url || item.url
          if (finalUrl) {
            // 如果上传图片到oss成功 则插入
            delta.insert({ image: finalUrl })
          }
        }
        r(delta)
      })
    } else {
      // 没有配置自定义图片上传
      r(null)
    }
  })
}

async function asyncResolveImages(promises: any) {
  console.log('promises: ', promises)
  let uploadInfos: any = await Promise.all(promises)
  uploadInfos = uploadInfos.filter(Boolean)
  console.log('uploadInfos: ', uploadInfos)
  // 根据图片ID 定位对应占位符图片的位置
  const findIndex = (id: string) => {
    const imgs = editor.root.getElementsByTagName('img')
    let idx = -1
    const reg = new RegExp(`${IMG_PREFIX}${id}`, 'i')
    for (const img of imgs) {
      if (reg.test(img.src)) {
        // 定位到对应ID的占位图的索引位置
        const blot = Quill.find(img)
        idx = editor.getIndex(blot)
        break
      }
    }
    return idx
  }
  for (const info of uploadInfos) {
    const idx = findIndex(info.id)
    const delta = await uploadItem(info, idx)
    if (delta) {
      editor.updateContents(delta)
    }
  }
}

function getIndex() {
  const selection = editor.getSelection()
  const idx = selection ? selection.index : editor.getLength()
  return idx
}

async function handleChooseFile(e: any) {
  console.log('选中的了文件：', e)
  const files = e.currentTarget.files || []
  if (files && files.length) {
    const file = files[0]
    const size = await handleGetFileSize(file)
    const item = {
      id: uuid(),
      blob: file,
      attributes: { width: 100, height: 100, ...size }
    }
    const idx = getIndex()
    const delta = new Delta()
      .retain(idx)
      .insert('\n')
      .insert({ image: `/${IMG_PREFIX}${item.id}` }, item.attributes)
      .insert('\n')
    editor.updateContents(delta)
    setTimeout(() => {
      const p = Promise.resolve(item)
      asyncResolveImages([p])
    }, 0)
  }
}

function handleGetFileSize(file: any) {
  return new Promise<any>((r: any) => {
    if (!file) {
      r(null)
      return
    }
    const url = window.URL.createObjectURL(file)
    const img = new Image()
    img.onload = function () {
      window.URL.revokeObjectURL(url)
      r({ width: img.width, height: img.height })
    }
    img.onerror = function () {
      window.URL.revokeObjectURL(url)
      r(null)
    }
    img.src = url
  })
}
</script>

<style scoped>
.editor-wrap,
#editor {
  width: 100%;
  height: 100%;
}
</style>

<style>
.ql-toolbar {
  text-align: left;
}
</style>
