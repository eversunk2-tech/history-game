// 화면 차례(store) 시험: 제목 → 이야기책 → 누가 될까 → 나를 소개합니다 → 맵 → 계절 닫기 → "다음에 만들어요",
// 저절로 저장하는 때, 끄고 켰을 때 이어지는 자리, 저장이 안 되는 창, 모두 지우기, 엔진이 던졌을 때.
// 브라우저 없이 돈다: 가짜 저장소와 가짜 창을 걸어 두고, "끄고 켜기"는 가게 모듈을 새로 불러와서 흉내 낸다.
// 실제 이야기(① 1395년 농민 집 아이의 봄)로 돌린다.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPack } from '../src/content';
import { canCloseSeason, currentSeason, doHappening, openChoiceIds, openHappenings, seasonReady, type DoInput } from '../src/engine/game';
import { SEASONS, type GameState, type Look, type SituationPack } from '../src/engine/types';
import { BACKUP_KEY, SAVE_KEY, SCHEMA, packBits, parseSave } from '../src/state/storage';

const env = vi.hoisted(() => {
  const data = new Map<string, string>();
  const state = { failWrites: false, noStorage: false, search: '', visibility: 'visible' };
  const listeners = new Map<string, (() => void)[]>();
  const on = (type: string, fn: () => void): void => {
    listeners.set(type, [...(listeners.get(type) ?? []), fn]);
  };
  const storage = {
    getItem: (key: string): string | null => data.get(key) ?? null,
    setItem: (key: string, value: string): void => {
      if (state.failWrites) throw new Error('꽉 참');
      data.set(key, value);
    },
    removeItem: (key: string): void => {
      data.delete(key);
    },
  };
  const win = {
    get localStorage() {
      if (state.noStorage) throw new Error('막힌 창');
      return storage;
    },
    location: {
      get search() {
        return state.search;
      },
    },
    addEventListener: on,
  };
  const doc = {
    get visibilityState() {
      return state.visibility;
    },
    addEventListener: on,
  };
  const g = globalThis as Record<string, unknown>;
  g.window = win;
  g.document = doc;
  return {
    data,
    state,
    listeners,
    fire(type: string): void {
      for (const fn of listeners.get(type) ?? []) fn();
    },
  };
});

type Store = typeof import('../src/state/store');

/** 게임을 (다시) 켠다: 가게 모듈을 새로 불러온다. 저장소의 글자는 그대로 남아 있다. */
async function boot(): Promise<Store> {
  vi.resetModules();
  env.listeners.clear();
  env.state.visibility = 'visible';
  return import('../src/state/store');
}

/** 연달아 누르기 막기(0.3초)를 넘기려고 시계를 앞으로 돌린다 */
function later(): void {
  vi.advanceTimersByTime(400);
}

function saved(): { schema: number; build: string; cards: string[]; current?: GameState; walked?: string; papers?: string[]; cleared: object } | null {
  const raw = env.data.get(SAVE_KEY);
  return raw ? JSON.parse(raw) : null;
}

const PACK = getPack('s1395') as SituationPack;

/** 제목에서 봄의 맵까지 */
function startSpring(s: Store, look: Look = 'girl'): void {
  later();
  s.goBook();
  later();
  s.openStory('s1395');
  later();
  s.settleRole('farmer', look);
  later();
  s.beginYear();
}

/** 그 일을 처음 열린 선택지와 놀이의 첫 모습으로 넘길 값 */
function inputFor(game: GameState, id: string, pick = 0): DoInput {
  const h = PACK.happenings.find((x) => x.id === id)!;
  const open = openChoiceIds(PACK, game, id);
  return { id, choiceId: open.length > 0 ? open[Math.min(pick, open.length - 1)] : undefined, play: h.play ? Object.keys(h.play.flags)[0] : undefined };
}

/** "미션이 풀림" 종이를 다 넘긴다. 종이가 닫히지 않으면(판이 나아가지 않으면) 멈추지 않고 실패한다. */
function closePapers(s: Store): void {
  for (let n = 0; s.missionQueue.value.length > 0; n++) {
    if (n > 20) throw new Error('"미션이 풀림" 종이가 닫히지 않는다');
    later();
    s.closeMissionDone();
  }
}

/** 맵에서 일 하나를 한다: 자리에 닿아 대화 장면이 열리고, 고르고, 닫고, "미션이 풀림" 종이를 넘긴다 */
function doOne(s: Store, id: string, pick = 0): void {
  later();
  s.openTalk(id);
  expect(s.talk.value).toBe(id);
  const deed = s.commitTalk(inputFor(s.game.value!, id, pick));
  expect(deed?.happeningId).toBe(id);
  s.closeTalk();
  closePapers(s);
}

/** 꼭 할 일을 다 한다(덤은 하지 않는다). 한 일의 수를 돌려준다. */
function doMusts(s: Store, limit = 99): number {
  let n = 0;
  for (; n < limit; n++) {
    const g = s.game.value!;
    if (canCloseSeason(PACK, g)) break;
    const next = openHappenings(PACK, g).find((v) => v.must && !v.noSun);
    if (!next) throw new Error('꼭 할 일이 남았는데 할 수 있는 일이 없다');
    doOne(s, next.happening.id);
  }
  return n;
}

/** 지금 계절의 꼭 할 일을 다 하고 계절을 보낸 뒤 다음으로 넘긴다. 넘어간 화면을 돌려준다. */
function passSeason(s: Store): string {
  doMusts(s);
  later();
  s.closeSeasonNow();
  expect(s.screen.value).toBe('seasonClose');
  later();
  s.goNextSeason();
  return s.screen.value;
}

/** 만들어진 계절을 차례로 보낸다. 한 해가 다 만들어졌으면 한 해 돌아보기에서 멈춘다. 보낸 계절의 수를 돌려준다. */
function passBuiltSeasons(s: Store): number {
  for (let n = 1; n <= SEASONS.length; n++) {
    const to = passSeason(s);
    if (to !== 'map') return n;
  }
  throw new Error('한 해가 끝나지 않는다');
}

/** 농민 집의 네 계절이 모두 만들어졌는가(1-라부터) */
const YEAR_BUILT = SEASONS.every((season) => seasonReady(PACK, 'farmer', season));

