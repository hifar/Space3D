/**
 * src/viewer.js  –  Space3D Viewer renderer (ES Module, bundled by Vite)
 *
 * Formats:
 *   GLB / GLTF  –  BabylonJS GLTF2 loader (native)
 *   OBJ         –  BabylonJS OBJ loader (native)
 *   STL         –  BabylonJS STL loader (native)
 *   FBX         –  Three.js FBXLoader → vertex bridge → BabylonJS mesh
 */

import {
  Engine, Scene, ArcRotateCamera, HemisphericLight, DirectionalLight,
  ShadowGenerator, Vector3, Color3, Color4, MeshBuilder, VertexData,
  StandardMaterial, Mesh,
} from '@babylonjs/core';

import { GridMaterial } from '@babylonjs/materials/grid/gridMaterial';

import {
  SceneLoader,
} from '@babylonjs/core/Loading/sceneLoader';

// Register all loaders (GLTF2, OBJ, STL)
import '@babylonjs/loaders/glTF/index';
import '@babylonjs/loaders/OBJ/index';
import '@babylonjs/loaders/STL/index';

// Three.js for FBX
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

/* ─────────────────────────────────────────────
   DOM refs
───────────────────────────────────────────── */
const canvas        = document.getElementById('renderCanvas');
const welcomeEl     = document.getElementById('welcome');
const loadingEl     = document.getElementById('loading');
const errorEl       = document.getElementById('error-msg');
const fileLabelEl   = document.getElementById('file-label');
const animControls  = document.getElementById('anim-controls');
const btnWireframe  = document.getElementById('btn-wireframe');
const btnGrid       = document.getElementById('btn-grid');

const infoName      = document.getElementById('info-name');
const infoFormat    = document.getElementById('info-format');
const infoMeshes    = document.getElementById('info-meshes');
const infoVertices  = document.getElementById('info-vertices');
const infoMaterials = document.getElementById('info-materials');
const infoAnimations= document.getElementById('info-animations');

/* ─────────────────────────────────────────────
   BabylonJS engine & scene
───────────────────────────────────────────── */
const engine = new Engine(canvas, true, {
  preserveDrawingBuffer: true,
  stencil: true,
});

let scene           = null;
let currentMeshes   = [];
let wireframeOn     = false;
let bgDark          = true;
let gridOn          = true;
let shadowGenerator = null;
let gridMesh        = null;

/* ─────────────────────────────────────────────
   Create base scene
───────────────────────────────────────────── */
function createScene() {
  if (scene) scene.dispose();
  scene = new Scene(engine);
  scene.clearColor = new Color4(0.1, 0.1, 0.18, 1);

  const camera = new ArcRotateCamera('cam', -Math.PI / 2, Math.PI / 3, 10, Vector3.Zero(), scene);
  camera.attachControl(canvas, true);
  camera.lowerRadiusLimit = 0.01;
  camera.upperRadiusLimit = 5000;
  camera.wheelDeltaPercentage = 0.01;
  camera.minZ = 0.001;
  camera.maxZ = 100000;

  const hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0), scene);
  hemi.intensity = 0.6;

  const dir = new DirectionalLight('dir', new Vector3(-1, -2, -1), scene);
  dir.position = new Vector3(10, 20, 10);
  dir.intensity = 1.2;

  shadowGenerator = new ShadowGenerator(2048, dir);
  shadowGenerator.useBlurExponentialShadowMap = true;

  // Ground grid
  gridMesh = MeshBuilder.CreateGround('grid', { width: 20, height: 20 }, scene);
  const gridMat = new GridMaterial('gridMat', scene);
  gridMat.majorUnitFrequency = 5;
  gridMat.minorUnitVisibility = 0.3;
  gridMat.gridRatio = 1;
  gridMat.backFaceCulling = false;
  gridMat.mainColor = new Color3(0.1, 0.2, 0.4);
  gridMat.lineColor = new Color3(0.2, 0.4, 0.8);
  gridMat.opacity = 0.6;
  gridMesh.material = gridMat;
  gridMesh.receiveShadows = true;

  return scene;
}

createScene();
engine.runRenderLoop(() => { if (scene) scene.render(); });
window.addEventListener('resize', () => engine.resize());

