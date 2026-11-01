// 일 놀이 「김매기」 — 벼 사이사이에 섞여 자란 풀을 가려 뽑는다.
// 1395년에는 볍씨를 논에 바로 뿌렸다(F04). 그래서 벼가 줄지어 서 있지 않고, 풀이 벼와 한데 섞여 자란다.
// 벼와 풀을 하나하나 가려 풀만 뽑아야 하니 손이 많이 간다 — 그것이 이 놀이의 내용이다.
//
// 풀은 누를 때만 뽑힌다. 손가락으로 쓸고 지나가면 벼와 풀 사이를 걸을 뿐이다(문질러 한꺼번에 뽑을 수 없다 — 하나하나 가려 뽑는 것이 내용).
// 자판으로는 화살표로 걷고, Space·Enter로 내가 바라보는 쪽의 풀(노란 테가 둘린 풀)을 뽑는다.
// 틀림이 없다: 벼를 건드려도 벼가 잠깐 누웠다 다시 설 뿐이다. 시간에 쫓기지 않는다. "어른께 맡긴다"로 건너뛸 수 있다.
// 끝난 모습(weedRules.ts): clean(풀을 거의 다 뽑음) · rough(풀이 남음) · left(거의 뽑지 않음).
// "어른께 맡긴다"를 눌러도 뽑은 만큼은 버리지 않는다(weedLeave — 끝내기 단추와 같은 셈).
// 한 것은 논에 그대로 보인다: 풀을 뽑은 자리마다 흙탕물이 일어 물빛이 누렇게 흐려지고, 풀이 섰던 자리가 빈다.

import type { JSX } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Dir } from '../map/types';
import { paletteOf } from '../pixel/palette';
import { COL, DIRS, HEROES, PERSON_AX, PERSON_AY, PERSON_H, PERSON_W, footShadow, personSheet } from '../pixel/people';
import { hash2, toCanvas } from '../pixel/px';
import { heroName } from '../state/store';
import { paintPaddy, riceTuft, weedArt, type Art } from './art';
import { Gauge, PxIcon, Say, useEndOnce } from './bits';
import { PlayFrame } from './Frame';
import type { PlayProps } from './index';
import { mountStage, prefersCalm, unit } from './stage';
import { aheadOf, riceNear, weedCount, weedLeave, weedNear, weedPatch, weedVerdict } from './weedRules';

/**
 * 규칙의 이름표마다의 놀이 방법 한 줄. 지금은 '1395'(논에 바로 뿌려 풀이 섞여 자란 논) 하나다.
 * 뒤 이야기의 "줄 맞춰 옮겨 심은 논"은 그 이야기를 만들 때 더한다. 모르는 값이면 '1395'의 것을 쓴다.
 */
const HOW_TO: Record<string, string> = {
  '1395': '볍씨를 바로 뿌린 논이라 벼와 풀이 섞여 자랐어요. 벼는 두고 풀만 하나씩 눌러 뽑아요.',
};

/** 논 둘레의 둑(점) */
const BUND = 10;
/** 손이 닿는 곳(점): 굵은 손가락으로 눌러도 가까운 풀이 뽑힌다(지름이 화면에서 60px쯤) */
const REACH_X = 10;
const REACH_Y = 9;
/** 풀 하나를 뽑는 데 드는 시간(밀리초). 잇달아 눌러도 이보다 빨리는 뽑히지 않는다 — 한 포기씩 뽑는다. */
const PULL_MS = 170;
/** 자판으로 뽑을 풀에 두르는 테 */
const AIM = '#ffe27a';
/** 뽑힌 풀이 들려 올라가 사라지는 시간 */
const LIFT_MS = 300;
/** 건드린 벼가 누워 있는 시간 */
const BENT_MS = 900;

const MUD = ['#8f8a5e', '#a39c6c', '#77754f'];
const MUD_RING = '#c9c59a';

interface Lift {
  i: number;
  born: number;
}

