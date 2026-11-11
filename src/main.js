import * as THREE from 'three';
import confetti from 'canvas-confetti';
import './style.css';
import { createHockeyTable, TABLE_DIM } from './table.js';
import { ParticleFX } from './particles.js';
import { sounds } from './sounds.js';
import { showToast } from './toast.js';
import { fbMultiplayer } from './firebase.js';

// THÔNG SỐ VẬT LÝ & KÍCH THƯỚC BÀN
const TABLE = {
  halfW: TABLE_DIM.HALF_WIDTH,
  halfL: TABLE_DIM.HALF_LENGTH,
  goalHalfW: TABLE_DIM.GOAL_WIDTH / 2,
  puckRadius: 0.85,
  malletRadius: 1.35,
  maxPuckSpeed: 60,
  friction: 0.993,
  restitution: 0.94
};

// TRẠNG THÁI GAME
let gameMode = 'MENU'; // 'MENU', 'AI', 'ONLINE'
let myRole = 'p1';     // 'p1' (dưới), 'p2' (trên)
let roomCode = null;

const randId = Math.floor(1000 + Math.random() * 9000);
let playerName = localStorage.getItem('tboy_hockey_name') || `Cơ Thủ #${randId}`;
document.getElementById('display-player-name').innerText = playerName;

let p1Score = 0;
let p2Score = 0;
const targetScore = 7;
let isGoalScored = false;
let stuckTimer = 0;

// THREE.JS SCENE SETUP
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xfdf2f8);
scene.fog = new THREE.FogExp2(0xfdf2f8, 0.006);

// CAMERA ISOMETRIC 3D CHUẨN BIRDIE BASH
const camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.1, 150);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
container.appendChild(renderer.domElement);

// HÀM ĐIỀU CHỈNH CAMERA THÔNG MINH CHO TỪNG THIẾT BỊ (MOBILE / TABLET / DESKTOP)
export function updateCameraFraming() {
  const aspect = window.innerWidth / window.innerHeight;
  camera.aspect = aspect;

  const camY = 46;
  const camZ = 32;
  const baseFov = 48;

  // Với màn hình dọc hẹp (điện thoại mobile portrait / cửa sổ hẹp), FOV tự động giãn nở linh hoạt
  // để toàn bộ chiều ngang bàn đấu (18m + thành bàn) và 2 đầu gôn luôn hiển thị trọn vẹn 100%
  let fov = baseFov;
  if (aspect < 0.82) {
    fov = Math.max(baseFov, 2 * Math.atan(0.245 / aspect) * (180 / Math.PI));
  }
  camera.fov = fov;

  if (myRole === 'p1') {
    camera.position.set(0, camY, camZ);
    camera.lookAt(0, 0, 0);
  } else {
    camera.position.set(0, camY, -camZ);
    camera.lookAt(0, 0, 0);
  }

  camera.updateProjectionMatrix();
  if (renderer) renderer.setSize(window.innerWidth, window.innerHeight);
}
updateCameraFraming();

// HỆ THỐNG CHIẾU SÁNG ẤM ÁP TỰ NHIÊN
const hemiLight = new THREE.HemisphereLight(0xfffbeb, 0xfce7f3, 1.35);
hemiLight.position.set(0, 30, 0);
scene.add(hemiLight);

const mainLight = new THREE.DirectionalLight(0xffedd5, 1.7);
mainLight.position.set(12, 28, 10);
mainLight.castShadow = true;
mainLight.shadow.mapSize.width = 2048;
mainLight.shadow.mapSize.height = 2048;
mainLight.shadow.camera.near = 1;
mainLight.shadow.camera.far = 70;
mainLight.shadow.camera.left = -20;
mainLight.shadow.camera.right = 20;
mainLight.shadow.camera.top = 25;
mainLight.shadow.camera.bottom = -25;
mainLight.shadow.bias = -0.0003;
scene.add(mainLight);

const fillLight = new THREE.DirectionalLight(0xbae6fd, 0.7);
fillLight.position.set(-10, 20, -10);
scene.add(fillLight);

// TẠO BÀN THI ĐẤU
const hockeyTable = createHockeyTable();
scene.add(hockeyTable);

