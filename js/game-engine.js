/* ============================================
   TurboRush — Game Engine (Three.js)
   Scene setup, track generation, car models
   ============================================ */

const CAR_DEFS = [
  { id: 0, name: 'Phantom GT',   color: 0xff1744, speed: 1.0,  accel: 1.0,  handling: 1.0,  icon: '🔴' },
  { id: 1, name: 'Bolt V12',     color: 0x00d4ff, speed: 1.1,  accel: 0.9,  handling: 0.95, icon: '🔵' },
  { id: 2, name: 'Venom RS',     color: 0x22c55e, speed: 0.95, accel: 1.15, handling: 0.9,  icon: '🟢' },
  { id: 3, name: 'Eclipse Noir',  color: 0x1a1a2e, speed: 1.05, accel: 1.05, handling: 1.0,  icon: '⚫' },
  { id: 4, name: 'Solar Fury',   color: 0xffa500, speed: 0.9,  accel: 1.0,  handling: 1.2,  icon: '🟠' },
  { id: 5, name: 'Amethyst LX',  color: 0xa855f7, speed: 1.08, accel: 0.95, handling: 1.05, icon: '🟣' }
];

/* ---------- Three.js Scene Setup ---------- */
let scene, camera, renderer, clock;
let trackMeshes = [], sceneryMeshes = [];
let trackWaypoints = [];
let trackSpline = null;

function initScene() {
  scene = new THREE.Scene();
  clock = new THREE.Clock();

  // Renderer
  const canvas = document.getElementById('gameCanvas');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;

  // Camera
  camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 2000);
  camera.position.set(0, 8, -15);

  // Resize
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

/* ---------- Environment ---------- */
function buildEnvironment(trackDef) {
  // Clear old
  trackMeshes.forEach(m => scene.remove(m));
  sceneryMeshes.forEach(m => scene.remove(m));
  trackMeshes = []; sceneryMeshes = [];

  // Fog
  scene.fog = new THREE.FogExp2(trackDef.skyColor, 0.003);
  scene.background = new THREE.Color(trackDef.skyColor);

  // Lights
  const ambient = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambient); trackMeshes.push(ambient);

  const hemi = new THREE.HemisphereLight(0x87ceeb, trackDef.groundColor, 0.5);
  scene.add(hemi); trackMeshes.push(hemi);

  const sun = new THREE.DirectionalLight(0xfff4e6, 1.2);
  sun.position.set(100, 150, 100);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -300; sun.shadow.camera.right = 300;
  sun.shadow.camera.top = 300; sun.shadow.camera.bottom = -300;
  sun.shadow.camera.far = 600;
  scene.add(sun); trackMeshes.push(sun);

  // Ground
  const groundGeo = new THREE.PlaneGeometry(1200, 1200);
  const groundMat = new THREE.MeshStandardMaterial({ color: trackDef.groundColor, roughness: 0.9 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.5;
  ground.receiveShadow = true;
  scene.add(ground); trackMeshes.push(ground);

  // Grid helper for ground detail
  const grid = new THREE.GridHelper(1200, 120, 0x222233, 0x181825);
  grid.position.y = -0.45;
  scene.add(grid); trackMeshes.push(grid);
}

/* ---------- Track Road ---------- */
function buildTrack(trackId) {
  const wp = generateTrackWaypoints(trackId);
  trackWaypoints = wp;

  const points = wp.map(p => new THREE.Vector3(p.x, p.y || 0, p.z));
  trackSpline = new THREE.CatmullRomCurve3(points, true);

  // Road surface
  const roadPts = trackSpline.getPoints(500);
  const roadShape = [];
  const ROAD_W = 14;

  for (let i = 0; i < roadPts.length; i++) {
    const p = roadPts[i];
    const next = roadPts[(i + 1) % roadPts.length];
    const dir = new THREE.Vector3().subVectors(next, p).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(dir, up).normalize();

    roadShape.push({
      left: new THREE.Vector3().copy(p).addScaledVector(right, -ROAD_W / 2),
      right: new THREE.Vector3().copy(p).addScaledVector(right, ROAD_W / 2),
      center: p
    });
  }

  // Build road mesh
  const roadGeo = new THREE.BufferGeometry();
  const verts = [], indices = [], uvs = [];

  for (let i = 0; i < roadShape.length; i++) {
    const s = roadShape[i];
    verts.push(s.left.x, (s.left.y || 0) + 0.05, s.left.z);
    verts.push(s.right.x, (s.right.y || 0) + 0.05, s.right.z);
    uvs.push(0, i * 0.05); uvs.push(1, i * 0.05);

    if (i < roadShape.length - 1) {
      const bi = i * 2;
      indices.push(bi, bi + 1, bi + 2);
      indices.push(bi + 1, bi + 3, bi + 2);
    }
  }
  // Close loop
  const last = (roadShape.length - 1) * 2;
  indices.push(last, last + 1, 0);
  indices.push(last + 1, 1, 0);

  roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  roadGeo.setIndex(indices);
  roadGeo.computeVertexNormals();

  const trackDef = TRACKS[trackId];
  const roadMat = new THREE.MeshStandardMaterial({ color: trackDef.roadColor, roughness: 0.7, metalness: 0.1 });
  const roadMesh = new THREE.Mesh(roadGeo, roadMat);
  roadMesh.receiveShadow = true;
  scene.add(roadMesh); trackMeshes.push(roadMesh);

  // Road markings (center line)
  const lineGeo = new THREE.BufferGeometry();
  const lineVerts = [];
  for (let i = 0; i < roadShape.length; i++) {
    const c = roadShape[i].center;
    lineVerts.push(c.x, (c.y || 0) + 0.1, c.z);
  }
  lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(lineVerts, 3));
  const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3 });
  const line = new THREE.Line(lineGeo, lineMat);
  scene.add(line); trackMeshes.push(line);

  // Road barriers (edge lines)
  for (const side of ['left', 'right']) {
    const edgeGeo = new THREE.BufferGeometry();
    const edgeVerts = [];
    for (let i = 0; i < roadShape.length; i++) {
      const p = roadShape[i][side];
      edgeVerts.push(p.x, (p.y || 0) + 0.12, p.z);
    }
    edgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(edgeVerts, 3));
    const edgeMat = new THREE.LineBasicMaterial({ color: trackDef.accentColor, transparent: true, opacity: 0.6 });
    const edgeLine = new THREE.Line(edgeGeo, edgeMat);
    scene.add(edgeLine); trackMeshes.push(edgeLine);
  }

  // Scenery
  addScenery(trackId, roadShape);

  return { waypoints: wp, spline: trackSpline, roadShape };
}