// 견본 저장(글자 그대로)
const SAVE_FILES = import.meta.glob<string>('./fixtures/saves/*.json', { eager: true, query: '?raw', import: 'default' });

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-03-02T09:00:00'));
  env.data.clear();
  env.state.failWrites = false;
  env.state.noStorage = false;
  env.state.search = '';
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('화면 차례', () => {
  it('제목 → 이야기책 → 누가 될까 → 나를 소개합니다 → 맵', async () => {
    const s = await boot();
    expect(s.screen.value).toBe('title');
    expect(s.loadStatus.value).toBe('empty');
    expect(s.canContinue.value).toBe(false);
    later();
    s.goBook();
    expect(s.screen.value).toBe('book');
    later();
    s.openStory('s1395');
    expect(s.screen.value).toBe('rolePick');
    expect(s.pack.value?.situation.id).toBe('s1395');
    later();
    s.settleRole('farmer', 'girl');
    expect(s.screen.value).toBe('intro');
    expect(s.game.value?.look).toBe('girl');
    // 맵에 들어서기 전에는 아무것도 적지 않는다
    expect(saved()).toBeNull();
    later();
    s.beginYear();
    expect(s.screen.value).toBe('map');
    expect(saved()?.current?.role).toBe('farmer');
    expect(saved()?.schema).toBe(SCHEMA);
  });

  it('준비 중인 이야기와 집은 열리지 않는다', async () => {
    const s = await boot();
    later();
    s.goBook();
    later();
    s.openStory('s1592');
    expect(s.screen.value).toBe('book');
    later();
    s.openStory('없는 이야기');
    expect(s.screen.value).toBe('book');
    later();
    s.openStory('s1395');
    for (const role of ['son', 'daughter', 'nobi', '없는 집']) {
      later();
      s.settleRole(role, 'boy');
      expect(s.screen.value, role).toBe('rolePick');
      expect(s.game.value, role).toBeNull();
    }
  });

  it('연달아 두 번 누르면 한 번만 먹는다', async () => {
    const s = await boot();
    later();
    s.goBook();
    s.openStory('s1395'); // 0.3초가 지나지 않았다
    expect(s.screen.value).toBe('book');
    later();
    s.openStory('s1395');
    expect(s.screen.value).toBe('rolePick');
  });

  it('남자아이·여자아이 모습 모두: 꼭 할 일을 다 해야 봄을 보낼 수 있고, 보내면 계절 닫기 → 여름의 맵', async () => {
    for (const look of ['boy', 'girl'] as const) {
      env.data.clear();
      const s = await boot();
      startSpring(s, look);
      // 꼭 할 일이 남았으면 넘어가지 않는다
      later();
      s.closeSeasonNow();
      expect(s.screen.value).toBe('map');
      expect(s.game.value?.phase).toBe('season');
      const did = doMusts(s);
      expect(did).toBeGreaterThanOrEqual(2);
      expect(canCloseSeason(PACK, s.game.value!)).toBe(true);
      later();
      s.closeSeasonNow();
      expect(s.screen.value).toBe('seasonClose');
      expect(s.game.value?.phase).toBe('seasonClose');
      expect(saved()?.current?.phase).toBe('seasonClose');
      expect(s.nextSeasonReady()).toBe(true); // 여름이 만들어져 있다(1-라부터)
      later();
      s.goNextSeason();
      expect(s.screen.value).toBe('map');
      expect(s.game.value?.seasonIndex).toBe(1);
      expect(s.game.value?.phase).toBe('season');
      expect(saved()?.current?.seasonIndex).toBe(1);
      later();
      s.backToTitle();
      expect(s.screen.value).toBe('title');
      expect(s.game.value).toBeNull();
    }
  });
});

describe('대화 장면과 미션이 풀림', () => {
  it('자리에 닿으면 대화 장면이 얹히고, 그동안 맵은 멈춘다', async () => {
    const s = await boot();
    startSpring(s);
    expect(s.mapBusy.value).toBe(false);
    const first = openHappenings(PACK, s.game.value!).find((v) => v.must)!.happening.id;
    s.openTalk(first);
    expect(s.talk.value).toBe(first);
    expect(s.mapBusy.value).toBe(true);
    // 대화가 떠 있는 동안에는 다른 일이 열리지 않는다
    s.openTalk('다른 일');
    expect(s.talk.value).toBe(first);
  });

  it('"나중에 할게요": 고르기 전에 닫으면 아무 일도 일어나지 않은 것이다', async () => {
    const s = await boot();
    startSpring(s);
    const before = s.game.value;
    const first = openHappenings(PACK, before!).find((v) => v.must)!.happening.id;
    s.openTalk(first);
    s.closeTalk();
    expect(s.talk.value).toBeNull();
    expect(s.game.value).toEqual(before);
    expect(s.missionQueue.value).toEqual([]);
    expect(s.mapBusy.value).toBe(false);
  });

  it('일을 마치면 바로 저장되고, 미션이 풀리면 대화가 닫힌 뒤에 종이가 뜬다', async () => {
    const s = await boot();
    startSpring(s);
    let solvedSeen = false;
    for (let step = 0; step < 12 && !canCloseSeason(PACK, s.game.value!); step++) {
      const g = s.game.value!;
      const next = openHappenings(PACK, g).find((v) => v.must && !v.noSun)!.happening.id;
      later();
      s.openTalk(next);
      const deed = s.commitTalk(inputFor(g, next));
      expect(deed).not.toBeNull();
      // 대화 장면이 결과를 보여 주는 동안 이미 적혀 있다(여기서 꺼도 한 일은 남는다)
      expect(saved()?.current?.done).toContain(next);
      expect(s.talk.value).toBe(next);
      expect(s.missionQueue.value).toEqual([]);
      s.closeTalk();
      expect(s.talk.value).toBeNull();
      expect(s.missionQueue.value).toEqual(deed!.solved);
      if (deed!.solved.length > 0) {
        solvedSeen = true;
        expect(s.mapBusy.value).toBe(true);
        expect(saved()?.current?.solved).toEqual(expect.arrayContaining(deed!.solved));
      }
      closePapers(s);
      expect(s.mapBusy.value).toBe(false);
    }
    expect(solvedSeen).toBe(true);
  });

  it('대화 장면을 닫을 때도 저장한다: 그때 서 있던 자리가 적힌다("나중에 할게요"로 닫아도)', async () => {
    const s = await boot();
    startSpring(s);
    const first = openHappenings(PACK, s.game.value!).find((v) => v.must)!.happening.id;
    s.markPlace('29,36', ['village'], 'ff');
    expect(saved()?.current?.at).toBeUndefined();
    s.openTalk(first);
    s.closeTalk();
    expect(saved()?.current?.at).toBe('29,36');
    expect(saved()?.walked).toBe('ff');
    expect(saved()?.current?.done).toEqual([]);
  });

  it('봇짐과 지난 이야기는 맵 위에 뜨고, 대화 중에는 열리지 않는다', async () => {
    const s = await boot();
    startSpring(s);
    s.openPanel('bag');
    expect(s.panel.value).toBe('bag');
    expect(s.mapBusy.value).toBe(true);
    s.openPanel('past');
    expect(s.panel.value).toBe('past');
    s.openPanel('past');
    expect(s.panel.value).toBeNull();
    s.openPanel('bag');
    const first = openHappenings(PACK, s.game.value!)[0].happening.id;
    s.openTalk(first);
    expect(s.panel.value).toBeNull();
    s.openPanel('bag');
    expect(s.panel.value).toBeNull();
  });

  it('해 ☀가 다 지면 덤으로 하는 일은 더 할 수 없다(가게가 엔진의 약속을 지킨다)', async () => {
    const s = await boot();
    startSpring(s);
    let extras = 0;
    for (let step = 0; step < 10; step++) {
      const next = openHappenings(PACK, s.game.value!).find((v) => !v.must && !v.noSun);
      if (!next) break;
      doOne(s, next.happening.id);
      extras++;
    }
    expect(extras).toBe(PACK.situation.roles.find((r) => r.id === 'farmer')!.suns);
    expect(s.game.value!.sunsLeft).toBe(0);
    // 남은 덤은 맵에 보이지만 할 수 없다
    const left = openHappenings(PACK, s.game.value!).filter((v) => !v.must);
    expect(left.length).toBeGreaterThan(0);
    expect(left.every((v) => v.noSun)).toBe(true);
    // 꼭 할 일은 해가 없어도 할 수 있다
    doMusts(s);
    expect(canCloseSeason(PACK, s.game.value!)).toBe(true);
  });
});

