// 에피소드의 흐름(spec 5.2·5.3·5.6, 11.1 가의 8~16): 의뢰 → 현장(3판 판을 에피소드의 계절·해 ☀·일로) → 작은 고비 → "큰 고비로"
// → 큰 고비(battle.ts) → 결과(별·점수·내 최고 기록·처음 깬 판의 선택·다시 하기·경험치·돈·카드·유물·기력).
// 3판 엔진(game.ts)은 고치지 않는다: 에피소드가 고르지 않은 일은 "에피소드의 일만 담은 묶음"(fieldPack)을 3판 함수에 넘겨 거른다.
// 그래서 에피소드 없이 부르는 3판의 길은 그대로다. 새 모듈은 계절 넘기기·한 해 돌아보기를 부르지 않는다.
// 화면·브라우저·저장·시계를 모른다. 날짜·씨앗은 받는다. 상태를 고치지 않고 새 레코드를 돌려준다(저장은 state/save5가 한다).
//
// ── 쓰는 법(㉢) ───────────────────────────────────────────────
//   fieldPack(pack, episode)                      → 에피소드의 일만 담은 묶음(같은 (pack, episode)면 같은 객체 — useMemo에 기대도 된다)
//   beginEpisode(pack, episode, { role, look, seed, story, replay }) → Save5.current(phase 'field', 현장의 3판 판)
//   startField(pack, episode, { role, look, seed, from })        → 현장의 처음 판(GameState) — beginEpisode가 부른다
//   fieldOpen(pack, episode, game) / fieldMissions(pack, episode, game) → 맵에 나타난 일 / 할 일 쪽지(3판 openHappenings·missionViews를 fieldPack으로)
//   minorBefore(episode, happeningId, done)       → 그 일에서 먼저 열 짧은 겨루기(MinorDef — 없으면 undefined)
//   minorDone(current, minorId)                   → 작은 고비를 마친 것으로 적은 current
//   doField(pack, episode, current, input)        → 일 하나를 한 current(놀이 작은 고비는 저절로 마친 것으로 적는다)
//   fieldSkills(episode, game)                    → 이번 판의 현장에서 얻은 솜씨 카드
//   canBoss(pack, episode, game)                  → "큰 고비로"가 뜨나(= canCloseSeason(fieldPack, game))
//   toBoss(pack, episode, current)                → phase 'battle'
//   battleSetupFor(lib, episode, target, { hero, game, seed }) → startBattle에 넘길 BattleSetup(큰 고비 또는 짧은 겨루기)
//   finishEpisode({ … })                          → { story, hero, purse, items, today, paper } 결과(별·점수·최고·경험치·돈·카드·유물)
//   toResult(current, paper)                      → phase 'result'(결과 종이를 다 보기 전에 끈 때를 위해 current.result에 둔다)
// 겨루기에서 낸 문제의 기록은 quiz.recordAnswers(save.quiz, [...작은 고비.asked, ...큰 고비.asked], 문제들)로 적는다.

import type { BattleResult, BattleSetup } from './battle';
import { episodePurse, addPurse } from './economy';
import { canCloseSeason, doHappening, missionViews, newGame, openHappenings, type DoInput, type HappeningView, type MissionView } from './game';
import { addXp, episodeXp, rollDay, type Today } from './growth';
import { BALANCE } from './balance';
import { rollDraw, subSeed } from './rng';
import { SEASONS, TIRED_AT, type GameState, type Look, type RoleId, type SituationPack, type Stats } from './types';
import type { Episode, EpisodeRecord, Foe, Gear, Hero, MinorDef, Purse, Save5, SkillCard, StoryRecord } from './types4';

export type Current = NonNullable<Save5['current']>;

// ── 에피소드의 일만 담은 묶음 ─────────────────────────────────────

const packs = new WeakMap<SituationPack, WeakMap<Episode, SituationPack>>();

/**
 * 에피소드의 일만 담은 묶음: missions는 episode.missions, happenings는 그 미션들의 parts·rescue와 episode.extras만.
 * 이것을 3판 함수(openHappenings·doHappening·missionViews·canCloseSeason)에 넘기면 에피소드가 고르지 않은 일이 빠진다.
 * 같은 (pack, episode)면 같은 객체를 돌려준다.
 */
