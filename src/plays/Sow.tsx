// 일 놀이 「볍씨 뿌리기」 — 손가락으로 논을 쓸며 볍씨를 뿌린다.
// 1395년에는 볍씨를 논에 바로 뿌렸다(F04). 못자리도, 줄 맞춰 심은 모도 없다. 논은 갈아엎어 물을 댄 흙이다.
//
// 틀림이 없다: 어떻게 뿌려도 일은 끝난다. 시간에 쫓기지 않는다. "어른께 맡긴다"로 건너뛸 수 있다.
// 광주리의 볍씨는 정해져 있어서, 한곳에 오래 머물면 다른 곳에 뿌릴 것이 모자란다.
// 끝난 모습(sowRules.ts): even(논의 칸들에 고루 뿌림) · patchy(빈 칸이 많아 듬성듬성) · left(어른께 맡김 — 거의 뿌리지 않고 끝낸 것도).
// 맞았다·틀렸다는 말도 점수도 없다. 뿌린 자리는 논에 그대로 보인다:
//   - 논물은 잔잔한 어두운 물빛이고, 볍씨가 내려앉은 자리는 물이 일어 한결 밝아진다(뿌린 곳과 빈 곳이 한눈에 갈린다).
//   - 볍씨는 밝은 누런 낟알(석 점 남짓)에 먹빛 그늘을 달아 물빛 위에서 또렷하다. 떨어질 때 잔물결이 한 번 인다.

import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Dir } from '../map/types';
import { paletteOf } from '../pixel/palette';
import { COL, DIRS, HEROES, PERSON_AX, PERSON_AY, PERSON_H, PERSON_W, footShadow, personSheet } from '../pixel/people';
import { Px, fbm, hash2, hex, mix, pick, toCanvas, vnoise } from '../pixel/px';
import { game, heroName } from '../state/store';
import { PlayFrame } from './Frame';
import type { PlayProps } from './index';
import { SOW_ROWS, SOW_SEEDS, emptySowCells, sowCellOf, sowVerdict } from './sowRules';

/**
 * 규칙의 이름표마다의 놀이 방법 한 줄. 지금은 '1395'(논에 바로 뿌린다) 하나다.
 * 뒤 이야기의 모내기 규칙('1795' 등)은 그 이야기를 만들 때 더한다. 모르는 값이면 '1395'의 것을 쓴다.
 */
const HOW_TO: Record<string, string> = {
  '1395': '손가락으로 논을 쓸어 볍씨를 고루 뿌려요. 바구니의 볍씨는 정해져 있어요.',
};

/** 논을 끝에서 끝까지 한 번 쓸 때 나가는 볍씨(바구니 하나로 여섯 번 반쯤 쓴다) */
const PER_PASS = 74;
/** 한 번 눌렀을 때 뿌려지는 한 줌 */
const HANDFUL = 6;
/** 논 둘레의 둑(점) */
const BUND = 12;
/** 볍씨가 손에서 논까지 날아가는 시간(밀리초) */
const FLY_MS = 260;
/** 볍씨가 떨어진 자리에 잔물결이 이는 시간(밀리초) */
const RIPPLE_MS = 520;

// 논물의 빛: 빈 논은 어둡고 잔잔하다. 볍씨가 내려앉은 자리는 물이 일어 밝아진다.
const WATER_DEEP = hex('#47677b');
const WATER_CALM = hex('#52748a');
const WATER_STIRRED = '#86a9b6';
const WATER_RING = '#d6e8e6';
// 볍씨: 밝은 누런 낟알과 먹빛 그늘
const SEED_BODY = ['#f7d95f', '#f1c94a', '#fbe488'];
const SEED_LIGHT = '#fff8cf';
const SEED_SHADE = 'rgba(30, 26, 26, 0.62)';

/** 0~1 밖으로 나간 값을 가장자리(edge)에서 안쪽으로 되접는다 */
function bounce(v: number, edge: number): number {
  const lo = edge;
  const hi = 1 - edge;
  let out = v;
  if (out < lo) out = lo + (lo - out);
  if (out > hi) out = hi - (out - hi);
  return Math.min(hi, Math.max(lo, out));
}