describe('끄고 켜도 이어진다', () => {
  it('봄의 어느 때에 꺼도 그 판 그대로, 그 계절의 맵에서 이어진다', async () => {
    // 꼭 할 일을 0개, 1개, 2개 … 한 뒤에 끄고 켠다
    for (let cut = 0; cut < 8; cut++) {
      env.data.clear();
      let s = await boot();
      startSpring(s, cut % 2 === 0 ? 'girl' : 'boy');
      const did = doMusts(s, cut);
      const before = s.game.value!;
      s = await boot();
      expect(s.loadStatus.value, `${cut}`).toBe('ok');
      expect(s.screen.value).toBe('title');
      expect(s.canContinue.value).toBe(true);
      later();
      s.continueGame();
      expect(s.screen.value, `${cut}`).toBe('map');
      expect(s.game.value, `${cut}`).toEqual(before);
      expect(s.talk.value).toBeNull();
      // 이어서 끝까지 갈 수 있다
      doMusts(s);
      later();
      s.closeSeasonNow();
      expect(s.screen.value, `${cut}`).toBe('seasonClose');
      if (did < cut) break; // 꼭 할 일을 다 했다
    }
  });

  it('대화나 놀이 도중에 끄면 그 일의 처음부터다(고르기 전의 것은 적히지 않는다)', async () => {
    let s = await boot();
    startSpring(s);
    const before = s.game.value!;
    const first = openHappenings(PACK, before).find((v) => v.must)!.happening.id;
    s.openTalk(first);
    // 여는 대화를 읽는 중에 화면이 가려지고 꺼졌다
    env.state.visibility = 'hidden';
    env.fire('visibilitychange');
    s = await boot();
    later();
    s.continueGame();
    expect(s.screen.value).toBe('map');
    expect(s.talk.value).toBeNull();
    expect(s.game.value).toEqual(before);
    expect(openHappenings(PACK, s.game.value!).some((v) => v.happening.id === first)).toBe(true);
  });

  it('마지막에 서 있던 자리와 가 본 곳이 남는다: 화면이 가려질 때 적는다', async () => {
    let s = await boot();
    startSpring(s);
    const walked = packBits(Uint8Array.from({ length: 96 * 72 }, (_, i) => (i % 3 === 0 ? 1 : 0)));
    s.markPlace('46,34', ['village', 'fields'], walked);
    // markPlace는 적지 않는다(걸을 때마다 저장소를 건드리지 않는다)
    expect(saved()?.current?.at).toBeUndefined();
    env.state.visibility = 'hidden';
    env.fire('visibilitychange');
    expect(saved()?.current?.at).toBe('46,34');
    expect(saved()?.current?.seen).toEqual(['village', 'fields']);
    expect(saved()?.walked).toBe(walked);
    s = await boot();
    later();
    s.continueGame();
    expect(s.game.value?.at).toBe('46,34');
    expect(s.game.value?.seen).toEqual(['village', 'fields']);
    expect(s.walkedText()).toBe(walked);
  });

  it('창을 닫을 때(pagehide)도, 일을 마칠 때도, 처음으로 갈 때도 서 있던 자리가 적힌다', async () => {
    const s = await boot();
    startSpring(s);
    s.markPlace('30,36', ['village']);
    env.fire('pagehide');
    expect(saved()?.current?.at).toBe('30,36');
    s.markPlace('29,36', ['village']);
    const first = openHappenings(PACK, s.game.value!).find((v) => v.must)!.happening.id;
    doOne(s, first);
    expect(saved()?.current?.at).toBe('29,36');
    s.markPlace('44,54', ['village', 'fields']);
    s.askHome();
    expect(s.askingHome.value).toBe(true);
    expect(s.mapBusy.value).toBe(true);
    s.goHome();
    expect(s.askingHome.value).toBe(false);
    expect(s.screen.value).toBe('title');
    expect(saved()?.current?.at).toBe('44,54');
    expect(s.canContinue.value).toBe(true);
    later();
    s.continueGame();
    expect(s.screen.value).toBe('map');
    expect(s.game.value?.at).toBe('44,54');
  });

  it('계절 닫기 화면에서 끄면 계절 닫기에서, 봄을 넘긴 뒤에 끄면 여름의 맵에서 이어진다', async () => {
    let s = await boot();
    startSpring(s);
    doMusts(s);
    later();
    s.closeSeasonNow();
    const closed = s.game.value;
    s = await boot();
    later();
    s.continueGame();
    expect(s.screen.value).toBe('seasonClose');
    expect(s.game.value).toEqual(closed);
    later();
    s.goNextSeason();
    expect(s.screen.value).toBe('map');
    const summer = s.game.value;
    s = await boot();
    expect(s.canContinue.value).toBe(true);
    later();
    s.continueGame();
    expect(s.screen.value).toBe('map');
    expect(s.game.value).toEqual(summer);
    expect(s.game.value?.seasonIndex).toBe(1);
    expect(s.game.value?.at).toBeUndefined();
  });

  it('새 계절로 넘어가면 가 본 칸은 비운다(계절마다 새로 걷는다)', async () => {
    const s = await boot();
    startSpring(s);
    s.markPlace('30,36', ['village'], 'ff00');
    doMusts(s);
    expect(saved()?.walked).toBe('ff00');
    later();
    s.closeSeasonNow();
    later();
    s.goNextSeason();
    expect(s.walkedText()).toBe('');
    expect(saved()?.walked).toBe('');
  });

  it('새 판을 시작하면 앞 판의 가 본 칸이 딸려 오지 않는다', async () => {
    const s = await boot();
    startSpring(s);
    s.markPlace('30,36', ['village'], 'ff00');
    s.goHome();
    expect(saved()?.walked).toBe('ff00');
    later();
    s.dropCurrent();
    startSpring(s, 'boy');
    expect(s.walkedText()).toBe('');
    expect(saved()?.walked).toBe('');
    expect(saved()?.current?.at).toBeUndefined();
  });

  it('모은 카드는 판 밖에도 적힌다(수첩)', async () => {
    const s = await boot();
    startSpring(s);
    doMusts(s);
    const cards = s.game.value!.cards;
    expect(saved()?.cards).toEqual(expect.arrayContaining(cards));
    // 진행 중인 해를 지워도 카드는 남는다
    s.goHome();
    s.dropCurrent();
    expect(saved()?.current).toBeUndefined();
    expect(saved()?.cards).toEqual(expect.arrayContaining(cards));
    expect(s.canContinue.value).toBe(false);
  });
});

describe('"미션이 풀림" 종이를 보기 전에 꺼도 다음에 뜬다(review 4번)', () => {
  /** 미션을 푸는 일 바로 앞까지 간 뒤, 그 일의 id를 돌려준다 */
  function untilSolving(s: Store): string {
    for (let step = 0; step < 12; step++) {
      const g = s.game.value!;
      const next = openHappenings(PACK, g).find((v) => v.must && !v.noSun)!.happening.id;
      // 이 일을 하면 미션이 풀리는가(엔진으로 미리 해 본다)
      const tried = doHappening(PACK, g, inputFor(g, next));
      if (tried.solved.length > g.solved.length) return next;
      doOne(s, next);
    }
    throw new Error('미션을 푸는 일에 이르지 못했다');
  }

  it('결과 대화를 보다가 끄면: 이어 할 때 맵에 들어서자마자 종이가 뜨고, 닫으면 다시 뜨지 않는다', async () => {
    let s = await boot();
    startSpring(s);
    const id = untilSolving(s);
    later();
    s.openTalk(id);
    const deed = s.commitTalk(inputFor(s.game.value!, id))!;
    expect(deed.solved.length).toBe(1);
    // 대화 장면이 결과를 보여 주는 중이다. 종이는 아직 뜨지 않았지만 저장에는 빚으로 적혀 있다.
    expect(s.missionQueue.value).toEqual([]);
    expect(saved()?.papers).toEqual(deed.solved);
    s = await boot();
    later();
    s.continueGame();
    expect(s.screen.value).toBe('map');
    expect(s.talk.value).toBeNull();
    expect(s.missionQueue.value).toEqual(deed.solved);
    expect(s.mapBusy.value).toBe(true);
    later();
    s.closeMissionDone();
    expect(s.missionQueue.value).toEqual([]);
    expect(saved()?.papers).toBeUndefined();
    s = await boot();
    later();
    s.continueGame();
    expect(s.missionQueue.value).toEqual([]);
  });

  it('종이가 떠 있을 때 끄거나 처음으로 가도 다음에 다시 뜬다', async () => {
    let s = await boot();
    startSpring(s);
    const id = untilSolving(s);
    later();
    s.openTalk(id);
    const deed = s.commitTalk(inputFor(s.game.value!, id))!;
    s.closeTalk();
    expect(s.missionQueue.value).toEqual(deed.solved);
    s.goHome();
    expect(s.missionQueue.value).toEqual([]);
    later();
    s.continueGame();
    expect(s.missionQueue.value).toEqual(deed.solved);
    s = await boot();
    later();
    s.continueGame();
    expect(s.missionQueue.value).toEqual(deed.solved);
  });

  it('새 판을 시작하면 앞 판의 종이가 딸려 오지 않는다', async () => {
    const s = await boot();
    startSpring(s);
    const id = untilSolving(s);
    later();
    s.openTalk(id);
    s.commitTalk(inputFor(s.game.value!, id));
    s.closeTalk();
    s.goHome();
    later();
    s.dropCurrent();
    startSpring(s, 'boy');
    expect(s.missionQueue.value).toEqual([]);
    expect(saved()?.papers).toBeUndefined();
  });

  it('계절을 넘기면 남은 종이는 지워진다', async () => {
    const s = await boot();
    startSpring(s);
    doMusts(s);
    later();
    s.closeSeasonNow();
    expect(saved()?.papers).toBeUndefined();
    expect(s.missionQueue.value).toEqual([]);
  });
});

