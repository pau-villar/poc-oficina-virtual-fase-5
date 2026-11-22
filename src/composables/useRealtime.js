import { ref, shallowRef } from "vue";
import { io } from "socket.io-client";

export function useRealtime() {
  const estatXarxa = ref("Esperant Phaser");
  const usuarisRemots = shallowRef({});
  const url = import.meta.env.VITE_REALTIME_URL || "http://127.0.0.1:3000";
  const socket = io(url, { autoConnect: false });
  let perfilLocal = {};
  let posicioLocal = {};
  let pendent = null;
  let temporitzador = null;

  // També s’executa en reconnectar: enviem l’estat actual.
  socket.on("connect", () => {
    estatXarxa.value = "Connectat";
    socket.emit("entrar", { ...perfilLocal, ...posicioLocal });
  });
  socket.on("estat-inicial", (tots) => {
    usuarisRemots.value = Object.fromEntries(
      Object.entries(tots).filter(([id]) => id !== socket.id),
    );
  });
  socket.on("jugador-actualitzat", (u) => {
    if (u.id === socket.id) return;
    usuarisRemots.value = { ...usuarisRemots.value, [u.id]: u };
  });
  socket.on("jugador-desconnectat", (id) => {
    const copia = { ...usuarisRemots.value };
    delete copia[id];
    usuarisRemots.value = copia;
  });
  socket.on("disconnect", () => {
    estatXarxa.value = "Desconnectat";
    usuarisRemots.value = {};
  });
  socket.on("connect_error", () => {
    estatXarxa.value = "Sense servidor";
  });

  function connectar(perfil, posicio) {
    perfilLocal = { ...perfil };
    posicioLocal = { ...posicio };
    socket.connect(); // App ho crida després de preparat.
  }

  function enviarMoviment(posicio) {
    posicioLocal = { ...posicio };
    if (!socket.connected) return;
    pendent = posicioLocal;
    if (temporitzador !== null) return;
    // Finestra de 80 ms: només enviem la darrera posició rebuda.
    temporitzador = setTimeout(() => {
      if (socket.connected) socket.emit("moure-jugador", pendent);
      temporitzador = null;
    }, 80);
  }

  function enviarPerfil(perfil) {
    perfilLocal = { ...perfil };
    if (socket.connected) socket.emit("actualitzar-perfil", perfilLocal);
  }

  function desconnectar() {
    clearTimeout(temporitzador);
    socket.removeAllListeners();
    socket.disconnect();
  }

  return {
    estatXarxa,
    usuarisRemots,
    connectar,
    enviarMoviment,
    enviarPerfil,
    desconnectar,
  };
}