// HIỆU ỨNG HẠT
const particles = new ParticleFX(scene);

// TẠO QUẢ ĐĨA (PUCK) VÀNG TƯƠI MỊN
const puckGeo = new THREE.CylinderGeometry(TABLE.puckRadius, TABLE.puckRadius, 0.38, 36);
const puckMat = new THREE.MeshStandardMaterial({
  color: 0xf59e0b,
  roughness: 0.15,
  metalness: 0.1
});
const puckMesh = new THREE.Mesh(puckGeo, puckMat);
puckMesh.position.set(0, 0.2, 0);
puckMesh.castShadow = true;
scene.add(puckMesh);

const puckDecalGeo = new THREE.RingGeometry(0.2, 0.55, 32);
const puckDecalMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
const puckDecal = new THREE.Mesh(puckDecalGeo, puckDecalMat);
puckDecal.rotation.x = -Math.PI / 2;
puckDecal.position.y = 0.201;
puckMesh.add(puckDecal);

// TẠO TAY CẦM MALLET
function createMalletMesh(mainColorHex) {
  const group = new THREE.Group();

  const baseGeo = new THREE.CylinderGeometry(TABLE.malletRadius, TABLE.malletRadius, 0.42, 36);
  const baseMat = new THREE.MeshStandardMaterial({
    color: mainColorHex,
    roughness: 0.2,
    metalness: 0.1
  });
  const base = new THREE.Mesh(baseGeo, baseMat);
  base.position.y = 0.21;
  base.castShadow = true;
  group.add(base);

  const gripGeo = new THREE.CylinderGeometry(0.55, 0.8, 1.1, 32);
  const gripMat = new THREE.MeshStandardMaterial({ color: 0x1e1b4b, roughness: 0.4 });
  const grip = new THREE.Mesh(gripGeo, gripMat);
  grip.position.y = 0.85;
  grip.castShadow = true;
  group.add(grip);

  const knobGeo = new THREE.SphereGeometry(0.65, 32, 16);
  const knobMat = new THREE.MeshStandardMaterial({ color: mainColorHex, roughness: 0.2 });
  const knob = new THREE.Mesh(knobGeo, knobMat);
  knob.position.y = 1.45;
  knob.castShadow = true;
  group.add(knob);

  const ringGeo = new THREE.TorusGeometry(0.65, 0.08, 16, 32);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.45;
  group.add(ring);

  scene.add(group);
  return group;
}

const malletP1 = createMalletMesh(0x0284c7); // P1 - Xanh Sky Blue
const malletP2 = createMalletMesh(0xf43f5e); // P2 - Đỏ Hồng Rose

malletP1.position.set(0, 0, 11);
malletP2.position.set(0, 0, -11);

// DỮ LIỆU VẬT LÝ LOCAL
const localPuck = { x: 0, z: 4, vx: 0, vz: 3.5 };
const localMalletP1 = { x: 0, z: 11, vx: 0, vz: 0, targetX: 0, targetZ: 11, lastTime: performance.now() };
const localMalletP2 = { x: 0, z: -11, vx: 0, vz: 0, targetX: 0, targetZ: -11 };

// ĐIỀU KHIỂN CHUỘT / CẢM ỨNG & TÍNH VẬN TỐC TỨC THỜI
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const tablePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const hitPoint = new THREE.Vector3();

