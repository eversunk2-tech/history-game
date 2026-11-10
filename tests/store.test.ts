// 화면 차례(store) 시험 — 4판의 출전 고리(spec 11.1 가): 제목 → 모습 → 마을 소개 → 거점 → 알림판·시간의 문 → 출전 준비 → 의뢰 소개 → 현장(①-1)
// → 작은 고비(굳은 논흙) → "큰 고비로" → 큰 고비(도깨비의 내기) → 결과 종이 → 자람 → 거점, 다시 하기. 저장은 꼴 5(save5.ts).
// 3판 store.test.ts의 대화·종이·저장 실패·엔진 오류 묶음은 새 흐름의 시작으로 옮겨 살렸다(11.1 사의 "지금 시험 가운데 지우거나 바꿔야 하는 것").
// 3판의 이야기책·계절 닫기·한 해 끝맺기·옛 저장으로 한 해 이어 가기의 시험은 그 화면과 길을 지워서 지웠다(옛 저장은 이제 "알림 + 한 벌 + 처음부터").
// 브라우저 없이 돈다: 가짜 저장소와 가짜 창을 걸어 두고, "끄고 켜기"는 가게 모듈을 새로 불러와서 흉내 낸다. 겨루기는 화면 대신 엔진으로 넘긴다
// (화면이 하는 그대로 — 가게의 battleKit이 준 준비와 문제 고르개로 카드를 고르고 답한다).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPack } from '../src/content';
import { s1395_1 } from '../src/content/episodes/s1395';
import { answer, battleResult, canCombo, chooseCard, startBattle, useCombo, affinityOf, type Battle } from '../src/engine/battle';
import { finishEpisode } from '../src/engine/episode';
import { openChoiceIds, openHappenings, type DoInput } from '../src/engine/game';
import { LEVEL_CAP_41 } from '../src/engine/growth';
import { unheard } from '../src/engine/quiz';
import type { GameState, Look, SituationPack } from '../src/engine/types';
import type { Save5 } from '../src/engine/types4';
import { BACKUP5_KEY, BACKUP_KEY, SAVE_KEY } from '../src/state/save5';

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

function saved(): Save5 | null {
  const raw = env.data.get(SAVE_KEY);
  return raw ? (JSON.parse(raw) as Save5) : null;
}

const PACK = getPack('s1395') as SituationPack;
type Mode = 'right' | 'wrong' | 'mix';

/** 제목에서 거점까지(처음부터 → 모습 → 마을 소개를 마침) */
function toHub(s: Store, look: Look = 'girl'): void {
  later();
  s.startFresh();
  later();
  s.pickLook(look);
  later();
  s.finishHubIntro();
}

/** 거점에서 현장까지(시간의 문 → ①-1 출전 준비 → 의뢰 소개 → 현장) */
function toField(s: Store, look: Look = 'girl', replay = false): void {
  later();
  s.openFacility('gate');
  later();
  s.openPrep('s1395-1', replay);
  later();
  s.settleRun('farmer', look, undefined);
  later();
  s.beginField();
}

/** 그 일을 처음 열린 선택지와 놀이의 첫 모습으로 넘길 값 */
function inputFor(game: GameState, id: string, pick = 0): DoInput {
  const h = PACK.happenings.find((x) => x.id === id)!;
  const open = openChoiceIds(PACK, game, id);
  return { id, choiceId: open.length > 0 ? open[Math.min(pick, open.length - 1)] : undefined, play: h.play ? Object.keys(h.play.flags)[0] : undefined };
}

function closePapers(s: Store): void {
  for (let n = 0; s.missionQueue.value.length > 0; n++) {
    if (n > 20) throw new Error('"미션이 풀림" 종이가 닫히지 않는다');
    later();
    s.closeMissionDone();
  }
}

/** 겨루기 하나를 엔진으로 끝까지(화면이 하는 그대로: 센 카드 먼저, 기세가 차면 그늘). mix는 다섯에 셋을 맞힌다 */
function fight(kit: NonNullable<ReturnType<Store['battleKit']>>, mode: Mode): Battle {
  let b = startBattle(kit.setup);
  let k = 0;
  const right = (): boolean => (mode === 'right' ? true : mode === 'wrong' ? false : k++ % 5 < 3);
  for (let guard = 0; guard < 100 && !b.end; guard++) {
    if (b.pending) b = answer(b, right(), kit.ask);
    else if (canCombo(b)) b = useCombo(b, 'shade', kit.ask);
    else {
      const card = b.hand.find((id) => affinityOf(b, id) === 'strong' && id !== b.frozen) ?? b.hand.find((id) => id !== b.frozen)!;
      b = chooseCard(b, card, kit.ask);
      b = answer(b, b.pending?.q ? right() : false, kit.ask);
    }
  }
  expect(b.end, '겨루기가 16차례 안에 끝난다').toBeDefined();
  return b;
}

