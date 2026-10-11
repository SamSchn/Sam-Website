// Ambient life for outdoor maps: butterflies by day, fireflies by night,
// leaves drifting off the trees in autumn, and chimney smoke.
import { Container, Sprite, Graphics, Assets } from 'pixi.js';

export const AMBIENT_SHEETS = [
  '/sprites/animals/Butterfly.png',
  '/sprites/trees/Oak_Leaf_Particle.png',
  '/sprites/trees/Birch_Leaf_Particle.png',
  '/sprites/interior/Chimney_smoke_Anim.png',
];

const LEAF_TINTS = [0xffb347, 0xff8c42, 0xe2583e, 0xffd166, 0xffffff];

export function seasonFor(date = new Date()) {
  return ['winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'fall', 'fall', 'fall', 'winter'][date.getMonth()];
}

export class Ambient {
  /**
   * @param world   the World (for textures, solids, map size)
   * @param above   container drawn above entities (leaves, butterflies, smoke)
   * @param glow    additive container drawn above the night tint (fireflies)
   */
  constructor(world, above, glow) {
    this.world = world;
    this.above = above;
    this.glow = glow;
    this.butterflies = [];
    this.fireflies = [];
    this.leaves = [];
    this.smokes = [];
    this.leafTimer = 0;
    this.season = seasonFor();
    this.daylight = 1;
    this.rand = mulberry(7);
  }

  build(map, chimneys) {
    const w = this.world;
    const rand = this.rand;
    const flowers = map.objects.filter(o => /flower/.test(o.sprite || ''));
    const spot = () => {
      if (flowers.length && rand() < 0.8) {
        const f = flowers[Math.floor(rand() * flowers.length)];
        return { x: f.x + 8, y: f.y + 4 };
      }
      return { x: 40 + rand() * (w.mapW - 80), y: 40 + rand() * (w.mapH - 80) };
    };

    // butterflies
    const bfCount = this.season === 'winter' ? 0 : 7;
    for (let i = 0; i < bfCount; i++) {
      const home = spot();
      const color = Math.floor(rand() * 8);
      const s = new Sprite(w.tex(AMBIENT_SHEETS[0], 0, color * 8, 8, 8));
      s.anchor.set(0.5);
      s.position.set(home.x, home.y - 10);
      this.above.addChild(s);
      this.butterflies.push({ s, color, home, x: home.x, y: home.y - 10, vx: 0, vy: 0, tx: home.x, ty: home.y, t: rand() * 10, flap: 0 });
    }

    // fireflies (only visible at night)
    for (let i = 0; i < 16; i++) {
      const home = spot();
      const g = new Sprite(w.glowTexture);
      g.anchor.set(0.5);
      g.width = g.height = 10;
      g.tint = 0xd8ff6a;
      g.blendMode = 'add';
      const dot = new Graphics().rect(-0.5, -0.5, 1, 1).fill(0xf4ffb0);
      dot.blendMode = 'add';
      const c = new Container();
      c.addChild(g, dot);
      this.glow.addChild(c);
      this.fireflies.push({ c, home, x: home.x, y: home.y - 8, phase: rand() * 6.28, speed: 0.4 + rand() * 0.5 });
    }

    // chimney smoke
    for (const ch of chimneys) {
      const frames = [0, 1, 2, 3, 4].map(f => w.tex(AMBIENT_SHEETS[3], f * 32, 0, 32, 32));
      const s = new Sprite(frames[0]);
      s.position.set(ch.x, ch.y);
      s.alpha = 0.8;
      this.above.addChild(s);
      this.smokes.push({ s, frames });
    }

    this.trees = (w.fading || []).map(f => f.rect);
  }

  setDaylight(lights) {
    this.daylight = 1 - lights;
  }

  update(dt, time) {
    const rand = this.rand;
    const day = this.daylight;

    for (const b of this.butterflies) {
      b.t -= dt;
      if (b.t <= 0) {
        b.t = 1.5 + rand() * 2.5;
        b.tx = b.home.x + (rand() - 0.5) * 90;
        b.ty = b.home.y + (rand() - 0.5) * 70;
      }
      b.vx += ((b.tx - b.x) * 0.6 - b.vx) * dt * 2;
      b.vy += ((b.ty - b.y) * 0.6 - b.vy) * dt * 2;
      b.x += b.vx * dt;
      b.y += b.vy * dt + Math.sin(time / 180 + b.home.x) * 0.15;
      b.flap += dt;
      const frame = Math.floor(b.flap * 9) % 2;
      b.s.texture = this.world.tex(AMBIENT_SHEETS[0], frame * 8, b.color * 8, 8, 8);
      b.s.position.set(Math.round(b.x), Math.round(b.y));
      b.s.scale.x = b.vx < 0 ? -1 : 1;
      b.s.alpha = Math.max(0, Math.min(1, (day - 0.3) * 2));
    }

    const night = 1 - day;
    for (const f of this.fireflies) {
      f.phase += dt * f.speed;
      f.x = f.home.x + Math.sin(f.phase * 1.3) * 22 + Math.sin(f.phase * 0.7) * 10;
      f.y = f.home.y - 10 + Math.cos(f.phase) * 14;
      f.c.position.set(Math.round(f.x), Math.round(f.y));
      const blink = 0.5 + 0.5 * Math.sin(time / 300 + f.phase * 4);
      f.c.alpha = Math.max(0, night - 0.35) * 1.6 * blink;
    }

    for (const sm of this.smokes) {
      sm.s.texture = sm.frames[Math.floor(time / 220) % sm.frames.length];
    }

    // autumn leaves drifting off trees near the camera
    if (this.season === 'fall' && this.trees.length) {
      this.leafTimer -= dt;
      if (this.leafTimer <= 0 && this.leaves.length < 40) {
        this.leafTimer = 0.25 + rand() * 0.35;
        const view = this.world.viewRect();
        const near = this.trees.filter(r => r.x + r.w > view.x && r.x < view.x + view.w && r.y + r.h > view.y && r.y < view.y + view.h);
        if (near.length) {
          const r = near[Math.floor(rand() * near.length)];
          const sheet = rand() < 0.5 ? AMBIENT_SHEETS[1] : AMBIENT_SHEETS[2];
          const s = new Sprite(this.world.tex(sheet, 4, 4, 8, 9));
          s.anchor.set(0.5);
          s.tint = LEAF_TINTS[Math.floor(rand() * LEAF_TINTS.length)];
          const x = r.x + r.w * (0.2 + rand() * 0.6);
          const y = r.y + r.h * (0.15 + rand() * 0.35);
          s.position.set(x, y);
          s.scale.set(0.7);
          this.above.addChild(s);
          this.leaves.push({ s, x, y, life: 3 + rand() * 2.5, age: 0, sway: rand() * 6.28, spin: (rand() - 0.5) * 3 });
        }
      }
    }
    for (let i = this.leaves.length - 1; i >= 0; i--) {
      const l = this.leaves[i];
      l.age += dt;
      l.x += (9 + Math.sin(l.age * 2 + l.sway) * 12) * dt;
      l.y += 13 * dt;
      l.s.position.set(Math.round(l.x), Math.round(l.y));
      l.s.rotation += l.spin * dt;
      l.s.alpha = Math.min(1, l.age * 3, (l.life - l.age) / 0.8);
      if (l.age >= l.life) {
        l.s.destroy();
        this.leaves.splice(i, 1);
      }
    }
  }
}

function mulberry(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function preloadAmbient() {
  return Assets.load(AMBIENT_SHEETS);
}
