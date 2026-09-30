import { createH } from "./character.js";
import { SPOTS, dialogue } from "./game.js";
const T = AFRAME.THREE;
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
function textLines(ctx, text, x, y, maxWidth, lineHeight) {
  let line = "";
  for (const char of text) {
    if (ctx.measureText(line + char).width > maxWidth) {
      ctx.fillText(line, x, y);
      y += lineHeight;
      line = "";
    }
    line += char;
  }
  if (line) ctx.fillText(line, x, y);
  return y;
}
function rounded(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}
export class Stage {
  constructor(el, onAction) {
    this.el = el;
    this.root = new T.Group();
    el.setObject3D("stage", this.root);
    this.scene = el.sceneEl;
    this.loader = new T.TextureLoader();
    this.textures = SPOTS.map((s) => {
      const t = this.loader.load(`assets/cards/${s.id}.jpg`);
      t.colorSpace = T.SRGBColorSpace;
      return t;
    });
    this.card = new T.Mesh(
      new T.CircleGeometry(0.48, 64),
      new T.MeshBasicMaterial({ map: this.textures[0] }),
    );
    this.card.position.set(-0.18, 0.04, -0.05);
    this.root.add(this.card);
    this.h = createH(T);
    this.h.root.position.set(0.44, 0.02, 0.12);
    this.h.root.scale.setScalar(0.36);
    this.root.add(this.h.root);
    this.effects = new T.Group();
    this.effects.position.set(-0.18, 0.04, 0.02);
    this.root.add(this.effects);
    const accent = new T.MeshBasicMaterial({
      color: 0x74e4cd,
      transparent: true,
      opacity: 0.7,
    });
    this.ripple = new T.Mesh(new T.RingGeometry(0.34, 0.354, 64), accent);
    this.effects.add(this.ripple);
    this.shadow = new T.Mesh(
      new T.PlaneGeometry(0.2, 0.009),
      new T.MeshBasicMaterial({
        color: 0x203b4f,
        transparent: true,
        opacity: 0.7,
      }),
    );
    this.shadow.position.set(0.12, -0.05, 0.01);
    this.effects.add(this.shadow);
    this.fragments = [];
    const gemGeo = new T.OctahedronGeometry(0.065);
    for (let i = 0; i < 4; i++) {
      const gem = new T.Mesh(
        gemGeo,
        new T.MeshStandardMaterial({
          color: SPOTS[i + 1].color,
          emissive: SPOTS[i + 1].color,
          emissiveIntensity: 0.35,
          roughness: 0.3,
        }),
      );
      this.effects.add(gem);
      this.fragments.push(gem);
    }
    this.particles = [];
    const particleGeo = new T.SphereGeometry(0.012, 8, 6);
    for (let i = 0; i < 32; i++) {
      const mat = new T.MeshBasicMaterial({ color: 0xf7a9c3 });
      const p = new T.Mesh(particleGeo, mat);
      this.effects.add(p);
      p.userData.seed = i * 2.39996;
      this.particles.push(p);
    }
    // Two subtle virtual silhouettes. They never purport to animate the camera pixels.
    this.people = new T.Group();
    this.effects.add(this.people);
    for (let i = 0; i < 2; i++) {
      const person = new T.Group();
      person.position.set(-0.3 + i * 0.09, -0.08, 0.012);
      const mat = new T.MeshBasicMaterial({
        color: i ? 0xa26254 : 0x627b81,
        transparent: true,
        opacity: 0.85,
      });
      const head = new T.Mesh(new T.CircleGeometry(0.018, 12), mat);
      head.position.y = 0.095;
      person.add(head);
      const torso = new T.Mesh(new T.PlaneGeometry(0.027, 0.075), mat);
      torso.position.y = 0.036;
      person.add(torso);
      this.people.add(person);
    }
    // Japanese text is painted to a canvas texture, making the same dialogue usable in XR.
    this.canvas = document.createElement("canvas");
    this.canvas.width = 1024;
    this.canvas.height = 480;
    this.ctx = this.canvas.getContext("2d");
    this.panelTexture = new T.CanvasTexture(this.canvas);
    this.panelTexture.colorSpace = T.SRGBColorSpace;
    this.panel = new T.Mesh(
      new T.PlaneGeometry(1.28, 0.6),
      new T.MeshBasicMaterial({
        map: this.panelTexture,
        transparent: true,
        depthTest: false,
      }),
    );
    this.panel.position.set(0, -0.57, 0.16);
    this.panel.renderOrder = 20;
    this.root.add(this.panel);
    this.panel.visible = false;
    this.hit = document.createElement("a-plane");
    this.hit.classList.add("clickable");
    this.hit.setAttribute("width", "1.12");
    this.hit.setAttribute("height", ".1");
    this.hit.setAttribute("position", "0 -0.76 0.18");
    this.hit.setAttribute(
      "material",
      "opacity: 0; transparent: true; depthWrite: false",
    );
    el.append(this.hit);
    this.hit.addEventListener("click", () => {
      if (this.game && (this.notice || this.game.phase !== "scan")) onAction();
    });
    this.hit.setAttribute("visible", false);
    this.phaseTime = 0;
    this.lastTime = 0;
    this.manualForm = null;
    document.fonts.load("30px UtsuboJP").then(() => this.drawPanel());
  }
  setGame(g) {
    const changed = this.gamePhase !== g.phase || this.spotId !== g.spot.id;
    if (changed) {
      this.phaseTime = this.lastTime;
      this.manualForm = null;
    }
    this.game = g;
    this.gamePhase = g.phase;
    this.spotId = g.spot.id;
    this.card.material.map = this.textures[g.index];
    this.card.material.needsUpdate = true;
    this.h.setForm(g.form);
    this.h.setMotion(
      g.phase === "reward"
        ? "celebrate"
        : g.phase === "tutorial"
          ? "wave"
          : "idle",
    );
    this.drawPanel();
  }
  drawPanel() {
    if (!this.game) return;
    const c = this.ctx,
      g = this.game,
      d = this.notice
        ? {
            title: "カメラを確認してください",
            text: this.notice,
            button: "ARを終了して確認",
          }
        : dialogue(g);
    c.clearRect(0, 0, 1024, 480);
    c.fillStyle = "#102c3cf5";
    rounded(c, 0, 0, 1024, 480, 36);
    c.fillStyle = "#74e4cd";
    c.font = "26px UtsuboJP, sans-serif";
    c.fillText(
      `小H  ·  ${g.spot.season}                    時間のかけら ${g.fragments.size} / 4`,
      42,
      52,
    );
    c.fillStyle = "#fff";
    c.font = "bold 38px UtsuboJP, sans-serif";
    c.fillText(d.title, 42, 112);
    c.fillStyle = "#d3e6e8";
    c.font = "30px UtsuboJP, sans-serif";
    textLines(c, d.text, 42, 169, 938, 45);
    c.fillStyle = d.button ? "#74e4cd" : "#254954";
    rounded(c, 42, 358, 940, 84, 18);
    c.fillStyle = d.button ? "#142d3c" : "#c4dedf";
    c.font = "bold 29px UtsuboJP, sans-serif";
    c.textAlign = "center";
    c.fillText(
      d.button || this.scanStatus || "カードを映してください",
      512,
      411,
    );
    c.textAlign = "left";
    this.panelTexture.needsUpdate = true;
  }
  setStatus(s) {
    this.scanStatus = s;
    this.drawPanel();
  }
  setXR(enabled) {
    this.panel.visible = enabled;
    this.hit.setAttribute("visible", enabled);
    this.needsXRPlacement = enabled;
  }
  update(time) {
    // Place from an actual XR animation frame; window RAF can pause in immersive sessions.
    if (this.needsXRPlacement && this.scene.renderer.xr.isPresenting) {
      const camera = this.scene.renderer.xr.getCamera(this.scene.camera);
      const eye = new T.Vector3(),
        direction = new T.Vector3();
      camera.getWorldPosition(eye);
      camera.getWorldDirection(direction);
      direction.y = 0;
      direction.normalize();
      this.el.object3D.position.copy(eye).addScaledVector(direction, 1.8);
      this.el.object3D.position.y = eye.y + 0.12;
      this.el.object3D.rotation.y = Math.atan2(-direction.x, -direction.z);
      this.needsXRPlacement = false;
    }
    this.lastTime = time;
    if (!this.game) return;
    const g = this.game,
      p = g.phase,
      s = g.spot,
      dt = (time - this.phaseTime) / 1000,
      t = reduced ? 0 : time / 1000;
    this.h.update(time, reduced);
    this.h.setForm(this.manualForm || g.form);
    this.h.root.scale.setScalar(
      0.36 *
        (p === "transformed" && !reduced
          ? 1 + Math.sin(Math.min(dt, 1) * Math.PI) * 0.18
          : 1),
    );
    const active = ["opening-live", "restoring", "reward", "ended"].includes(p),
      final = ["finale", "ended"].includes(p);
    const pulse = reduced ? 1 : 1 + Math.sin(t * 3) * 0.06;
    this.ripple.scale.setScalar(
      p === "transformed" ? 1 + Math.min(dt, 1) * 0.8 : pulse,
    );
    this.ripple.material.color.set(s.color);
    this.ripple.material.opacity = p === "scan" ? 0.3 : 0.7;
    this.shadow.visible = g.index === 0;
    this.people.visible = g.index === 0;
    if (active && g.index === 0 && !reduced) {
      this.shadow.rotation.z = t * 0.3;
      this.people.children.forEach(
        (o, i) => (o.rotation.z = Math.sin(t * 2 + i) * 0.07),
      );
    }
    this.fragments.forEach((gem, i) => {
      gem.visible =
        (final && (p !== "ended" || dt < 1)) ||
        (["restoring", "reward"].includes(p) && i === g.index - 1);
      const a = t * 0.8 + (i * Math.PI) / 2,
        radius = p === "ended" ? 0.25 * Math.max(0, 1 - dt) : 0.25;
      gem.position.set(
        final ? Math.cos(a) * radius : 0,
        final ? Math.sin(a) * radius : 0.2,
        0.15,
      );
      gem.rotation.set(t, t * 0.6, 0);
      gem.scale.setScalar(p === "ended" ? Math.max(0.01, 1 - dt) : 1);
    });
    this.particles.forEach((o, i) => {
      o.visible = g.index > 0 && p !== "scan";
      const seed = o.userData.seed;
      const v = active && !reduced ? t : 0;
      o.material.color.set(s.color);
      if (g.index === 1) {
        o.scale.set(1.5, 0.65, 1);
        o.position.set(
          Math.cos(seed + v * 0.3) * (0.12 + i * 0.008),
          Math.sin(seed + v * 0.3) * 0.35,
          0.07 + Math.sin(seed) * 0.03,
        );
        o.rotation.z = seed + v;
      }
      if (g.index === 2) {
        o.scale.set(0.7, 2, 1);
        o.position.set(
          ((i % 5) - 2) * 0.075,
          ((i / 32 + v * 0.5) % 1) * 0.55 - 0.24,
          0.08,
        );
      }
      if (g.index === 3) {
        o.scale.set(1.5, 0.6, 1);
        o.position.set(
          ((seed * 0.16 + v * 0.14) % 1) - 0.5,
          Math.sin(seed + v) * 0.25,
          0.06,
        );
        o.rotation.z = seed + v;
      }
      if (g.index === 4) {
        o.scale.setScalar(0.65);
        o.position.set(
          Math.sin(seed) * 0.38,
          0.4 - ((i / 32 + v * 0.15) % 1) * 0.8,
          0.08,
        );
      }
    });
  }
}
AFRAME.registerComponent("time-stage", {
  init() {
    this.stage = new Stage(this.el, () =>
      window.dispatchEvent(new Event("game-action")),
    );
  },
  tick(time) {
    this.stage?.update(time);
  },
});
