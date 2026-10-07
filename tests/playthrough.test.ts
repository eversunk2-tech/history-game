// 완주 시험: 농민 집으로 무작위 1,000판을 돌려 오류 0, 모든 "한 해 이름"이 한 번 이상 나오는지.
// 고르는 난수도 씨앗을 받으므로 이 시험은 돌릴 때마다 같은 결과가 나온다.

import { describe, expect, it } from 'vitest';
import { packs } from '../src/content';
import { errorsOf, validatePack } from '../src/content/validate';
import { bundle } from '../src/content';
import { advance, choose, newGame, openChoiceIds, playableRoles } from '../src/engine/game';
import { reviewYear, type YearReview } from '../src/engine/review';
import { drawValues } from '../src/engine/rng';
import { SCENES_PER_YEAR, SEASONS, STATS, type GameState, type RoleId, type SituationPack } from '../src/engine/types';
import { playRandom } from './fixtures';

const RUNS = 1000;

interface Tally {
  games: GameState[];
  reviews: YearReview[];
}

function runMany(pack: SituationPack, role: RoleId): Tally {
  const games: GameState[] = [];
  const reviews: YearReview[] = [];
  for (let seed = 1; seed <= RUNS; seed++) {
    const end = playRandom(pack, role, seed);
    games.push(end);
    reviews.push(reviewYear(pack, end));
  }
  return { games, reviews };
}

/** 열린 선택지 가운데 언제나 n번째(없으면 마지막)를 고른다 */
function playNth(pack: SituationPack, role: RoleId, seed: number, n: number): GameState {
  let state = newGame(pack, role, seed);
  while (state.phase !== 'done') {
    if (state.phase === 'scene') {
      const open = openChoiceIds(pack, state);
      state = choose(pack, state, open[Math.min(n, open.length - 1)]);
    } else {
      state = advance(pack, state);
    }
  }
  return state;
}

// 지금 있는 상황과 할 수 있는 집을 모두 돌린다. 상황과 집이 늘면 이 시험도 따라 늘어난다.
const combos = packs.flatMap((pack) => playableRoles(pack).map((role) => ({ pack, role })));

describe('완주', () => {
  it('지금은 ① 1395년 농민 집 하나를 돌린다', () => {
    expect(combos.map((c) => `${c.pack.situation.id}/${c.role}`)).toEqual(['s1395/farmer']);
  });

  describe.each(combos)('$pack.situation.id / $role', ({ pack, role }) => {
    const { games, reviews } = runMany(pack, role);

    it(`무작위 ${RUNS}판이 모두 오류 없이 8장면에 끝난다`, () => {
      expect(games).toHaveLength(RUNS);
      for (const game of games) {
        expect(game.phase).toBe('done');
        expect(game.history).toHaveLength(SCENES_PER_YEAR);
        expect(game.history.map((turn) => turn.season)).toEqual(SEASONS.flatMap((s) => [s, s]));
        expect(game.flow).toHaveLength(SEASONS.length + 1);
      }
    });

    it('수치는 언제나 0~10이고 선택 하나의 변화는 -3~+3이다', () => {
      for (const game of games) {
        for (const turn of game.history) {
          for (const stat of STATS) {
            expect(turn.after[stat]).toBeGreaterThanOrEqual(0);
            expect(turn.after[stat]).toBeLessThanOrEqual(10);
            expect(Math.abs(turn.requested[stat])).toBeLessThanOrEqual(3);
            expect(Math.abs(turn.delta[stat])).toBeLessThanOrEqual(Math.abs(turn.requested[stat]));
          }
        }
      }
    });

    it('모든 "한 해 이름"이 한 번 이상 나온다', () => {
      const seen = new Set(reviews.map((review) => review.yearName.id));
      expect([...seen].sort()).toEqual(pack.situation.endings.map((ending) => ending.id).sort());
    });

    it('올해의 바람은 이루어진 판도, 그렇지 않은 판도 있고 언제나 까닭이 붙는다', () => {
      expect(reviews.some((review) => review.wish.fulfilled)).toBe(true);
      expect(reviews.some((review) => !review.wish.fulfilled)).toBe(true);
      for (const review of reviews) expect(review.wish.reason.length).toBeGreaterThan(0);
      // 바람을 가리는 줄이 모두 한 번 이상 쓰인다
      const reasons = new Set(reviews.map((review) => review.wish.reason));
      expect(reasons.size).toBe(pack.situation.roles[role].wishOutcomes.length);
    });

    it('뽑기의 모든 값이 나오고, 뽑는 계절이 지난 판에는 언제나 뽑기 결과가 있다', () => {
      const values = drawValues(pack.situation.draw.kind);
      if (values.length === 0) return;
      expect([...new Set(reviews.map((review) => review.draw))].sort()).toEqual([...values].sort());
    });

    it('모든 선택지가 한 번 이상 골라진다(늘 잠겨 있는 선택지가 없다)', () => {
      const picked = new Set(games.flatMap((game) => game.history.map((turn) => `${turn.sceneId}/${turn.choiceId}`)));
      const all = pack.scenes
        .filter((scene) => scene.kind === 'world' || scene.role === role)
        .flatMap((scene) => scene.choices.map((choice) => `${scene.id}/${choice.id}`));
      expect(all.filter((id) => !picked.has(id))).toEqual([]);
    });

    it('갈린 결과가 모두 한 번 이상 나온다', () => {
      const shown = new Set(games.flatMap((game) => game.history.map((turn) => turn.result)));
      const all = pack.scenes
        .filter((scene) => scene.kind === 'world' || scene.role === role)
        .flatMap((scene) => scene.choices.flatMap((choice) => [choice.result, ...(choice.variants ?? []).map((v) => v.result)]));
      expect(all.filter((result) => !shown.has(result))).toEqual([]);
    });

    it('수치가 0이 된 판도 끝까지 간다', () => {
      const hitZero = games.filter((game) => game.history.some((turn) => STATS.some((stat) => turn.after[stat] === 0)));
      expect(hitZero.length).toBeGreaterThan(0);
      for (const game of hitZero) expect(game.history).toHaveLength(SCENES_PER_YEAR);
    });

    it('늘 첫 번째·마지막 선택지만 골라도 끝까지 간다', () => {
      for (let seed = 1; seed <= 50; seed++) {
        expect(playNth(pack, role, seed, 0).history).toHaveLength(SCENES_PER_YEAR);
        expect(playNth(pack, role, seed, 99).history).toHaveLength(SCENES_PER_YEAR);
      }
    });

    it('같은 씨앗으로 다시 돌리면 같은 판이 나온다', () => {
      for (const seed of [1, 250, 500, 999]) {
        expect(playRandom(pack, role, seed)).toEqual(games[seed - 1]);
      }
    });

    it('이 상황의 자료는 검사기를 통과한다', () => {
      expect(errorsOf(validatePack(pack, bundle))).toEqual([]);
    });
  });
});
