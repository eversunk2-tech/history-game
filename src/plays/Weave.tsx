// 일 놀이 「베 짜기」 — 북을 좌우로 보내고 바디를 당기는 되풀이로 베가 한 줄씩 늘어난다.
// 베는 옷감이면서 값이었다(F08). 그 베 한 필을 짜려면 같은 손놀림을 수없이 되풀이해야 한다 — 그 품이 이 놀이의 내용이다.
// (놀이의 한 필은 마흔 줄이다. 1~2분에 끝나도록 줄인 것이고, 실제 한 필은 견줄 수 없이 길다.)
//
// 손짓: 북을 건너편으로 민다(옆으로 쓸기) → 바디를 당긴다(아래로 쓸기). 놀이판을 그냥 눌러도 다음 일이 차례로 된다.
// 틀림이 없다: 북을 엉뚱한 쪽으로 밀면 북이 제자리에서 흔들릴 뿐이고, 바디를 미리 당겨도 아무 일이 없다.
// 시간에 쫓기지 않는다. "어른께 맡긴다"로 언제든 건너뛸 수 있다.
// 끝난 모습(weaveRules.ts): bolt(한 필을 다 짬) · half(반쯤 짬 — 열 칸 가운데 네 칸부터) · left(그보다 적게 짬).
// 네 칸부터는 화면이 "여기서 그만 짜도 돼요"라고 알리고, 끝내기 단추는 "여기까지 짤게요"다(한 필이 다 되면 "다 짰어요").
// "어른께 맡긴다"를 눌러도 짠 만큼은 버리지 않는다(weaveLeave — 끝내기 단추와 같은 셈).
// 한 것은 그대로 보인다: 베틀의 베가 한 줄씩 올라오고, 곁에 개어 놓은 베가 한 겹씩 쌓인다(열 겹이면 한 필).
//
// 베틀의 생김새는 확인하지 못해 단순하게 그렸다(spec 12.3의 21번): 날실, 바디, 북, 베를 감는 막대만 있다.

import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { paletteOf } from '../pixel/palette';
import { COL, DIRS, HEROES, footShadow, personSheet } from '../pixel/people';
import { ART, Px, hash2, hex, pick, toCanvas, vnoise } from '../pixel/px';
import { rim } from '../pixel/shapes';
import { heroName } from '../state/store';
import { arrowArt, drawBase, drawFoot, drawPerson } from './art';
import { Gauge, Say, useEndOnce } from './bits';
import { PlayFrame } from './Frame';
import type { PlayProps } from './index';
import { mountStage, prefersCalm } from './stage';
import {
  WEAVE_PART,
  WEAVE_ROWS,
  beat,
  newLoom,
  nextStep,
  throwShuttle,
  weaveCanStop,
  weaveLeave,
  weaveParts,
  weaveVerdict,
  type Loom,
} from './weaveRules';

/** 규칙의 이름표마다의 놀이 방법 한 줄. 지금은 '1395' 하나다. 모르는 값이면 이것을 쓴다. */
const HOW_TO: Record<string, string> = {
  '1395': '북을 옆으로 밀어 보내고, 바디를 아래로 당겨요. 그때마다 베가 한 줄 늘어요.',
};

/** 북이 건너가는 시간(밀리초) */
const FLY_MS = 200;
/** 바디가 내려갔다 올라오는 시간 */
const BEAT_MS = 190;
/** 못 보내는 북이 제자리에서 흔들리는 시간 */
const WOBBLE_MS = 260;
/** 손짓으로 치는 거리(점): 옆으로 이만큼 쓸면 북이 가고, 아래로 이만큼 쓸면 바디가 당겨진다 */
const SWIPE_X = 13;
const SWIPE_Y = 8;
/** 날실의 너비(점)와 베틀 기둥까지의 틈 */
const WARP = 96;
const RAIL = 9;
/** 베 한 줄의 두께(점)와, 베틀에 보이는 줄 수 */
const ROW = 2;
const SHOWN = 9;

