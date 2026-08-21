# xuf-lka 特效预览

一个最小的特效预览界面（参考 https://yyeva.yy.com/ 的预览交互），用于加载并预览 `.lka` 特效文件，基于本仓库 `packages/xuf-lka` 的 `LkaPlayer` 渲染。

## 功能
- 打开 / 拖拽 `.lka` 文件加载
- 播放 / 暂停 / 重播 / 循环
- 帧进度条手动 seek
- 透明棋盘格开关 + 自定义背景色（预览透明通道）
- 展示尺寸 / 时长 / 帧率 / 总帧数

## 运行
```bash
cd projects/preview
pnpm install      # 或 npm install
pnpm dev          # 启动 Vite，自动打开浏览器
```
Vite 通过别名 `@xuf/lka` 直接引用 `packages/xuf-lka/src` 源码，无需先构建包。

## 已知阻塞（需先修复才能真正跑通）
当前 `packages/xuf-lka` 尚有几处遗留问题会影响运行：

1. **`parseLka` 依赖 `zlib.es`**：本 app 的 `package.json` 已声明该依赖；安装后即可解析 LKA 的 gzip JSON 块。
2. **`RenderTarget.swap()` 类型/构造不匹配**：`core/RenderTarget.ts` 的 `createTextureFrom` 给 `Texture` 传了 10 个参数并读取不存在的 `anisotropy`，`textures/DataTexture.ts`、`textures/VideoTexture.ts` 也有构造签名不一致。这些只在离屏 ping-pong（mask/blend）路径触发；纯图片图层预览不受影响，但整包 `tsc`/严格构建前需修正。

## 说明
- 渲染走的是重构后的 `LkaPlayer`（当前主链路使用临时 `imageShader`，覆盖图片图层）。mask/blend/hsbc、video/text/vector、grap 拾取等能力尚未接入，预览这些特效时会缺失或不显示。
- 进度条在播放过程中不实时回读当前帧（`LkaPlayer` 暂未对外暴露 `frameId`）；手动拖动可 seek。后续可在 `LkaPlayer` 增加 `getFrameId()` / `onFrame` 回调来同步。
