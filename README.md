# custom-quill-editor

- 基于`Quill.js`的二次封装，支持压缩图片和自定义图片上传，包括点击 image 按钮上传图片、拖拽图片、剪切板粘贴图片；
- 修改上传到富文本上的本地图片为 Blob URL 形式， 避免默认的 base64 编码格式太长而增加文档的大小、降低加载速度等；
- 将 Blob 文件对象上传至 OSS 云存储对象后，用返回的 imgUrl 回调进行回显
- 在线 demo： #TODO

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