function onPointerMove(e) {
  if (gameMode === 'MENU') return;

  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  if (raycaster.ray.intersectPlane(tablePlane, hitPoint)) {
    const now = performance.now();
    const dt = Math.max((now - localMalletP1.lastTime) / 1000, 0.002);
    localMalletP1.lastTime = now;

    const safeW = TABLE.halfW - TABLE.malletRadius - 0.25;
    const safeL = TABLE.halfL - TABLE.malletRadius - 0.25;

    let targetX = Math.max(-safeW, Math.min(safeW, hitPoint.x));
    let targetZ;

    if (myRole === 'p1') {
      targetZ = Math.max(0.6, Math.min(safeL, hitPoint.z));
      const rawVx = (targetX - localMalletP1.x) / dt;
      const rawVz = (targetZ - localMalletP1.z) / dt;
      
      localMalletP1.vx = localMalletP1.vx * 0.2 + rawVx * 0.8;
      localMalletP1.vz = localMalletP1.vz * 0.2 + rawVz * 0.8;

      localMalletP1.x = targetX;
      localMalletP1.z = targetZ;
      localMalletP1.targetX = targetX;
      localMalletP1.targetZ = targetZ;
    } else {
      targetZ = Math.min(-0.6, Math.max(-safeL, hitPoint.z));
      const rawVx = (targetX - localMalletP2.x) / dt;
      const rawVz = (targetZ - localMalletP2.z) / dt;

      localMalletP2.vx = localMalletP2.vx * 0.2 + rawVx * 0.8;
      localMalletP2.vz = localMalletP2.vz * 0.2 + rawVz * 0.8;

      localMalletP2.x = targetX;
      localMalletP2.z = targetZ;
      localMalletP2.targetX = targetX;
      localMalletP2.targetZ = targetZ;
    }

    if (gameMode === 'ONLINE') {
      const activeX = myRole === 'p1' ? localMalletP1.x : localMalletP2.x;
      const activeZ = myRole === 'p1' ? localMalletP1.z : localMalletP2.z;
      const activeVx = myRole === 'p1' ? localMalletP1.vx : localMalletP2.vx;
      const activeVz = myRole === 'p1' ? localMalletP1.vz : localMalletP2.vz;
      fbMultiplayer.sendMallet(activeX, activeZ, activeVx, activeVz);
    }
  }
}

window.addEventListener('mousemove', onPointerMove);
window.addEventListener('touchstart', (e) => {
  if (e.touches.length > 0) {
    onPointerMove(e.touches[0]);
  }
}, { passive: false });
window.addEventListener('touchmove', (e) => {
  if (e.touches.length > 0) {
    onPointerMove(e.touches[0]);
  }
}, { passive: false });

// THUẬT TOÁN BOT AI THÔNG MINH
function updateSmartAI(dt) {
  if (gameMode !== 'AI' || isGoalScored) return;

  const safeW = TABLE.halfW - TABLE.malletRadius - 0.3;
  const safeL = TABLE.halfL - TABLE.malletRadius - 0.3;

  let targetX = 0;
  let targetZ = -11;

  const isCorner = Math.abs(localPuck.x) > TABLE.halfW - 3.2 && localPuck.z < -TABLE.halfL + 4.2;

  if (isCorner) {
    targetX = localPuck.x * 0.6;
    targetZ = Math.min(-0.8, localPuck.z + 2.8);
  } else if (localPuck.z < 1.0) {
    targetX = localPuck.x;
    targetZ = Math.min(-0.8, localPuck.z - 1.6);
  } else {
    targetX = localPuck.x * 0.4;
    targetZ = -12.5;
  }

  targetX = Math.max(-safeW, Math.min(safeW, targetX));
  targetZ = Math.min(-0.8, Math.max(-safeL, targetZ));

  const botSpeed = 18.0;
  const dx = targetX - localMalletP2.x;
  const dz = targetZ - localMalletP2.z;
  const dist = Math.hypot(dx, dz);

  const prevX = localMalletP2.x;
  const prevZ = localMalletP2.z;

  if (dist > 0.05) {
    const moveDist = Math.min(dist, botSpeed * dt);
    localMalletP2.x += (dx / dist) * moveDist;
    localMalletP2.z += (dz / dist) * moveDist;
  }

  localMalletP2.vx = (localMalletP2.x - prevX) / Math.max(dt, 0.001);
  localMalletP2.vz = (localMalletP2.z - prevZ) / Math.max(dt, 0.001);
}