interface Flying {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  born: number;
  tone: number;
}

interface Ripple {
  x: number;
  y: number;
  born: number;
}

/** 위에서 본 논: 풀이 난 둑으로 둘러싸인, 갈아엎어 물을 댄 논. 물은 잔잔하다(볍씨가 묻히지 않게 얼룩을 두지 않는다). */
function paintField(w: number, h: number): Px {
  const pal = paletteOf('spring');
  const px = new Px(w, h);
  const calmLight = mix(WATER_CALM, pal.paddy[1], 0.45);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const edge = Math.min(x, y, w - 1 - x, h - 1 - y) + (vnoise(x / 7, y / 7, 3) - 0.5) * 3;
      const tex = hash2(x, y, 5);
      let c;
      if (edge < BUND - 6) {
        // 둑 바깥의 풀
        c = pick(pal.grass, 0.45 + (fbm(x / 9, y / 9, 7) - 0.5) * 0.6 + (tex - 0.5) * 0.2, x, y, 0.6);
      } else if (edge < BUND - 1) {
        // 논둑(다져진 흙, 군데군데 풀)
        c = tex > 0.82 ? pal.grassTip[1] : pick(pal.soil, 0.7 + (tex - 0.5) * 0.5, x, y, 0.5);
      } else if (edge < BUND) {
        c = pal.soil[0]; // 둑 아래 그늘
      } else if (edge < BUND + 2.2) {
        c = WATER_DEEP; // 둑이 비친 물가
      } else {
        // 물 댄 논: 두 가지 어두운 물빛이 크게, 엷게 번갈아 든다. 가로로 누운 짧은 잔물결이 드문드문 있다.
        const swell = fbm(x / 46, y / 30, 11);
        c = swell > 0.56 ? WATER_CALM : swell > 0.5 && ((x + y) & 1) === 0 ? WATER_CALM : WATER_DEEP;
        if (y % 4 === 1 && hash2(Math.floor(x / 6), y, 13) > 0.93) c = calmLight;
      }
      px.set(x, y, c);
    }
  }
  return px;
}