describe('한 해를 끝맺는다(1-라)', () => {
  it.runIf(YEAR_BUILT)('두 모습 모두: 계절 넷을 보내면 한 해 돌아보기, 남길 것을 고르면 이야기를 깬다 — 깬 기록이 진행 중인 해와 따로 남는다', async () => {
    for (const look of ['girl', 'boy'] as const) {
      env.data.clear();
      const s = await boot();
      startSpring(s, look);
      // 계절이 바뀔 때마다: 그 계절의 맵, 서 있던 칸은 비워져 집 앞에서 시작한다, 해 ☀가 다시 찬다
      for (let index = 1; index < SEASONS.length; index++) {
        s.markPlace('46,34', ['village'], 'ff00');
        expect(passSeason(s)).toBe('map');
        const g = s.game.value!;
        expect(g.seasonIndex).toBe(index);
        expect(g.phase).toBe('season');
        expect(g.at).toBeUndefined();
        expect(s.walkedText()).toBe('');
        expect(g.sunsLeft).toBeGreaterThan(0);
        // 날씨는 여름에 들어설 때 뽑혀 저장에 적힌다
        expect(g.draw).not.toBeNull();
        expect(saved()?.current?.draw).toBe(g.draw);
        expect(saved()?.current?.seasonIndex).toBe(index);
      }
      // 겨울을 보내면 한 해가 끝난다
      expect(passSeason(s)).toBe('review');
      expect(s.game.value?.phase).toBe('done');
      expect(saved()?.current?.phase).toBe('done');
      const cards = s.game.value!.cards;
      const ended = s.game.value!;
      const legacy = PACK.situation.legacy[1].id;
      later();
      s.finishYear(legacy);
      expect(s.screen.value).toBe('book');
      expect(s.game.value).toBeNull();
      // 깬 기록: 역할, 모습, 한 해 이름, 남긴 것. 진행 중인 해는 내려놓는다.
      const record = (saved()?.cleared as Record<string, { role: string; look: string; ending: string; legacy: string }[]>).s1395;
      expect(record).toHaveLength(1);
      expect(record[0].role).toBe('farmer');
      expect(record[0].look).toBe(look);
      expect(record[0].legacy).toBe(legacy);
      expect(PACK.situation.endings.some((e) => e.id === record[0].ending)).toBe(true);
      // 꼴 4: 그 해의 줄거리(날씨, 처음과 계절마다의 수치, 한 일마다 고른 것, 놀이의 끝, 푼 미션, 카드)가 id와 수로 남는다(review 41번)
      const story = record[0] as unknown as { draw: string | null; flow: number[][]; picks: Record<string, string>; plays: Record<string, string>; solved: string[]; cards: string[] };
      expect(story.draw).toBe(ended.draw);
      expect(story.flow).toEqual(ended.flow.map((st) => [st.living, st.body, st.trust]));
      expect(story.flow).toHaveLength(SEASONS.length + 1);
      expect(Object.keys(story.picks)).toEqual(ended.history.map((d) => d.happeningId));
      for (const deed of ended.history) {
        expect(story.picks[deed.happeningId]).toBe(deed.choiceId ?? '');
        if (deed.play) expect(story.plays[deed.happeningId]).toBe(deed.play);
      }
      expect(Object.keys(story.plays).length).toBeGreaterThan(0);
      expect(story.solved).toEqual(ended.solved);
      expect(story.cards).toEqual(ended.cards);
      // 한 줄이 작다(학생 기기의 저장 한 칸이 커지지 않게)
      expect(JSON.stringify(record[0]).length).toBeLessThan(2000);
      expect(saved()?.current).toBeUndefined();
      expect(saved()?.cards).toEqual(expect.arrayContaining(cards));
      expect(s.canContinue.value).toBe(false);
    }
  });

  it.runIf(YEAR_BUILT)('깬 이야기를 다른 모습으로 다시 한다: 깬 기록은 남고, 다시 깨면 줄이 는다', async () => {
    let s = await boot();
    startSpring(s, 'girl');
    passBuiltSeasons(s);
    later();
    s.finishYear(PACK.situation.legacy[0].id);
    // 끄고 켜도 깬 기록이 남아 있다
    s = await boot();
    expect(s.save.value.cleared.s1395).toHaveLength(1);
    expect(s.canContinue.value).toBe(false);
    // 같은 이야기를 남자아이 모습으로 다시
    later();
    s.goBook();
    later();
    s.openStory('s1395');
    later();
    s.settleRole('farmer', 'boy');
    later();
    s.beginYear();
    expect(s.screen.value).toBe('map');
    // 하는 도중에도 앞의 깬 기록은 그대로다
    expect((saved()?.cleared as Record<string, unknown[]>).s1395).toHaveLength(1);
    passBuiltSeasons(s);
    later();
    s.finishYear(PACK.situation.legacy[2].id);
    const records = (saved()?.cleared as Record<string, { look: string; legacy: string }[]>).s1395;
    expect(records.map((r) => r.look)).toEqual(['girl', 'boy']);
    expect(records[1].legacy).toBe(PACK.situation.legacy[2].id);
  });

  it.runIf(YEAR_BUILT)('한 해 돌아보기에서 끄면 이어 하기로 돌아보기가 다시 열린다', async () => {
    let s = await boot();
    startSpring(s);
    passBuiltSeasons(s);
    expect(s.screen.value).toBe('review');
    const before = s.game.value;
    s = await boot();
    expect(s.canContinue.value).toBe(true);
    later();
    s.continueGame();
    expect(s.screen.value).toBe('review');
    expect(s.game.value).toEqual(before);
    later();
    s.finishYear(PACK.situation.legacy[0].id);
    expect(s.screen.value).toBe('book');
  });

  it.runIf(YEAR_BUILT)('계절마다 도중에 끄고 켜도 그 계절의 맵에서 그 판 그대로 이어진다', async () => {
    let s = await boot();
    startSpring(s);
    for (let index = 0; index < SEASONS.length; index++) {
      // 그 계절의 꼭 할 일을 하나 한 뒤에 끈다
      const first = openHappenings(PACK, s.game.value!).find((v) => v.must && !v.noSun);
      if (first) doOne(s, first.happening.id);
      s.markPlace('40,36', ['village'], 'f0f0');
      env.state.visibility = 'hidden';
      env.fire('visibilitychange');
      const before = s.game.value!;
      s = await boot();
      later();
      s.continueGame();
      expect(s.screen.value, SEASONS[index]).toBe('map');
      expect(s.game.value, SEASONS[index]).toEqual(before);
      expect(currentSeason(s.game.value!)).toBe(SEASONS[index]);
      expect(s.walkedText()).toBe('f0f0');
      passSeason(s);
    }
    expect(s.screen.value).toBe('review');
  });

  it('닫지 않은 "미션이 풀림" 종이는 계절을 보내면 버려진다: 다음 계절의 맵에 지난 계절의 종이가 뜨지 않고 저장에도 남지 않는다', async () => {
    let s = await boot();
    startSpring(s);
    // 꼭 할 일을 하되 종이는 하나도 넘기지 않는다(대화 장면만 닫는다)
    for (let n = 0; n < 40 && !canCloseSeason(PACK, s.game.value!); n++) {
      const g = s.game.value!;
      const next = openHappenings(PACK, g).find((v) => v.must && !v.noSun)!.happening.id;
      later();
      s.openTalk(next);
      s.commitTalk(inputFor(g, next));
      s.closeTalk();
      // 종이가 떠 있어도 엔진의 판은 이미 나아가 있다 — 화면에서는 종이가 맵을 덮지만, 가게는 그와 상관없이 버틴다
      if (s.missionQueue.value.length > 0) s.missionQueue.value = [];
    }
    expect(saved()?.papers?.length).toBeGreaterThan(0);
    later();
    s.closeSeasonNow();
    expect(s.screen.value).toBe('seasonClose');
    expect(s.missionQueue.value).toEqual([]);
    expect(saved()?.papers).toBeUndefined();
    // 계절 닫기에서 끄고 켜도 종이가 되살아나지 않는다
    s = await boot();
    later();
    s.continueGame();
    expect(s.screen.value).toBe('seasonClose');
    expect(s.missionQueue.value).toEqual([]);
    later();
    s.goNextSeason();
    expect(s.missionQueue.value).toEqual([]);
    expect(saved()?.papers).toBeUndefined();
    if (s.screen.value !== 'map') return; // 여름이 아직 만들어지지 않았다
    // 여름에 푼 미션의 종이만 뜬다
    const springSolved = [...s.game.value!.solved];
    doMusts(s);
    expect(s.game.value!.solved.length).toBeGreaterThan(springSolved.length);
    expect(saved()?.papers).toBeUndefined();
  });

  it.runIf(YEAR_BUILT)('여름·가을·겨울에도 종이를 보기 전에 끄면 다음에 뜬다', async () => {
    let s = await boot();
    startSpring(s);
    for (let index = 1; index < SEASONS.length; index++) {
      expect(passSeason(s)).toBe('map');
      // 미션이 풀리는 일까지 가서, 종이를 넘기지 않고 끈다
      let owedIds: string[] = [];
      for (let n = 0; n < 40 && owedIds.length === 0; n++) {
        const g = s.game.value!;
        const next = openHappenings(PACK, g).find((v) => v.must && !v.noSun)!.happening.id;
        later();
        s.openTalk(next);
        const deed = s.commitTalk(inputFor(g, next))!;
        s.closeTalk();
        if (deed.solved.length > 0) owedIds = deed.solved;
        else closePapers(s);
      }
      expect(owedIds.length, SEASONS[index]).toBeGreaterThan(0);
      expect(saved()?.papers).toEqual(owedIds);
      s = await boot();
      later();
      s.continueGame();
      expect(s.screen.value).toBe('map');
      expect(s.missionQueue.value, SEASONS[index]).toEqual(owedIds);
      closePapers(s);
      expect(saved()?.papers).toBeUndefined();
    }
  });

  it('한 해가 끝나기 전에는 이야기를 깰 수 없다', async () => {
    const s = await boot();
    startSpring(s);
    later();
    s.finishYear(PACK.situation.legacy[0].id);
    expect(s.screen.value).toBe('map');
    expect(saved()?.cleared).toEqual({});
    doMusts(s);
    later();
    s.closeSeasonNow();
    later();
    s.finishYear(PACK.situation.legacy[0].id);
    expect(s.screen.value).toBe('seasonClose');
    expect(saved()?.cleared).toEqual({});
  });

  it('모르는 남길 것을 넘겨도 멈추지 않는다(빈 것으로 적힌다)', async () => {
    const s = await boot();
    startSpring(s);
    passBuiltSeasons(s);
    if (s.screen.value !== 'review') return; // 한 해가 아직 다 만들어지지 않았다
    later();
    s.finishYear('없는 것');
    expect(s.screen.value).toBe('book');
    expect((saved()?.cleared as Record<string, { legacy: string }[]>).s1395[0].legacy).toBe('');
  });
});