// BỘ MÔ PHỎNG VẬT LÝ LOCAL MƯỢT MÀ
function updateLocalPhysics(dt) {
  if (isGoalScored) return;
  if (gameMode !== 'AI' && myRole !== 'p1') return; // P1 đóng vai trò Host serverless tính physics

  localMalletP1.vx *= 0.85;
  localMalletP1.vz *= 0.85;

  localPuck.x += localPuck.vx * dt;
  localPuck.z += localPuck.vz * dt;

  localPuck.vx *= Math.pow(TABLE.friction, dt * 60);
  localPuck.vz *= Math.pow(TABLE.friction, dt * 60);

  const speed = Math.hypot(localPuck.vx, localPuck.vz);
  if (speed > TABLE.maxPuckSpeed) {
    localPuck.vx = (localPuck.vx / speed) * TABLE.maxPuckSpeed;
    localPuck.vz = (localPuck.vz / speed) * TABLE.maxPuckSpeed;
  }

  // Chống kẹt đĩa tự động
  if (speed < 0.4) {
    stuckTimer += dt;
    if (stuckTimer > 2.0) {
      localPuck.vx = (localPuck.x > 0 ? -1 : 1) * 5.0;
      localPuck.vz = (localPuck.z > 0 ? -1 : 1) * 5.0;
      sounds.playWhoosh();
      stuckTimer = 0;
    }
  } else {
    stuckTimer = 0;
  }

  const r = TABLE.puckRadius;

  // 1. Va chạm thành X
  if (localPuck.x - r < -TABLE.halfW) {
    localPuck.x = -TABLE.halfW + r;
    localPuck.vx = Math.abs(localPuck.vx) * TABLE.restitution;
    sounds.playHitWall(speed);
    particles.createHitSparks(localPuck.x, localPuck.z, 0x0284c7, 10);
  } else if (localPuck.x + r > TABLE.halfW) {
    localPuck.x = TABLE.halfW - r;
    localPuck.vx = -Math.abs(localPuck.vx) * TABLE.restitution;
    sounds.playHitWall(speed);
    particles.createHitSparks(localPuck.x, localPuck.z, 0x0284c7, 10);
  }

  // 2. Va chạm thành Z & Gôn
  if (localPuck.z - r < -TABLE.halfL) {
    if (Math.abs(localPuck.x) < TABLE.goalHalfW - 0.2) {
      if (localPuck.z < -TABLE.halfL - 0.8) {
        triggerGoal('p1');
        return;
      }
    } else {
      localPuck.z = -TABLE.halfL + r;
      localPuck.vz = Math.abs(localPuck.vz) * TABLE.restitution;
      sounds.playHitWall(speed);
      particles.createHitSparks(localPuck.x, localPuck.z, 0xf43f5e, 10);
    }
  }

  if (localPuck.z + r > TABLE.halfL) {
    if (Math.abs(localPuck.x) < TABLE.goalHalfW - 0.2) {
      if (localPuck.z > TABLE.halfL + 0.8) {
        triggerGoal('p2');
        return;
      }
    } else {
      localPuck.z = TABLE.halfL - r;
      localPuck.vz = -Math.abs(localPuck.vz) * TABLE.restitution;
      sounds.playHitWall(speed);
      particles.createHitSparks(localPuck.x, localPuck.z, 0x0284c7, 10);
    }
  }

  // 3. Va chạm với Mallets
  resolveLocalHit(localMalletP1, 0x0284c7);
  resolveLocalHit(localMalletP2, 0xf43f5e);

  // Nếu là phòng Online, P1 gửi vị trí puck lên Firebase
  if (gameMode === 'ONLINE' && myRole === 'p1') {
    fbMultiplayer.sendPuck(localPuck);
  }
}

function resolveLocalHit(mallet, colorHex) {
  const dx = localPuck.x - mallet.x;
  const dz = localPuck.z - mallet.z;
  const dist = Math.hypot(dx, dz);
  const minDist = TABLE.puckRadius + TABLE.malletRadius;

  if (dist < minDist && dist > 0.0001) {
    const nx = dx / dist;
    const nz = dz / dist;

    localPuck.x = mallet.x + nx * (minDist + 0.02);
    localPuck.z = mallet.z + nz * (minDist + 0.02);

    const rvx = localPuck.vx - mallet.vx;
    const rvz = localPuck.vz - mallet.vz;
    const velAlongNormal = rvx * nx + rvz * nz;

    if (velAlongNormal < 0) {
      const malletSpeed = Math.hypot(mallet.vx, mallet.vz);
      const isPushSoft = malletSpeed < 4.0;

      const dynamicRestitution = isPushSoft ? 0.5 : TABLE.restitution;
      const impulse = -(1 + dynamicRestitution) * velAlongNormal;

      localPuck.vx += nx * impulse;
      localPuck.vz += nz * impulse;

      const transferFactor = isPushSoft ? 0.35 : 1.25;
      localPuck.vx += mallet.vx * transferFactor;
      localPuck.vz += mallet.vz * transferFactor;

      const hitSpeed = Math.hypot(localPuck.vx, localPuck.vz);
      sounds.playHitMallet(hitSpeed);

      if (malletSpeed > 14 || hitSpeed > 24) {
        sounds.playWhoosh();
        particles.createShockwave(localPuck.x, localPuck.z, colorHex);
      }
      particles.createHitSparks(localPuck.x, localPuck.z, colorHex, Math.min(22, 8 + Math.floor(hitSpeed / 2.5)));
    }
  }
}

