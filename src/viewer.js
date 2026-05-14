/**
 * src/viewer.js  –  Space3D Viewer renderer (ES Module, bundled by Vite)
 *
 * Formats:
 *   GLB / GLTF  –  BabylonJS GLTF2 loader (native)
 *   OBJ         –  BabylonJS OBJ loader (native)
 *   STL         –  BabylonJS STL loader (native)
 *   FBX         –  Three.js FBXLoader → vertex bridge → BabylonJS mesh
 *   PLY         –  Three.js PLYLoader → BabylonJS mesh / point cloud
 */

import {
  Engine, Scene, ArcRotateCamera, HemisphericLight, DirectionalLight,
  ShadowGenerator, Vector3, Color3, Color4, MeshBuilder, VertexData,
  StandardMaterial, Mesh, TransformNode, FreeCamera, Viewport,
} from '@babylonjs/core';

import { GridMaterial } from '@babylonjs/materials/grid/gridMaterial';
import { SkyMaterial } from '@babylonjs/materials/sky/skyMaterial';

import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader';

// Register all loaders (GLTF2, OBJ, STL)
import '@babylonjs/loaders/glTF/index';
import '@babylonjs/loaders/OBJ/index';
import '@babylonjs/loaders/STL/index';

// Three.js for FBX
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';

/* ─────────────────────────────────────────────
   DOM refs
───────────────────────────────────────────── */
const canvas        = document.getElementById('renderCanvas');
const welcomeEl     = document.getElementById('welcome');
const loadingEl     = document.getElementById('loading');
const errorEl       = document.getElementById('error-msg');
const fileLabelEl   = document.getElementById('file-label');
const langSelectEl  = document.getElementById('lang-select');
const animControls  = document.getElementById('anim-controls');
const btnOpen       = document.getElementById('btn-open');
const btnReset      = document.getElementById('btn-reset');
const btnWireframe  = document.getElementById('btn-wireframe');
const btnBg         = document.getElementById('btn-bg');
const btnGrid       = document.getElementById('btn-grid');
const btnAxis       = document.getElementById('btn-axis');
const btnShadow     = document.getElementById('btn-shadow');

const welcomeSubtitleEl = document.getElementById('welcome-subtitle');
const welcomeFormatsEl = document.getElementById('welcome-formats');
const loadingTextEl = document.getElementById('loading-text');
const panelModelInfoEl = document.getElementById('panel-model-info');
const panelControlsEl = document.getElementById('panel-controls');
const panelAnimationsEl = document.getElementById('panel-animations');
const labelFilenameEl = document.getElementById('label-filename');
const labelFormatEl = document.getElementById('label-format');
const labelMeshesEl = document.getElementById('label-meshes');
const labelVerticesEl = document.getElementById('label-vertices');
const labelMaterialsEl = document.getElementById('label-materials');
const labelAnimationsEl = document.getElementById('label-animations');
const controlsHelpEl = document.getElementById('controls-help');
const animEmptyEl = document.getElementById('anim-empty');
const dropTextEl = document.getElementById('drop-text');

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

let scene            = null;
let mainCamera       = null;
let gizmoCamera      = null;
let currentMeshes    = [];
let wireframeOn      = false;
let skyboxOn         = true;
let gridOn           = true;
let axisOn           = true;
let shadowGenerator  = null;
let gridMesh         = null;
let skyboxMesh       = null;
let worldAxisRoot    = null;
let localAxisRoot    = null;
let currentLanguage  = 'en';
let fileLabelIsDefault = true;

const CAMERA_DEFAULT_ALPHA = Math.PI / 2;
const CAMERA_DEFAULT_BETA = Math.PI / 3;

const MAIN_LAYER_MASK = 0x0FFFFFFF;
const GIZMO_LAYER_MASK = 0x10000000;
const WORLD_AXIS_BASE_LENGTH = 1.2;
const LOCAL_AXIS_BASE_LENGTH = 1.0;

