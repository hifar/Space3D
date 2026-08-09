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
  StandardMaterial, Mesh, TransformNode, FreeCamera, Viewport, Quaternion,
} from '@babylonjs/core';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';

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
const btnFixX       = document.getElementById('btn-fix-x');
const btnFixZ       = document.getElementById('btn-fix-z');

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
let fbxAnimationState = null;

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
    btnFixX: '↻ X',
    btnFixZ: '↻ Z',
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
  },
  zh: {
    btnOpen: '📂 打开文件',
    btnReset: '⟳ 重置视角',
    btnWireframe: '⬡ 线框',
    btnBackground: '◑ 背景',
    btnGrid: '⊞ 网格',
    btnAxis: '⟂ 坐标轴',
    btnShadows: '☀ 阴影',
    btnFixX: '↻ X轴',
    btnFixZ: '↻ Z轴',
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
  btnFixX.textContent = t('btnFixX');
  btnFixZ.textContent = t('btnFixZ');

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
  shadowGenerator.bias       = 0.01;
  shadowGenerator.normalBias = 0.05;

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
engine.runRenderLoop(() => {
  updateFBXAnimation();
  if (scene) scene.render();
});
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
  fbxAnimationState = null;
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
      async (fbxObj) => {
        try {
          fbxObj.updateMatrixWorld(true);

          let totalVerts = 0;
          let meshCount  = 0;
          let matCount   = 0;

          const fbxDir = filePath.replace(/\\/g, '/').split('/').slice(0, -1).join('/');

          // Collect mesh nodes first; traverse is sync so we can't await inside it.
          const meshNodes = [];
          const bones = [];
          fbxObj.traverse((child) => {
            if (child instanceof THREE.Mesh) meshNodes.push(child);
            if (child instanceof THREE.Bone) bones.push(child);
          });
          const animatedMeshes = [];

          for (const child of meshNodes) {
            const geom = child.geometry?.clone();
            if (!geom) continue;

            const posAttr = geom.getAttribute('position');
            if (!posAttr || posAttr.count === 0) continue;

            // ── Coordinate system fix ────────────────────────────────────────
            // Three.js is right-handed; Babylon.js is left-handed.
            // Negate Z on positions so geometry ends up in Babylon world space.
            const positions = getFBXMeshPositions(child, posAttr);

            // Recompute normals AFTER position flip so they point the right way.
            geom.computeVertexNormals();
            const normAttr = geom.getAttribute('normal');
            let normals = [];
            if (normAttr) {
              const rawNorm = normAttr.array;
              normals = new Array(rawNorm.length);
              for (let i = 0; i < rawNorm.length; i += 3) {
                normals[i]     =  rawNorm[i];
                normals[i + 1] =  rawNorm[i + 1];
                normals[i + 2] = -rawNorm[i + 2];
              }
            }

            const uvAttr = geom.getAttribute('uv');
            const uvs = uvAttr ? Array.from(uvAttr.array) : [];

            // Reverse winding order to compensate for the Z-flip handedness change.
            const indexBuf = geom.index;
            let indices;
            if (indexBuf) {
              const src = indexBuf.array;
              indices = new Array(src.length);
              for (let i = 0; i < src.length; i += 3) {
                indices[i]     = src[i];
                indices[i + 1] = src[i + 2];
                indices[i + 2] = src[i + 1];
              }
            } else {
              indices = [];
              for (let i = 0; i < posAttr.count; i++) indices.push(i);
            }
            // ─────────────────────────────────────────────────────────────────

            const babylonMesh = new Mesh('fbx_mesh_' + meshCount, scene);
            const vertexData  = new VertexData();
            vertexData.positions = positions;
            if (normals.length) vertexData.normals = normals;
            if (uvs.length)     vertexData.uvs = uvs;
            vertexData.indices = indices;
            vertexData.applyToMesh(babylonMesh, true);

            const mat = new StandardMaterial('fbx_mat_' + meshCount, scene);
            const threeMat = Array.isArray(child.material) ? child.material[0] : child.material;
            await applyThreeMaterialToBabylonAsync(threeMat, mat, fbxDir);
            babylonMesh.material = mat;
            babylonMesh.material.wireframe = wireframeOn;

            shadowGenerator.addShadowCaster(babylonMesh, true);
            babylonMesh.receiveShadows = true;

            currentMeshes.push(babylonMesh);
            animatedMeshes.push({ source: child, target: babylonMesh, positionAttribute: posAttr });
            totalVerts += posAttr.count;
            meshCount++;
            matCount++;
          }

          const skeletonHelper = meshCount === 0 && bones.length > 0 ? createFBXSkeletonHelper(bones) : null;
          if (skeletonHelper) currentMeshes.push(...skeletonHelper.meshes);

          fitCamera(currentMeshes);
          adjustGrid(currentMeshes);
          updateLocalAxes(currentMeshes);

          infoMeshes.textContent     = meshCount;
          infoVertices.textContent   = totalVerts.toLocaleString();
          infoMaterials.textContent  = matCount;
          const clips = fbxObj.animations || [];
          infoAnimations.textContent = clips.length;

          const modelBounds = getModelBounds(currentMeshes);
          fbxAnimationState = {
            mixer: clips.length > 0 ? new THREE.AnimationMixer(fbxObj) : null,
            animatedMeshes,
            skeletonHelper,
            bones,
            center: modelBounds?.center || Vector3.Zero(),
            rotationX: 0,
            rotationZ: 0,
          };

          if (clips.length > 0) {
            const mixer = fbxAnimationState.mixer;
            const actions = clips.map(clip => mixer.clipAction(clip));
            buildFBXAnimControls(actions);
            actions[0].play();
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

function getFBXMeshPositions(source, positionAttribute) {
  const sourcePosition = new THREE.Vector3();
  const worldPosition = new THREE.Vector3();
  const positions = new Array(positionAttribute.count * 3);

  for (let index = 0; index < positionAttribute.count; index++) {
    sourcePosition.fromBufferAttribute(positionAttribute, index);
    if (source.isSkinnedMesh) {
      source.applyBoneTransform(index, worldPosition.copy(sourcePosition));
      source.localToWorld(worldPosition);
    } else {
      source.localToWorld(worldPosition.copy(sourcePosition));
    }
    const offset = index * 3;
    const corrected = correctFBXPoint(worldPosition.x, worldPosition.y, -worldPosition.z);
    positions[offset] = corrected.x;
    positions[offset + 1] = corrected.y;
    positions[offset + 2] = corrected.z;
  }

  return positions;
}

function getFBXSkeletonSegments(bones) {
  const segments = [];
  const start = new THREE.Vector3();
  const end = new THREE.Vector3();
  bones.forEach(bone => {
    if (!(bone.parent instanceof THREE.Bone)) return;
    bone.getWorldPosition(end);
    bone.parent.getWorldPosition(start);
    segments.push({
      start: correctFBXPoint(start.x, start.y, -start.z),
      end: correctFBXPoint(end.x, end.y, -end.z),
    });
  });
  return segments;
}

function createFBXSkeletonHelper(bones) {
  const segments = getFBXSkeletonSegments(bones);
  const averageLength = segments.reduce((sum, segment) => sum + Vector3.Distance(segment.start, segment.end), 0) / segments.length;
  const radius = Math.max(averageLength * 0.09, 0.015);
  const visuals = segments.map((segment, index) => {
    const bone = MeshBuilder.CreateCylinder(`fbx_bone_${index}`, {
      height: 1,
      diameter: radius * 2,
      tessellation: 8,
    }, scene);
    const joint = MeshBuilder.CreateSphere(`fbx_joint_${index}`, {
      diameter: radius * 2.5,
      segments: 8,
    }, scene);
    const material = new StandardMaterial(`fbx_bone_mat_${index}`, scene);
    material.specularColor = new Color3(0.15, 0.15, 0.15);
    bone.material = material;
    joint.material = material;
    bone.isPickable = joint.isPickable = false;
    bone.alwaysSelectAsActiveMesh = joint.alwaysSelectAsActiveMesh = true;
    return { bone, joint, material };
  });
  const helper = { visuals, meshes: visuals.flatMap(visual => [visual.bone, visual.joint]) };
  updateFBXSkeletonHelper(helper, bones);
  return helper;
}

function updateFBXAnimation() {
  if (!fbxAnimationState?.mixer || !scene) return;

  const { mixer } = fbxAnimationState;
  mixer.update(engine.getDeltaTime() / 1000);

  syncFBXModel();
}

function syncFBXModel() {
  if (!fbxAnimationState || !scene) return;
  const { animatedMeshes, skeletonHelper, bones } = fbxAnimationState;

  animatedMeshes.forEach(({ source, target, positionAttribute }) => {
    target.updateVerticesData('position', getFBXMeshPositions(source, positionAttribute));
    target.refreshBoundingInfo();
  });

  if (skeletonHelper) updateFBXSkeletonHelper(skeletonHelper, bones);
}

function correctFBXPoint(x, y, z) {
  if (!fbxAnimationState) return new Vector3(x, y, z);
  const center = fbxAnimationState.center;
  let correctedX = x - center.x;
  let correctedY = y - center.y;
  let correctedZ = z - center.z;

  for (let step = 0; step < fbxAnimationState.rotationX; step++) {
    [correctedY, correctedZ] = [-correctedZ, correctedY];
  }
  for (let step = 0; step < fbxAnimationState.rotationZ; step++) {
    [correctedX, correctedY] = [-correctedY, correctedX];
  }
  return new Vector3(correctedX + center.x, correctedY + center.y, correctedZ + center.z);
}

function updateFBXSkeletonHelper(helper, bones) {
  const segments = getFBXSkeletonSegments(bones);
  const center = fbxAnimationState?.center || Vector3.Zero();
  const depthScale = Math.max(...segments.map(segment => Math.abs(segment.start.z - center.z)), 1);
  segments.forEach((segment, index) => {
    const visual = helper.visuals[index];
    if (!visual) return;
    const direction = segment.end.subtract(segment.start);
    const length = direction.length();
    if (length < 1e-6) return;

    visual.bone.position.copyFrom(Vector3.Center(segment.start, segment.end));
    visual.bone.scaling.y = length;
    visual.bone.rotationQuaternion = visual.bone.rotationQuaternion || Quaternion.Identity();
    Quaternion.FromUnitVectorsToRef(Vector3.Up(), direction.scale(1 / length), visual.bone.rotationQuaternion);
    visual.joint.position.copyFrom(segment.end);

    const depth = Math.max(-1, Math.min(1, (visual.bone.position.z - center.z) / depthScale));
    visual.material.diffuseColor = depth >= 0
      ? new Color3(0.95, 0.32 + depth * 0.2, 0.1)
      : new Color3(0.1, 0.38 - depth * 0.12, 0.95);
  });
}

// Fetch a blob: or file: URL and convert it to a base64 data: URL via FileReader.
// This avoids canvas-taint security errors entirely.
async function urlToDataUrl(url) {
  if (!url) return null;
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const blob = await resp.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror   = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
}

// Canvas fallback – works when the image is loaded and the canvas is not tainted.
function imageToDataUrl(image) {
  if (!image) return null;
  try {
    const w = image.naturalWidth || image.videoWidth || image.width;
    const h = image.naturalHeight || image.videoHeight || image.height;
    if (!w || !h) return null;
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(image, 0, 0, w, h);
    return cv.toDataURL('image/png');
  } catch { return null; }
}

async function createBabylonTextureAsync(threeTexture, fbxDir) {
  if (!threeTexture) return null;

  let dataUrl = null;

  // 1. Fetch the source URL (blob: for embedded textures, file: for external) via FileReader.
  //    This is the most reliable method – no canvas taint, works for both embedded & external.
  const image = threeTexture.image;
  if (image) {
    const src = image.src || image.currentSrc || '';
    if (src) dataUrl = await urlToDataUrl(src);
    // 2. Canvas fallback if image is already fully decoded in memory.
    if (!dataUrl) dataUrl = imageToDataUrl(image);
  }

  // 3. External texture search: FBX directory + common texture sub-folder names.
  //    Handles textures in same dir, ./textures/, ./Textures/, etc.
  if (!dataUrl) {
    const raw = String(
      threeTexture.name ||
      threeTexture.userData?.filename ||
      threeTexture.sourceFile ||
      ''
    );
    const basename = raw.replace(/\\/g, '/').split('/').pop();
    if (basename && fbxDir) {
      const searchDirs = [
        fbxDir,
        fbxDir + '/textures',
        fbxDir + '/Textures',
        fbxDir + '/maps',
        fbxDir + '/tex',
        fbxDir + '/image',
        fbxDir + '/images',
      ];
      for (const dir of searchDirs) {
        dataUrl = await urlToDataUrl('file:///' + dir + '/' + basename);
        if (dataUrl) break;
      }
    }
  }

  if (!dataUrl) return null;

  const texture = new Texture(dataUrl, scene, false, false);
  if (threeTexture.repeat) {
    texture.uScale = threeTexture.repeat.x;
    texture.vScale = threeTexture.repeat.y;
  }
  if (threeTexture.offset) {
    texture.uOffset = threeTexture.offset.x;
    texture.vOffset = threeTexture.offset.y;
  }
  return texture;
}

async function applyThreeMaterialToBabylonAsync(threeMat, babylonMat, fbxDir) {
  if (!threeMat || !babylonMat) return;

  if (threeMat.color) {
    babylonMat.diffuseColor = new Color3(threeMat.color.r, threeMat.color.g, threeMat.color.b);
  }
  if (threeMat.emissive) {
    babylonMat.emissiveColor = new Color3(threeMat.emissive.r, threeMat.emissive.g, threeMat.emissive.b);
  }
  if (typeof threeMat.opacity === 'number') {
    babylonMat.alpha = threeMat.opacity;
  }

  const diffuseTex = await createBabylonTextureAsync(threeMat.map, fbxDir);
  if (diffuseTex) {
    babylonMat.diffuseTexture = diffuseTex;
    babylonMat.diffuseTexture.hasAlpha = !!threeMat.transparent;
    babylonMat.useAlphaFromDiffuseTexture = !!threeMat.transparent;
  }

  const opacityTex = await createBabylonTextureAsync(threeMat.alphaMap, fbxDir);
  if (opacityTex) babylonMat.opacityTexture = opacityTex;

  const emissiveTex = await createBabylonTextureAsync(threeMat.emissiveMap, fbxDir);
  if (emissiveTex) babylonMat.emissiveTexture = emissiveTex;

  const bumpTex = await createBabylonTextureAsync(threeMat.normalMap || threeMat.bumpMap, fbxDir);
  if (bumpTex) babylonMat.bumpTexture = bumpTex;

  babylonMat.backFaceCulling = threeMat.side !== THREE.DoubleSide;
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
  mainCamera.alpha  = CAMERA_DEFAULT_ALPHA;
  mainCamera.beta   = CAMERA_DEFAULT_BETA;
  mainCamera.lowerRadiusLimit = radius * 0.01;
  mainCamera.upperRadiusLimit = radius * 50;

  // Dynamically scale clipping planes to the model size.
  // Keeping maxZ/minZ ratio ≤ 50 000 preserves depth-buffer precision
  // and eliminates Z-fighting flicker on all model scales.
  mainCamera.minZ = Math.max(radius * 0.001, 0.01);
  mainCamera.maxZ = radius * 500;
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

function buildFBXAnimControls(actions) {
  animControls.innerHTML = '';
  actions.forEach((action, index) => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:6px;';

    const lbl = document.createElement('span');
    lbl.textContent = action.getClip().name || `${t('unnamedAnimation')} ${index + 1}`;
    lbl.style.cssText = 'flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;color:#aaa;';

    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.style.cssText = 'padding:3px 8px;font-size:11px;';
    btn.textContent = index === 0 ? '⏸' : '▶';
    btn.dataset.playing = index === 0 ? '1' : '0';

    btn.addEventListener('click', () => {
      if (btn.dataset.playing === '1') {
        action.paused = true;
        btn.textContent = '▶';
        btn.dataset.playing = '0';
      } else {
        action.paused = false;
        action.play();
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

function rotateFBXModel(axis) {
  if (!fbxAnimationState) return;
  if (axis === 'x') fbxAnimationState.rotationX = (fbxAnimationState.rotationX + 1) % 4;
  if (axis === 'z') fbxAnimationState.rotationZ = (fbxAnimationState.rotationZ + 1) % 4;
  syncFBXModel();
  fitCamera(currentMeshes);
  adjustGrid(currentMeshes);
  updateLocalAxes(currentMeshes);
}

btnFixX.addEventListener('click', () => rotateFBXModel('x'));
btnFixZ.addEventListener('click', () => rotateFBXModel('z'));

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
