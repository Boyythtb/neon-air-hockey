import { initializeApp } from 'firebase/app';
import {
  getDatabase,
  ref,
  set,
  get,
  update,
  onValue,
  off,
  remove,
  onDisconnect,
  serverTimestamp
} from 'firebase/database';

// Cấu hình Firebase dùng chung hệ sinh thái Tboy Sports (Project: birdie-bash-3d-2026)
export const firebaseConfig = {
  projectId: "birdie-bash-3d-2026",
  appId: "1:962511515177:web:54bba507b47807d7b8f638",
  databaseURL: "https://birdie-bash-3d-2026-default-rtdb.asia-southeast1.firebasedatabase.app",
  storageBucket: "birdie-bash-3d-2026.firebasestorage.app",
  apiKey: "AIzaSyBjRj4Z9vGA_phvyqfnGRB3_P5RNMx8EfQ",
  authDomain: "birdie-bash-3d-2026.firebaseapp.com",
  messagingSenderId: "962511515177"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);

// Client ID duy nhất cho phiên chơi
export const myClientId = 'user_' + Math.random().toString(36).substring(2, 9);

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// BỘ ĐIỀU PHỐI REALTIME MULTIPLAYER SERVERLESS QUA FIREBASE REALTIME DATABASE
export class FirebaseMultiplayer {
  constructor() {
    this.currentRoomCode = null;
    this.myRole = 'p1'; // 'p1' (host - dưới) hoặc 'p2' (khách - trên)
    this.roomRef = null;
    this.callbacks = {};
    this.roomListener = null;
    this.puckListener = null;
    this.malletListener = null;
    this.scoreListener = null;
    this.lastSentMallet = 0;
  }

  on(event, cb) {
    if (!this.callbacks[event]) this.callbacks[event] = [];
    this.callbacks[event].push(cb);
  }

  emit(event, data) {
    if (this.callbacks[event]) {
      this.callbacks[event].forEach(cb => cb(data));
    }
  }

  // 1. TẠO PHÒNG MỚI (HOST - P1)
  async createRoom(playerName) {
    let roomCode = generateRoomCode();
    let rRef = ref(db, `hockey_rooms/${roomCode}`);
    let snapshot = await get(rRef);
    let attempts = 0;
    while (snapshot.exists() && attempts < 5) {
      roomCode = generateRoomCode();
      rRef = ref(db, `hockey_rooms/${roomCode}`);
      snapshot = await get(rRef);
      attempts++;
    }

    this.currentRoomCode = roomCode;
    this.myRole = 'p1';
    this.roomRef = rRef;

    const initialData = {
      code: roomCode,
      state: 'WAITING', // WAITING, PLAYING, FINISHED
      targetScore: 7,
      createdAt: Date.now(),
      players: {
        p1: { id: myClientId, name: playerName || 'Player 1', role: 'p1' }
      },
      scores: { p1: 0, p2: 0 },
      puck: { x: 0, z: 4, vx: 0, vz: 3.5, hitId: 0 },
      mallets: {
        p1: { x: 0, z: 11, vx: 0, vz: 0 },
        p2: { x: 0, z: -11, vx: 0, vz: 0 }
      }
    };

    await set(this.roomRef, initialData);

    // Tự động xóa phòng nếu Host tắt trình duyệt
    onDisconnect(this.roomRef).remove();

    this.listenToRoom();
    return { roomCode, role: 'p1' };
  }

  // 2. VÀO PHÒNG ĐÃ CÓ (GUEST - P2)
  async joinRoom(roomCode, playerName) {
    const code = roomCode.toUpperCase().trim();
    const rRef = ref(db, `hockey_rooms/${code}`);
    const snap = await get(rRef);

    if (!snap.exists()) {
      throw new Error('Mã phòng không tồn tại!');
    }

    const data = snap.val();
    if (data.players && data.players.p2) {
      throw new Error('Phòng thi đấu đã đủ 2 người!');
    }

    this.currentRoomCode = code;
    this.myRole = 'p2';
    this.roomRef = rRef;

    // Cập nhật người chơi P2 và đổi trạng thái sang PLAYING
    await update(ref(db, `hockey_rooms/${code}`), {
      'players/p2': { id: myClientId, name: playerName || 'Player 2', role: 'p2' },
      state: 'PLAYING',
      'puck/z': 4,
      'puck/vz': 3.5
    });

    onDisconnect(ref(db, `hockey_rooms/${code}/players/p2`)).remove();

    this.listenToRoom();
    return { roomCode: code, role: 'p2' };
  }