/** 맵에서 일 하나를 한다: 대화 장면을 열고, (작은 고비가 있으면 넘기고) 고르고, 닫고, 종이를 넘긴다 */
function doOne(s: Store, id: string, pick = 0, mode: Mode = 'right'): void {
  later();
  s.openTalk(id);
  expect(s.talk.value).toBe(id);
  const minor = s.minorPending(id);
  if (minor) {
    const kit = s.battleKit(minor)!;
    s.finishMinor(minor, fight(kit, mode));
  }
  const deed = s.commitTalk(inputFor(s.game.value!, id, pick));
  expect(deed?.happeningId).toBe(id);
  s.closeTalk();
  closePapers(s);
}

const ROUTES = ['s1395-spring-return-help', 's1395-spring-return-ours', 's1395-spring-return-monks'];

/** ①-1의 꼭 할 일(미션 ①의 길 pick → 볍씨 뿌리기)과 덤 extras */
function playField(s: Store, pick = 0, extras: string[] = [], mode: Mode = 'right'): void {
  doOne(s, 's1395-spring-return', pick, mode);
  doOne(s, ROUTES[pick], 0, mode);
  doOne(s, 's1395-spring-sow', 0, mode);
  for (const id of extras) doOne(s, id, 0, mode);
}

/** "큰 고비로" → 큰 고비를 엔진으로 → 결과 종이 */
function playBoss(s: Store, mode: Mode = 'right'): Battle {
  later();
  s.goBoss();
  expect(s.screen.value).toBe('battle');
  const b = fight(s.battleKit('boss')!, mode);
  s.finishBoss(b);
  expect(s.screen.value).toBe('result');
  return b;
}

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