// BÀN THẮNG & HIỆU ỨNG CELEBRATION
const goalBanner = document.getElementById('goal-banner');
const p1ScoreEl = document.getElementById('p1-score');
const p2ScoreEl = document.getElementById('p2-score');

function triggerGoal(scorer) {
  isGoalScored = true;
  sounds.playGoal();
  confetti({
    particleCount: 100,
    spread: 80,
    origin: { y: 0.6 }
  });

  if (scorer === 'p1') {
    p1Score++;
    p1ScoreEl.innerText = p1Score;
    goalBanner.innerHTML = '<span>🎉</span> BẠN GHI BÀN!';
  } else {
    p2Score++;
    p2ScoreEl.innerText = p2Score;
    goalBanner.innerHTML = '<span>🤖</span> ĐỐI THỦ GHI BÀN!';
  }

  if (gameMode === 'ONLINE' && myRole === 'p1') {
    fbMultiplayer.updateScores({ p1: p1Score, p2: p2Score }, scorer);
  }

  goalBanner.classList.add('show');

  setTimeout(() => {
    goalBanner.classList.remove('show');
    if (p1Score >= targetScore || p2Score >= targetScore) {
      const won = (scorer === 'p1' && myRole === 'p1') || (scorer === 'p2' && myRole === 'p2');
      showToast(won ? '🏆 CHIẾN THẮNG TUYỆT ĐỐI!' : 'THUA TRẬN NÀY RỒI! HÃY THỬ LẠI NHÉ!', won ? 'success' : 'warning', 4000);
      showGameOverModal(won);
    } else {
      localPuck.x = 0;
      localPuck.z = scorer === 'p1' ? -4 : 4;
      localPuck.vx = (Math.random() - 0.5) * 3;
      localPuck.vz = scorer === 'p1' ? -4 : 4;
      isGoalScored = false;
    }
  }, 2000);
}

function showGameOverModal(won) {
  const modalGo = document.getElementById('modal-game-over');
  const goIcon = document.getElementById('go-icon');
  const goTitle = document.getElementById('go-title');
  const goSub = document.getElementById('go-sub');
  const goP1 = document.getElementById('go-score-p1');
  const goP2 = document.getElementById('go-score-p2');

  if (goIcon) goIcon.innerText = won ? '🏆' : '🤖';
  if (goTitle) goTitle.innerText = won ? 'CHIẾN THẮNG TUYỆT ĐỐI!' : 'ĐỐI THỦ ĐÃ THẮNG!';
  if (goSub) goSub.innerText = won ? 'Bạn đã xuất sắc vượt qua đối thủ!' : 'Hãy rèn luyện thêm để phục thù nào!';
  if (goP1) goP1.innerText = p1Score;
  if (goP2) goP2.innerText = p2Score;

  if (modalGo) modalGo.classList.remove('hidden');
}

function resetMatch() {
  p1Score = 0;
  p2Score = 0;
  p1ScoreEl.innerText = '0';
  p2ScoreEl.innerText = '0';
  localPuck.x = 0;
  localPuck.z = 4;
  localPuck.vx = 0;
  localPuck.vz = 3.5;
  isGoalScored = false;
}

function enterMatchUI() {
  document.getElementById('modal-create-room')?.classList.add('hidden');
  document.getElementById('modal-join-room')?.classList.add('hidden');
  document.getElementById('modal-online-menu')?.classList.add('hidden');
  document.getElementById('modal-game-over')?.classList.add('hidden');
  document.getElementById('main-menu')?.classList.add('hidden');
  document.getElementById('hud')?.classList.remove('hidden');
  document.getElementById('in-game-hint')?.classList.remove('hidden');
  updateCameraFraming();
}