  // 3. LẮNG NGHE ĐỒNG BỘ THỜI GIAN THỰC
  listenToRoom() {
    if (!this.roomRef) return;

    // Lắng nghe thay đổi toàn bộ phòng
    this.roomListener = onValue(this.roomRef, (snap) => {
      if (!snap.exists()) {
        this.emit('player_disconnected', {});
        return;
      }
      const data = snap.val();

      // Kiểm tra bắt đầu game khi P2 vào
      if (data.state === 'PLAYING' && data.players && data.players.p1 && data.players.p2) {
        this.emit('game_start', {
          players: [data.players.p1, data.players.p2],
          scores: data.scores
        });
      }

      // Kiểm tra đối thủ thoát
      if (this.myRole === 'p1' && data.state === 'PLAYING' && !data.players.p2) {
        this.emit('player_disconnected', {});
      }
    });

    // Lắng nghe vị trí Mallet đối phương
    const opponentKey = this.myRole === 'p1' ? 'p2' : 'p1';
    this.malletListener = onValue(ref(db, `hockey_rooms/${this.currentRoomCode}/mallets/${opponentKey}`), (snap) => {
      if (snap.exists()) {
        this.emit('opponent_mallet', snap.val());
      }
    });

    // P2 lắng nghe vị trí đĩa từ Host (P1 điều khiển physics mô phỏng)
    if (this.myRole === 'p2') {
      this.puckListener = onValue(ref(db, `hockey_rooms/${this.currentRoomCode}/puck`), (snap) => {
        if (snap.exists()) {
          this.emit('sync_puck', snap.val());
        }
      });
    }

    // Lắng nghe điểm số
    this.scoreListener = onValue(ref(db, `hockey_rooms/${this.currentRoomCode}/scores`), (snap) => {
      if (snap.exists()) {
        this.emit('sync_scores', snap.val());
      }
    });
  }

  // 4. GỬI VỊ TRÍ MALLET CỦA BẢN THÂN
  sendMallet(x, z, vx, vz) {
    if (!this.roomRef || !this.currentRoomCode) return;
    const now = performance.now();
    if (now - this.lastSentMallet < 20) return; // Giới hạn 50Hz để tối ưu băng thông
    this.lastSentMallet = now;

    set(ref(db, `hockey_rooms/${this.currentRoomCode}/mallets/${this.myRole}`), {
      x: Number(x.toFixed(2)),
      z: Number(z.toFixed(2)),
      vx: Number(vx.toFixed(2)),
      vz: Number(vz.toFixed(2))
    });
  }

  // 5. HOST ĐỒNG BỘ VỊ TRÍ ĐĨA PUCK CHO GUEST
  sendPuck(puckData) {
    if (this.myRole !== 'p1' || !this.roomRef || !this.currentRoomCode) return;
    set(ref(db, `hockey_rooms/${this.currentRoomCode}/puck`), {
      x: Number(puckData.x.toFixed(2)),
      z: Number(puckData.z.toFixed(2)),
      vx: Number(puckData.vx.toFixed(2)),
      vz: Number(puckData.vz.toFixed(2)),
      t: Date.now()
    });
  }

  // 6. CẬP NHẬT ĐIỂM SỐ BÀN THẮNG
  async updateScores(scores, scorer) {
    if (!this.currentRoomCode) return;
    await update(ref(db, `hockey_rooms/${this.currentRoomCode}`), {
      scores,
      lastScorer: scorer,
      goalTimestamp: Date.now()
    });
  }

  // RỜI PHÒNG
  leaveRoom() {
    if (this.roomRef) {
      if (this.roomListener) off(this.roomRef, 'value', this.roomListener);
      if (this.myRole === 'p1') {
        remove(this.roomRef);
      } else {
        remove(ref(db, `hockey_rooms/${this.currentRoomCode}/players/p2`));
      }
    }
    this.currentRoomCode = null;
    this.roomRef = null;
  }
}

export const fbMultiplayer = new FirebaseMultiplayer();
