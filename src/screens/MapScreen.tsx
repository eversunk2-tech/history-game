// 맵 화면 — 느티골을 걸어 다니며 그 계절의 일을 한다(바퀴 1-다).
// 가려는 곳을 누르면 걸어간다. PC에서는 화살표 자판과 Enter·Space도 된다. 화면에 방향 단추는 두지 않는다.
// 깃발(꼭 푸는 미션의 일)이나 말풍선(덤으로 하는 일)에 닿으면 그 일의 대화 장면이 이 화면 위에 얹힌다.
// 맵은 내려가지 않는다: 대화 장면·"미션이 풀림"·봇짐·지난 이야기가 떠 있는 동안에는 걷기만 멈춘다.
//
// 무엇이 떠 있을지는 규칙 엔진이 정한다(openHappenings, missionViews). 이 화면은 그것을 맵의 자리에 세울 뿐이다.

import type { JSX } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { getMap } from '../content';
import { mapLook, seasonalMap } from '../content/maps';
import {
  canCloseSeason,
  currentSeason,
  deedsOfSeason,
  factsOf,
  missionProgress,
  missionViews,
  openHappenings,
  roleOf,
  seasonLine,
  type HappeningView,
  type MissionView,
} from '../engine/game';
import { meets } from '../engine/conditions';
import type { GameState, SituationPack } from '../engine/types';
import { artScale, scaleFor } from '../map/camera';
import { render, stepScene, type View } from '../map/draw';
import { tileOf } from '../map/path';
import { openSession, paintIdle, prepReady, prepareMap, stepPrepare, type MapSession } from '../map/session';
import { TILE, zoneAt, type MapData, type Weather } from '../map/types';
import {
  dayLight,
  interact,
  setHidden,
  setKeys,
  setMarks,
  snapCamera,
  stepWorld,
  tapWorld,
  type Mark,
  type World,
  type WorldEvent,
} from '../map/world';
import { ART, hex } from '../pixel/px';
import { seasonLabels } from '../content/labels';
import { artSeason, game, gameNo, heroName, mapBusy, markPlace, missionQueue, openTalk, pack, panel, talk, walkedText } from '../state/store';
import { packBits, unpackBits } from '../state/storage';
import { BagPanel, PastPanel } from '../ui/Panels';
import { TopBand } from '../ui/TopBand';
import { countWord } from '../ui/words';
import { MissionDone } from './MissionDone';
import { Talk } from './Talk';

interface Toast {
  head: string;
  text: string;
  /** 덧붙이는 한 줄(해 ☀가 다 져서 못 한다는 것 등) */
  sub?: string;
  locked: boolean;
  /** 무대의 위쪽(띠 바로 밑)에 띄울 것인가: 주인공이 무대 아래쪽에 서 있을 때(알림이 주인공을 가리지 않게) */
  top?: boolean;
}

/** 차례를 기다리는 알림: 앞의 알림이 사라지면 뜬다. when이 거짓이 되었으면 건너뛴다. */
interface Waiting {
  toast: Toast;
  ms: number;
  when?: () => boolean;
}

const KEY_DIRS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  a: [-1, 0],
  d: [1, 0],
  w: [0, -1],
  s: [0, 1],
};

/** 만드는 사람이 재고 찍어 볼 때 쓰는 값들. 개발 때만 창에 걸어 둔다(빌드에는 들어가지 않는다). */
interface DevHooks {
  __world?: World;
  __scene?: MapSession['scene'];
  __fps?: number;
  __ms?: number;
  __overview?: () => string;
}

/**
 * 맵 위에 무언가 떠 있어 걷기와 자판을 멈춰야 하는가: 가게가 아는 것(대화 장면, 종이, 봇짐, "처음으로")과
 * 위쪽 띠가 스스로 띄우는 물음("봄을 보낼까요?")을 함께 본다.
 */
function overlaid(): boolean {
  return mapBusy.peek() || document.querySelector('[aria-modal="true"]') !== null;
}

/** 엔진이 연 일들을 맵의 자리에 세운다. 맵에 없는 자리의 일은 세울 수 없으므로 뺀다(검사기가 미리 잡는다). */
function marksOf(map: MapData, open: HappeningView[]): Mark[] {
  const out: Mark[] = [];
  for (const view of open) {
    const spot = map.spots.find((s) => s.id === view.happening.spot);
    if (spot) out.push({ id: view.happening.id, spot, must: view.must, faded: view.noSun });
  }
  return out;
}

function parseAt(at: string | undefined): [number, number] | undefined {
  if (!at) return undefined;
  const [x, y] = at.split(',').map(Number);
  return Number.isInteger(x) && Number.isInteger(y) ? [x, y] : undefined;
}

/**
 * 걷는 쪽으로 앞선 자리(맵 점) — 남은 땅을 칠할 차례를 고를 때 쓴다. 가는 길이 있으면 그 길을 따라 200점쯤 앞,
 * 화살표 자판으로 걸으면 그쪽으로 200점, 서 있으면 제자리.
 */
function aheadOf(world: World): { x: number; y: number } {
  const p = world.player;
  const AHEAD = 200;
  if (p.route.length > 0) {
    let left = AHEAD;
    let x = p.x;
    let y = p.y;
    for (const q of p.route) {
      const d = Math.hypot(q.x - x, q.y - y);
      if (d >= left) return { x: x + ((q.x - x) * left) / d, y: y + ((q.y - y) * left) / d };
      left -= d;
      x = q.x;
      y = q.y;
    }
    return { x, y };
  }
  const { x: kx, y: ky } = world.keys;
  if (kx !== 0 || ky !== 0) {
    const len = Math.hypot(kx, ky);
    return { x: p.x + (kx / len) * AHEAD, y: p.y + (ky / len) * AHEAD };
  }
  return { x: p.x, y: p.y };
}

export function MapScreen(): JSX.Element | null {
  const p = pack.value;
  const g = game.value;
  if (!p || !g) return null;
  return <MapView pack={p} game={g} />;
}