const HEMP = ['#857247', '#a8945f', '#c7b47c', '#dfcf9c', '#efe3bd'];
/** 베틀 나무의 가장자리(먹빛이 아니라 짙은 밤빛 — spec 4.7.5의 ㄴ) */
const EDGE = '#4a3428';
const THREAD = ['#b8a877', '#d9cc9f', '#f1e8c6'];

/** 북: 배처럼 생긴 나무통. 가운데에 씨실을 감은 꾸리가 들어 있다. */
function shuttleArt(): Px {
  const pal = paletteOf('winter');
  const px = new Px(21, 9);
  for (let y = 1; y < 8; y++) {
    const half = y === 1 || y === 7 ? 5 : y === 2 || y === 6 ? 8 : 9;
    for (let x = 10 - half; x <= 10 + half; x++) px.set(x, y, pick(pal.wood, 0.85 - (y - 1) / 9 - Math.abs(x - 10) / 40, x, y, 0.3));
  }
  for (let y = 3; y <= 5; y++) for (let x = 6; x <= 14; x++) px.set(x, y, hex(THREAD[(x + y) % 2 === 0 ? 2 : 1]));
  px.hline(6, 14, 6, pal.wood[1]);
  rim(px, pal.ink, pal.inkSoft);
  return px;
}

/**
 * 방 안: 위쪽은 흙벽, 아래는 짚으로 엮은 자리. w·h·wallH는 놀이 점이고 그림은 그림 점(× ART)으로 칠한다(spec 4.7.5) —
 * 벽의 얼룩과 자리의 엮은 결은 그림 점으로 곱게, 띠와 결의 간격은 놀이 점 그대로.
 */
function paintRoom(w: number, h: number, wallH: number): Px {
  const pal = paletteOf('winter');
  const A = ART;
  const px = new Px(w * A, h * A);
  for (let y = 0; y < h * A; y++) {
    const uy = (y + 0.5) / A;
    for (let x = 0; x < w * A; x++) {
      const ux = (x + 0.5) / A;
      const tex = hash2(x, y, 307);
      if (uy < wallH) {
        px.set(x, y, pick(pal.clay, 0.36 + (vnoise(ux / 18, uy / 9, 311) - 0.5) * 0.3 + (tex - 0.5) * 0.12 - (uy / wallH) * 0.12, x, y, 0.4));
      } else if (uy < wallH + 2) {
        // 벽과 자리 사이의 나무 띠: 위는 볕, 아래는 그늘
        px.set(x, y, uy < wallH + 0.5 ? pal.wood[2] : uy > wallH + 1.5 ? pal.wood[0] : pal.wood[1]);
      } else {
        // 짚으로 엮은 자리: 세 놀이 점마다 엮은 줄(그림 점 하나 두께), 다섯 점마다 엇갈린 매듭
        const row = Math.floor(uy / 3);
        let tone = 0.34 + (hash2(Math.floor(ux / 2), row, 313) - 0.5) * 0.08 + ((uy - wallH) / (h - wallH)) * 0.08;
        if (y % (3 * A) === 0) tone -= 0.11;
        else if (y % (3 * A) === 1) tone += 0.03;
        if ((Math.floor(ux) + (row % 2) * 5) % 10 === 0 && x % A === 0) tone -= 0.06;
        tone += (vnoise(x / 3, y / 1.5, 314) - 0.5) * 0.05;
        px.set(x, y, pick(pal.thatchOld, tone, x, y, 0.3));
      }
    }
  }
  return px;
}

