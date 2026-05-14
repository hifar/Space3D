# Space3D Viewer

Space3D Viewer 是一个本地离线运行的桌面 3D 模型查看器，基于 Electron、BabylonJS、Vite 和 Three.js 构建。

## 功能
- 离线打开本地 3D 模型文件
- 支持 `glb`、`gltf`、`obj`、`fbx`、`stl`
- 支持拖拽文件到窗口加载
- 支持旋转、平移、缩放和重置相机
- 支持切换线框、背景、网格和阴影
- 显示基础模型统计信息和动画控制
- 可打包为 Windows EXE 安装程序

## 技术栈
- Electron：桌面程序外壳
- BabylonJS：渲染与大部分模型加载
- Three.js：用于 FBXLoader，补足 FBX 支持
- Vite：渲染器构建工具
- electron-builder：Windows 打包工具

## 项目结构
- `main.js`：Electron 主进程，负责窗口、菜单、文件选择
- `preload.js`：安全的 IPC 桥接层
- `renderer/index.html`：渲染器入口页面
- `src/viewer.js`：核心查看器逻辑
- `vite.config.js`：渲染器构建配置
- `package.json`：脚本、依赖和打包配置
- `agent_doc/overview.md`：内部项目概览文档

## 开发运行
先安装依赖：

```bash
npm install
```

构建渲染器：

```bash
npm run build:renderer
```

启动桌面程序：

```bash
npm start
```

## 打包 Windows EXE
生成 Windows 安装包：

```bash
npm run build
```

输出会在 `dist/` 目录中。

## 说明
- 程序安装后可离线运行。
- 已放开本地 `file:` 和 `blob:` 资源访问，避免模型贴图加载失败。
- FBX 通过 Three.js 的 FBXLoader 处理，因为当前方案下 BabylonJS 没有原生 FBX 加载器。