describe('화면 차례(출전 고리)', () => {
  it('제목 → 모습 → 마을 소개 → 거점: 첫 선물(쌀 3되·베 2자, 창고의 도리깨)과 "시험 판" 알림을 본 것으로 적는다', async () => {
    const s = await boot();
    expect(s.screen.value).toBe('title');
    expect(s.canContinue.value).toBe(false);
    later();
    s.startFresh();
    expect(s.screen.value).toBe('look');
    expect(s.save.value.hub.seen).not.toContain('trial');
    later();
    s.pickLook('boy');
    expect(s.screen.value).toBe('hubIntro');
    expect(saved()!.hub.seen).toContain('trial');
    later();
    s.finishHubIntro();
    expect(s.screen.value).toBe('hub');
    const sv = saved()!;
    expect(sv.hero.look).toBe('boy');
    expect(sv.purse).toEqual({ rice: 3, cloth: 2, coin: 0 });
    expect(sv.items).toEqual(['gear-flail']);
    expect(sv.hub.intro).toBe(true);
    // 다시 켜면 "이어 하기"는 거점으로(첫 선물을 두 번 받지 않는다)
    const again = await boot();
    expect(again.canContinue.value).toBe(true);
    later();
    again.continueGame();
    expect(again.screen.value).toBe('hub');
    later();
    again.finishHubIntro();
    expect(saved()!.purse).toEqual({ rice: 3, cloth: 2, coin: 0 });
  });

  it('거점 → 시간의 문 → 출전 준비 → 의뢰 소개 → 현장: 현장은 ①-1의 일만 연다(여름의 일이 하나도 열리지 않는다 — 11.1 가 ②)', async () => {
    const s = await boot();
    toHub(s);
    later();
    s.openFacility('gate');
    expect(s.screen.value).toBe('gate');
    later();
    s.openPrep('s1395-1', true); // 깨지 않은 에피소드는 다시 하기로 열지 않는다
    expect(s.screen.value).toBe('gate');
    later();
    s.openPrep('s1395-1', false);
    expect(s.screen.value).toBe('prep');
    later();
    // 도리깨는 가졌지만 ①(1395)에는 잠긴다(5.5 — 출전 준비에서 고를 수 없다)
    s.settleRun('farmer', 'girl', 'gear-flail');
    expect(s.screen.value).toBe('prep');
    later();
    s.settleRun('farmer', 'girl', undefined);
    expect(s.screen.value).toBe('intro');
    expect(saved()!.current!.phase).toBe('field');
    expect(saved()!.hero.gear.hand).toBeUndefined();
    later();
    s.beginField();
    expect(s.screen.value).toBe('map');
    const g = s.game.value!;
    expect(g.sunsLeft).toBe(2);
    const open = openHappenings(s.pack.value!, g).map((v) => v.happening.id);
    expect(open.every((id) => id.startsWith('s1395-spring-'))).toBe(true);
    for (const id of open) expect([...s1395_1.extras, 's1395-spring-return', 's1395-spring-sow'], id).toContain(id);
  });

  it('연달아 두 번 누르면 한 번만 먹는다', async () => {
    const s = await boot();
    later();
    s.startFresh();
    s.pickLook('girl'); // 0.3초 안
    expect(s.screen.value).toBe('look');
  });

  for (const look of ['boy', 'girl'] as const) {
    for (const mode of ['right', 'wrong', 'mix'] as const) {
      it(`${look} × ${mode}: 현장(작은 고비 포함) → 큰 고비 → 결과 종이 → (자람) → 거점. 모두 틀려도 막다른 판이 없다`, async () => {
        const s = await boot();
        toHub(s, look);
        toField(s, look);
        playField(s, look === 'boy' ? 0 : 2, ['s1395-spring-well'], mode);
        expect(s.run.value!.minors).toEqual(['s1395-1-hardsoil', 's1395-1-sowing']);
        expect(s.bossReady.value).toBe(true);
        const b = playBoss(s, mode);
        const res = battleResult(b)!;
        const paper = s.paperNow()!;
        expect(paper.stars).toEqual(res.stars);
        expect(paper.stars[0]).toBe(true);
        if (mode === 'wrong') {
          expect(res.rescued).toBe(true);
          expect(paper.stars).toEqual([true, false, false]);
        }
        if (mode === 'right') expect(paper.stars[2]).toBe(true);
        const sv = saved()!;
        expect(sv.current!.phase).toBe('result');
        expect(sv.stories.s1395.episodes['s1395-1'].cleared).toBe(true);
        expect(sv.items).toContain('relic-seed-sack');
        expect(sv.purse).toEqual({ rice: 9, cloth: 5, coin: 0 });
        // 겨루기에서 낸 문제가 서당 기록(이야기 문제 주제)에 적혔다
        expect(sv.quiz['ep-s1395-1']).toBeDefined();
        later();
        s.closeResult();
        if (sv.hero.points > 0) {
          expect(s.screen.value).toBe('growth');
          later();
          s.placeStat('heart');
          expect(saved()!.hero.stats.heart).toBe(4);
          s.leaveEpisode();
        }
        expect(s.screen.value).toBe('hub');
        expect(saved()!.current).toBeUndefined();
      });
    }
  }

  it('작은 고비를 넘기지 않고는 볍씨 뿌리기를 마칠 수 없다(대화 장면이 놀이 앞에서 연다). 넘기면 놀이의 작은 고비도 일로 적힌다', async () => {
    const s = await boot();
    toHub(s);
    toField(s);
    doOne(s, 's1395-spring-return', 0);
    doOne(s, 's1395-spring-return-help', 0);
    later();
    s.openTalk('s1395-spring-sow');
    expect(s.minorPending('s1395-spring-sow')?.id).toBe('s1395-1-hardsoil');
    // 엔진의 약속(작은 고비가 먼저)이 깨지면 가게가 받아 '이어 갈 수 없어요'로
    expect(s.commitTalk(inputFor(s.game.value!, 's1395-spring-sow'))).toBeNull();
    expect(s.screen.value).toBe('trouble');
  });

  it('"큰 고비로"는 꼭 할 일을 다 해야 뜬다', async () => {
    const s = await boot();
    toHub(s);
    toField(s);
    doOne(s, 's1395-spring-return', 0);
    later();
    s.goBoss();
    expect(s.screen.value).toBe('map');
    expect(s.bossReady.value).toBe(false);
  });

  it('다시 하기: 깬 ①-1을 연표에서 다시 한다 — 집을 다시 뽑지 않고, 돈은 주지 않고, 별과 최고 기록은 좋은 것이 남는다', async () => {
    const s = await boot();
    toHub(s);
    toField(s);
    playField(s, 0, [], 'wrong');
    playBoss(s, 'wrong');
    later();
    s.closeResult();
    if (s.screen.value === 'growth') {
      later();
      s.placeStat('power');
      s.leaveEpisode();
    }
    const before = saved()!;
    later();
    s.openFacility('gate');
    later();
    s.openPrep('s1395-1', true);
    later();
    s.settleRun('farmer', 'boy', undefined); // 이 이야기는 여자아이로 시작했다 — 다시 하기는 이야기의 모습으로(화면이 고정해 보인다)
    expect(s.run.value!.replay).toBe(true);
    expect(s.game.value!.look).toBe('girl');
    later();
    s.beginField();
    playField(s, 1, [], 'right');
    playBoss(s, 'right');
    const after = saved()!;
    expect(after.purse).toEqual(before.purse);
    expect(after.stories.s1395.episodes['s1395-1'].plays).toBe(2);
    expect(after.stories.s1395.firstRun).toEqual(before.stories.s1395.firstRun);
    expect(after.stories.s1395.episodes['s1395-1'].best).toBeGreaterThanOrEqual(before.stories.s1395.episodes['s1395-1'].best);
    expect(after.stories.s1395.episodes['s1395-1'].stars.filter(Boolean).length).toBeGreaterThan(1);
  });
});