describe('실제 옛 판(4a1d0a6 — 운영 주소의 판)을 눌러 뜬 저장(review 34번 ㉠)', () => {
  const file = (name: string): string => SAVE_FILES[`./fixtures/saves/${name}.json`];

  it.runIf(YEAR_BUILT)('"다음에 만들어요" 화면의 저장: 여름의 맵, 집 앞에서(서 있던 칸 없음, 가 본 칸 비움) 계절 첫 줄이 뜰 형편으로, 그때 뽑힌 날씨 그대로', async () => {
    const raw = file('schema3-old-spring-over');
    const old = JSON.parse(raw).current as GameState;
    env.data.set(SAVE_KEY, raw);
    const s = await boot();
    expect(s.loadStatus.value).toBe('migrated');
    expect(s.canContinue.value).toBe(true);
    later();
    s.continueGame();
    expect(s.screen.value).toBe('map');
    const g = s.game.value!;
    expect(currentSeason(g)).toBe('summer');
    expect(g.at).toBeUndefined();
    expect(s.walkedText()).toBe('');
    // 맵은 서 있던 칸이 없고 이 계절에 한 일이 없을 때 계절의 첫 줄을 띄운다(MapScreen)
    expect(g.history.filter((d) => d.season === 'summer')).toHaveLength(0);
    expect(g.draw).toBe(old.draw);
    expect(g.done).toEqual(old.done);
    // 한 번 저장하면 꼴 4로 적힌다
    s.saveNow();
    expect(saved()?.schema).toBe(4);
    passBuiltSeasons(s);
    expect(s.screen.value).toBe('review');
  });

  it.runIf(YEAR_BUILT)('봄 도중 · 봄을 다 하고 안 보냄 · 봄을 닫은 직후의 저장이 제자리에서 이어져 한 해 끝까지 간다', async () => {
    for (const [name, first] of [
      ['schema3-old-spring-mid', 'map'],
      ['schema3-old-spring-done', 'map'],
      ['schema3-old-spring-closed', 'seasonClose'],
    ] as const) {
      env.data.clear();
      const raw = file(name);
      const old = JSON.parse(raw).current as GameState;
      env.data.set(SAVE_KEY, raw);
      const s = await boot();
      later();
      s.continueGame();
      expect(s.screen.value, name).toBe(first);
      expect(s.game.value!.at, name).toBe(old.at);
      expect(s.game.value!.done, name).toEqual(old.done);
      if (first === 'seasonClose') {
        later();
        s.goNextSeason();
        expect(s.screen.value).toBe('map');
        // 봄을 다 하고 안 보낸 판은 보내는 순간(여름에 들어서며) 날씨가 적힌다
        expect(s.game.value!.draw).not.toBeNull();
        expect(s.game.value!.at).toBeUndefined();
      }
      passBuiltSeasons(s);
      expect(s.screen.value, name).toBe('review');
    }
  });
});

