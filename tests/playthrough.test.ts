// 완주 시험: 지금 할 수 있는 역할을 모습마다, 만들어진 계절을 아무렇게나 1,000번씩 해 본다(씨앗 고정).
// 오류 0, 꼭 푸는 미션이 모두 풀림, 계절을 닫을 수 있음, 수치가 언제나 0~10.
// 인심이 깎이는 길과 잠김을 만나는 길이 있는지 세어 찍는다(없어도 시험은 실패하지 않는다 — 찍어서 알린다).
// 다만 ① 농민 집 아이의 봄은 인심이 깎이는 길이 있어야 하고(5.2의 9번), 덤의 작은 선택도 두 쪽이 다 나와야 한다.
// 고르는 난수도 씨앗을 받으므로 이 시험은 돌릴 때마다 같은 결과가 나온다.
// 역할과 계절이 늘면 이 시험도 따라 늘어난다(만들어진 계절까지만 간다).

import { describe, expect, it } from 'vitest';
import { bundle, packs } from '../src/content';
import { errorsOf, formatIssue, validatePack } from '../src/content/validate';
import {
  choiceViews,
  closeSeason,
  currentSeason,
  missingMusts,
  missionsOf,
  newGame,
  nextSeason,
  openHappenings,
  playableRoles,
  roleOf,
  seasonReady,
} from '../src/engine/game';
import { mulberry32 } from '../src/engine/rng';
import { SEASONS, STATS, type GameState, type Look, type RoleId, type Season, type SituationPack } from '../src/engine/types';
import { playSeasonRandom } from './fixtures';

const RUNS = 1000;

interface Run {
  /** 만들어진 마지막 계절을 닫은 뒤의 판 */
  end: GameState;
  /** 닫은 계절들 */
  seasons: Season[];
  /** 도중에 잠긴 선택지를 본 적이 있는가(그 일과 선택지) */
  locksSeen: Set<string>;
  /** 해 ☀가 모자라 할 수 없는 덤을 본 적이 있는가 */
  sunShort: boolean;
}

/** 만들어진 계절을 차례로 아무렇게나 하고 닫는다. 다음 계절이 아직 없으면 거기서 멈춘다. */
function playBuilt(pack: SituationPack, role: RoleId, look: Look, seed: number): Run {
  const rng = mulberry32(seed * 7919 + 13);
  const locksSeen = new Set<string>();
  const seasons: Season[] = [];
  let sunShort = false;
  const watch = (state: GameState) => {
    for (const view of openHappenings(pack, state)) {
      if (view.noSun) sunShort = true;
      for (const choice of choiceViews(pack, state, view.happening.id)) {
        if (choice.locked) locksSeen.add(`${view.happening.id}/${choice.id}`);
      }
    }
  };
  let state = newGame(pack, role, look, seed);
  for (let turn = 0; turn < SEASONS.length; turn++) {
    state = playSeasonRandom(pack, state, rng, watch);
    seasons.push(currentSeason(state));
    state = closeSeason(pack, state);
    const upcoming = SEASONS[state.seasonIndex + 1];
    if (!upcoming || !seasonReady(pack, role, upcoming)) break;
    state = nextSeason(pack, state);
  }
  return { end: state, seasons, locksSeen, sunShort };
}

// 지금 있는 이야기와 할 수 있는 역할, 그 역할이 될 수 있는 모습을 모두 돌린다.
const combos = packs.flatMap((pack) =>
  playableRoles(pack).flatMap((role) => roleOf(pack, role).looks.map((look) => ({ pack, role, look, name: `${pack.situation.id}/${role}/${look}` }))),
);