describe('결과 종이의 값 = 엔진(11.1 사의 ㉢ 칸)', () => {
  it('결과 종이는 엔진 finishEpisode의 종이 그대로이고, 다 보기 전에 끄면 저장된 칸으로 같은 종이를 다시 그린다', async () => {
    const s = await boot();
    toHub(s);
    toField(s);
    playField(s, 2, ['s1395-spring-woods'], 'mix');
    later();
    s.goBoss();
    const kit = s.battleKit('boss')!;
    const b = fight(kit, 'mix');
    const pre = { save: s.save.value, game: s.game.value!, run: s.run.value! };
    s.finishBoss(b);
    const expected = finishEpisode({
      episode: s1395_1,
      replay: false,
      game: pre.game,
      minors: pre.run.minors,
      boss: battleResult(b)!,
      hero: pre.save.hero,
      purse: pre.save.purse,
      items: pre.save.items,
      story: pre.save.stories.s1395,
      met: s.metOf(PACK, pre.game),
      today: pre.save.today,
      date: s.todayDate(),
      cap: LEVEL_CAP_41,
    });
    const paper = s.paperNow()!;
    for (const key of ['first', 'stars', 'newStars', 'score', 'best', 'bestNew', 'levels', 'banked', 'purse', 'cards', 'stepped', 'relics', 'rescued'] as const) {
      expect(paper[key], key).toEqual(expected.paper[key]);
    }
    expect(saved()!.purse).toEqual(expected.purse);
    expect(saved()!.hero.level).toBe(expected.hero.level);
    // 다시 켜면 결과 종이에서 이어지고, 같은 종이다
    const again = await boot();
    later();
    again.continueGame();
    expect(again.screen.value).toBe('result');
    const reborn = again.paperNow()!;
    for (const key of ['stars', 'newStars', 'score', 'best', 'bestNew', 'xp', 'levels', 'banked', 'purse', 'cards', 'stepped', 'relics', 'rescued', 'first'] as const) {
      expect(reborn[key], key).toEqual(paper[key]);
    }
  });
});