const i18n = {
  en: {
    btnOpen: '📂 Open',
    btnReset: '⟳ Reset',
    btnWireframe: '⬡ Wireframe',
    btnBackground: '◑ Background',
    btnGrid: '⊞ Grid',
    btnAxis: '⟂ Axis',
    btnShadows: '☀ Shadows',
    fileHint: 'Drop a file here or click Open',
    welcomeSubtitle: 'Drop a 3D model here, or click Open in the toolbar',
    welcomeFormats: 'Supported formats: GLB · GLTF · OBJ · FBX · STL · PLY',
    loading: 'Loading...',
    modelInfo: 'Model Info',
    controls: 'Controls',
    animations: 'Animations',
    filename: 'File',
    format: 'Format',
    meshes: 'Meshes',
    vertices: 'Vertices',
    materials: 'Materials',
    animationCount: 'Animations',
    controlsHelp: 'Left drag: Rotate<br/>Right drag: Pan<br/>Mouse wheel: Zoom<br/>Ctrl+O: Open file<br/>Ctrl+R: Reset view<br/>Ctrl+W: Wireframe<br/>Ctrl+B: Background<br/>Ctrl+G: Grid',
    noAnimations: 'No animations',
    dropText: 'Drop to load model',
    loadFailedPrefix: 'Load failed: ',
    unsupportedFormat: 'Unsupported format:',
    supportedFormats: 'Supported: GLB GLTF OBJ FBX STL PLY',
    unnamedAnimation: 'Animation',
    fbxAnimationNote: '(FBX animation requires conversion)',
  },
  zh: {
    btnOpen: '📂 打开文件',
    btnReset: '⟳ 重置视角',
    btnWireframe: '⬡ 线框',
    btnBackground: '◑ 背景',
    btnGrid: '⊞ 网格',
    btnAxis: '⟂ 坐标轴',
    btnShadows: '☀ 阴影',
    fileHint: '拖拽文件到窗口或点击"打开文件"',
    welcomeSubtitle: '拖拽3D模型文件到此处，或点击工具栏"打开文件"',
    welcomeFormats: '支持格式：GLB · GLTF · OBJ · FBX · STL · PLY',
    loading: '加载中...',
    modelInfo: '模型信息',
    controls: '操作说明',
    animations: '动画',
    filename: '文件名',
    format: '格式',
    meshes: '网格数',
    vertices: '顶点数',
    materials: '材质数',
    animationCount: '动画数',
    controlsHelp: '左键拖动：旋转<br/>右键拖动：平移<br/>滚轮：缩放<br/>Ctrl+O：打开文件<br/>Ctrl+R：重置视角<br/>Ctrl+W：线框模式<br/>Ctrl+B：切换背景<br/>Ctrl+G：切换网格',
    noAnimations: '无动画',
    dropText: '松开以加载模型',
    loadFailedPrefix: '加载失败: ',
    unsupportedFormat: '不支持的格式:',
    supportedFormats: '支持: GLB GLTF OBJ FBX STL PLY',
    unnamedAnimation: '动画',
    fbxAnimationNote: '(FBX动画需转换)',
  },
};

function t(key) {
  const dict = i18n[currentLanguage] || i18n.en;
  return dict[key] || key;
}

function applyLanguage(lang) {
  currentLanguage = lang === 'zh' ? 'zh' : 'en';
  document.documentElement.lang = currentLanguage === 'zh' ? 'zh-CN' : 'en';
  langSelectEl.value = currentLanguage;

  btnOpen.textContent = t('btnOpen');
  btnReset.textContent = t('btnReset');
  btnWireframe.textContent = t('btnWireframe');
  btnBg.textContent = t('btnBackground');
  btnGrid.textContent = t('btnGrid');
  btnAxis.textContent = t('btnAxis');
  btnShadow.textContent = t('btnShadows');

  if (fileLabelIsDefault) fileLabelEl.textContent = t('fileHint');
  welcomeSubtitleEl.textContent = t('welcomeSubtitle');
  welcomeFormatsEl.textContent = t('welcomeFormats');
  loadingTextEl.textContent = t('loading');
  panelModelInfoEl.textContent = t('modelInfo');
  panelControlsEl.textContent = t('controls');
  panelAnimationsEl.textContent = t('animations');
  labelFilenameEl.textContent = t('filename');
  labelFormatEl.textContent = t('format');
  labelMeshesEl.textContent = t('meshes');
  labelVerticesEl.textContent = t('vertices');
  labelMaterialsEl.textContent = t('materials');
  labelAnimationsEl.textContent = t('animationCount');
  controlsHelpEl.innerHTML = t('controlsHelp');
  if (animControls.children.length === 1 && animControls.firstElementChild?.id === 'anim-empty') {
    animEmptyEl.textContent = t('noAnimations');
  }
  dropTextEl.textContent = t('dropText');
}

