// ===== ŰRPÁRBAJ ONLINE – duel szerver (socket.io) =====
// Szobákra bontott kétjátékos űrhajó-párbaj. A kliensek bemenetet küldenek
// (célpozíció + lövés szándék), a szerver 30 Hz-en szimulál és szórja az
// állapotot. 5 találat dönt, aztán jöhet az újrakezdés.

import { createServer } from "http";
import { Server } from "socket.io";

const httpServer = createServer();
const io = new Server(httpServer, {
  // NE változtasd az útvonalat – a Caddy ennek alapján továbbít!
  path: "/",
  cors: { origin: "*", methods: ["GET", "POST"] },
  pingTimeout: 60000,
  pingInterval: 25000,
});

const PORT = 3004;

interface Player {
  socketId: string;
  x: number;
  y: number;
  hp: number;
  input: { x: number; y: number; shoot: boolean };
  lastShot: number;
  name: string;
}

interface Room {
  code: string;
  players: Player[];
  bullets: { x: number; y: number; vx: number; vy: number; from: number }[];
  started: boolean;
  winner: number | null;
  tickTimer: ReturnType<typeof setInterval> | null;
}

const rooms = new Map<string, Room>();

function makePlayer(socketId: string, you: number): Player {
  return {
    socketId,
    x: 50,
    y: you === 0 ? 82 : 18,
    hp: 5,
    input: { x: 50, y: you === 0 ? 82 : 18, shoot: false },
    lastShot: 0,
    name: you === 0 ? "Arany Szárny" : "Cián Fény",
  };
}

function startMatch(room: Room) {
  room.bullets = [];
  room.winner = null;
  room.started = true;
  room.players.forEach((p, i) => {
    p.x = 50;
    p.y = i === 0 ? 82 : 18;
    p.hp = 5;
    p.input = { x: p.x, y: p.y, shoot: false };
  });
  room.players.forEach((p, i) => {
    io.to(p.socketId).emit("start", {
      you: i,
      players: room.players.map((q) => ({ x: q.x, y: q.y, hp: q.hp, name: q.name })),
      bullets: [],
    });
  });
  if (room.tickTimer) clearInterval(room.tickTimer);
  let last = Date.now();
  room.tickTimer = setInterval(() => {
    const now = Date.now();
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    tick(room, dt, now);
    if (room.players.length === 2) {
      io.to(room.players[0].socketId).emit("state", stateFor(room, 0));
      io.to(room.players[1].socketId).emit("state", stateFor(room, 1));
    }
  }, 33);
}

function stateFor(room: Room, you: number) {
  return {
    you,
    players: room.players.map((p) => ({ x: p.x, y: p.y, hp: p.hp, name: p.name })),
    bullets: room.bullets.map((b) => ({ x: b.x, y: b.y })),
  };
}

function tick(room: Room, dt: number, now: number) {
  if (room.winner !== null) return;
  // hajók követik a kapott célpozíciót (kicsit késleltetve – simítás szerver oldalon)
  room.players.forEach((p, i) => {
    const k = Math.min(1, dt * 7);
    p.x += (p.input.x - p.x) * k;
    p.y += (p.input.y - p.y) * k;
    p.x = Math.max(4, Math.min(96, p.x));
    p.y = Math.max(6, Math.min(94, p.y));
    if (p.input.shoot && now - p.lastShot > 420) {
      p.lastShot = now;
      const foe = room.players[1 - i];
      // lövés az ellenfél felé (a párbaj-logika: a kliens "céloz" a mutatóval)
      const dx = (foe.x - p.x) * 9.6;
      const dy = (foe.y - p.y) * 5.4;
      const len = Math.hypot(dx, dy) || 1;
      room.bullets.push({
        x: p.x, y: p.y,
        vx: (dx / len) * 560, vy: (dy / len) * 560,
        from: i,
      });
    }
    p.input.shoot = false;
  });
  // golyók
  const alive: typeof room.bullets = [];
  for (const b of room.bullets) {
    b.x += (b.vx * dt) / 9.6;
    b.y += (b.vy * dt) / 5.4;
    if (b.x < -4 || b.x > 104 || b.y < -4 || b.y > 104) continue;
    let hit = false;
    room.players.forEach((p, i) => {
      if (i === b.from || p.hp <= 0) return;
      if (Math.hypot(p.x - b.x, p.y - b.y) < 4.2) {
        p.hp--;
        hit = true;
        io.to(p.socketId).emit("hit", { you: true });
        io.to(room.players[1 - i].socketId).emit("hit", { you: false });
      }
    });
    if (!hit) alive.push(b);
  }
  room.bullets = alive.slice(-40);
  // vége?
  const dead = room.players.findIndex((p) => p.hp <= 0);
  if (dead >= 0) {
    room.winner = 1 - dead;
    io.to(room.players[0].socketId).emit("over", { winner: room.winner });
    io.to(room.players[1].socketId).emit("over", { winner: room.winner });
    if (room.tickTimer) clearInterval(room.tickTimer);
    room.tickTimer = null;
  }
}

io.on("connection", (socket) => {
  socket.on("join", (data: { code?: string; name?: string }) => {
    const code = String(data?.code ?? "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);
    if (code.length !== 4) {
      socket.emit("join-error", { message: "Érvénytelen kód" });
      return;
    }
    let room = rooms.get(code);
    if (!room || room.players.length >= 2) {
      if (room && room.players.length >= 2) {
        socket.emit("join-error", { message: "Ez a szoba már tele" });
        return;
      }
      room = { code, players: [], bullets: [], started: false, winner: null, tickTimer: null };
      rooms.set(code, room);
    }
    if (room.players.some((p) => p.socketId === socket.id)) return;
    const you = room.players.length;
    room.players.push(makePlayer(socket.id, you));
    socket.data.code = code;
    socket.emit("joined", { code, you });
    if (room.players.length === 2) {
      startMatch(room);
    }
    console.log(`[duel] ${socket.id} joined room ${code} (${room.players.length}/2)`);
  });

  socket.on("input", (data: { x?: number; y?: number; shoot?: boolean }) => {
    const room = rooms.get(String(socket.data?.code ?? ""));
    if (!room || !room.started) return;
    const p = room.players.find((q) => q.socketId === socket.id);
    if (!p) return;
    p.input.x = Math.max(0, Math.min(100, Number(data?.x ?? 50)));
    p.input.y = Math.max(0, Math.min(100, Number(data?.y ?? 50)));
    if (data?.shoot) p.input.shoot = true;
  });

  socket.on("again", () => {
    const room = rooms.get(String(socket.data?.code ?? ""));
    if (!room || room.players.length !== 2) return;
    socket.emit("again-wait", {});
    if (room.players.every((p) => p.hp <= 0 || p.lastShot >= 0) || room.winner !== null) {
      // ha mindkét fő jelzett (egyszerűsített: az első jelzésre újraindítjuk)
      startMatch(room);
    }
  });

  socket.on("disconnect", () => {
    const code = String(socket.data?.code ?? "");
    const room = rooms.get(code);
    if (!room) return;
    const other = room.players.find((p) => p.socketId !== socket.id);
    room.players = room.players.filter((p) => p.socketId !== socket.id);
    if (room.tickTimer) clearInterval(room.tickTimer);
    if (other) {
      io.to(other.socketId).emit("peer-left", {});
      // az ottmaradott játékos várakozhat új ellenfélre
      room.started = false;
      room.winner = null;
      room.bullets = [];
    } else {
      rooms.delete(code);
    }
    console.log(`[duel] ${socket.id} left room ${code}`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Duel WebSocket server running on port ${PORT}`);
});
