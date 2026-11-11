import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';

const PORT = process.env.PORT || 3002;

// KÍCH THƯỚC BÀN AIR HOCKEY CHUẨN
const TABLE = {
  width: 18,       // Tường bên: X = -9 đến +9
  length: 32,      // Tường đầu sân: Z = -16 đến +16
  cornerR: 2.2,    // Bo góc vát để bóng trượt mượt mà
  goalWidth: 7.0,  // Cửa gôn từ X = -3.5 đến +3.5
  goalDepth: 3.5,  // Độ sâu của túi gôn
  puckRadius: 0.85,
  malletRadius: 1.35,
  maxPuckSpeed: 48,
  minPuckSpeed: 0.1,
  friction: 0.993,
  restitution: 0.95
};

const server = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok', server: 'Tboy Air Hockey 3D Server' }));
});

const wss = new WebSocketServer({ server });
const rooms = new Map();
const clients = new Map();

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return rooms.has(code) ? generateRoomCode() : code;
}

class GameRoom {
  constructor(code, hostPlayer) {
    this.code = code;
    this.players = [hostPlayer]; // P1: Z > 0 (dưới), P2: Z < 0 (trên)
    this.state = 'WAITING';      // WAITING, COUNTDOWN, PLAYING, GOAL, FINISHED
    this.scores = { p1: 0, p2: 0 };
    this.targetScore = 7;
    
    this.puck = {
      x: 0,
      z: 0,
      vx: 0,
      vz: 0
    };

    this.mallets = {
      p1: { x: 0, z: 11, vx: 0, vz: 0 },
      p2: { x: 0, z: -11, vx: 0, vz: 0 }
    };

    this.lastTick = Date.now();
    this.stuckTimer = 0;
    this.loopInterval = null;
    this.startPhysicsLoop();
  }

  resetPuck(serverRole = 'p1') {
    this.puck.x = 0;
    this.puck.z = serverRole === 'p1' ? 4 : -4;
    this.puck.vx = (Math.random() - 0.5) * 2;
    this.puck.vz = serverRole === 'p1' ? 3.5 : -3.5;
    this.stuckTimer = 0;
  }

  startPhysicsLoop() {
    this.lastTick = Date.now();
    this.loopInterval = setInterval(() => {
      this.updatePhysics();
    }, 1000 / 60);
  }

  stopPhysicsLoop() {
    if (this.loopInterval) {
      clearInterval(this.loopInterval);
      this.loopInterval = null;
    }
  }

  updatePhysics() {
    if (this.state !== 'PLAYING') return;

    const now = Date.now();
    const dt = Math.min((now - this.lastTick) / 1000, 0.04);
    this.lastTick = now;

    // 1. Áp dụng chuyển động & ma sát
    this.puck.x += this.puck.vx * dt;
    this.puck.z += this.puck.vz * dt;

    this.puck.vx *= Math.pow(TABLE.friction, dt * 60);
    this.puck.vz *= Math.pow(TABLE.friction, dt * 60);

    const speed = Math.hypot(this.puck.vx, this.puck.vz);
    if (speed > TABLE.maxPuckSpeed) {
      this.puck.vx = (this.puck.vx / speed) * TABLE.maxPuckSpeed;
      this.puck.vz = (this.puck.vz / speed) * TABLE.maxPuckSpeed;
    }

    // 2. Chống kẹt bóng: Nếu bóng đứng im quá 2.5s ở các góc, đẩy nhẹ ra giữa
    if (speed < 0.4) {
      this.stuckTimer += dt;
      if (this.stuckTimer > 2.0) {
        this.puck.vx = (this.puck.x > 0 ? -1 : 1) * 4.5;
        this.puck.vz = (this.puck.z > 0 ? -1 : 1) * 5.0;
        this.stuckTimer = 0;
      }
    } else {
      this.stuckTimer = 0;
    }

    const halfW = TABLE.width / 2;
    const halfL = TABLE.length / 2;
    const r = TABLE.puckRadius;
    const goalHalf = TABLE.goalWidth / 2;

    // 3. Va chạm tường ngang X (Trái / Phải)
    if (this.puck.x - r < -halfW) {
      this.puck.x = -halfW + r;
      this.puck.vx = Math.abs(this.puck.vx) * TABLE.restitution;
      this.broadcastHit({ type: 'WALL', x: this.puck.x, z: this.puck.z, speed });
    } else if (this.puck.x + r > halfW) {
      this.puck.x = halfW - r;
      this.puck.vx = -Math.abs(this.puck.vx) * TABLE.restitution;
      this.broadcastHit({ type: 'WALL', x: this.puck.x, z: this.puck.z, speed });
    }

    // 4. Va chạm tường dọc Z (Gôn P2 trên & Gôn P1 dưới)
    // Tường trên (P2): Z < -halfL
    if (this.puck.z - r < -halfL) {
      if (Math.abs(this.puck.x) < goalHalf - 0.2) {
        // Vào hẳn trong lưới
        if (this.puck.z < -halfL - 0.8) {
          this.handleGoal('p1');
          return;
        }
      } else {
        // Đập thành trên
        this.puck.z = -halfL + r;
        this.puck.vz = Math.abs(this.puck.vz) * TABLE.restitution;
        this.broadcastHit({ type: 'WALL', x: this.puck.x, z: this.puck.z, speed });
      }
    }

    // Tường dưới (P1): Z > halfL
    if (this.puck.z + r > halfL) {
      if (Math.abs(this.puck.x) < goalHalf - 0.2) {
        if (this.puck.z > halfL + 0.8) {
          this.handleGoal('p2');
          return;
        }
      } else {
        // Đập thành dưới
        this.puck.z = halfL - r;
        this.puck.vz = -Math.abs(this.puck.vz) * TABLE.restitution;
        this.broadcastHit({ type: 'WALL', x: this.puck.x, z: this.puck.z, speed });
      }
    }

    // 5. Va chạm Mallet P1 và P2 (Có cơ chế chống đè ép kẹt bóng)
    this.resolveMalletCollision('p1', this.mallets.p1);
    this.resolveMalletCollision('p2', this.mallets.p2);

    // 6. Broadcast dữ liệu
    this.broadcastState();
  }