async function initLanguage() {
  try {
    const lang = await window.electronAPI.getLanguage();
    applyLanguage(lang);
  } catch {
    applyLanguage('en');
  }
}

/* ─────────────────────────────────────────────
   Create base scene
───────────────────────────────────────────── */
function createScene() {
  if (scene) scene.dispose();
  scene = new Scene(engine);
  scene.clearColor = new Color4(0.55, 0.72, 0.95, 1);

  mainCamera = new ArcRotateCamera('mainCamera', CAMERA_DEFAULT_ALPHA, CAMERA_DEFAULT_BETA, 10, Vector3.Zero(), scene);
  mainCamera.attachControl(canvas, true);
  mainCamera.lowerRadiusLimit = 0.01;
  mainCamera.upperRadiusLimit = 5000;
  mainCamera.wheelDeltaPercentage = 0.01;
  mainCamera.minZ = 0.001;
  mainCamera.maxZ = 100000;
  mainCamera.layerMask = MAIN_LAYER_MASK;

  gizmoCamera = new FreeCamera('gizmoCamera', new Vector3(0, 0, -4), scene);
  gizmoCamera.layerMask = GIZMO_LAYER_MASK;
  gizmoCamera.minZ = 0.01;
  gizmoCamera.maxZ = 20;
  gizmoCamera.viewport = new Viewport(0.85, 0.03, 0.12, 0.12);

  scene.activeCameras = [mainCamera, gizmoCamera];

  const hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0), scene);
  hemi.intensity = 0.6;

  const dir = new DirectionalLight('dir', new Vector3(-1, -2, -1), scene);
  dir.position = new Vector3(10, 20, 10);
  dir.intensity = 1.2;

  shadowGenerator = new ShadowGenerator(2048, dir);
  shadowGenerator.useBlurExponentialShadowMap = true;

  createSkybox();
  createWorldAxisGizmo();
  createLocalAxes();

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
  gridMesh.setEnabled(gridOn);

  scene.onBeforeRenderObservable.add(syncWorldGizmoCamera);

  return scene;
}

function createSkybox() {
  skyboxMesh = MeshBuilder.CreateBox('skyBox', { size: 10000 }, scene);
  const skyMaterial = new SkyMaterial('skyMaterial', scene);
  skyMaterial.backFaceCulling = false;
  skyMaterial.turbidity = 8;
  skyMaterial.rayleigh = 2;
  skyMaterial.mieCoefficient = 0.005;
  skyMaterial.mieDirectionalG = 0.8;
  skyMaterial.luminance = 1.15;
  skyMaterial.useSunPosition = true;
  skyMaterial.sunPosition = new Vector3(150, 90, -120);
  skyboxMesh.material = skyMaterial;
  skyboxMesh.isPickable = false;
  skyboxMesh.infiniteDistance = true;
  skyboxMesh.setEnabled(skyboxOn);
}

function createAxisTripod(prefix, parent, length, layerMask) {
  const xAxis = MeshBuilder.CreateLines(prefix + 'X', {
    points: [Vector3.Zero(), new Vector3(length, 0, 0)],
  }, scene);
  xAxis.parent = parent;
  xAxis.color = new Color3(1, 0.25, 0.25);

  const yAxis = MeshBuilder.CreateLines(prefix + 'Y', {
    points: [Vector3.Zero(), new Vector3(0, length, 0)],
  }, scene);
  yAxis.parent = parent;
  yAxis.color = new Color3(0.3, 1, 0.3);

  const zAxis = MeshBuilder.CreateLines(prefix + 'Z', {
    points: [Vector3.Zero(), new Vector3(0, 0, length)],
  }, scene);
  zAxis.parent = parent;
  zAxis.color = new Color3(0.35, 0.6, 1);

  [xAxis, yAxis, zAxis].forEach(mesh => {
    mesh.isPickable = false;
    mesh.layerMask = layerMask;
    mesh.alwaysSelectAsActiveMesh = true;
    mesh.renderingGroupId = 2;
  });
}

function createWorldAxisGizmo() {
  worldAxisRoot = new TransformNode('worldAxisRoot', scene);
  createAxisTripod('worldAxis', worldAxisRoot, WORLD_AXIS_BASE_LENGTH, GIZMO_LAYER_MASK);
  worldAxisRoot.setEnabled(axisOn);
}