export function fieldPack(pack: SituationPack, episode: Episode): SituationPack {
  let inner = packs.get(pack);
  if (!inner) {
    inner = new WeakMap();
    packs.set(pack, inner);
  }
  const known = inner.get(episode);
  if (known) return known;
  const missions = episode.missions.map((id) => {
    const found = pack.missions.find((m) => m.id === id);
    if (!found) throw new Error(`${episode.id}: 묶음에 없는 미션 "${id}"`);
    return found;
  });
  const ids = new Set<string>(episode.extras);
  for (const m of missions) {
    for (const part of m.parts) ids.add(part);
    if (m.rescue) ids.add(m.rescue);
  }
  const out: SituationPack = { situation: pack.situation, missions, happenings: pack.happenings.filter((h) => ids.has(h.id)) };
  inner.set(episode, out);
  return out;
}

// ── 현장 ───────────────────────────────────────────────────────

/** 현장을 시작할 그 이야기의 형편(없으면 역할의 시작 수치에서) */
export interface StoryState {
  stats: Stats;
  flags: readonly string[];
  cards: readonly string[];
  items: readonly string[];
}

export interface FieldStart {
  role: RoleId;
  look: Look;
  seed: number;
  /** 그 이야기의 형편(처음이면 없음 — 역할의 시작 수치) */
  from?: StoryState;
}

/**
 * 현장의 처음 판: 3판 newGame 뒤 계절의 자리(seasonIndex)와 해 ☀(에피소드의 해, 기력이 2 이하이면 하나 준다)를 에피소드로,
 * 그 이야기의 형편(stats·flags·cards·items)을 넣고, 앞 계절의 꼭 푸는 미션은 푼 것으로 둔다(검사기 seasonStart와 같은 길).
 */
export function startField(pack: SituationPack, episode: Episode, input: FieldStart): GameState {
  const base = newGame(pack, input.role, input.look, input.seed);
  const seasonIndex = SEASONS.indexOf(episode.season);
  if (seasonIndex < 0) throw new Error(`${episode.id}: 모르는 계절 "${episode.season}"`);
  const stats = input.from ? { ...input.from.stats } : base.stats;
  const { draw } = pack.situation;
  const drawn =
    base.draw ?? (draw.season !== undefined && SEASONS.indexOf(draw.season) <= seasonIndex ? rollDraw(draw.kind, base.seed) : null);
  const before = pack.missions
    .filter(
      (m) => m.must && m.season !== 'year' && SEASONS.indexOf(m.season) < seasonIndex && (!m.roles || m.roles.includes(input.role)),
    )
    .map((m) => m.id);
  return {
    ...base,
    stats,
    flags: [...(input.from?.flags ?? [])],
    cards: [...(input.from?.cards ?? [])],
    items: [...(input.from?.items ?? [])],
    draw: drawn,
    seasonIndex,
    sunsLeft: Math.max(1, stats.body <= TIRED_AT ? episode.suns - 1 : episode.suns),
    solved: before,
    flow: Array.from({ length: seasonIndex + 1 }, () => stats),
  };
}

export interface BeginInput {
  role: RoleId;
  look: Look;
  seed: number;
  /** 그 이야기의 기록(처음이면 없음) */
  story?: StoryRecord;
  /** 다시 하기(깬 에피소드를 따로 하는 판) */
  replay: boolean;
}

/**
 * 하던 에피소드를 연다(Save5.current). 처음 하는 판은 그 이야기의 지금 형편에서, 다시 하기는 그 에피소드를 시작할 때의 형편에서.
 * 4-1의 다시 하기는 ①-1(이야기의 첫 에피소드)뿐이라 역할의 시작 수치에서 연다.
 * 뒤 에피소드의 다시 하기는 "그 에피소드를 처음 시작할 때의 형편"이 기록에 있어야 한다(types4에 올릴 것 — 보고). 그때까지는 지금 형편에서 연다.
 */
export function beginEpisode(pack: SituationPack, episode: Episode, input: BeginInput): Current {
  if (input.replay && !input.story?.episodes[episode.id]?.cleared) throw new Error(`${episode.id}: 깨지 않은 에피소드는 다시 할 수 없다`);
  const from = input.replay && episode.order === 1 ? undefined : input.story;
  const game = startField(pack, episode, { role: input.role, look: input.look, seed: input.seed, from });
  return { episode: episode.id, replay: input.replay, game, phase: 'field', minors: [] };
}

export function fieldOpen(pack: SituationPack, episode: Episode, game: GameState): HappeningView[] {
  return openHappenings(fieldPack(pack, episode), game);
}

export function fieldMissions(pack: SituationPack, episode: Episode, game: GameState): MissionView[] {
  return missionViews(fieldPack(pack, episode), game);
}

/** 그 일에서 열리는 작은 고비 */
export function minorsAt(episode: Episode, happeningId: string): MinorDef[] {
  return episode.minors.filter((m) => m.at === happeningId);
}

