// 에피소드 엔진 시험(spec 5.2·5.3·5.6, 11.1 나·사의 ㉡ 칸): 에피소드의 일만 담은 묶음(fieldPack), 현장의 처음 판(seasonStart와 같은 길),
// ①-1에서 봄 밖의 일과 에피소드 밖의 일이 열리지 않음(현장의 모든 길을 걷는다 — 실제 묶음 src/content의 s1395와 에피소드 표로),
// 세 길 모두에서 굳은 논흙이 한 번씩, 덤은 해 ☀ 둘로 둘까지, "큰 고비로" = canCloseSeason, 작은 고비의 차례, 현장에서 얻은 카드,
// 결과(별·점수·최고 기록·처음 깬 판의 선택·다시 하기·경험치·돈·카드 키우기·유물·기력), 현장 → 작은 고비 → 큰 고비 → 결과의 흐름.

import { describe, expect, it } from 'vitest';
import { getPack } from '../src/content';
import { plan, s1395_1 } from '../src/content/episodes/s1395';
import { battleResult, type BattleResult } from '../src/engine/battle';
import {
  battleDeck,
  battleSetupFor,
  beginEpisode,
  canBoss,
  doField,
  fieldMissions,
  fieldOpen,
  fieldPack,
  fieldSkills,
  finishEpisode,
  firstRunOf,
  minorBefore,
  minorDone,
  startField,
  toBoss,
  toResult,
  type Current,
} from '../src/engine/episode';
import { LEVEL_CAP_41, newHero, type Today } from '../src/engine/growth';
import { canCloseSeason, newGame, openHappenings } from '../src/engine/game';
import { battleAsk } from '../src/engine/quiz';
import { mulberry32, pickOne } from '../src/engine/rng';
import { SEASONS, type GameState, type SituationPack } from '../src/engine/types';
import type { Hero, StoryRecord } from '../src/engine/types4';
import { doAll, explore, movesOf } from './fixtures';
import { allQuestions, autoBattle, cards41, episode41, fieldCards, foes41, hoe, starter } from './fixtures4';

const pack = getPack('s1395') as SituationPack;
const episode = s1395_1;
const lib = { foes: foes41, cards: cards41, gear: [hoe] };
const allowed = new Set([
  ...episode.extras,
  ...episode.missions.flatMap((id) => {
    const m = pack.missions.find((x) => x.id === id);
    return [...(m?.parts ?? []), ...(m?.rescue ? [m.rescue] : [])];
  }),
]);

const start = (look: 'boy' | 'girl' = 'boy', seed = 1) => startField(pack, episode, { role: 'farmer', look, seed });
const PATHS = {
  help: ['s1395-spring-return/help', 's1395-spring-return-help'],
  ours: ['s1395-spring-return/ours', 's1395-spring-return-ours'],
  give: ['s1395-spring-return/give', 's1395-spring-return-monks'],
};

describe('에피소드의 일만 담은 묶음', () => {
  it('같은 (pack, episode)면 같은 객체, 꼭 할 일은 에피소드의 미션, 일은 그 미션의 일과 덤만', () => {
    const before = JSON.stringify(pack);
    const field = fieldPack(pack, episode);
    expect(fieldPack(pack, episode)).toBe(field);
    expect(field.missions.map((m) => m.id)).toEqual(episode.missions);
    expect(new Set(field.happenings.map((h) => h.id))).toEqual(allowed);
    expect(field.situation).toBe(pack.situation);
    // 묶음을 고치지 않는다(3판의 길은 그대로)
    expect(JSON.stringify(pack)).toBe(before);
    expect(fieldPack(pack, { ...episode })).not.toBe(field);
    expect(() => fieldPack(pack, { ...episode, missions: ['없는-미션'] })).toThrow();
  });

  it('에피소드 표: ①-1 한 줄과 맵·놀이의 표시 이름표', () => {
    expect(plan.episodes.map((e) => e.id)).toEqual(['s1395-1']);
    expect(plan.marks.sowLow).toBe('sow.low');
    expect(episode.suns).toBe(2);
    expect(episode.minors.map((m) => m.at)).toEqual(['s1395-spring-sow', 's1395-spring-sow']);
  });
});