/* ─────────────────────────────────────────────
   Load model dispatcher
───────────────────────────────────────────── */
async function loadModel(filePath) {
  showLoading(true);
  hideError();

  currentMeshes.forEach(m => m.dispose && m.dispose());
  currentMeshes = [];
  clearAnimControls();

  const fileName = filePath.replace(/\\/g, '/').split('/').pop();
  const ext      = fileName.split('.').pop().toLowerCase();

  fileLabelEl.textContent  = fileName;
  welcomeEl.classList.add('hidden');
  infoName.textContent     = fileName;
  infoFormat.textContent   = ext.toUpperCase();

  try {
    if (ext === 'fbx') {
      await loadFBX(filePath);
    } else {
      await loadBabylon(filePath, fileName, ext);
    }
    showLoading(false);
  } catch (err) {
    showLoading(false);
    showError('加载失败: ' + (err.message || err));
    console.error(err);
  }
}

/* ─────────────────────────────────────────────
   BabylonJS native loader (GLB/GLTF/OBJ/STL)
───────────────────────────────────────────── */
async function loadBabylon(filePath, fileName, ext) {
  const folder = 'file:///' + filePath.replace(/\\/g, '/').replace(fileName, '');

  const result = await SceneLoader.ImportMeshAsync('', folder, fileName, scene);
  currentMeshes = result.meshes;

  currentMeshes.forEach(m => {
    if (m.getTotalVertices() > 0) {
      shadowGenerator.addShadowCaster(m, true);
      m.receiveShadows = true;
    }
  });

  fitCamera(currentMeshes);
  adjustGrid(currentMeshes);
  applyWireframe(wireframeOn);

  const verts  = currentMeshes.reduce((s, m) => s + (m.getTotalVertices ? m.getTotalVertices() : 0), 0);
  const mats   = new Set(currentMeshes.map(m => m.material).filter(Boolean)).size;
  const anims  = (result.animationGroups || []).length;
  infoMeshes.textContent     = currentMeshes.filter(m => m.getTotalVertices && m.getTotalVertices() > 0).length;
  infoVertices.textContent   = verts.toLocaleString();
  infoMaterials.textContent  = mats;
  infoAnimations.textContent = anims;

  if (result.animationGroups && result.animationGroups.length > 0) {
    buildAnimControls(result.animationGroups);
    result.animationGroups[0].start(true);
  }
}

/* ─────────────────────────────────────────────
   FBX via Three.js → BabylonJS bridge
───────────────────────────────────────────── */
function loadFBX(filePath) {
  return new Promise((resolve, reject) => {
    const loader = new FBXLoader();
    // Convert windows path to file:// URL
    const url = 'file:///' + filePath.replace(/\\/g, '/');

    loader.load(
      url,
      (fbxObj) => {
        try {
          let totalVerts = 0;
          let meshCount  = 0;
          let matCount   = 0;

          fbxObj.traverse((child) => {
            if (!(child instanceof THREE.Mesh)) return;
            const geom = child.geometry;
            if (!geom) return;

            geom.computeVertexNormals();
            const posAttr = geom.getAttribute('position');
            if (!posAttr || posAttr.count === 0) return;

            const positions = Array.from(posAttr.array);
            const normAttr  = geom.getAttribute('normal');
            const normals   = normAttr ? Array.from(normAttr.array) : [];
            const uvAttr    = geom.getAttribute('uv');
            const uvs       = uvAttr ? Array.from(uvAttr.array) : [];
            const indexBuf  = geom.index;
            const indices   = indexBuf ? Array.from(indexBuf.array) : null;

            const babylonMesh = new Mesh('fbx_mesh_' + meshCount, scene);
            const vertexData  = new VertexData();
            vertexData.positions = positions;
            if (normals.length) vertexData.normals = normals;
            if (uvs.length)     vertexData.uvs     = uvs;
            if (indices)        vertexData.indices  = indices;
            vertexData.applyToMesh(babylonMesh);

            const mat = new StandardMaterial('fbx_mat_' + meshCount, scene);
            // Transfer basic color from Three material
            const threeMat = Array.isArray(child.material) ? child.material[0] : child.material;
            if (threeMat && threeMat.color) {
              mat.diffuseColor = new Color3(threeMat.color.r, threeMat.color.g, threeMat.color.b);
            }
            babylonMesh.material = mat;
            babylonMesh.material.wireframe = wireframeOn;

            // Apply Three.js transform
            const m4 = child.matrixWorld;
            babylonMesh.position.set(m4.elements[12], m4.elements[13], m4.elements[14]);

            shadowGenerator.addShadowCaster(babylonMesh, true);
            babylonMesh.receiveShadows = true;

            currentMeshes.push(babylonMesh);
            totalVerts += posAttr.count;
            meshCount++;
            matCount++;
          });

          fitCamera(currentMeshes);
          adjustGrid(currentMeshes);

          infoMeshes.textContent     = meshCount;
          infoVertices.textContent   = totalVerts.toLocaleString();
          infoMaterials.textContent  = matCount;
          infoAnimations.textContent = (fbxObj.animations && fbxObj.animations.length) || 0;

          if (fbxObj.animations && fbxObj.animations.length > 0) {
            infoAnimations.textContent = fbxObj.animations.length + ' (FBX动画需转换)';
          }

          resolve();
        } catch (e) {
          reject(e);
        }
      },
      undefined,
      reject
    );
  });
}