function backToMenu() {
  gameMode = 'MENU';
  myRole = 'p1';
  document.getElementById('hud')?.classList.add('hidden');
  document.getElementById('in-game-hint')?.classList.add('hidden');
  document.getElementById('modal-game-over')?.classList.add('hidden');
  document.getElementById('modal-create-room')?.classList.add('hidden');
  document.getElementById('modal-join-room')?.classList.add('hidden');
  document.getElementById('modal-online-menu')?.classList.add('hidden');
  document.getElementById('modal-tips')?.classList.add('hidden');
  document.getElementById('modal-about')?.classList.add('hidden');
  document.getElementById('main-menu')?.classList.remove('hidden');
  updateCameraFraming();
  fbMultiplayer.leaveRoom();
}

// LẮNG NGHE SỰ KIỆN TỪ FIREBASE MULTIPLAYER
fbMultiplayer.on('game_start', (data) => {
  gameMode = 'ONLINE';
  enterMatchUI();

  if (data.players) {
    document.getElementById('hud-p1-name').innerText = data.players[0].name.toUpperCase();
    document.getElementById('hud-p2-name').innerText = data.players[1].name.toUpperCase();
  }
  showToast('Đối thủ đã vào! Trận đấu bắt đầu!', 'success');
});

fbMultiplayer.on('opponent_mallet', (data) => {
  if (myRole === 'p1') {
    localMalletP2.x = data.x;
    localMalletP2.z = data.z;
    malletP2.position.x = data.x;
    malletP2.position.z = data.z;
  } else {
    localMalletP1.x = data.x;
    localMalletP1.z = data.z;
    malletP1.position.x = data.x;
    malletP1.position.z = data.z;
  }
});

fbMultiplayer.on('sync_puck', (data) => {
  if (myRole === 'p2') {
    localPuck.x = data.x;
    localPuck.z = data.z;
    puckMesh.position.x = data.x;
    puckMesh.position.z = data.z;
  }
});

fbMultiplayer.on('sync_scores', (scores) => {
  if (myRole === 'p2') {
    p1Score = scores.p1;
    p2Score = scores.p2;
    p1ScoreEl.innerText = p1Score;
    p2ScoreEl.innerText = p2Score;
  }
});

fbMultiplayer.on('player_disconnected', () => {
  showToast('Đối thủ đã rời khỏi phòng!', 'warning');
  backToMenu();
});

// UI EVENTS
document.getElementById('btn-play-ai')?.addEventListener('click', () => {
  sounds.playClick();
  gameMode = 'AI';
  myRole = 'p1';
  document.getElementById('hud-p1-name').innerText = playerName.toUpperCase();
  document.getElementById('hud-p2-name').innerText = 'AI PRO';
  resetMatch();
  enterMatchUI();
  showToast('Bắt đầu trận đấu với AI!', 'info');
});

// POPUP CHỌN ONLINE
const modalOnlineMenu = document.getElementById('modal-online-menu');
const btnMenuOnline = document.getElementById('btn-menu-online');
const btnCloseOnlineMenu = document.getElementById('btn-close-online-menu');

if (btnMenuOnline && modalOnlineMenu) {
  btnMenuOnline.addEventListener('click', () => {
    sounds.playClick();
    modalOnlineMenu.classList.remove('hidden');
  });
}
if (btnCloseOnlineMenu && modalOnlineMenu) {
  btnCloseOnlineMenu.addEventListener('click', () => {
    sounds.playClick();
    modalOnlineMenu.classList.add('hidden');
  });
}
if (modalOnlineMenu) {
  modalOnlineMenu.addEventListener('click', (e) => {
    if (e.target === modalOnlineMenu) {
      modalOnlineMenu.classList.add('hidden');
    }
  });
}

