/* ============================================
   TurboRush — Game Play
   Physics, AI, controls, HUD, game flow
   ============================================ */

/* ---------- Game State ---------- */
let gameState = 'garage'; // garage | countdown | racing | results
let selectedCarId = 0;
let selectedTrackId = 0;

let playerCar = null;
let aiCars = [];
let playerPhysics = { speed: 0, angle: 0, nitro: 100, lap: 1, waypointIdx: 0, totalDist: 0, driftTimer: 0 };
let aiPhysics = [];

let raceStartTime = 0;
let raceElapsed = 0;
let rainEnabled = false;
let nightMode = false;

const MAX_SPEED = 2.5;
const ACCEL = 0.035;
const BRAKE = 0.06;
const FRICTION = 0.015;
const TURN_SPEED = 0.04;
const NITRO_BOOST = 1.5;
const NITRO_DRAIN = 0.4;
const NITRO_REGEN = 0.08;
const TOTAL_LAPS = 3;

/* ---------- Input State ---------- */
const keys = {};
window.addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true; e.preventDefault(); });
window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

/* ---------- Touch Controls ---------- */
const touch = { left: false, right: false, gas: false, brake: false, nitro: false };

function setupTouchControls() {
  const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const tc = document.getElementById('touchControls');
  if (!isMobile) { tc.style.display = 'none'; return; }
  tc.style.display = 'block';

  const bind = (id, key) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('touchstart', e => { e.preventDefault(); touch[key] = true; }, { passive: false });
    el.addEventListener('touchend', e => { e.preventDefault(); touch[key] = false; }, { passive: false });
    el.addEventListener('touchcancel', e => { touch[key] = false; });
  };
  bind('touchLeft', 'left');
  bind('touchRight', 'right');
  bind('touchGas', 'gas');
  bind('touchBrake', 'brake');
  bind('touchNitro', 'nitro');
}

