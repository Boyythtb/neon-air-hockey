import * as THREE from 'three';

export const TABLE_DIM = {
  LENGTH: 32,
  WIDTH: 18,
  HALF_LENGTH: 16,
  HALF_WIDTH: 9,
  GOAL_WIDTH: 7.0,
  CORNER_RADIUS: 2.2,
  WALL_HEIGHT: 1.4,
  WALL_THICKNESS: 1.2
};

export function createHockeyTable() {
  const tableGroup = new THREE.Group();

  // 1. SÀN GỖ SÁNG ẤM ÁP TỰ NHIÊN (Warm Maple Wood Parquet y hệt Birdie Bash)
  const woodGeo = new THREE.PlaneGeometry(64, 64);
  const woodMat = new THREE.MeshStandardMaterial({
    color: 0xfde047, // Vàng gỗ sáng ấm áp đặc trưng Birdie Bash
    roughness: 0.35,
    metalness: 0.02
  });
  const woodFloor = new THREE.Mesh(woodGeo, woodMat);
  woodFloor.rotation.x = -Math.PI / 2;
  woodFloor.position.y = -0.01;
  woodFloor.receiveShadow = true;
  tableGroup.add(woodFloor);

  // Vân gỗ parquet thanh lịch
  const woodCanvas = document.createElement('canvas');
  woodCanvas.width = 512;
  woodCanvas.height = 512;
  const wctx = woodCanvas.getContext('2d');
  wctx.fillStyle = '#fde68a';
  wctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 512; i += 28) {
    wctx.fillStyle = i % 56 === 0 ? 'rgba(217, 119, 6, 0.08)' : 'rgba(180, 83, 9, 0.04)';
    wctx.fillRect(0, i, 512, 26);
    wctx.strokeStyle = 'rgba(217, 119, 6, 0.14)';
    wctx.lineWidth = 1;
    wctx.strokeRect(0, i, 512, 28);
  }
  const woodTex = new THREE.CanvasTexture(woodCanvas);
  woodTex.wrapS = THREE.RepeatWrapping;
  woodTex.wrapT = THREE.RepeatWrapping;
  woodTex.repeat.set(10, 10);
  woodMat.map = woodTex;
  woodMat.needsUpdate = true;

  // 2. MẶT BÀN AIR HOCKEY MÀU MINT GREEN TƯƠI TẮN (Pastel Turquoise / Mint Green)
  const surfaceGeo = new THREE.PlaneGeometry(TABLE_DIM.WIDTH, TABLE_DIM.LENGTH);
  const surfaceMat = new THREE.MeshStandardMaterial({
    color: 0x34d399, // Xanh mint tươi sáng đặc trưng của Birdie Bash
    roughness: 0.35,
    metalness: 0.02
  });
  const surface = new THREE.Mesh(surfaceGeo, surfaceMat);
  surface.rotation.x = -Math.PI / 2;
  surface.position.y = 0.01;
  surface.receiveShadow = true;
  tableGroup.add(surface);

  // Vẽ các vạch kẻ sân thể thao màu trắng sắc nét & hoa văn tinh tế
  const surfaceCanvas = document.createElement('canvas');
  surfaceCanvas.width = 1024;
  surfaceCanvas.height = 2048;
  const sctx = surfaceCanvas.getContext('2d');
  
  // Nền Mint tươi
  sctx.fillStyle = '#34d399';
  sctx.fillRect(0, 0, 1024, 2048);

  // Lỗ đệm khí li ti màu ngọc bích nhạt
  sctx.fillStyle = 'rgba(16, 185, 129, 0.25)';
  for (let y = 32; y < 2048; y += 26) {
    for (let x = 32; x < 1024; x += 26) {
      sctx.fillRect(x, y, 2.5, 2.5);
    }
  }

  // Vạch chia đôi giữa sân (Trắng tinh khôi)
  sctx.strokeStyle = '#ffffff';
  sctx.lineWidth = 14;
  sctx.beginPath();
  sctx.moveTo(0, 1024);
  sctx.lineTo(1024, 1024);
  sctx.stroke();

  // Vòng tròn trung tâm
  sctx.lineWidth = 10;
  sctx.beginPath();
  sctx.arc(512, 1024, 240, 0, Math.PI * 2);
  sctx.stroke();

  // Tâm điểm đỏ hồng rực rỡ
  sctx.fillStyle = '#f43f5e';
  sctx.beginPath();
  sctx.arc(512, 1024, 32, 0, Math.PI * 2);
  sctx.fill();

  // Vòng bán nguyệt gôn P2 (trên)
  sctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  sctx.lineWidth = 10;
  sctx.beginPath();
  sctx.arc(512, 80, 360, 0, Math.PI);
  sctx.stroke();

  // Vòng bán nguyệt gôn P1 (dưới)
  sctx.beginPath();
  sctx.arc(512, 1968, 360, Math.PI, 0);
  sctx.stroke();

  const surfaceTex = new THREE.CanvasTexture(surfaceCanvas);
  surfaceMat.map = surfaceTex;
  surfaceMat.needsUpdate = true;

  // 3. THÀNH BÀN BO VIỀN MÀU HỒNG PHẤN PASTEL (Soft Rose / Navy Accent)
  const railMat = new THREE.MeshStandardMaterial({
    color: 0x1e1b4b, // Deep Navy tạo độ tương phản sang trọng
    roughness: 0.25,
    metalness: 0.08
  });
  const railTopMat = new THREE.MeshStandardMaterial({
    color: 0xf472b6, // Hồng phấn ấm áp chuẩn khán đài Birdie Bash
    roughness: 0.3
  });

  const wallH = TABLE_DIM.WALL_HEIGHT;
  const wallT = TABLE_DIM.WALL_THICKNESS;

  // Thành trái & phải
  const sideGeo = new THREE.BoxGeometry(wallT, wallH, TABLE_DIM.LENGTH + wallT * 2);
  const leftWall = new THREE.Mesh(sideGeo, railMat);
  leftWall.position.set(-TABLE_DIM.HALF_WIDTH - wallT / 2, wallH / 2, 0);
  leftWall.castShadow = true;
  leftWall.receiveShadow = true;
  tableGroup.add(leftWall);

  const rightWall = new THREE.Mesh(sideGeo, railMat);
  rightWall.position.set(TABLE_DIM.HALF_WIDTH + wallT / 2, wallH / 2, 0);
  rightWall.castShadow = true;
  rightWall.receiveShadow = true;
  tableGroup.add(rightWall);

  // Nắp ốp trên thành màu hồng pastel tươi tắn
  const railCapGeo = new THREE.BoxGeometry(wallT * 0.95, 0.16, TABLE_DIM.LENGTH + wallT * 2);
  const leftCap = new THREE.Mesh(railCapGeo, railTopMat);
  leftCap.position.set(-TABLE_DIM.HALF_WIDTH - wallT / 2, wallH + 0.08, 0);
  tableGroup.add(leftCap);

  const rightCap = new THREE.Mesh(railCapGeo, railTopMat);
  rightCap.position.set(TABLE_DIM.HALF_WIDTH + wallT / 2, wallH + 0.08, 0);
  tableGroup.add(rightCap);

  // Thành phía đầu bàn gôn
  const sideW = (TABLE_DIM.WIDTH - TABLE_DIM.GOAL_WIDTH) / 2;
  const endWallGeo = new THREE.BoxGeometry(sideW, wallH, wallT);

  // Phía trên (P2)
  const p2Left = new THREE.Mesh(endWallGeo, railMat);
  p2Left.position.set(-TABLE_DIM.HALF_WIDTH + sideW / 2, wallH / 2, -TABLE_DIM.HALF_LENGTH - wallT / 2);
  p2Left.castShadow = true;
  tableGroup.add(p2Left);

  const p2Right = new THREE.Mesh(endWallGeo, railMat);
  p2Right.position.set(TABLE_DIM.HALF_WIDTH - sideW / 2, wallH / 2, -TABLE_DIM.HALF_LENGTH - wallT / 2);
  p2Right.castShadow = true;
  tableGroup.add(p2Right);

  // Túi gôn P2
  const goalPocketP2 = new THREE.Mesh(
    new THREE.BoxGeometry(TABLE_DIM.GOAL_WIDTH, wallH * 0.7, 1.2),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8 })
  );
  goalPocketP2.position.set(0, wallH * 0.35, -TABLE_DIM.HALF_LENGTH - wallT - 0.5);
  tableGroup.add(goalPocketP2);

  // Phía dưới (P1)
  const p1Left = new THREE.Mesh(endWallGeo, railMat);
  p1Left.position.set(-TABLE_DIM.HALF_WIDTH + sideW / 2, wallH / 2, TABLE_DIM.HALF_LENGTH + wallT / 2);
  p1Left.castShadow = true;
  tableGroup.add(p1Left);

  const p1Right = new THREE.Mesh(endWallGeo, railMat);
  p1Right.position.set(TABLE_DIM.HALF_WIDTH - sideW / 2, wallH / 2, TABLE_DIM.HALF_LENGTH + wallT / 2);
  p1Right.castShadow = true;
  tableGroup.add(p1Right);

  // Túi gôn P1
  const goalPocketP1 = new THREE.Mesh(
    new THREE.BoxGeometry(TABLE_DIM.GOAL_WIDTH, wallH * 0.7, 1.2),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8 })
  );
  goalPocketP1.position.set(0, wallH * 0.35, TABLE_DIM.HALF_LENGTH + wallT + 0.5);
  tableGroup.add(goalPocketP1);

  // 4. KHỐI BO GÓC BÀN VÁT TRÒN (CHỐNG KẸT ĐĨA Ở 4 GÓC)
  const cornerMat = new THREE.MeshStandardMaterial({ color: 0x1e1b4b, roughness: 0.3 });
  const cornerGeo = new THREE.CylinderGeometry(2.2, 2.2, wallH, 24);
  
  const corners = [
    { x: -TABLE_DIM.HALF_WIDTH + 0.8, z: -TABLE_DIM.HALF_LENGTH + 0.8 },
    { x: TABLE_DIM.HALF_WIDTH - 0.8, z: -TABLE_DIM.HALF_LENGTH + 0.8 },
    { x: -TABLE_DIM.HALF_WIDTH + 0.8, z: TABLE_DIM.HALF_LENGTH - 0.8 },
    { x: TABLE_DIM.HALF_WIDTH - 0.8, z: TABLE_DIM.HALF_LENGTH - 0.8 }
  ];

  corners.forEach(pos => {
    const c = new THREE.Mesh(cornerGeo, cornerMat);
    c.position.set(pos.x, wallH / 2, pos.z);
    c.castShadow = true;
    tableGroup.add(c);
  });

  return tableGroup;
}
