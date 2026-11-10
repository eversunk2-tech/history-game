// 일 놀이 「가을걷이와 나라 몫」 — 누렇게 익은 벼를 베어 거두고, 거둔 것에서 나라 몫을 덜어 놓는다.
// 두 마디다. ① 벼 베기: 손가락으로 논을 쓸면 지나간 자리의 벼가 베여 눕는다(벼는 줄지어 서 있지 않다 — 봄에 바로 뿌린 논이다).
//           ② 나라 몫: 벼를 떨어 담은 곡식 자루 열 가운데 하나를 나라 몫 자리(멍석)로 옮긴다 — 열에 하나쯤이 나라 몫이었다(F58).
//              (대본의 "열 자루에서 한 자루를 나라 몫으로 덜어 놓았다"와 같은 그림이다.)
// 큰비가 온 해(뽑기 'drought')에는 논 곳곳에 물이 고여 벨 벼가 적고, 자루도 열 자리 가운데 여섯뿐이다
// (봄에 볍씨를 낮은 논에만 몰아 뿌렸으면 — 표시 'sow.low' — 잠긴 자리가 더 넓고 자루는 넷이다. 대본의 "지난해의 반도 안 된다").
// 그리고 나라가 그해에 낼 곡식을 받지 않아(F55) 나라 몫 자리가 빈 채로 남는다 — 여느 해와의 차이가 그림으로 보인다.
//
// 틀림이 없다: 덜 베고 끝내면 남은 벼는 식구들이 마저 벤다(이삭이 조금 남는다). 나라 몫을 옮기지 않고 끝내도 어른이 옮긴다.
// 시간에 쫓기지 않는다. "어른께 맡긴다"로 언제든 건너뛸 수 있다 — 논에서 맡겨도 마당의 걸음을 건너뛰지 않는다:
// 식구들이 마저 베고, 어른이 자루 하나를 나라 몫으로 덜어 놓는 것(큰비 해에는 빈 멍석)이 보이고 나서 끝난다.
// 끝난 모습은 내가 벤 만큼으로 가린다(harvestLeave — 끝내기 단추와 같은 셈).
// 끝난 모습(harvestRules.ts): all(다 거둠) · some(이삭을 남김) · left(어른께 맡김 — 거의 베지 않고 끝낸 것도).
// 농민이 낸 곡식을 누가 거두어 갔는지는 확인하지 못해 "나라 몫"으로만 보인다(받으러 온 사람을 그리지 않는다 — spec 12.3의 9번).
// 벼·그루터기·볏단·자루·멍석과 마당의 자국은 그림 점(놀이 점의 반)으로 곱게 그린다(spec 4.7.5). 놓는 자리와 누르는 자리는 놀이 점 그대로다.

import type { JSX } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Dir } from '../map/types';
import { paletteOf } from '../pixel/palette';
import { COL, DIRS, HEROES, footShadow, personOf, personSheet } from '../pixel/people';
import { ART, hash2, toCanvas, withAlpha } from '../pixel/px';
import { WARM_DARK } from '../pixel/wash';
import { heroName } from '../state/store';
import { drawArt, drawBase, drawFoot, drawPerson, goldClump, matArt, paintPaddy, paintYard, sackArt, shadowArt, sheafArt, silhouette, stubbleArt, swathArt, type Art } from './art';
import { Gauge, Say, useEndOnce } from './bits';
import { PlayFrame } from './Frame';
import { clumpsNear, harvestField, harvestLeave, harvestVerdict, harvestYield, isRainYear, type HarvestEnd } from './harvestRules';
import type { PlayProps } from './index';
import { marks } from '../content/episodes/s1395';
import { mountStage, prefersCalm, unit } from './stage';

/** 놀이 방법 한 줄(마디마다). 규칙의 이름표는 지금 '1395' 하나다(모르는 값이면 이것을 쓴다). */
const HOW_TO = {
  reap: '손가락으로 논을 쓸어 누렇게 익은 벼를 베요.',
  share: '거둔 곡식의 열에 하나쯤은 나라 몫이었어요. 자루 하나를 나라 몫 자리로 옮겨요.',
  eased: '큰비가 온 해예요. 나라가 올해 몫을 받지 않아서 나라 몫 자리가 비어 있어요.',
};