/** 그 일을 하기 전에 먼저 열 짧은 겨루기(아직 마치지 않은 것). before가 'play'면 화면은 그 일의 놀이 앞에서 연다 */
export function minorBefore(episode: Episode, happeningId: string, done: readonly string[]): MinorDef | undefined {
  return episode.minors.find((m) => m.kind === 'battle' && m.at === happeningId && !done.includes(m.id));
}

export function minorDone(current: Current, minorId: string): Current {
  if (current.minors.includes(minorId)) return current;
  return { ...current, minors: [...current.minors, minorId] };
}

/**
 * 현장의 일 하나를 한다(3판 doHappening을 fieldPack으로). 그 일에 짧은 겨루기가 있으면 먼저 마쳐야 한다(던진다).
 * 그 일의 놀이 작은 고비(kind 'play')는 일을 하면 마친 것으로 적는다.
 */
export function doField(pack: SituationPack, episode: Episode, current: Current, input: DoInput): Current {
  if (current.phase !== 'field') throw new Error('지금은 현장이 아니다');
  const waiting = minorBefore(episode, input.id, current.minors);
  if (waiting) throw new Error(`작은 고비를 먼저 넘긴다: ${waiting.id}`);
  const game = doHappening(fieldPack(pack, episode), current.game, input);
  let next: Current = { ...current, game };
  for (const m of minorsAt(episode, input.id)) if (m.kind === 'play') next = minorDone(next, m.id);
  return next;
}

/** 이번 판의 현장에서 얻은 솜씨 카드(Episode.skills의 표를 한 일의 기록에 대어 본다) */
export function fieldSkills(episode: Episode, game: GameState): string[] {
  const out: string[] = [];
  for (const s of episode.skills) {
    const got = game.history.some(
      (d) => d.happeningId === s.at && (s.choice === undefined || d.choiceId === s.choice) && (s.play === undefined || d.play === s.play),
    );
    if (got && !out.includes(s.card)) out.push(s.card);
  }
  return out;
}

/** "큰 고비로"가 뜨는 조건 = 3판 canCloseSeason(에피소드의 일만 담은 묶음) */
export function canBoss(pack: SituationPack, episode: Episode, game: GameState): boolean {
  return canCloseSeason(fieldPack(pack, episode), game);
}

export function toBoss(pack: SituationPack, episode: Episode, current: Current): Current {
  if (current.phase !== 'field') throw new Error('지금은 현장이 아니다');
  if (!canBoss(pack, episode, current.game)) throw new Error('꼭 할 일이 남았다');
  return { ...current, phase: 'battle' };
}

// ── 겨루기 준비 ─────────────────────────────────────────────────

type Lookup<T> = readonly T[] | Readonly<Record<string, T>>;

/** 겨루기에 쓰는 자료(content의 foes·skills·gear) */
export interface BattleLib {
  foes: Lookup<Foe>;
  cards: Lookup<SkillCard>;
  gear?: Lookup<Gear>;
}

function find<T extends { id: string }>(list: Lookup<T> | undefined, id: string): T | undefined {
  if (!list) return undefined;
  if (Array.isArray(list)) return (list as readonly T[]).find((x) => x.id === id);
  return (list as Readonly<Record<string, T>>)[id];
}

/** 그 판의 덱: 고른 덱(없으면 정해 준 것) + 현장에서 이번 판에 얻은 솜씨 카드(저절로 — 여덟 장을 넘어도 된다) */
export function battleDeck(episode: Episode, hero: Pick<Hero, 'deck'>, field: readonly string[]): string[] {
  const base = hero.deck.length > 0 ? hero.deck : (episode.starter ?? []);
  return [...new Set([...base, ...field])];
}

/**
 * 겨루기의 준비(startBattle에 넘긴다). target은 'boss'(큰 고비) 또는 짧은 겨루기의 MinorDef.
 * 기운은 현장의 기력(game.stats.body)으로 센다(덤을 많이 해 기력을 썼으면 고비가 힘들다 — 5.5). 씨앗은 현장의 씨앗에서 갈라 쓴다.
 */