/* ---------- Garage UI ---------- */
function initGarage() {
  const grid = document.getElementById('carGrid');
  grid.innerHTML = '';
  CAR_DEFS.forEach(car => {
    const card = document.createElement('div');
    card.className = 'car-card' + (car.id === selectedCarId ? ' selected' : '');
    card.innerHTML = `
      <div class="car-icon">${car.icon}</div>
      <div class="car-name">${car.name}</div>
      <div class="car-stats">SPD ${(car.speed * 100).toFixed(0)} · ACC ${(car.accel * 100).toFixed(0)} · HND ${(car.handling * 100).toFixed(0)}</div>`;
    card.addEventListener('click', () => {
      selectedCarId = car.id;
      grid.querySelectorAll('.car-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
    });
    grid.appendChild(card);
  });

  const trackRow = document.getElementById('trackRow');
  trackRow.innerHTML = '';
  TRACKS.forEach(t => {
    const chip = document.createElement('button');
    chip.className = 'track-chip' + (t.id === selectedTrackId ? ' active' : '');
    chip.textContent = `${t.thumbnail} ${t.name}`;
    chip.addEventListener('click', () => {
      selectedTrackId = t.id;
      trackRow.querySelectorAll('.track-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
    });
    trackRow.appendChild(chip);
  });

  document.getElementById('btnStartRace').addEventListener('click', startCountdown);
  document.getElementById('btnRestart').addEventListener('click', () => startCountdown());
  document.getElementById('btnBackGarage').addEventListener('click', showGarage);
}

function showGarage() {
  gameState = 'garage';
  document.getElementById('garageScreen').style.display = 'flex';
  document.getElementById('resultsScreen').style.display = 'none';
  document.getElementById('hud').style.display = 'none';
  document.getElementById('countdown').style.display = 'none';
}

/* ---------- Countdown ---------- */
function startCountdown() {
  document.getElementById('garageScreen').style.display = 'none';
  document.getElementById('resultsScreen').style.display = 'none';
  document.getElementById('countdown').style.display = 'flex';
  document.getElementById('hud').style.display = 'none';

  setupRace();

  let count = 3;
  const cd = document.getElementById('countdown');
  cd.textContent = count;

  const interval = setInterval(() => {
    count--;
    if (count > 0) { cd.textContent = count; }
    else if (count === 0) { cd.textContent = 'GO!'; cd.style.color = '#22c55e'; }
    else {
      clearInterval(interval);
      cd.style.display = 'none';
      cd.style.color = '#00d4ff';
      startRacing();
    }
  }, 1000);
}

/* ---------- Race Setup ---------- */
function setupRace() {
  // Clear previous
  if (playerCar) { scene.remove(playerCar); }
  aiCars.forEach(c => scene.remove(c));
  aiCars = []; aiPhysics = [];

  // Build environment & track
  const trackDef = TRACKS[selectedTrackId];
  buildEnvironment(trackDef);
  const trackData = buildTrack(selectedTrackId);

  // Create env map for reflections
  try { createEnvMap(); } catch(e) {}

  // Player car
  const carDef = CAR_DEFS[selectedCarId];
  playerCar = createCarModel(carDef, true);

  // Start position
  const startPt = trackSpline.getPointAt(0);
  const startTan = trackSpline.getTangentAt(0);
  playerCar.position.set(startPt.x, 0.05, startPt.z);
  playerCar.lookAt(startPt.x + startTan.x, 0, startPt.z + startTan.z);

  playerPhysics = {
    speed: 0, angle: playerCar.rotation.y, nitro: 100,
    lap: 1, waypointIdx: 0, totalDist: 0, driftTimer: 0,
    lastCheckpointT: 0
  };

  scene.add(playerCar);

  // AI cars
  const aiColors = [0xff4655, 0xffa500, 0xa855f7].filter((_, i) => i !== selectedCarId % 3);
  for (let i = 0; i < 3; i++) {
    const aiDef = { ...CAR_DEFS[(selectedCarId + i + 1) % CAR_DEFS.length] };
    const ai = createCarModel(aiDef, false);
    const t = (0.05 + i * 0.03) % 1;
    const aiPt = trackSpline.getPointAt(t);
    const aiTan = trackSpline.getTangentAt(t);
    ai.position.set(aiPt.x + (i - 1) * 3, 0.05, aiPt.z);
    ai.lookAt(aiPt.x + aiTan.x, 0, aiPt.z + aiTan.z);
    scene.add(ai);
    aiCars.push(ai);
    aiPhysics.push({
      t: t, speed: 0.6 + Math.random() * 0.4,
      lap: 1, totalDist: 0, lastT: t,
      targetSpeed: 1.2 + Math.random() * 0.6,
      wobble: Math.random() * Math.PI * 2
    });
  }

  // Rain toggle based on track
  rainEnabled = selectedTrackId === 2;
  if (rainEnabled) createRain();
  else removeRain();
}

/* ---------- Start Racing ---------- */
function startRacing() {
  gameState = 'racing';
  raceStartTime = performance.now();
  raceElapsed = 0;
  document.getElementById('hud').style.display = 'block';
  setupTouchControls();
}

/* ---------- Main Game Loop ---------- */
function gameLoop() {
  requestAnimationFrame(gameLoop);
  if (!renderer) return;

  const delta = Math.min(clock.getDelta(), 0.05);

  if (gameState === 'racing') {
    raceElapsed = performance.now() - raceStartTime;
    updatePlayerPhysics(delta);
    updateAI(delta);
    updateCamera(delta);
    updateHUD();
    updateMinimap();
    if (rainEnabled) updateRain(playerCar.position);
  } else if (gameState === 'garage') {
    // Slow rotate camera around origin
    const t = performance.now() * 0.0001;
    camera.position.set(Math.cos(t) * 50, 30, Math.sin(t) * 50);
    camera.lookAt(0, 0, 0);
  }

  renderer.render(scene, camera);
}

/* ---------- Player Physics ---------- */
function updatePlayerPhysics(delta) {
  if (!playerCar || !trackSpline) return;

  const carDef = CAR_DEFS[selectedCarId];
  const isGas = keys['w'] || keys['arrowup'] || touch.gas;
  const isBrake = keys['s'] || keys['arrowdown'] || touch.brake;
  const isLeft = keys['a'] || keys['arrowleft'] || touch.left;
  const isRight = keys['d'] || keys['arrowright'] || touch.right;
  const isNitro = keys[' '] || touch.nitro;

  // Acceleration & braking
  if (isGas) {
    playerPhysics.speed += ACCEL * carDef.accel;
  } else if (isBrake) {
    playerPhysics.speed -= BRAKE;
  }

  // Nitro
  let nitroActive = false;
  if (isNitro && playerPhysics.nitro > 0 && playerPhysics.speed > 0.5) {
    playerPhysics.speed += ACCEL * NITRO_BOOST * carDef.accel;
    playerPhysics.nitro -= NITRO_DRAIN;
    nitroActive = true;
  } else if (playerPhysics.nitro < 100) {
    playerPhysics.nitro += NITRO_REGEN;
  }
  playerPhysics.nitro = Math.max(0, Math.min(100, playerPhysics.nitro));

  // Friction
  playerPhysics.speed -= FRICTION;
  if (rainEnabled) playerPhysics.speed -= 0.003; // Extra drag in rain

  // Speed limits
  const maxSpd = MAX_SPEED * carDef.speed * (nitroActive ? 1.4 : 1);
  playerPhysics.speed = Math.max(0, Math.min(maxSpd, playerPhysics.speed));

  // Steering
  const turnRate = TURN_SPEED * carDef.handling * (1 - playerPhysics.speed / (maxSpd * 1.5));
  if (isLeft) playerPhysics.angle += turnRate;
  if (isRight) playerPhysics.angle -= turnRate;

  // Apply movement
  const vx = Math.sin(playerPhysics.angle) * playerPhysics.speed;
  const vz = Math.cos(playerPhysics.angle) * playerPhysics.speed;
  playerCar.position.x += vx;
  playerCar.position.z += vz;

  // Snap to ground
  const groundY = getTrackElevation(playerCar.position.x, playerCar.position.z);
  playerCar.position.y = groundY + 0.05;

  // Car rotation
  playerCar.rotation.y = playerPhysics.angle;

  // Wheel spin
  const wheelSpeed = playerPhysics.speed * 15;
  if (playerCar.userData.wheels) {
    playerCar.userData.wheels.forEach(w => { w.rotation.x += wheelSpeed * delta * 60; });
  }

  // Tilt on turn
  const tiltTarget = ((isLeft ? 1 : 0) - (isRight ? 1 : 0)) * 0.06 * playerPhysics.speed;
  playerCar.rotation.z += (tiltTarget - playerCar.rotation.z) * 0.1;

  // Waypoint / Lap tracking
  updateLapTracking();
}

function getTrackElevation(x, z) {
  if (!trackSpline) return 0;
  // Sample closest point for Y
  let minDist = Infinity, bestY = 0;
  for (let t = 0; t < 1; t += 0.02) {
    const p = trackSpline.getPointAt(t);
    const dx = p.x - x, dz = p.z - z;
    const d = dx * dx + dz * dz;
    if (d < minDist) { minDist = d; bestY = p.y || 0; }
  }
  return bestY;
}

function updateLapTracking() {
  if (!trackSpline) return;
  // Find closest T on spline
  let minDist = Infinity, bestT = 0;
  for (let t = 0; t < 1; t += 0.005) {
    const p = trackSpline.getPointAt(t);
    const dx = p.x - playerCar.position.x;
    const dz = p.z - playerCar.position.z;
    const d = dx * dx + dz * dz;
    if (d < minDist) { minDist = d; bestT = t; }
  }

  // Detect lap completion
  const prevT = playerPhysics.lastCheckpointT;
  if (prevT > 0.8 && bestT < 0.2) {
    playerPhysics.lap++;
    if (playerPhysics.lap > TOTAL_LAPS) {
      finishRace();
      return;
    }
  }
  playerPhysics.lastCheckpointT = bestT;
  playerPhysics.totalDist = (playerPhysics.lap - 1) + bestT;
}

/* ---------- AI ---------- */
function updateAI(delta) {
  aiCars.forEach((ai, idx) => {
    const ap = aiPhysics[idx];

    // Speed variation
    ap.wobble += delta * (0.5 + Math.random() * 0.3);
    const speedMod = 1 + Math.sin(ap.wobble) * 0.15;
    const baseSpeed = ap.targetSpeed * 0.012 * speedMod;

    // Rubber-banding: slow down if way ahead, speed up if behind
    const playerDist = playerPhysics.totalDist;
    const aiDist = (ap.lap - 1) + ap.t;
    const diff = aiDist - playerDist;
    let rubberBand = 1;
    if (diff > 0.5) rubberBand = 0.7;
    else if (diff < -0.3) rubberBand = 1.4;

    ap.t += baseSpeed * rubberBand * delta * 60;

    // Lap tracking
    if (ap.t >= 1) {
      ap.t -= 1;
      ap.lap++;
    }

    const safet = Math.max(0, Math.min(0.9999, ap.t));
    const pos = trackSpline.getPointAt(safet);
    const tan = trackSpline.getTangentAt(safet);

    // Offset for lane variation
    const offset = (idx - 1) * 3;
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(tan, up).normalize();

    ai.position.set(pos.x + right.x * offset, (pos.y || 0) + 0.05, pos.z + right.z * offset);
    ai.lookAt(pos.x + tan.x * 10, pos.y || 0, pos.z + tan.z * 10);

    // Wheel spin
    if (ai.userData.wheels) {
      ai.userData.wheels.forEach(w => { w.rotation.x += baseSpeed * 40 * delta * 60; });
    }

    ap.totalDist = (ap.lap - 1) + ap.t;
  });
}

/* ---------- Camera ---------- */
function updateCamera(delta) {
  if (!playerCar) return;

  const idealOffset = new THREE.Vector3(0, 6, -14);
  idealOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), playerPhysics.angle);
  idealOffset.add(playerCar.position);

  // Extra height when going fast
  const speedBoost = playerPhysics.speed / MAX_SPEED;
  idealOffset.y += speedBoost * 3;

  camera.position.lerp(idealOffset, 0.08);

  const lookTarget = new THREE.Vector3(0, 1.5, 6);
  lookTarget.applyAxisAngle(new THREE.Vector3(0, 1, 0), playerPhysics.angle);
  lookTarget.add(playerCar.position);
  camera.lookAt(lookTarget);
}

