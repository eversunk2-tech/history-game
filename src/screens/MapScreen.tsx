// 맵 화면(현장) — 느티골을 걸어 다니며 그 에피소드의 일을 한다(3판 바퀴 1-다의 맵 화면, 4판 spec 4.3·11.1 가 8).
// 가려는 곳을 누르면 걸어간다. PC에서는 화살표 자판과 Enter·Space도 된다. 화면에 방향 단추는 두지 않는다.
// 깃발(꼭 할 일)이나 말풍선(덤으로 하는 일)에 닿으면 그 일의 대화 장면이 이 화면 위에 얹힌다.
// 맵은 내려가지 않는다: 대화 장면·"미션이 풀림"·봇짐·지난 이야기가 떠 있는 동안에는 걷기만 멈춘다.
// 맵 틀(미리 짓기·세션 열기·놀이 고리·누름과 자판·작은 지도·화살표)은 src/map/stage.ts에 있다(4-1 ㉢ — ㉣의 거점 맵이 함께 쓴다).
// 이 화면은 그 판의 일만 맡는다: 표시·사람 가리기·알림·덤의 한마디·서 있던 자리 적기·할 일 쪽지·정령의 말풍선.
//
// 4판에서 바뀐 것: 위쪽 띠의 계절 자리에 에피소드 이름과 때, "큰 고비로"(띠), 정령 느티가 주인공 곁에 작은 도트로 떠 있다(그 시대 사람에게는
// 보이지 않는다 — 귀퉁이 말풍선만), 할 일 쪽지의 줄을 한 번 더 누르면 그 자리까지 걸어간다(13.2의 22번).
// 무엇이 떠 있을지는 규칙 엔진이 정한다(openHappenings, missionViews — 에피소드의 일만 담은 묶음으로). 이 화면은 그것을 맵의 자리에 세울 뿐이다.

import type { JSX } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { getMap } from '../content';
import { s1395_1Lines } from '../content/episodes/s1395-lines';
import { mapLook, seasonalMap } from '../content/maps';
import { seasonLabels } from '../content/labels';
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
import { tileOf } from '../map/path';
import { newStageKeep, openStage, pressRow } from '../map/stage';
import { TILE, type MapData, type Weather } from '../map/types';
import { dayLight, setHidden, setMarks, type Mark, type World, type WorldEvent } from '../map/world';
import { episode, game, gameNo, heroName, mapBusy, markPlace, missionQueue, openTalk, pack, panel, talk, walkedText } from '../state/store';
import { packBits } from '../state/storage';
import { BagPanel, PastPanel } from '../ui/Panels';
import { SpiritSay } from '../ui/Spirit';
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

/**
 * 맵 위에 무언가 떠 있어 걷기와 자판을 멈춰야 하는가: 가게가 아는 것(대화 장면, 종이, 봇짐, "처음으로")과
 * 위쪽 띠가 스스로 띄우는 물음("해가 남았어요. 지금 갈까요?")을 함께 본다.
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
 * 맵의 모습(가을걷이 뒤 등 — mapLook)을 셈한다: 대화 장면이 떠 있는 동안(talking)에는 앞의 모습(held) 그대로, 닫히면 지금의 모습(now).
 * 1-라 11.8 ②: 가을걷이를 마치면 맵을 다시 짓는데 느린 기기에서 0.9초쯤 걸려, 그동안 쌓인 누름이 놀이 뒤 첫 창을 넘겼다.
 * 대화가 맵을 다 덮고 있어 그동안 맵은 보이지 않는다.
 */
export function heldLook(held: string, now: string, talking: string | null): string {
  return talking === null ? now : held;
}

/** 정령의 현장 말풍선(에피소드마다 — 4-1은 ①-1). 열쇠마다 한 판에 한 번 */
export type BubbleKey = keyof typeof s1395_1Lines.bubbles;
const BUBBLES: Record<string, Partial<Record<BubbleKey, string>>> = { 's1395-1': s1395_1Lines.bubbles };