function createLocalAxes() {
  localAxisRoot = new TransformNode('localAxisRoot', scene);
  createAxisTripod('localAxis', localAxisRoot, LOCAL_AXIS_BASE_LENGTH, MAIN_LAYER_MASK);
  localAxisRoot.setEnabled(false);
}

function syncWorldGizmoCamera() {
  if (!axisOn || !mainCamera || !gizmoCamera || !worldAxisRoot) return;

  const mainForward = mainCamera.target.subtract(mainCamera.position);
  if (mainForward.lengthSquared() < 1e-8) return;

  const dir = mainForward.normalize();
  gizmoCamera.position.copyFrom(dir.scale(-4));
  gizmoCamera.setTarget(Vector3.Zero());
}

createScene();
initLanguage();
btnBg.classList.add('active');
btnGrid.classList.add('active');
btnAxis.classList.add('active');
engine.runRenderLoop(() => { if (scene) scene.render(); });
window.addEventListener('resize', () => engine.resize());

langSelectEl.addEventListener('change', async () => {
  const next = langSelectEl.value === 'zh' ? 'zh' : 'en';
  try {
    const applied = await window.electronAPI.setLanguage(next);
    applyLanguage(applied);
  } catch {
    applyLanguage(next);
  }
});

window.electronAPI.onSetLanguage((lang) => {
  applyLanguage(lang);
});

/* ─────────────────────────────────────────────
   Bounds helpers
───────────────────────────────────────────── */
function getModelBounds(meshes) {
  const valid = meshes.filter(m => m.getBoundingInfo && m.getTotalVertices && m.getTotalVertices() > 0);
  if (!valid.length) return null;

  const min = new Vector3( 1e9,  1e9,  1e9);
  const max = new Vector3(-1e9, -1e9, -1e9);

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

  return {
    min,
    max,
    center: Vector3.Center(min, max),
    size: max.subtract(min),
  };
}

