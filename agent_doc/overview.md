# Space3D 项目概览

## 项目目标
Space3D 是一个基于 Electron + BabylonJS 的本地 3D 模型查看器，支持离线运行和打包为 Windows EXE 安装程序。当前目标是：

- 本地打开 3D 模型文件
- 支持 GLB、GLTF、OBJ、FBX、STL
- 直接在桌面程序中查看、旋转、缩放、重置视角
- 支持打包成 EXE 安装包，离线可运行
- 支持中英文界面切换（默认英文）
- 支持文件后缀关联打开（双击/右键打开方式）

## 技术栈
- Electron：桌面壳和主进程
- BabylonJS：3D 渲染与大部分模型加载
- Three.js：用于 FBXLoader 兼容 FBX 格式
- Vite：渲染器构建与打包
- electron-builder：Windows 安装包构建

## 代码结构

### 根目录
- `main.js`：Electron 主进程，创建窗口、菜单、语言切换、文件打开对话框、文件关联启动参数处理
- `preload.js`：安全桥接 `ipcRenderer` 到渲染器（包含语言 API）
- `vite.config.js`：渲染器构建配置，输出到 `app/`
- `package.json`：脚本、依赖和 electron-builder 配置
- `copy-babylon.js`：历史辅助脚本，目前主要项目已改为 Vite + ESM 方案，不是主流程依赖

### 渲染器
- `renderer/index.html`：渲染页面入口，包含工具栏、语言选择器、画布、信息面板、拖拽区域
- `src/viewer.js`：核心 3D 逻辑，负责场景、双相机坐标 gizmo、本地坐标轴、模型加载、i18n 和 UI 交互

### 构建产物
- `app/`：Vite 构建后的前端静态资源，Electron 运行时加载这里的 `index.html`
- `dist/`：electron-builder 输出的 Windows 安装包

## 启动流程

### 开发运行
1. 运行 `npm run build:renderer`
2. Electron 加载 `app/index.html`
3. 在窗口中打开模型文件或拖拽文件到窗口
4. 可通过工具栏或菜单切换中英文界面

### 打包发布
1. 先执行 `npm run build:renderer`
2. 再执行 `npm run build`
3. 生成 Windows 安装包到 `dist/`
4. 安装后可使用文件关联打开模型

## 文件流转

### 模型打开路径
1. 用户通过菜单或按钮选择文件
2. `main.js` 通过 IPC 把路径发送给渲染器
3. `src/viewer.js` 根据扩展名决定加载器
4. BabylonJS 或 Three.js 解析模型并渲染到画布

### 文件关联打开路径
1. 用户在资源管理器双击模型文件或右键打开
2. Windows 将文件路径传给应用进程参数
3. `main.js` 单实例逻辑接收路径并分发到渲染器
4. `src/viewer.js` 执行同一套加载流程

### 语言切换路径
1. 用户在工具栏下拉或菜单 `View -> Language` 选择语言
2. 主进程更新语言状态并重建菜单
3. 主进程通过 IPC 通知渲染器同步语言
4. 渲染器即时刷新 UI 文案

### 格式处理
- `glb` / `gltf`：BabylonJS 原生 glTF 加载链路
- `obj`：BabylonJS OBJ loader
- `stl`：BabylonJS STL loader
- `fbx`：Three.js `FBXLoader` 读取后转换为 BabylonJS mesh

## 运行时行为
- 画布使用全窗口布局，尽量占满左侧显示区域
- 支持拖拽文件进入窗口加载
- 支持重置相机、切换线框、切换背景、显示/隐藏网格、显示/隐藏坐标轴
- 世界坐标 gizmo 使用角落叠加渲染，不被模型遮挡
- 本地坐标轴显示在模型包围盒中心
- 为离线运行做了本地资源访问配置，避免 `file://` 和 `blob:` 资源被拦截