describe('봄까지 한 옛 저장(1-다와 태블릿 바퀴의 판이 만든 것)', () => {
  const overs = Object.keys(SAVE_FILES).filter((path) => path.includes('-spring-over'));

  it('견본이 있다: 꼴 2와 꼴 3의 "봄을 보내고 여름으로 넘어간" 저장', () => {
    expect(overs.map((path) => path.split('/').pop()).sort()).toEqual(expect.arrayContaining(['schema2-spring-over.json', 'schema3-spring-over.json']));
  });

  it.runIf(YEAR_BUILT)('여름이 생긴 이 판에서 "이어 하기"를 누르면 여름의 맵에서 이어진다(집 앞에서, 그때 뽑힌 날씨 그대로)', async () => {
    for (const path of overs) {
      env.data.clear();
      env.data.set(SAVE_KEY, SAVE_FILES[path]);
      const old = JSON.parse(SAVE_FILES[path]).current as GameState;
      const s = await boot();
      expect(['ok', 'migrated'], path).toContain(s.loadStatus.value);
      expect(s.canContinue.value, path).toBe(true);
      later();
      s.continueGame();
      expect(s.screen.value, path).toBe('map');
      const g = s.game.value!;
      expect(g.seasonIndex).toBe(1);
      expect(currentSeason(g)).toBe('summer');
      // 봄에 한 일과 정한 것이 그대로 넘어온다
      expect(g.done).toEqual(old.done);
      expect(g.flags).toEqual(old.flags);
      expect(g.solved).toEqual(old.solved);
      expect(g.stats).toEqual(old.stats);
      // 날씨는 봄을 닫고 넘어갈 때 이미 뽑혀 저장에 적혀 있었다 — 그대로 쓴다
      expect(g.draw).toBe(old.draw);
      expect(g.draw).not.toBeNull();
      // 그 판으로 한 해를 끝까지 간다
      passBuiltSeasons(s);
      expect(s.screen.value, path).toBe('review');
      later();
      s.finishYear(PACK.situation.legacy[0].id);
      expect(s.screen.value).toBe('book');
    }
  });

  it.runIf(YEAR_BUILT)('봄의 한가운데·봄을 보낸 바로 뒤의 옛 저장도 한 해를 끝까지 간다', async () => {
    const olds = Object.keys(SAVE_FILES).filter((path) => /-spring-(mid|paper|closed)\.json$/.test(path));
    expect(olds.length).toBeGreaterThanOrEqual(5);
    for (const path of olds) {
      env.data.clear();
      env.data.set(SAVE_KEY, SAVE_FILES[path]);
      const s = await boot();
      later();
      s.continueGame();
      expect(['map', 'seasonClose'], path).toContain(s.screen.value);
      closePapers(s);
      if (s.screen.value === 'seasonClose') {
        later();
        s.goNextSeason();
        expect(s.screen.value, path).toBe('map');
      }
      passBuiltSeasons(s);
      expect(s.screen.value, path).toBe('review');
    }
  });
});

describe('새 판', () => {
  it('새 판을 만들 때마다 판의 번호가 는다(맵이 앞 판의 자리를 버린다 — review 14번)', async () => {
    env.state.search = '?seed=7';
    const s = await boot();
    const before = s.gameNo.value;
    startSpring(s);
    const first = s.gameNo.value;
    expect(first).toBe(before + 1);
    expect(s.game.value!.seed).toBe(7);
    s.markPlace('46,34', ['village'], 'ff');
    s.goHome();
    // 이어 하기는 같은 판이다
    later();
    s.continueGame();
    expect(s.gameNo.value).toBe(first);
    s.goHome();
    // 처음부터: 같은 씨앗, 같은 모습이어도 다른 판이다
    later();
    s.dropCurrent();
    startSpring(s);
    expect(s.game.value!.seed).toBe(7);
    expect(s.gameNo.value).toBeGreaterThan(first);
    expect(s.game.value!.at).toBeUndefined();
  });

  // 2026-11-11 대화 넘기기: 넘기는 법 알림은 판마다(새로 시작·이어 하기) 처음 몇 창에만 뜬다 — 그 판을 가르는 번호
  it('판을 연 번호(playNo)는 새로 시작할 때와 이어 하기로 열 때마다 는다(gameNo와 달리 이어 하기에서도)', async () => {
    env.state.search = '?seed=7';
    const s = await boot();
    const before = s.playNo.value;
    startSpring(s);
    expect(s.playNo.value).toBe(before + 1);
    const game = s.gameNo.value;
    s.goHome();
    later();
    s.continueGame();
    expect(s.screen.value).toBe('map');
    expect(s.playNo.value).toBe(before + 2);
    expect(s.gameNo.value).toBe(game);
    // 대화를 열고 닫는 것, 계절을 보내는 것은 판을 새로 열지 않는다
    s.openTalk('s1395-spring-sow');
    expect(s.talk.value).toBe('s1395-spring-sow');
    s.closeTalk();
    expect(s.playNo.value).toBe(before + 2);
  });
});