/** 논 둘레의 둑(점) */
const BUND = 10;
/** 낫이 닿는 곳(점) */
const REACH_X = 10;
const REACH_Y = 8;
/** 벤 벼가 넘어가는 시간(밀리초) */
const FALL_MS = 160;
/**
 * 봄에 볍씨를 냇가 낮은 논에만 몰아 뿌렸다는 표시(큰비가 온 해에 거둔 것이 더 적다).
 * 놀이는 이름을 따로 적지 않고 ①의 에피소드 표의 이름표(marks)에서 읽는다(4-1 ㉡, 1-라 Review 43번 — 값은 3판 그대로).
 */
const LOW_ONLY = marks.sowLow;
/** 남은 벼를 식구들이 마저 베는 시간 */
const GATHER_MS = 900;
/** 자루가 나라 몫 자리로 옮겨 가는 시간 */
const MOVE_MS = 650;

type Phase = 'reap' | 'gather' | 'share';

export function Harvest({ facts, onDone }: PlayProps): JSX.Element {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rain = isRainYear(facts.draw);
  const low = facts.flags.includes(LOW_ONLY);
  const field = useMemo(() => harvestField(facts.draw, low), [facts.draw, low]);
  const yields = useMemo(() => harvestYield(facts.draw, low), [facts.draw, low]);
  const total = field.clumps.length;
  const [left, setLeft] = useState(total);
  const [touched, setTouched] = useState(false);
  const [phase, setPhase] = useState<Phase>('reap');
  /** 나라 몫 자리로 옮긴 자루의 수와, 누가 옮겼는가 */
  const [given, setGiven] = useState(0);
  const [givenBy, setGivenBy] = useState<'me' | 'adult'>('me');
  /** "어른께 맡긴다"를 눌렀다(남은 걸음을 어른이 한다) */
  const [leaving, setLeaving] = useState(false);
  /** 글 딱지를 놓을 자리(놀이판 너비·높이에 대한 몫) */
  const [spots, setSpots] = useState({ oursX: 0.3, oursY: 0.1, matX: 0.8, matY: 0.3 });
  /** 놀이의 셈과, 화면 쪽에서 놀이판에 시키는 일 */
  const sim = useRef({
    cut: new Uint8Array(total),
    mine: 0,
    end: 'left' as HarvestEnd,
    phase: 'reap' as Phase,
    given: 0,
    closing: false,
    /** "어른께 맡긴다"를 눌렀다: 마당에 닿으면 어른이 남은 걸음을 하고 끝난다 */
    leaving: false,
    /** 끝맺음을 미뤄 둔 것(어른이 자루를 옮기는 동안). 놀이가 치워지면 지운다. */
    timer: 0,
    toShare: (_end?: HarvestEnd): void => {},
    give: ((): boolean => false) as (auto: boolean, from?: number) => boolean,
  });
  const { end: endOnce } = useEndOnce(onDone);

  /**
   * 마당에서 끝맺는다: 나라 몫을 아직 옮기지 않았으면 어른이 옮기는 것을 보이고 나서 끝난다(덜려 나가는 것이 언제나 눈에 보이게).
   * 큰비 해에는 빈 멍석을 잠깐 보이고 끝난다.
   */
  const closeShare = (wait: number, hold = 0): void => {
    const s = sim.current;
    if (s.phase !== 'share' || s.closing) return;
    s.closing = true;
    const calm = prefersCalm();
    // 어른이 자루를 옮긴다: 옮기는 것이 보이고(wait만큼 더 머물고) 끝난다
    if (s.given < yields.nation && s.give(true)) {
      s.timer = window.setTimeout(() => endOnce(s.end), calm ? 300 : MOVE_MS + wait);
      return;
    }
    // 옮길 것이 없다(이미 옮겼거나 큰비 해): hold만큼 마당을 보이고 끝난다(0이면 곧바로)
    if (hold > 0) s.timer = window.setTimeout(() => endOnce(s.end), calm ? 300 : hold);
    else endOnce(s.end);
  };
  const closeShareRef = useRef(closeShare);
  closeShareRef.current = closeShare;

  const finish = (): void => {
    const s = sim.current;
    if (s.leaving) return;
    if (s.phase === 'reap') {
      s.toShare();
      return;
    }
    closeShare(500);
  };

  /** 어른께 맡긴다: 논에서면 식구들이 마저 베고 마당으로, 마당에서는 어른이 나라 몫을 덜어 놓고 끝난다 */
  const leave = (): void => {
    const s = sim.current;
    if (s.closing || s.leaving) return;
    s.leaving = true;
    setLeaving(true);
    if (s.phase === 'reap') s.toShare(harvestLeave(s.mine, total));
    else if (s.phase === 'share') closeShare(900, yields.eased ? 1600 : 0);
    // 식구들이 베는 동안(gather)이면 마당에 닿을 때 이어서 한다
  };
  const finishRef = useRef(finish);
  finishRef.current = finish;

  useEffect(() => {
    const canvas = canvasRef.current;
    const box = boxRef.current;
    if (!canvas || !box) return;
    const s = sim.current;
    const pal = paletteOf('autumn');
    const calm = prefersCalm();
    const hero = HEROES[heroName(facts.role, facts.look)] ?? HEROES['farmer-boy'];
    const sheet = toCanvas(personSheet(hero));
    /** 어른(아버지): 식구들이 마저 벨 때와, 맡긴 나라 몫을 덜어 놓을 때 나와서 한다 */
    const elder = toCanvas(personSheet(personOf('father') ?? HEROES['farmer-boy']));
    const shadow = toCanvas(footShadow());
    const cv = (a: Art): { c: HTMLCanvasElement; ax: number; ay: number } => ({ c: toCanvas(a.px), ax: a.ax, ay: a.ay });
    const clumpArt = [0, 1, 2, 3].map((look) => cv(goldClump(look)));
    const stubble = [0, 1].map((look) => cv(stubbleArt(look)));
    const stubbleEars = [0, 1].map((look) => cv(stubbleArt(look, true)));
    const swath = [0, 1].map((look) => cv(swathArt(look)));
    const sack = cv(sackArt(pal, 'grain'));
    const sackShade = toCanvas(shadowArt(13, 4, 90));
    const sheaf = cv(sheafArt(pal));
    /** 볏단 밑의 그림자(1-라의 놀이 점 20×3 자리 — 따뜻한 밤빛으로 둥글넓적하게) */
    const sheafShade = toCanvas(shadowArt(10, 1.5, 77));
    const clumps = field.clumps;

    let w = 0;
    let h = 0;
    let paddy: HTMLCanvasElement | null = null;
    let yard: HTMLCanvasElement | null = null;
    /** 벤 자리(그루터기와 눕혀 놓은 벼)를 찍어 두는 겹 */
    const marks = document.createElement('canvas');
    const mctx = marks.getContext('2d');
    const cutAt = new Float64Array(total).fill(-1e9);
    /** 식구들이 마저 벤 포기(이삭이 곁에 남는다) */
    const byFamily = new Uint8Array(total);
    const me = { x: 0.5, y: 0.6, dir: 'down' as Dir, step: 0, moving: -1e9, working: -1e9 };
    let down = false;
    let gatherAt = -1;
    /** 나라 몫으로 옮긴 자루: 어느 자리의 것이 언제 떠났는가 */
    let movedSpot = -1;
    let movedAt = -1e9;
    /** 나라 몫을 어른이 옮겼는가(그러면 어른이 자루를 지고 간다) */
    let movedByAdult = false;
    let wiggleAt = -1e9;
    let wiggleSpot = -1;

    const fw = (): number => Math.max(1, w - BUND * 2);
    const fh = (): number => Math.max(1, h - BUND * 2);
    const sx = (nx: number): number => Math.round(BUND + nx * fw());
    const sy = (ny: number): number => Math.round(BUND + ny * fh());

    // ── 마당(둘째 마디)의 자리 ──
    /** 곡식 자루가 놓이는 열 자리(두 줄에 다섯씩)의 밑동 */
    const spotAt = (i: number): [number, number] => {
      const col = i % 5;
      const row = Math.floor(i / 5);
      const x0 = w * 0.09;
      const gap = (w * 0.5) / 4;
      return [Math.round(x0 + col * gap + (row === 1 ? gap * 0.18 : 0)), Math.round(h * (row === 0 ? 0.56 : 0.9))];
    };
    const MAT_W = 62;
    const MAT_H = 34;
    const matAt = (): [number, number] => [Math.round(w * 0.82), Math.round(h * 0.72)];

    /** 벤 자리 하나를 찍는다 */
    const stamp = (i: number): void => {
      if (!mctx) return;
      const c = clumps[i];
      const x = sx(c.x);
      const y = sy(c.y);
      const st = (byFamily[i] ? stubbleEars : stubble)[c.look % 2];
      drawArt(mctx, st.c, x - st.ax / ART, y - st.ay / ART);
      const sw = swath[c.look % 2];
      drawArt(mctx, sw.c, x - sw.ax / ART + (c.look % 2 === 0 ? 7 : -7), y - sw.ay / ART + 3);
    };

    const paintYardScene = (): HTMLCanvasElement => {
      const base = toCanvas(paintYard(w, h, 'autumn', Math.round(h * 0.2)));
      const yctx = base.getContext('2d');
      if (!yctx) return base;
      // 바탕은 그림 점(놀이 점 × ART)이다. 자리 셈은 놀이 점 그대로 한다
      yctx.setTransform(ART, 0, 0, ART, 0, 0);
      yctx.imageSmoothingEnabled = false;
      // 자루가 놓이는 열 자리: 짚 부스러기가 깔린 둥근 자리. 큰비가 온 해에 비는 자리에는 물이 고여 있다.
      // 자리의 크기는 1-라 그대로(놀이 점 반지름 13×4)이고, 그림 점으로 칠한다: 물웅덩이의 잔물결은 가로로 짧게, 짚 부스러기는
      // 그림 점 둘셋의 가는 토막으로 흩어진다(자로 잰 듯한 줄무늬가 되지 않게 자리마다 무늬로 정한다).
      const dot = (X: number, Y: number, ww = 1): void => yctx.fillRect(X / ART, Y / ART, ww / ART, 1 / ART);
      for (let i = 0; i < yields.spots; i++) {
        const [x, y] = spotAt(i);
        const empty = i >= yields.sacks;
        const cx = x * ART + 1;
        const cy = y * ART + 1;
        const rx = 13 * ART + 1;
        const ry = 4 * ART + 1;
        for (let Y = cy - ry; Y <= cy + ry; Y++) {
          for (let X = cx - rx; X <= cx + rx; X++) {
            const d = Math.hypot((X + 0.5 - cx) / rx, (Y + 0.5 - cy) / ry);
            if (d > 1) continue;
            if (empty) {
              const glint = d < 0.7 && hash2((X + (Y & 1) * 2) >> 2, Y, 233) > 0.86;
              yctx.fillStyle = d > 0.8 ? '#7a6a55' : glint ? '#aebdb6' : d > 0.47 ? '#6f8288' : '#5b7078';
            } else if (d > 0.84) {
              yctx.fillStyle = '#a6835c'; // 자루에 눌린 둥근 자국
            } else {
              // 짚 부스러기: 그림 점 셋 길이의 토막(줄마다 엇갈린다) 가운데 넷에 하나쯤
              const cell = Math.floor((X + (Y % 3) * 2) / 3);
              if (hash2(cell, Y, 231) > 0.25) continue;
              yctx.fillStyle = hash2(cell, Y, 232) > 0.62 ? '#ecd58b' : '#bd994c';
            }
            dot(X, Y);
          }
        }
      }
      // 마당 가에 세워 둔 볏단(떨기 전의 벼. 대본의 "타작 마당에 볏단이 쌓였다" — 큰비가 온 해에는 적다). 누르는 것이 아니라 풍경이다.
      const stacked = yields.eased ? (low ? 1 : 2) : 3;
      for (let i = 0; i < stacked; i++) {
        const x = Math.round(w * 0.66) + i * 20;
        const y = Math.round(h * 0.2) + 24 + (i % 2) * 3;
        drawArt(yctx, sheafShade, x - 9, y - 2);
        drawArt(yctx, sheaf.c, x - sheaf.ax / ART, y - sheaf.ay / ART);
      }
      // 나라 몫 자리: 멍석과 그 그림자(멍석의 꼴 그대로 — 따뜻한 밤빛으로 오른쪽 아래에 비낀다)
      const [mx, my] = matAt();
      const mat = matArt(pal, MAT_W, MAT_H);
      drawArt(yctx, toCanvas(silhouette(mat, withAlpha(WARM_DARK, 77))), mx - MAT_W / 2 + 2, my - MAT_H / 2 + 3);
      drawArt(yctx, toCanvas(mat), mx - MAT_W / 2, my - MAT_H / 2);
      return base;
    };

    const placeLabels = (): void => {
      const [mx, my] = matAt();
      const [ox] = spotAt(2);
      const [, oy] = spotAt(0);
      // 이름 딱지는 그림 바로 위에(딱지의 높이는 화면에서 30px쯤 — 점으로는 배율에 따라 다르다)
      const tagH = 34 / (canvas.clientHeight / h || 3);
      setSpots({ oursX: ox / w, oursY: (oy - 31 - tagH) / h, matX: mx / w, matY: (my - MAT_H / 2 - 5 - tagH) / h });
    };

    const stage = mountStage(box, canvas, {
      rows: 150,
      cols: 300,
      resized(nw, nh) {
        w = nw;
        h = nh;
        paddy = toCanvas(paintPaddy(w, h, { season: 'autumn', bund: BUND, wet: false, pools: field.pools }));
        yard = paintYardScene();
        marks.width = w * ART;
        marks.height = h * ART;
        if (mctx) {
          mctx.setTransform(ART, 0, 0, ART, 0, 0);
          mctx.imageSmoothingEnabled = false;
        }
        for (let i = 0; i < total; i++) if (s.cut[i]) stamp(i);
        placeLabels();
      },
      paint(ctx, now) {
        if (s.phase === 'share') paintShare(ctx, now);
        else paintReap(ctx, now);
      },
    });
    if (!stage) return;

    const drawHero = (ctx: CanvasRenderingContext2D, hx: number, hy: number, now: number): void => {
      const walking = now - me.moving < 160;
      const working = now - me.working < 240;
      const col = working ? COL.work + (Math.floor((now - me.working) / 60) % 4) : walking ? COL.walk + (Math.floor(me.step / 5) % 4) : COL.idle + (Math.floor(now / 700) % 2);
      drawFoot(ctx, shadow, hx, hy);
      drawPerson(ctx, sheet, col, DIRS.indexOf(me.dir), hx, hy);
    };

    function paintReap(ctx: CanvasRenderingContext2D, now: number): void {
      if (!paddy) return;
      // 식구들이 남은 벼를 마저 벤다: 왼쪽에서 오른쪽으로 차례로 넘어간다
      if (s.phase === 'gather') {
        // 움직임을 줄인 기기에서는 차례로 넘어가는 모습을 건너뛰고 곧바로 마당으로 간다
        const t = calm ? 2 : (now - gatherAt) / GATHER_MS;
        for (let i = 0; i < total; i++) {
          if (!s.cut[i] && clumps[i].x <= t * 1.05) {
            s.cut[i] = 1;
            byFamily[i] = 1;
            cutAt[i] = now;
            stamp(i);
          }
        }
        if (t >= 1.25) {
          s.phase = 'share';
          me.dir = 'down';
          setPhase('share');
          paintShare(ctx, now);
          // 맡긴 것이면: 마당이 보이고 잠시 뒤 어른이 자루를 옮기고(큰비 해에는 빈 멍석을 보이고) 끝난다
          if (s.leaving) s.timer = window.setTimeout(() => closeShareRef.current(900, yields.eased ? 1600 : 0), calm ? 0 : 700);
          return;
        }
      }
      drawBase(ctx, paddy);
      drawBase(ctx, marks);
      const hx = sx(me.x);
      const hy = sy(me.y);
      let heroDrawn = false;
      for (let i = 0; i < total; i++) {
        const c = clumps[i];
        const y = sy(c.y);
        if (!heroDrawn && y > hy) {
          drawHero(ctx, hx, hy, now);
          heroDrawn = true;
        }
        const a = clumpArt[c.look % clumpArt.length];
        if (!s.cut[i]) {
          drawArt(ctx, a.c, sx(c.x) - a.ax / ART, y - a.ay / ART);
        } else if (!calm && now - cutAt[i] < FALL_MS) {
          // 막 베인 벼가 옆으로 넘어간다(그림 점마다 — 곱게)
          const t = (now - cutAt[i]) / FALL_MS;
          ctx.globalAlpha = 1 - t;
          drawArt(ctx, a.c, sx(c.x) - a.ax / ART + Math.round(t * 4 * ART * (c.look % 2 === 0 ? 1 : -1)) / ART, y - a.ay / ART + Math.round(t * 6 * ART) / ART);
          ctx.globalAlpha = 1;
        }
      }
      if (!heroDrawn) drawHero(ctx, hx, hy, now);
      // 식구들이 마저 벨 때: 어른이 왼쪽에서 오른쪽으로 논을 가로지르며 벤다
      if (s.phase === 'gather' && !calm) {
        const t = Math.min(1, (now - gatherAt) / GATHER_MS);
        const ex = sx(Math.min(1, t * 1.05));
        const ey = sy(0.55);
        const col = COL.work + (Math.floor(now / 90) % 4);
        drawFoot(ctx, shadow, ex, ey);
        drawPerson(ctx, elder, col, DIRS.indexOf('right'), ex, ey);
      }
    }

    function paintShare(ctx: CanvasRenderingContext2D, now: number): void {
      if (!yard) return;
      drawBase(ctx, yard);
      const [mx, my] = matAt();
      const order: { x: number; y: number; hop: number }[] = [];
      for (let i = 0; i < yields.sacks; i++) {
        let [x, y] = spotAt(i);
        let hop = 0;
        if (i === movedSpot) {
          const t = calm ? 1 : Math.min(1, (now - movedAt) / MOVE_MS);
          const e = t * t * (3 - 2 * t);
          x = Math.round(x + (mx - x) * e);
          y = Math.round(y + (my + 8 - y) * e);
          hop = Math.round(Math.sin(t * Math.PI) * 16);
        } else if (i === wiggleSpot && !calm && now - wiggleAt < 320) {
          x += Math.round(Math.sin(((now - wiggleAt) / 320) * Math.PI * 4) * 2);
        }
        order.push({ x, y, hop });
      }
      // 나(자루들 곁에 서 있다)
      const hx = Math.round(w * 0.71);
      const hy = Math.round(h * 0.96);
      order.sort((a, b) => a.y - b.y);
      let heroDrawn = false;
      for (const o of order) {
        if (!heroDrawn && o.y > hy) {
          drawHero(ctx, hx, hy, now);
          heroDrawn = true;
        }
        drawArt(ctx, sackShade, o.x - 13, o.y - 4);
        drawArt(ctx, sack.c, o.x - sack.ax / ART, o.y - sack.ay / ART - o.hop);
      }
      if (!heroDrawn) drawHero(ctx, hx, hy, now);
      // 어른이 나라 몫을 덜어 놓는다: 자루를 지고 멍석까지 걸어가 내려놓고 곁에 선다
      if (movedByAdult && movedSpot >= 0) {
        const t = calm ? 1 : Math.min(1, (now - movedAt) / MOVE_MS);
        const [fx, fy] = spotAt(movedSpot);
        const e = t * t * (3 - 2 * t);
        const walking = t < 1;
        const ax = walking ? Math.round(fx - 15 + (mx - 22 - (fx - 15)) * e) : mx - MAT_W / 2 - 10;
        const ay = walking ? Math.round(fy + 3 + (my + 12 - (fy + 3)) * e) : my + 10;
        const col = walking ? COL.walk + (Math.floor(now / 110) % 4) : COL.idle + (Math.floor(now / 700) % 2);
        drawFoot(ctx, shadow, ax, ay);
        drawPerson(ctx, elder, col, DIRS.indexOf(walking ? 'right' : 'down'), ax, ay);
      }
    }

    const report = (): void => {
      setLeft(total - s.mine);
      setTouched(true);
    };

    /** 낫(과 나)이 (nx, ny)에 닿았다: 둘레의 벼가 베여 눕는다 */
    const reapAt = (nx: number, ny: number, now: number): void => {
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
      const hit = clumpsNear(clumps, s.cut, nx, ny + 6 / fh(), REACH_X / fw(), REACH_Y / fh());
      if (hit.length === 0) return;
      for (const i of hit) {
        s.cut[i] = 1;
        cutAt[i] = now;
        stamp(i);
      }
      s.mine += hit.length;
      me.working = now;
      report();
    };

    /** 첫째 마디를 끝낸다: 끝난 모습을 정하고, 남은 벼는 식구들이 마저 벤 뒤 마당으로 넘어간다 */
    s.toShare = (end?: HarvestEnd): void => {
      if (s.phase !== 'reap') return;
      s.end = end ?? harvestVerdict(s.mine, total);
      s.phase = 'gather';
      gatherAt = performance.now();
      setPhase('gather');
    };

    /** 자루 하나를 나라 몫 자리로 옮긴다(여느 해에 한 번만). 옮겼으면 true. */
    s.give = (auto, from = -1) => {
      if (s.phase !== 'share' || s.given >= yields.nation) return false;
      movedSpot = from >= 0 ? from : yields.sacks - 1;
      movedAt = performance.now();
      movedByAdult = auto;
      if (!auto) {
        me.working = movedAt;
        me.dir = 'right';
      }
      s.given++;
      setGiven(s.given);
      setGivenBy(auto ? 'adult' : 'me');
      return true;
    };

    /** 마당에서 (x, y)를 눌렀다: 자루나 멍석을 누르면 자루 하나가 나라 몫 자리로 간다 */
    const shareAt = (x: number, y: number, now: number): void => {
      let best = -1;
      let bestD = 20 * 20;
      for (let i = 0; i < yields.sacks; i++) {
        if (i === movedSpot) continue;
        const [px, py] = spotAt(i);
        const d = (px - x) ** 2 + (py - 14 - y) ** 2;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      const [mx, my] = matAt();
      const onMat = Math.abs(x - mx) < MAT_W / 2 + 8 && Math.abs(y - my) < MAT_H / 2 + 10;
      if (best < 0 && !onMat) return;
      const from = best >= 0 ? best : yields.sacks - 1;
      if (s.give(false, from)) return;
      // 옮길 것이 없다(이미 옮겼거나, 나라가 몫을 받지 않는 해): 자루가 살짝 흔들릴 뿐이다
      if (best >= 0) {
        wiggleSpot = best;
        wiggleAt = now;
      }
    };

    const toField = (x: number, y: number): [number, number] => [unit((x - BUND) / fw()), unit((y - BUND) / fh())];
    const onDown = (ev: PointerEvent): void => {
      ev.preventDefault();
      canvas.setPointerCapture?.(ev.pointerId);
      const [x, y] = stage.at(ev);
      const now = performance.now();
      if (s.phase === 'reap') {
        down = true;
        const [nx, ny] = toField(x, y);
        reapAt(nx, ny, now);
      } else if (s.phase === 'share' && !s.leaving && !s.closing) {
        shareAt(x, y, now);
      }
    };
    const onMove = (ev: PointerEvent): void => {
      if (!down || s.phase !== 'reap') return;
      ev.preventDefault();
      const [x, y] = stage.at(ev);
      const [nx, ny] = toField(x, y);
      reapAt(nx, ny, performance.now());
    };
    const onUp = (ev: PointerEvent): void => {
      down = false;
      canvas.releasePointerCapture?.(ev.pointerId);
    };
    // 자판: 화살표로 논을 걸으며 벤다. 다 베면 Enter·Space로 마당으로 넘어간다.
    // 마당에서는 Enter·Space로 자루 하나를 나라 몫 자리로 옮기고, 한 번 더 눌러 끝낸다.
    const KEYS: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const onKey = (ev: KeyboardEvent): void => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        if (ev.repeat || s.leaving || s.closing) return;
        if (s.phase === 'reap' && s.mine >= total) s.toShare();
        else if (s.phase === 'share' && !s.give(false)) finishRef.current();
        return;
      }
      const d = KEYS[ev.key];
      if (!d || s.phase !== 'reap') return;
      ev.preventDefault();
      reapAt(unit(me.x + d[0] * 0.035), unit(me.y + d[1] * 0.07), performance.now());
    };
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('keydown', onKey);
    return () => {
      stage.stop();
      window.clearTimeout(s.timer);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('keydown', onKey);
    };
  }, []);

  const tenth = Math.ceil((left / total) * 10);
  const allCut = left <= 0;
  const sharing = phase === 'share';
  const paid = given >= yields.nation;
  const end = sim.current.end;
  return (
    <PlayFrame
      title="가을걷이와 나라 몫"
      howTo={sharing ? (yields.eased ? HOW_TO.eased : HOW_TO.share) : HOW_TO.reap}
      doneLabel={sharing ? '다 거뒀어요' : '다 벴어요'}
      ready={sharing ? paid : phase === 'reap' && allCut}
      onDone={finish}
      onLeave={leave}
      status={
        sharing ? (
          <div class="play-status-row">
            <Say strong={paid}>
              {yields.eased
                ? '큰비에 벼가 쓰러져 거둔 곡식이 적어요. 올해는 나라가 몫을 받지 않아요.'
                : paid
                  ? givenBy === 'adult'
                    ? '어른이 자루 하나를 나라 몫으로 덜어 놓았어요. 남은 아홉이 우리 집 몫이에요.'
                    : '자루 열 가운데 하나가 나라 몫으로 나갔어요. 남은 아홉이 우리 집 몫이에요.'
                  : leaving
                    ? `${end === 'left' ? '벼는 식구들이 벴어요. ' : '남은 벼는 식구들이 마저 벴어요. '}나라 몫은 어른이 덜어 놓아요.`
                    : `${end === 'all' ? '' : end === 'some' ? '남은 벼는 식구들이 마저 벴어요. ' : '벼는 식구들이 벴어요. '}벼를 떨어 자루에 담았어요. 자루를 눌러 나라 몫 자리로 옮겨요.`}
            </Say>
          </div>
        ) : (
          <div class="play-status-row">
            <Gauge name="남은 벼" on={tenth} say={`남은 벼: 열 가운데 ${tenth}`} />
            <Say strong={allCut || phase === 'gather'}>
              {phase === 'gather'
                ? leaving
                  ? '식구들이 남은 벼를 마저 베어요. 나라 몫은 어른이 덜어 놓아요.'
                  : '식구들이 남은 벼를 마저 베어요.'
                : allCut
                  ? '벼를 다 벴어요. “다 벴어요”를 눌러요.'
                  : touched
                    ? '벤 벼가 논바닥에 누워 있어요.'
                    : rain
                      ? '큰비에 물이 고인 자리는 벼가 쓰러졌어요. 서 있는 벼를 베요.'
                      : '논을 쓸어 보세요.'}
            </Say>
          </div>
        )
      }
    >
      <div class={`play-box ${sharing ? 'yard' : 'autumn'}`} ref={boxRef}>
        <canvas
          class="play-canvas"
          ref={canvasRef}
          tabIndex={0}
          data-autofocus
          aria-label={
            sharing
              ? '타작 마당에 놓인 곡식 자루와 나라 몫 자리. 자루를 누르면 나라 몫 자리로 옮겨져요. 자판으로는 Enter로 옮기고 한 번 더 눌러 끝내요.'
              : '벼가 누렇게 익은 가을 논. 손가락으로 쓸면 벼가 베여요. 화살표 자판으로도 벨 수 있고, 다 베면 Enter를 눌러요.'
          }
        />
        {sharing && (
          <>
            <span class="play-tag" style={{ left: `${spots.oursX * 100}%`, top: `${Math.max(1, spots.oursY * 100)}%` }}>
              거둔 곡식
            </span>
            <span class="play-tag" style={{ left: `${spots.matX * 100}%`, top: `${Math.max(1, spots.matY * 100)}%` }}>
              나라 몫{yields.eased ? ' — 올해는 받지 않음' : ''}
            </span>
          </>
        )}
      </div>
    </PlayFrame>
  );
}