export function battleSetupFor(
  lib: BattleLib,
  episode: Episode,
  target: 'boss' | MinorDef,
  input: { hero: Hero; game: GameState; seed?: number },
): BattleSetup {
  const foeId = target === 'boss' ? episode.boss : target.foe;
  if (!foeId) throw new Error(`${episode.id}: 고비가 없는 작은 고비`);
  const foe = find(lib.foes, foeId);
  if (!foe) throw new Error(`없는 고비: ${foeId}`);
  const deck = battleDeck(episode, input.hero, fieldSkills(episode, input.game));
  const cards: SkillCard[] = [];
  for (const id of deck) {
    const card = find(lib.cards, id);
    if (card) cards.push(card);
  }
  const gear = [input.hero.gear.hand, input.hero.gear.pack]
    .map((id) => (id ? find(lib.gear, id) : undefined))
    .filter((g): g is Gear => Boolean(g));
  const seed = input.seed ?? subSeed(input.game.seed, target === 'boss' ? 'boss' : `minor:${target.id}`);
  return {
    foe,
    cards,
    deck,
    steps: input.hero.cards,
    stats: input.hero.stats,
    level: input.hero.level,
    body: input.game.stats.body,
    gear,
    seed,
    kind: target === 'boss' ? 'boss' : 'minor',
  };
}

// ── 결과 ───────────────────────────────────────────────────────

/** 처음 깬 판의 선택(Happening id → Choice id, 고르는 것이 없던 일은 '') */
export function firstRunOf(game: GameState): Record<string, string> {
  const out: Record<string, string> = {};
  for (const d of game.history) out[d.happeningId] = d.choiceId ?? '';
  return out;
}

export interface FinishInput {
  episode: Episode;
  replay: boolean;
  /** 현장의 끝난 판 */
  game: GameState;
  /** 마친 작은 고비(MinorDef id) */
  minors: readonly string[];
  /** 큰 고비의 끝(battleResult) */
  boss: BattleResult;
  hero: Hero;
  purse: Purse;
  /** 가진 것(Save5.items) */
  items: readonly string[];
  /** 그 이야기의 기록(처음이면 없음) */
  story?: StoryRecord;
  /** 이번 판에 가 본 자리·만난 사람(도감 몫 — 화면이 모은다) */
  met?: readonly string[];
  today: Today | undefined;
  /** 오늘('2026-11-07' — Save5.today.date의 꼴) */
  date: string;
  /** 레벨 상한(4-1은 growth.LEVEL_CAP_41) */
  cap: number;
}

export interface EpisodePaper {
  /** 처음 깬 판인가 */
  first: boolean;
  stars: [boolean, boolean, boolean];
  /** 이번에 새로 받은 별 */
  newStars: [boolean, boolean, boolean];
  score: number;
  /** 내 최고 기록(이번 것까지) */
  best: number;
  /** 이번에 최고 기록을 넘었나 */
  bestNew: boolean;
  xp: number;
  /** 이번에 오른 레벨 수 · 상한에 걸려 쌓아 둔 경험치 */
  levels: number;
  banked: number;
  purse: Purse;
  /** 새로 얻은 카드(현장에서·처음 깸의 보상) */
  cards: string[];
  /** 단계가 오른 카드(다시 하기에서 같은 카드를 다시 얻음) */
  stepped: string[];
  relics: string[];
  rescued: boolean;
  /** 그 이야기의 기력이 준 만큼(처음 깬 판의 구해 줌·해거름) */
  bodyLoss: number;
}

export interface EpisodeOutcome {
  story: StoryRecord;
  hero: Hero;
  purse: Purse;
  items: string[];
  today: Today;
  paper: EpisodePaper;
}

const orStars = (a: readonly boolean[], b: readonly boolean[]): [boolean, boolean, boolean] => [
  Boolean(a[0] || b[0]),
  Boolean(a[1] || b[1]),
  Boolean(a[2] || b[2]),
];

/**
 * 에피소드의 결과. 처음 깬 판이면 그 이야기의 형편(현장의 끝 — 구해 줌·해거름이면 기력 −1)과 처음 깬 판의 선택(firstRun)을 적고,
 * 다시 하기면 형편과 firstRun은 그대로 둔다(그 판의 선택은 그 판 안에서만 — 5.3). 별과 최고 기록은 판마다 좋은 것이 남는다.
 * 경험치: growth.episodeXp(처음 깸 / 다시 하기 — 새 별 + 10분의 1, 하루 세 판). 돈: 처음 깸에만(economy.episodePurse).
 * 카드: 현장에서 얻은 것(이미 가졌으면 다시 하기에서만 단계 +1, 3까지) + 처음 깸의 보상 카드. 유물: 처음 깸에만.
 */
