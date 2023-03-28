# custom-quill-editor

- 基于`Quill.js`的二次封装，支持压缩图片和自定义图片上传，包括点击 image 按钮上传图片、拖拽图片、剪切板粘贴图片；
- 修改上传到富文本上的本地图片为 Blob URL 形式， 避免默认的 base64 编码格式太长而增加文档的大小、降低加载速度等；
- 将 Blob 文件对象上传至 OSS 云存储对象后，用返回的 imgUrl 回调进行回显
- 在线地址： http://124.71.231.187/custom-quill-editor/

## 使用
### 组件中引入
```js
import CustomQuillEditor from '@/components/custom-quill-editor.vue'
```

### 模板中使用
```html
<custom-quill-editor
  v-model:content="html"
  :options="options"
  @change="handleChange"
  @blur="handleBlur"
  @focus="handleFocus"
  @ready="handleReady"
  @selection-change="handleSelectionChange"
/>
```

### 类型定义
```ts
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
```

### Props

| 名称 | 描述 | 类型 | 必选 | 默认值 |
| --- | --- | --- | --- | --- |
| content | 富文本内容（支持 v-model） | string | 是 | '' |
| options | 配置项 | IOptions | 是 | { imageHandler } |
| readOnly | 是否只读 | Boolean | 否 | false |


### Options配置项

```ts
options = {
  imageHandler
}

async function imageHandler(item: IImageItem, cb: Callback) {
  // item: 图片对象
  // cb: 回调函数，用于回显图片
  // 上传前可以先压缩图片
  const blob = await item.minify({
    maxWidth: 520, // 图片最大宽度, 默认 800
    maxHeight: 520, // 图片最大高度, 默认 800
    quality: 0.5 // 图片压缩质量, 默认 0.8
  })
  // 上传图片至 OSS 云存储对象
  const imgUrl = await uploadToOSS(blob)
  // 回显图片
  cb(imgUrl)
}
```

### Events

| 名称 | 描述 | 回调参数 |
| --- | --- | --- |
| change | 内容变化时触发 | content富文本内容 |
| blur | 失去焦点时触发 | editor实例 |
| focus | 获得焦点时触发 | editor实例 |
| ready | 初始化完成时触发 | editor实例 |
| selection-change | 选区变化时触发 | range选区对象（若为 null, 触发 blur 事件） |

<br />

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Type-Check, Compile and Minify for Production

```sh
npm run build
```

### Lint with [ESLint](https://eslint.org/)

```sh
npm run lint
```