/* ─────────────────────────────────────────────
   Camera fit
───────────────────────────────────────────── */
function fitCamera(meshes) {
  const valid = meshes.filter(m => m.getBoundingInfo);
  if (!valid.length) return;

  let min = new Vector3( 1e9,  1e9,  1e9);
  let max = new Vector3(-1e9, -1e9, -1e9);

  valid.forEach(m => {
    try {
      m.computeWorldMatrix(true);
      const bi = m.getBoundingInfo();
      const lo = bi.boundingBox.minimumWorld;
      const hi = bi.boundingBox.maximumWorld;
      if (lo.x < min.x) min.x = lo.x;
      if (lo.y < min.y) min.y = lo.y;
      if (lo.z < min.z) min.z = lo.z;
      if (hi.x > max.x) max.x = hi.x;
      if (hi.y > max.y) max.y = hi.y;
      if (hi.z > max.z) max.z = hi.z;
    } catch (_) {}
  });

  const center = Vector3.Center(min, max);
  const size   = max.subtract(min);
  const radius = Math.max(size.x, size.y, size.z) * 1.2 || 10;

  const cam    = scene.activeCamera;
  cam.target   = center;
  cam.radius   = radius;
  cam.alpha    = -Math.PI / 2;
  cam.beta     = Math.PI / 3;
  cam.lowerRadiusLimit = radius * 0.01;
  cam.upperRadiusLimit = radius * 50;
}

/* ─────────────────────────────────────────────
   Grid adjustment
───────────────────────────────────────────── */
function adjustGrid(meshes) {
  if (!gridMesh) return;
  const valid = meshes.filter(m => m.getBoundingInfo);
  if (!valid.length) return;

  let minY = 1e9;
  let maxXZ = 0;
  valid.forEach(m => {
    try {
      m.computeWorldMatrix(true);
      const bi = m.getBoundingInfo();
      if (bi.boundingBox.minimumWorld.y < minY) minY = bi.boundingBox.minimumWorld.y;
      const dx = bi.boundingBox.maximumWorld.x - bi.boundingBox.minimumWorld.x;
      const dz = bi.boundingBox.maximumWorld.z - bi.boundingBox.minimumWorld.z;
      const d  = Math.max(dx, dz);
      if (d > maxXZ) maxXZ = d;
    } catch (_) {}
  });

  // Keep grid slightly below model base to prevent z-fighting shimmer.
  const epsilon = Math.max(maxXZ * 0.001, 0.01);
  gridMesh.position.y = Math.min(minY - epsilon, 0);
  const s = (maxXZ * 3) / 20;
  gridMesh.scaling.set(s || 1, 1, s || 1);
}

/* ─────────────────────────────────────────────
   Wireframe
───────────────────────────────────────────── */
function applyWireframe(on) {
  currentMeshes.forEach(m => {
    if (m.material) m.material.wireframe = on;
  });
}

/* ─────────────────────────────────────────────
   Animation controls
───────────────────────────────────────────── */
function buildAnimControls(groups) {
  animControls.innerHTML = '';
  groups.forEach((g, i) => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:6px;';
    const lbl = document.createElement('span');
    lbl.textContent = g.name || `动画 ${i + 1}`;
    lbl.style.cssText = 'flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;color:#aaa;';
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.style.cssText = 'padding:3px 8px;font-size:11px;';
    btn.textContent = i === 0 ? '⏸' : '▶';
    btn.dataset.playing = i === 0 ? '1' : '0';
    btn.addEventListener('click', () => {
      if (btn.dataset.playing === '1') { g.pause(); btn.textContent = '▶'; btn.dataset.playing = '0'; }
      else                             { g.start(true); btn.textContent = '⏸'; btn.dataset.playing = '1'; }
    });
    row.append(lbl, btn);
    animControls.appendChild(row);
  });
}