describe('현장의 처음 판', () => {
  it('3판 newGame 뒤 에피소드의 계절·해 ☀(2)로, 처음이면 역할의 시작 수치', () => {
    const s = start();
    expect(s.seasonIndex).toBe(SEASONS.indexOf('spring'));
    expect(s.sunsLeft).toBe(2);
    expect(s.stats).toEqual({ living: 4, body: 6, trust: 5 });
    expect(s.solved).toEqual([]);
    expect(s.phase).toBe('season');
    expect(s.flow).toHaveLength(1);
    expect(s.draw).toBe(newGame(pack, 'farmer', 'boy', 1).draw);
  });

  it('그 이야기의 형편에서 열 수 있고, 기력이 2 이하이면 해가 하나 준다', () => {
    const s = startField(pack, episode, {
      role: 'farmer',
      look: 'girl',
      seed: 3,
      from: { stats: { living: 2, body: 2, trust: 7 }, flags: ['x.flag'], cards: ['s1395-direct-sowing'], items: ['it'] },
    });
    expect(s.stats).toEqual({ living: 2, body: 2, trust: 7 });
    expect(s.sunsLeft).toBe(1);
    expect(s.flags).toEqual(['x.flag']);
    expect(s.cards).toEqual(['s1395-direct-sowing']);
    expect(s.items).toEqual(['it']);
  });

  it('여름 에피소드라면 계절의 자리가 여름이고 앞 계절의 꼭 푸는 미션은 푼 것으로 둔다(seasonStart와 같은 길)', () => {
    const summerMission = pack.missions.find((m) => m.must && m.season === 'summer' && (!m.roles || m.roles.includes('farmer')));
    expect(summerMission).toBeDefined();
    const summer = { ...episode, id: 'x-summer', season: 'summer' as const, missions: [summerMission?.id as string], extras: [] };
    const s = startField(pack, summer, { role: 'farmer', look: 'boy', seed: 1 });
    expect(s.seasonIndex).toBe(1);
    expect(s.solved).toEqual(expect.arrayContaining(['s1395-m-return', 's1395-m-sow']));
    expect(openHappenings(fieldPack(pack, summer), s).every((v) => v.happening.season === 'summer')).toBe(true);
  });
});