/* ---------- Scenery ---------- */
function addScenery(trackId, roadShape) {
  const trackDef = TRACKS[trackId];
  const density = trackDef.buildingDensity;
  const rng = seedRandom(trackId * 7 + 13);

  // Buildings / Trees along track
  for (let i = 0; i < roadShape.length; i += 3) {
    if (rng() > density + 0.3) continue;

    for (let side = -1; side <= 1; side += 2) {
      if (rng() > 0.6) continue;
      const p = side === -1 ? roadShape[i].left : roadShape[i].right;
      const offset = 15 + rng() * 40;
      const next = roadShape[(i + 1) % roadShape.length];
      const dir = side === -1 ? next.left : next.right;
      const dx = dir.x - p.x, dz = dir.z - p.z;
      const len = Math.sqrt(dx * dx + dz * dz) || 1;
      const nx = -dz / len * side, nz = dx / len * side;

      const x = p.x + nx * offset;
      const z = p.z + nz * offset;

      if (trackDef.environment === 'city' || rng() < density) {
        addBuilding(x, z, rng, trackDef);
      } else {
        addTree(x, z, rng, trackDef);
      }
    }
  }

  // Scattered extra scenery
  for (let i = 0; i < 60; i++) {
    const angle = rng() * Math.PI * 2;
    const radius = 100 + rng() * 400;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    if (rng() < density) addBuilding(x, z, rng, trackDef);
    else addTree(x, z, rng, trackDef);
  }
}

function addBuilding(x, z, rng, trackDef) {
  const w = 4 + rng() * 12;
  const h = 8 + rng() * 40;
  const d = 4 + rng() * 12;
  const geo = new THREE.BoxGeometry(w, h, d);

  const brightness = 0.02 + rng() * 0.08;
  const color = new THREE.Color(brightness, brightness, brightness + 0.02);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.3 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, h / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh); sceneryMeshes.push(mesh);

  // Windows (emissive strips)
  if (h > 15) {
    const winGeo = new THREE.BoxGeometry(w + 0.1, 1, d + 0.1);
    const winMat = new THREE.MeshStandardMaterial({
      color: 0x000000, emissive: trackDef.accentColor, emissiveIntensity: 0.3 + rng() * 0.5
    });
    for (let y = 4; y < h - 2; y += 4) {
      const win = new THREE.Mesh(winGeo, winMat);
      win.position.set(x, y, z);
      scene.add(win); sceneryMeshes.push(win);
    }
  }
}

function addTree(x, z, rng, trackDef) {
  // Trunk
  const trunkH = 2 + rng() * 3;
  const trunkGeo = new THREE.CylinderGeometry(0.3, 0.5, trunkH, 6);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3728, roughness: 0.9 });
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.position.set(x, trunkH / 2, z);
  trunk.castShadow = true;
  scene.add(trunk); sceneryMeshes.push(trunk);

  // Foliage
  const foliageR = 2 + rng() * 3;
  const foliageGeo = new THREE.SphereGeometry(foliageR, 8, 6);
  const green = new THREE.Color().setHSL(0.3 + rng() * 0.1, 0.6, 0.2 + rng() * 0.15);
  const foliageMat = new THREE.MeshStandardMaterial({ color: green, roughness: 0.8 });
  const foliage = new THREE.Mesh(foliageGeo, foliageMat);
  foliage.position.set(x, trunkH + foliageR * 0.6, z);
  foliage.castShadow = true;
  scene.add(foliage); sceneryMeshes.push(foliage);
}