export function Weed({ rules, facts, onDone }: PlayProps): JSX.Element {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const plants = useMemo(() => weedPatch(rules), [rules]);
  const total = useMemo(() => weedCount(plants), [plants]);
  const [left, setLeft] = useState(total);
  const [touched, setTouched] = useState(false);
  /** 자판으로 뽑으려 했는데 바라보는 쪽에 풀이 없었다(잠깐 알린다) */
  const [missed, setMissed] = useState(0);
  /** 놀이의 셈(그리는 쪽과 누르는 쪽이 함께 본다) */
  const sim = useRef({ gone: new Uint8Array(plants.length), pulled: 0 });
  const muddy = facts.draw === 'drought';

  const { end } = useEndOnce(onDone);
  const finish = (): void => void end(weedVerdict(sim.current.pulled, total));
  // "바라보는 쪽에 풀이 없어요"는 잠깐만 보인다
  useEffect(() => {
    if (!missed) return;
    const timer = window.setTimeout(() => setMissed(0), 2200);
    return () => window.clearTimeout(timer);
  }, [missed]);
  const finishRef = useRef(finish);
  finishRef.current = finish;

  const legend = useMemo(() => {
    const pal = paletteOf('summer');
    return { rice: riceTuft(pal, 1).px, weeds: [weedArt(pal, 0).px, weedArt(pal, 1).px, weedArt(pal, 2).px] };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const box = boxRef.current;
    if (!canvas || !box) return;
    const s = sim.current;
    const pal = paletteOf('summer');
    const hero = HEROES[heroName(facts.role, facts.look)] ?? HEROES['farmer-boy'];
    const sheet = toCanvas(personSheet(hero));
    const shadow = toCanvas(footShadow());
    // 그림: 벼(생김새 셋 × 선 것·왼쪽으로 누운 것·오른쪽으로 누운 것), 풀(세 가지 × 둘)
    const cv = (a: Art): { c: HTMLCanvasElement; ax: number; ay: number } => ({ c: toCanvas(a.px), ax: a.ax, ay: a.ay });
    const rice = [0, 1, 2].map((look) => ([0, -1, 1] as const).map((lean) => cv(riceTuft(pal, look, lean))));
    const weeds = [0, 1, 2].map((kind) => [0, 1].map((look) => cv(weedArt(pal, kind, look))));
    const spriteOf = (i: number, lean: 0 | 1 | 2): { c: HTMLCanvasElement; ax: number; ay: number } => {
      const p = plants[i];
      return p.weed ? weeds[p.look % 3][(p.look >> 1) & 1] : rice[p.look % 3][lean];
    };

    let w = 0;
    let h = 0;
    let field: HTMLCanvasElement | null = null;
    /** 포기마다의 물그림자와, 풀을 뽑은 자리의 흙탕물을 찍어 두는 겹 */
    const marks = document.createElement('canvas');
    const mctx = marks.getContext('2d');
    const bentAt = new Float64Array(plants.length).fill(-1e9);
    const bentTo = new Int8Array(plants.length);
    const lifts: Lift[] = [];
    const me = { x: 0.5, y: 0.6, dir: 'down' as Dir, step: 0, moving: -1e9, working: -1e9 };
    let down = false;
    let lastPull = -1e9;
    /** 자판으로 놀고 있는가(그러면 뽑을 풀에 노란 테를 두른다. 손가락이나 마우스로 누르면 꺼진다) */
    let keyMode = false;
    const calm = prefersCalm();

    const fw = (): number => Math.max(1, w - BUND * 2);
    const fh = (): number => Math.max(1, h - BUND * 2);
    const sx = (nx: number): number => Math.round(BUND + nx * fw());
    const sy = (ny: number): number => Math.round(BUND + ny * fh());

    /** 포기 밑의 물그림자 */
    const shade = (i: number): void => {
      if (!mctx) return;
      const x = sx(plants[i].x);
      const y = sy(plants[i].y);
      mctx.fillStyle = 'rgba(22, 40, 40, 0.34)';
      mctx.fillRect(x - 4, y, 9, 1);
      mctx.fillRect(x - 3, y + 1, 7, 1);
      mctx.fillRect(x - 3, y - 1, 7, 1);
    };
    /** 풀을 뽑은 자리: 흙탕물이 둥글넓적하게 인다(가장자리는 점으로 흩어진다). 가운데에 뿌리가 빠진 자국. */
    const stir = (i: number): void => {
      if (!mctx) return;
      const x = sx(plants[i].x);
      const y = sy(plants[i].y);
      const rx = 8;
      const ry = 5;
      for (let dy = -ry; dy <= ry; dy++) {
        for (let dx = -rx; dx <= rx; dx++) {
          const px = x + dx;
          const py = y + dy;
          if (px < BUND + 1 || py < BUND + 1 || px >= w - BUND - 1 || py >= h - BUND - 1) continue;
          const d = Math.hypot(dx / rx, dy / ry);
          if (d > 1) continue;
          const hsh = hash2(px, py, 211);
          if (hsh < (1 - d * d) * 1.25) {
            mctx.fillStyle = MUD[hsh > 0.8 ? 1 : (px + py) % 5 === 0 ? 2 : 0];
            mctx.fillRect(px, py, 1, 1);
          }
        }
      }
      mctx.fillStyle = '#4a4630';
      mctx.fillRect(x - 1, y, 3, 1);
      mctx.fillRect(x, y - 1, 1, 3);
      mctx.fillStyle = MUD_RING;
      mctx.fillRect(x - 3, y - 2, 2, 1);
      mctx.fillRect(x + 2, y + 2, 2, 1);
    };

    const stage = mountStage(box, canvas, {
      rows: 150,
      cols: 300,
      resized(nw, nh) {
        w = nw;
        h = nh;
        field = toCanvas(paintPaddy(w, h, { season: 'summer', bund: BUND, wet: true, muddy }));
        marks.width = w;
        marks.height = h;
        for (let i = 0; i < plants.length; i++) {
          if (s.gone[i]) stir(i);
          else shade(i);
        }
      },
      paint(ctx, now) {
        if (!field) return;
        ctx.drawImage(field, 0, 0);
        ctx.drawImage(marks, 0, 0);
        const hx = sx(me.x);
        const hy = sy(me.y);
        let heroDrawn = false;
        const drawHero = (): void => {
          heroDrawn = true;
          const walking = now - me.moving < 160;
          const working = now - me.working < 260;
          const col = working ? COL.work + (Math.floor((now - me.working) / 65) % 4) : walking ? COL.walk + (Math.floor(me.step / 5) % 4) : COL.idle + (Math.floor(now / 700) % 2);
          ctx.drawImage(shadow, hx - 8, hy - 3);
          ctx.drawImage(sheet, col * PERSON_W, DIRS.indexOf(me.dir) * PERSON_H, PERSON_W, PERSON_H, hx - PERSON_AX, hy - PERSON_AY, PERSON_W, PERSON_H);
        };
        for (let i = 0; i < plants.length; i++) {
          if (s.gone[i]) continue;
          const p = plants[i];
          const y = sy(p.y);
          if (!heroDrawn && y > hy) drawHero();
          const bent = !p.weed && now - bentAt[i] < BENT_MS;
          const sp = spriteOf(i, bent ? (bentTo[i] < 0 ? 1 : 2) : 0);
          ctx.drawImage(sp.c, sx(p.x) - sp.ax, y - sp.ay);
        }
        if (!heroDrawn) drawHero();
        // 자판으로 놀 때: Space를 누르면 뽑힐 풀(바라보는 쪽)에 노란 테를 두른다
        if (keyMode) {
          const i = aimed();
          if (i >= 0) {
            const p = plants[i];
            const sp = spriteOf(i, 0);
            const x0 = sx(p.x) - sp.ax - 1;
            const y0 = sy(p.y) - sp.ay - 1;
            const x1 = x0 + sp.c.width + 1;
            const y1 = y0 + sp.c.height + 1;
            const blink = calm || Math.floor(now / 450) % 2 === 0;
            ctx.fillStyle = blink ? AIM : '#2a2422';
            for (const [cx, cy, ex, ey] of [
              [x0, y0, 1, 1],
              [x1, y0, -1, 1],
              [x0, y1, 1, -1],
              [x1, y1, -1, -1],
            ]) {
              ctx.fillRect(Math.min(cx, cx + ex * 3), cy, 4, 1);
              ctx.fillRect(cx, Math.min(cy, cy + ey * 3), 1, 4);
            }
          }
        }
        // 뽑혀 올라가는 풀
        for (let k = lifts.length - 1; k >= 0; k--) {
          const lift = lifts[k];
          const t = (now - lift.born) / LIFT_MS;
          if (t >= 1 || calm) {
            lifts.splice(k, 1);
            continue;
          }
          const p = plants[lift.i];
          const sp = spriteOf(lift.i, 0);
          ctx.globalAlpha = 1 - t * t;
          ctx.drawImage(sp.c, sx(p.x) - sp.ax + Math.round(t * 3), sy(p.y) - sp.ay - Math.round(t * 12));
          ctx.globalAlpha = 1;
          // 뿌리에서 떨어지는 흙물
          ctx.fillStyle = MUD[0];
          ctx.fillRect(sx(p.x) - 2, sy(p.y) - Math.round(t * 5), 1, 1);
          ctx.fillRect(sx(p.x) + 2, sy(p.y) - Math.round(t * 8) + 2, 1, 1);
        }
      },
    });
    if (!stage) return;

    const report = (): void => {
      setLeft(total - s.pulled);
      setTouched(true);
    };

    /** 풀 하나를 뽑는다 */
    const pull = (i: number, now: number): void => {
      if (i < 0 || s.gone[i]) return;
      s.gone[i] = 1;
      s.pulled++;
      lastPull = now;
      me.working = now;
      stir(i);
      lifts.push({ i, born: now });
      report();
    };

    /** 자판으로 뽑을 풀: 내가 바라보는 쪽 한 걸음 앞에서 가장 가까운 풀(없으면 내 발치의 풀). 없으면 -1. */
    const aimed = (): number => {
      const [tx, ty] = aheadOf(me.x, me.y, me.dir, fw(), fh());
      const i = weedNear(plants, s.gone, tx, ty, REACH_X / fw(), REACH_Y / fh());
      return i >= 0 ? i : weedNear(plants, s.gone, me.x, me.y, (REACH_X * 0.8) / fw(), (REACH_Y * 0.8) / fh());
    };

    /** 손(과 나)이 (nx, ny)에 닿았다: 둘레의 벼가 눕는다. pick이면(눌렀을 때만) 손 닿는 데의 풀 하나가 뽑힌다. */
    const handAt = (nx: number, ny: number, now: number, pick: boolean): void => {
      const dx = (nx - me.x) * fw();
      const dy = (ny - me.y) * fh();
      const dist = Math.hypot(dx, dy);
      if (dist > 0.5) {
        me.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
        me.step += dist;
        me.moving = now;
      }
      me.x = nx;
      me.y = ny;
      // 밑동이 아니라 포기의 몸통을 누르므로 손의 자리를 조금 내려 잰다
      const hy = ny + 6 / fh();
      for (const i of riceNear(plants, nx, hy, 6 / fw(), 5 / fh())) {
        if (now - bentAt[i] > BENT_MS) bentTo[i] = plants[i].x < nx ? -1 : 1;
        bentAt[i] = now;
      }
      if (pick && now - lastPull >= PULL_MS) pull(weedNear(plants, s.gone, nx, hy, REACH_X / fw(), REACH_Y / fh()), now);
    };

    const toField = (ev: PointerEvent): [number, number] => {
      const [x, y] = stage.at(ev);
      return [unit((x - BUND) / fw()), unit((y - BUND) / fh())];
    };
    const onDown = (ev: PointerEvent): void => {
      ev.preventDefault();
      canvas.setPointerCapture?.(ev.pointerId);
      down = true;
      keyMode = false;
      const [nx, ny] = toField(ev);
      handAt(nx, ny, performance.now(), true);
    };
    // 누른 채 끌면 논을 걸을 뿐이다(지나가는 벼가 잠깐 눕는다). 풀은 다시 눌러야 뽑힌다.
    const onMove = (ev: PointerEvent): void => {
      if (!down) return;
      ev.preventDefault();
      const [nx, ny] = toField(ev);
      handAt(nx, ny, performance.now(), false);
    };
    const onUp = (ev: PointerEvent): void => {
      down = false;
      canvas.releasePointerCapture?.(ev.pointerId);
    };
    // 자판: 화살표로 논을 걷고, Space·Enter로 바라보는 쪽의 풀(노란 테)을 뽑는다. 바라보는 쪽에 풀이 없으면 잠깐 알린다.
    // 풀이 하나도 남지 않았으면 Enter·Space로 끝낸다.
    const KEYS: Record<string, [number, number, Dir]> = {
      ArrowLeft: [-1, 0, 'left'],
      ArrowRight: [1, 0, 'right'],
      ArrowUp: [0, -1, 'up'],
      ArrowDown: [0, 1, 'down'],
    };
    const onKey = (ev: KeyboardEvent): void => {
      const now = performance.now();
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        keyMode = true;
        if (s.pulled >= total) {
          if (!ev.repeat) finishRef.current();
          return;
        }
        if (now - lastPull < PULL_MS) return;
        const i = aimed();
        if (i < 0) {
          setMissed(now);
          return;
        }
        pull(i, now);
        return;
      }
      const d = KEYS[ev.key];
      if (!d) return;
      ev.preventDefault();
      keyMode = true;
      handAt(unit(me.x + d[0] * 0.03), unit(me.y + d[1] * 0.06), now, false);
      me.dir = d[2]; // 끝에 닿아 걸음이 멈춰도 그쪽을 바라본다
    };
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('keydown', onKey);
    // 개발 서버에서만: 아직 안 뽑힌 풀의 자리를 놀이판 캔버스의 보이는 네모에 대한 0~1 비율로 알려 준다
    // (그 자리를 누르면 그 풀이 뽑힌다 — 검증 스크립트가 쓴다). 빌드본에는 없다.
    // __weedMe는 내가 선 자리·바라보는 쪽과 자판으로 뽑을 풀(놀이판 안의 0~1 자리)이다.
    const dev = import.meta.env.DEV ? (window as unknown as { __weeds?: () => [number, number][]; __weedMe?: () => unknown }) : null;
    if (dev) {
      dev.__weeds = () =>
        plants.flatMap((p, i): [number, number][] => (p.weed && !s.gone[i] && w > 0 ? [[(BUND + p.x * fw()) / w, (BUND + p.y * fh() - 6) / h]] : []));
      dev.__weedMe = () => ({ x: me.x, y: me.y, dir: me.dir, aimed: aimed(), fw: fw(), fh: fh() });
    }
    return () => {
      if (dev) {
        delete dev.__weeds;
        delete dev.__weedMe;
      }
      stage.stop();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('keydown', onKey);
    };
  }, []);

  const tenth = Math.ceil((left / total) * 10);
  const clear = left <= 0;
  return (
    <PlayFrame
      title="김매기"
      howTo={HOW_TO[rules] ?? HOW_TO['1395']}
      doneLabel="다 맸어요"
      ready={clear}
      onDone={finish}
      onLeave={() => void end(weedLeave(sim.current.pulled, total))}
      status={
        <div class="play-status-row">
          <span class="play-legend">
            <span class="play-legend-item">
              <PxIcon px={legend.rice} scale={2} />벼
            </span>
            <span class="play-legend-item">
              {legend.weeds.map((px, index) => (
                <PxIcon key={index} px={px} scale={2} />
              ))}
              풀
            </span>
          </span>
          <Gauge name="남은 풀" on={tenth} say={`남은 풀: 열 가운데 ${tenth}`} />
          <Say strong={clear}>
            {clear
              ? '풀을 다 뽑았어요. “다 맸어요”를 눌러요.'
              : missed > 0
                ? '바라보는 쪽에 풀이 없어요. 화살표로 풀 곁에 가요.'
                : touched
                  ? `뽑은 자리에 흙탕물이 일어요. 풀이 ${left}포기 남았어요.`
                  : '벼 사이에 섞인 풀을 하나씩 눌러 뽑아요.'}
          </Say>
        </div>
      }
    >
      <div class="play-box summer" ref={boxRef}>
        <canvas
          class="play-canvas"
          ref={canvasRef}
          tabIndex={0}
          data-autofocus
          aria-label="벼와 풀이 섞여 자란 여름 논. 풀을 누르면 하나씩 뽑혀요. 자판으로는 화살표로 걷고, Space로 바라보는 쪽의 풀을 뽑아요(노란 테가 둘린 풀). 다 뽑으면 Enter로 끝내요."
        />
      </div>
    </PlayFrame>
  );
}