/* ─────────────────────────────────────────────
   Load model dispatcher
───────────────────────────────────────────── */
async function loadModel(filePath) {
  showLoading(true);
  hideError();

  currentMeshes.forEach(m => m.dispose && m.dispose());
  currentMeshes = [];
  if (localAxisRoot) localAxisRoot.setEnabled(false);
  clearAnimControls();

  const fileName = filePath.replace(/\\/g, '/').split('/').pop();
  const ext      = fileName.split('.').pop().toLowerCase();

  fileLabelEl.textContent  = fileName;
  fileLabelIsDefault = false;
  welcomeEl.classList.add('hidden');
  infoName.textContent     = fileName;
  infoFormat.textContent   = ext.toUpperCase();

  try {
    if (ext === 'fbx') {
      await loadFBX(filePath);
    } else if (ext === 'ply') {
      await loadPLY(filePath);
    } else {
      await loadBabylon(filePath, fileName, ext);
    }
    showLoading(false);
  } catch (err) {
    showLoading(false);
    showError(t('loadFailedPrefix') + (err.message || err));
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
    if (m.getTotalVertices && m.getTotalVertices() > 0) {
      shadowGenerator.addShadowCaster(m, true);
      m.receiveShadows = true;
    }
  });

  fitCamera(currentMeshes);
  adjustGrid(currentMeshes);
  updateLocalAxes(currentMeshes);
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
            if (uvs.length)     vertexData.uvs = uvs;
            if (indices)        vertexData.indices = indices;
            vertexData.applyToMesh(babylonMesh);

            const mat = new StandardMaterial('fbx_mat_' + meshCount, scene);
            const threeMat = Array.isArray(child.material) ? child.material[0] : child.material;
            if (threeMat && threeMat.color) {
              mat.diffuseColor = new Color3(threeMat.color.r, threeMat.color.g, threeMat.color.b);
            }
            babylonMesh.material = mat;
            babylonMesh.material.wireframe = wireframeOn;

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
          updateLocalAxes(currentMeshes);

          infoMeshes.textContent     = meshCount;
          infoVertices.textContent   = totalVerts.toLocaleString();
          infoMaterials.textContent  = matCount;
          infoAnimations.textContent = (fbxObj.animations && fbxObj.animations.length) || 0;

          if (fbxObj.animations && fbxObj.animations.length > 0) {
            infoAnimations.textContent = `${fbxObj.animations.length} ${t('fbxAnimationNote')}`;
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

function loadPLY(filePath) {
  return new Promise((resolve, reject) => {
    const loader = new PLYLoader();
    const url = 'file:///' + filePath.replace(/\\/g, '/');

    loader.load(
      url,
      (geometry) => {
        try {
          geometry.computeVertexNormals();

          const posAttr = geometry.getAttribute('position');
          if (!posAttr || posAttr.count === 0) {
            throw new Error('PLY has no vertex positions');
          }

          const normalsAttr = geometry.getAttribute('normal');
          const colorAttr = geometry.getAttribute('color');
          const uvAttr = geometry.getAttribute('uv');
          const indexAttr = geometry.getIndex();

          const babylonMesh = new Mesh('ply_mesh_0', scene);
          const vertexData = new VertexData();
          vertexData.positions = Array.from(posAttr.array);

          if (normalsAttr) vertexData.normals = Array.from(normalsAttr.array);
          if (uvAttr) vertexData.uvs = Array.from(uvAttr.array);

          if (colorAttr) {
            const colors = [];
            const src = colorAttr.array;
            for (let i = 0; i < src.length; i += 3) {
              colors.push(src[i], src[i + 1], src[i + 2], 1.0);
            }
            vertexData.colors = colors;
          }

          if (indexAttr) {
            vertexData.indices = Array.from(indexAttr.array);
          } else {
            const indices = [];
            for (let i = 0; i < posAttr.count; i++) indices.push(i);
            vertexData.indices = indices;
          }

          vertexData.applyToMesh(babylonMesh);

          const mat = new StandardMaterial('ply_mat_0', scene);
          mat.diffuseColor = new Color3(0.85, 0.85, 0.9);
          mat.backFaceCulling = false;

          if (!indexAttr) {
            // Vertex-only PLY is treated as point cloud.
            mat.pointsCloud = true;
            mat.pointSize = 2.0;
            mat.disableLighting = true;
            mat.emissiveColor = new Color3(1, 1, 1);
          }

          babylonMesh.material = mat;
          babylonMesh.material.wireframe = wireframeOn;
          babylonMesh.receiveShadows = !!indexAttr;
          if (indexAttr) {
            shadowGenerator.addShadowCaster(babylonMesh, true);
          }

          currentMeshes.push(babylonMesh);

          fitCamera(currentMeshes);
          adjustGrid(currentMeshes);
          updateLocalAxes(currentMeshes);

          infoMeshes.textContent = '1';
          infoVertices.textContent = posAttr.count.toLocaleString();
          infoMaterials.textContent = '1';
          infoAnimations.textContent = '0';

          resolve();
        } catch (err) {
          reject(err);
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
  const bounds = getModelBounds(meshes);
  if (!bounds || !mainCamera) return;

  const radius = Math.max(bounds.size.x, bounds.size.y, bounds.size.z) * 1.2 || 10;

  mainCamera.target = bounds.center;
  mainCamera.radius = radius;
  mainCamera.alpha = CAMERA_DEFAULT_ALPHA;
  mainCamera.beta = CAMERA_DEFAULT_BETA;
  mainCamera.lowerRadiusLimit = radius * 0.01;
  mainCamera.upperRadiusLimit = radius * 50;
}

/* ─────────────────────────────────────────────
   Grid adjustment
───────────────────────────────────────────── */
function adjustGrid(meshes) {
  if (!gridMesh) return;
  const bounds = getModelBounds(meshes);
  if (!bounds) return;

  const maxXZ = Math.max(bounds.size.x, bounds.size.z);
  const epsilon = Math.max(maxXZ * 0.001, 0.01);

  gridMesh.position.y = Math.min(bounds.min.y - epsilon, 0);
  const scale = (maxXZ * 3) / 20;
  gridMesh.scaling.set(scale || 1, 1, scale || 1);
}

function updateLocalAxes(meshes) {
  if (!localAxisRoot) return;

  const bounds = getModelBounds(meshes);
  if (!bounds) {
    localAxisRoot.setEnabled(false);
    return;
  }

  const axisSize = Math.max(Math.max(bounds.size.x, bounds.size.y, bounds.size.z) * 0.12, 0.8);
  const axisScale = axisSize / LOCAL_AXIS_BASE_LENGTH;

  localAxisRoot.position.copyFrom(bounds.center);
  localAxisRoot.scaling.set(axisScale, axisScale, axisScale);
  localAxisRoot.setEnabled(axisOn);
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
    lbl.textContent = g.name || `${t('unnamedAnimation')} ${i + 1}`;
    lbl.style.cssText = 'flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;color:#aaa;';

    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.style.cssText = 'padding:3px 8px;font-size:11px;';
    btn.textContent = i === 0 ? '⏸' : '▶';
    btn.dataset.playing = i === 0 ? '1' : '0';

    btn.addEventListener('click', () => {
      if (btn.dataset.playing === '1') {
        g.pause();
        btn.textContent = '▶';
        btn.dataset.playing = '0';
      } else {
        g.start(true);
        btn.textContent = '⏸';
        btn.dataset.playing = '1';
      }
    });

    row.append(lbl, btn);
    animControls.appendChild(row);
  });
}

function clearAnimControls() {
  animControls.innerHTML = `<span style="color:#555;font-size:12px;" id="anim-empty">${t('noAnimations')}</span>`;
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
btnOpen.addEventListener('click', async () => {
  const fp = await window.electronAPI.openFileDialog();
  if (fp) loadModel(fp);
});

btnReset.addEventListener('click', () => {
  if (currentMeshes.length) fitCamera(currentMeshes);
});

document.getElementById('btn-wireframe').addEventListener('click', () => {
  wireframeOn = !wireframeOn;
  btnWireframe.classList.toggle('active', wireframeOn);
  applyWireframe(wireframeOn);
});

btnBg.addEventListener('click', () => {
  skyboxOn = !skyboxOn;
  btnBg.classList.toggle('active', skyboxOn);
  if (skyboxMesh) skyboxMesh.setEnabled(skyboxOn);
  scene.clearColor = skyboxOn ? new Color4(0.55, 0.72, 0.95, 1) : new Color4(0.14, 0.14, 0.18, 1);
});

btnGrid.addEventListener('click', () => {
  gridOn = !gridOn;
  btnGrid.classList.toggle('active', gridOn);
  if (gridMesh) gridMesh.setEnabled(gridOn);
});

btnAxis.addEventListener('click', () => {
  axisOn = !axisOn;
  btnAxis.classList.toggle('active', axisOn);
  if (worldAxisRoot) worldAxisRoot.setEnabled(axisOn);
  if (localAxisRoot) localAxisRoot.setEnabled(axisOn && currentMeshes.length > 0);
});

btnShadow.addEventListener('click', (e) => {
  const btn = e.currentTarget;
  const shadowsVisible = btn.dataset.on !== '0';
  if (shadowsVisible) {
    shadowGenerator.getShadowMap().renderList.length = 0;
    btn.dataset.on = '0';
    btn.classList.add('active');
  } else {
    currentMeshes.forEach(m => {
      if (m.getTotalVertices && m.getTotalVertices() > 0) {
        shadowGenerator.addShadowCaster(m, true);
      }
    });
    btn.dataset.on = '1';
    btn.classList.remove('active');
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
  skyboxOn = !skyboxOn;
  btnBg.classList.toggle('active', skyboxOn);
  if (skyboxMesh) skyboxMesh.setEnabled(skyboxOn);
  scene.clearColor = skyboxOn ? new Color4(0.55, 0.72, 0.95, 1) : new Color4(0.14, 0.14, 0.18, 1);
});

/* ─────────────────────────────────────────────
   Drag & Drop
───────────────────────────────────────────── */
const dropOverlay = document.getElementById('drop-overlay');
document.addEventListener('dragover', e => {
  e.preventDefault();
  dropOverlay.classList.add('visible');
});
document.addEventListener('dragleave', e => {
  if (!e.relatedTarget) dropOverlay.classList.remove('visible');
});
document.addEventListener('drop', e => {
  e.preventDefault();
  dropOverlay.classList.remove('visible');
  const file = e.dataTransfer.files[0];
  if (!file) return;
  const ext = file.name.split('.').pop().toLowerCase();
  if (!['glb', 'gltf', 'obj', 'fbx', 'stl', 'ply'].includes(ext)) {
    showError(`${t('unsupportedFormat')} .${ext} (${t('supportedFormats')})`);
    return;
  }
  loadModel(file.path);
});