document.getElementById('btn-open-create-room')?.addEventListener('click', async () => {
  sounds.playClick();
  modalOnlineMenu?.classList.add('hidden');
  try {
    const res = await fbMultiplayer.createRoom(playerName);
    roomCode = res.roomCode;
    myRole = 'p1';
    updateCameraFraming();
    document.getElementById('label-room-code').innerText = roomCode;
    document.getElementById('modal-create-room').classList.remove('hidden');
    document.getElementById('main-menu').classList.add('hidden');
  } catch (e) {
    showToast('Lỗi tạo phòng: ' + e.message, 'error');
  }
});

document.getElementById('btn-cancel-create')?.addEventListener('click', () => {
  sounds.playClick();
  document.getElementById('modal-create-room').classList.add('hidden');
  document.getElementById('main-menu').classList.remove('hidden');
  fbMultiplayer.leaveRoom();
});

document.getElementById('btn-open-join-room')?.addEventListener('click', () => {
  sounds.playClick();
  modalOnlineMenu?.classList.add('hidden');
  document.getElementById('modal-join-room').classList.remove('hidden');
  document.getElementById('main-menu').classList.add('hidden');
});

document.getElementById('btn-cancel-join')?.addEventListener('click', () => {
  sounds.playClick();
  document.getElementById('modal-join-room').classList.add('hidden');
  document.getElementById('main-menu').classList.remove('hidden');
});

document.getElementById('btn-confirm-join')?.addEventListener('click', async () => {
  sounds.playClick();
  const code = document.getElementById('input-join-code').value.trim();
  if (!code) {
    showToast('Vui lòng nhập mã phòng!', 'warning');
    return;
  }
  try {
    const res = await fbMultiplayer.joinRoom(code, playerName);
    roomCode = res.roomCode;
    myRole = 'p2';
    updateCameraFraming();
    document.getElementById('modal-join-room').classList.add('hidden');
    gameMode = 'ONLINE';
    enterMatchUI();
    showToast('Đã tham gia phòng thi đấu thành công!', 'success');
  } catch (e) {
    showToast(e.message || 'Lỗi tham gia phòng!', 'error');
  }
});

document.getElementById('btn-exit-match')?.addEventListener('click', () => {
  sounds.playClick();
  backToMenu();
});

// REMATCH & VỀ TRANG CHỦ TỪ GAME OVER MODAL
document.getElementById('btn-go-rematch')?.addEventListener('click', () => {
  sounds.playClick();
  document.getElementById('modal-game-over').classList.add('hidden');
  resetMatch();
  if (gameMode !== 'ONLINE') {
    gameMode = 'AI';
  }
  enterMatchUI();
});

document.getElementById('btn-go-home')?.addEventListener('click', () => {
  sounds.playClick();
  resetMatch();
  backToMenu();
});

// ĐỔI TÊN NGƯỜI CHƠI
document.getElementById('btn-change-name')?.addEventListener('click', () => {
  sounds.playClick();
  const newName = prompt('Nhập tên cơ thủ của bạn:', playerName);
  if (newName && newName.trim()) {
    playerName = newName.trim().substring(0, 15);
    localStorage.setItem('tboy_hockey_name', playerName);
    document.getElementById('display-player-name').innerText = playerName;
    showToast(`Đã đổi tên thành: ${playerName}`, 'success');
  }
});

// BẬT / TẮT ÂM THANH
const btnToggleAudio = document.getElementById('btn-toggle-audio');
const txtAudioBtn = document.getElementById('txt-audio-btn');
if (btnToggleAudio) {
  btnToggleAudio.addEventListener('click', () => {
    sounds.enabled = !sounds.enabled;
    if (txtAudioBtn) {
      txtAudioBtn.innerText = sounds.enabled ? '🔊 Âm Thanh: Bật' : '🔇 Âm Thanh: Tắt';
    }
    if (sounds.enabled) sounds.playClick();
    showToast(sounds.enabled ? 'Đã bật âm thanh' : 'Đã tắt âm thanh', 'info');
  });
}

// POPUP GIỚI THIỆU GAME
const modalAbout = document.getElementById('modal-about');
const btnBbInfo = document.getElementById('btn-bb-info');
const btnCloseAbout = document.getElementById('btn-close-about');
const btnCloseAboutOk = document.getElementById('btn-close-about-ok');