function clearAnimControls() {
  animControls.innerHTML = '<span style="color:#555;font-size:12px;">无动画</span>';
  infoMeshes.textContent = infoVertices.textContent = infoMaterials.textContent = infoAnimations.textContent = '-';
}

/* ─────────────────────────────────────────────
   UI helpers
───────────────────────────────────────────── */
function showLoading(on) { loadingEl.classList.toggle('visible', on); }
function showError(msg)  { errorEl.textContent = msg; errorEl.classList.add('visible'); setTimeout(() => errorEl.classList.remove('visible'), 6000); }
function hideError()     { errorEl.classList.remove('visible'); }

/* ─────────────────────────────────────────────
   Toolbar
───────────────────────────────────────────── */
document.getElementById('btn-open').addEventListener('click', async () => {
  const fp = await window.electronAPI.openFileDialog();
  if (fp) loadModel(fp);
});

document.getElementById('btn-reset').addEventListener('click', () => {
  if (currentMeshes.length) fitCamera(currentMeshes);
});

document.getElementById('btn-wireframe').addEventListener('click', () => {
  wireframeOn = !wireframeOn;
  btnWireframe.classList.toggle('active', wireframeOn);
  applyWireframe(wireframeOn);
});

document.getElementById('btn-bg').addEventListener('click', () => {
  bgDark = !bgDark;
  scene.clearColor = bgDark ? new Color4(0.1, 0.1, 0.18, 1) : new Color4(0.92, 0.92, 0.92, 1);
});

document.getElementById('btn-grid').addEventListener('click', () => {
  gridOn = !gridOn;
  btnGrid.classList.toggle('active', !gridOn);
  if (gridMesh) gridMesh.setEnabled(gridOn);
});

document.getElementById('btn-shadow').addEventListener('click', (e) => {
  const btn = e.currentTarget;
  const shadowsVisible = btn.dataset.on !== '0';
  if (shadowsVisible) {
    shadowGenerator.getShadowMap().renderList.length = 0;
    btn.dataset.on = '0'; btn.classList.add('active');
  } else {
    currentMeshes.forEach(m => { if (m.getTotalVertices && m.getTotalVertices() > 0) shadowGenerator.addShadowCaster(m, true); });
    btn.dataset.on = '1'; btn.classList.remove('active');
  }
});

/* ─────────────────────────────────────────────
   IPC from Electron menu
───────────────────────────────────────────── */
window.electronAPI.onLoadModel(fp => loadModel(fp));
window.electronAPI.onResetCamera(() => { if (currentMeshes.length) fitCamera(currentMeshes); });
window.electronAPI.onToggleWireframe(() => {
  wireframeOn = !wireframeOn;
  btnWireframe.classList.toggle('active', wireframeOn);
  applyWireframe(wireframeOn);
});
window.electronAPI.onToggleBackground(() => {
  bgDark = !bgDark;
  scene.clearColor = bgDark ? new Color4(0.1, 0.1, 0.18, 1) : new Color4(0.92, 0.92, 0.92, 1);
});

/* ─────────────────────────────────────────────
   Drag & Drop
───────────────────────────────────────────── */
const dropOverlay = document.getElementById('drop-overlay');
document.addEventListener('dragover',  e => { e.preventDefault(); dropOverlay.classList.add('visible'); });
document.addEventListener('dragleave', e => { if (!e.relatedTarget) dropOverlay.classList.remove('visible'); });
document.addEventListener('drop', e => {
  e.preventDefault();
  dropOverlay.classList.remove('visible');
  const file = e.dataTransfer.files[0];
  if (!file) return;
  const ext = file.name.split('.').pop().toLowerCase();
  if (!['glb','gltf','obj','fbx','stl'].includes(ext)) {
    showError('不支持的格式: .' + ext + '  (支持: GLB GLTF OBJ FBX STL)');
    return;
  }
  loadModel(file.path);
});
