import { createServer } from "node:http";
import { Server } from "socket.io";

const http = createServer();
const io = new Server(http, { cors: { origin: "*" } });
const usuaris = {}; // Només dura mentre aquest procés està obert.

function perfil(p = {}) {
  return {
    nom: String(p.nom || "Convidat").trim().slice(0, 24),
    color: /^#[0-9a-f]{6}$/i.test(p.color) ? p.color : "#10b981",
  };
}

function posicio(p = {}) {
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
  return {
    x: Math.max(0, Math.min(800, p.x)),
    y: Math.max(0, Math.min(576, p.y)),
    direccio: ["avall", "amunt", "dreta", "esquerra"].includes(p.direccio)
      ? p.direccio
      : "avall",
    movent: p.movent === true,
  };
}

io.on("connection", (socket) => {
  // L’avatar entra quan el client ja coneix el seu spawn real.
  socket.on("entrar", (d = {}) => {
    const pos = posicio(d);
    if (!pos) return;
    usuaris[socket.id] = { id: socket.id, ...perfil(d), ...pos };
    socket.emit("estat-inicial", usuaris);
    socket.broadcast.emit("jugador-actualitzat", usuaris[socket.id]);
  });

  socket.on("moure-jugador", (d) => {
    const u = usuaris[socket.id];
    const pos = posicio(d);
    if (!u || !pos) return;
    // L’ID el posa el servidor. El client no pot triar-ne un altre.
    Object.assign(u, pos);
    socket.broadcast.emit("jugador-actualitzat", u);
  });

  socket.on("actualitzar-perfil", (d) => {
    const u = usuaris[socket.id];
    if (!u) return;
    Object.assign(u, perfil(d));
    socket.broadcast.emit("jugador-actualitzat", u);
  });

  socket.on("disconnect", () => {
    delete usuaris[socket.id];
    io.emit("jugador-desconnectat", socket.id);
  });
});

http.listen(3000, "127.0.0.1", () => {
  console.log("Relay actiu a http://127.0.0.1:3000");
});