describe('끄고 켜도 이어진다(5.8 — 꼴 5 견본 넷의 자리)', () => {
  it('거점에서 끄면 거점, 현장 도중이면 그 판 그대로 서 있던 칸에서, 겨루기 도중이면 그 겨루기의 처음부터, 결과 종이 도중이면 결과 종이', async () => {
    let s = await boot();
    toHub(s);
    s = await boot();
    later();
    s.continueGame();
    expect(s.screen.value).toBe('hub');
    toField(s);
    doOne(s, 's1395-spring-return', 0);
    s.markPlace('40,38', ['village'], 'ff00');
    env.state.visibility = 'hidden';
    env.fire('visibilitychange');
    const mid = s.game.value!;
    s = await boot();
    later();
    s.continueGame();
    expect(s.screen.value).toBe('map');
    expect(s.game.value!.at).toBe('40,38');
    expect(s.game.value!.done).toEqual(mid.done);
    expect(s.walkedText()).toBe('ff00');
    doOne(s, 's1395-spring-return-help');
    doOne(s, 's1395-spring-sow');
    later();
    s.goBoss();
    const kit1 = s.battleKit('boss')!;
    s = await boot();
    later();
    s.continueGame();
    expect(s.screen.value).toBe('battle');
    const kit2 = s.battleKit('boss')!;
    expect(kit2.setup.seed).toBe(kit1.setup.seed);
    expect(startBattle(kit2.setup).hand).toEqual(startBattle(kit1.setup).hand);
    s.finishBoss(fight(kit2, 'right'));
    s = await boot();
    later();
    s.continueGame();
    expect(s.screen.value).toBe('result');
  });

  it('꼴 5 견본(tests/fixtures/saves/v5)으로 켜면 그 자리에서 이어진다', async () => {
    const FIX = import.meta.glob<string>('./fixtures/saves/v5/*.json', { eager: true, query: '?raw', import: 'default' });
    const want: Record<string, string> = {
      'schema5-hub': 'hub',
      'schema5-field-mid': 'map',
      'schema5-battle-mid': 'battle',
      'schema5-result-mid': 'result',
      'schema5-cleared': 'hub',
      'schema5-seodang-mid': 'hub',
    };
    for (const [path, raw] of Object.entries(FIX)) {
      const name = path.replace(/^.*\/(.*)\.json$/, '$1');
      env.data.clear();
      env.data.set(SAVE_KEY, raw);
      const s = await boot();
      expect(s.loadStatus.value, name).toBe('ok');
      expect(s.canContinue.value, name).toBe(true);
      later();
      s.continueGame();
      expect(s.screen.value, name).toBe(want[name]);
      if (name === 'schema5-result-mid') expect(s.paperNow()!.stars, name).toEqual([true, false, false]);
      if (name === 'schema5-field-mid') expect(s.game.value!.at).toBe('41,39');
    }
  });

  it('대화 도중에 끄면 그 일의 처음부터다(고르기 전의 것은 적히지 않는다)', async () => {
    let s = await boot();
    toHub(s);
    toField(s);
    later();
    s.openTalk('s1395-spring-return');
    env.fire('pagehide');
    s = await boot();
    later();
    s.continueGame();
    expect(s.talk.value).toBeNull();
    expect(s.game.value!.done).toEqual([]);
  });

  it('"미션이 풀림" 종이를 닫기 전에 끄면 다음에 이어 할 때 뜨고, 닫으면 다시 뜨지 않는다', async () => {
    let s = await boot();
    toHub(s);
    toField(s);
    doOne(s, 's1395-spring-return', 0);
    later();
    s.openTalk('s1395-spring-return-help');
    s.commitTalk(inputFor(s.game.value!, 's1395-spring-return-help'));
    expect(saved()!.current!.papers).toEqual(['s1395-m-return']);
    s = await boot();
    later();
    s.continueGame();
    expect(s.missionQueue.value).toEqual(['s1395-m-return']);
    closePapers(s);
    s = await boot();
    later();
    s.continueGame();
    expect(s.missionQueue.value).toEqual([]);
  });
});