describe('①-1의 현장 — 모든 길을 걷는다', () => {
  for (const look of ['boy', 'girl'] as const) {
    it(`${look}: 봄 밖의 일과 에피소드 밖의 일이 열리지 않고, 막다른 길이 없고, "큰 고비로" = canCloseSeason`, () => {
      const field = fieldPack(pack, episode);
      const walk = explore(field, start(look));
      expect(walk.stuck).toEqual([]);
      expect(walk.all.length).toBeGreaterThan(20);
      const notSpring = pack.happenings.filter((h) => h.season !== 'spring').map((h) => h.id);
      expect(notSpring.length).toBeGreaterThan(10);
      for (const s of walk.all) {
        for (const v of openHappenings(field, s)) {
          expect(v.happening.season).toBe('spring');
          expect(allowed.has(v.happening.id)).toBe(true);
          expect(notSpring).not.toContain(v.happening.id);
        }
        expect(canBoss(pack, episode, s)).toBe(canCloseSeason(field, s));
        if (canBoss(pack, episode, s)) expect(s.solved).toEqual(expect.arrayContaining(episode.missions));
        // 덤은 해 ☀ 둘로 둘까지
        expect(s.history.filter((d) => d.sun === 1).length).toBeLessThanOrEqual(2);
        expect(fieldOpen(pack, episode, s)).toEqual(openHappenings(field, s));
        expect(fieldMissions(pack, episode, s).map((m) => m.mission.id).sort()).toEqual([...episode.missions].sort());
      }
    });
  }

  it('세 길(돌아온 집을 거듦·우리 일부터·스님께 곡식) 모두에서 굳은 논흙이 꼭 한 번 열린다', () => {
    const walk = explore(fieldPack(pack, episode), start());
    const closable = walk.all.filter((s) => canBoss(pack, episode, s));
    const byPath = new Map<string, number>();
    for (const s of closable) {
      const at = s.history.filter((d) => d.happeningId === 's1395-spring-sow');
      expect(at).toHaveLength(1);
      const path = s.flags.find((f) => f.startsWith('return.') && f !== 'return.done') as string;
      byPath.set(path, (byPath.get(path) ?? 0) + 1);
    }
    expect([...byPath.keys()].sort()).toEqual(['return.give', 'return.help', 'return.ours']);
    // 그 일 앞에서 짧은 겨루기가 열린다(놀이 앞)
    expect(minorBefore(episode, 's1395-spring-sow', [])).toMatchObject({ id: 's1395-1-hardsoil', kind: 'battle', before: 'play' });
    expect(minorBefore(episode, 's1395-spring-sow', ['s1395-1-hardsoil'])).toBeUndefined();
    expect(minorBefore(episode, 's1395-spring-well', [])).toBeUndefined();
  });

  it('기력이 2 이하로 시작하면 덤은 하나까지', () => {
    const tired = startField(pack, episode, { role: 'farmer', look: 'boy', seed: 1, from: { stats: { living: 4, body: 2, trust: 5 }, flags: [], cards: [], items: [] } });
    const walk = explore(fieldPack(pack, episode), tired);
    expect(walk.stuck).toEqual([]);
    for (const s of walk.all) expect(s.history.filter((d) => d.sun === 1).length).toBeLessThanOrEqual(1);
  });
});

describe('작은 고비와 현장에서 얻는 카드', () => {
  it('짧은 겨루기를 마치기 전에는 그 일을 할 수 없고, 놀이 작은 고비는 일을 하면 마친 것으로 적힌다', () => {
    let cur = beginEpisode(pack, episode, { role: 'farmer', look: 'boy', seed: 1, replay: false });
    expect(cur).toMatchObject({ episode: 's1395-1', phase: 'field', replay: false, minors: [] });
    expect(() => doField(pack, episode, cur, { id: 's1395-spring-sow', choiceId: 'low', play: 'even' })).toThrow();
    cur = minorDone(cur, 's1395-1-hardsoil');
    expect(minorDone(cur, 's1395-1-hardsoil')).toBe(cur);
    cur = doField(pack, episode, cur, { id: 's1395-spring-sow', choiceId: 'low', play: 'even' });
    expect(cur.minors).toEqual(['s1395-1-hardsoil', 's1395-1-sowing']);
    expect(() => toBoss(pack, episode, cur)).toThrow();
    cur = doField(pack, episode, cur, { id: 's1395-spring-return', choiceId: 'help' });
    cur = doField(pack, episode, cur, { id: 's1395-spring-return-help' });
    expect(canBoss(pack, episode, cur.game)).toBe(true);
    const boss = toBoss(pack, episode, cur);
    expect(boss.phase).toBe('battle');
    expect(() => doField(pack, episode, boss, { id: 's1395-spring-well', choiceId: 'listen' })).toThrow();
  });

  it('현장에서 얻는 카드는 길에 따라 하나~셋(덱에 저절로 더한다)', () => {
    const field = fieldPack(pack, episode);
    const sow = 's1395-spring-sow/low/even';
    const help = doAll(field, start(), [...PATHS.help, sow]);
    expect(fieldSkills(episode, help).sort()).toEqual(['skill-help', 'skill-sow']);
    const give = doAll(field, start(), [...PATHS.give, sow]);
    expect(fieldSkills(episode, give).sort()).toEqual(['skill-provision', 'skill-sow']);
    const ours = doAll(field, start(), [...PATHS.ours, sow]);
    expect(fieldSkills(episode, ours)).toEqual(['skill-sow']);
    const woodsId = 's1395-spring-woods';
    const choice = pack.happenings.find((h) => h.id === woodsId)?.choices?.[0].id;
    const more = doAll(field, help, [`${woodsId}/${choice}`]);
    expect(fieldSkills(episode, more).sort()).toEqual(['skill-help', 'skill-sow', 'skill-wood']);
    expect(battleDeck(episode, { deck: [] }, fieldSkills(episode, more))).toEqual([...starter, 'skill-help', 'skill-sow', 'skill-wood']);
    expect(battleDeck(episode, { deck: ['skill-bund', 'skill-help'] }, ['skill-help'])).toEqual(['skill-bund', 'skill-help']);
  });

  it('겨루기의 준비: 덱 = 정해 준 여섯 + 현장 카드, 기운은 현장의 기력으로, 장비와 단계', () => {
    const game = doAll(fieldPack(pack, episode), start(), [...PATHS.help, 's1395-spring-sow/low/even']);
    const hero: Hero = { ...newHero('boy'), gear: { hand: 'gear-hoe' }, cards: { 'skill-soil': 2 } };
    const setup = battleSetupFor(lib, episode, 'boss', { hero, game });
    expect(setup.foe.id).toBe('s1395-dokkaebi-bet');
    expect(setup.deck).toEqual([...starter, 'skill-help', 'skill-sow']);
    expect(setup.body).toBe(game.stats.body);
    expect(setup.gear?.map((g) => g.id)).toEqual(['gear-hoe']);
    expect(setup.kind).toBe('boss');
    const minor = battleSetupFor(lib, episode, episode.minors[0], { hero, game });
    expect(minor.foe.id).toBe('s1395-hardsoil');
    expect(minor.kind).toBe('minor');
    expect(minor.seed).not.toBe(setup.seed);
    expect(() => battleSetupFor(lib, episode, episode.minors[1], { hero, game })).toThrow();
  });
});