export function Sow({ rules, onDone }: PlayProps): JSX.Element {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [left, setLeft] = useState(SOW_SEEDS);
  const [touched, setTouched] = useState(false);
  /** 놀이의 셈(그리는 쪽과 누르는 쪽이 함께 본다) */
  const sim = useRef({ cells: emptySowCells(), left: SOW_SEEDS });

  const finish = (): void => onDone(sowVerdict(sim.current.cells));
  const finishRef = useRef(finish);
  finishRef.current = finish;

  useEffect(() => {
    const canvas = canvasRef.current;
    const box = boxRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !box || !ctx) return;
    const s = sim.current;
    const g = game.value;
    const hero = HEROES[g ? heroName(g.role, g.look) : 'farmer-boy'] ?? HEROES['farmer-boy'];
    const sheet = toCanvas(personSheet(hero));
    const shadow = toCanvas(footShadow());

    let w = 0;
    let h = 0;
    let field: HTMLCanvasElement | null = null;
    /** 볍씨가 내려앉아 물이 인 자리를 찍어 두는 겹(논과 같은 크기) */
    const stirred = document.createElement('canvas');
    const mctx = stirred.getContext('2d');
    /** 떨어진 볍씨를 찍어 두는 겹(논과 같은 크기) */
    const sown = document.createElement('canvas');
    const sctx = sown.getContext('2d');
    /** 떨어진 볍씨(논 안의 자리 0~1과 낟알의 빛). 화면 크기가 바뀌면 이것으로 다시 찍는다. */
    const landed: number[] = [];
    const flying: Flying[] = [];
    const ripples: Ripple[] = [];
    // 서 있는 자리(논 안의 자리 0~1)
    const me = { x: 0.5, y: 0.55, dir: 'down' as Dir, step: 0, moving: 0 };
    let down = false;
    let lastX = 0;
    let lastY = 0;
    let owed = 0;
    let rand = 1;
    const rnd = (): number => {
      // 놀이의 흩뿌림에만 쓰는 난수(결과를 가르는 것은 어디에 뿌렸느냐다)
      rand = (Math.imul(rand, 1664525) + 1013904223) >>> 0;
      return rand / 4294967296;
    };

    let paintNow = (): void => {};
    const fw = (): number => Math.max(1, w - BUND * 2);
    const fh = (): number => Math.max(1, h - BUND * 2);
    /** 물이 인 자리의 반지름(점): 칸의 서너 할쯤. 볍씨가 고루 떨어진 곳은 이 자리들이 이어져 밝은 물빛이 된다. */
    const stirR = (): number => Math.max(4, Math.round((fh() / SOW_ROWS) * 0.36));

    /** 볍씨 한 알이 내려앉은 자리: 둥글넓적하게 물이 인다(가장자리는 점으로 흩어진다) */
    const stir = (x: number, y: number): void => {
      if (!mctx) return;
      const r = stirR();
      mctx.fillStyle = WATER_STIRRED;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r - 1; dx <= r + 1; dx++) {
          const px = x + dx;
          const py = y + dy;
          if (px < BUND + 2 || py < BUND + 2 || px >= w - BUND - 2 || py >= h - BUND - 2) continue;
          const d = Math.hypot(dx / (r + 1), dy / r);
          if (d > 1) continue;
          if (hash2(px, py, 97) < (1 - d * d) * 1.2) mctx.fillRect(px, py, 1, 1);
        }
      }
    };

    /** 볍씨 한 알: 석 점 남짓의 밝은 낟알(누운 것과 선 것)과 그 아래·옆의 먹빛 그늘 */
    const stamp = (nx: number, ny: number, tone: number): void => {
      if (!sctx) return;
      const x = Math.round(BUND + nx * fw());
      const y = Math.round(BUND + ny * fh());
      stir(x + 1, y + 1);
      const lying = tone % 2 === 0;
      const bw = lying ? 3 : 2;
      const bh = lying ? 2 : 3;
      sctx.fillStyle = SEED_SHADE;
      sctx.fillRect(x, y + 1, bw + 1, bh);
      sctx.fillStyle = SEED_BODY[tone % SEED_BODY.length];
      sctx.fillRect(x, y, bw, bh);
      sctx.fillStyle = SEED_LIGHT;
      sctx.fillRect(x, y, lying ? 2 : 1, lying ? 1 : 2);
    };

    const resize = (): void => {
      const dpr = window.devicePixelRatio || 1;
      const rect = box.getBoundingClientRect();
      if (rect.width < 8 || rect.height < 8) return;
      const dw = Math.floor(rect.width * dpr);
      const dh = Math.floor(rect.height * dpr);
      // 점 하나가 기기 화소의 정수배가 되게. 논의 높이가 150점쯤 되게 잡는다.
      const scale = Math.max(2, Math.round(dh / 150));
      const nw = Math.max(64, Math.floor(dw / scale));
      const nh = Math.max(48, Math.floor(dh / scale));
      canvas.style.width = `${(nw * scale) / dpr}px`;
      canvas.style.height = `${(nh * scale) / dpr}px`;
      if (nw === w && nh === h) return;
      w = nw;
      h = nh;
      canvas.width = w;
      canvas.height = h;
      field = toCanvas(paintField(w, h));
      stirred.width = w;
      stirred.height = h;
      sown.width = w;
      sown.height = h;
      for (let i = 0; i < landed.length; i += 3) stamp(landed[i], landed[i + 1], landed[i + 2]);
      // 크기를 바꾸면 캔버스가 비워진다. 다음 장을 기다리지 않고 바로 다시 그린다(빈 논이 잠깐 보이지 않게).
      paintNow();
    };

    /** 볍씨 한 알을 (nx, ny) 둘레에 뿌린다 */
    const throwSeed = (nx: number, ny: number, now: number): void => {
      if (s.left <= 0) return;
      // 손끝 둘레로 흩어진다(칸 하나 남짓)
      const reach = (fh() / SOW_ROWS) * 0.75;
      const angle = rnd() * Math.PI * 2;
      const far = Math.sqrt(rnd()) * reach;
      // 둑을 넘어갈 볍씨는 둑에 맞고 논 안쪽으로 떨어진다(둑 밑에 한 줄로 쌓이지 않게)
      const tx = bounce(nx + (Math.cos(angle) * far) / fw(), 0.012);
      const ty = bounce(ny + (Math.sin(angle) * far) / fh(), 0.02);
      s.left--;
      s.cells[sowCellOf(tx, ty)]++;
      flying.push({ x0: nx, y0: ny - 14 / fh(), x1: tx, y1: ty, born: now, tone: Math.floor(rnd() * 6) });
    };

    const report = (): void => {
      setLeft(s.left);
      setTouched(true);
    };

    /** 화면의 점 → 논 안의 자리(0~1) */
    const toField = (ev: PointerEvent): [number, number] => {
      const rect = canvas.getBoundingClientRect();
      const x = ((ev.clientX - rect.left) / rect.width) * w;
      const y = ((ev.clientY - rect.top) / rect.height) * h;
      return [Math.min(1, Math.max(0, (x - BUND) / fw())), Math.min(1, Math.max(0, (y - BUND) / fh()))];
    };

    /** (nx, ny)로 옮겨 가며 지나온 길이만큼 볍씨를 뿌린다 */
    const sweepTo = (nx: number, ny: number, now: number): void => {
      const dx = (nx - lastX) * fw();
      const dy = (ny - lastY) * fh();
      const dist = Math.hypot(dx, dy);
      if (dist > 0.5) {
        me.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
        me.step += dist;
        me.moving = now;
      }
      owed += (dist / fw()) * PER_PASS;
      const n = Math.floor(owed);
      owed -= n;
      for (let i = 0; i < n; i++) {
        const t = n === 1 ? 1 : (i + 1) / n;
        throwSeed(lastX + (nx - lastX) * t, lastY + (ny - lastY) * t, now);
      }
      lastX = nx;
      lastY = ny;
      me.x = nx;
      me.y = ny;
      if (n > 0) report();
    };

    const onDown = (ev: PointerEvent): void => {
      ev.preventDefault();
      canvas.setPointerCapture?.(ev.pointerId);
      down = true;
      const now = performance.now();
      [lastX, lastY] = toField(ev);
      me.x = lastX;
      me.y = lastY;
      me.moving = now;
      for (let i = 0; i < HANDFUL; i++) throwSeed(lastX, lastY, now);
      report();
    };
    const onMove = (ev: PointerEvent): void => {
      if (!down) return;
      ev.preventDefault();
      const [nx, ny] = toField(ev);
      sweepTo(nx, ny, performance.now());
    };
    const onUp = (ev: PointerEvent): void => {
      down = false;
      canvas.releasePointerCapture?.(ev.pointerId);
    };
    // 자판: 화살표로 걸으며 뿌린다(PC와 TV). 바구니가 비면 Enter로 끝낸다.
    const KEYS: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const onKey = (ev: KeyboardEvent): void => {
      if ((ev.key === 'Enter' || ev.key === ' ') && s.left <= 0 && !ev.repeat) {
        ev.preventDefault();
        finishRef.current();
        return;
      }
      const d = KEYS[ev.key];
      if (!d) return;
      ev.preventDefault();
      lastX = me.x;
      lastY = me.y;
      sweepTo(Math.min(1, Math.max(0, me.x + d[0] * 0.035)), Math.min(1, Math.max(0, me.y + d[1] * 0.07)), performance.now());
    };
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('keydown', onKey);

    // 움직임을 줄여 달라고 한 기기에서는 잔물결을 그리지 않는다(물이 인 자리와 볍씨는 그대로 남는다)
    const calm = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let raf = 0;
    let stopped = false;
    /** 한 장을 그린다 */
    const paint = (now: number): void => {
      if (!field) return;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(field, 0, 0);
      // 날아가던 볍씨가 논에 떨어진다
      for (let i = flying.length - 1; i >= 0; i--) {
        const f = flying[i];
        if (now - f.born >= FLY_MS) {
          landed.push(f.x1, f.y1, f.tone);
          stamp(f.x1, f.y1, f.tone);
          // 잔물결은 두 알에 한 번쯤(한꺼번에 너무 많이 일지 않게)
          if (!calm && f.tone % 2 === 0) ripples.push({ x: f.x1, y: f.y1, born: now });
          flying.splice(i, 1);
        }
      }
      ctx.drawImage(stirred, 0, 0);
      // 잔물결: 떨어진 자리에서 둥글넓적한 고리가 한 번 퍼진다
      for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i];
        const t = (now - r.born) / RIPPLE_MS;
        if (t >= 1) {
          ripples.splice(i, 1);
          continue;
        }
        const cx = BUND + r.x * fw() + 1;
        const cy = BUND + r.y * fh() + 1;
        const rad = 2 + t * 5;
        ctx.globalAlpha = 0.8 * (1 - t);
        ctx.fillStyle = WATER_RING;
        const steps = Math.ceil(rad * 5);
        for (let k = 0; k < steps; k++) {
          const a = (k / steps) * Math.PI * 2;
          ctx.fillRect(Math.round(cx + Math.cos(a) * rad), Math.round(cy + Math.sin(a) * rad * 0.62), 1, 1);
        }
      }
      ctx.globalAlpha = 1;
      ctx.drawImage(sown, 0, 0);
      // 나
      const px = Math.round(BUND + me.x * fw());
      const py = Math.round(BUND + me.y * fh());
      const walking = now - me.moving < 160;
      const col = walking ? COL.walk + (Math.floor(me.step / 5) % 4) : COL.idle + (Math.floor(now / 700) % 2);
      ctx.drawImage(shadow, px - 8, py - 3);
      ctx.drawImage(sheet, col * PERSON_W, DIRS.indexOf(me.dir) * PERSON_H, PERSON_W, PERSON_H, px - PERSON_AX, py - PERSON_AY, PERSON_W, PERSON_H);
      // 날아가는 볍씨
      for (const f of flying) {
        const t = Math.min(1, (now - f.born) / FLY_MS);
        const x = Math.round(BUND + (f.x0 + (f.x1 - f.x0) * t) * fw());
        const y = Math.round(BUND + (f.y0 + (f.y1 - f.y0) * t) * fh() - Math.sin(t * Math.PI) * 7);
        ctx.fillStyle = SEED_SHADE;
        ctx.fillRect(x, y + 1, 2, 2);
        ctx.fillStyle = SEED_LIGHT;
        ctx.fillRect(x, y, 2, 2);
      }
    };
    paintNow = () => paint(performance.now());
    const draw = (now: number): void => {
      if (stopped) return;
      raf = requestAnimationFrame(draw);
      if (!document.hidden) paint(now);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(box);
    raf = requestAnimationFrame(draw);
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('keydown', onKey);
    };
  }, []);

  const tenth = Math.ceil((left / SOW_SEEDS) * 10);
  const empty = left <= 0;
  return (
    <PlayFrame
      title="볍씨 뿌리기"
      howTo={HOW_TO[rules] ?? HOW_TO['1395']}
      doneLabel="다 뿌렸어요"
      ready={empty}
      onDone={finish}
      onLeave={() => onDone('left')}
      status={
        <div class="sow-basket">
          <span class="sow-basket-gauge" role="img" aria-label={`바구니에 남은 볍씨: 열 가운데 ${tenth}`}>
            <span class="sow-basket-name">남은 볍씨</span>
            <span class="sow-basket-cells">
              {Array.from({ length: 10 }, (_, index) => (
                <span key={index} class={index < tenth ? 'cell on' : 'cell'} />
              ))}
            </span>
          </span>
          <span class={`sow-basket-say${empty ? ' done' : ''}`} role="status">
            {empty ? '볍씨를 다 뿌렸어요. “다 뿌렸어요”를 눌러요.' : touched ? '밝아진 곳이 볍씨가 내려앉은 자리예요.' : '논을 쓸어 보세요.'}
          </span>
        </div>
      }
    >
      <div class="sow-box" ref={boxRef}>
        <canvas
          class="sow-canvas"
          ref={canvasRef}
          tabIndex={0}
          data-autofocus
          aria-label="물을 댄 논. 손가락으로 쓸면 볍씨가 뿌려져요. 화살표 자판으로도 뿌릴 수 있고, 다 뿌리면 Enter로 끝내요."
        />
      </div>
    </PlayFrame>
  );
}
