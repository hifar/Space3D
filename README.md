# Space3D Viewer

Space3D Viewer is a local desktop 3D model viewer built with Electron, BabylonJS, Vite, and Three.js.

[Read the Chinese README](README.zh-CN.md)

## Features
- Open local 3D models offline
- Supports `glb`, `gltf`, `obj`, `fbx`, and `stl`
- Drag and drop model files into the window
- Orbit, pan, zoom, and reset camera
- Toggle wireframe, background, grid, and shadows
- Shows basic model statistics and animation controls
- Can be packaged as a Windows EXE installer

## Tech Stack
- Electron for the desktop shell
- BabylonJS for rendering and most loaders
- Three.js FBXLoader for FBX support
- Vite for renderer bundling
- electron-builder for Windows packaging

## Project Structure
- `main.js` - Electron main process, window creation, menus, file picker
- `preload.js` - safe IPC bridge
- `renderer/index.html` - renderer entry page
- `src/viewer.js` - main viewer logic
- `vite.config.js` - renderer build config
- `package.json` - scripts, dependencies, and packaging config
- `agent_doc/overview.md` - internal project overview

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

## Build Windows EXE
Create the Windows installer package:

```bash
npm run build
```

The output will be placed in `dist/`.

## Notes
- The app is designed to run offline after installation.
- Local `file:` and `blob:` resources are allowed so embedded model textures can load correctly.
- FBX support is handled through Three.js because BabylonJS does not provide a native FBX loader in this setup.