  resolveMalletCollision(role, mallet) {
    const dx = this.puck.x - mallet.x;
    const dz = this.puck.z - mallet.z;
    const dist = Math.hypot(dx, dz);
    const minDist = TABLE.puckRadius + TABLE.malletRadius;

    if (dist < minDist && dist > 0.0001) {
      const nx = dx / dist;
      const nz = dz / dist;

      // Đẩy puck ra rìa mallet để triệt tiêu hiện tượng dính/xuyên thấu
      this.puck.x = mallet.x + nx * (minDist + 0.02);
      this.puck.z = mallet.z + nz * (minDist + 0.02);

      // Vận tốc tương đối
      const rvx = this.puck.vx - mallet.vx;
      const rvz = this.puck.vz - mallet.vz;
      const velAlongNormal = rvx * nx + rvz * nz;

      if (velAlongNormal < 0) {
        const impulse = -(1 + TABLE.restitution) * velAlongNormal;
        this.puck.vx += nx * impulse;
        this.puck.vz += nz * impulse;

        // Smash force từ cú vung tay của người chơi
        this.puck.vx += mallet.vx * 0.42;
        this.puck.vz += mallet.vz * 0.42;

        const hitSpeed = Math.hypot(this.puck.vx, this.puck.vz);
        this.broadcastHit({
          type: 'MALLET',
          role,
          x: this.puck.x,
          z: this.puck.z,
          speed: hitSpeed
        });
      }
    }
  }

  handleGoal(scorer) {
    this.state = 'GOAL';
    this.scores[scorer]++;
    
    const isGameOver = this.scores[scorer] >= this.targetScore;
    const winner = isGameOver ? scorer : null;

    this.broadcast({
      type: 'GOAL_SCORED',
      scorer,
      scores: this.scores,
      isGameOver,
      winner
    });

    if (isGameOver) {
      this.state = 'FINISHED';
    } else {
      setTimeout(() => {
        if (this.state === 'GOAL') {
          const nextServer = scorer === 'p1' ? 'p2' : 'p1';
          this.resetPuck(nextServer);
          this.state = 'PLAYING';
          this.broadcast({
            type: 'ROUND_START',
            puck: this.puck,
            scores: this.scores
          });
        }
      }, 1800);
    }
  }

  broadcastHit(hitData) {
    this.broadcast({
      type: 'COLLISION_EVENT',
      ...hitData
    });
  }

  broadcastState() {
    this.broadcast({
      type: 'GAME_TICK',
      puck: this.puck,
      mallets: this.mallets,
      state: this.state
    });
  }