describe('완주', () => {
  it('할 수 있는 역할과 모습이 하나 이상 있다(① 농민 집 아이는 두 모습)', () => {
    const names = combos.map((c) => c.name);
    expect(names).toEqual(expect.arrayContaining(['s1395/farmer/boy', 's1395/farmer/girl']));
  });

  describe.each(combos)('$name', ({ pack, role, look }) => {
    const runs: Run[] = [];
    const errors: string[] = [];
    for (let seed = 1; seed <= RUNS; seed++) {
      try {
        runs.push(playBuilt(pack, role, look, seed));
      } catch (error) {
        errors.push(`씨앗 ${seed}: ${(error as Error).message}`);
      }
    }
    const games = runs.map((run) => run.end);
    const mine = pack.happenings.filter((h) => (!h.roles || h.roles.includes(role)) && runs[0]?.seasons.includes(h.season));

    it(`아무렇게나 ${RUNS}번을 해도 오류가 없다`, () => {
      expect(errors).toEqual([]);
      expect(runs).toHaveLength(RUNS);
    });

    it('꼭 푸는 미션이 모두 풀리고, 계절을 닫을 수 있다', () => {
      for (const run of runs) {
        expect(run.end.phase).toBe('seasonClose');
        expect(run.end.closings.map((c) => c.season)).toEqual(run.seasons);
        expect(run.seasons[0]).toBe('spring');
        for (const season of run.seasons) {
          const musts = missionsOf(pack, role, season).filter((m) => m.must && m.season === season);
          expect(musts.length).toBeGreaterThan(0);
          for (const m of musts) expect(run.end.solved).toContain(m.id);
        }
        expect(missingMusts(pack, run.end)).toEqual([]);
        expect(run.end.flow).toHaveLength(run.seasons.length + 1);
      }
    });

    it('수치는 언제나 0~10이고, 변화는 미션의 일 ±3·덤으로 하는 일 ±1 안이다', () => {
      for (const game of games) {
        for (const deed of game.history) {
          for (const stat of STATS) {
            expect(deed.after[stat]).toBeGreaterThanOrEqual(0);
            expect(deed.after[stat]).toBeLessThanOrEqual(10);
            expect(Math.abs(deed.requested[stat])).toBeLessThanOrEqual(deed.sun === 1 ? 1 : 3);
            expect(Math.abs(deed.delta[stat])).toBeLessThanOrEqual(Math.abs(deed.requested[stat]));
          }
        }
        for (const stats of game.flow) for (const stat of STATS) expect(stats[stat] >= 0 && stats[stat] <= 10).toBe(true);
      }
    });

    it('덤으로 하는 일은 계절마다 해 ☀만큼만 한다', () => {
      const suns = roleOf(pack, role).suns;
      for (const run of runs) {
        for (const season of run.seasons) {
          const spent = run.end.history.filter((d) => d.season === season && d.sun === 1).length;
          expect(spent).toBeLessThanOrEqual(suns);
        }
      }
      // 덤을 하나도 하지 않은 판도, 해를 다 쓴 판도 있다
      const counts = new Set(games.map((game) => game.history.filter((d) => d.sun === 1 && d.season === 'spring').length));
      expect(counts.has(0)).toBe(true);
      expect(counts.has(Math.min(suns, mine.filter((h) => h.season === 'spring' && h.cost === 1).length))).toBe(true);
    });

    it('같은 일을 두 번 하지 않고, 한 일의 기록이 차례대로 남는다', () => {
      for (const game of games) {
        expect(new Set(game.done).size).toBe(game.done.length);
        expect(game.history.map((d) => d.happeningId)).toEqual(game.done);
        const solved = game.history.flatMap((d) => d.solved);
        expect(solved).toEqual(game.solved);
        expect(new Set(solved).size).toBe(solved.length);
      }
    });

    it('모든 일과 모든 선택지가 한 번 이상 나온다(늘 숨어 있거나 늘 잠겨 있는 것이 없다)', () => {
      const did = new Set(games.flatMap((game) => game.history.map((d) => d.happeningId)));
      const picked = new Set(games.flatMap((game) => game.history.filter((d) => d.choiceId).map((d) => `${d.happeningId}/${d.choiceId}`)));
      const rescues = new Set(pack.missions.map((m) => m.rescue).filter(Boolean));
      const never = mine.filter((h) => !rescues.has(h.id) && !did.has(h.id)).map((h) => h.id);
      expect(never).toEqual([]);
      const unpicked = mine.flatMap((h) =>
        (h.choices ?? []).filter((c) => !c.only || c.only.includes(role)).map((c) => `${h.id}/${c.id}`).filter((id) => !picked.has(id)),
      );
      expect(unpicked).toEqual([]);
      // 일 놀이는 끝난 모습이 모두 나온다
      for (const h of mine.filter((one) => one.play)) {
        const ends = new Set(games.flatMap((game) => game.history.filter((d) => d.happeningId === h.id).map((d) => d.play)));
        expect([...ends].sort()).toEqual(Object.keys(h.play!.flags).sort());
      }
    });

    it('인심이 깎이는 길과 잠김을 만나는 길이 있는지 센다(없으면 찍어서 알린다)', () => {
      const trustLoss = games.filter((game) => game.history.some((d) => d.delta.trust < 0)).length;
      const lockRuns = runs.filter((run) => run.locksSeen.size > 0).length;
      const locks = new Set(runs.flatMap((run) => [...run.locksSeen]));
      const sunOut = games.filter((game) => game.sunsLeft === 0).length;
      const sunShort = runs.filter((run) => run.sunShort).length;
      const lows = games.filter((game) => game.history.some((d) => STATS.some((stat) => d.after[stat] <= 1))).length;
      // 덤으로 하는 일에서 고른 선택지(일/선택지 → 판 수)
      const extraPicks = new Map<string, number>();
      for (const game of games) {
        for (const d of game.history) {
          if (d.sun === 1 && d.choiceId) extraPicks.set(`${d.happeningId}/${d.choiceId}`, (extraPicks.get(`${d.happeningId}/${d.choiceId}`) ?? 0) + 1);
        }
      }
      console.log(
        [
          `[완주] ${pack.situation.id}/${role}/${look} — ${RUNS}판, 닫은 계절: ${runs[0]?.seasons.join(', ')}`,
          `  인심이 깎인 판: ${trustLoss}${trustLoss === 0 ? '  ← 없다! 인심이 쌓이기만 한다(5.2의 9번)' : ''}`,
          `  잠긴 선택지를 만난 판: ${lockRuns}${lockRuns === 0 ? '  ← 없다! 아무렇게나 해서는 잠김을 만나지 못한다' : ` (${[...locks].join(', ')})`}`,
          `  해 ☀를 다 쓴 판: ${sunOut}, 해가 모자라 못 하는 덤을 만난 판: ${sunShort}, 수치가 1 이하로 내려간 판: ${lows}`,
          `  한 판에 한 일: ${Math.min(...games.map((g) => g.history.length))}~${Math.max(...games.map((g) => g.history.length))}개`,
          `  덤에서 고른 것: ${[...extraPicks].sort().map(([id, count]) => `${id} ${count}판`).join(', ') || '없음'}`,
        ].join('\n'),
      );
      expect(trustLoss).toBeGreaterThanOrEqual(0);
      expect(lockRuns).toBeGreaterThanOrEqual(0);
      if (pack.situation.id === 's1395' && role === 'farmer') {
        // ①의 봄: "우리 집 봄 일부터 한다"로 인심이 깎이는 판이 있다
        expect(trustLoss).toBeGreaterThan(0);
        // 덤의 작은 선택(우물가·뒷산)은 두 쪽이 다 나오고, 어느 쪽을 골라도 덤의 변화는 -1~+1이다
        const picked = [...extraPicks.keys()];
        for (const id of ['s1395-spring-well/carry', 's1395-spring-well/listen', 's1395-spring-woods/plenty', 's1395-spring-woods/light']) {
          expect(picked, id).toContain(id);
        }
      }
    });

    it('같은 씨앗으로 다시 하면 같은 판이 나온다', () => {
      for (const seed of [1, 250, 500, 999]) {
        expect(playBuilt(pack, role, look, seed).end).toEqual(games[seed - 1]);
      }
    });

    it('씨앗이 다르면 다른 판이 나온다', () => {
      const shapes = new Set(games.map((game) => game.history.map((d) => `${d.happeningId}/${d.choiceId ?? ''}/${d.play ?? ''}`).join(' ')));
      expect(shapes.size).toBeGreaterThan(50);
    });
  });

  it('돌린 이야기의 자료는 검사기를 통과한다', () => {
    for (const pack of packs) expect(errorsOf(validatePack(pack, bundle)).map(formatIssue)).toEqual([]);
  });
});