describe('저장이 안 되거나 읽을 수 없을 때', () => {
  it('저장이 안 되는 창: 알리고, 게임은 끝까지 된다', async () => {
    env.state.noStorage = true;
    const s = await boot();
    expect(s.loadStatus.value).toBe('noStorage');
    startSpring(s);
    expect(s.screen.value).toBe('map');
    expect(s.saveFailed.value).toBe(true);
    doMusts(s);
    later();
    s.closeSeasonNow();
    expect(s.screen.value).toBe('seasonClose');
    later();
    s.goNextSeason();
    expect(s.screen.value).toBe('map');
    // 저장이 안 되어도 한 해를 끝까지 하고 이야기책으로 돌아간다(깬 기록은 이 창에만 남는다)
    for (let n = 0; n < SEASONS.length && s.screen.value === 'map'; n++) passSeason(s);
    expect(s.screen.value).toBe('review');
    later();
    s.finishYear(PACK.situation.legacy[0].id);
    expect(s.screen.value).toBe('book');
    expect(s.save.value.cleared.s1395).toHaveLength(1);
    expect(env.data.size).toBe(0);
  });

  it('쓰다가 실패하면(공간 없음) 알리고 게임은 이어진다. 다시 써지면 알림이 꺼진다', async () => {
    const s = await boot();
    startSpring(s);
    expect(s.saveFailed.value).toBe(false);
    env.state.failWrites = true;
    const first = openHappenings(PACK, s.game.value!).find((v) => v.must)!.happening.id;
    doOne(s, first);
    expect(s.saveFailed.value).toBe(true);
    expect(s.game.value!.done).toContain(first);
    expect(saved()?.current?.done).toEqual([]);
    env.state.failWrites = false;
    s.saveNow();
    expect(s.saveFailed.value).toBe(false);
    expect(saved()?.current?.done).toContain(first);
  });

  it('글자가 깨진 저장: 처음부터 하되 깨진 글자를 한 벌 남긴다', async () => {
    env.data.set(SAVE_KEY, '{"schema":2,"cards":[');
    const s = await boot();
    expect(s.loadStatus.value).toBe('unreadable');
    expect(s.canContinue.value).toBe(false);
    expect(env.data.get(BACKUP_KEY)).toBe('{"schema":2,"cards":[');
    startSpring(s);
    expect(s.screen.value).toBe('map');
    expect(saved()?.current?.role).toBe('farmer');
  });

  it('진행 중인 해만 망가진 저장: 깬 기록과 카드는 남고 그 해만 봄부터 다시 한다', async () => {
    let s = await boot();
    startSpring(s);
    doMusts(s);
    const raw = saved()!;
    const cards = raw.cards;
    expect(cards.length).toBeGreaterThan(0);
    env.data.set(SAVE_KEY, JSON.stringify({ ...raw, cleared: { s1395: [{ role: 'farmer', look: 'girl', ending: 'e', legacy: 'l' }] }, current: { ...raw.current, stats: 'x' } }));
    s = await boot();
    expect(s.loadStatus.value).toBe('yearLost');
    expect(s.canContinue.value).toBe(false);
    expect(s.save.value.cards).toEqual(cards);
    expect(s.save.value.cleared.s1395).toHaveLength(1);
    // 새로 시작해도 깬 기록과 카드가 저장에 그대로 있다
    startSpring(s);
    expect(saved()?.cards).toEqual(cards);
    expect((saved()?.cleared as Record<string, unknown[]>).s1395).toHaveLength(1);
  });

  it('저장에 없어진 일·카드가 섞여 있으면 그 항목만 버리고 이어 한다', async () => {
    let s = await boot();
    startSpring(s);
    const first = openHappenings(PACK, s.game.value!).find((v) => v.must)!.happening.id;
    doOne(s, first);
    const raw = saved()!;
    const cur = raw.current!;
    env.data.set(
      SAVE_KEY,
      JSON.stringify({
        ...raw,
        current: {
          ...cur,
          done: [...cur.done, 's1395-없어진-일'],
          solved: ['s1395-없어진-미션'],
          cards: [...cur.cards, '없어진 카드'],
          items: ['없어진 물건'],
          history: [...cur.history, { ...cur.history[0], happeningId: 's1395-없어진-일' }],
        },
      }),
    );
    s = await boot();
    expect(s.loadStatus.value).toBe('ok');
    later();
    s.continueGame();
    expect(s.screen.value).toBe('map');
    expect(s.game.value!.done).toEqual(cur.done);
    expect(s.game.value!.solved).toEqual([]);
    expect(s.game.value!.cards).toEqual(cur.cards);
    expect(s.game.value!.items).toEqual([]);
    expect(s.game.value!.history).toHaveLength(cur.history.length);
    expect(s.game.value!.stats).toEqual(cur.stats);
    // 그 판으로 끝까지 간다
    doMusts(s);
    later();
    s.closeSeasonNow();
    expect(s.screen.value).toBe('seasonClose');
  });

  it('남겨 둔 한 벌(backup)은 계절을 하나 넘기면 지운다', async () => {
    env.data.set(SAVE_KEY, '{"깨진');
    const s = await boot();
    expect(env.data.has(BACKUP_KEY)).toBe(true);
    startSpring(s);
    doMusts(s);
    expect(env.data.has(BACKUP_KEY)).toBe(true);
    later();
    s.closeSeasonNow();
    expect(env.data.has(BACKUP_KEY)).toBe(false);
    expect(saved()?.current?.phase).toBe('seasonClose');
  });

  it('없는 역할이나 될 수 없는 모습의 저장: 열자마자 그 해만 내려놓고 제목에서 알린다("이어 하기"가 보이지 않는다)', async () => {
    for (const hurt of [{ role: '없는 집' }, { role: 'son', look: 'girl' }]) {
      env.data.clear();
      let s = await boot();
      startSpring(s);
      doMusts(s);
      const raw = saved()!;
      const text = JSON.stringify({ ...raw, current: { ...raw.current, ...hurt } });
      env.data.set(SAVE_KEY, text);
      s = await boot();
      // "이어 하기"를 내놓기 전에(열자마자) 그 해를 내려놓고 알린다 — 눌러야 알게 되지 않는다
      expect(s.screen.value).toBe('title');
      expect(s.loadStatus.value).toBe('yearLost');
      expect(s.canContinue.value).toBe(false);
      later();
      s.continueGame();
      expect(s.screen.value).toBe('title');
      expect(s.game.value).toBeNull();
      // 카드는 남고, 내려놓기 전의 글자가 한 벌 남는다
      expect(saved()?.current).toBeUndefined();
      expect(saved()?.cards).toEqual(raw.cards);
      expect(env.data.get(BACKUP_KEY)).toBe(text);
      // 새로 시작할 수 있다
      startSpring(s);
      expect(s.screen.value).toBe('map');
    }
  });

  it('한 일의 기록이 망가진 저장: 읽을 때 그 해만 버린다("이어 하기"가 먹통이 되지 않는다)', async () => {
    let s = await boot();
    startSpring(s);
    doMusts(s);
    const raw = saved()!;
    for (const history of [[...raw.current!.history, 'x'], [{ happeningId: 3 }], [null]]) {
      env.data.set(SAVE_KEY, JSON.stringify({ ...raw, current: { ...raw.current, history } }));
      s = await boot();
      expect(s.loadStatus.value).toBe('yearLost');
      expect(s.canContinue.value).toBe(false);
      expect(s.save.value.cards).toEqual(raw.cards);
    }
  });

  it('남은 해 ☀가 터무니없는 저장: 그 역할의 해로 묶어 이어 한다', async () => {
    let s = await boot();
    startSpring(s);
    const raw = saved()!;
    env.data.set(SAVE_KEY, JSON.stringify({ ...raw, current: { ...raw.current, sunsLeft: 999 } }));
    s = await boot();
    later();
    s.continueGame();
    expect(s.screen.value).toBe('map');
    expect(s.game.value!.sunsLeft).toBe(PACK.situation.roles.find((r) => r.id === 'farmer')!.suns);
  });

  it('덤을 하나 한 뒤의 저장에 해 ☀가 터무니없이 적혀 있으면: 역할의 해에서 쓴 해를 뺀 만큼으로 묶는다("3/4"로 뜨지 않게)', async () => {
    let s = await boot();
    startSpring(s);
    const extra = openHappenings(PACK, s.game.value!).find((v) => !v.must && !v.noSun)!.happening.id;
    doOne(s, extra);
    const suns = PACK.situation.roles.find((r) => r.id === 'farmer')!.suns;
    expect(s.game.value!.sunsLeft).toBe(suns - 1);
    const raw = saved()!;
    env.data.set(SAVE_KEY, JSON.stringify({ ...raw, current: { ...raw.current, sunsLeft: 999 } }));
    s = await boot();
    later();
    s.continueGame();
    expect(s.game.value!.sunsLeft).toBe(suns - 1);
  });

  it('같은 저장으로 거듭 멈추면 그 해를 내려놓는다(이어 하기 → 멈춤 → 처음으로가 되풀이되지 않게)', async () => {
    const s = await boot();
    startSpring(s);
    // 첫 번째 멈춤: 처음으로 가도 하던 해는 남아 있다
    s.openTalk('없는 일');
    s.commitTalk({ id: '없는 일' });
    expect(s.screen.value).toBe('trouble');
    s.goHome();
    expect(s.canContinue.value).toBe(true);
    later();
    s.continueGame();
    expect(s.screen.value).toBe('map');
    // 일을 하나도 마치지 못하고 또 멈춘다(화면을 그리다 멈춘 것도 같은 셈이다)
    s.noteTrouble();
    s.goHome();
    expect(s.screen.value).toBe('title');
    expect(s.loadStatus.value).toBe('yearLost');
    expect(s.canContinue.value).toBe(false);
    expect(env.data.has(BACKUP_KEY)).toBe(true);
  });

  it('멈춘 뒤에라도 일을 하나 마치면 다시 처음부터 센다', async () => {
    const s = await boot();
    startSpring(s);
    s.openTalk('없는 일');
    s.commitTalk({ id: '없는 일' });
    s.goHome();
    later();
    s.continueGame();
    const first = openHappenings(PACK, s.game.value!).find((v) => v.must)!.happening.id;
    doOne(s, first);
    s.noteTrouble();
    s.goHome();
    expect(s.canContinue.value).toBe(true);
    expect(s.loadStatus.value).not.toBe('yearLost');
  });

  it('이야기가 없어진 저장(다른 판의 것)은 이어 하기를 내놓지 않는다', async () => {
    let s = await boot();
    startSpring(s);
    const raw = saved()!;
    env.data.set(SAVE_KEY, JSON.stringify({ ...raw, current: { ...raw.current, situationId: 's0000' } }));
    s = await boot();
    expect(s.canContinue.value).toBe(false);
    later();
    s.continueGame();
    expect(s.screen.value).toBe('title');
  });

  it('코드보다 새 꼴의 저장은 건드리지 않는다', async () => {
    const raw = JSON.stringify({ schema: SCHEMA + 1, cards: ['미래'] });
    env.data.set(SAVE_KEY, raw);
    const s = await boot();
    expect(s.loadStatus.value).toBe('newer');
    expect(s.canContinue.value).toBe(false);
    expect(env.data.get(SAVE_KEY)).toBe(raw);
  });

  it('"모두 지우고 처음부터": 저장이 사라지고 이어 하기도 사라진다', async () => {
    let s = await boot();
    startSpring(s);
    doMusts(s);
    s.goHome();
    expect(s.canContinue.value).toBe(true);
    s.wipeAll();
    expect(env.data.size).toBe(0);
    expect(s.canContinue.value).toBe(false);
    expect(s.save.value.cards).toEqual([]);
    expect(s.screen.value).toBe('title');
    s = await boot();
    expect(s.loadStatus.value).toBe('empty');
    expect(s.canContinue.value).toBe(false);
  });
});

