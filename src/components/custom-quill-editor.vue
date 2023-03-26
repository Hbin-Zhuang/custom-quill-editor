<template>
  <div class="editor-wrap">
    <div id="editor"></div>
    <input ref="input" style="display: none" type="file" accept="image/*" @change="handleChooseFile" />
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
  // 占位图片前缀名
  const IMG_PREFIX = 'placeholder-img-'

  const { ctx } = getCurrentInstance() as any
  const props = defineProps({
    content: {
      type: String,
      default: '',
    },
    readOnly: {
      type: Boolean,
      default: false,
    },
    options: {
      type: Object,
      default: () => ({}),
    },
  })
  const emit = defineEmits(['update:content', 'change', 'blur', 'focus', 'selection-change', 'ready'])
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
      ['clean'],
    ]
  })

  onMounted(() => {
    nextTick(() => {
      initEditor()
    })
  })

  // ====== 公用方法 start ======
  const uuid = () => {
    const uuidTemplate = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'
    return uuidTemplate.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0,
        v = c == 'x' ? r : (r & 0x3) | 0x8
      return v.toString(16)
    })
  }
  // 获取图片的长度和宽度 (转 Blob 为 Blob URL)
  const handleGetFileSize = (file: File) => {
    return new Promise<any>(r => {
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
  // base64 转换为 blob
  const base64ToBlob = (base64: string) => {
    const results = /^data:([^;]+);base64,(.*)$/.exec(base64)
    if (results?.length === 3) {
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
  // 服务器图片地址转换为 blob
  const urlToBlob = (url: string) => {
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
  // 更新编辑器内容 (upload、drop、paste操作 都会触发该方法)
  const asyncResolveImages = async (promises: any) => {
    let uploadInfos = await Promise.all(promises)
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
  // 对上传图片进行压缩, 删除原先的占位图片
  const uploadItem = (item: any, cursorIndex: number) => {
    return new Promise(r => {
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
      // 没有配置自定义图片上传
      if (typeof imageHandler !== 'function') return r(null)

      const newItem = {
        ...item,
        minify: (options: any) => {
          return minify(item.blob, options)
        },
      }
      // 这里是调用在父组件传过来的已经定义好的方法 (子调用父方法)
      imageHandler(newItem, (url: string) => {
        if (cursorIndex !== -1) {
          // 先删除占位符图片
          delta.retain(cursorIndex).delete(1)
          const finalUrl = url || item.url
          if (finalUrl) {
            // 如果上传图片到oss成功 则插入
            // 图片显示支持的格式: 服务器返回的地址 / base64
            delta.insert({ image: finalUrl })
          }
        }
        r(delta)
      })
    })
  }
  // 压缩图片, 传 options 可以自定义压缩的宽高和质量
  const minify = (blob: Blob, options: any) => {
    return new Promise(resolve => {
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
  // ====== 公用方法 end ======

  watch(
    () => props.readOnly,
    () => {
      if (editor) {
        editor.enable(!props.readOnly)
      }
    }
  )
  // 同步 props.content
  const syncedContent = useVModel(props, 'content', emit, { passive: true })
  watch(
    () => syncedContent.value,
    newVal => {
      if (editor) {
        if (newVal !== _content.value) {
          _content.value = newVal
          editor.clipboard.dangerouslyPasteHTML(newVal, 'silent')
        }
      }
    }
  )
  // 初始化编辑器
  function initEditor() {
    editor = new Quill('#editor', {
      placeholder: props.options.placeholder || '请输入内容',
      theme: 'snow',
      readOnly: props.readOnly,
      modules: {
        clipboard: true,
        toolbar: toolbarOptions.value,
        // 图片裁剪
        imageResize: {
          modules: ['Resize', 'DisplaySize', 'Toolbar'],
        },
      },
    })
    _content.value = syncedContent.value
    editor.clipboard.dangerouslyPasteHTML(syncedContent.value, 'silent')
    handleImageMonitor()
    handleEventMonitor()
  }
  // 图片自定义操作监听器
  function handleImageMonitor() {
    // 1. 剪切板粘贴图片
    editor.clipboard.addMatcher('img', (_: any, delta: any) => {
      return handlePasteImages(delta)
    })
    // 2. drag拖拽 放置图片drop事件
    editor.root.addEventListener('drop', handleDrop, false)
    // 3. 点击富文本image toolbar 选择图片
    const toolbar = editor.getModule('toolbar')
    toolbar.addHandler('image', () => {
      ;(ctx.$refs.input as any).click()
    })
  }
  // 1. 编辑器插入占位图, 转粘贴的默认base64格式图片格式为Blob对象, 再更新编辑器内容, 将新的delta对象返回
  // 在 handleGetFileSize 方法中 用 createObjectURL 顺便生成了 Blob URL
  function handlePasteImages(delta: any) {
    // delta对象: 编辑器中的实时内容
    // ops: 编辑器中的实时内容的操作数组 operations
    const ops = delta.ops || []
    const newDelta = new Delta()
    const promises = ops
      .map((op: any) => {
        if (op.insert?.image) {
          // 插入编辑器中的图片, base64格式 / Blob对象
          const url = op.insert.image
          const item: any = {
            id: uuid(),
            attributes: { width: 100, height: 100, ...op.attributes },
          }
          const urlHandlers = [
            { regexp: /^file:\/\//, handler: () => Promise.resolve(null) }, // `file://` 开头
            { regexp: /^data:image\//, handler: () => Promise.resolve(base64ToBlob(url)) }, // base64格式 开头
            { regexp: /^https?:\/\//, handler: () => urlToBlob(url) }, // `http://`或者`https://` 开头
          ]
          const insertImage = (toBlobPromise: any, imageName = `/${IMG_PREFIX}${item.id}`) => {
            // imageName 为自定义字符串, 发送 http请求, 请求返回服务器图片进行显示（实际不存在）, 作为一个占位图, 定位到光标位置
            newDelta.insert({ image: imageName }, item.attributes)
            // 以 Blob 格式 返回
            return new Promise(resolve => {
              toBlobPromise().then((blob: Blob | null) => {
                if (!blob) return null

                item.blob = blob
                handleGetFileSize(item.blob).then(size => {
                  item.attributes = { ...item.attributes, ...size }
                  resolve(item)
                })
              })
            })
          }
          const promiseHandler = urlHandlers.find(({ regexp }) => regexp.test(url))!.handler
          if (urlHandlers[2].regexp.test(url)) {
            item.url = url
            // 匹配 `?`, 有则加 & 无则加 ? (`?` 是 searech param, `&` 是 传递的参数 &name=xxx)
            const pic = /\?/.test(url) ? `${url}&${IMG_PREFIX}${item.id}=` : `${url}?${IMG_PREFIX}${item.id}=`
            return insertImage(() => urlToBlob(url), pic)
          }

          return insertImage(promiseHandler)
        }

        return null
      })
      .filter(Boolean)

    setTimeout(() => {
      asyncResolveImages(promises)
    }, 0)

    return newDelta
  }
  // 2. 拖拽图片放置事件
  // 将拖入图片插入富文本, 生成uuid返回展示
  function handleDrop(e: any) {
    // 阻止默认行为 (有些浏览器会在新tab自动打开图片)
    e.preventDefault()
    // 数据传输对象包含文件对象
    if (e.dataTransfer?.files?.length) {
      if (document.caretRangeFromPoint) {
        const selection = document.getSelection()
        // 获取光标位置
        const range = document.caretRangeFromPoint(e.clientX, e.clientY)
        if (selection && range) {
          selection.setBaseAndExtent(range.startContainer, range.startOffset, range.startContainer, range.startOffset)
        }
      }
      const promises = Array.prototype.map.call(e.dataTransfer.files, (file: any) => {
        const type = Object.prototype.toString.call(file).slice(8, -1)
        let realFile = file
        if (type === 'DataTransferItem' && file.type.match(/^image\/(gif|jpe?g|a?png|svg|webp|bmp)/i)) {
          realFile = file.getAsFile()
        }
        if (realFile instanceof File) {
          return new Promise(resolve => {
            const item = {
              id: uuid(),
              blob: realFile,
              attributes: { width: 100, height: 100 },
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
  // 3. 点击image toolbar 选择图片
  // 先获取图片的宽高 (生成Blob URL), 再更新图片
  async function handleChooseFile(e: any) {
    console.log('选中的了文件：', e)
    const files = e.currentTarget.files || []
    if (files?.length) {
      const file = files[0]
      const size = await handleGetFileSize(file)
      const item = {
        id: uuid(),
        blob: file,
        attributes: { width: 100, height: 100, ...size },
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

  function getIndex() {
    const selection = editor.getSelection()
    const idx = selection ? selection.index : editor.getLength()
    return idx
  }
  // 事件触发监听器
  function handleEventMonitor() {
    editor.on('text-change', () => {
      _content.value = getContent()
      emit('change', _content.value)
    })
    editor.on('selection-change', (range: any) => {
      const emitMethod = range == null ? 'blur' : 'focus'
      emit(emitMethod, editor)

      emit('selection-change', range)
    })
    emit('ready', editor)
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