function MapView({ pack: p, game: g }: { pack: SituationPack; game: GameState }): JSX.Element {
  const mainRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const miniRef = useRef<HTMLCanvasElement>(null);
  const todoRef = useRef<HTMLElement>(null);
  const miniBoxRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<World | null>(null);
  const [ready, setReady] = useState(false);
  /** 맵의 판을 몇 번째로 세웠는가. 계절이나 맵의 모습이 바뀌어 판을 새로 지으면 하나 는다(새 판에 표시·사람·빛을 다시 건다). */
  const [worldNo, setWorldNo] = useState(0);
  const [toast, setToast] = useState<Toast | null>(null);
  const [guide, setGuide] = useState<string | null>(null);
  // 쪽지는 접힌 채로 시작한다(처음 들어섰을 때 맵이 먼저 보이게). 머리줄에 화살표가 가리키는 일의 이름이 보인다.
  const [noteOpen, setNoteOpen] = useState(false);
  const [extrasOpen, setExtrasOpen] = useState(false);
  /** 쪽지의 줄이 화면 밖으로 넘쳐 아래에 더 있는가 */
  const [moreBelow, setMoreBelow] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  /** 차례를 기다리는 알림을 넣는 길(그리기 고리가 차례로 띄운다) */
  const sayLaterRef = useRef<((toast: Toast, ms: number, when?: () => boolean) => void) | null>(null);
  const noteOpenedRef = useRef(false);
  const toldDoneRef = useRef(false);
  const [zone, setZone] = useState('');
  const [miniScale, setMiniScale] = useState(2);
  const [fps, setFps] = useState<number | null>(null);

  const season = currentSeason(g);
  const role = roleOf(p, g.role);
  const busy = mapBusy.value;
  const talking = talk.value;
  const doneMission = missionQueue.value[0];
  const open = useMemo(() => openHappenings(p, g), [p, g.done, g.solved, g.flags, g.sunsLeft, g.stats, g.items, g.phase, g.seasonIndex]);
  const missions = useMemo(() => missionViews(p, g), [p, g.done, g.solved, g.flags, g.sunsLeft, g.stats, g.items, g.phase, g.seasonIndex]);
  const openRef = useRef(open);
  openRef.current = open;
  // 개발 때 견본의 계절로 맵을 볼 수 있다(?season=). 보통은 판의 계절이다.
  const tone = import.meta.env.DEV && artSeason.value !== 'spring' ? artSeason.value : season;
  // 날씨: 큰비가 온 해('drought'가 뽑힌 해)의 여름에는 비가 오고 냇물이 불어난다. 여름에 들어설 때 뽑혀 판에 적힌다.
  // 개발 때만 주소로 고를 수 있다(?draw=drought — 판에 뽑힌 것이 있으면 그것이 먼저다).
  const drawn = g.draw ?? (import.meta.env.DEV ? new URLSearchParams(window.location.search).get('draw') : null);
  const flood = drawn === 'drought';
  const sky: Weather = tone === 'summer' && flood ? 'rain' : 'clear';
  // 같은 맵이 계절마다 다른 모습으로 지어진다(자리와 처음 서는 칸은 같다).
  // 이야기의 때에 따라서도 갈린다: 가을에는 장정들이 떠나고 돌아오고 가을걷이를 마치는 대로,
  // 큰비가 온 해의 여름에는 단오를 보내기 전(비가 잠깐 멎었다)과 뒤로. 큰비가 온 해의 가을에는 낮은 논의 벼가 성기다.
  const look = mapLook(role.map, tone, sky, { flags: g.flags, flood });
  const map = useMemo(() => seasonalMap(role.map, tone, sky, { flags: g.flags, flood }) ?? getMap(role.map), [role.map, look]);
  // 판의 번호가 들어 있어, 같은 씨앗·같은 모습으로 새 판을 열어도 앞 판의 자리를 이어받지 않는다.
  // 계절이나 날씨, 맵의 모습이 바뀌면 열쇠가 달라져 맵의 판을 새로 짓는다(서 있던 칸과 가 본 칸은 이어받는다).
  const key = `${gameNo.value}|${g.situationId}|${g.seed}|${g.seasonIndex}|${g.role}|${g.look}|${look}`;

  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    const mini = miniRef.current;
    if (!canvas || !stage || !mini || !map) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    const mctx = mini.getContext('2d');
    if (!ctx || !mctx) return;

    let stopped = false;
    let raf = 0;
    let session: MapSession | null = null;
    const view: View = { ctx, w: 0, h: 0, scale: 3 };
    let toastUntil = 0;
    let toastGate = false;
    // 차례를 기다리는 알림(앞의 것이 사라지면 하나씩 뜬다 — 한꺼번에 여러 가지를 보이지 않는다)
    const waiting: Waiting[] = [];
    // 이번에 맵에 들어와서 한마디를 보여 준 덤의 자리, 해 ☀가 무엇인지 알려 주었는가
    const lured = new Set<string>();
    let sunTold = false;
    // 주소의 매개변수(?fps, ?awake, ?at=칸,칸)는 개발 때만 먹는다
    const query = new URLSearchParams(import.meta.env.DEV ? window.location.search : '');
    const showFps = query.has('fps');
    // 만드는 사람이 가려진 창에서 돌려 볼 때 쓴다(?awake). 보통은 화면이 가려지면 멈춘다.
    const stayAwake = query.has('awake');
    const dev = window as unknown as DevHooks;
    const seen = new Set<string>(game.peek()?.seen ?? []);

    const resize = (): void => {
      const dpr = window.devicePixelRatio || 1;
      const hadW = canvas.width;
      const hadH = canvas.height;
      const rect = stage.getBoundingClientRect();
      const w = Math.max(64, Math.round(rect.width * dpr));
      const h = Math.max(64, Math.round(rect.height * dpr));
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
      // 캔버스의 화소와 화면의 화소를 하나씩 맞춘다(흐려지지 않게).
      // 위쪽 띠의 높이가 소수로 떨어지는 화면에서는 캔버스를 화소 금에 맞게 조금 당겨 놓는다.
      canvas.style.width = `${w / dpr}px`;
      canvas.style.height = `${h / dpr}px`;
      const offX = (rect.left * dpr) % 1;
      const offY = (rect.top * dpr) % 1;
      canvas.style.left = `${-offX / dpr}px`;
      canvas.style.top = `${-offY / dpr}px`;
      view.w = w;
      view.h = h;
      // 그림 점(ART)이 기기 화소의 정수배가 되게 짝수 배율로(spec 13.1의 53번)
      view.scale = artScale(scaleFor(w, h, dpr), dpr, ART);
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      setMiniScale(Math.max(2, Math.round(rem / 8)));
      if (session) {
        session.world.view = { w: w / view.scale, h: h / view.scale };
        snapCamera(session.world);
        // 크기가 바뀌면 캔버스가 비워진다. 바로 다시 그려 한 장이 비어 보이지 않게 한다
        // (대화 장면을 여닫을 때 위쪽 띠의 높이가 바뀌어 무대의 크기가 달라진다).
        if ((hadW !== w || hadH !== h) && talk.peek() === null) render(view, session.world, session.scene);
      }
    };

    /** 화살표가 피해 갈 자리: 할 일 쪽지와 작은 지도가 화면에서 차지한 네모(캔버스의 화소) */
    const measureAvoid = (world: World): void => {
      const base = canvas.getBoundingClientRect();
      const k = canvas.width / base.width;
      const out: World['avoid'] = [];
      for (const el of [todoRef.current, miniBoxRef.current]) {
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        out.push({ x0: (r.left - base.left) * k, y0: (r.top - base.top) * k, x1: (r.right - base.left) * k, y1: (r.bottom - base.top) * k });
      }
      world.avoid = out;
    };

    /** 주인공이 무대의 아래쪽에 서 있는가(느티나무 아래에서는 화면이 쏠려 주인공이 아래 5분의 1에 선다) */
    const heroLow = (): boolean => {
      const world = session?.world;
      return Boolean(world && (world.player.y - world.cam.y) / world.view.h > 0.56);
    };
    let shown: Toast | null = null;
    let wasBusy = false;
    const say = (next: Toast, ms: number, gate = false): void => {
      shown = { ...next, top: heroLow() };
      setToast(shown);
      toastUntil = performance.now() + ms;
      toastGate = gate;
    };
    /** 알림이 떠 있는 동안 주인공이 그 밑으로 걸어 들어오면(또는 벗어나면) 알림의 자리를 바꾼다 */
    const moveToast = (): void => {
      if (!shown || toastUntil === 0) return;
      const top = heroLow();
      if (top === shown.top) return;
      shown = { ...shown, top };
      setToast(shown);
    };
    const sayLater = (next: Toast, ms: number, when?: () => boolean): void => {
      waiting.push({ toast: next, ms, when });
    };
    sayLaterRef.current = sayLater;

    /** 덤의 말풍선에 다가가면 그 자리의 한마디를 알린다. 처음에는 해 ☀가 무엇인지도 함께 알린다. */
    const nearOf = (world: World, mark: Mark): boolean =>
      Math.hypot(mark.spot.at[0] * TILE + 8 - world.player.x, mark.spot.at[1] * TILE + 8 - world.player.y) < TILE * 4.5;
    const lureNear = (world: World): void => {
      for (const mark of world.marks) {
        if (mark.must || lured.has(mark.id) || !nearOf(world, mark)) continue;
        const view = openRef.current.find((v) => v.happening.id === mark.id);
        if (!view) continue;
        const now = game.peek();
        if (!now) continue;
        const seasonNow = seasonLabels[currentSeason(now)].label;
        const noSunLine = view.noSun ? `해 ☀가 다 져서 이번 ${seasonNow}에는 할 수 없어요.` : undefined;
        // 해 ☀가 무엇인지는 봄에 처음 한 번, 한마디와 따로 띄운다(한꺼번에 세 줄을 읽게 하지 않는다 — review 30번).
        // 여름부터는 띄우지 않는다(해가 줄어든 계절에는 계절의 첫머리에 따로 알린다 — 1-라 review 22번).
        const tellsSun = !view.noSun && !sunTold && now.seasonIndex === 0 && deedsOfSeason(now, currentSeason(now)).every((deed) => deed.sun === 0);
        const lure = view.happening.lure;
        if (!lure && !noSunLine && !tellsSun) continue;
        lured.add(mark.id);
        const id = mark.id;
        const stillNear = (): boolean => {
          const still = world.marks.find((m) => m.id === id);
          return Boolean(still && nearOf(world, still));
        };
        if (lure || noSunLine) {
          sayLater({ head: `${mark.spot.label} · 덤으로 할 일`, text: lure ?? '들러 볼 수 있어요.', sub: noSunLine, locked: false }, noSunLine ? 9000 : 7000, () => {
            // 차례가 왔을 때 이미 멀어졌거나 그 일을 마쳤으면 건너뛴다(다음에 다가오면 다시 알린다)
            if (stillNear()) return true;
            lured.delete(id);
            return false;
          });
        }
        if (tellsSun) {
          sunTold = true;
          // 44자쯤이다. 소리 내어 읽는 빠르기(분당 200자쯤)로도 다 읽게 14초 띄운다.
          sayLater(
            { head: '해 ☀', text: `말풍선은 덤으로 할 일이에요. 하나 하면 해 ☀가 하나 져요. ${seasonNow}의 해는 ${countWord(now.sunsLeft)}이에요.`, locked: false },
            14000,
            () => {
              const g0 = game.peek();
              const fresh = Boolean(g0 && g0.phase === 'season' && deedsOfSeason(g0, currentSeason(g0)).every((deed) => deed.sun === 0));
              if (!fresh) return false;
              if (stillNear()) return true;
              sunTold = false;
              return false;
            },
          );
        }
      }
    };

    const onEvents = (world: World, events: WorldEvent[]): void => {
      for (const e of events) {
        if (e.type === 'gate') {
          say({ head: e.label, text: e.reason, locked: true }, 9000, true);
          // 펴진 쪽지가 막힌 길의 표시를 덮고 있을 수 있다. 접어서 드러낸다.
          setNoteOpen(false);
        }
        else if (e.type === 'note') say({ head: '', text: e.text, locked: false }, 5000);
        else if (e.type === 'mark') {
          const view = openRef.current.find((v) => v.happening.id === e.mark.id);
          if (!view) continue;
          // 해 ☀가 다 지면 덤으로 하는 일은 더 할 수 없다(다 할 수는 없다 — 무엇을 먼저 할지 고르는 것이 이 게임이다)
          if (view.noSun) {
            const now = game.peek();
            const seasonNow = now ? seasonLabels[currentSeason(now)].label : '계절';
            say({ head: e.mark.spot.label, text: `해 ☀가 다 졌어요. 이 일은 이번 ${seasonNow}에는 할 수 없어요.`, locked: false }, 6000);
          }
          else {
            setToast(null);
            toastUntil = 0;
            // 대화 장면이 열리는 순간 서 있는 칸을 적는다(도중에 닫았다 열어도 그 자리에 선다)
            tellPlace(world);
            openTalk(e.mark.id);
          }
        } else if (e.type === 'dweller') {
          // 그 사람이 나오는 일이 바로 곁의 자리에 열려 있으면 그 일을 연다. 아니면 누구인지 한 줄만 알린다.
          const person = e.dweller.person;
          const near = world.marks.find(
            (m) =>
              Math.abs(m.spot.at[0] - e.dweller.at[0]) <= 3 &&
              Math.abs(m.spot.at[1] - e.dweller.at[1]) <= 3 &&
              openRef.current.some((v) => v.happening.id === m.id && !v.noSun && v.happening.stage.cast?.some((c) => c.who === person)),
          );
          if (person && near?.must) {
            tellPlace(world);
            openTalk(near.id);
          } else if (person && near) {
            // 덤으로 하는 일은 사람을 눌러서는 열지 않는다(길을 가다 논 안의 사람을 잘못 눌러 해 ☀를 쓰지 않게).
            // 무슨 일이 있는지만 알리고, 말풍선을 누르면 연다.
            const view = openRef.current.find((v) => v.happening.id === near.id);
            say({ head: `${near.spot.label} · 덤으로 할 일`, text: view?.happening.lure ?? '말풍선을 누르면 들러 볼 수 있어요.', locked: false }, 6000);
          }
          // 이름은 누가 보느냐에 따라 다르다(제 식구면 "어머니", 남의 식구면 "농민 집 아주머니")
          else say({ head: e.name, text: e.dweller.about, locked: false }, 5000);
        }
      }
    };

    // 작은 지도
    const miniImage = mctx.createImageData(mini.width, mini.height);
    const miniData = new Uint32Array(miniImage.data.buffer);
    const fog = hex('#d9cdb3');
    const drawMini = (world: World, miniBase: Uint32Array): void => {
      const { visited } = world;
      for (let i = 0; i < miniData.length; i++) {
        const c = miniBase[i];
        if (visited[i]) miniData[i] = c;
        else {
          // 아직 가 보지 않은 곳은 한지 빛에 엷게
          const r = ((c & 255) * 0.22 + (fog & 255) * 0.78) | 0;
          const gg = (((c >> 8) & 255) * 0.22 + ((fog >> 8) & 255) * 0.78) | 0;
          const b = (((c >> 16) & 255) * 0.22 + ((fog >> 16) & 255) * 0.78) | 0;
          miniData[i] = (255 << 24) | (b << 16) | (gg << 8) | r;
        }
      }
      mctx.putImageData(miniImage, 0, 0);
      // 자리 표시: 꼭 할 일은 붉은 네모, 덤은 흰 네모(크기도 다르다)
      for (const mark of world.marks) {
        const [x, y] = mark.spot.at;
        const on = world.guide === mark.spot.id;
        mctx.fillStyle = '#2a2422';
        mctx.fillRect(x - 2, y - 2, 4, 4);
        mctx.fillStyle = mark.must ? '#d9482f' : '#fbf6e9';
        mctx.fillRect(x - 1, y - 1, 2, 2);
        if (on && Math.floor(world.time * 3) % 2 === 0) {
          mctx.strokeStyle = '#f6c843';
          mctx.lineWidth = 1;
          mctx.strokeRect(x - 3.5, y - 3.5, 7, 7);
        }
      }
      // 지금 있는 곳
      const [px, py] = tileOf(world.player);
      mctx.fillStyle = '#2a2422';
      mctx.fillRect(px - 2, py - 2, 5, 5);
      mctx.fillStyle = Math.floor(world.time * 2.5) % 2 === 0 ? '#ffe98a' : '#f6c843';
      mctx.fillRect(px - 1, py - 1, 3, 3);
      const here = zoneAt(world.map, px, py);
      setZone(here?.label ?? '');
      if (here) seen.add(here.id);
    };

    /** 서 있는 칸과 가 본 곳을 가게에 알린다(저장은 가게가 제때 한다) */
    let lastPlace = '';
    const tellPlace = (world: World): void => {
      const [px, py] = tileOf(world.player);
      const at = `${px},${py}`;
      if (at === lastPlace) return;
      // 새 계절에 들어와 처음 서는 칸에서 아직 움직이지 않았으면 적지 않는다
      // (곧바로 닫았다 다시 열어도 "새 계절"로 열려 계절의 첫 줄이 뜨게 — 1-라 review 34번 ㉢)
      const now = game.peek();
      const first = map.start[now?.role ?? 'farmer'];
      if (now && !now.at && first && px === first[0] && py === first[1]) return;
      lastPlace = at;
      markPlace(at, [...seen], packBits(world.visited));
    };

    let last = 0;
    let workMs = 0;
    let frames = 0;
    let fpsAt = 0;
    let tick = 0;
    const loop = (now: number): void => {
      if (stopped) return;
      raf = requestAnimationFrame(loop);
      if (!session) return;
      const { world, scene } = session;
      // 화면이 가려지면 멈춘다. 돌아왔을 때 한꺼번에 건너뛰지 않게 한 번에 0.05초까지만 흘린다.
      if (document.hidden && !stayAwake) {
        last = now;
        return;
      }
      const dt = last === 0 ? 0 : Math.min(0.05, (now - last) / 1000);
      last = now;
      world.paused = overlaid();
      const began = performance.now();
      const events = stepWorld(world, dt);
      if (events.length > 0) onEvents(world, events);
      stepScene(scene, world, dt);
      // 대화 장면이 맵을 다 덮고 있는 동안에는 그리지 않는다(돌아올 때는 바로 이어 그린다)
      if (talk.peek() === null) {
        render(view, world, scene);
        if (tick % 8 === 0) drawMini(world, session.mini);
        if (tick % 12 === 0) measureAvoid(world);
        if (tick % 20 === 0 && !world.paused) lureNear(world);
        if (tick % 15 === 0) moveToast();
      }
      if (tick % 45 === 0 && !world.paused) tellPlace(world);
      // 땅의 남은 조각(spec 4.7.5의 ㅋ): 이 장에서 쓰고 남은 시간만큼만 잘게 나눠 칠한다(한 장 16.7ms 가운데 셈과 그리기를 빼고
      // 많아야 6ms, 적어도 1.5ms). 걷는 쪽으로 앞선 자리에서 가까운 조각부터 칠해 화면이 닿기 전에 칠해 둔다.
      // 그래도 칠하지 않은 조각이 화면에 들면 그리기가 그 조각만 그 자리에서 칠한다.
      if (scene.ground.left > 0) {
        const spent = performance.now() - began;
        const budget = talk.peek() !== null ? 8 : Math.max(1.5, Math.min(6, 11 - spent));
        paintIdle(session, budget, aheadOf(world));
      }
      tick++;
      // 한 장을 셈하고 그리는 데 든 시간(밀리초)의 흐름 평균
      workMs = workMs * 0.9 + (performance.now() - began) * 0.1;
      // 까닭 한 줄은 문에서 멀어지면 바로, 가만히 있어도 얼마 뒤에는 사라진다
      if (toastUntil !== 0 && (now > toastUntil || (toastGate && world.shownGate === null && !world.paused))) {
        toastUntil = 0;
        shown = null;
        setToast(null);
      }
      // 대화 장면이나 창에서 맵으로 돌아온 순간: 그 전에 떠 있던 알림은 낡았을 수 있으니 지운다
      // (해 ☀ 풀이가 뜬 채 덤을 하고 돌아오면 "해는 셋이에요"가 남아 있지 않게 — review 5번). 막힌 길의 까닭은 그대로 둔다.
      const busyNow = overlaid();
      if (wasBusy && !busyNow && toastUntil !== 0 && !toastGate) {
        toastUntil = 0;
        shown = null;
        setToast(null);
      }
      wasBusy = busyNow;
      // 뜬 알림이 없으면 차례를 기다리던 것을 하나 띄운다. 창이 떠 있는 동안에는(이 장에서 막 열린 대화 장면도) 기다린다.
      if (toastUntil === 0 && waiting.length > 0 && !world.paused && !busyNow) {
        const next = waiting.shift() as Waiting;
        if (!next.when || next.when()) say(next.toast, next.ms);
      }
      frames++;
      if (now - fpsAt >= 1000) {
        const value = Math.round((frames * 1000) / (now - fpsAt));
        if (import.meta.env.DEV) {
          dev.__fps = value;
          dev.__ms = workMs;
        }
        if (showFps) setFps(value);
        frames = 0;
        fpsAt = now;
      }
    };

    // 그림을 처음 찍을 때는 잠깐 걸린다. "그리는 중"(처음)이나 앞 장(계절이 바뀔 때)을 띄워 둔 채,
    // 그림 벌과 처음 보이는 화면의 땅을 나눠 짓고(한 번에 12ms쯤 — 2배 그림의 일감 하나가 낮은 사양에서 30ms 남짓이라, 일감이 넘쳐도
    // 50ms 넘는 긴 일을 만들지 않으면서 쉬는 틈을 줄인다) 다 되면 판을 연다.
    // 제목 화면·계절 닫기·소개 화면에서 미리 지어 두었으면 바로 연다.
    let pump = 0;
    const openWhenReady = (): void => {
      if (stopped) return;
      const now = game.peek();
      if (!now) return;
      if (!prepReady(map)) {
        stepPrepare(12);
        pump = window.setTimeout(openWhenReady, 0);
        return;
      }
      openNow(now);
    };
    const start = window.setTimeout(() => {
      if (stopped) return;
      const now = game.peek();
      if (!now) return;
      // 처음 보이는 화면: 무대의 크기와 배율로 셈한다(resize와 같은 셈)
      const rect = stage.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const s0 = artScale(scaleFor(Math.max(64, Math.round(rect.width * dpr)), Math.max(64, Math.round(rect.height * dpr)), dpr), dpr, ART);
      const devAt = query.get('at')?.split(',').map(Number);
      const startAt: [number, number] | undefined =
        devAt && devAt.length === 2 && devAt.every(Number.isFinite) ? [devAt[0], devAt[1]] : (parseAt(now.at) ?? map.start[now.role]);
      prepareMap(map, [heroName(now.role, now.look)], startAt, { w: (rect.width * dpr) / s0 + 2, h: (rect.height * dpr) / s0 + 2 });
      openWhenReady();
    }, 30);
    const openNow = (now: GameState): void => {
      session = openSession({
        key,
        map,
        who: { role: now.role, look: now.look },
        hero: heroName(now.role, now.look),
        at: parseAt(now.at),
        walked: unpackBits(walkedText(), map.w * map.h),
      });
      const { world, scene } = session;
      // 화면을 찍어 볼 때(개발 때만): ?at=칸,칸 으로 서 있는 곳을 옮긴다
      const at = query.get('at');
      if (at) {
        const [ax, ay] = at.split(',').map(Number);
        if (Number.isFinite(ax) && Number.isFinite(ay) && world.grid.blocked[ay * map.w + ax] === 0) {
          world.player.x = ax * TILE + 8;
          world.player.y = ay * TILE + 10;
        }
      }
      world.player.route = [];
      world.arrive = null;
      setKeys(world, 0, 0);
      setMarks(world, marksOf(map, openRef.current));
      resize();
      worldRef.current = world;
      // 새로 세운 판에 지금의 판을 건다: 이야기의 표시에 따라 자리에 없는 사람을 가린다(아래의 효과들도 다시 돈다)
      setHidden(world, new Set(map.dwellers.filter((d) => d.shows && !meets(d.shows, factsOf(now))).map((d) => d.id)));
      setWorldNo((n) => n + 1);
      if (import.meta.env.DEV) {
        dev.__world = world;
        dev.__scene = scene;
        // 맵 전체를 한 장으로 떠 본다(그림 점 하나 = 화소 하나)
        dev.__overview = () => {
          const whole = document.createElement('canvas');
          whole.width = map.w * TILE * ART;
          whole.height = map.h * TILE * ART;
          const wctx = whole.getContext('2d');
          if (!wctx) return '';
          const keep = world.cam;
          world.cam = { x: 0, y: 0 };
          render({ ctx: wctx, w: whole.width, h: whole.height, scale: ART }, world, scene);
          world.cam = keep;
          return whole.toDataURL('image/png');
        };
      }
      setReady(true);
      // 대화 장면이 떠 있는 동안 판을 새로 지었으면(가을에 맵의 모습이 바뀔 때) 초점은 대화 장면의 것이다
      if (!overlaid()) canvas.focus({ preventScroll: true });
      // 계절에 처음 들어섰을 때: 볼 것을 한꺼번에 띄우지 않고 차례로 알린다.
      // ① 그 계절의 첫 줄 → ② 걷는 법과 화살표 → ③ 쪽지(아직 펴 보지 않았으면). 걷거나 눌러도 막지 않는다.
      const p0 = pack.peek();
      if (p0 && !now.at && deedsOfSeason(now, currentSeason(now)).length === 0) {
        const seasonNow = seasonLabels[currentSeason(now)].label;
        say({ head: seasonNow, text: seasonLine(p0, now), locked: false }, 6500);
        if (now.seasonIndex === 0) {
          sayLater({ head: '', text: '가려는 곳을 누르면 걸어가요. 노란 화살표 쪽에 꼭 할 일이 있어요.', locked: false }, 7000, () => (game.peek()?.done.length ?? 0) === 0);
          sayLater({ head: '', text: `왼쪽 위의 쪽지를 누르면 ${seasonNow}에 할 일이 모두 보여요.`, locked: false }, 6000, () => !noteOpenedRef.current && (game.peek()?.done.length ?? 0) === 0);
        } else if (now.sunsLeft < roleOf(p0, now.role).suns) {
          // 기력이 낮은 채로 계절을 넘겨 해 ☀가 하나 줄었다. 계절의 첫 줄에 이어 한 줄로 알린다(review 32번).
          sayLater({ head: '해 ☀', text: `기력이 낮아서 이번 ${seasonNow}의 해 ☀는 ${countWord(now.sunsLeft)}뿐이에요.`, locked: false }, 8000, () => {
            const g0 = game.peek();
            return Boolean(g0 && g0.phase === 'season' && deedsOfSeason(g0, currentSeason(g0)).length === 0);
          });
        }
      }
      raf = requestAnimationFrame(loop);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(stage);

    const onPointer = (ev: PointerEvent): void => {
      canvas.classList.remove('keyed');
      if (!session || overlaid()) return;
      const { world } = session;
      const rect = canvas.getBoundingClientRect();
      const dpr = canvas.width / rect.width;
      // 그리기와 같은 셈으로 화면의 점을 맵의 점으로 옮긴다
      const s = view.scale;
      const camX = Math.round(world.player.x * s) - Math.round((world.player.x - world.cam.x) * s);
      const camY = Math.round(world.player.y * s) - Math.round((world.player.y - world.cam.y) * s);
      const wx = ((ev.clientX - rect.left) * dpr + camX) / s;
      const wy = ((ev.clientY - rect.top) * dpr + camY) / s;
      tapWorld(world, wx, wy);
      // 걷기 시작하면 쪽지는 접힌다(길을 가리지 않게)
      setNoteOpen(false);
    };
    canvas.addEventListener('pointerdown', onPointer);

    const held = new Set<string>();
    const applyKeys = (): void => {
      if (!session) return;
      let x = 0;
      let y = 0;
      for (const k of held) {
        const d = KEY_DIRS[k];
        if (d) {
          x += d[0];
          y += d[1];
        }
      }
      setKeys(session.world, Math.sign(x), Math.sign(y));
    };
    const onKeyDown = (ev: KeyboardEvent): void => {
      // 대화 장면이나 창이 떠 있으면 자판은 그쪽의 것이다
      if (overlaid()) {
        if (held.size > 0) {
          held.clear();
          applyKeys();
        }
        return;
      }
      // Tab으로 단추에 가서 누르는 것은 그 단추의 일이다(마우스로 누른 뒤에는 초점이 캔버스로 돌아와 있다)
      if (ev.target instanceof HTMLButtonElement && (ev.key === 'Enter' || ev.key === ' ')) return;
      const k = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key;
      if (KEY_DIRS[k]) {
        held.add(k);
        applyKeys();
        setNoteOpen(false);
        ev.preventDefault();
        // 띠의 단추나 쪽지에 초점이 있어도 걷기 시작하면 초점이 맵으로 온다(그 뒤의 Enter가 단추를 누르지 않고 말을 건다).
        // 자판으로 걷는 동안에는 맵에도 다른 단추와 같은 초점 테를 두른다(누르기로 돌아오면 지운다).
        if (document.activeElement !== canvas) canvas.focus({ preventScroll: true });
        canvas.classList.add('keyed');
        return;
      }
      if (k === 'Enter' || k === ' ') {
        ev.preventDefault();
        if (!session || ev.repeat) return;
        const e = interact(session.world);
        if (e) onEvents(session.world, [e]);
      }
    };
    const onKeyUp = (ev: KeyboardEvent): void => {
      const k = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key;
      held.delete(k);
      applyKeys();
    };
    const onBlur = (): void => {
      held.clear();
      applyKeys();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(start);
      window.clearTimeout(pump);
      observer.disconnect();
      canvas.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      if (session) {
        setKeys(session.world, 0, 0);
        session.world.player.route = [];
        tellPlace(session.world);
      }
      worldRef.current = null;
      sayLaterRef.current = null;
      if (import.meta.env.DEV) {
        dev.__world = undefined;
        dev.__scene = undefined;
        dev.__overview = undefined;
      }
    };
  }, [key, map]);

  // 하루의 빛: 해 ☀를 쓸 때마다 아침 → 한낮 → 해거름(spec 9.5의 6번)
  const sunsUsed = deedsOfSeason(g, season).reduce((sum, deed) => sum + deed.sun, 0);
  const light = dayLight(g.sunsLeft, g.sunsLeft + sunsUsed);
  useEffect(() => {
    const world = worldRef.current;
    if (!world) return;
    // 맵을 처음 열 때는 그 빛에서 바로 시작한다(천천히 바뀌는 것은 해를 쓴 뒤 맵으로 돌아왔을 때다)
    if (world.time === 0 || world.light === light) world.glow = { morning: light === 'morning' ? 1 : 0, dusk: light === 'dusk' ? 1 : 0 };
    world.light = light;
  }, [light, ready, worldNo]);

  // 이야기가 흘러 자리를 옮긴 사람("우리 논에서 기다리마")은 그 자리에서 사라지고 옮겨 간 자리에 선다
  useEffect(() => {
    const world = worldRef.current;
    if (!world || !map) return;
    const facts = factsOf(g);
    setHidden(world, new Set(map.dwellers.filter((d) => d.shows && !meets(d.shows, facts)).map((d) => d.id)));
  }, [g.flags, g.stats, map, ready, busy, worldNo]);

  // 일을 마치거나 새 일이 열리면 표시를 바꾼다
  useEffect(() => {
    const world = worldRef.current;
    if (world && map) setMarks(world, marksOf(map, open));
  }, [open, map, ready, worldNo]);

  // 화살표: 일을 마칠 때마다 다음에 갈 곳을 가리킨다(결과가 알려 준 곳 → 아직 풀지 못한 꼭 할 일의 자리)
  const nextMust = missions.find((m) => m.mission.must && !m.solved && m.spot)?.spot ?? null;
  useEffect(() => {
    const want = g.goTo && open.some((v) => v.happening.spot === g.goTo) ? g.goTo : nextMust;
    setGuide(want ?? null);
  }, [g.done.length, g.goTo, nextMust, ready]);
  useEffect(() => {
    if (worldRef.current) worldRef.current.guide = guide && open.some((v) => v.happening.spot === guide) ? guide : null;
  }, [guide, open, ready, worldNo]);

  // 창이 닫히면 초점을 캔버스로 돌린다(Enter·Space가 다시 말 걸기가 되게)
  useEffect(() => {
    if (!busy && ready) canvasRef.current?.focus({ preventScroll: true });
  }, [busy, ready]);

  /** 마우스나 손가락으로 단추를 누른 뒤에는 초점을 캔버스로 돌린다(자판으로 누른 것은 그대로 둔다) */
  const refocus = (ev: MouseEvent): void => {
    if (ev.detail === 0) return;
    if (!(ev.target instanceof Element) || !ev.target.closest('button')) return;
    // 그 단추가 창을 띄웠으면 초점은 창의 것이다. 창이 뜨지 않았을 때만 캔버스로 돌린다.
    window.setTimeout(() => {
      if (!overlaid()) canvasRef.current?.focus({ preventScroll: true });
    }, 0);
  };

  /** 줄을 누르면 그 자리로 화살표가 뜨고, 화살표가 가려지지 않게 쪽지는 접힌다(이미 켜진 줄을 눌러도 화살표는 그대로다) */
  const pickGuide = (spot: string): void => {
    setGuide(spot);
    setNoteOpen(false);
  };

  const seasonName = seasonLabels[season].label;
  const allMustDone = canCloseSeason(p, g);
  const noSuns = g.sunsLeft <= 0;
  const extras = open.filter((v) => !v.must);

  // 꼭 할 일을 다 푼 순간(그리고 이어 하기로 돌아왔을 때) 한 번 알린다: 이제 무엇을 할 수 있는지.
  // 띠의 안내는 좁은 화면에서만 보이므로, 어느 크기에서도 맵에 한 줄이 뜨고 접힌 쪽지의 머리줄에 남는다.
  useEffect(() => {
    if (!allMustDone) {
      toldDoneRef.current = false;
      return;
    }
    if (!ready || busy || toldDoneRef.current || !sayLaterRef.current) return;
    toldDoneRef.current = true;
    const canMore = !noSuns && extras.length > 0;
    sayLaterRef.current(
      {
        head: '꼭 할 일을 다 했어요',
        text: canMore ? `덤으로 할 일을 더 하거나, 위의 “${seasonName}을 보낸다”를 눌러요.` : `이제 위의 “${seasonName}을 보낸다”를 눌러요.`,
        locked: false,
      },
      12000,
      () => game.peek()?.phase === 'season',
    );
  }, [allMustDone, ready, busy]);

  // 쪽지의 줄이 화면 밖으로 넘치면 아래에 더 있다고 알린다(손가락으로 넘길 수 있다)
  const measureBody = (): void => {
    const el = bodyRef.current;
    setMoreBelow(Boolean(el && el.scrollHeight - el.scrollTop - el.clientHeight > 6));
  };
  useEffect(measureBody);
  useEffect(() => {
    window.addEventListener('resize', measureBody);
    return () => window.removeEventListener('resize', measureBody);
  }, []);

  if (!map) return <main class="screen mapscreen" />;

  const spotLabel = (id: string | undefined): string => map.spots.find((s) => s.id === id)?.label ?? '';
  const musts = missions.filter((m) => m.mission.must);
  // 덤 미션(한 해에 걸쳐 모으는 것 등)은 덤의 줄 아래에 어디까지 했는지로 보인다
  const sideMissions = missions.filter((m) => !m.mission.must);
  const guidedMission = musts.find((m) => !m.solved && m.spot === guide);
  const guidedTitle = guidedMission?.mission.title ?? (guide ? spotLabel(guide) : '');
  const mustsLeft = musts.filter((m) => !m.solved).length;
  const openNote = (): void => {
    noteOpenedRef.current = true;
    setNoteOpen(!noteOpen);
  };

  const missionRow = (m: MissionView): JSX.Element => {
    if (m.solved) {
      return (
        <li key={m.mission.id} class="todo-row done">
          <span class="todo-mark must" aria-hidden="true" />
          <span class="todo-text">
            <span class="todo-title">{m.mission.title}</span>
            <span class="todo-where">해냄</span>
          </span>
        </li>
      );
    }
    if (!m.spot) {
      return (
        <li key={m.mission.id} class="todo-row still">
          <span class="todo-mark must" aria-hidden="true" />
          <span class="todo-text">
            <span class="todo-title">{m.mission.title}</span>
            <span class="todo-where">{m.mission.goal}</span>
          </span>
        </li>
      );
    }
    const spot = m.spot;
    const on = guide === spot;
    return (
      <li key={m.mission.id}>
        <button type="button" class={`todo-row${on ? ' on' : ''}`} aria-pressed={on} onClick={() => pickGuide(spot)}>
          <span class="todo-mark must" aria-hidden="true" />
          <span class="todo-text">
            <span class="todo-title">{m.mission.title}</span>
            <span class="todo-where">
              {spotLabel(spot)}
              {on && <span aria-hidden="true"> ➤</span>}
            </span>
          </span>
        </button>
      </li>
    );
  };

  /** 덤의 줄: "우물가 — 아주머니가 한양 이야기를 한다더라". 가 보고 싶게 만드는 한마디가 자리 이름에 붙는다. */
  const extraRow = (v: HappeningView): JSX.Element => {
    const spot = v.happening.spot;
    const on = guide === spot;
    return (
      <li key={v.happening.id}>
        <button type="button" class={`todo-row extra${on ? ' on' : ''}${v.noSun ? ' spent' : ''}`} aria-pressed={on} onClick={() => pickGuide(spot)}>
          <span class="todo-mark extra" aria-hidden="true" />
          <span class="todo-lure">
            <b>{spotLabel(spot)}</b>
            {v.happening.lure ? ` — ${v.happening.lure}` : ' — 들러 볼 수 있어요'}
            {on && <span aria-hidden="true"> ➤</span>}
          </span>
        </button>
      </li>
    );
  };

  /** 덤 미션: 풀렸으면 "해냄", 아니면 어디까지 했는지(셋 가운데 하나) */
  const sideRow = (m: MissionView): JSX.Element => {
    const progress = missionProgress(m.mission, g);
    // 한 줄로 짧게(쪽지가 길어지지 않게): 어디까지 했는지만 적는다. 무엇을 하는 미션인지는 이름이 말해 준다.
    let line = '아직 시작하지 않았어요.';
    if (m.solved) line = '해냄';
    else if (progress && progress.have > 0) line = `${countWord(progress.need)} 가운데 ${countWord(progress.have)}${progress.have === 1 ? '를' : '을'} 했어요.`;
    else if (!progress) line = m.mission.goal;
    return (
      <li key={m.mission.id} class={`todo-row still side${m.solved ? ' done' : ''}`}>
        <span class="todo-text">
          <span class="todo-title">덤 미션 · {m.mission.title}</span>
          <span class="todo-where">{line}</span>
        </span>
      </li>
    );
  };

  // 접힌 쪽지의 머리줄에 남는 한 줄: 화살표가 가리키는 일 → 꼭 할 일을 다 했다는 말
  const foldedLine = guidedTitle ? `➤ ${guidedTitle}` : allMustDone ? '꼭 할 일을 다 했어요' : '';

  return (
    <main class={`screen mapscreen season-${season}`} ref={mainRef} onClick={refocus}>
      <TopBand />
      <div class="map-stage" ref={stageRef}>
        <canvas class="map-canvas" ref={canvasRef} tabIndex={0} aria-label="느티골 맵. 가려는 곳을 누르면 걸어가요. 화살표 자판으로 걷고 Enter로 말을 걸어요." />
        {!ready && <p class="map-loading">느티골을 그리는 중이에요…</p>}
        {fps !== null && <span class="map-fps">초당 {fps}장</span>}

        {ready && !talking && (
          <aside class={`todo${noteOpen ? '' : ' shut'}${noteOpen && extrasOpen ? ' wide' : ''}`} aria-label="할 일 쪽지" ref={todoRef}>
            <button type="button" class="todo-head" aria-expanded={noteOpen} onClick={openNote}>
              <span class="todo-head-text">
                <span>{seasonName}에 할 일</span>
                {!noteOpen && foldedLine && <span class="todo-going">{foldedLine}</span>}
              </span>
              <span class="todo-fold">{noteOpen ? '접기 ▲' : '펴기 ▼'}</span>
            </button>
            {noteOpen && (
              <div class="todo-body" ref={bodyRef} onScroll={measureBody}>
                {/* 묶음 둘을 나란한 두 단추로 고른다. 한 번에 한 묶음만 보인다(낮은 화면에서도 덤의 줄이 다 들어오게 — review 33번). */}
                <div class="todo-tabs" role="tablist" aria-label="할 일의 묶음">
                  <button type="button" role="tab" class={`todo-tab${extrasOpen ? '' : ' on'}`} aria-selected={!extrasOpen} onClick={() => setExtrasOpen(false)}>
                    <span class="todo-mark must" aria-hidden="true" />
                    <span>
                      꼭 할 일{' '}
                      <span class="todo-tab-n">{mustsLeft > 0 ? `${countWord(mustsLeft)} 남음` : '다 했어요'}</span>
                    </span>
                  </button>
                  <button type="button" role="tab" class={`todo-tab${extrasOpen ? ' on' : ''}`} aria-selected={extrasOpen} onClick={() => setExtrasOpen(true)}>
                    <span class="todo-mark extra" aria-hidden="true" />
                    <span>
                      덤 <span class="todo-tab-n">{extras.length}가지</span>
                    </span>
                  </button>
                </div>
                {!extrasOpen && <ul>{musts.map(missionRow)}</ul>}
                {extrasOpen && (
                  <>
                    <p class="todo-tip">{noSuns ? '해 ☀가 다 져서 덤은 더 할 수 없어요.' : `하나 하면 해 ☀가 하나 져요. 남은 해 ${countWord(g.sunsLeft)}.`}</p>
                    <ul>
                      {extras.map(extraRow)}
                      {sideMissions.map(sideRow)}
                    </ul>
                  </>
                )}
                {!extrasOpen && (
                  <p class="todo-tip">
                    {allMustDone
                      ? noSuns || extras.length === 0
                        ? `꼭 할 일을 다 했어요. 위의 “${seasonName}을 보낸다”를 눌러요.`
                        : `꼭 할 일을 다 했어요. 덤을 더 하거나 “${seasonName}을 보낸다”를 눌러요.`
                      : '줄을 누르면 화살표가 길을 알려 줘요.'}
                  </p>
                )}
              </div>
            )}
            {noteOpen && moreBelow && (
              <p class="todo-below" aria-hidden="true">
                아래에 더 있어요 ▼
              </p>
            )}
          </aside>
        )}

        {/* 작은 지도는 누르기를 삼킨다(지도를 눌렀는데 그 밑의 맵으로 걸어가지 않게) */}
        <div class={`minimap${ready && !talking ? '' : ' hidden'}`} ref={miniBoxRef} onPointerDown={(ev) => ev.stopPropagation()}>
          <p class="minimap-zone" style={{ width: `${96 * miniScale}px` }}>
            {zone || '느티골'}
          </p>
          <canvas
            ref={miniRef}
            width={96}
            height={72}
            style={{ width: `${96 * miniScale}px`, height: `${72 * miniScale}px` }}
            aria-label="작은 지도. 가 본 곳이 채워져요."
          />
        </div>

        {toast && !busy && (
          <p class={`map-toast${toast.locked ? ' locked' : ''}${toast.top ? ' top' : noteOpen ? (extrasOpen ? ' beside wide' : ' beside') : ''}`} role="status">
            {toast.head && (
              <span class="toast-head">
                {toast.locked && <span class="toast-lock" aria-hidden="true" />}
                {toast.locked ? `${toast.head} · 지나갈 수 없어요` : toast.head}
              </span>
            )}
            <span class="toast-text">{toast.text}</span>
            {toast.sub && <span class="toast-sub">{toast.sub}</span>}
          </p>
        )}

        {talking && <Talk key={talking} happeningId={talking} />}
        {!talking && doneMission && <MissionDone key={doneMission} missionId={doneMission} />}
        {panel.value === 'bag' && <BagPanel />}
        {panel.value === 'past' && <PastPanel />}
      </div>
    </main>
  );
}