if (btnBbInfo && modalAbout) {
  btnBbInfo.addEventListener('click', () => {
    sounds.playClick();
    modalAbout.classList.remove('hidden');
  });
}
if (btnCloseAbout && modalAbout) {
  btnCloseAbout.addEventListener('click', () => {
    sounds.playClick();
    modalAbout.classList.add('hidden');
  });
}
if (btnCloseAboutOk && modalAbout) {
  btnCloseAboutOk.addEventListener('click', () => {
    sounds.playClick();
    modalAbout.classList.add('hidden');
  });
}
if (modalAbout) {
  modalAbout.addEventListener('click', (e) => {
    if (e.target === modalAbout) {
      modalAbout.classList.add('hidden');
    }
  });
}

// POPUP MẸO THI ĐẤU
const modalTips = document.getElementById('modal-tips');
const btnToggleTips = document.getElementById('btn-toggle-tips');
const btnCloseTips = document.getElementById('btn-close-tips');
const btnTipsOk = document.getElementById('btn-tips-ok');

if (btnToggleTips && modalTips) {
  btnToggleTips.addEventListener('click', () => {
    sounds.playClick();
    modalTips.classList.remove('hidden');
  });
}
if (btnCloseTips && modalTips) {
  btnCloseTips.addEventListener('click', () => {
    sounds.playClick();
    modalTips.classList.add('hidden');
  });
}
if (btnTipsOk && modalTips) {
  btnTipsOk.addEventListener('click', () => {
    sounds.playClick();
    modalTips.classList.add('hidden');
  });
}
if (modalTips) {
  modalTips.addEventListener('click', (e) => {
    if (e.target === modalTips) {
      modalTips.classList.add('hidden');
    }
  });
}

// SPLASH LOADING
window.addEventListener('load', () => {
  const fill = document.getElementById('loading-bar-inner');
  const splash = document.getElementById('loading-screen');
  const statusTxt = document.getElementById('loading-status-text');
  let p = 0;
  const stages = [
    { p: 25, txt: 'Đang tải đồ họa WebGL 3D...' },
    { p: 55, txt: 'Thiết lập sân thi đấu & cảm biến...' },
    { p: 85, txt: 'Sẵn sàng hệ thống AI & Realtime...' },
    { p: 100, txt: 'Sẵn sàng tranh tài!' }
  ];
  let stageIdx = 0;
  const interval = setInterval(() => {
    if (stageIdx < stages.length) {
      const target = stages[stageIdx];
      p = target.p;
      if (fill) fill.style.width = `${p}%`;
      if (statusTxt) statusTxt.innerText = target.txt;
      stageIdx++;
    } else {
      clearInterval(interval);
      setTimeout(() => {
        if (splash) {
          splash.classList.add('fade-out');
          setTimeout(() => splash.classList.add('hidden'), 400);
        }
      }, 250);
    }
  }, 110);
});

// ANIMATION LOOP
let lastFrameTime = performance.now();

function animate() {
  requestAnimationFrame(animate);

  const now = performance.now();
  const dt = Math.min((now - lastFrameTime) / 1000, 0.04);
  lastFrameTime = now;

  if (gameMode === 'AI') {
    updateSmartAI(dt);
    updateLocalPhysics(dt);

    puckMesh.position.x = localPuck.x;
    puckMesh.position.z = localPuck.z;
    malletP1.position.x = localMalletP1.x;
    malletP1.position.z = localMalletP1.z;
    malletP2.position.x = localMalletP2.x;
    malletP2.position.z = localMalletP2.z;
  } else if (gameMode === 'ONLINE') {
    if (myRole === 'p1') {
      updateLocalPhysics(dt);
      puckMesh.position.x = localPuck.x;
      puckMesh.position.z = localPuck.z;
      malletP1.position.x = localMalletP1.x;
      malletP1.position.z = localMalletP1.z;
    } else {
      malletP2.position.x = localMalletP2.x;
      malletP2.position.z = localMalletP2.z;
    }
  }

  puckMesh.rotation.y += 0.06;
  particles.update(dt);
  renderer.render(scene, camera);
}
animate();

// RESIZE HANDLER TỰ ĐỘNG CẬP NHẬT GÓC NHÌN CHUẨN MỌI THIẾT BỊ
window.addEventListener('resize', () => {
  updateCameraFraming();
});
