import * as Phaser from "phaser";
// Phaser gestiona sprites. Aquí no importem Socket.IO.

export class Multiplayer {
  constructor(scene) {
    this.scene = scene;
    this.remots = new Map();
    this.ultimaPosicio = "";
    this.ultimsPropers = null;
    this.ultimVolum = null;
    this.rebreJugadors = (tots) => this.sincronitzar(tots);
    this.rebrePerfil = ({ nom, color }) => {
      scene.etiqueta.setText(`${nom} · tu`);
      scene.jugador.setTint(Number(color.replace("#", "0x")));
    };
    scene.game.events.on("xarxa:jugadors", this.rebreJugadors);
    scene.game.events.on("perfil:local", this.rebrePerfil);
  }

  crear(u) {
    const s = this.scene;
    const sprite = s.add.sprite(0, 0, "george");
    const nom = s.add
      .text(0, -30, u.nom, {
        fontSize: "11px",
        color: "#ffffff",
        backgroundColor: "#334155",
      })
      .setOrigin(0.5);
    // Un únic objecte mou junts l’avatar i el nom.
    const grup = s.add.container(u.x, u.y, [sprite, nom]).setDepth(22);
    const c = { grup, sprite, nom, dades: {} };
    this.remots.set(u.id, c);
    return c;
  }

  sincronitzar(tots) {
    const s = this.scene;
    for (const [id, c] of this.remots) {
      if (tots[id]) continue;
      s.tweens.killTweensOf(c.grup);
      c.grup.destroy();
      this.remots.delete(id);
    }
    for (const u of Object.values(tots)) {
      const c = this.remots.get(u.id) || this.crear(u);
      c.nom.setText(u.nom);
      c.sprite.setTint(Number(u.color.replace("#", "0x")));
      const anterior = c.dades;
      if (u.x !== anterior.x || u.y !== anterior.y) {
        // Evita dos tweens competint per la mateixa posició.
        s.tweens.killTweensOf(c.grup);
        s.tweens.add({
          targets: c.grup,
          x: u.x,
          y: u.y,
          duration: 80,
          ease: "Linear",
        });
      }
      if (u.movent) {
        c.sprite.anims.play(`caminar-${u.direccio}`, true);
      } else {
        c.sprite.anims.stop();
        c.sprite.setFrame(s.frameQuiets[u.direccio]);
      }
      c.dades = u;
    }
  }

  actualitzar() {
    this.actualitzarEspai();
    const s = this.scene;
    const pos = {
      x: Math.round(s.jugador.x),
      y: Math.round(s.jugador.y),
      direccio: s.direccio,
      movent: s.jugador.body.velocity.lengthSq() > 0,
    };
    const signatura = JSON.stringify(pos);
    if (signatura !== this.ultimaPosicio) {
      this.ultimaPosicio = signatura;
      // També emetem movent:false quan ens aturem.
      s.game.events.emit("jugador-mogut-local", pos);
    }
  }

  actualitzarEspai() {
    const s = this.scene;
    const j = s.jugador;
    const propers = [];
    for (const [id, c] of this.remots) {
      const distancia = Phaser.Math.Distance.Between(
        j.x,
        j.y,
        c.grup.x,
        c.grup.y,
      );
      if (distancia <= 130) propers.push(id);
    }
    const signatura = propers.sort().join(",");
    if (signatura !== this.ultimsPropers) {
      this.ultimsPropers = signatura;
      s.game.events.emit("proximitat-canviada", propers);
    }
    // Radi inscrit: volum 1 al centre, 0 fora d’aquest radi.
    const rect = s.zonaActual?.rect;
    let factor = 0;
    if (rect) {
      const distancia = Phaser.Math.Distance.Between(
        j.x,
        j.y + 14,
        rect.centerX,
        rect.centerY,
      );
      const radi = Math.min(rect.width, rect.height) / 2;
      factor = Phaser.Math.Clamp(1 - distancia / radi, 0, 1);
    }
    const monitor = s.monitors.find((m) => m.zona.id === s.zonaActual?.id);
    if (monitor?.video) monitor.video.volume = factor;
    // El mateix vídeo conserva el volum quan passa al modal.
    const volum = Math.round(factor * 100);
    if (volum !== this.ultimVolum) {
      this.ultimVolum = volum;
      s.game.events.emit("volum-sala", volum);
    }
  }

  destroy() {
    const s = this.scene;
    s.game.events.off("xarxa:jugadors", this.rebreJugadors);
    s.game.events.off("perfil:local", this.rebrePerfil);
    for (const c of this.remots.values()) {
      s.tweens.killTweensOf(c.grup);
      c.grup.destroy();
    }
    this.remots.clear();
  }
}