describe('엔진이 던져도 빈 화면에서 멈추지 않는다', () => {
  it('할 수 없는 일을 마치려 하면 "이어 갈 수 없어요"로 가고, 거기서 처음으로 갈 수 있다', async () => {
    const s = await boot();
    startSpring(s);
    const before = s.game.value;
    s.openTalk('없는 일');
    expect(s.commitTalk({ id: '없는 일' })).toBeNull();
    expect(s.screen.value).toBe('trouble');
    expect(s.talk.value).toBeNull();
    expect(s.game.value).toEqual(before);
    s.goHome();
    expect(s.screen.value).toBe('title');
    // 하던 해는 그대로 적혀 있어 이어 할 수 있다
    expect(s.canContinue.value).toBe(true);
  });

  it('잠긴 선택지를 넘겨도 판은 바뀌지 않는다', async () => {
    const s = await boot();
    startSpring(s);
    const view = openHappenings(PACK, s.game.value!).find((v) => v.must)!;
    const before = s.game.value;
    s.openTalk(view.happening.id);
    expect(s.commitTalk({ id: view.happening.id, choiceId: '없는 선택지' })).toBeNull();
    expect(s.screen.value).toBe('trouble');
    expect(s.game.value).toEqual(before);
    expect(saved()?.current?.done).toEqual([]);
  });
});

describe('주인공 그림의 이름', () => {
  it('농민·노비 집 아이는 모습이 붙고, 양반 집 아들·딸은 역할이 곧 모습이다', async () => {
    const s = await boot();
    expect(s.heroName('farmer', 'boy')).toBe('farmer-boy');
    expect(s.heroName('farmer', 'girl')).toBe('farmer-girl');
    expect(s.heroName('nobi', 'girl')).toBe('nobi-girl');
    expect(s.heroName('son', 'girl')).toBe('son');
    expect(s.heroName('daughter', 'boy')).toBe('daughter');
  });
});

// ── 저장 견본 만들기 ─────────────────────────────────────────────
// 저장의 꼴(schema)을 올릴 때는 옛 견본을 지우지 말고 새 번호의 견본을 더한다(옛 견본이 계속 읽히는지 tests/storage.test.ts가 본다).
//   VITE_MAKE_SAVES=spring npx vitest run tests/store.test.ts  … 봄의 견본(schemaN-spring-*.json)을 적는다.
//       꼴 2·3의 봄 견본은 봄만 있던 판(1-다, 태블릿 바퀴)이 만든 것이다 — 꼴을 올리기 전에는 다시 적지 않는다.
//   VITE_MAKE_SAVES=1 npx vitest run tests/store.test.ts       … 한 해가 다 있는 판(1-라부터)의 견본(schemaN-year-*.json)을 적는다.

const MAKE_SAVES = import.meta.env.VITE_MAKE_SAVES as string | undefined;

describe.runIf(MAKE_SAVES === '1' || MAKE_SAVES === 'spring')('저장 견본 만들기', () => {
  // 파일을 쓰는 것은 이 시험뿐이다. 이름을 이어 붙여 불러온다(이 프로젝트에는 Node의 형 정의를 두지 않는다).
  async function writer(): Promise<(name: string) => void> {
    const fs = (await import(/* @vite-ignore */ ['node', 'fs'].join(':'))) as {
      mkdirSync(path: string, options: { recursive: boolean }): void;
      writeFileSync(path: string, text: string): void;
    };
    const dir = decodeURIComponent(new URL('./fixtures/saves/', import.meta.url).pathname);
    fs.mkdirSync(dir, { recursive: true });
    return (name: string): void => {
      const raw = env.data.get(SAVE_KEY)!;
      expect(parseSave(raw).status).toBe('ok');
      fs.writeFileSync(`${dir}${name}`, `${JSON.stringify(JSON.parse(raw), null, 1)}\n`);
    };
  }
  const walked = (n: number): string => packBits(Uint8Array.from({ length: 96 * 72 }, (_, i) => (i % 96 > 24 && i % 96 < 24 + n && Math.floor(i / 96) > 28 && Math.floor(i / 96) < 60 ? 1 : 0)));

  /** 그 계절의 한가운데: 꼭 할 일 하나와 덤 하나를 하고 맵에 서 있다 */
  function midSeason(s: Store, at: string, n: number): void {
    const must = openHappenings(PACK, s.game.value!).find((v) => v.must && !v.noSun)!.happening.id;
    doOne(s, must);
    const extra = openHappenings(PACK, s.game.value!).find((v) => !v.must && !v.noSun);
    if (extra) doOne(s, extra.happening.id);
    s.markPlace(at, ['village', 'fields'], walked(n));
    s.saveNow();
  }

  it.runIf(MAKE_SAVES === 'spring')(`꼴 ${SCHEMA}의 봄 견본을 적는다`, async () => {
    const write = await writer();
    const s = await boot();
    env.state.search = '?seed=1395';
    startSpring(s, 'girl');
    // 봄의 한가운데: 꼭 할 일 하나와 덤 하나를 하고, 우물가에 서 있다
    midSeason(s, '46,34', 20);
    write(`schema${SCHEMA}-spring-mid.json`);
    // 미션을 푸는 일의 결과를 보는 중(종이가 아직 뜨지 않았다)
    for (let step = 0; step < 12; step++) {
      const g = s.game.value!;
      const next = openHappenings(PACK, g).find((v) => v.must && !v.noSun)!.happening.id;
      later();
      s.openTalk(next);
      const deed = s.commitTalk(inputFor(g, next))!;
      if (deed.solved.length > 0) {
        s.markPlace('44,57', ['village', 'fields'], walked(26));
        s.saveNow();
        write(`schema${SCHEMA}-spring-paper.json`);
        s.closeTalk();
        closePapers(s);
        break;
      }
      s.closeTalk();
    }
    // 봄을 보낸 바로 뒤(계절 닫기 화면)
    doMusts(s);
    s.markPlace('44,54', ['village', 'fields'], walked(30));
    later();
    s.closeSeasonNow();
    write(`schema${SCHEMA}-spring-closed.json`);
    // 여름으로 넘어간 뒤
    later();
    s.goNextSeason();
    s.markPlace('44,54', ['village', 'fields'], walked(30));
    s.saveNow();
    write(`schema${SCHEMA}-spring-over.json`);
  });

  it.runIf(MAKE_SAVES === '1' && YEAR_BUILT)(`꼴 ${SCHEMA}의 한 해 견본을 적는다(여름·가을·겨울의 한가운데, 한 해 돌아보기, 깬 뒤, 깨고 다시 하는 중)`, async () => {
    const write = await writer();
    let s = await boot();
    env.state.search = '?seed=1395';
    startSpring(s, 'girl');
    const spots = ['44,54', '40,36', '46,34'];
    for (let index = 1; index < SEASONS.length; index++) {
      expect(passSeason(s)).toBe('map');
      midSeason(s, spots[index - 1], 18 + index * 4);
      write(`schema${SCHEMA}-year-${SEASONS[index]}-mid.json`);
    }
    // 겨울을 보내고 한 해 돌아보기에 서 있다
    expect(passSeason(s)).toBe('review');
    s.saveNow();
    write(`schema${SCHEMA}-year-review.json`);
    // 남길 것을 골라 이야기를 깬 뒤(진행 중인 해가 없다)
    later();
    s.finishYear(PACK.situation.legacy[0].id);
    write(`schema${SCHEMA}-year-cleared.json`);
    // 깬 이야기를 다른 모습으로 다시 하는 중(깬 기록과 진행 중인 해가 함께 있다)
    s = await boot();
    env.state.search = '?seed=2';
    startSpring(s, 'boy');
    midSeason(s, '46,34', 20);
    write(`schema${SCHEMA}-year-again-mid.json`);
  });
});