export function finishEpisode(input: FinishInput): EpisodeOutcome {
  const { episode, game, hero } = input;
  const prev = input.story?.episodes[episode.id];
  const first = !prev?.cleared;
  if (input.replay && first) throw new Error(`${episode.id}: 깨지 않은 에피소드는 다시 할 수 없다`);
  const stars: [boolean, boolean, boolean] = [...input.boss.stars] as [boolean, boolean, boolean];
  const had = prev?.stars ?? [false, false, false];
  const newStars: [boolean, boolean, boolean] = [stars[0] && !had[0], stars[1] && !had[1], stars[2] && !had[2]];
  const best = Math.max(prev?.best ?? 0, input.boss.score);

  // 오늘의 셈과 경험치
  let today = rollDay(input.today, input.date);
  const replaysToday = today.replays[episode.id] ?? 0;
  const minorsDone = episode.minors.filter((m) => input.minors.includes(m.id)).length;
  const knownMet = new Set(input.story?.met ?? []);
  const freshMet = [...new Set(input.met ?? [])].filter((m) => !knownMet.has(m));
  const xp = episodeXp({
    story: episode.story,
    first,
    stars,
    had,
    minors: minorsDone,
    book: freshMet.length,
    replaysToday,
  }).xp;
  if (!first) today = { ...today, replays: { ...today.replays, [episode.id]: replaysToday + 1 } };
  const gain = addXp(hero, xp, input.cap);

  // 카드
  const cards = { ...gain.hero.cards };
  const got: string[] = [];
  const stepped: string[] = [];
  for (const id of fieldSkills(episode, game)) {
    const step = cards[id];
    if (step === undefined) {
      cards[id] = 1;
      got.push(id);
    } else if (!first && step < BALANCE.stepMax) {
      cards[id] = (step + 1) as 1 | 2 | 3;
      stepped.push(id);
    }
  }
  if (first) {
    for (const id of episode.rewards.cards) {
      if (cards[id] === undefined) {
        cards[id] = 1;
        got.push(id);
      }
    }
  }
  const deck = gain.hero.deck.length > 0 ? gain.hero.deck : [...(episode.starter ?? [])];
  for (const id of deck) if (cards[id] === undefined) cards[id] = 1;

  // 돈과 유물(처음 깸에만)
  const money = first ? episodePurse(episode) : { rice: 0, cloth: 0, coin: 0 };
  const relics = first ? episode.rewards.relics.filter((r) => !input.items.includes(r)) : [];

  // 이야기의 기록
  const bodyLoss = first ? input.boss.bodyLoss : 0;
  const record: EpisodeRecord = {
    stars: orStars(had, stars),
    best,
    plays: (prev?.plays ?? 0) + 1,
    cleared: true,
  };
  const met = [...(input.story?.met ?? []), ...freshMet];
  let story: StoryRecord;
  if (first) {
    story = {
      role: game.role,
      look: game.look,
      stats: { ...game.stats, body: Math.max(0, game.stats.body - bodyLoss) },
      flags: [...game.flags],
      cards: [...game.cards],
      items: [...game.items],
      firstRun: { ...(input.story?.firstRun ?? {}), ...firstRunOf(game) },
      episodes: { ...(input.story?.episodes ?? {}), [episode.id]: record },
      met,
      ...(input.story?.legacy !== undefined ? { legacy: input.story.legacy } : {}),
      ...(input.story?.title !== undefined ? { title: input.story.title } : {}),
    };
  } else {
    const kept = input.story as StoryRecord;
    story = { ...kept, episodes: { ...kept.episodes, [episode.id]: record }, met };
  }

  return {
    story,
    hero: { ...gain.hero, cards, deck },
    purse: addPurse(input.purse, money),
    items: [...input.items, ...relics],
    today,
    paper: {
      first,
      stars,
      newStars,
      score: input.boss.score,
      best,
      bestNew: input.boss.score > (prev?.best ?? 0),
      xp,
      levels: gain.levels,
      banked: gain.banked,
      purse: money,
      cards: got,
      stepped,
      relics,
      rescued: input.boss.rescued,
      bodyLoss,
    },
  };
}

/** 결과 종이(phase 'result') — 다 보기 전에 끈 때 current.result로 다시 보인다(종이의 칸을 모두 담는다 — 4-1 ㉢) */
export function toResult(current: Current, paper: EpisodePaper): Current {
  return {
    ...current,
    phase: 'result',
    result: {
      stars: paper.stars,
      score: paper.score,
      xp: paper.xp,
      purse: paper.purse,
      cards: [...paper.cards, ...paper.stepped],
      first: paper.first,
      newStars: paper.newStars,
      best: paper.best,
      bestNew: paper.bestNew,
      levels: paper.levels,
      banked: paper.banked,
      stepped: [...paper.stepped],
      relics: [...paper.relics],
      rescued: paper.rescued,
    },
  };
}