describe('옛 저장과 저장이 안 될 때', () => {
  it('옛 꼴(3판의 한 해 저장)이면 "게임이 새로워져서 처음부터 해요"를 한 번, 옛 글자는 joseon-year/backup에 한 벌, 저장은 처음부터', async () => {
    const OLD = import.meta.glob<string>('./fixtures/saves/schema4-year-autumn-mid.json', { eager: true, query: '?raw', import: 'default' });
    const raw = Object.values(OLD)[0];
    env.data.set(SAVE_KEY, raw);
    let s = await boot();
    expect(s.loadStatus.value).toBe('old');
    expect(env.data.get(BACKUP_KEY)).toBe(raw);
    expect(JSON.parse(env.data.get(SAVE_KEY)!).schema).toBe(5);
    expect(s.canContinue.value).toBe(false);
    // 다음에 켜면 알림이 다시 뜨지 않는다(한 번)
    s = await boot();
    expect(s.loadStatus.value).toBe('ok');
    expect(env.data.get(BACKUP_KEY)).toBe(raw);
    // 처음부터 해도 옛 꼴의 한 벌은 남는다
    toHub(s);
    expect(env.data.get(BACKUP_KEY)).toBe(raw);
  });

  it('저장이 안 되는 창: 알리고, 게임은 끝까지 된다', async () => {
    env.state.noStorage = true;
    const s = await boot();
    expect(s.loadStatus.value).toBe('noStorage');
    toHub(s);
    expect(s.saveFailed.value).toBe(true);
    toField(s);
    playField(s, 0);
    playBoss(s);
    expect(s.screen.value).toBe('result');
  });

  it('쓰다가 실패하면 알리고 게임은 이어진다. 다시 써지면 알림이 꺼진다', async () => {
    const s = await boot();
    toHub(s);
    env.state.failWrites = true;
    toField(s);
    expect(s.saveFailed.value).toBe(true);
    env.state.failWrites = false;
    doOne(s, 's1395-spring-return', 0);
    expect(s.saveFailed.value).toBe(false);
  });

  it('글자가 깨진 저장: 처음부터 하되 깨진 글자를 꼴 5의 한 벌(joseon-year/backup5)에 남긴다', async () => {
    env.data.set(SAVE_KEY, '{깨짐');
    const s = await boot();
    expect(s.loadStatus.value).toBe('unreadable');
    expect(env.data.get(BACKUP5_KEY)).toBe('{깨짐');
    expect(s.canContinue.value).toBe(false);
  });

  it('하던 에피소드만 망가진 저장: 주인공·돈·깬 기록은 남고 거점에서 이어 한다', async () => {
    let s = await boot();
    toHub(s);
    toField(s);
    const sv = saved()!;
    (sv.current as unknown as Record<string, unknown>).phase = 'nowhere';
    env.data.set(SAVE_KEY, JSON.stringify(sv));
    s = await boot();
    expect(s.loadStatus.value).toBe('trimmed');
    expect(s.save.value.purse).toEqual(sv.purse);
    later();
    s.continueGame();
    expect(s.screen.value).toBe('hub');
  });

  it('없는 에피소드의 저장(다른 판의 것)은 이어 가다 그 에피소드만 내려놓고 제목에서 알린다', async () => {
    let s = await boot();
    toHub(s);
    toField(s);
    const sv = saved()!;
    sv.current!.episode = 's1395-9';
    env.data.set(SAVE_KEY, JSON.stringify(sv));
    s = await boot();
    expect(s.canContinue.value).toBe(false);
    sv.current!.episode = 's1395-1';
    sv.current!.game = { ...sv.current!.game, role: 'king' as never };
    env.data.set(SAVE_KEY, JSON.stringify(sv));
    s = await boot();
    later();
    s.continueGame();
    expect(s.screen.value).toBe('title');
    expect(s.loadStatus.value).toBe('trimmed');
    expect(saved()!.current).toBeUndefined();
    expect(saved()!.purse).toEqual(sv.purse);
    expect(env.data.get(BACKUP5_KEY)).toBeDefined();
  });

  it('코드보다 새 꼴의 저장은 건드리지 않는다(화면이 가려져도·창을 닫아도 — 한 벌 칸도 그대로)', async () => {
    const raw = JSON.stringify({ schema: 6, hero: {} });
    env.data.set(SAVE_KEY, raw);
    env.data.set(BACKUP_KEY, '옛 꼴의 한 벌');
    env.data.set(BACKUP5_KEY, '꼴 5의 한 벌');
    const s = await boot();
    expect(s.loadStatus.value).toBe('newer');
    expect(env.data.get(SAVE_KEY)).toBe(raw);
    // 태블릿을 덮거나(가려짐) 새로 고침·창 닫기(pagehide)에도 빈 꼴 5로 덮지 않는다(4-1 ㉢ Review 고쳐야 함 가)
    env.state.visibility = 'hidden';
    env.fire('visibilitychange');
    env.fire('pagehide');
    s.saveNow();
    expect(env.data.get(SAVE_KEY)).toBe(raw);
    expect(env.data.get(BACKUP_KEY)).toBe('옛 꼴의 한 벌');
    expect(env.data.get(BACKUP5_KEY)).toBe('꼴 5의 한 벌');
    // 다시 켜도 알림이 그대로 뜬다(저장이 사라지지 않았다)
    const again = await boot();
    expect(again.loadStatus.value).toBe('newer');
  });

  it('"처음부터"(두 번 물은 뒤): 저장이 사라지고 모습 고르기부터', async () => {
    const s = await boot();
    toHub(s);
    toField(s);
    later();
    s.goHome();
    later();
    s.startFresh();
    expect(s.screen.value).toBe('look');
    expect(env.data.has(SAVE_KEY)).toBe(false);
    expect(s.save.value.hub.intro).toBe(false);
    expect(s.game.value).toBeNull();
  });
});

describe('엔진이 던져도 빈 화면에서 멈추지 않는다', () => {
  it('할 수 없는 일을 마치려 하면 "이어 갈 수 없어요"로 가고, 처음으로 갈 수 있다. 같은 저장으로 거듭 멈추면 하던 에피소드를 내려놓는다', async () => {
    const s = await boot();
    toHub(s);
    toField(s);
    expect(s.commitTalk({ id: 's1395-summer-weed' })).toBeNull();
    expect(s.screen.value).toBe('trouble');
    s.noteTrouble();
    s.goHome();
    expect(s.screen.value).toBe('title');
    expect(saved()!.current).toBeUndefined();
    expect(saved()!.hub.intro).toBe(true);
  });

  it('잠긴 선택지를 넘겨도 판은 바뀌지 않는다', async () => {
    const s = await boot();
    toHub(s);
    toField(s);
    const before = s.game.value;
    expect(s.commitTalk({ id: 's1395-spring-return', choiceId: 'nothing' })).toBeNull();
    expect(s.game.value).toBe(before);
  });
});

