# Space3D Viewer

Space3D Viewer is an offline desktop 3D model viewer built with Electron, BabylonJS, Vite, and Three.js.

[Read the Chinese README](README.zh-CN.md)

## Screenshot

![Space3D Viewer UI](assets/snapshot.png)

## Features
- Offline local model viewing
- Supported formats: `glb`, `gltf`, `obj`, `fbx`, `stl`
- Drag-and-drop model loading
- Camera controls: orbit, pan, zoom, reset
- Visual toggles: wireframe, sky background, grid, axis, shadows
- Axis system:
	- Corner world-axis gizmo (always visible overlay)
	- Local axis at model center
- Model info and animation controls
- File association support in Windows installer (double-click / Open with)
- UI language switching: English / Chinese (default: English)

## Tech Stack
- Electron for the desktop shell
- BabylonJS for rendering and most loaders
- Three.js FBXLoader for FBX support
- Vite for renderer bundling
- electron-builder for Windows packaging

## Project Structure
- `main.js`: Electron main process (window/menu/dialog/language/file-open integration)
- `preload.js`: safe IPC bridge for renderer APIs
- `renderer/index.html`: renderer UI layout
- `src/viewer.js`: viewer core logic (scene, loaders, i18n, gizmos)
- `vite.config.js`: renderer build config (`renderer/` -> `app/`)
- `package.json`: scripts, dependencies, and electron-builder config
- `agent_doc/overview.md`: internal architecture and development notes

## Development
Install dependencies first:

```bash
npm install
```

Build the renderer:

```bash
npm run build:renderer
```

Run the app in Electron:

```bash
npm start
```

Quick dev command (build renderer + run):

```bash
npm run dev
```

## Build Windows EXE
Create the Windows installer package:

```bash
npm run build
```

The output will be placed in `dist/`.

## Language
- Default language is **English**.
- You can switch language from:
	- Top toolbar language selector
	- App menu: `View -> Language`

## File Association
The installer registers these extensions: `.glb`, `.gltf`, `.obj`, `.fbx`, `.stl`.

After installation, you can open models by:
- double-clicking model files
- right-clicking and selecting Open with Space3D Viewer

## Notes
- The app is designed to run offline after installation.
- Local `file:` and `blob:` resources are allowed so embedded model textures can load correctly.
- FBX support is handled through Three.js because BabylonJS does not provide a native FBX loader in this setup.