// ── 결과 ──────────────────────────────────────────────────────

function bossOf(stars: [boolean, boolean, boolean], score: number, rescued = false): BattleResult {
  return {
    end: rescued ? 'rescue' : 'win',
    stars,
    score,
    asked: 9,
    right: 6,
    rightQuestions: 6,
    strongUsed: true,
    rescued,
    bodyLoss: rescued ? 1 : 0,
    me: rescued ? 0 : 20,
    dealt: 90,
    turns: 8,
  };
}

const DATE = '2026-11-07';
const MET = Array.from({ length: 12 }, (_, i) => `met-${i}`);

function cleared(path: string[] = PATHS.help, look: 'boy' | 'girl' = 'boy'): GameState {
  return doAll(fieldPack(pack, episode), start(look), [...path, 's1395-spring-sow/low/even']);
}

describe('결과', () => {
  it('처음 깸(별 셋): 경험치 160, 쌀 6되·베 3자, 유물, 현장 카드, 처음 깬 판의 선택과 형편을 적는다', () => {
    const game = cleared();
    const out = finishEpisode({
      episode,
      replay: false,
      game,
      minors: ['s1395-1-hardsoil', 's1395-1-sowing'],
      boss: bossOf([true, true, true], 400),
      hero: newHero('boy'),
      purse: { rice: 3, cloth: 2, coin: 0 },
      items: ['flail'],
      met: MET,
      today: undefined,
      date: DATE,
      cap: LEVEL_CAP_41,
    });
    expect(out.paper).toMatchObject({ first: true, xp: 160, levels: 1, stars: [true, true, true], newStars: [true, true, true], best: 400, bestNew: true });
    expect(out.hero.level).toBe(2);
    expect(out.hero.xp).toBe(45);
    expect(out.hero.points).toBe(1);
    expect(out.purse).toEqual({ rice: 9, cloth: 5, coin: 0 });
    expect(out.items).toEqual(['flail', 'relic-seed-sack']);
    expect(out.paper.cards.sort()).toEqual(['skill-help', 'skill-sow']);
    expect(out.hero.cards['skill-help']).toBe(1);
    expect(out.hero.deck).toEqual(starter);
    for (const id of starter) expect(out.hero.cards[id]).toBe(1);
    expect(out.story.firstRun).toEqual(firstRunOf(game));
    expect(out.story.firstRun['s1395-spring-return']).toBe('help');
    expect(out.story.firstRun['s1395-spring-return-help']).toBe('');
    expect(out.story.stats).toEqual(game.stats);
    expect(out.story.flags).toEqual(game.flags);
    expect(out.story.episodes['s1395-1']).toEqual({ stars: [true, true, true], best: 400, plays: 1, cleared: true });
    expect(out.story.met).toEqual(MET);
    expect(out.today.replays).toEqual({});
    const current = toResult({ episode: 's1395-1', replay: false, game, phase: 'battle', minors: [] } as Current, out.paper);
    expect(current.phase).toBe('result');
    expect(current.result).toEqual({ stars: [true, true, true], score: 400, xp: 160, purse: { rice: 6, cloth: 3, coin: 0 }, cards: out.paper.cards });
  });

  it('구해 줌: 별 ①만, 경험치·돈은 그대로(별 몫만 준다), 그 이야기의 기력 −1', () => {
    const game = cleared(PATHS.ours);
    const out = finishEpisode({
      episode,
      replay: false,
      game,
      minors: ['s1395-1-hardsoil', 's1395-1-sowing'],
      boss: bossOf([true, false, true], 150, true),
      hero: newHero('girl'),
      purse: { rice: 0, cloth: 0, coin: 0 },
      items: [],
      met: [],
      today: undefined,
      date: DATE,
      cap: LEVEL_CAP_41,
    });
    expect(out.paper.xp).toBe(80 + 30 + 20);
    expect(out.purse).toEqual({ rice: 6, cloth: 3, coin: 0 });
    expect(out.story.stats.body).toBe(game.stats.body - 1);
    expect(out.paper.bodyLoss).toBe(1);
    expect(out.paper.rescued).toBe(true);
  });

  function firstThen(): { story: StoryRecord; hero: Hero; game: GameState } {
    const game = cleared(PATHS.help);
    const out = finishEpisode({
      episode,
      replay: false,
      game,
      minors: ['s1395-1-hardsoil', 's1395-1-sowing'],
      boss: bossOf([true, false, false], 200, false),
      hero: newHero('boy'),
      purse: { rice: 0, cloth: 0, coin: 0 },
      items: [],
      met: MET.slice(0, 4),
      today: undefined,
      date: DATE,
      cap: LEVEL_CAP_41,
    });
    return { story: out.story, hero: out.hero, game };
  }

  it('다시 하기: 형편과 처음 깬 판의 선택은 그대로, 별과 최고 기록은 좋은 것이 남고, 경험치는 새 별 + 10분의 1, 돈·유물은 없다', () => {
    const { story, hero } = firstThen();
    // 다시 하기는 이야기의 첫 에피소드라 역할의 시작 수치에서 연다
    const cur = beginEpisode(pack, episode, { role: 'farmer', look: 'boy', seed: 77, story, replay: true });
    expect(cur.replay).toBe(true);
    expect(cur.game.flags).toEqual([]);
    expect(cur.game.stats).toEqual({ living: 4, body: 6, trust: 5 });
    const replayGame = cleared(PATHS.give);
    const better = finishEpisode({
      episode,
      replay: true,
      game: replayGame,
      minors: ['s1395-1-hardsoil', 's1395-1-sowing'],
      boss: bossOf([true, true, true], 350),
      hero,
      purse: { rice: 1, cloth: 1, coin: 0 },
      items: ['relic-seed-sack'],
      story,
      met: [...MET.slice(0, 4), 'met-new'],
      today: undefined,
      date: DATE,
      cap: LEVEL_CAP_41,
    });
    expect(better.paper).toMatchObject({ first: false, newStars: [false, true, true], xp: 20 + 11, best: 350, bestNew: true, relics: [] });
    expect(better.purse).toEqual({ rice: 1, cloth: 1, coin: 0 });
    expect(better.items).toEqual(['relic-seed-sack']);
    expect(better.story.firstRun).toEqual(story.firstRun);
    expect(better.story.stats).toEqual(story.stats);
    expect(better.story.flags).toEqual(story.flags);
    expect(better.story.episodes['s1395-1']).toEqual({ stars: [true, true, true], best: 350, plays: 2, cleared: true });
    expect(better.story.met).toContain('met-new');
    expect(better.today.replays['s1395-1']).toBe(1);
    // 다른 길로 얻은 카드는 새로, 같은 카드는 단계가 오른다(3까지)
    expect(better.paper.cards).toEqual(['skill-provision']);
    expect(better.paper.stepped).toEqual(['skill-sow']);
    expect(better.hero.cards['skill-sow']).toBe(2);
    expect(better.hero.cards['skill-help']).toBe(1);
    // 낮은 점수·적은 별로 다시 해도 최고 기록과 별은 남는다
    const worse = finishEpisode({
      episode,
      replay: true,
      game: replayGame,
      minors: [],
      boss: bossOf([true, false, false], 100, true),
      hero: better.hero,
      purse: better.purse,
      items: better.items,
      story: better.story,
      today: better.today,
      date: DATE,
      cap: LEVEL_CAP_41,
    });
    expect(worse.story.episodes['s1395-1']).toEqual({ stars: [true, true, true], best: 350, plays: 3, cleared: true });
    expect(worse.paper).toMatchObject({ best: 350, bestNew: false, bodyLoss: 0, xp: 8 });
    expect(worse.story.stats).toEqual(story.stats);
    expect(worse.hero.cards['skill-sow']).toBe(3);
    const capped = finishEpisode({
      episode,
      replay: true,
      game: replayGame,
      minors: [],
      boss: bossOf([true, false, false], 100),
      hero: worse.hero,
      purse: worse.purse,
      items: worse.items,
      story: worse.story,
      today: worse.today,
      date: DATE,
      cap: LEVEL_CAP_41,
    });
    expect(capped.hero.cards['skill-sow']).toBe(3);
  });

  it('같은 에피소드 다시 하기는 하루 세 판까지 경험치(넷째 판부터 0), 날이 바뀌면 다시', () => {
    let { story, hero } = firstThen();
    let today: Today | undefined;
    const xps: number[] = [];
    for (let i = 0; i < 10; i++) {
      const out = finishEpisode({
        episode,
        replay: true,
        game: cleared(),
        minors: ['s1395-1-hardsoil', 's1395-1-sowing'],
        boss: bossOf([true, false, false], 100),
        hero,
        purse: { rice: 0, cloth: 0, coin: 0 },
        items: [],
        story,
        today,
        date: DATE,
        cap: 30,
      });
      xps.push(out.paper.xp);
      ({ story, hero, today } = out);
    }
    expect(xps).toEqual([11, 11, 11, 0, 0, 0, 0, 0, 0, 0]);
    const nextDay = finishEpisode({ episode, replay: true, game: cleared(), minors: ['s1395-1-hardsoil', 's1395-1-sowing'], boss: bossOf([true, false, false], 100), hero, purse: { rice: 0, cloth: 0, coin: 0 }, items: [], story, today, date: '2026-11-08', cap: 30 });
    expect(nextDay.paper.xp).toBe(11);
  });

  it('깨지 않은 에피소드는 다시 할 수 없다', () => {
    expect(() => beginEpisode(pack, episode, { role: 'farmer', look: 'boy', seed: 1, replay: true })).toThrow();
    expect(() =>
      finishEpisode({ episode, replay: true, game: cleared(), minors: [], boss: bossOf([true, false, false], 1), hero: newHero('boy'), purse: { rice: 0, cloth: 0, coin: 0 }, items: [], today: undefined, date: DATE, cap: 5 }),
    ).toThrow();
  });
});