/* ---------- Car Model ---------- */
function createCarModel(carDef, isPlayer) {
  const group = new THREE.Group();
  const color = new THREE.Color(carDef.color);

  // Body
  const bodyGeo = new THREE.BoxGeometry(2.2, 0.8, 4.5);
  const bodyMat = new THREE.MeshStandardMaterial({
    color, roughness: 0.2, metalness: 0.8,
    envMapIntensity: 1.5
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.6;
  body.castShadow = true;
  group.add(body);

  // Cabin
  const cabinGeo = new THREE.BoxGeometry(1.8, 0.65, 2.2);
  const cabinMat = new THREE.MeshStandardMaterial({
    color: 0x111122, roughness: 0.1, metalness: 0.9, transparent: true, opacity: 0.8
  });
  const cabin = new THREE.Mesh(cabinGeo, cabinMat);
  cabin.position.set(0, 1.15, -0.3);
  group.add(cabin);

  // Wheels
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 12);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5, metalness: 0.6 });
  const wheelPositions = [
    [-1.1, 0.38, 1.4], [1.1, 0.38, 1.4],
    [-1.1, 0.38, -1.4], [1.1, 0.38, -1.4]
  ];
  group.userData.wheels = [];
  wheelPositions.forEach(pos => {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(...pos);
    wheel.castShadow = true;
    group.add(wheel);
    group.userData.wheels.push(wheel);
  });

  // Headlights
  const hlGeo = new THREE.SphereGeometry(0.15, 8, 8);
  const hlMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffcc, emissiveIntensity: 2 });
  [[-0.7, 0.6, 2.3], [0.7, 0.6, 2.3]].forEach(pos => {
    const hl = new THREE.Mesh(hlGeo, hlMat);
    hl.position.set(...pos);
    group.add(hl);
  });

  // Taillights
  const tlMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 1.5 });
  [[-0.7, 0.6, -2.3], [0.7, 0.6, -2.3]].forEach(pos => {
    const tl = new THREE.Mesh(hlGeo, tlMat);
    tl.position.set(...pos);
    group.add(tl);
  });

  // Spoiler (some cars)
  if (carDef.speed > 1.0) {
    const spoilerGeo = new THREE.BoxGeometry(2, 0.08, 0.5);
    const spoilerMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.7 });
    const spoiler = new THREE.Mesh(spoilerGeo, spoilerMat);
    spoiler.position.set(0, 1.3, -2.1);
    group.add(spoiler);

    // Supports
    const supGeo = new THREE.BoxGeometry(0.08, 0.3, 0.08);
    [[-0.7, 1.15, -2.1], [0.7, 1.15, -2.1]].forEach(pos => {
      const sup = new THREE.Mesh(supGeo, spoilerMat);
      sup.position.set(...pos);
      group.add(sup);
    });
  }

  if (isPlayer) {
    // Headlight spotlight
    const spotL = new THREE.SpotLight(0xffffcc, 0.8, 50, Math.PI / 6, 0.5);
    spotL.position.set(0, 1, 2.5);
    spotL.target.position.set(0, 0, 20);
    group.add(spotL);
    group.add(spotL.target);
  }

  group.userData.carDef = carDef;
  return group;
}

/* ---------- Weather — Rain Particles ---------- */
let rainSystem = null;

function createRain() {
  if (rainSystem) { scene.remove(rainSystem); rainSystem = null; }
  const count = 3000;
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const velocities = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 400;
    positions[i * 3 + 1] = Math.random() * 100;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 400;
    velocities[i] = 1 + Math.random() * 2;
  }

  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.userData = { velocities };

  const mat = new THREE.PointsMaterial({
    color: 0xaaaacc, size: 0.3, transparent: true, opacity: 0.6
  });
  rainSystem = new THREE.Points(geo, mat);
  scene.add(rainSystem);
  return rainSystem;
}

function updateRain(playerPos) {
  if (!rainSystem) return;
  const pos = rainSystem.geometry.attributes.position;
  const vel = rainSystem.geometry.userData.velocities;
  for (let i = 0; i < pos.count; i++) {
    pos.array[i * 3 + 1] -= vel[i];
    if (pos.array[i * 3 + 1] < 0) {
      pos.array[i * 3 + 1] = 80 + Math.random() * 20;
      pos.array[i * 3] = playerPos.x + (Math.random() - 0.5) * 400;
      pos.array[i * 3 + 2] = playerPos.z + (Math.random() - 0.5) * 400;
    }
  }
  pos.needsUpdate = true;
}

function removeRain() {
  if (rainSystem) { scene.remove(rainSystem); rainSystem = null; }
}

/* ---------- Env Map (simple reflection) ---------- */
function createEnvMap() {
  const cubeRT = new THREE.WebGLCubeRenderTarget(256);
  const cubeCamera = new THREE.CubeCamera(0.1, 1000, cubeRT);
  scene.add(cubeCamera);
  cubeCamera.position.set(0, 5, 0);
  cubeCamera.update(renderer, scene);
  scene.environment = cubeRT.texture;
}

/* ---------- Utility: Seeded RNG ---------- */
function seedRandom(seed) {
  let s = seed;
  return function () {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}