// 3판 store.test.ts(e539062)에 있던 다섯을 새 흐름(toHub·toField)으로 옮겨 살렸다(4-1 ㉢ Review 고쳐야 함 다 — 망가뜨려 보기 R38·R40~R43).
// 막던 탈은 그대로다: 대화 중에 창이 겹침, 맵이 앞 판의 자리를 들고 있음(review 14번), 앞 판의 가 본 칸이 딸려 옴, 거듭 멈춤의 셈, 띠의 "3/2".
describe('3판에서 옮겨 살린 것 — 창·판의 번호·가 본 칸·멈춘 횟수·해 ☀ 울타리', () => {
  it('봇짐과 지난 이야기는 맵 위에 뜨고, 대화 중에는 열리지 않는다', async () => {
    const s = await boot();
    toHub(s);
    toField(s);
    s.openPanel('bag');
    expect(s.panel.value).toBe('bag');
    expect(s.mapBusy.value).toBe(true);
    s.openPanel('past');
    expect(s.panel.value).toBe('past');
    s.openPanel('past');
    expect(s.panel.value).toBeNull();
    s.openPanel('bag');
    const first = openHappenings(s.pack.value!, s.game.value!)[0].happening.id;
    s.openTalk(first);
    expect(s.panel.value).toBeNull();
    s.openPanel('bag');
    expect(s.panel.value).toBeNull();
    s.openPanel('past');
    expect(s.panel.value).toBeNull();
  });

  it('출전해 새 판을 만들 때마다 판의 번호가 는다(맵이 앞 판의 자리를 버린다 — review 14번)', async () => {
    env.state.search = '?seed=7';
    const s = await boot();
    toHub(s);
    const before = s.gameNo.value;
    toField(s);
    const first = s.gameNo.value;
    expect(first).toBeGreaterThan(before);
    expect(s.game.value!.seed).toBe(7);
    s.markPlace('46,34', ['village'], 'ff');
    s.goHome();
    // 이어 하기는 같은 판이다(서 있던 칸 그대로 — 판의 번호는 맵을 새로 열려고 다시 는다)
    later();
    s.continueGame();
    expect(s.game.value!.at).toBe('46,34');
    const resumed = s.gameNo.value;
    // 같은 씨앗·같은 모습으로 다시 출전해도 다른 판이다(앞 판의 자리를 이어받지 않는다)
    later();
    s.openPrep('s1395-1', false);
    later();
    s.settleRun('farmer', 'girl', undefined);
    expect(s.game.value!.seed).toBe(7);
    expect(s.gameNo.value).toBeGreaterThan(resumed);
    expect(s.game.value!.at).toBeUndefined();
  });

  it('새 판을 시작하면 앞 판의 가 본 칸이 딸려 오지 않는다', async () => {
    const s = await boot();
    toHub(s);
    toField(s);
    s.markPlace('30,36', ['village'], 'ff00');
    s.goHome();
    expect(saved()!.current!.walked).toBe('ff00');
    // 하던 판을 두고 다시 출전한다(가게의 길 — 출전 준비가 새 판을 만든다)
    later();
    s.openPrep('s1395-1', false);
    later();
    s.settleRun('farmer', 'boy', undefined);
    expect(s.walkedText()).toBe('');
    later();
    s.beginField();
    expect(saved()!.current!.walked).toBeUndefined();
    expect(saved()!.current!.game.at).toBeUndefined();
  });

  it('멈춘 뒤에라도 일을 하나 마치면 다시 처음부터 센다(거듭 멈춤으로 치지 않는다)', async () => {
    const s = await boot();
    toHub(s);
    toField(s);
    s.openTalk('없는 일');
    expect(s.commitTalk({ id: '없는 일' })).toBeNull();
    expect(s.screen.value).toBe('trouble');
    s.goHome();
    expect(s.canContinue.value).toBe(true);
    later();
    s.continueGame();
    expect(s.screen.value).toBe('map');
    doOne(s, 's1395-spring-return', 0);
    s.noteTrouble();
    s.goHome();
    expect(s.screen.value).toBe('title');
    expect(s.loadStatus.value).not.toBe('trimmed');
    expect(s.canContinue.value).toBe(true);
    expect(saved()!.current).toBeDefined();
  });

  it('남은 해 ☀가 터무니없는 저장: 에피소드의 해(①-1은 둘)로 묶어 이어 한다', async () => {
    let s = await boot();
    toHub(s);
    toField(s);
    expect(s1395_1.suns).toBe(2);
    const raw = saved()!;
    env.data.set(SAVE_KEY, JSON.stringify({ ...raw, current: { ...raw.current!, game: { ...raw.current!.game, sunsLeft: 999 } } }));
    s = await boot();
    later();
    s.continueGame();
    expect(s.screen.value).toBe('map');
    expect(s.game.value!.sunsLeft).toBe(s1395_1.suns);
  });

  it('덤을 하나 한 뒤의 저장에 해 ☀가 터무니없이 적혀 있으면: 에피소드의 해에서 쓴 해를 뺀 만큼으로 묶는다("3/2"로 뜨지 않게)', async () => {
    let s = await boot();
    toHub(s);
    toField(s);
    const extra = openHappenings(s.pack.value!, s.game.value!).find((v) => !v.must && !v.noSun)!.happening.id;
    doOne(s, extra);
    expect(s.game.value!.sunsLeft).toBe(s1395_1.suns - 1);
    const raw = saved()!;
    env.data.set(SAVE_KEY, JSON.stringify({ ...raw, current: { ...raw.current!, game: { ...raw.current!.game, sunsLeft: 999 } } }));
    s = await boot();
    later();
    s.continueGame();
    expect(s.game.value!.sunsLeft).toBe(s1395_1.suns - 1);
  });
});