export function Weave({ rules, facts, onDone }: PlayProps): JSX.Element {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loom, setLoom] = useState<Loom>(newLoom);
  /** 글 딱지를 놓을 자리(놀이판 너비·높이에 대한 몫) */
  const [tags, setTags] = useState({ shuttleL: 0.1, shuttleR: 0.7, shuttleY: 0.7, reedX: 0.75, reedY: 0.45, pileX: 0.86, pileY: 0.3 });
  const sim = useRef({ loom });

  const { end } = useEndOnce(onDone);
  const finish = (): void => void end(weaveVerdict(sim.current.loom.rows));
  const finishRef = useRef(finish);
  finishRef.current = finish;

  useEffect(() => {
    const canvas = canvasRef.current;
    const box = boxRef.current;
    if (!canvas || !box) return;
    const s = sim.current;
    const pal = paletteOf('winter');
    const calm = prefersCalm();
    const hero = HEROES[heroName(facts.role, facts.look)] ?? HEROES['farmer-boy'];
    const sheet = toCanvas(personSheet(hero));
    const shuttle = toCanvas(shuttleArt());
    const shadowImg = toCanvas(footShadow());
    const arrows = [0, 1, 2].map((dir) => toCanvas(arrowArt(dir as 0 | 1 | 2, hex('#fff6c4'), pal.ink)));

    let w = 0;
    let h = 0;
    let room: HTMLCanvasElement | null = null;
    /** 자리(점) */
    const at = { cx: 0, top: 0, reed: 0, beam: 0, pileX: 0, pileY: 0 };
    let flyAt = -1e9;
    let flyFrom: -1 | 1 = -1;
    let beatAt = -1e9;
    let wobbleAt = -1e9;
    let grewAt = -1e9;

    const left = (): number => at.cx - WARP / 2;
    /** 베가 짜여 올라온 끝(여기에 새 씨실이 다져진다). 처음 몇 줄 동안은 올라오고, 그 뒤로는 베가 감겨 제자리다. */
    const fell = (rows: number): number => at.beam - 3 - Math.min(rows, SHOWN) * ROW;
    const restX = (side: -1 | 1): number => at.cx + side * (WARP / 2 + RAIL + 13);
    const shedY = (): number => Math.round((at.reed + fell(s.loom.rows)) / 2) + 1;

    const stage = mountStage(box, canvas, {
      rows: 120,
      cols: 244,
      resized(nw, nh) {
        w = nw;
        h = nh;
        const wallH = Math.round(h * 0.2);
        room = toCanvas(paintRoom(w, h, wallH));
        at.cx = Math.round(w * 0.43);
        at.top = Math.round(h * 0.13);
        at.reed = Math.round(h * 0.4);
        at.beam = Math.round(h * 0.8);
        at.pileX = Math.round(Math.min(w - 26, at.cx + WARP / 2 + RAIL + 22 + (w - (at.cx + WARP / 2 + RAIL + 22)) / 2));
        at.pileY = Math.round(h * 0.9);
        setTags({
          shuttleL: restX(-1) / w,
          shuttleR: restX(1) / w,
          shuttleY: (at.reed - 10) / h,
          reedX: (at.cx + WARP / 2 + RAIL + 20) / w,
          reedY: (at.reed - 20) / h,
          pileX: at.pileX / w,
          pileY: (at.pileY - 64) / h,
        });
      },
      paint(ctx, now) {
        if (!room) return;
        const lm = s.loom;
        drawBase(ctx, room);
        const x0 = left();
        const fy = fell(lm.rows);

        // 베틀의 두 기둥과 날실을 감은 위쪽 막대
        // 베틀은 그림 점(놀이 점의 반)으로 곱게: 가장자리는 먹빛이 아니라 나무의 짙은 밤빛, 볕 받는 쪽에 가는 밝은 줄, 나뭇결
        const H2 = 1 / ART;
        const rail = (x: number): void => {
          ctx.fillStyle = EDGE;
          ctx.fillRect(x - 3, at.top - 4, 7, h - at.top + 4);
          ctx.fillStyle = '#6f4a33';
          ctx.fillRect(x - 2, at.top - 3, 5, h - at.top + 3);
          ctx.fillStyle = '#8d6344';
          ctx.fillRect(x - 1, at.top - 3, 2, h - at.top + 3);
          ctx.fillStyle = '#ab8159';
          ctx.fillRect(x - 2, at.top - 3, 1 + H2, h - at.top + 3);
          ctx.fillStyle = '#c8a174';
          ctx.fillRect(x - 2, at.top - 3, H2, h - at.top + 3);
          ctx.fillStyle = '#523727';
          ctx.fillRect(x + 3 - H2, at.top - 3, H2, h - at.top + 3);
          // 나뭇결
          for (let y = at.top + 2; y < h - 2; y += 7) {
            ctx.fillRect(x + 1, y + ((x * 3) % 4), H2, 2 + H2);
            ctx.fillRect(x - 1 + H2, y + 4, H2, 1 + H2);
          }
        };
        rail(x0 - RAIL);
        rail(x0 + WARP + RAIL);
        ctx.fillStyle = EDGE;
        ctx.fillRect(x0 - RAIL - 4, at.top - 1, WARP + RAIL * 2 + 9, 9);
        ctx.fillStyle = '#8d6344';
        ctx.fillRect(x0 - RAIL - 3, at.top, WARP + RAIL * 2 + 7, 7);
        ctx.fillStyle = '#ab8159';
        ctx.fillRect(x0 - RAIL - 3, at.top, WARP + RAIL * 2 + 7, 1 + H2);
        ctx.fillStyle = '#6f4a33';
        ctx.fillRect(x0 - RAIL - 3, at.top + 7 - 1 - H2, WARP + RAIL * 2 + 7, 1 + H2);
        // 날실(세로로 걸린 실). 위쪽 막대에 감겨 있다가 풀려 내려온다 — 실은 그림 점 하나의 굵기
        for (let x = 0; x < WARP; x += H2) {
          const k = Math.round(x * ART);
          ctx.fillStyle = THREAD[k % 3 === 0 ? 2 : k % 3 === 1 ? 1 : 0];
          ctx.fillRect(x0 + x, at.top + 1, H2, 5);
          if (k % 3 === 0) {
            ctx.fillStyle = k % 6 === 0 ? THREAD[2] : THREAD[1];
            ctx.fillRect(x0 + x, at.top + 7, H2, fy - at.top - 7);
          }
        }
        // 짜인 베: 줄마다 씨실이 가로로 놓였다. 네 줄마다 조금 짙은 줄이 있어 베가 감겨 내려가는 것이 보인다.
        const shown = Math.min(lm.rows, SHOWN);
        for (let k = 0; k < shown; k++) {
          const r = lm.rows - 1 - k;
          ctx.fillStyle = HEMP[r % WEAVE_PART === WEAVE_PART - 1 ? 1 : r % 2 === 0 ? 3 : 2];
          ctx.fillRect(x0, fy + k * ROW, WARP, ROW);
          // 씨실 한 줄의 위쪽은 볕을 받아 조금 밝다(그림 점 하나)
          ctx.fillStyle = HEMP[r % WEAVE_PART === WEAVE_PART - 1 ? 2 : r % 2 === 0 ? 4 : 3];
          ctx.fillRect(x0, fy + k * ROW, WARP, H2);
        }
        if (shown > 0) {
          // 날실이 씨실 위로 지나가는 자리(삼베의 올)
          ctx.fillStyle = HEMP[1];
          for (let x = 0; x < WARP; x += 2) ctx.fillRect(x0 + x + ((x / 2) % 2) * H2, fy, H2, shown * ROW);
          // 막 다져진 맨 윗줄은 잠깐 밝다
          if (!calm && now - grewAt < 260) {
            ctx.fillStyle = HEMP[4];
            ctx.fillRect(x0, fy, WARP, ROW);
          }
        }
        ctx.fillStyle = HEMP[3];
        ctx.fillRect(x0, fy + shown * ROW, WARP, at.beam - (fy + shown * ROW));
        // 베를 감는 아래쪽 막대: 짤수록 감긴 베가 두툼해진다
        const thick = 3 + Math.round((lm.rows / WEAVE_ROWS) * 5);
        ctx.fillStyle = EDGE;
        ctx.fillRect(x0 - RAIL - 4, at.beam - 1, WARP + RAIL * 2 + 9, thick + 4);
        ctx.fillStyle = '#6f4a33';
        ctx.fillRect(x0 - RAIL - 3, at.beam, WARP + RAIL * 2 + 7, thick + 2);
        ctx.fillStyle = HEMP[2];
        ctx.fillRect(x0 - 1, at.beam, WARP + 2, thick + 2);
        ctx.fillStyle = HEMP[4];
        ctx.fillRect(x0 - 1, at.beam, WARP + 2, 1);
        ctx.fillStyle = HEMP[0];
        ctx.fillRect(x0 - 1, at.beam + thick + 1, WARP + 2, 1);

        // 넣어 두고 아직 다지지 않은 씨실(바디와 베 사이에 느슨하게 걸려 있다)
        const flying = !calm && now - flyAt < FLY_MS;
        const shed = shedY();
        for (let k = 0; k < lm.loose; k++) {
          if (flying && k === lm.loose - 1) continue;
          ctx.fillStyle = THREAD[2];
          ctx.fillRect(x0, fy - 3 - k * 3, WARP, 1);
          ctx.fillStyle = 'rgba(42, 36, 34, 0.5)';
          ctx.fillRect(x0, fy - 2 - k * 3, WARP, 1);
        }

        // 바디: 빗처럼 촘촘한 살 사이로 날실이 지나간다. 당기면 베 끝까지 내려와 씨실을 다진다.
        let ry = at.reed;
        if (!calm && now - beatAt < BEAT_MS) {
          const u = (now - beatAt) / BEAT_MS;
          ry = Math.round(at.reed + (fy - 7 - at.reed) * Math.sin(u * Math.PI));
        }
        ctx.fillStyle = EDGE;
        ctx.fillRect(x0 - RAIL - 2, ry - 1, WARP + RAIL * 2 + 5, 8);
        ctx.fillStyle = '#ab8159';
        ctx.fillRect(x0 - RAIL - 1, ry, WARP + RAIL * 2 + 3, 2);
        ctx.fillStyle = '#c8a174';
        ctx.fillRect(x0 - RAIL - 1, ry, WARP + RAIL * 2 + 3, H2);
        ctx.fillStyle = '#6f4a33';
        ctx.fillRect(x0 - RAIL - 1, ry + 4, WARP + RAIL * 2 + 3, 2);
        // 바디의 살: 그림 점 하나씩 엇갈린다
        for (let x = -2; x < WARP + 2; x += H2) {
          ctx.fillStyle = Math.round(x * ART) % 2 === 0 ? '#c8a174' : '#523727';
          ctx.fillRect(x0 + x, ry + 2, H2, 2);
        }

        // 북: 쉬는 자리는 날실 바깥 양쪽이다. 건너갈 때 씨실을 끌고 간다.
        let bx = restX(lm.side);
        const by = shed;
        if (flying) {
          const u = (now - flyAt) / FLY_MS;
          const from = restX(flyFrom);
          bx = Math.round(from + (restX(lm.side) - from) * u);
          ctx.fillStyle = THREAD[2];
          const a = Math.min(from, bx);
          ctx.fillRect(Math.max(x0, a), by, Math.min(x0 + WARP, Math.max(from, bx)) - Math.max(x0, a), 1);
        } else if (!calm && now - wobbleAt < WOBBLE_MS) {
          bx += Math.round(Math.sin(((now - wobbleAt) / WOBBLE_MS) * Math.PI * 4) * 2);
        }
        ctx.drawImage(shuttle, bx - 10, by - 4);

        // 다음 손짓을 알려 주는 화살표(그림). 북을 보낼 차례면 북 곁에서 건너편을, 바디를 당길 차례면 바디 위에서 아래를 가리킨다.
        const step = nextStep(lm);
        const blink = calm || Math.floor(now / 520) % 2 === 0;
        if (blink && !flying && now - beatAt > BEAT_MS) {
          if (step === 'throw') {
            const img = arrows[lm.side === -1 ? 0 : 2];
            ctx.drawImage(img, bx + (lm.side === -1 ? 14 : -14 - img.width), by - 5);
          } else if (step === 'beat') {
            ctx.drawImage(arrows[1], at.cx - 5, ry + 9);
          }
        }

        // 곁에 개어 놓은 베: 네 줄이 한 겹, 열 겹이면 한 필이다. 아직 짜지 않은 겹은 점선 자리로 보인다.
        const LAYER_W = 38;
        const px = at.pileX - LAYER_W / 2;
        ctx.fillStyle = EDGE;
        ctx.fillRect(px - 4, at.pileY, LAYER_W + 8, 4);
        ctx.fillStyle = '#8d6344';
        ctx.fillRect(px - 3, at.pileY, LAYER_W + 6, 3);
        const parts = WEAVE_ROWS / WEAVE_PART;
        for (let k = 0; k < parts; k++) {
          const y = at.pileY - 5 - k * 5;
          const done = lm.rows - k * WEAVE_PART;
          if (done >= WEAVE_PART) {
            ctx.fillStyle = EDGE;
            ctx.fillRect(px - 1, y - 1, LAYER_W + 2, 6);
            ctx.fillStyle = HEMP[k % 2 === 0 ? 3 : 2];
            ctx.fillRect(px, y, LAYER_W, 4);
            ctx.fillStyle = HEMP[4];
            ctx.fillRect(px, y, LAYER_W, 1);
            ctx.fillStyle = HEMP[1];
            ctx.fillRect(px + (k % 2 === 0 ? LAYER_W - 2 : 0), y + 1, 2, 3); // 접힌 끝
          } else {
            ctx.fillStyle = 'rgba(246, 239, 226, 0.5)';
            for (let x = 0; x < LAYER_W; x += 3) {
              ctx.fillRect(px + x, y, 2, 1);
              ctx.fillRect(px + x, y + 3, 2, 1);
            }
            ctx.fillRect(px, y + 1, 1, 2);
            ctx.fillRect(px + LAYER_W - 1, y + 1, 1, 2);
            // 짜고 있는 겹은 짠 만큼만 찬다
            if (done > 0) {
              ctx.fillStyle = HEMP[3];
              ctx.fillRect(px + 1, y + 1, Math.round(((LAYER_W - 2) * done) / WEAVE_PART), 2);
            }
          }
        }

        // 베틀 곁에 앉은 나(얼굴이 보이게 앞을 보고 앉았다 — 뒷모습은 머리만 검게 보여 알아보기 어렵다)
        const sitCol = COL.sit + (Math.floor(now / 800) % 2);
        const meX = Math.round(x0 - RAIL - 19);
        drawFoot(ctx, shadowImg, meX, h - 3);
        drawPerson(ctx, sheet, sitCol, DIRS.indexOf('down'), meX, h - 3);
      },
    });
    if (!stage) return;

    const apply = (next: Loom): boolean => {
      if (next === s.loom) return false;
      s.loom = next;
      setLoom(next);
      return true;
    };
    /** 북을 민다(toward: 미는 쪽. 없으면 건너편으로) */
    const doThrow = (toward?: -1 | 1): void => {
      const from = s.loom.side;
      if (apply(throwShuttle(s.loom, toward))) {
        flyAt = performance.now();
        flyFrom = from;
      } else {
        wobbleAt = performance.now();
      }
    };
    /** 바디를 당긴다 */
    const doBeat = (): void => {
      beatAt = performance.now();
      if (apply(beat(s.loom))) grewAt = beatAt + BEAT_MS / 2;
    };
    /** 다음 일을 차례로 한다(눌렀을 때, Space·Enter) */
    const doNext = (): boolean => {
      const step = nextStep(s.loom);
      if (step === 'throw') doThrow();
      else if (step === 'beat') doBeat();
      return step !== 'done';
    };

    let down = false;
    let ox = 0;
    let oy = 0;
    let acted = false;
    const onDown = (ev: PointerEvent): void => {
      ev.preventDefault();
      canvas.setPointerCapture?.(ev.pointerId);
      down = true;
      acted = false;
      [ox, oy] = stage.at(ev);
    };
    const onMove = (ev: PointerEvent): void => {
      if (!down) return;
      ev.preventDefault();
      const [x, y] = stage.at(ev);
      const dx = x - ox;
      const dy = y - oy;
      // 손을 떼지 않고 옆으로, 아래로, 다시 옆으로 … 이어서 쓸 수 있다(손짓 하나가 끝난 자리에서 다음 손짓을 잰다)
      if (Math.abs(dx) >= SWIPE_X && Math.abs(dx) > Math.abs(dy) * 1.2) {
        doThrow(dx > 0 ? 1 : -1);
        acted = true;
        ox = x;
        oy = y;
      } else if (dy >= SWIPE_Y && dy > Math.abs(dx) * 1.2) {
        doBeat();
        acted = true;
        ox = x;
        oy = y;
      } else if (dy <= -SWIPE_Y * 2) {
        // 위로 올린 손은 그 자리에서 다시 잰다(바디를 당기려고 손을 올리는 것)
        ox = x;
        oy = y;
      }
    };
    const onUp = (ev: PointerEvent): void => {
      if (down && !acted) doNext();
      down = false;
      canvas.releasePointerCapture?.(ev.pointerId);
    };
    const onCancel = (ev: PointerEvent): void => {
      down = false;
      canvas.releasePointerCapture?.(ev.pointerId);
    };
    // 자판: 왼쪽·오른쪽 화살표로 북을 보내고, 아래 화살표로 바디를 당긴다. Space·Enter는 다음 일을 차례로 한다.
    // 한 필을 다 짰으면 Enter·Space로 끝낸다.
    const onKey = (ev: KeyboardEvent): void => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        if (ev.repeat) return;
        if (!doNext()) finishRef.current();
      } else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') {
        ev.preventDefault();
        if (!ev.repeat) doThrow(ev.key === 'ArrowLeft' ? -1 : 1);
      } else if (ev.key === 'ArrowDown') {
        ev.preventDefault();
        if (!ev.repeat) doBeat();
      }
    };
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onCancel);
    canvas.addEventListener('keydown', onKey);
    return () => {
      stage.stop();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onCancel);
      canvas.removeEventListener('keydown', onKey);
    };
  }, []);

  const parts = weaveParts(loom.rows);
  const step = nextStep(loom);
  const done = step === 'done';
  const canStop = weaveCanStop(loom.rows);
  return (
    <PlayFrame
      title="베 짜기"
      howTo={HOW_TO[rules] ?? HOW_TO['1395']}
      doneLabel={done ? '다 짰어요' : '여기까지 짤게요'}
      ready={done}
      onDone={finish}
      onLeave={() => void end(weaveLeave(sim.current.loom.rows))}
      status={
        <div class="play-status-row">
          <Gauge name="짠 베" on={parts} say={`짠 베: 열 칸 가운데 ${parts}칸. 열 칸이 차면 한 필`} />
          <Say strong={done || canStop}>
            {done
              ? '베 한 필을 다 짰어요. “다 짰어요”를 눌러요.'
              : canStop
                ? `열 칸 가운데 ${parts}칸을 짰어요. 여기서 그만 짜도 돼요.`
                : step === 'beat'
                ? '바디를 아래로 당겨 실을 다져요.'
                : loom.rows === 0
                  ? `북을 ${loom.side === -1 ? '오른쪽' : '왼쪽'}으로 밀어 보내요. 눌러도 돼요.`
                  : parts === 0
                    ? `베가 ${loom.rows}줄이 됐어요. 열 칸이 차야 한 필이에요.`
                    : `열 칸 가운데 ${parts}칸을 짰어요. 열 칸이 차야 한 필이에요.`}
          </Say>
        </div>
      }
    >
      <div class="play-box room" ref={boxRef}>
        <canvas
          class="play-canvas"
          ref={canvasRef}
          tabIndex={0}
          data-autofocus
          aria-label="베틀. 북을 옆으로 밀어 보내고 바디를 아래로 당기면 베가 한 줄 늘어요. 자판으로는 왼쪽·오른쪽 화살표로 북을 보내고 아래 화살표로 바디를 당겨요. Space를 되풀이해 눌러도 돼요. 열 칸 가운데 네 칸부터는 그만 짜도 되고, 한 필을 다 짜면 Enter로 끝내요."
        />
        <span class="play-tag" style={{ left: `${(loom.side === -1 ? tags.shuttleL : tags.shuttleR) * 100}%`, top: `${tags.shuttleY * 100}%` }}>
          북
        </span>
        <span class="play-tag" style={{ left: `${tags.reedX * 100}%`, top: `${tags.reedY * 100}%` }}>
          바디
        </span>
        <span class="play-tag" style={{ left: `${tags.pileX * 100}%`, top: `${Math.max(1, tags.pileY * 100)}%` }}>
          짠 베
        </span>
      </div>
    </PlayFrame>
  );
}