/** 현장 말풍선을 고를 때 보는 그 판의 형편 */
export interface BubbleState {
  /** 미션 ①을 마쳤다 · 볍씨 뿌리기를 마쳤다 · 현장에서 솜씨 카드를 얻었다 · 꼭 할 일을 다 했다 */
  solvedReturn: boolean;
  solvedSow: boolean;
  gotSkill: boolean;
  allMustDone: boolean;
  /** 해 ☀가 남았고 해를 쓸 덤이 열려 있다 */
  extrasLeft: boolean;
  /** extras를 띄운 뒤 해를 하나 더 썼다(덤을 했다) */
  afterExtras: boolean;
}

/**
 * 지금 띄울 정령의 현장 말풍선: 대본 26.2의 차례대로 그때 맞는 것 가운데 아직 띄우지 않은 첫 것(없으면 null).
 * returnDone(미션 ①을 마침) → toPaddy(볍씨 뿌리기 앞) → sowDone(볍씨 뿌리기를 마침) → skillGot(솜씨 카드를 처음 얻음) → extras(해가 남음) · bossReady.
 * 앞의 말풍선이 사라진 뒤에 하나씩 띄운다(부르는 쪽) — 마지막 꼭 할 일(볍씨 뿌리기)을 마친 순간에도 sowDone이 extras·bossReady보다 먼저다
 * (4-1 ㉢ Review 권고 ㅂ — 앞에는 꼭 할 일을 다 했는지를 먼저 보아 흔한 차례에서 toPaddy·sowDone·skillGot이 뜨지 않았다).
 * bossReady는 덤을 더 할 수 없을 때, 또는 extras를 띄운 뒤 덤을 하나 더 했을 때 뜬다(앞과 같다).
 */