describe('가게가 문제 고르개에 그 판의 일을 넘긴다(겪은 것 먼저 — 4-1 ㉢ Review 권고 ㅁ, R08)', () => {
  it("큰 고비의 battleKit: 카드 문제와 지혜 겨루기 모두 그 판에서 겪은 것('at:' 꼬리표의 일을 한 것)을 겪지 않은 것보다 먼저 낸다", async () => {
    const s = await boot();
    toHub(s);
    toField(s);
    // ㉠ 이웃집 논 길, 덤 없이: 절(스님들)·뒷산 절·나무하기·우물가의 꼬리표를 단 문제는 겪지 않은 것이다
    playField(s, 0, [], 'right');
    later();
    s.goBoss();
    const kit = s.battleKit('boss')!;
    const done = s.game.value!.history.map((d) => d.happeningId);
    const story = new Map(kit.questions.filter((q) => q.topic === s1395_1.storyTopic).map((q) => [q.id, q]));
    const notHeard = (id: string): boolean => unheard(story.get(id)!, done);
    expect([...story.keys()].filter(notHeard).length).toBeGreaterThan(2);
    // 카드마다 낼 차례를 끝까지 뽑아 이야기 문제만 본다: 겪지 않은 것 뒤에 겪은 것이 오지 않는다
    for (const id of s1395_1.starter!) {
      const card = startBattle(kit.setup).ctx.cards[id];
      expect(card, id).toBeDefined();
      const order: string[] = [];
      for (let n = 0; n < 400; n++) {
        const next = kit.ask.card(card, { exclude: order, right: 0, turn: 1 });
        if (!next) break;
        order.push(next);
      }
      const told = order.filter((q) => story.has(q));
      expect(told.length, id).toBe(story.size);
      const firstUnheard = told.findIndex(notHeard);
      expect(firstUnheard, id).toBeGreaterThan(0);
      expect(told.slice(firstUnheard).every(notHeard), `${id}: ${told.join(' ')}`).toBe(true);
    }
    // 지혜 겨루기(핵심 물음 일곱)도 겪은 것 먼저
    const wise = kit.ask.wisdom(7, { exclude: [] });
    const cut = wise.findIndex(notHeard);
    expect(cut).toBeGreaterThan(0);
    expect(wise.slice(cut).every(notHeard), wise.join(' ')).toBe(true);
  });
});

describe('개발 판의 보류한 계절 보기(?field= — 저장하지 않는다)', () => {
  it('?field=summer는 여름의 꼭 할 일·덤만 연 맵을 열고, 해 보아도 저장하지 않는다', async () => {
    env.state.search = '?field=summer&who=farmer-girl';
    const s = await boot();
    s.openFromUrl();
    expect(s.screen.value).toBe('map');
    expect(s.devField.value).toBe('summer');
    const open = openHappenings(s.pack.value!, s.game.value!).map((v) => v.happening.id);
    expect(open.length).toBeGreaterThan(0);
    expect(open.every((id) => id.startsWith('s1395-summer-'))).toBe(true);
    const id = open[0];
    later();
    s.openTalk(id);
    s.commitTalk(inputFor(s.game.value!, id));
    expect(env.data.has(SAVE_KEY)).toBe(false);
  });
});

describe('주인공 그림의 이름', () => {
  it('농민·노비 집 아이는 모습이 붙고, 양반 집 아들·딸은 역할이 곧 모습이다', async () => {
    const s = await boot();
    expect(s.heroName('farmer', 'girl')).toBe('farmer-girl');
    expect(s.heroName('nobi', 'boy')).toBe('nobi-boy');
    expect(s.heroName('son', 'boy')).toBe('son');
    expect(s.heroName('daughter', 'girl')).toBe('daughter');
  });
});