describe('현장 → 작은 고비 → 큰 고비 → 결과(흉내 판)', () => {
  it('씨앗마다 끝까지 간다: 오류 0, 별 셋의 길과 구해 줌의 길이 다 있다', () => {
    const ends = new Map<string, number>();
    let threeStars = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const rng = mulberry32(seed * 101);
      const look = seed % 2 ? 'boy' : 'girl';
      const rate = [1, 0.8, 0.6, 0.3, 0][seed % 5];
      let hero: Hero = { ...newHero(look), gear: seed % 3 ? { hand: 'gear-hoe' } : {} };
      let cur = beginEpisode(pack, episode, { role: 'farmer', look, seed, replay: false });
      const minors: ReturnType<typeof autoBattle>[] = [];
      for (let step = 0; step < 30 && !canBoss(pack, episode, cur.game); step++) {
        const moves = movesOf(fieldPack(pack, episode), cur.game);
        const move = pickOne(rng, moves);
        const minor = minorBefore(episode, move.id, cur.minors);
        if (minor) {
          const setup = battleSetupFor(lib, episode, minor, { hero, game: cur.game });
          const ask = battleAsk({ questions: allQuestions, logs: {}, episode: episode41, seed });
          const run = autoBattle(setup, ask, { order: 'random', rightRate: rate, seed });
          expect(run.battle.end).toBeDefined();
          expect(run.mismatches).toEqual([]);
          minors.push(run);
          cur = minorDone(cur, minor.id);
        }
        cur = doField(pack, episode, cur, move);
      }
      // 해가 남았으면 덤을 하나 더 할 수도 있다(아무렇게나)
      expect(canBoss(pack, episode, cur.game)).toBe(true);
      cur = toBoss(pack, episode, cur);
      const setup = battleSetupFor(lib, episode, 'boss', { hero, game: cur.game });
      expect(setup.deck.length).toBeGreaterThanOrEqual(7);
      for (const id of fieldCards) if (fieldSkills(episode, cur.game).includes(id)) expect(setup.deck).toContain(id);
      const ask = battleAsk({ questions: allQuestions, logs: {}, episode: episode41, seed });
      const run = autoBattle(setup, ask, { order: seed % 4 === 0 ? 'first' : 'strong', rightRate: rate, seed });
      expect(run.mismatches).toEqual([]);
      const boss = battleResult(run.battle) as BattleResult;
      expect(boss.turns).toBeLessThanOrEqual(16);
      ends.set(boss.end, (ends.get(boss.end) ?? 0) + 1);
      if (boss.stars.every(Boolean)) threeStars++;
      const out = finishEpisode({
        episode,
        replay: false,
        game: cur.game,
        minors: cur.minors,
        boss,
        hero,
        purse: { rice: 3, cloth: 2, coin: 0 },
        items: [],
        met: MET.slice(0, seed % 12),
        today: undefined,
        date: DATE,
        cap: LEVEL_CAP_41,
      });
      expect(out.paper.xp).toBeGreaterThanOrEqual(80 + 30);
      expect(out.paper.xp).toBeLessThanOrEqual(160);
      expect(out.story.episodes['s1395-1'].cleared).toBe(true);
      expect(cur.minors).toContain('s1395-1-hardsoil');
      expect(cur.minors).toContain('s1395-1-sowing');
      hero = out.hero;
      cur = toResult(cur, out.paper);
      expect(cur.phase).toBe('result');
    }
    expect(ends.get('win')).toBeGreaterThan(0);
    expect(ends.get('rescue')).toBeGreaterThan(0);
    expect(threeStars).toBeGreaterThan(0);
  });
});