export function nextBubble(st: BubbleState, said: ReadonlySet<BubbleKey>): BubbleKey | null {
  const due: [BubbleKey, boolean][] = [
    ['returnDone', st.solvedReturn],
    ['toPaddy', st.solvedReturn && !st.solvedSow],
    ['sowDone', st.solvedSow],
    ['skillGot', st.gotSkill],
    ['extras', st.allMustDone && st.extrasLeft],
    ['bossReady', st.allMustDone && (!st.extrasLeft || st.afterExtras)],
  ];
  return due.find(([k, on]) => on && !said.has(k))?.[0] ?? null;
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
  // 판을 새로 지어도(대화가 닫힌 뒤 맵의 모습이 바뀌거나) 이어 가는 것: 눌려 있는 화살표, 새 판에 넘길 누름, 마지막에 그린 화면(맵 틀 — map/stage.ts)
  const keepRef = useRef(newStageKeep());
  const [ready, setReady] = useState(false);
  /** 맵의 판을 몇 번째로 세웠는가. 맵의 모습이 바뀌어 판을 새로 지으면 하나 는다(새 판에 표시·사람·빛을 다시 건다). */
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
  /** 정령의 말풍선: 지금 띄운 것과 이 판에서 이미 띄운 열쇠 */
  const [bubble, setBubble] = useState<string | null>(null);
  const saidRef = useRef(new Set<BubbleKey>());

  const season = currentSeason(g);
  const role = roleOf(p, g.role);
  const ep = episode.value;
  const busy = mapBusy.value;
  const talking = talk.value;
  const doneMission = missionQueue.value[0];
  const open = useMemo(() => openHappenings(p, g), [p, g.done, g.solved, g.flags, g.sunsLeft, g.stats, g.items, g.phase, g.seasonIndex]);
  const missions = useMemo(() => missionViews(p, g), [p, g.done, g.solved, g.flags, g.sunsLeft, g.stats, g.items, g.phase, g.seasonIndex]);
  const openRef = useRef(open);
  openRef.current = open;
  // 맵의 계절은 판의 계절이다(보류한 계절 보기 ?field=도 판을 그 계절로 지어 연다)
  const tone = season;
  // 날씨: 큰비가 온 해('drought'가 뽑힌 해)의 여름에는 비가 오고 냇물이 불어난다. 판에 적힌 뽑기를 따른다.
  const flood = g.draw === 'drought';
  const sky: Weather = tone === 'summer' && flood ? 'rain' : 'clear';
  // 같은 맵이 계절마다 다른 모습으로 지어진다(자리와 처음 서는 칸은 같다). 이야기의 때에 따라서도 갈린다.
  // 대화 장면이 떠 있는 동안에는 맵의 모습을 바꾸지 않고 대화가 닫힌 뒤에 다시 짓는다(1-라 11.8 ②).
  const lookNow = mapLook(role.map, tone, sky, { flags: g.flags, flood });
  const lookRef = useRef(lookNow);
  lookRef.current = heldLook(lookRef.current, lookNow, talking);
  const look = lookRef.current;
  const map = useMemo(() => seasonalMap(role.map, tone, sky, { flags: g.flags, flood }) ?? getMap(role.map), [role.map, look]);
  // 판의 번호가 들어 있어, 같은 씨앗·같은 모습으로 새 판을 열어도 앞 판의 자리를 이어받지 않는다.
  // 맵의 모습이 바뀌면 열쇠가 달라져 맵의 판을 새로 짓는다(서 있던 칸과 가 본 칸은 이어받는다).
  const key = `${gameNo.value}|${g.situationId}|${g.seed}|${g.seasonIndex}|${g.role}|${g.look}|${look}`;
  const bubbles = ep ? BUBBLES[ep.id] : undefined;

  /** 정령의 말풍선을 한 번 띄운다(한 판에 열쇠마다 한 번 — 대화 장면이 떠 있는 동안에는 띄우지 않는다) */
  const sayOnce = (k: BubbleKey): void => {
    const text = bubbles?.[k];
    if (saidRef.current.has(k)) return;
    // 글이 없는 열쇠도 띄운 것으로 친다(다음 차례의 말풍선이 막히지 않게)
    saidRef.current.add(k);
    if (text) setBubble(text);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    const mini = miniRef.current;
    if (!canvas || !stage || !mini || !map) return;

    let toastUntil = 0;
    let toastGate = false;
    // 차례를 기다리는 알림(앞의 것이 사라지면 하나씩 뜬다 — 한꺼번에 여러 가지를 보이지 않는다)
    const waiting: Waiting[] = [];
    // 이번에 맵에 들어와서 한마디를 보여 준 덤의 자리, 해 ☀가 무엇인지 알려 주었는가
    const lured = new Set<string>();
    let sunTold = false;
    const seen = new Set<string>(game.peek()?.seen ?? []);
    let worldNow: World | null = null;

    /** 주인공이 무대의 아래쪽에 서 있는가(느티나무 아래에서는 화면이 쏠려 주인공이 아래 5분의 1에 선다) */
    const heroLow = (): boolean => {
      const world = worldNow;
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
        const noSunLine = view.noSun ? '해 ☀가 다 져서 이번에는 할 수 없어요.' : undefined;
        // 해 ☀가 무엇인지는 처음 한 번, 한마디와 따로 띄운다(한꺼번에 세 줄을 읽게 하지 않는다 — review 30번)
        const tellsSun = !view.noSun && !sunTold && now.history.every((deed) => deed.sun === 0);
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
            { head: '해 ☀', text: `말풍선은 덤으로 할 일이에요. 하나 하면 해 ☀가 하나 져요. 이번의 해는 ${countWord(now.sunsLeft)}이에요.`, locked: false },
            14000,
            () => {
              const g0 = game.peek();
              const fresh = Boolean(g0 && g0.phase === 'season' && g0.history.every((deed) => deed.sun === 0));
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
        } else if (e.type === 'note') say({ head: '', text: e.text, locked: false }, 5000);
        else if (e.type === 'mark') {
          const view = openRef.current.find((v) => v.happening.id === e.mark.id);
          if (!view) continue;
          // 해 ☀가 다 지면 덤으로 하는 일은 더 할 수 없다(다 할 수는 없다 — 무엇을 먼저 할지 고르는 것이 이 게임이다)
          if (view.noSun) {
            say({ head: e.mark.spot.label, text: '해 ☀가 다 졌어요. 이 일은 이번에는 할 수 없어요.', locked: false }, 6000);
          } else {
            setToast(null);
            setBubble(null);
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

    /** 서 있는 칸과 가 본 곳을 가게에 알린다(저장은 가게가 제때 한다) */
    let lastPlace = '';
    const tellPlace = (world: World): void => {
      const [px, py] = tileOf(world.player);
      const at = `${px},${py}`;
      if (at === lastPlace) return;
      // 처음 서는 칸에서 아직 움직이지 않았으면 적지 않는다(곧바로 닫았다 다시 열어도 처음의 알림이 뜨게 — 1-라 review 34번 ㉢)
      const now = game.peek();
      const first = map.start[now?.role ?? 'farmer'];
      if (now && !now.at && first && px === first[0] && py === first[1]) return;
      lastPlace = at;
      markPlace(at, [...seen], packBits(world.visited));
    };

    const stop = openStage(
      { canvas, stage, mini, avoid: () => [todoRef.current, miniBoxRef.current] },
      {
        key,
        map,
        who: { role: g.role, look: g.look },
        hero: heroName(g.role, g.look),
        // 정령 느티는 현장에서 주인공 곁에 작게 떠 있다(그 시대 사람에게는 보이지 않는다 — 6.2). 보류한 계절 보기에는 세우지 않는다
        companion: episode.peek() ? 'neuti' : undefined,
        startAt: () => parseAt(game.peek()?.at),
        walked: walkedText,
        overlaid,
        covered: () => talk.peek() !== null,
        onZone: (here) => {
          setZone(here?.label ?? '');
          if (here) seen.add(here.id);
        },
        onWalk: () => setNoteOpen(false),
        onMiniScale: setMiniScale,
        onFps: setFps,
        onOpen: (world) => {
          worldNow = world;
          setMarks(world, marksOf(map, openRef.current));
          worldRef.current = world;
          // 새로 세운 판에 지금의 판을 건다: 이야기의 표시에 따라 자리에 없는 사람을 가린다(아래의 효과들도 다시 돈다)
          const now = game.peek();
          if (now) setHidden(world, new Set(map.dwellers.filter((d) => d.shows && !meets(d.shows, factsOf(now))).map((d) => d.id)));
          setWorldNo((n) => n + 1);
          setReady(true);
          // 현장에 처음 들어섰을 때: 볼 것을 한꺼번에 띄우지 않고 차례로 알린다.
          // ① 그 계절의 첫 줄(정령이 있으면 정령의 말풍선) → ② 걷는 법과 화살표 → ③ 쪽지(아직 펴 보지 않았으면). 걷거나 눌러도 막지 않는다.
          const p0 = pack.peek();
          if (p0 && now && !now.at && now.history.length === 0) {
            const seasonNow = seasonLabels[currentSeason(now)].label;
            if (bubbles?.arrive) sayOnce('arrive');
            else say({ head: seasonNow, text: seasonLine(p0, now), locked: false }, 6500);
            sayLater({ head: '', text: '가려는 곳을 누르면 걸어가요. 노란 화살표 쪽에 꼭 할 일이 있어요.', locked: false }, 7000, () => (game.peek()?.done.length ?? 0) === 0);
            sayLater({ head: '', text: '왼쪽 위의 쪽지를 누르면 할 일이 모두 보여요. 줄을 두 번 누르면 그리로 걸어가요.', locked: false }, 7000, () => !noteOpenedRef.current && (game.peek()?.done.length ?? 0) === 0);
          }
        },
        onEvents,
        onFrame: (world, now, tick, busyNow) => {
          if (!talk.peek()) {
            if (tick % 20 === 0 && !world.paused) lureNear(world);
            if (tick % 15 === 0) moveToast();
          }
          if (tick % 45 === 0 && !world.paused) tellPlace(world);
          // 까닭 한 줄은 문에서 멀어지면 바로, 가만히 있어도 얼마 뒤에는 사라진다
          if (toastUntil !== 0 && (now > toastUntil || (toastGate && world.shownGate === null && !world.paused))) {
            toastUntil = 0;
            shown = null;
            setToast(null);
          }
          // 대화 장면이나 창에서 맵으로 돌아온 순간: 그 전에 떠 있던 알림은 낡았을 수 있으니 지운다(막힌 길의 까닭은 그대로 둔다)
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
        },
        onClose: (world) => tellPlace(world),
      },
      keepRef.current,
    );

    return () => {
      stop();
      worldRef.current = null;
      sayLaterRef.current = null;
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

  /**
   * 줄을 누르면 그 자리로 화살표가 뜬다(쪽지는 펴 둔 채 — 둘째 누름이 같은 줄에 바로 닿게. 화면 밖 자리의 화살표는 쪽지를 비켜 그린다).
   * 이미 화살표가 가리키는 줄을 한 번 더 누르면 그 자리까지 걸어가 깃발을 누른 것과 같이 그 일이 열린다(13.2의 22번 — 먼 자리까지
   * 누르는 일을 줄인다. 4-1 ㉢ Review 권고 ㄱ — 앞에는 쪽지가 접혀 줄 → 쪽지 펴기 → 줄 → 깃발, 네 번이었다). 걷기 시작하면 쪽지를 접는다(길을 가리지 않게).
   * 대화 장면이나 창이 떠 있으면 걷지 않는다. 길이 막혔으면 앞과 같이 서는 칸 쪽으로 걷는다(닫힌 문 앞에서 까닭이 뜬다 — map/stage.ts의 pressRow).
   */
  const pickGuide = (spot: string): void => {
    const target = map?.spots.find((one) => one.id === spot);
    if (!target) return;
    const world = overlaid() ? null : worldRef.current;
    if (pressRow(world, guide, target) === 'walk' && world) setNoteOpen(false);
    setGuide(spot);
  };

  const seasonName = ep ? '이번' : seasonLabels[season].label;
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
        text: canMore ? '덤으로 할 일을 더 하거나, 위의 “큰 고비로”를 눌러요.' : '이제 위의 “큰 고비로”를 눌러요.',
        locked: false,
      },
      12000,
      () => game.peek()?.phase === 'season',
    );
  }, [allMustDone, ready, busy]);

  // 정령의 말풍선(현장 — 대본 26.2의 차례, nextBubble): 미션 ①을 마쳤을 때 → 우리 논으로 → 볍씨 뿌리기를 마쳤을 때 → 솜씨 카드를 처음 얻었을 때 →
  // 꼭 할 일을 다 하고 해가 남았을 때 / "큰 고비로"가 떴을 때. 앞의 말풍선이 사라진 뒤에 하나씩(겹치지 않게), 대화 장면·종이가 떠 있는 동안에는
  // 띄우지 않고 닫히면 띄운다(열쇠마다 한 판에 한 번)
  const solvedReturn = g.solved.includes('s1395-m-return');
  const solvedSow = g.solved.includes('s1395-m-sow');
  const gotSkill = Boolean(ep && ep.skills.some((one) => g.history.some((d) => d.happeningId === one.at)));
  /** extras를 띄웠을 때 남은 해(그 뒤에 해를 더 쓰면 bossReady) */
  const extrasSunsRef = useRef<number | null>(null);
  useEffect(() => {
    if (!bubbles || busy || !ready || bubble) return;
    const extrasLeft = !noSuns && extras.some((v) => !v.noSun);
    const afterExtras = extrasSunsRef.current !== null && g.sunsLeft < extrasSunsRef.current;
    const k = nextBubble({ solvedReturn, solvedSow, gotSkill, allMustDone, extrasLeft, afterExtras }, saidRef.current);
    if (!k) return;
    if (k === 'extras') extrasSunsRef.current = g.sunsLeft;
    sayOnce(k);
  }, [busy, ready, bubble, solvedReturn, solvedSow, gotSkill, allMustDone, g.sunsLeft]);
  // 말풍선은 잠깐 떴다가 사라진다(읽는 빠르기로 — 60자 안이라 9초). 그 사이에 걸으면 그대로 둔다(걷기를 막지 않는다)
  useEffect(() => {
    if (!bubble) return;
    const timer = window.setTimeout(() => setBubble(null), 9000);
    return () => window.clearTimeout(timer);
  }, [bubble]);

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
                <span>{ep ? `「${ep.title}」 할 일` : `${seasonName}에 할 일`}</span>
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
                        ? '꼭 할 일을 다 했어요. 위의 “큰 고비로”를 눌러요.'
                        : '꼭 할 일을 다 했어요. 덤을 더 하거나 “큰 고비로”를 눌러요.'
                      : '줄을 누르면 화살표가 길을 알려 줘요. 한 번 더 누르면 그리로 걸어가요.'}
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

        {bubble && !busy && ready && (
          <div class="field-spirit" onPointerDown={(ev) => ev.stopPropagation()}>
            <SpiritSay text={bubble} next="닫기 ✕" onNext={() => setBubble(null)} where="right" />
          </div>
        )}

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