  broadcast(data, excludeWs = null) {
    const msg = JSON.stringify(data);
    for (const p of this.players) {
      if (p.ws !== excludeWs && p.ws.readyState === WebSocket.OPEN) {
        p.ws.send(msg);
      }
    }
  }
}

wss.on('connection', (ws) => {
  const clientId = 'user_' + Math.random().toString(36).substring(2, 9);
  clients.set(ws, { id: clientId, roomCode: null, role: null });

  ws.send(JSON.stringify({
    type: 'CONNECTED',
    clientId
  }));

  ws.on('message', (messageText) => {
    try {
      const data = JSON.parse(messageText);
      const client = clients.get(ws);
      if (!client) return;

      switch (data.type) {
        case 'CREATE_ROOM': {
          const roomCode = generateRoomCode();
          const hostPlayer = {
            id: client.id,
            name: data.playerName || 'Player 1',
            role: 'p1',
            ws
          };
          client.roomCode = roomCode;
          client.role = 'p1';

          const room = new GameRoom(roomCode, hostPlayer);
          rooms.set(roomCode, room);

          ws.send(JSON.stringify({
            type: 'ROOM_CREATED',
            roomCode,
            role: 'p1',
            targetScore: room.targetScore
          }));
          break;
        }

        case 'JOIN_ROOM': {
          const roomCode = (data.roomCode || '').toUpperCase().trim();
          const room = rooms.get(roomCode);

          if (!room) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Phòng không tồn tại!' }));
            return;
          }

          if (room.players.length >= 2) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Phòng đã đủ 2 người chơi!' }));
            return;
          }

          const guestPlayer = {
            id: client.id,
            name: data.playerName || 'Player 2',
            role: 'p2',
            ws
          };
          client.roomCode = roomCode;
          client.role = 'p2';
          room.players.push(guestPlayer);

          room.state = 'PLAYING';
          room.resetPuck('p1');

          ws.send(JSON.stringify({
            type: 'ROOM_JOINED',
            roomCode,
            role: 'p2',
            targetScore: room.targetScore,
            players: room.players.map(p => ({ id: p.id, name: p.name, role: p.role }))
          }));

          room.broadcast({
            type: 'GAME_START',
            players: room.players.map(p => ({ id: p.id, name: p.name, role: p.role })),
            targetScore: room.targetScore,
            puck: room.puck
          });
          break;
        }

        case 'UPDATE_MALLET': {
          if (!client.roomCode) return;
          const room = rooms.get(client.roomCode);
          if (!room || room.state !== 'PLAYING') return;

          const role = client.role;
          if (role && room.mallets[role]) {
            const m = room.mallets[role];
            const halfW = TABLE.width / 2 - TABLE.malletRadius;
            const halfL = TABLE.length / 2 - TABLE.malletRadius;

            let clampedX = Math.max(-halfW, Math.min(halfW, data.x || 0));
            let clampedZ;

            if (role === 'p1') {
              // P1 ở nửa dưới (Z > 0.6 đến Z < halfL)
              clampedZ = Math.max(0.6, Math.min(halfL, data.z || 11));
            } else {
              // P2 ở nửa trên (Z < -0.6 đến Z > -halfL)
              clampedZ = Math.min(-0.6, Math.max(-halfL, data.z || -11));
            }

            m.vx = data.vx || 0;
            m.vz = data.vz || 0;
            m.x = clampedX;
            m.z = clampedZ;
          }
          break;
        }

        case 'RESTART_MATCH': {
          if (!client.roomCode) return;
          const room = rooms.get(client.roomCode);
          if (!room) return;

          room.scores = { p1: 0, p2: 0 };
          room.state = 'PLAYING';
          room.resetPuck('p1');
          room.broadcast({
            type: 'GAME_RESTARTED',
            scores: room.scores,
            puck: room.puck
          });
          break;
        }
      }
    } catch (err) {
      console.error('Socket message error:', err);
    }
  });

  ws.on('close', () => {
    const client = clients.get(ws);
    if (client && client.roomCode) {
      const room = rooms.get(client.roomCode);
      if (room) {
        room.broadcast({
          type: 'PLAYER_DISCONNECTED',
          playerId: client.id,
          role: client.role
        }, ws);
        room.stopPhysicsLoop();
        rooms.delete(client.roomCode);
      }
    }
    clients.delete(ws);
  });
});

server.listen(PORT, () => {
  console.log(`[Tboy Air Hockey 3D Server] Running on http://localhost:${PORT}`);
});
