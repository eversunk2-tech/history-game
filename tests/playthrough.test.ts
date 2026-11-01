// 완주 시험: 지금 할 수 있는 역할을 모습마다, 만들어진 계절을 아무렇게나 1,000번씩 해 본다(씨앗 고정).
// 오류 0, 꼭 푸는 미션이 모두 풀림, 계절을 닫을 수 있음, 수치가 언제나 0~10.
// 바퀴 1-라부터 ① 농민 집 아이는 한 해를 끝까지 간다(두 모습 × 날씨 셋). 이제는 세어 찍기만 하지 않고 단언한다:
//   인심이 깎이는 판과 잠긴 선택지를 만나는 판이 있다, 도움의 길(이웃이 김매기를 거든다·소금을 나눠 준다)에 닿는 판이 있다,
//   받을 수 있는 한 해 이름 여덟이 모두 나온다, 올해의 바람이 이루어진 판과 이루어지지 않은 판이 다 있다.
// 그리고 한 해 전체를 엔진으로 걸어(계절마다 닿는 형편을 모아 넘긴다) 막다른 길이 없는지 본다(이 파일은 두 가지 — 나머지는 missions.test.ts).
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
import { reviewYear, type YearReview } from '../src/engine/review';
import { drawValues, mulberry32 } from '../src/engine/rng';
import { SEASONS, STATS, type GameState, type Look, type RoleId, type Season, type SituationPack } from '../src/engine/types';
import { exploreYear, playSeasonRandom } from './fixtures';

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
  /** 네 계절을 다 닫았으면: 한 해 돌아보기 */
  review?: YearReview;
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
  // 겨울까지 닫았으면 한 해가 끝난다: 돌아보기를 만들어 둔다(end는 겨울을 닫은 판 그대로 둔다)
  const review = seasons.length === SEASONS.length ? reviewYear(pack, nextSeason(pack, state)) : undefined;
  return { end: state, seasons, locksSeen, sunShort, review };
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
    // 이 역할·이 모습에게 벌어질 수 있는 일(한쪽 모습에만 나타나는 일은 그 모습에서만 기대한다 — 「겨울 글공부」)
    const mine = pack.happenings.filter(
      (h) => (!h.roles || h.roles.includes(role)) && runs[0]?.seasons.includes(h.season) && (!h.shows?.look || h.shows.look === look),
    );

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
      // 도움의 일까지 한 번 이상 나온다(바퀴 1-라부터: 봄에는 도움의 일이 없었다)
      const never = mine.filter((h) => !did.has(h.id)).map((h) => h.id);
      expect(never).toEqual([]);
      // 다른 모습의 일은 한 번도 나오지 않는다
      const others = pack.happenings.filter((h) => h.shows?.look && h.shows.look !== look).map((h) => h.id);
      for (const id of others) expect(did.has(id), id).toBe(false);
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

    it('인심이 깎이는 길과 잠김을 만나는 길이 있다(세어 찍고, 단언한다)', () => {
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
        // 계절마다 인심이 깎이는 일이 있다(겨울은 예법의 무게가 0이라 깎이는 길이 없다 — spec 6.3)
        const cutIn = (season: Season) => games.filter((game) => game.history.some((d) => d.season === season && d.delta.trust < 0)).length;
        expect(cutIn('spring')).toBeGreaterThan(0);
        expect(cutIn('summer')).toBeGreaterThan(0);
        expect(cutIn('autumn')).toBeGreaterThan(0);
        // 잠긴 선택지를 만나는 판이 있다(봄에는 닿을 수 없었다). 열 판에 한 판은 넘는다.
        expect(lockRuns).toBeGreaterThan(RUNS / 10);
        const learn = look === 'boy' ? 's1395-winter-letters/attend' : 's1395-winter-letters-girl/learn';
        for (const id of [
          's1395-summer-dano/treat',
          's1395-summer-weed/all',
          's1395-summer-weed/swap',
          's1395-summer-weed/rest',
          's1395-autumn-leave/tend',
          's1395-autumn-salt/ours',
          's1395-autumn-salt/share',
          's1395-winter-rite/temple',
          learn,
          's1395-winter-share/grain',
        ]) {
          expect([...locks], id).toContain(id);
        }
        // 봄의 잠김(스님들께 곡식을 보태는 길 — 살림 2 이하)은 봄에 닿을 수 없다: 살림이 4에서 시작해 그 앞에 줄 일이 없다
        expect([...locks]).not.toContain('s1395-spring-return/give');
        // 도움의 길에 닿는 판이 있다: 기력이 바닥이라 이웃이 김매기를 거들어 준 판, 살림이 바닥이라 이웃이 소금을 나눠 준 판
        const helped = (id: string) => games.filter((game) => game.done.includes(id)).length;
        console.log(`  도움의 길: 이웃이 김매기를 거든 판 ${helped('s1395-summer-weed-help')}, 이웃이 소금을 나눠 준 판 ${helped('s1395-autumn-salt-help')}`);
        expect(helped('s1395-summer-weed-help')).toBeGreaterThan(0);
        expect(helped('s1395-autumn-salt-help')).toBeGreaterThan(0);
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

    // ── 한 해를 끝까지(바퀴 1-라) ──
    const whole = runs.filter((run) => run.review);
    if (whole.length > 0) {
      const count = <T>(list: T[], key: (one: T) => string): Map<string, number> => {
        const out = new Map<string, number>();
        for (const one of list) out.set(key(one), (out.get(key(one)) ?? 0) + 1);
        return out;
      };
      const table = (map: Map<string, number>) => [...map].sort((a, b) => b[1] - a[1]).map(([name, n]) => `${name} ${n}`).join(', ');

      it('모든 판이 네 계절을 닫고 한 해를 마친다: 날씨 셋이 다 나오고, 어느 날씨에서도 미션이 모두 풀린다', () => {
        expect(whole).toHaveLength(RUNS);
        const weather = count(whole, (run) => String(run.end.draw));
        console.log(`[한 해] ${pack.situation.id}/${role}/${look} — 날씨: ${table(weather)}`);
        expect([...weather.keys()].sort()).toEqual([...drawValues(pack.situation.draw.kind)].sort());
        const musts = missionsOf(pack, role).filter((m) => m.must);
        for (const run of whole) {
          expect(run.seasons).toEqual([...SEASONS]);
          expect(run.end.flow).toHaveLength(SEASONS.length + 1);
          for (const m of musts) expect(run.end.solved, `${m.id} — 날씨 ${run.end.draw}`).toContain(m.id);
          expect(run.review?.seasons.map((one) => one.closing?.season)).toEqual([...SEASONS]);
          expect(run.review?.draw).toBe(run.end.draw);
        }
        // 날씨는 여름에 들어설 때 뽑혀 그 뒤로 바뀌지 않는다(봄을 닫은 기록에는 날씨에 따른 줄이 없다)
        for (const run of whole) expect(run.end.closings[0].lines).toEqual([]);
      });

      it('받을 수 있는 한 해 이름이 모두 나온다', () => {
        const names = count(whole, (run) => run.review?.yearName.id ?? '');
        console.log(`[한 해] ${pack.situation.id}/${role}/${look} — 한 해 이름: ${table(names)}`);
        expect([...names.keys()].sort()).toEqual(pack.situation.endings.map((ending) => ending.id).sort());
        // 한 이름이 판의 반을 넘지 않는다(어느 이름으로 쏠리지 않는다)
        for (const [name, n] of names) expect(n, name).toBeLessThan(RUNS / 2);
      });

      it('올해의 바람: 이루어진 판과 이루어지지 않은 판이 다 있고, 가리는 줄이 모두 한 번은 쓰인다', () => {
        const reasons = count(whole, (run) => `${run.review?.wish.fulfilled ? '이룸' : '못 이룸'} — ${run.review?.wish.reason}`);
        console.log(`[한 해] ${pack.situation.id}/${role}/${look} — 올해의 바람:\n  ${[...reasons].sort((a, b) => b[1] - a[1]).map(([name, n]) => `${n}판 ${name}`).join('\n  ')}`);
        const rows = roleOf(pack, role).wishOutcomes;
        expect(reasons.size).toBe(rows.length);
        expect(whole.some((run) => run.review?.wish.fulfilled)).toBe(true);
        expect(whole.some((run) => run.review && !run.review.wish.fulfilled)).toBe(true);
        for (const run of whole) expect(run.review?.wish.reason).not.toMatch(/실패|못했|잘못/);
      });

      it('덤 미션 둘은 풀리는 판도, 풀리지 않는 판도 있다(깨는 데는 필요 없다)', () => {
        const extra = missionsOf(pack, role).filter((m) => !m.must);
        expect(extra.length).toBeGreaterThan(0);
        for (const m of extra) {
          const solved = whole.filter((run) => run.end.solved.includes(m.id)).length;
          console.log(`[한 해] ${pack.situation.id}/${role}/${look} — 덤 미션 「${m.title}」을 푼 판: ${solved}`);
          expect(solved, m.id).toBeGreaterThan(0);
          expect(solved, m.id).toBeLessThan(RUNS);
        }
      });
    }
  });

  // 한 해 전체를 엔진으로 걷는다: 실제 시작 수치에서 닿는 모든 형편을 계절마다 걸어, 닿는 형편을 모아 다음 계절로 넘긴다.
  // 한 가지(모습 × 날씨)에 형편 42만~58만 가지(계절마다의 한도는 fixtures의 YEAR_WALK_LIMITS), 한가한 컴퓨터에서 9~13초쯤 걸린다. 넷을 걷는다 — 이 파일에서 둘, missions.test.ts에서 둘
  // (두 모습 × 큰비가 온 해, 그리고 큰비가 아닌 두 날씨를 모습마다 하나씩. 평소 같은 해와 비가 알맞게 온 해는 여는 대화의 글만 다르다).
  const s1395 = packs.find((pack) => pack.situation.id === 's1395');
  describe.each([
    ['girl', 'drought'],
    ['boy', 'bumper'],
  ] as [Look, string][])('① 농민 집 아이(%s)의 한 해를 모두 걷는다 — %s', (look, weather) => {
    it('어느 걸음에서도 막다른 길이 없다', () => {
      if (!s1395) throw new Error('① 1395년이 없다');
      const walked = exploreYear(s1395, 'farmer', look, weather);
      console.log(
        `[한 해 걷기] ${look}/${weather}: 계절마다 처음 형편 ${walked.starts.join(' → ')}가지, 살핀 형편 ${walked.states.join(' → ')}가지, 한 해의 끝 ${walked.ends}가지, 한 해 이름 ${[...walked.names.keys()].sort().join(', ')}`,
      );
      expect(walked.stuck).toEqual([]);
      expect(walked.starts).toHaveLength(SEASONS.length);
      expect(walked.starts[0]).toBe(1);
      for (const n of walked.starts) expect(n).toBeGreaterThan(0);
      expect(walked.ends).toBeGreaterThan(1000);
      // 큰비가 온 해에만 나타나는 것과 나타나지 않는 것
      const rain = weather === 'drought';
      expect(walked.did.has('s1395-summer-bank')).toBe(rain);
      expect(walked.did.has('s1395-autumn-salt-help')).toBe(rain); // 살림이 바닥나는 것은 큰비가 온 해뿐이다
      expect(walked.names.has('s1395-flood')).toBe(rain);
      expect(walked.names.has('full')).toBe(!rain); // 큰비가 온 해에 살림이 넉넉하면 "큰비를 이겨 낸 한 해"가 된다
      // 모습에 따라 갈리는 일
      expect(walked.did.has('s1395-winter-letters')).toBe(look === 'boy');
      expect(walked.did.has('s1395-winter-letters-girl')).toBe(look === 'girl');
      expect(walked.did.has('s1395-summer-weed-help')).toBe(true);
    }, 600000);
  });

  // 검사기가 네 계절을 이어 걷는다(걸음 5,800번쯤, 한가한 컴퓨터에서 3~4초). 다른 일이 함께 돌면 더 걸려 이 시험에만 한도를 늘렸다.
  it('돌린 이야기의 자료는 검사기를 통과한다', () => {
    for (const pack of packs) expect(errorsOf(validatePack(pack, bundle)).map(formatIssue)).toEqual([]);
  }, 120000);
});