/* ---------- HUD ---------- */
function updateHUD() {
  const speedKmh = Math.round(playerPhysics.speed * 120);
  document.getElementById('speedVal').textContent = speedKmh;
  document.getElementById('hudLap').textContent = `LAP ${Math.min(playerPhysics.lap, TOTAL_LAPS)}/${TOTAL_LAPS}`;
  document.getElementById('hudTimer').textContent = formatTime(raceElapsed);
  document.getElementById('nitroBar').style.width = playerPhysics.nitro + '%';

  // Gear calculation
  const gear = Math.max(1, Math.min(6, Math.ceil(playerPhysics.speed / MAX_SPEED * 6)));
  document.getElementById('gearVal').textContent = gear;

  // Position calculation
  const allDist = [
    { name: 'player', dist: playerPhysics.totalDist },
    ...aiPhysics.map((ap, i) => ({ name: `AI${i}`, dist: ap.totalDist }))
  ].sort((a, b) => b.dist - a.dist);

  const pos = allDist.findIndex(d => d.name === 'player') + 1;
  const suffix = pos === 1 ? 'st' : pos === 2 ? 'nd' : pos === 3 ? 'rd' : 'th';
  document.getElementById('hudPos').textContent = `POS ${pos}${suffix}/4`;
}

/* ---------- Minimap ---------- */
function updateMinimap() {
  const canvas = document.getElementById('minimap');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 140, 140);

  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(0, 0, 140, 140);

  if (!trackSpline) return;

  const scale = 0.25;
  const cx = 70, cy = 70;

  // Draw track
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 2;
  for (let t = 0; t <= 1; t += 0.01) {
    const p = trackSpline.getPointAt(t);
    const sx = cx + p.x * scale;
    const sy = cy + p.z * scale;
    if (t === 0) ctx.moveTo(sx, sy);
    else ctx.lineTo(sx, sy);
  }
  ctx.closePath();
  ctx.stroke();

  // Player dot
  if (playerCar) {
    ctx.fillStyle = '#00d4ff';
    ctx.beginPath();
    ctx.arc(cx + playerCar.position.x * scale, cy + playerCar.position.z * scale, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // AI dots
  aiCars.forEach((ai, i) => {
    ctx.fillStyle = ['#ff4655', '#ffa500', '#a855f7'][i];
    ctx.beginPath();
    ctx.arc(cx + ai.position.x * scale, cy + ai.position.z * scale, 3, 0, Math.PI * 2);
    ctx.fill();
  });
}

/* ---------- Race Finish ---------- */
function finishRace() {
  gameState = 'results';
  document.getElementById('hud').style.display = 'none';
  document.getElementById('resultsScreen').style.display = 'flex';
  document.getElementById('touchControls').style.display = 'none';

  const time = raceElapsed;
  document.getElementById('resultTime').textContent = formatTime(time);

  // Calculate position
  const allDist = [
    { name: 'player', dist: playerPhysics.totalDist },
    ...aiPhysics.map((ap, i) => ({ name: `AI${i}`, dist: ap.totalDist }))
  ].sort((a, b) => b.dist - a.dist);
  const pos = allDist.findIndex(d => d.name === 'player') + 1;
  const suffix = pos === 1 ? 'st' : pos === 2 ? 'nd' : pos === 3 ? 'rd' : 'th';
  document.getElementById('resultPos').textContent = `${pos}${suffix} Place`;

  // Auto-save with default name
  const carName = CAR_DEFS[selectedCarId].name;
  setTimeout(() => {
    const name = document.getElementById('playerNameInput').value || 'Racer';
    saveScore(selectedTrackId, name, time, carName);
  }, 500);
}

/* ---------- Init ---------- */
window.addEventListener('DOMContentLoaded', () => {
  initScene();
  buildEnvironment(TRACKS[0]);
  buildTrack(0);
  initGarage();

  // Hide loading
  setTimeout(() => {
    const loader = document.getElementById('loadingOverlay');
    loader.style.opacity = '0';
    setTimeout(() => loader.style.display = 'none', 500);
  }, 800);

  // Start game loop
  gameLoop();
});