## 构建配置要点
- `vite.config.js` 将渲染器输出到 `app/`
- `main.js` 固定加载 `app/index.html`
- `electron-builder` 只打包 `main.js`、`preload.js` 和 `app/**/*`
- 支持的安装包格式为 Windows NSIS 安装程序
- `fileAssociations` 注册了 `.glb/.gltf/.obj/.fbx/.stl`

## 当前开发约定
- 继续新增 UI 时，优先放在 `renderer/index.html` 与 `src/viewer.js`
- 涉及窗口、菜单、系统对话框的逻辑放在 `main.js`
- 如果新增资源类型，先确认 Electron 的离线资源访问和 CSP 是否需要同步放开
- 新增构建步骤时，优先更新 `package.json` 的脚本和 `vite.config.js`
- 所有新增 UI 文案必须同时维护 `en/zh` 词典键

## 备注
当前项目已经具备一个可用的桌面查看器骨架，后续比较适合继续补充：

- 模型树 / 节点层级
- 材质面板
- 光照切换
- 截图导出
- 最近打开文件列表
- 更完善的 FBX 元数据和动画支持

## 近期实现更新

### FBX 动画与纯骨骼
- FBX 不再仅导入静态顶点数据。渲染器使用 Three.js `AnimationMixer` 直接播放 `FBXLoader` 解析到的动画剪辑，并在每帧同步蒙皮网格顶点到 BabylonJS。
- 动画面板支持播放、暂停和切换；同一时间只允许一个动画播放，点击当前播放项可暂停，再次点击可继续。
- 当 FBX 只包含 Skeleton 而没有 Mesh 时，应用会生成圆柱骨段辅助体来显示骨骼动画。骨段使用前后深度颜色区分，关节球和骨段直径会跟随骨架显示比例同步变化；零长度骨段及其关节会隐藏，避免出现遗留小球。
- FBX 的 X/Y/Z 修正会应用到动画网格及骨骼辅助体，保持动画播放、姿态修正和显示同步。

### 视图、坐标与模型定位
- 工具栏新增 `X`、`Y`、`Z` 轴 90 度旋转按钮，支持 FBX、GLB、GLTF、OBJ、STL、PLY 等所有已支持格式。
- 非 FBX 格式由统一的模型变换根节点处理旋转；FBX 在顶点同步阶段应用对应变换。
- 每次旋转或 `Scale to Viewer` 后，模型包围盒会自动对齐为：水平中心位于世界原点，最低点位于地面。这使模型保持在网格中央并贴地。
- `Scale to Viewer` 当前采用非破坏性的视图适配策略：不再实际缩放模型或骨骼，而是执行居中贴地并重算相机距离，以获得合适的屏幕显示大小，避免骨骼变形或重复操作后漂移。
- 相机适配改为显式更新 ArcRotateCamera 目标点，确保旋转或适配后相机围绕模型当前包围盒中心旋转。

### 光照、背景、地面与阴影
- 工具栏提供背景和光照预设循环切换。背景预设包括 Blue、Studio、Graphite、Slate；为避免天空盒面接缝伪影，背景使用稳定的纯色清屏渲染。
- 光照预设包括 Studio、Soft、Side、Contrast，分别调整半球光强度、方向光方向和强度。
- 网格地面采用独立的阴影接收面与网格覆盖层：模型不接收自身阴影，仍可向地面投影；网格与阴影面在不同渲染层中绘制，避免透明重叠造成亮度划痕。
- 阴影目前保留基础方向光与 `ShadowGenerator` 配置，避免混用手动和自动正交阴影视锥导致投影消失。

### 拖拽打开与 Electron 兼容
- 拖拽打开已改用 Electron `webUtils.getPathForFile()` 获取本地路径，兼容 Electron 新版本中不再可靠的 `File.path`。
- 当拖入文件无法获取本地路径时，加载层会关闭并提示错误，避免界面持续显示 Loading。

### 界面与构建产物
- 工具栏新增 `Scale to Viewer`、Light、X/Y/Z 旋转等控件，并补齐中英文词典键。
- `npm run build:renderer` 会重新生成 `app/` 下的运行时页面和资源；发布前仍应先执行该构建，再执行 Electron 打包。
