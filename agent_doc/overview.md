# Space3D 项目概览

## 项目目标
Space3D 是一个基于 Electron + BabylonJS 的本地 3D 模型查看器，支持离线运行和打包为 Windows EXE 安装程序。当前目标是：

- 本地打开 3D 模型文件
- 支持 GLB、GLTF、OBJ、FBX、STL
- 直接在桌面程序中查看、旋转、缩放、重置视角
- 支持打包成 EXE 安装包，离线可运行

## 技术栈
- Electron：桌面壳和主进程
- BabylonJS：3D 渲染与大部分模型加载
- Three.js：用于 FBXLoader 兼容 FBX 格式
- Vite：渲染器构建与打包
- electron-builder：Windows 安装包构建

## 代码结构

### 根目录
- `main.js`：Electron 主进程，创建窗口、菜单、文件打开对话框
- `preload.js`：安全桥接 `ipcRenderer` 到渲染器
- `vite.config.js`：渲染器构建配置，输出到 `app/`
- `package.json`：脚本、依赖和 electron-builder 配置
- `copy-babylon.js`：历史辅助脚本，目前主要项目已改为 Vite + ESM 方案，不是主流程依赖

### 渲染器
- `renderer/index.html`：渲染页面入口，包含工具栏、画布、信息面板、拖拽区域
- `src/viewer.js`：核心 3D 逻辑，负责场景、相机、灯光、网格、模型加载和 UI 交互

### 构建产物
- `app/`：Vite 构建后的前端静态资源，Electron 运行时加载这里的 `index.html`
- `dist/`：electron-builder 输出的 Windows 安装包

## 启动流程

### 开发运行
1. 运行 `npm run build:renderer`
2. Electron 加载 `app/index.html`
3. 在窗口中打开模型文件或拖拽文件到窗口

### 打包发布
1. 先执行 `npm run build:renderer`
2. 再执行 `npm run build`
3. 生成 Windows 安装包到 `dist/`

## 文件流转

### 模型打开路径
1. 用户通过菜单或按钮选择文件
2. `main.js` 通过 IPC 把路径发送给渲染器
3. `src/viewer.js` 根据扩展名决定加载器
4. BabylonJS 或 Three.js 解析模型并渲染到画布

### 格式处理
- `glb` / `gltf`：BabylonJS 原生 glTF 加载链路
- `obj`：BabylonJS OBJ loader
- `stl`：BabylonJS STL loader
- `fbx`：Three.js `FBXLoader` 读取后转换为 BabylonJS mesh

## 运行时行为
- 画布使用全窗口布局，尽量占满左侧显示区域
- 支持拖拽文件进入窗口加载
- 支持重置相机、切换线框、切换背景、显示/隐藏网格
- 为离线运行做了本地资源访问配置，避免 `file://` 和 `blob:` 资源被拦截

## 构建配置要点
- `vite.config.js` 将渲染器输出到 `app/`
- `main.js` 固定加载 `app/index.html`
- `electron-builder` 只打包 `main.js`、`preload.js` 和 `app/**/*`
- 支持的安装包格式为 Windows NSIS 安装程序

## 当前开发约定
- 继续新增 UI 时，优先放在 `renderer/index.html` 与 `src/viewer.js`
- 涉及窗口、菜单、系统对话框的逻辑放在 `main.js`
- 如果新增资源类型，先确认 Electron 的离线资源访问和 CSP 是否需要同步放开
- 新增构建步骤时，优先更新 `package.json` 的脚本和 `vite.config.js`

## 备注
当前项目已经具备一个可用的桌面查看器骨架，后续比较适合继续补充：

- 模型树 / 节点层级
- 材质面板
- 光照切换
- 截图导出
- 最近打开文件列表
- 更完善的 FBX 元数据和动画支持
