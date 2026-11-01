// 미션 시험: 실제 콘텐츠 ① 1395년의 봄(농민 집 아이)을 엔진으로 모든 길을 걸어 본다.
//   - 꼭 푸는 미션 둘이 어떤 길로도 풀린다(막다른 길이 없다). 수치를 바닥(0·0·0)까지 떨어뜨려도 풀린다.
//   - 답을 맞혀야 풀리는 미션이 없다: 푸는 길이 둘 이상이고 길에 따라 결과가 다르다.
//   - 두 모습(남자아이·여자아이) 모두에서 그렇다.
//   - 풀렸을 때 Deed.solved에 적힌다. 덤은 해 ☀만큼만 할 수 있다. 볍씨 선택과 일 놀이의 표시가 남는다.
//   - spec 6.3의 숫자(곡식을 보태는 길의 잠김, 나중에 나타나는 결과와 그것이 붙는 계절, 궂은 해의 이름)와
//     바퀴 1-다 고치기에서 정한 것(덤의 한마디와 작은 선택, 글의 앞뒤와 쉬운 말)을 실제 묶음에 묶어 둔다(review 20번).
// 검사기(validate.ts)의 걸어 보기와 따로, 시험의 도구(fixtures.ts의 explore)로 걷는다.
//
// 바퀴 1-라: 여름·가을·겨울을 더했다(파일의 뒤쪽). spec 6.3의 숫자(잠김의 문턱, 놀이의 ±1, 나중 결과), 봄의 선택이 뒤에서 돌아오는 것,
// 모습에 따라 갈리는 셋(단오·"내년이면 나도 열여섯"·겨울 글공부), 도움의 길(이웃이 김매기를 거든다, 소금을 나눠 준다), 글의 한도와 말.
// 그리고 한 해 전체를 엔진으로 걸어 막다른 길이 없는지 본다(fixtures.ts의 exploreYear — 이 파일은 두 가지, 나머지 둘은 playthrough.test.ts).

import { describe, expect, it } from 'vitest';
import { bundle, getMap, getPack } from '../src/content';
import { BUDGET, countChars, numbersIn } from '../src/content/validate';
import {
  canCloseSeason,
  choiceViews,
  closeSeason,
  doHappening,
  happeningOf,
  lastClosing,
  lastDeed,
  missingMusts,
  missionProgress,
  missionViews,
  missionsOf,
  newGame,
  nextSeason,
  openHappenings,
  openingLines,
  roleOf,
  seasonLine,
  type DoInput,
} from '../src/engine/game';
import { reviewYear } from '../src/engine/review';
import { drawValues, rollDraw } from '../src/engine/rng';
import {
  SEASONS,
  STATS,
  type Closing,
  type Deed,
  type GameState,
  type Happening,
  type Look,
  type Mission,
  type Outcome,
  type Season,
  type Stats,
} from '../src/engine/types';
import { PLAY_KINDS } from '../src/plays/kinds';
import { advance, doAll, explore, exploreYear, movesOf, playEndProblems, playMusts, seedFor, stateKey, withStats } from './fixtures';

const pack = getPack('s1395')!;
const ROLE = 'farmer';
const LOOKS: Look[] = ['boy', 'girl'];
const FLOOR: Stats = { living: 0, body: 0, trust: 0 };

const musts = missionsOf(pack, ROLE, 'spring').filter((m) => m.must);
const springOf = (cost: 0 | 1): Happening[] =>
  pack.happenings.filter((h) => h.season === 'spring' && h.cost === cost && (!h.roles || h.roles.includes(ROLE)));
const extras = springOf(1);
/** 일 놀이가 있는 미션(볍씨 뿌리기)과 그 일 */
const sowMission = musts.find((m) => m.parts.some((id) => happeningOf(pack, id).play)) as Mission;
const sowHappening = pack.happenings.find((h) => sowMission?.parts.includes(h.id) && h.play) as Happening;
/** 듣고 고른 뒤 그 자리에 가서 마치는 미션(돌아온 사람들, 떠나는 스님들) */
const returnMission = musts.find((m) => m !== sowMission) as Mission;

const start = (look: Look) => newGame(pack, ROLE, look, 1);
const label = (move: DoInput) => [move.id, move.choiceId, move.play].filter(Boolean).join('/');

/** 이 미션에 딸린 일만 해서 닿을 수 있는 모든 형편과 거기까지의 걸음 */
function pathsOf(mission: Mission, from: GameState): { state: GameState; steps: string[] }[] {
  const out: { state: GameState; steps: string[] }[] = [];
  const seen = new Set<string>();
  const visit = (state: GameState, steps: string[]) => {
    // 한 일이 적히지 않는 잘못이 들어오면 같은 일을 끝없이 되풀이한다. 멈추지 않고 실패하게 끝을 둔다.
    if (steps.length > 12 || out.length > 5000) throw new Error(`「${mission.title}」의 길이 끝나지 않는다: ${steps.slice(0, 6).join(' > ')} …`);
    const key = `${stateKey(state)}#${steps.join('>')}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ state, steps });
    if (state.solved.includes(mission.id)) return;
    for (const move of movesOf(pack, state)) {
      if (!mission.parts.includes(move.id) && mission.rescue !== move.id) continue;
      visit(doHappening(pack, state, move), [...steps, label(move)]);
    }
  };
  visit(from, []);
  return out;
}

/** 이 미션을 푼 길들: 걸음과, 그 길에서 한 일들의 기록 */
function solutionsOf(mission: Mission, from: GameState): { steps: string[]; deeds: Deed[]; state: GameState }[] {
  return pathsOf(mission, from)
    .filter((p) => p.state.solved.includes(mission.id))
    .map((p) => ({ steps: p.steps, state: p.state, deeds: p.state.history.filter((d) => d.missionId === mission.id) }));
}

describe('① 봄 · 농민 집 아이: 미션의 짜임', () => {
  it('꼭 푸는 미션 둘과 덤으로 하는 일 넷이 있고, 해 ☀는 셋이다', () => {
    expect(musts.map((m) => m.title)).toEqual(['돌아온 사람들, 떠나는 스님들', '볍씨 뿌리기']);
    expect(extras).toHaveLength(4);
    expect(roleOf(pack, ROLE).suns).toBe(3);
    expect(start('boy').sunsLeft).toBe(3);
    expect(sowMission.title).toBe('볍씨 뿌리기');
    expect(sowHappening.play?.game).toBe('sow');
  });

  it('미션마다 지도서 차시와 학습 내용, "해낸 일" 한 줄이 있다', () => {
    for (const m of missionsOf(pack, ROLE, 'spring')) {
      expect(m.lesson).toMatch(/차시/);
      expect(m.doneLine.length).toBeGreaterThan(0);
      expect(m.doneLine).not.toMatch(/맞았|정답|틀렸/);
    }
  });

  it('미션의 일은 해 ☀를 쓰지 않고, 덤으로 하는 일은 하나씩 쓴다', () => {
    for (const m of musts) for (const id of [...m.parts, ...(m.rescue ? [m.rescue] : [])]) expect(happeningOf(pack, id).cost).toBe(0);
    for (const h of extras) expect(h.cost).toBe(1);
  });

  it('처음 맵에는 미션의 첫 일 둘과 덤 넷이 나타난다', () => {
    const views = openHappenings(pack, start('boy'));
    expect(views.filter((v) => v.must)).toHaveLength(2);
    expect(views.filter((v) => !v.must).map((v) => v.happening.id).sort()).toEqual(extras.map((h) => h.id).sort());
    expect(views.every((v) => !v.noSun)).toBe(true);
    expect(missionViews(pack, start('boy')).slice(0, 2).map((v) => [v.mission.id, v.solved])).toEqual(musts.map((m) => [m.id, false]));
  });
});

describe.each(LOOKS)('① 봄 · 농민 집 아이(%s): 어떤 길로도 풀린다', (look) => {
  const walked = explore(pack, start(look));

  it('모든 길을 걸어도 막다른 길이 없다', () => {
    console.log(`[모든 길] ${look}: 형편 ${walked.all.length}가지, 길의 끝 ${walked.leaves.length}가지`);
    expect(walked.all.length).toBeGreaterThan(100);
    expect(walked.stuck).toEqual([]);
    // 길의 끝(더 할 수 있는 일이 없는 곳)에서는 언제나 계절을 보낼 수 있다
    for (const leaf of walked.leaves) {
      expect(canCloseSeason(pack, leaf)).toBe(true);
      expect(missingMusts(pack, leaf)).toEqual([]);
    }
  });

  it('어느 걸음에서도 수치는 0~10이고, 변화는 미션의 일 ±3·덤 ±1 안이다', () => {
    for (const state of walked.all) {
      for (const stat of STATS) {
        expect(state.stats[stat]).toBeGreaterThanOrEqual(0);
        expect(state.stats[stat]).toBeLessThanOrEqual(10);
      }
      const deed = lastDeed(state);
      if (deed) for (const stat of STATS) expect(Math.abs(deed.requested[stat])).toBeLessThanOrEqual(deed.sun === 1 ? 1 : 3);
    }
  });

  it('수치를 바닥(0·0·0)에 놓고 시작해도 풀린다', () => {
    const floor = explore(pack, withStats(start(look), FLOOR));
    expect(floor.stuck).toEqual([]);
    expect(floor.leaves.length).toBeGreaterThan(0);
    for (const leaf of floor.leaves) expect(canCloseSeason(pack, leaf)).toBe(true);
  });

  it('수치의 모서리와 가운데(0·5·10의 스물일곱 짝) 어디에서 시작해도 풀린다', () => {
    for (const living of [0, 5, 10]) {
      for (const body of [0, 5, 10]) {
        for (const trust of [0, 5, 10]) {
          const from = withStats(start(look), { living, body, trust });
          // 덤은 빼고 미션의 일만 걷는다(덤까지 넣은 길은 위에서 시작 수치와 바닥으로 걸었다)
          for (const m of musts) {
            const solved = solutionsOf(m, from);
            expect(solved.length, `${m.title} — 살림 ${living}·기력 ${body}·인심 ${trust}`).toBeGreaterThan(0);
          }
        }
      }
    }
  });

  it('미션을 풀다가 어느 걸음에서 수치가 바닥나도 끝내 풀린다', () => {
    // 미션의 일만 해서 닿는 모든 형편에서 수치를 0·0·0으로 떨어뜨리고, 거기서부터 다시 모든 길을 걷는다
    const mids = new Map<string, GameState>();
    for (const m of musts) for (const p of pathsOf(m, start(look))) mids.set(stateKey(p.state), p.state);
    expect(mids.size).toBeGreaterThan(5);
    for (const mid of mids.values()) {
      const floored = withStats(mid, FLOOR);
      const rest = explore(pack, floored);
      expect(rest.stuck.map((s) => s.done.join(' → '))).toEqual([]);
    }
  });

  it('답을 맞혀야 풀리는 미션이 없다: 푸는 길이 둘 이상이고, 길에 따라 결과가 다르다', () => {
    for (const m of musts) {
      const solved = solutionsOf(m, start(look));
      const ways = new Set(solved.map((s) => s.steps.join(' → ')));
      const results = new Set(solved.map((s) => JSON.stringify(s.deeds.map((d) => [d.requested, d.newFlags, d.newCards, d.lines.map((l) => l.text)]))));
      const stats = new Set(solved.map((s) => JSON.stringify(s.state.stats)));
      console.log(`[푸는 길] ${look} 「${m.title}」: 길 ${ways.size}가지, 서로 다른 결과 ${results.size}가지, 서로 다른 수치 ${stats.size}가지`);
      expect(ways.size, m.title).toBeGreaterThanOrEqual(2);
      expect(results.size, m.title).toBeGreaterThanOrEqual(2);
      expect(stats.size, m.title).toBeGreaterThanOrEqual(2); // 길에 따라 수치도 달라진다
    }
  });

  it('미션의 일에서 고를 수 있는 선택지는 어느 것을 골라도 미션이 풀린다(틀린 답이 없다)', () => {
    for (const m of musts) {
      const paths = pathsOf(m, start(look));
      // 풀리지 않은 채 더 갈 곳이 없는 형편이 없어야 한다
      const dead = paths.filter((p) => !p.state.solved.includes(m.id) && !movesOf(pack, p.state).some((mv) => m.parts.includes(mv.id) || m.rescue === mv.id));
      expect(dead.map((p) => p.steps.join(' → '))).toEqual([]);
      // 미션의 첫 일에 보이는 선택지가 모두 한 번씩은 푸는 길에 들어 있다
      const first = happeningOf(pack, m.parts[0]);
      const used = new Set(solutionsOf(m, start(look)).map((s) => s.deeds[0]?.choiceId));
      for (const view of choiceViews(pack, start(look), first.id)) expect(used.has(view.id), `${m.title}/${view.id}`).toBe(true);
    }
  });

  it('풀렸을 때 그 일의 기록(Deed.solved)과 푼 미션 목록에 적힌다', () => {
    for (const m of musts) {
      for (const solution of solutionsOf(m, start(look))) {
        const last = solution.deeds[solution.deeds.length - 1];
        expect(last.solved).toEqual([m.id]);
        expect(solution.deeds.slice(0, -1).every((d) => d.solved.length === 0)).toBe(true);
        expect(solution.state.solved).toEqual([m.id]);
        expect(missionViews(pack, solution.state).find((v) => v.mission.id === m.id)?.solved).toBe(true);
        expect(last.note.trim().length).toBeGreaterThan(0); // 배움 쪽지가 함께 뜬다
      }
    }
    // 한 번 풀린 미션은 뒤의 일에서 다시 적히지 않는다
    for (const leaf of walked.leaves) {
      const all = leaf.history.flatMap((d) => d.solved);
      expect(new Set(all).size).toBe(all.length);
      expect(leaf.solved).toEqual(all);
    }
  });

  it('「돌아온 사람들, 떠나는 스님들」: 고르는 것만으로는 풀리지 않고, 고른 자리에 가서 마쳐야 풀린다', () => {
    const first = happeningOf(pack, returnMission.parts[0]);
    const views = choiceViews(pack, start(look), first.id);
    expect(views.length).toBeGreaterThanOrEqual(2);
    for (const view of views.filter((v) => !v.locked)) {
      const chose = doHappening(pack, start(look), { id: first.id, choiceId: view.id });
      expect(chose.solved).toEqual([]);
      expect(lastDeed(chose)?.missionId).toBe(returnMission.id);
      // 화살표가 다음 일의 자리로 옮겨 간다
      const next = openHappenings(pack, chose).filter((v) => v.mission?.id === returnMission.id);
      expect(next).toHaveLength(1);
      expect(chose.goTo).toBe(next[0].happening.spot);
      expect(missionViews(pack, chose).find((v) => v.mission.id === returnMission.id)?.spot).toBe(next[0].happening.spot);
      const did = doHappening(pack, chose, { id: next[0].happening.id });
      expect(lastDeed(did)?.solved).toEqual([returnMission.id]);
      expect(did.goTo).toBeUndefined();
    }
  });

  it('살림이 모자라면 곡식을 내는 길이 잠기고 까닭이 보인다. 그래도 다른 길이 열려 있다', () => {
    const first = happeningOf(pack, returnMission.parts[0]);
    const poor = choiceViews(pack, withStats(start(look), { living: 0 }), first.id);
    const locked = poor.filter((v) => v.locked);
    expect(locked.length).toBeGreaterThan(0);
    for (const v of locked) expect(v.reason?.length).toBeGreaterThan(0);
    expect(poor.filter((v) => !v.locked).length).toBeGreaterThanOrEqual(1);
  });

  it('덤 넷 가운데 해 ☀만큼만 할 수 있다', () => {
    const suns = roleOf(pack, ROLE).suns;
    const counts = walked.leaves.map((leaf) => leaf.history.filter((d) => d.sun === 1).length);
    expect(Math.max(...counts)).toBe(suns);
    expect(Math.min(...counts)).toBe(suns); // 길의 끝까지 가면 해를 다 쓴다(덤이 해보다 많다)
    for (const state of walked.all) {
      expect(state.history.filter((d) => d.sun === 1).length).toBeLessThanOrEqual(suns);
      expect(state.sunsLeft).toBe(suns - state.history.filter((d) => d.sun === 1).length);
    }
    // 해를 다 쓰면 남은 덤은 할 수 없다
    const spent = walked.all.find((s) => s.sunsLeft === 0 && s.history.length === suns) as GameState;
    const left = openHappenings(pack, spent).filter((v) => v.happening.cost === 1);
    expect(left).toHaveLength(extras.length - suns);
    for (const v of left) {
      expect(v.noSun).toBe(true);
      expect(() => doHappening(pack, spent, { id: v.happening.id })).toThrow(/해가 남아 있지 않다/);
    }
    // 덤 넷은 저마다 어느 길에는 들어 있다(어디로 갈지가 선택이다)
    const done = new Set(walked.leaves.flatMap((leaf) => leaf.done));
    for (const h of extras) expect(done.has(h.id), h.id).toBe(true);
  });

  it('덤을 하나도 하지 않아도, 덤부터 다 해도 계절을 보낼 수 있다', () => {
    let state = start(look);
    for (let guard = 0; guard < 20 && !canCloseSeason(pack, state); guard++) {
      const move = movesOf(pack, state).find((mv) => happeningOf(pack, mv.id).cost === 0) as DoInput;
      state = doHappening(pack, state, move);
    }
    expect(canCloseSeason(pack, state)).toBe(true);
    expect(state.sunsLeft).toBe(3);
    const closed = closeSeason(pack, state);
    expect(closed.phase).toBe('seasonClose');
    expect(lastClosing(closed)?.season).toBe('spring');

    let busy = start(look);
    for (let guard = 0; guard < 20; guard++) {
      const move = movesOf(pack, busy).find((mv) => happeningOf(pack, mv.id).cost === 1);
      if (!move) break;
      busy = doHappening(pack, busy, move);
    }
    expect(busy.sunsLeft).toBe(0);
    expect(canCloseSeason(pack, busy)).toBe(false);
    expect(explore(pack, busy).stuck).toEqual([]);
  });
});

describe.each(LOOKS)('① 봄 · 농민 집 아이(%s): 볍씨 뿌리기', (look) => {
  const moves = movesOf(pack, start(look)).filter((move) => move.id === sowHappening.id);
  const ends = Object.keys(sowHappening.play?.flags ?? {});

  it('볍씨를 어디에 뿌렸는지가 표시로 남는다(sow.low 또는 sow.split 가운데 하나)', () => {
    const picked = new Set<string>();
    for (const move of moves) {
      const after = doHappening(pack, start(look), move);
      const sown = after.flags.filter((flag) => flag === 'sow.low' || flag === 'sow.split');
      expect(sown, label(move)).toHaveLength(1);
      picked.add(sown[0]);
      expect(lastDeed(after)?.newFlags).toContain(sown[0]);
      expect(lastDeed(after)?.solved).toEqual([sowMission.id]);
    }
    expect([...picked].sort()).toEqual(['sow.low', 'sow.split']);
  });

  it('그 표시를 여름의 "나중에 나타나는 결과"가 읽는다', () => {
    const reads = (flag: string) => (pack.situation.later ?? []).some((later) => later.at === 'summer' && later.when.flags?.includes(flag));
    expect(reads('sow.low')).toBe(true);
    expect(reads('sow.split')).toBe(true);
  });

  it('일 놀이가 끝난 모습이 표시로 남는다', () => {
    expect(ends.length).toBeGreaterThanOrEqual(2);
    expect(moves).toHaveLength(choiceViews(pack, start(look), sowHappening.id).length * ends.length);
    for (const move of moves) {
      const after = doHappening(pack, start(look), move);
      const flag = sowHappening.play!.flags[move.play as string];
      expect(after.flags).toContain(flag);
      expect(lastDeed(after)?.play).toBe(move.play);
      // 다른 끝의 표시는 남지 않는다
      for (const other of ends.filter((end) => end !== move.play)) expect(after.flags).not.toContain(sowHappening.play!.flags[other]);
    }
  });

  it('놀이를 어떻게 끝내도(어른께 맡겨도) 미션은 풀리고, 끝난 모습 셋의 차이는 수치마다 1 안이다. 맡김이 "듬성듬성"보다 낫지 않다', () => {
    for (const view of choiceViews(pack, start(look), sowHappening.id)) {
      const deeds = ends.map((play) => lastDeed(doHappening(pack, start(look), { id: sowHappening.id, choiceId: view.id, play })) as Deed);
      for (const deed of deeds) expect(deed.solved).toEqual([sowMission.id]);
      expect(playEndProblems(Object.fromEntries(deeds.map((d, i) => [ends[i], d.requested])), 'patchy'), view.id).toEqual([]);
      // 놀이의 끝에 따라 이야기가 달라진다
      expect(new Set(deeds.map((d) => d.lines.map((l) => l.text).join('|'))).size).toBe(ends.length);
    }
  });

  it('놀이의 끝을 넘기지 않아도(화면이 놀이를 건너뛰어도) 일은 끝나고 표시 하나가 남는다', () => {
    for (const view of choiceViews(pack, start(look), sowHappening.id)) {
      const after = doHappening(pack, start(look), { id: sowHappening.id, choiceId: view.id });
      expect(lastDeed(after)?.solved).toEqual([sowMission.id]);
      expect(Object.values(sowHappening.play!.flags).filter((flag) => after.flags.includes(flag))).toHaveLength(1);
    }
  });

  it('볍씨 뿌리기에는 잠긴 선택지가 없다(기력이 바닥이어도 뿌릴 수 있다)', () => {
    const views = choiceViews(pack, withStats(start(look), FLOOR), sowHappening.id);
    expect(views.some((v) => !v.locked)).toBe(true);
  });
});

describe('① 봄 · 농민 집 아이: 두 모습', () => {
  // spec 6.3: 농민 집 아이가 모습에 따라 달라지는 곳은 단오 놀이판(여름)·한양으로 떠난 장정들(가을)·겨울 글공부뿐이다. 봄은 같다.
  it('두 모습 모두 같은 미션을 풀고, 길의 수가 같다(봄에는 모습 때문에 막히는 일이 없다)', () => {
    const boy = explore(pack, start('boy'));
    const girl = explore(pack, start('girl'));
    expect(girl.all.length).toBe(boy.all.length);
    expect(girl.leaves.length).toBe(boy.leaves.length);
    expect(openHappenings(pack, start('girl')).map((v) => v.happening.id)).toEqual(openHappenings(pack, start('boy')).map((v) => v.happening.id));
  });
});

// ── spec 6.3의 숫자(review 20번) ──────────────────────────────────

const ID = {
  news: 's1395-spring-return',
  help: 's1395-spring-return-help',
  ours: 's1395-spring-return-ours',
  monks: 's1395-spring-return-monks',
  sow: 's1395-spring-sow',
  well: 's1395-spring-well',
  temple: 's1395-spring-temple',
  tale: 's1395-spring-tale',
  woods: 's1395-spring-woods',
} as const;
const ZERO: Stats = { living: 0, body: 0, trust: 0 };
const delta = (change: Partial<Stats>): Stats => ({ ...ZERO, ...change });

/** 이 일의 모든 결과(선택지와 그 갈림, 선택지가 없는 일의 결과와 그 갈림) — 자료에 적힌 그대로 */
function outcomesOf(h: Happening): Outcome[] {
  const out: Outcome[] = [];
  for (const choice of h.choices ?? []) out.push(choice, ...(choice.variants ?? []));
  if (h.after) out.push(h.after, ...(h.after.variants ?? []));
  return out;
}

/** 이 일에서 화면에 뜨는 모든 글(여는 대화와 그 갈림, 선택지, 잠긴 까닭, 결과 대화, 쪽지, 한마디) */
function textsOf(h: Happening): string[] {
  return [
    ...h.lines.map((line) => line.text),
    ...(h.lineVariants ?? []).flatMap((variant) => variant.lines.map((line) => line.text)),
    ...(h.choices ?? []).flatMap((choice) => [choice.label, choice.lock?.reason ?? '']),
    ...outcomesOf(h).flatMap((outcome) => [...outcome.lines.map((line) => line.text), outcome.note ?? '']),
    h.note,
    h.lure ?? '',
  ].filter((text) => text.length > 0);
}

/**
 * 그 계절을 닫을 때 붙는 "나중에 나타나는 결과". 미션은 모두 푼 것으로 치고 닫는다
 * (아직 만들지 않은 계절도 닫아 볼 수 있고, 뒤에 그 계절의 미션이 생겨도 이 시험은 그대로다).
 */
function closingAt(season: Season, flags: string[], draw: string | null, stats: Stats = { living: 5, body: 5, trust: 5 }): Closing {
  const seasonIndex = SEASONS.indexOf(season);
  const state: GameState = {
    ...start('boy'),
    seasonIndex,
    phase: 'season',
    draw,
    flags,
    stats,
    flow: Array.from({ length: seasonIndex + 1 }, () => stats),
    solved: pack.missions.map((m) => m.id),
  };
  return lastClosing(closeSeason(pack, state)) as Closing;
}

describe('① 봄 · 농민 집 아이: spec 6.3의 숫자', () => {
  const later = pack.situation.later ?? [];
  /** 볍씨 선택을 읽는 나중 결과의 줄들 */
  const sowLines = later.filter((row) => row.when.flags?.some((flag) => flag.startsWith('sow.'))).map((row) => row.line);

  it.each(LOOKS)('스님들께 곡식을 보태는 길은 살림 2 이하에서 잠긴다: 2에서 잠기고 3에서 열린다(%s)', (look) => {
    for (let living = 0; living <= 10; living++) {
      const views = choiceViews(pack, withStats(start(look), { living }), ID.news);
      expect(views.map((v) => v.id)).toEqual(['help', 'ours', 'give']);
      const give = views[2];
      expect(give.locked, `살림 ${living}`).toBe(living <= 2);
      expect(give.reason, `살림 ${living}`).toBe(living <= 2 ? '보탤 곡식이 남아 있지 않아요' : undefined);
      // 다른 두 길은 살림이 얼마든 열려 있다
      expect(views.slice(0, 2).every((v) => !v.locked)).toBe(true);
    }
    // 살림만 본다: 기력과 인심이 바닥이어도 살림이 3이면 열린다
    expect(choiceViews(pack, withStats(start(look), { living: 3, body: 0, trust: 0 }), ID.news)[2].locked).toBe(false);
    expect(choiceViews(pack, withStats(start(look), { living: 2, body: 10, trust: 10 }), ID.news)[2].locked).toBe(true);
    // 잠긴 길은 고를 수 없고, 열리면 절 가는 길로 간다
    expect(() => doHappening(pack, withStats(start(look), { living: 2 }), { id: ID.news, choiceId: 'give' })).toThrow(/잠긴 선택지/);
    expect(doHappening(pack, withStats(start(look), { living: 3 }), { id: ID.news, choiceId: 'give' }).goTo).toBe('templeRoad');
  });

  it('미션 ①의 세 길: 고를 때는 수치가 그대로이고, 마칠 때 한 번 바뀐다', () => {
    const rows: [string, string, Partial<Stats>, string[]][] = [
      ['help', ID.help, { body: -1, trust: 1 }, []],
      ['ours', ID.ours, { living: 1, trust: -1 }, []],
      ['give', ID.monks, { living: -1, trust: 1 }, ['s1395-monk-builders']],
    ];
    for (const [choiceId, next, change, cards] of rows) {
      const chose = doHappening(pack, start('boy'), { id: ID.news, choiceId });
      expect(lastDeed(chose)?.requested, choiceId).toEqual(ZERO);
      const did = doHappening(pack, chose, { id: next });
      expect(lastDeed(did)?.requested, choiceId).toEqual(delta(change));
      expect(lastDeed(did)?.newCards, choiceId).toEqual(cards);
      expect(did.flags).toContain('return.done');
    }
  });

  it('인심이 깎이는 길이 있다: 우리 집 봄 일부터 하는 길 하나뿐이다', () => {
    const spring = pack.happenings.filter((h) => h.season === 'spring');
    const cuts = spring.filter((h) => outcomesOf(h).some((outcome) => (outcome.effects?.trust ?? 0) < 0)).map((h) => h.id);
    expect(cuts).toEqual([ID.ours]);
    const did = doAll(pack, start('girl'), [`${ID.news}/ours`, ID.ours]);
    expect(lastDeed(did)?.delta.trust).toBe(-1);
    expect(did.stats).toEqual({ living: 5, body: 6, trust: 4 });
  });

  it('볍씨 뿌리기: 고루 뿌리면 기력 -1·살림 +1, 듬성듬성이면 기력 -1, 어른께 맡겨도 듬성듬성과 같다(두 논 모두)', () => {
    for (const choiceId of ['low', 'split']) {
      const deed = (play: string) => lastDeed(doHappening(pack, start('boy'), { id: ID.sow, choiceId, play })) as Deed;
      expect(deed('even').requested, choiceId).toEqual(delta({ body: -1, living: 1 }));
      expect(deed('patchy').requested, choiceId).toEqual(delta({ body: -1 }));
      expect(deed('left').requested, choiceId).toEqual(delta({ body: -1 })); // 맡김 = 하다 만 것(review 1-라 10번). 아버지의 일이 밀리는 것은 말로만
      expect(deed('left').lines[0]).toMatchObject({ who: 'father', text: '그래, 오늘은 내가 뿌리마. 내 일은 좀 밀리겠지만, 손놀림을 잘 봐 두어라.' });
    }
  });

  it('궂은 해의 이름은 "큰비가 온 해"이고, 날씨는 여름에 뽑는다', () => {
    const { draw } = pack.situation;
    expect(draw.kind).toBe('weather');
    expect(draw.season).toBe('summer');
    expect(draw.labels?.drought.label).toBe('큰비가 온 해');
    expect(draw.labels?.normal.label).toBe('평소 같은 해');
    expect(draw.labels?.bumper.label).toBe('비가 알맞게 온 해');
    expect(draw.labels?.drought.line).toMatch(/큰비/);
    for (const row of Object.values(draw.labels ?? {})) expect(`${row.label} ${row.line}`).not.toMatch(/가뭄|풍년/);
    // 봄에는 아직 뽑지 않았고, 여름에 들어설 때 씨앗대로 뽑힌다
    for (const seed of [1, 2, 3, 7, 11]) {
      const spring = doAll(pack, newGame(pack, ROLE, 'boy', seed), [`${ID.news}/help`, ID.help, `${ID.sow}/low/even`]);
      expect(spring.draw).toBeNull();
      const closed = closeSeason(pack, spring);
      expect(closed.draw).toBeNull();
      const summer = nextSeason(pack, closed);
      expect(summer.draw).toBe(rollDraw('weather', seed));
      expect(drawValues('weather')).toContain(summer.draw);
    }
  });

  it('나중 결과 넷은 여름을 닫을 때 붙는다: 낮은 논+큰비 -3, 낮은 논+다른 해 +1, 나눠 뿌림+큰비 -1, 나눠 뿌림+다른 해 0(한 줄만)', () => {
    const summer = (flag: string, draw: string) => closingAt('summer', [flag, 'return.done'], draw);
    expect(summer('sow.low', 'drought').delta).toEqual(delta({ living: -3 }));
    expect(summer('sow.low', 'normal').delta).toEqual(delta({ living: 1 }));
    expect(summer('sow.low', 'bumper').delta).toEqual(delta({ living: 1 }));
    expect(summer('sow.split', 'drought').delta).toEqual(delta({ living: -1 }));
    expect(summer('sow.split', 'normal').delta).toEqual(ZERO);
    expect(summer('sow.split', 'bumper').delta).toEqual(ZERO);
    // 붙은 줄은 하나씩이다. 나눠 뿌린 논도 큰비가 아닌 해에 봄의 선택을 다시 말한다(수치는 그대로 — review 1-라 12번)
    expect(summer('sow.low', 'drought').lines).toHaveLength(1);
    expect(summer('sow.low', 'drought').lines[0]).toMatch(/큰비.*낮은 논.*잠겼다/);
    expect(summer('sow.low', 'normal').lines).toHaveLength(1);
    expect(summer('sow.low', 'normal').lines[0]).toMatch(/낮은 논/);
    expect(summer('sow.split', 'drought').lines).toHaveLength(1);
    expect(summer('sow.split', 'drought').lines[0]).toMatch(/높은 논/);
    for (const draw of ['normal', 'bumper']) {
      expect(summer('sow.split', draw).lines, draw).toEqual(['높은 논까지 물을 대느라 힘들었지만, 나눠 뿌린 벼가 고루 자랐다.']);
      expect(summer('sow.split', draw).effects, draw).toEqual([delta({})]);
    }
    // 살림은 0 아래로 내려가지 않는다
    expect(closingAt('summer', ['sow.low'], 'drought', { living: 2, body: 5, trust: 5 }).after.living).toBe(0);
  });

  it('볍씨 선택의 결과는 여름이 아닌 계절을 닫을 때는 붙지 않는다', () => {
    expect(sowLines).toHaveLength(4);
    for (const season of SEASONS.filter((one) => one !== 'summer')) {
      for (const flag of ['sow.low', 'sow.split']) {
        for (const draw of [...drawValues('weather'), null]) {
          const closing = closingAt(season, [flag], draw);
          expect(closing.lines.filter((line) => sowLines.includes(line)), `${season}/${flag}/${draw}`).toEqual([]);
          if (season === 'spring') expect(closing.delta, `${season}/${flag}/${draw}`).toEqual(ZERO);
        }
      }
    }
    // 자료에도 그렇게 적혀 있다(계절이 바뀌면 이 시험이 잡는다)
    expect(later.filter((row) => sowLines.includes(row.line)).map((row) => row.at)).toEqual(['summer', 'summer', 'summer', 'summer']);
  });

  it('실제로 봄을 해서 남긴 표시가 여름의 날씨와 만난다. 봄을 닫을 때는 아무것도 붙지 않는다', () => {
    const want: Record<string, Record<string, number>> = {
      low: { drought: -3, normal: 1, bumper: 1 },
      split: { drought: -1, normal: 0, bumper: 0 },
    };
    for (const look of LOOKS) {
      for (const choiceId of ['low', 'split']) {
        for (const play of ['even', 'patchy', 'left']) {
          const spring = doAll(pack, start(look), [`${ID.news}/ours`, ID.ours, `${ID.sow}/${choiceId}/${play}`]);
          const closed = closeSeason(pack, spring);
          expect(lastClosing(closed)?.lines).toEqual([]);
          expect(lastClosing(closed)?.after).toEqual(spring.stats);
          for (const draw of drawValues('weather')) {
            const closing = closingAt('summer', closed.flags, draw, { ...closed.stats, living: 5 });
            expect(closing.delta.living, `${choiceId}/${play}/${draw}`).toBe(want[choiceId][draw]);
          }
        }
      }
    }
  });

  it('가을을 닫을 때의 둘: 큰비가 온 해이면 살림 +1, 떠난 집 논을 돌봤으면 기력 +1', () => {
    const autumn = (flags: string[], draw: string) => closingAt('autumn', flags, draw);
    expect(autumn([], 'drought').delta).toEqual(delta({ living: 1 }));
    expect(autumn([], 'drought').lines).toHaveLength(1);
    expect(autumn([], 'drought').lines[0]).toMatch(/나라가.*곡식/);
    expect(autumn([], 'normal').delta).toEqual(ZERO);
    expect(autumn([], 'bumper').lines).toEqual([]);
    expect(autumn(['autumn.tended'], 'normal').delta).toEqual(delta({ body: 1 }));
    expect(autumn(['autumn.tended'], 'drought').delta).toEqual(delta({ living: 1, body: 1 }));
    expect(autumn(['autumn.tended'], 'drought').lines).toHaveLength(2);
    // 볍씨 선택은 가을에 다시 붙지 않는다(큰비가 온 해에 낮은 논이었어도 +1뿐)
    expect(autumn(['sow.low'], 'drought').delta).toEqual(delta({ living: 1 }));
    // 가을의 둘은 여름을 닫을 때는 붙지 않는다
    expect(closingAt('summer', ['autumn.tended'], 'drought').lines).toEqual([]);
    expect(closingAt('summer', ['autumn.tended'], 'drought').delta).toEqual(ZERO);
  });

  it('두 논의 셈: 낮은 논은 큰비가 아니면 이롭고 큰비에는 크게 잃는다. 어느 쪽도 늘 낫지 않다', () => {
    const living = (flag: string, draw: string) => closingAt('summer', [flag], draw).delta.living;
    expect(living('sow.low', 'drought')).toBeLessThan(living('sow.split', 'drought'));
    expect(living('sow.low', 'normal')).toBeGreaterThan(living('sow.split', 'normal'));
    expect(living('sow.low', 'bumper')).toBeGreaterThan(living('sow.split', 'bumper'));
  });
});

// ── 덤으로 하는 일: 한마디와 작은 선택(review 11번) ────────────────────

describe('① 봄 · 농민 집 아이: 덤의 한마디와 작은 선택', () => {
  const withChoices = extras.filter((h) => (h.choices ?? []).length > 0);
  const map = getMap(roleOf(pack, ROLE).map);

  it('덤 넷에 모두 한마디(lure)가 있다: 24자 안, 서로 다르고, 자리 이름을 되풀이하지 않는다', () => {
    expect(extras.map((h) => h.id).sort()).toEqual([ID.tale, ID.temple, ID.well, ID.woods].sort());
    const lures = extras.map((h) => h.lure ?? '');
    for (const h of extras) {
      const lure = h.lure ?? '';
      expect(lure.trim(), h.id).toBe(lure);
      expect(countChars(lure), h.id).toBeGreaterThanOrEqual(8);
      expect(countChars(lure), h.id).toBeLessThanOrEqual(BUDGET.lure);
      expect(BUDGET.lure).toBe(24);
      // 쪽지에는 "우물가 — <한마디>"로 뜬다. 자리 이름은 맵이 붙인다.
      const spot = map?.spots.find((one) => one.id === h.spot);
      expect(spot, h.id).toBeDefined();
      if (spot) expect(lure, h.id).not.toContain(spot.label);
      // 마침표 없이 한 줄, 소문처럼 듣는 말투
      expect(lure, h.id).not.toMatch(/[.!?\n]/);
      expect(lure, h.id).toMatch(/(다더라|고 한다)$/);
    }
    expect(new Set(lures).size).toBe(extras.length);
  });

  it('한마디는 답을 미리 말하지 않는다: 얻는 것(수치·카드)도, 배움 쪽지의 말도 적지 않는다', () => {
    for (const h of extras) {
      const lure = h.lure ?? '';
      expect(lure, h.id).not.toMatch(/살림|기력|인심|카드|해 ?☀|\d/);
      expect(h.note, h.id).not.toContain(lure);
      // 쪽지가 알려 주는 것(달, 햇수, 나라 이름)은 한마디에 없다
      expect(lure, h.id).not.toMatch(/시월|십이월|세 해|고려|조선|쌀|베|제사|장례/);
    }
    // 미션의 일에는 한마디를 달지 않는다(쪽지의 미션 줄에는 할 일 한 줄이 뜬다)
    for (const h of springOf(0)) expect(h.lure, h.id).toBeUndefined();
  });

  it('덤 넷 가운데 둘(우물가와 뒷산)에 둘 가운데 하나를 고르는 선택이 있다', () => {
    expect(withChoices.map((h) => h.id).sort()).toEqual([ID.well, ID.woods].sort());
    expect(withChoices.length).toBeGreaterThanOrEqual(2);
    for (const h of withChoices) {
      expect(h.choices, h.id).toHaveLength(2);
      expect(h.after, h.id).toBeUndefined(); // 선택지가 있으면 결과는 선택지에 적는다
      for (const choice of h.choices ?? []) {
        expect(choice.lock, `${h.id}/${choice.id}`).toBeUndefined();
        expect(choice.only, `${h.id}/${choice.id}`).toBeUndefined();
        expect(countChars(choice.label)).toBeLessThanOrEqual(BUDGET.label);
      }
    }
    // 나머지 둘(뒷산 절, 느티나무 그늘)은 듣기만 하는 일이다
    for (const h of extras.filter((one) => !withChoices.includes(one))) {
      expect(h.choices ?? [], h.id).toEqual([]);
      expect(h.after, h.id).toBeDefined();
    }
  });

  it.each(LOOKS)('새 선택지는 수치가 바닥이어도 둘 다 열려 있고, 어느 것을 골라도 일이 끝난다(%s)', (look) => {
    for (const h of withChoices) {
      for (const from of [start(look), withStats(start(look), FLOOR), withStats(start(look), { living: 10, body: 10, trust: 10 })]) {
        const views = choiceViews(pack, from, h.id);
        expect(views).toHaveLength(2);
        expect(views.every((v) => !v.locked)).toBe(true);
        for (const view of views) {
          const did = doHappening(pack, from, { id: h.id, choiceId: view.id });
          expect(lastDeed(did)?.sun).toBe(1);
          expect(did.sunsLeft).toBe(from.sunsLeft - 1);
          expect(did.done).toContain(h.id);
          expect(lastDeed(did)?.label).toBe(view.label);
        }
      }
    }
  });

  it('새 선택지마다 결과가 다르다: 대화도 수치도 다르고, 어느 쪽도 다른 쪽보다 모든 면에서 낫지 않다', () => {
    for (const h of withChoices) {
      const deeds = (h.choices ?? []).map((choice) => lastDeed(doHappening(pack, start('boy'), { id: h.id, choiceId: choice.id })) as Deed);
      const [a, b] = deeds;
      expect(a.lines.map((line) => line.text)).not.toEqual(b.lines.map((line) => line.text));
      expect(a.lines.every((line) => !b.lines.some((other) => other.text === line.text)), h.id).toBe(true);
      expect(a.requested).not.toEqual(b.requested);
      // 한쪽이 얻는 것이 있으면 내주는 것도 있다(모든 수치에서 같거나 나은 쪽이 없다)
      const better = (x: Deed, y: Deed) => STATS.every((stat) => x.requested[stat] >= y.requested[stat]);
      expect(better(a, b), `${h.id}: ${a.choiceId}가 늘 낫다`).toBe(false);
      expect(better(b, a), `${h.id}: ${b.choiceId}가 늘 낫다`).toBe(false);
    }
  });

  it('우물가: 거들며 들으면 기력 -1·인심 +1, 듣기만 하면 그대로다. 카드와 쪽지는 어느 쪽이든 받는다', () => {
    const carry = lastDeed(doHappening(pack, start('boy'), { id: ID.well, choiceId: 'carry' })) as Deed;
    const listen = lastDeed(doHappening(pack, start('boy'), { id: ID.well, choiceId: 'listen' })) as Deed;
    expect(carry.requested).toEqual(delta({ body: -1, trust: 1 }));
    expect(listen.requested).toEqual(ZERO);
    for (const deed of [carry, listen]) {
      expect(deed.newCards).toEqual(['s1395-palace-work']);
      expect(deed.note).toBe(happeningOf(pack, ID.well).note);
      expect(deed.newFlags).toEqual([]); // 읽히지 않는 표시를 남기지 않는다
      expect(deed.solved).toEqual([]);
    }
  });

  it('뒷산: 나무를 넉넉히 하면 기력 -1·살림 +1, 한 짐만 하고 쉬면 기력 +1이다(해를 쓰고 남는 것이 없는 선택이 없다). 쪽지는 어느 쪽이든 같다', () => {
    const plenty = lastDeed(doHappening(pack, start('girl'), { id: ID.woods, choiceId: 'plenty' })) as Deed;
    const light = lastDeed(doHappening(pack, start('girl'), { id: ID.woods, choiceId: 'light' })) as Deed;
    expect(plenty.requested).toEqual(delta({ body: -1, living: 1 }));
    expect(light.requested).toEqual(delta({ body: 1 }));
    for (const deed of [plenty, light]) {
      expect(deed.newCards).toEqual([]);
      expect(deed.note).toBe(happeningOf(pack, ID.woods).note);
      expect(deed.newFlags).toEqual([]);
      // 쪽지(쌀과 베가 돈처럼 쓰였다)가 짚는 것을 어느 쪽에서든 겪거나 듣는다
      const heard = [...happeningOf(pack, ID.woods).lines, ...deed.lines].map((line) => line.text).join(' ');
      expect(heard).toMatch(/쌀/);
    }
  });

  it('덤의 변화는 자료에 적힌 그대로 -1~+1이다(엔진이 묶어 주기 전의 값). 미션의 일은 -3~+3이다', () => {
    for (const h of pack.happenings.filter((one) => one.season === 'spring')) {
      const limit = h.cost === 1 ? 1 : 3;
      for (const outcome of outcomesOf(h)) {
        for (const [stat, value] of Object.entries(outcome.effects ?? {})) {
          expect(Number.isInteger(value), `${h.id} ${stat}`).toBe(true);
          expect(Math.abs(value as number), `${h.id} ${stat} ${value}`).toBeLessThanOrEqual(limit);
        }
      }
    }
    // 덤 넷이 주는 것은 서로 다르다(어디로 갈지가 선택이다)
    const gives = extras.map((h) =>
      JSON.stringify(outcomesOf(h).map((outcome) => [outcome.effects ?? {}, outcome.cards ?? [], outcome.setFlags ?? []])),
    );
    expect(new Set(gives).size).toBe(extras.length);
  });

  it('느티나무 그늘의 옛이야기가 덤 미션 「새 나라 이야기 모으기」의 봄 몫이다(풀리는 길은 그대로)', () => {
    const tales = pack.missions.find((m) => m.id === 's1395-m-tales') as Mission;
    expect(tales.must).toBe(false);
    expect(tales.parts).toEqual([ID.tale, 's1395-autumn-tale', 's1395-winter-tale']);
    expect(missionProgress(tales, start('boy'))).toEqual({ have: 0, need: 3 });
    const did = doHappening(pack, start('boy'), { id: ID.tale });
    expect(lastDeed(did)?.newFlags).toEqual(['tale.spring']);
    expect(lastDeed(did)?.requested).toEqual(delta({ body: 1 }));
    expect(lastDeed(did)?.missionId).toBe(tales.id);
    expect(missionProgress(tales, did)).toEqual({ have: 1, need: 3 });
    expect(did.solved).toEqual([]); // 가을과 겨울의 이야기를 마저 들어야 풀린다
    // 다른 덤(선택이 생긴 우물가와 뒷산 포함)은 이 미션의 표시를 남기지 않는다
    for (const h of extras.filter((one) => one.id !== ID.tale)) {
      for (const outcome of outcomesOf(h)) expect(outcome.setFlags ?? [], h.id).not.toContain('tale.spring');
    }
    // 뒷산 절은 듣기만 하는 일로 카드를 준다
    expect(lastDeed(doHappening(pack, start('boy'), { id: ID.temple }))?.newCards).toEqual(['s1395-temple-monks']);
  });
});

// ── 글의 앞뒤와 쉬운 말(review 12·13번, 8번의 글 쪽) ─────────────────────

describe('① 봄 · 농민 집 아이: 글의 앞뒤와 쉬운 말', () => {
  const spring = pack.happenings.filter((h) => h.season === 'spring');
  const farmer = roleOf(pack, ROLE);
  const springCards = bundle.cards.filter((card) => spring.some((h) => outcomesOf(h).some((outcome) => (outcome.cards ?? []).includes(card.id))));
  const every = [
    ...spring.flatMap(textsOf),
    ...missionsOf(pack, ROLE, 'spring').flatMap((m) => [m.title, m.goal, m.doneLine]),
    ...springCards.flatMap((card) => [card.title, card.text]),
    farmer.intro,
    farmer.wish,
    farmer.family ?? '',
    ...farmer.wishOutcomes.map((row) => row.reason),
    pack.situation.seasons.spring.line,
  ];

  it('미션의 일에는 때를 못 박는 말이 없다(해 ☀는 덤에만 진다)', () => {
    for (const h of springOf(0)) {
      for (const text of textsOf(h)) expect(text, h.id).not.toMatch(/해가 기울|해가 지|해 질|저녁|밤이|밤에|아침|한낮|온종일|하루 종일/);
    }
  });

  it('절 가는 길에서 스님들은 아직 떠나지 않았고, 그 뒤에 뒷산 절에 가도 앞뒤가 맞는다', () => {
    const monks = happeningOf(pack, ID.monks);
    for (const text of textsOf(monks)) expect(text).not.toMatch(/뒷모습|떠나갔|떠났다|떠나는 뒷/);
    // 곡식을 보태고 온 뒤의 뒷산 절: 스님이 알아보고, 아직 떠나기 전이다
    const gave = doAll(pack, start('boy'), [`${ID.news}/give`, ID.monks]);
    const temple = happeningOf(pack, ID.temple);
    const variant = temple.lineVariants?.find((one) => one.when.flags?.includes('return.give'));
    expect(variant?.when.flags).toEqual(['return.give', 'return.done']);
    expect(gave.flags).toEqual(expect.arrayContaining(['return.give', 'return.done']));
    const after = (variant?.lines ?? []).map((line) => line.text).join(' ');
    expect(after).toMatch(/곡식을 보태 준/);
    expect(after).toMatch(/떠날/);
    // 미션 ①의 다른 길로 왔거나 아직 풀기 전이면 바탕 대화다
    expect(temple.lines[0].text).not.toBe(variant?.lines[0].text);
  });

  it('뒷산 절의 글은 그림(텅 빈 조용한 절 마당)과 어긋나지 않는다', () => {
    const temple = happeningOf(pack, ID.temple);
    for (const lines of [temple.lines, ...(temple.lineVariants ?? []).map((one) => one.lines)]) {
      expect(lines[0].text).toMatch(/마당은 조용하다/);
      for (const line of lines) expect(line.text).not.toMatch(/어수선|북적|짐을 싸/);
    }
  });

  it('할머니의 옛이야기: 열다섯 살인 나도 열두 살 때까지는 고려에서 살았다', () => {
    expect(farmer.age).toBe(15);
    const tale = happeningOf(pack, ID.tale);
    const told = tale.lines.map((line) => line.text).join(' ');
    expect(told).not.toMatch(/내가 네 나이/);
    expect(told).toMatch(/네가 열두 살 때/);
    expect(told).toMatch(/세 해 전/); // 열다섯에서 셋을 빼면 열둘
  });

  it('5학년이 모를 말을 쓰지 않는다: 양식·곳간·돈 구실·첫째', () => {
    for (const text of every) expect(text).not.toMatch(/양식|곳간|구실|첫째|길양식/);
    expect(farmer.family).toMatch(/형제/);
  });

  it('"김매기"는 풀이와 함께 한 번만 나온다(카드 「볍씨 바로 뿌리기」)', () => {
    const used = every.filter((text) => /김매기|김을 매/.test(text));
    const card = bundle.cards.find((one) => one.id === 's1395-direct-sowing');
    expect(used).toEqual([card?.text]);
    expect(card?.text).toMatch(/논의 풀을 뽑는 일을 김매기라고/);
    expect(card?.text).toMatch(/네댓 번/); // F04: 바로 뿌리면 4~5번
  });

  it('카드의 글은 그 카드를 주는 일의 배움 쪽지와 다른 것을 알려 준다(같은 말을 두 번 읽지 않는다)', () => {
    const sentences = (text: string) => text.split(/(?<=[.!?])\s+/).map((one) => one.trim()).filter(Boolean);
    expect(springCards.map((card) => card.id).sort()).toEqual(
      ['s1395-direct-sowing', 's1395-monk-builders', 's1395-palace-work', 's1395-temple-monks'].sort(),
    );
    for (const card of springCards) {
      const givers = spring.filter((h) => outcomesOf(h).some((outcome) => (outcome.cards ?? []).includes(card.id)));
      expect(givers.length, card.id).toBeGreaterThan(0);
      for (const h of givers) {
        const notes = [h.note, ...outcomesOf(h).map((outcome) => outcome.note ?? '')].filter(Boolean);
        for (const note of notes) {
          expect(card.text, `${card.id} / ${h.id}`).not.toBe(note);
          // 문장 하나도 겹치지 않는다
          for (const one of sentences(card.text)) expect(sentences(note), `${card.id} / ${h.id}`).not.toContain(one);
          // 문장의 앞머리(여덟 자)가 같은 것도 없다("볍씨를 논에 바로 뿌렸어요 …"를 되풀이하지 않는다)
          const heads = sentences(note).map((one) => one.slice(0, 8));
          for (const one of sentences(card.text)) expect(heads, `${card.id} / ${h.id}`).not.toContain(one.slice(0, 8));
        }
      }
    }
  });

  it('봄의 글과 카드, 나중 결과에 근거 글에 없는 숫자가 없다', () => {
    // 근거 글이 한글로 쓴 수("일흔")를 카드가 숫자로 풀어 쓴 것("일흔 살(70살)" — review 1-라 31번)은 근거에 있는 수로 친다
    const WORDS: [string, string][] = [['일흔', '70']];
    const factNumbers = (ids: string[]) =>
      new Set(
        bundle.sources
          .filter((source) => ids.includes(source.id))
          .flatMap((source) => [...numbersIn(source.fact), ...WORDS.filter(([word]) => source.fact.includes(word)).map(([, n]) => n)]),
      );
    const loose: string[] = [];
    for (const h of spring) {
      const known = factNumbers(h.facts);
      for (const text of textsOf(h)) for (const n of numbersIn(text)) if (!known.has(n)) loose.push(`${h.id}: ${n}`);
    }
    for (const card of bundle.cards.filter((one) => one.situation === pack.situation.id)) {
      const known = factNumbers(card.facts);
      for (const n of numbersIn(`${card.title} ${card.text}`)) if (!known.has(n)) loose.push(`${card.id}: ${n}`);
    }
    for (const row of pack.situation.later ?? []) {
      const known = factNumbers(row.facts ?? []);
      for (const n of numbersIn(row.line)) if (!known.has(n)) loose.push(`나중 결과: ${n}`);
    }
    expect(loose).toEqual([]);
  });
});

// ══ 여름·가을·겨울(바퀴 1-라) ══════════════════════════════════════════

const Y = {
  dano: 's1395-summer-dano',
  weed: 's1395-summer-weed',
  weedHelp: 's1395-summer-weed-help',
  manor: 's1395-summer-manor',
  neighbor: 's1395-summer-neighbor',
  bank: 's1395-summer-bank',
  leave: 's1395-autumn-leave',
  back: 's1395-autumn-back',
  harvest: 's1395-autumn-harvest',
  salt: 's1395-autumn-salt',
  saltHelp: 's1395-autumn-salt-help',
  sendoff: 's1395-autumn-sendoff',
  office: 's1395-autumn-office',
  taleAutumn: 's1395-autumn-tale',
  rite: 's1395-winter-rite',
  riteTemple: 's1395-winter-rite-temple',
  letters: 's1395-winter-letters',
  lettersGirl: 's1395-winter-letters-girl',
  weave: 's1395-winter-weave',
  taleWinter: 's1395-winter-tale',
  share: 's1395-winter-share',
  elder: 's1395-winter-elder',
} as const;

const later3: Season[] = ['summer', 'autumn', 'winter'];
const yearHappenings = pack.happenings.filter((h) => later3.includes(h.season));
const ofSeason = (season: Season, cost?: 0 | 1): Happening[] => pack.happenings.filter((h) => h.season === season && (cost === undefined || h.cost === cost));
const rescueIds = pack.missions.map((m) => m.rescue).filter((id): id is string => Boolean(id));

/**
 * 그 계절의 처음 형편을 지어낸다: 수치·날씨·앞선 표시·이미 한 일을 정해서(앞 계절의 꼭 푸는 미션은 푼 것으로 친다).
 * 실제로 걸어서 닿는 형편인지는 따지지 않는다 — 문턱과 숫자를 한 군데씩 보려는 것이다(닿는지는 아래의 "실제로 걸어서" 시험들이 본다).
 */
function seasonAt(
  season: Season,
  look: Look,
  over: { stats?: Partial<Stats>; draw?: string; flags?: string[]; done?: string[]; cards?: string[] } = {},
): GameState {
  const seasonIndex = SEASONS.indexOf(season);
  const stats: Stats = { living: 5, body: 5, trust: 5, ...over.stats };
  return {
    ...start(look),
    seasonIndex,
    phase: 'season',
    draw: over.draw ?? 'normal',
    flags: over.flags ?? ['return.done', 'sow.split'],
    done: over.done ?? [],
    cards: over.cards ?? [],
    stats,
    sunsLeft: 3,
    flow: Array.from({ length: seasonIndex + 1 }, () => stats),
    solved: pack.missions.filter((m) => m.must && m.season !== 'year' && SEASONS.indexOf(m.season) < seasonIndex).map((m) => m.id),
  };
}
const openIdsOf = (state: GameState): string[] => openHappenings(pack, state).map((v) => v.happening.id);
const viewOf = (state: GameState, id: string, choiceId: string) => choiceViews(pack, state, id).find((v) => v.id === choiceId);
const deedOf = (state: GameState, step: string): Deed => lastDeed(doAll(pack, state, [step])) as Deed;
const said = (lines: { text: string }[]): string => lines.map((line) => line.text).join(' ');
const spotOfMission = (state: GameState, missionId: string) => missionViews(pack, state).find((v) => v.mission.id === missionId)?.spot;

describe('① 한 해 · 농민 집 아이: 여름·가을·겨울의 짜임', () => {
  it('계절마다 꼭 푸는 미션이 둘이고, 덤은 여름 셋·가을 셋·겨울 넷이다(해 ☀는 셋)', () => {
    const musts = (season: Season) => missionsOf(pack, ROLE, season).filter((m) => m.must).map((m) => m.id);
    expect(musts('summer')).toEqual(['s1395-m-dano', 's1395-m-weed']);
    expect(musts('autumn')).toEqual(['s1395-m-leave', 's1395-m-harvest']);
    expect(musts('winter')).toEqual(['s1395-m-rite', 's1395-m-letters']);
    expect(ofSeason('summer', 1).map((h) => h.id)).toEqual([Y.manor, Y.neighbor, Y.bank]);
    expect(ofSeason('autumn', 1).map((h) => h.id)).toEqual([Y.sendoff, Y.office, Y.taleAutumn]);
    expect(ofSeason('winter', 1).map((h) => h.id)).toEqual([Y.weave, Y.taleWinter, Y.share, Y.elder]);
    expect(rescueIds).toEqual([Y.weedHelp, Y.saltHelp]);
    // 미션의 일(도움의 일 포함)은 해를 쓰지 않는다
    for (const season of later3) {
      for (const m of missionsOf(pack, ROLE, season).filter((one) => one.must)) {
        for (const id of [...m.parts, ...(m.rescue ? [m.rescue] : [])]) expect(happeningOf(pack, id).cost, id).toBe(0);
        expect(m.doneLine).not.toMatch(/맞았|정답|틀렸/);
      }
    }
  });

  it('못 박힌 이름만 쓴다: 맵의 자리, 대화 장면의 배경, 사람, 일 놀이', () => {
    const SPOTS = ['tree', 'treeShade', 'home', 'well', 'ourPaddy', 'neighborPaddy', 'templeRoad', 'temple', 'woods', 'manorFront', 'streamside', 'streamBank', 'northRoad', 'westRoad', 'hyanggyoRoad', 'threshing', 'passTop', 'neighborHouse', 'highPaddy'];
    const PLACES = ['entrance', 'paddy', 'well', 'temple', 'hill', 'yard', 'stream', 'road', 'threshing', 'pass', 'hyanggyo', 'manor', 'room', 'neighbor'];
    const PEOPLE = ['neighbor-elder', 'monk', 'father', 'mother', 'village-grandma', 'well-neighbor', 'friend-boy', 'grandma', 'brother', 'village-elder', 'friend-girl', 'teacher', 'student', 'official', 'pass-villager', 'manor-servant'];
    const map = getMap(roleOf(pack, ROLE).map);
    for (const h of pack.happenings) {
      expect(SPOTS, h.id).toContain(h.spot);
      expect(map?.spots.some((spot) => spot.id === h.spot), `${h.id}: 맵에 없는 자리 ${h.spot}`).toBe(true);
      expect(PLACES, h.id).toContain(h.stage.place);
      expect(bundle.places.map((place) => place.id), h.id).toContain(h.stage.place);
      // 말하는 사람은 모두 무대에 서 있다(두 명까지)
      const cast = (h.stage.cast ?? []).map((one) => one.who);
      const speakers = [...h.lines, ...(h.lineVariants ?? []).flatMap((v) => v.lines), ...outcomesOf(h).flatMap((o) => o.lines)].map((line) => line.who).filter(Boolean);
      for (const who of speakers) expect(cast, `${h.id}: ${who}`).toContain(who);
      expect(h.id).toMatch(new RegExp(`^s1395-${h.season}-`));
    }
    for (const [who, person] of Object.entries(pack.situation.people)) {
      expect(PEOPLE).toContain(who);
      expect(countChars(person.label), who).toBeLessThanOrEqual(6);
      expect(person.sprite, who).toBeTruthy();
    }
    // 일 놀이 넷: 김매기(여름) · 가을걷이와 나라 몫 · 쌀과 베로 값 치르기(가을) · 베 짜기(겨울 덤). 끝난 모습의 이름과 차례가 놀이 쪽과 같다.
    const plays = yearHappenings.filter((h) => h.play).map((h) => [h.id, h.play?.game, h.play?.rules, Object.keys(h.play?.flags ?? {})]);
    expect(plays).toEqual([
      [Y.harvest, 'harvest', '1395', ['all', 'some', 'left']],
      [Y.salt, 'pay', '1395', ['exact', 'generous', 'left']],
      [Y.weed, 'weed', '1395', ['clean', 'rough', 'left']],
      [Y.weave, 'weave', '1395', ['bolt', 'half', 'left']],
    ]);
    for (const h of yearHappenings.filter((one) => one.play)) expect(Object.keys(h.play!.flags)).toEqual(PLAY_KINDS[h.play!.game].results);
  });

  it('한 계절에 한 자리에는 일이 하나다(겨울의 우리 집만 둘 — 제삿날 일을 정한 뒤에야 베 짜기가 나타난다)', () => {
    for (const season of SEASONS) {
      const bySpot = new Map<string, string[]>();
      for (const h of ofSeason(season)) bySpot.set(h.spot, [...(bySpot.get(h.spot) ?? []), h.id]);
      const shared = [...bySpot].filter(([, ids]) => ids.length > 1).map(([spot, ids]) => [spot, ids]);
      expect(shared, season).toEqual(season === 'winter' ? [['home', [Y.rite, Y.weave]]] : []);
    }
    // 겨울의 어느 형편에서도 둘이 함께 뜨지 않는다
    for (const look of LOOKS) {
      for (const state of explore(pack, seasonAt('winter', look)).all) {
        const ids = openIdsOf(state);
        expect(ids.includes(Y.rite) && ids.includes(Y.weave)).toBe(false);
      }
    }
  });

  it('모습에 따라 달라지는 것은 셋뿐이다: 단오, "내년이면 나도 열여섯이다", 겨울 글공부', () => {
    const reads = (cond: { look?: Look; anyOf?: unknown[] } | undefined): boolean =>
      Boolean(cond && (cond.look !== undefined || (cond.anyOf ?? []).some((one) => reads(one as { look?: Look }))));
    const byLook = pack.happenings
      .filter(
        (h) =>
          reads(h.shows) ||
          (h.lineVariants ?? []).some((v) => reads(v.when)) ||
          (h.choices ?? []).some((c) => reads(c.lock?.unless) || (c.variants ?? []).some((v) => reads(v.when))) ||
          (h.after?.variants ?? []).some((v) => reads(v.when)),
      )
      .map((h) => h.id);
    expect(byLook.sort()).toEqual([Y.dano, Y.leave, Y.letters, Y.lettersGirl].sort());
    // 그 밖의 일은 두 모습에서 여는 대화도 결과도 같다
    for (const h of yearHappenings.filter((one) => !byLook.includes(one.id) && !rescueIds.includes(one.id) && !one.shows)) {
      const [boy, girl] = LOOKS.map((look) => seasonAt(h.season, look));
      expect(openingLines(pack, girl, h.id), h.id).toEqual(openingLines(pack, boy, h.id));
      expect(choiceViews(pack, girl, h.id), h.id).toEqual(choiceViews(pack, boy, h.id));
    }
    // 미션과 한 해 이름, 바람, 나중 결과는 모습을 읽지 않는다
    for (const m of pack.missions) expect(reads(m.done), m.id).toBe(false);
    for (const ending of pack.situation.endings) expect(reads(ending.when), ending.id).toBe(false);
  });
});

describe.each(LOOKS)('① 여름 · 농민 집 아이(%s)', (look) => {
  const summer = (over: Parameters<typeof seasonAt>[2] = {}) => seasonAt('summer', look, over);

  it('「단오 놀이판」: 세 길 — 쉬면 기력 +2, 논일을 하면 살림 +1·인심 -1, 떡을 올리면 살림 -1·인심 +1·기력 +1', () => {
    expect(choiceViews(pack, summer(), Y.dano).map((v) => v.id)).toEqual(['play', 'work', 'treat']);
    expect(deedOf(summer(), `${Y.dano}/play`).requested).toEqual(delta({ body: 2 }));
    expect(deedOf(summer(), `${Y.dano}/work`).requested).toEqual(delta({ living: 1, trust: -1 }));
    expect(deedOf(summer(), `${Y.dano}/treat`).requested).toEqual(delta({ living: -1, trust: 1, body: 1 }));
    for (const choiceId of ['play', 'work', 'treat']) {
      const deed = deedOf(summer(), `${Y.dano}/${choiceId}`);
      expect(deed.solved, choiceId).toEqual(['s1395-m-dano']);
      expect(deed.newCards, choiceId).toEqual(['s1395-dano']);
      expect(deed.sun).toBe(0);
    }
    // 논일을 해도 누구도 나를 꾸짖지 않는다
    expect(said(deedOf(summer(), `${Y.dano}/work`).lines)).not.toMatch(/게으|못된|혼|꾸짖|나무라/);
  });

  it('「단오 놀이판」: 떡을 빚는 길은 살림 3 이하에서 잠긴다(3에서 잠기고 4에서 열린다)', () => {
    for (let living = 0; living <= 10; living++) {
      const treat = viewOf(summer({ stats: { living } }), Y.dano, 'treat');
      expect(treat?.locked, `살림 ${living}`).toBe(living <= 3);
      expect(treat?.reason, `살림 ${living}`).toBe(living <= 3 ? '떡을 빚을 만큼 곡식이 넉넉하지 않아요' : undefined);
    }
    const poor = choiceViews(pack, summer({ stats: FLOOR }), Y.dano);
    expect(poor.filter((v) => !v.locked).map((v) => v.id)).toEqual(['play', 'work']);
  });

  it(`「단오 놀이판」: 모습에 따라 놀이가 다르다 — ${look === 'boy' ? '씨름' : '창포물과 그네'}`, () => {
    const opening = openingLines(pack, summer(), Y.dano);
    const result = said(deedOf(summer(), `${Y.dano}/play`).lines);
    if (look === 'boy') {
      expect(opening[1]).toMatchObject({ who: 'friend-boy' });
      expect(opening[1].text).toMatch(/씨름판/);
      expect(result).toMatch(/모래판/);
      expect(result).not.toMatch(/창포|그네/);
    } else {
      expect(opening[1]).toMatchObject({ who: 'friend-girl' });
      expect(opening[1].text).toMatch(/창포.*그네/);
      expect(result).toMatch(/창포물.*그네/);
      expect(result).not.toMatch(/모래판|씨름/);
    }
    // 큰비가 온 해에는 첫 창이 바뀐다(둘째 창은 그 모습의 것 그대로)
    const rain = openingLines(pack, summer({ draw: 'drought' }), Y.dano);
    // 큰비가 온 해의 맵은 여름 내내 비가 온다: 비가 그친 것이 아니라 잠깐 멎은 것으로 읽혀야 한다
    expect(rain[0].text).toMatch(/비가 잠깐 멎었다.*물이 불어난 냇가/);
    expect(rain[0].text).not.toMatch(/그쳤/);
    expect(rain.slice(1)).toEqual(opening.slice(1));
    expect(openingLines(pack, summer({ draw: 'bumper' }), Y.dano)).toEqual(opening);
  });

  it('「김매기」: 잠김의 문턱 — 온 식구는 기력 2 이하, 서로 거들기는 인심 3 이하나 기력 1 이하, 쉬엄쉬엄은 기력 1 이하', () => {
    for (let body = 0; body <= 10; body++) {
      const state = summer({ stats: { body } });
      expect(viewOf(state, Y.weed, 'all')?.locked, `기력 ${body}`).toBe(body <= 2);
      expect(viewOf(state, Y.weed, 'swap')?.locked, `기력 ${body}`).toBe(body <= 1);
      expect(viewOf(state, Y.weed, 'rest')?.locked, `기력 ${body}`).toBe(body <= 1);
    }
    for (let trust = 0; trust <= 10; trust++) {
      expect(viewOf(summer({ stats: { trust } }), Y.weed, 'swap')?.locked, `인심 ${trust}`).toBe(trust <= 3);
      // 봄에 돌아온 집의 논갈이를 거들었으면 인심이 낮아도 열린다
      expect(viewOf(summer({ stats: { trust }, flags: ['return.help', 'return.done', 'sow.low'] }), Y.weed, 'swap')?.locked, `인심 ${trust}`).toBe(false);
    }
    // 봄에 거들었어도 기력이 바닥이면 남의 논까지 거들 수 없다
    expect(viewOf(summer({ stats: { body: 1 }, flags: ['return.help'] }), Y.weed, 'swap')?.locked).toBe(true);
    const worn = summer({ stats: { body: 1, trust: 3 } });
    expect(choiceViews(pack, worn, Y.weed).map((v) => [v.id, v.reason])).toEqual([
      ['all', '몸이 지쳐 온 논을 다 맬 수 없어요'],
      ['swap', '몸이 지쳐 남의 논까지 거들 수 없어요'],
      ['rest', '몸이 아파 논에 나갈 수 없어요'],
    ]);
    // 기력은 되는데 인심 때문에 잠기면 까닭이 다르다 — 무엇을 하면 열리는지 말한다(review 1-라 15번)
    for (const body of [2, 6, 10]) {
      expect(viewOf(summer({ stats: { body, trust: 3 } }), Y.weed, 'swap'), `기력 ${body}`).toMatchObject({ locked: true, reason: '이웃을 거든 일이 적어 서로 거들자고 하기 어려워요' });
    }
  });

  it('「김매기」: 고른 길과 놀이가 끝난 모습에 따른 수치(끝난 모습 셋의 차이는 수치마다 1 안, 맡김 = 풀이 남음)', () => {
    const want: Record<string, Record<string, Partial<Stats>>> = {
      all: { clean: { body: -2, living: 2 }, rough: { body: -2, living: 1 }, left: { body: -2, living: 1 } },
      swap: { clean: { body: -1, trust: 1, living: 1 }, rough: { body: -1, trust: 1 }, left: { body: -1, trust: 1 } },
      rest: { clean: {}, rough: { living: -1 }, left: { living: -1 } },
    };
    for (const [choiceId, row] of Object.entries(want)) {
      const deeds = Object.entries(row).map(([play, change]) => {
        const deed = deedOf(summer(), `${Y.weed}/${choiceId}/${play}`);
        expect(deed.requested, `${choiceId}/${play}`).toEqual(delta(change));
        expect(deed.solved, `${choiceId}/${play}`).toEqual(['s1395-m-weed']);
        expect(deed.play).toBe(play);
        expect(deed.newFlags.sort(), `${choiceId}/${play}`).toEqual(['weed.done', `weed.${play}`].sort());
        expect(deed.lines).toHaveLength(2);
        expect(deed.lines[0].who).toBe('mother'); // 첫 창은 놀이가 끝난 모습
        return deed;
      });
      expect(playEndProblems(Object.fromEntries(deeds.map((d) => [d.play as string, d.requested])), 'rough'), choiceId).toEqual([]);
      expect(new Set(deeds.map((d) => d.lines[0].text)).size).toBe(3);
      // 둘째 창은 고른 길. 쉬엄쉬엄 맸는데 놀이에서 풀을 다 뽑았으면 둘째 창이 그 일과 맞게 갈린다(review 1-라 3번)
      if (choiceId === 'rest') {
        expect(deeds[0].lines[1].text).toBe('쉬엄쉬엄 맸지만 내 손이 닿은 데는 말끔하다. 남은 데는 다음에 매자.');
        expect(deeds[1].lines[1].text).toBe(deeds[2].lines[1].text);
        expect(deeds[1].lines[1].text).not.toBe(deeds[0].lines[1].text);
      } else {
        expect(new Set(deeds.map((d) => d.lines[1].text)).size).toBe(1);
      }
    }
    // 맡기면 어머니가 대신 매고, 그만큼 어머니의 일이 밀린다
    expect(deedOf(summer(), `${Y.weed}/all/left`).lines[0].text).toMatch(/내가 매마. 내 일은 밀리겠지만/);
    // 놀이의 끝을 넘기지 않으면(화면이 건너뛰면) 첫 끝으로 친다
    expect(deedOf(summer(), `${Y.weed}/rest`).play).toBe('clean');
  });

  it('「김매기」: 날씨와 봄의 논에 따라 여는 대화가 갈린다', () => {
    const first = (draw: string, sow: string) => openingLines(pack, summer({ draw, flags: [sow, 'return.done'] }), Y.weed);
    expect(first('normal', 'sow.low')[0].text).toMatch(/한 뼘쯤/);
    expect(first('normal', 'sow.split')).toEqual(first('normal', 'sow.low'));
    expect(first('bumper', 'sow.low')[0].text).toMatch(/비가 알맞게/);
    expect(first('drought', 'sow.low')[0].text).toMatch(/낮은 논에 물이 차오르는데/);
    expect(first('drought', 'sow.low')[1]).toMatchObject({ who: 'mother', pose: 'worried' });
    expect(first('drought', 'sow.split')[0].text).toMatch(/높은 논에는 풀이 무성/);
    expect(first('drought', 'sow.split')[1].text).toMatch(/높은 논부터 매자/);
    // 어느 갈림이든 넷째 창에서 묻고, 벼와 풀이 섞여 난다는 것을 듣는다
    for (const lines of [first('normal', 'sow.low'), first('bumper', 'sow.low'), first('drought', 'sow.low'), first('drought', 'sow.split')]) {
      expect(lines).toHaveLength(4);
      expect(said(lines)).toMatch(/풀이 벼 사이에 섞여/);
      expect(lines[3].text).toBe('김매기는 여름 내내 이어진다. 어떻게 할까?');
    }
  });

  it('봄에 논갈이를 거들었으면 「김매기」에서 이웃 어른이 "갚을 차례"라고 한다', () => {
    const helped = summer({ flags: ['return.help', 'return.done', 'sow.low'] });
    for (const play of ['clean', 'rough', 'left']) {
      expect(deedOf(helped, `${Y.weed}/swap/${play}`).lines[1].text).toMatch(/봄에 네가 우리 논갈이를 거들었지.*갚을 차례/);
      expect(deedOf(summer(), `${Y.weed}/swap/${play}`).lines[1].text).toMatch(/여럿이 하니 금방/);
      // 수치는 같다(말이 달라질 뿐이다)
      expect(deedOf(helped, `${Y.weed}/swap/${play}`).requested).toEqual(deedOf(summer(), `${Y.weed}/swap/${play}`).requested);
    }
  });

  it('도움의 길: 기력이 바닥(1 이하)이면 세 길이 모두 잠기고, 이웃이 집으로 찾아와 거들어 준다(인심 -1)', () => {
    const worn = summer({ stats: { body: 1 } });
    expect(openIdsOf(worn)).toEqual(expect.arrayContaining([Y.weed, Y.weedHelp]));
    expect(choiceViews(pack, worn, Y.weed).every((v) => v.locked)).toBe(true);
    expect(() => doHappening(pack, worn, { id: Y.weed, choiceId: 'rest', play: 'left' })).toThrow(/잠긴 선택지/);
    // 쪽지의 화살표는 잠긴 논이 아니라 도움의 일이 있는 우리 집을 가리킨다
    expect(spotOfMission(worn, 's1395-m-weed')).toBe('home');
    expect(happeningOf(pack, Y.weedHelp).spot).toBe('home');
    const deed = deedOf(worn, Y.weedHelp);
    expect(deed.requested).toEqual(delta({ trust: -1 }));
    expect(deed.solved).toEqual(['s1395-m-weed']);
    expect(deed.sun).toBe(0);
    expect(said(deed.lines)).toMatch(/그때 갚아라/);
    // 봄에 그 집의 논갈이를 거들었으면 걸리는 것이 없다(봄에 낸 일손이 돌아온다)
    const repaid = deedOf(summer({ stats: { body: 0 }, flags: ['return.help', 'return.done', 'sow.low'] }), Y.weedHelp);
    expect(repaid.requested).toEqual(ZERO);
    expect(said(repaid.lines)).toMatch(/갚을 차례.*봄에 낸 일손/);
    expect(repaid.solved).toEqual(['s1395-m-weed']);
    // 기력이 2면 길이 열려 있어 도움의 일은 나타나지 않는다
    const tired = summer({ stats: { body: 2 } });
    expect(openIdsOf(tired)).not.toContain(Y.weedHelp);
    expect(spotOfMission(tired, 's1395-m-weed')).toBe('ourPaddy');
    expect(() => doHappening(pack, tired, { id: Y.weedHelp })).toThrow(/할 수 없는 일/);
    // 미션을 푼 뒤에는 기력이 바닥나도 나타나지 않는다
    const done = withStats(doAll(pack, summer(), [`${Y.weed}/rest/left`]), { body: 0 });
    expect(openIdsOf(done)).not.toContain(Y.weedHelp);
  });

  it('도움의 길은 실제로 걸어서 닿는다: 봄과 여름에 품을 다 들이면 우리 논을 맬 기운이 남지 않는다', () => {
    // ㉠ 봄에 논갈이를 거든 판(평소 같은 해): 기력 6 → 봄에 넷을 써서 2 → 여름에 이웃집 논을 거들어 1
    const springA = doAll(pack, newGame(pack, ROLE, look, seedFor('normal')), [`${ID.news}/help`, ID.help, `${ID.sow}/low/even`, `${ID.well}/carry`, `${ID.woods}/plenty`]);
    expect(springA.stats.body).toBe(2);
    const summerA = advance(pack, springA);
    expect(summerA.sunsLeft).toBe(2); // 기력이 2 이하라 해가 하나 준다
    expect(openIdsOf(summerA)).not.toContain(Y.weedHelp);
    expect(viewOf(summerA, Y.weed, 'all')?.locked).toBe(true); // 벌써 "온 식구가 매달려 맨다"는 잠겨 있다
    const afterA = doAll(pack, summerA, [Y.neighbor]);
    expect(afterA.stats.body).toBe(1);
    expect(openIdsOf(afterA)).toContain(Y.weedHelp);
    expect(deedOf(afterA, Y.weedHelp)).toMatchObject({ requested: ZERO, solved: ['s1395-m-weed'] });
    // ㉡ 봄에 우리 집 일부터 한 판(큰비가 온 해): 여름에 이웃집 논과 논둑 일을 하고 나면 기력 1 — 이번에는 인심이 걸린다
    const springB = doAll(pack, newGame(pack, ROLE, look, seedFor('drought')), [`${ID.news}/ours`, ID.ours, `${ID.sow}/low/patchy`, `${ID.well}/carry`, `${ID.woods}/plenty`]);
    const summerB = doAll(pack, advance(pack, springB), [Y.neighbor, `${Y.bank}/ours`]);
    expect(summerB.draw).toBe('drought');
    expect(summerB.stats.body).toBe(1);
    expect(openIdsOf(summerB)).toContain(Y.weedHelp);
    const deedB = deedOf(summerB, Y.weedHelp);
    expect(deedB.delta).toEqual(delta({ trust: -1 }));
    expect(deedB.solved).toEqual(['s1395-m-weed']);
  });

  it('여름의 덤: 한양에서 온 소식(카드), 이웃집 논(기력 -1·인심 +1), 큰비가 온 해에만 무너진 논둑', () => {
    expect(deedOf(summer(), Y.manor)).toMatchObject({ requested: ZERO, newCards: ['s1395-hanseong'], sun: 1 });
    expect(deedOf(summer(), Y.neighbor).requested).toEqual(delta({ body: -1, trust: 1 }));
    expect(openingLines(pack, summer({ flags: ['return.help'] }), Y.neighbor)[1].text).toMatch(/봄에 논갈이를 거들어 주더니 또 왔구나/);
    expect(openingLines(pack, summer(), Y.neighbor)[1].text).toMatch(/끝이 안 보이는구나/);
    // 논둑은 큰비가 온 해에만 나타난다
    for (const draw of drawValues('weather')) {
      expect(openIdsOf(summer({ draw })).includes(Y.bank), draw).toBe(draw === 'drought');
      expect(openIdsOf(summer({ draw })).filter((id) => happeningOf(pack, id).cost === 1)).toHaveLength(draw === 'drought' ? 3 : 2);
    }
    const rain = summer({ draw: 'drought' });
    expect(choiceViews(pack, rain, Y.bank).map((v) => [v.id, v.locked])).toEqual([
      ['ours', false],
      ['ditch', false],
    ]);
    // 우리 것 먼저냐 마을 것 먼저냐: 살림을 얻고 인심을 잃거나, 인심을 얻는다
    expect(deedOf(rain, `${Y.bank}/ours`).requested).toEqual(delta({ body: -1, living: 1, trust: -1 }));
    expect(deedOf(rain, `${Y.bank}/ditch`).requested).toEqual(delta({ body: -1, trust: 1 }));
    expect(said(deedOf(rain, `${Y.bank}/ours`).lines)).toMatch(/제 논이 급한 건 누구나 같지/);
    expect(() => doHappening(pack, summer({ draw: 'normal' }), { id: Y.bank, choiceId: 'ours' })).toThrow(/할 수 없는 일/);
  });

  it('여름의 첫 줄과 닫을 때: 날씨에 따라 바뀌고, 봄의 볍씨 선택이 날씨와 만난다(실제로 걸어서)', () => {
    expect(seasonLine(pack, summer())).toBe('오월, 볕이 뜨겁고 논에는 벼와 풀이 함께 자란다.');
    expect(seasonLine(pack, summer({ draw: 'drought' }))).toMatch(/비가 잦다/);
    expect(seasonLine(pack, summer({ draw: 'bumper' }))).toMatch(/비가 알맞게/);
    const want: Record<string, Record<string, number>> = { low: { drought: -3, normal: 1, bumper: 1 }, split: { drought: -1, normal: 0, bumper: 0 } };
    for (const weather of drawValues('weather')) {
      for (const sow of ['low', 'split']) {
        const spring = playMusts(pack, newGame(pack, ROLE, look, seedFor(weather)), [`${ID.news}/help`, `${ID.sow}/${sow}/left`]);
        const played = playMusts(pack, advance(pack, spring), [`${Y.dano}/play`, `${Y.weed}/all/left`]);
        expect(played.draw).toBe(weather);
        const closed = closeSeason(pack, played);
        expect(closed.stats.living - played.stats.living, `${weather}/${sow}`).toBe(want[sow][weather]);
        // 어느 판이든 봄의 볍씨 선택이 여름을 닫을 때 한 번은 다시 말해진다(나눠 뿌린 평소·알맞은 해는 수치 그대로)
        expect(lastClosing(closed)?.lines.length, `${weather}/${sow}`).toBe(1);
      }
    }
  });
});

describe.each(LOOKS)('① 가을 · 농민 집 아이(%s)', (look) => {
  const autumn = (over: Parameters<typeof seasonAt>[2] = {}) => seasonAt('autumn', look, over);
  /** 장정들이 떠난 뒤 / 아버지가 돌아온 뒤 / 가을걷이를 마친 뒤 */
  const gone = (over: Parameters<typeof seasonAt>[2] = {}, way: 'tend' | 'ours' = 'ours') =>
    autumn({ ...over, flags: [...(over.flags ?? ['return.done', 'sow.split']), `leave.${way}`, ...(way === 'tend' ? ['autumn.tended'] : [])], done: [Y.leave] });
  const back = (over: Parameters<typeof seasonAt>[2] = {}, way: 'tend' | 'ours' = 'ours') => {
    const state = gone(over, way);
    return { ...state, flags: [...state.flags, 'leave.back'], done: [Y.leave, Y.back], solved: [...state.solved, 's1395-m-leave'] };
  };
  const reaped = (over: Parameters<typeof seasonAt>[2] = {}, way: 'tend' | 'ours' = 'ours') => {
    const state = back(over, way);
    return { ...state, flags: [...state.flags, 'harvest.done', 'harvest.some'], done: [...state.done, Y.harvest] };
  };

  it('일의 차례가 해와 달을 따른다: 떠난다 → 돌아온다 → 가을걷이 → 소금. 도움의 일이 미리 뜨지 않는다', () => {
    // 가을의 처음: 꼭 할 일은 느티나무 아래의 일 하나, 덤은 관아에서 온 소식 하나
    for (const stats of [{}, FLOOR]) {
      const first = autumn({ stats });
      expect(openIdsOf(first).sort()).toEqual([Y.leave, Y.office].sort());
      expect(spotOfMission(first, 's1395-m-leave')).toBe('tree');
      expect(spotOfMission(first, 's1395-m-harvest')).toBeUndefined(); // 가을걷이의 자리는 아직 없다
      expect(missingMusts(pack, first).map((m) => m.id)).toEqual(['s1395-m-leave', 's1395-m-harvest']);
    }
    // 떠난 뒤: 집에서 아버지를 맞는 일과 길목의 배웅이 나타난다
    const left = doAll(pack, autumn(), [`${Y.leave}/ours`]);
    expect(left.solved).not.toContain('s1395-m-leave');
    expect(openIdsOf(left).sort()).toEqual([Y.back, Y.sendoff, Y.office].sort());
    expect(spotOfMission(left, 's1395-m-leave')).toBe('home');
    // 돌아온 뒤: 배웅은 사라지고, 타작 마당의 가을걷이와 느티나무 그늘의 한양 이야기가 나타난다
    const home = doAll(pack, left, [Y.back]);
    expect(lastDeed(home)?.solved).toEqual(['s1395-m-leave']);
    expect(openIdsOf(home).sort()).toEqual([Y.harvest, Y.office, Y.taleAutumn].sort());
    expect(spotOfMission(home, 's1395-m-harvest')).toBe('threshing');
    // 가을걷이 뒤: 고갯마루의 소금
    const reapedNow = doAll(pack, home, [`${Y.harvest}//all`]);
    expect(lastDeed(reapedNow)?.solved).toEqual([]);
    expect(openIdsOf(reapedNow).sort()).toEqual([Y.salt, Y.office, Y.taleAutumn].sort());
    expect(spotOfMission(reapedNow, 's1395-m-harvest')).toBe('passTop');
    const done = doAll(pack, reapedNow, [`${Y.salt}/ours/exact`]);
    expect(lastDeed(done)?.solved).toEqual(['s1395-m-harvest']);
    expect(canCloseSeason(pack, done)).toBe(true);
  });

  it(`「한양으로 떠난 장정들」: ${look === 'boy' ? '"내년이면 나도 열여섯이다"가 붙는다' : '열여섯 이야기는 붙지 않는다'}. 큰비가 온 해에는 이웃 어른의 말이 바뀐다`, () => {
    const lines = openingLines(pack, autumn(), Y.leave);
    expect(lines).toHaveLength(look === 'boy' ? 5 : 4);
    expect(said(lines).includes('내년이면 나도 열여섯이다')).toBe(look === 'boy');
    expect(lines[0].text).toMatch(/팔월.*장정들이 모였다.*아버지도/);
    expect(lines[lines.length - 1].text).toMatch(/논을 어떻게 지킬까/);
    const rain = openingLines(pack, autumn({ draw: 'drought' }), Y.leave);
    expect(rain).toHaveLength(lines.length);
    expect(said(rain)).toMatch(/큰비에 쓰러진 벼/);
    expect(said(lines)).toMatch(/익어 가는 벼/);
    expect(said(rain).includes('내년이면 나도 열여섯이다')).toBe(look === 'boy');
    expect(seasonLine(pack, autumn())).toMatch(/팔월.*장정들이 한양으로 떠난다/);
    expect(seasonLine(pack, autumn({ draw: 'drought' }))).toMatch(/큰비가 지나간 들/);
  });

  it('「한양으로 떠난 장정들」: 떠난 집 논까지 돌보면 기력 -2·인심 +1(기력 2 이하면 잠김), 우리 논부터 지키면 살림 +1·인심 -1', () => {
    for (let body = 0; body <= 10; body++) {
      const tend = viewOf(autumn({ stats: { body } }), Y.leave, 'tend');
      expect(tend?.locked, `기력 ${body}`).toBe(body <= 2);
      expect(tend?.reason, `기력 ${body}`).toBe(body <= 2 ? '두 집 논을 오갈 기운이 남아 있지 않아요' : undefined);
      expect(viewOf(autumn({ stats: { body } }), Y.leave, 'ours')?.locked).toBe(false);
    }
    const tend = deedOf(autumn(), `${Y.leave}/tend`);
    expect(tend.requested).toEqual(delta({ body: -2, trust: 1 }));
    expect(tend.newFlags.sort()).toEqual(['autumn.tended', 'leave.tend']);
    expect(tend.solved).toEqual([]);
    const ours = deedOf(autumn(), `${Y.leave}/ours`);
    expect(ours.requested).toEqual(delta({ living: 1, trust: -1 }));
    expect(ours.newFlags).toEqual(['leave.ours']);
    expect(said(ours.lines)).not.toMatch(/게으|못된|혼|꾸짖|나무라/);
    // 봄에 논갈이를 거들었으면 이웃 어른이 알아본다
    expect(deedOf(autumn({ flags: ['return.help'] }), `${Y.leave}/tend`).lines[0].text).toMatch(/봄에도 네 덕을 봤는데/);
    expect(tend.lines[0].text).toMatch(/우리 논까지 봐 주겠다니/);
  });

  it('구월 보름, 돌아온 아버지: 종묘 이야기를 듣고 미션이 풀린다. 내가 고른 것에 따라 아버지의 말이 다르다', () => {
    for (const way of ['tend', 'ours'] as const) {
      const state = gone({}, way);
      expect(said(openingLines(pack, state, Y.back))).toMatch(/구월 보름이 지나 아버지가 돌아오셨다.*종묘도 함께 지었고/);
      expect(said(openingLines(pack, state, Y.back))).not.toMatch(/먼저/); // 실록은 종묘와 궁궐을 함께 지었다고 적는다(review 1-라 5번)
      const deed = deedOf(state, Y.back);
      expect(deed.requested).toEqual(ZERO);
      expect(deed.newCards).toEqual(['s1395-jongmyo']);
      expect(deed.newFlags).toEqual(['leave.back']);
      expect(deed.solved).toEqual(['s1395-m-leave']);
      expect(deed.note).toBe('구월 보름(15일), 나라는 가을걷이를 하라고 농민들을 집으로 돌려보냈어요.'); // spec 6.3의 기준 문장에 날짜 풀이를 붙였다
      expect(deed.lines[0].text).toMatch(way === 'tend' ? /이웃 논까지 돌봤다지/ : /우리 논은 네가 잘 지켰구나/);
    }
    // 큰비가 온 해에는 아버지가 "벼가 잘 여물었다"고 하지 않는다. 봄의 논에 따라 말이 갈린다(review 1-라 1번)
    const rained = (sow: string) => deedOf(gone({ draw: 'drought', flags: ['return.done', sow] }), Y.back);
    expect(rained('sow.low').lines[0]).toMatchObject({ who: 'father', text: '낮은 논은 큰물에 쓸렸다지. 그래도 남은 벼를 네가 잘 지켰구나.' });
    expect(rained('sow.split').lines[0]).toMatchObject({ who: 'father', text: '큰비에도 높은 논의 벼는 남았구나. 네가 잘 지켰다.' });
    for (const sow of ['sow.low', 'sow.split']) {
      expect(said(rained(sow).lines), sow).not.toMatch(/잘 여물었다/);
      expect(rained(sow)).toMatchObject({ requested: ZERO, newCards: ['s1395-jongmyo'], solved: ['s1395-m-leave'] });
    }
    // 떠난 집 논까지 돌봤으면 큰비가 온 해에도 그 말이 먼저다
    expect(deedOf(gone({ draw: 'drought', flags: ['return.done', 'sow.low'] }, 'tend'), Y.back).lines[0].text).toMatch(/이웃 논까지 돌봤다지/);
    // 떠난 집 논까지 돌봤으면 가을을 닫을 때 돌아온 이웃이 거들어 기력 +1
    const tended = playMusts(pack, autumn({ stats: { body: 6 } }), [`${Y.leave}/tend`, `${Y.harvest}//left`, `${Y.salt}/ours/left`]);
    const closing = lastClosing(closeSeason(pack, tended)) as Closing;
    expect(closing.lines).toEqual(['한양에서 돌아온 이웃이 우리 집 가을걷이를 거들어 주었다.']);
    expect(closing.after.body - tended.stats.body).toBe(1);
    const alone = playMusts(pack, autumn(), [`${Y.leave}/ours`, `${Y.harvest}//left`, `${Y.salt}/ours/left`]);
    expect(lastClosing(closeSeason(pack, alone))?.lines).toEqual([]);
  });

  it('「가을걷이와 나라 몫」: 놀이가 끝난 모습과 날씨, 봄의 논에 따른 수치 — 큰비가 온 해에는 거둔 것이 적고 나라 몫을 내지 않는다', () => {
    const want: [string, string, Record<string, Partial<Stats>>][] = [
      ['normal', 'sow.low', { all: { body: -1, living: 3 }, some: { body: -1, living: 2 }, left: { body: -1, living: 2 } }],
      ['bumper', 'sow.split', { all: { body: -1, living: 3 }, some: { body: -1, living: 2 }, left: { body: -1, living: 2 } }],
      // 큰비가 온 해: 낮은 논이 쓸려 간 것은 여름을 닫을 때(-3) 이미 셈했다. 가을걷이에서는 두 논이 같다(쓸리고 남은 벼를 거둔다)
      ['drought', 'sow.split', { all: { body: -1, living: 2 }, some: { body: -1, living: 1 }, left: { body: -1, living: 1 } }],
      ['drought', 'sow.low', { all: { body: -1, living: 2 }, some: { body: -1, living: 1 }, left: { body: -1, living: 1 } }],
    ];
    for (const [draw, sow, row] of want) {
      const state = back({ draw, flags: ['return.done', sow] });
      const deeds = Object.entries(row).map(([play, change]) => {
        const deed = deedOf(state, `${Y.harvest}//${play}`);
        expect(deed.requested, `${draw}/${sow}/${play}`).toEqual(delta(change));
        expect(deed.newCards).toEqual(['s1395-state-share']);
        expect(deed.newFlags.sort()).toEqual(['harvest.done', `harvest.${play}`].sort());
        expect(deed.solved).toEqual([]); // 소금까지 구해야 풀린다
        // 둘째 창과 쪽지가 그해의 나라 몫을 말한다
        if (draw === 'drought') {
          expect(deed.lines[1].text).toMatch(/덜어 낼 나라 몫이 없다/);
          expect(deed.note).toBe('큰물이 난 고을에는 나라가 그해에 낼 곡식을 받지 않기도 했어요.');
        } else {
          expect(deed.lines[1].text).toMatch(/열 자루에서 한 자루를 나라 몫으로/);
          expect(deed.note).toBe('농민은 거둔 곡식의 열에 하나쯤을 나라 몫으로 냈어요.');
        }
        return deed;
      });
      expect(playEndProblems(Object.fromEntries(Object.keys(row).map((play, i) => [play, deeds[i].requested])), 'some'), `${draw}/${sow}`).toEqual([]);
      // 이삭을 남겼을 때: 큰비가 온 해에는 "새들도 먹고살아야지"가 아니라 아버지가 마저 줍는다(어머니가 "이삭 하나도 흘리지 말아요"라 했다 — review 5.2)
      const some = deeds[1];
      expect(some.lines[0].text, `${draw}/${sow}`).toBe(draw === 'drought' ? '이삭이 좀 남았구나. 남은 것은 내가 마저 주우마.' : '이삭이 좀 남았구나. 괜찮다, 새들도 먹고살아야지.');
      expect(deeds[2].lines[0].text).toBe('그래, 낫은 내가 잡으마. 하려던 일은 미루고. 너는 볏단을 날라라.');
    }
    // 여는 대화도 날씨와 봄의 논에 따라 갈린다
    const first = (draw: string, sow: string) => openingLines(pack, back({ draw, flags: ['return.done', sow] }), Y.harvest);
    expect(first('normal', 'sow.low')[1].text).toMatch(/열에 하나쯤은 나라 몫/);
    // 놀이가 벼 베기부터라 여는 대화도 벼를 베기 앞에서 시작한다
    expect(first('normal', 'sow.low')[0].text).toMatch(/벼가 누렇게 익었다. 오늘 벼를 베어/);
    expect(first('bumper', 'sow.low')[0].text).toMatch(/낟알이 굵다/);
    expect(first('drought', 'sow.low')[0].text).toMatch(/벨 벼가 지난해의 반도 안 된다.*낮은 논의 벼가 큰비에 쓸려/);
    expect(first('drought', 'sow.split')[0].text).toMatch(/큰비에도 높은 논의 벼는 남았다/);
    for (const sow of ['sow.low', 'sow.split']) expect(first('drought', sow)[1].text).toMatch(/올해 몫은 받지 않는단다/);
  });

  it('고갯마루의 소금: 우리 집 쓸 만큼은 살림 1 이하에서, 이웃 몫까지는 살림 3 이하에서 잠긴다. 넉넉히 얹어 주면 살림 -1·인심 +1 더', () => {
    for (let living = 0; living <= 10; living++) {
      const state = reaped({ stats: { living } });
      expect(viewOf(state, Y.salt, 'ours')?.locked, `살림 ${living}`).toBe(living <= 1);
      expect(viewOf(state, Y.salt, 'share')?.locked, `살림 ${living}`).toBe(living <= 3);
    }
    expect(choiceViews(pack, reaped({ stats: { living: 0 } }), Y.salt).map((v) => v.reason)).toEqual(['소금과 바꿀 쌀과 베가 모자라요', '넉넉히 바꿀 만큼은 쌀과 베가 없어요']);
    const want: Record<string, Record<string, Partial<Stats>>> = {
      ours: { exact: { living: -1 }, generous: { living: -2, trust: 1 }, left: { living: -1 } },
      share: { exact: { living: -2, trust: 1 }, generous: { living: -3, trust: 2 }, left: { living: -2, trust: 1 } },
    };
    for (const [choiceId, row] of Object.entries(want)) {
      for (const [play, change] of Object.entries(row)) {
        const deed = deedOf(reaped({ stats: { living: 6 } }), `${Y.salt}/${choiceId}/${play}`);
        expect(deed.requested, `${choiceId}/${play}`).toEqual(delta(change));
        expect(deed.newCards).toEqual(['s1395-rice-cloth']);
        expect(deed.newItems).toEqual(['s1395-salt']);
        expect(deed.solved).toEqual(['s1395-m-harvest']);
        expect(deed.lines[0].who).toBe(play === 'left' ? 'mother' : 'pass-villager');
      }
    }
    // "소금 장수"라고 하지 않는다(확인하지 못했다 — spec 12.3). 쪽지와 카드에는 소금이 없다.
    const salt = happeningOf(pack, Y.salt);
    for (const text of textsOf(salt)) expect(text).not.toMatch(/장수|장사꾼|엽전|냥/);
    expect(salt.note).not.toMatch(/소금/);
    expect(bundle.cards.filter((card) => card.situation === 's1395').every((card) => !/소금/.test(card.text))).toBe(true);
  });

  it('도움의 길: 소금과 바꿀 것이 없으면(살림 1 이하) 우물가에서 이웃이 나눠 준다 — 그 집 일을 거들어 갚는다(기력 -1)', () => {
    const poor = reaped({ stats: { living: 1 } });
    expect(choiceViews(pack, poor, Y.salt).every((v) => v.locked)).toBe(true);
    expect(openIdsOf(poor)).toEqual(expect.arrayContaining([Y.salt, Y.saltHelp]));
    expect(spotOfMission(poor, 's1395-m-harvest')).toBe('well');
    const deed = deedOf(poor, Y.saltHelp);
    expect(deed.requested).toEqual(delta({ body: -1 }));
    expect(deed.newItems).toEqual(['s1395-salt']);
    expect(deed.newCards).toEqual(['s1395-rice-cloth']);
    expect(deed.solved).toEqual(['s1395-m-harvest']);
    // 봄에 논갈이를 거들었거나 가을에 떠난 집 논을 돌봤으면 갚을 것이 없다
    const spring = deedOf(reaped({ stats: { living: 0 }, flags: ['return.help', 'return.done', 'sow.low'] }), Y.saltHelp);
    expect(spring.requested).toEqual(ZERO);
    expect(said(spring.lines)).toMatch(/갚을 생각은 말아라.*봄에 낸 일손/);
    const tended = deedOf(reaped({ stats: { living: 0 } }, 'tend'), Y.saltHelp);
    expect(tended.requested).toEqual(ZERO);
    expect(said(tended.lines)).toMatch(/갚을 생각은 말아라.*가을에 낸 일손/);
    for (const one of [spring, tended]) expect(one).toMatchObject({ newItems: ['s1395-salt'], solved: ['s1395-m-harvest'] });
    // 살림이 2면 길이 열려 있어 도움의 일은 나타나지 않는다
    expect(openIdsOf(reaped({ stats: { living: 2 } }))).not.toContain(Y.saltHelp);
    expect(spotOfMission(reaped({ stats: { living: 2 } }), 's1395-m-harvest')).toBe('passTop');
  });

  it('도움의 길은 실제로 걸어서 닿는다: 낮은 논에 몰아 뿌린 해에 큰비가 오면 가을에 소금과 바꿀 것이 없다', () => {
    const spring = doAll(pack, newGame(pack, ROLE, look, seedFor('drought')), [`${ID.news}/give`, ID.monks, `${ID.sow}/low/left`]);
    expect(spring.stats.living).toBe(3);
    const summer = doAll(pack, advance(pack, spring), [`${Y.dano}/play`, `${Y.weed}/rest/rough`]);
    expect(summer.stats.living).toBe(2);
    const closed = closeSeason(pack, summer);
    expect(lastClosing(closed)?.lines[0]).toMatch(/큰비에 냇가 낮은 논이 물에 잠겼다/);
    expect(closed.stats.living).toBe(0);
    // 가을: 떠난 집 논까지 돌보고(살림 그대로), 가을걷이는 이삭을 남긴다(큰비 — 살림 +1). 우리 논부터 지키면(살림 +1) 소금은 바꿀 수 있다
    const autumnNow = doAll(pack, nextSeason(pack, closed), [`${Y.leave}/tend`, Y.back, `${Y.harvest}//some`]);
    expect(autumnNow.stats.living).toBe(1);
    expect(choiceViews(pack, autumnNow, Y.salt).map((v) => v.locked)).toEqual([true, true]);
    expect(openIdsOf(autumnNow)).toContain(Y.saltHelp);
    const helped = doAll(pack, autumnNow, [Y.saltHelp]);
    // 떠난 집 논을 돌봐 준 것을 이웃이 잊지 않았다 — 갚을 것이 없다
    expect(lastDeed(helped)).toMatchObject({ delta: ZERO, solved: ['s1395-m-harvest'] });
    expect(said(lastDeed(helped)!.lines)).toMatch(/가을에 낸 일손이 이렇게 돌아왔다/);
    // 가을을 닫을 때 큰물이 난 고을에 나라가 곡식을 내리고(살림 +1), 돌아온 이웃이 가을걷이를 거든다(기력 +1)
    const autumnClosed = closeSeason(pack, helped);
    expect(lastClosing(autumnClosed)?.lines).toEqual(['큰물이 난 고을에 나라가 먹을 곡식을 내려 주었다.', '한양에서 돌아온 이웃이 우리 집 가을걷이를 거들어 주었다.']);
    expect(autumnClosed.stats.living).toBe(2);
    // 우리 논부터 지켰으면 소금과 바꿀 것이 남는다(살림 2)
    expect(doAll(pack, nextSeason(pack, closed), [`${Y.leave}/ours`, Y.back, `${Y.harvest}//left`]).stats.living).toBe(2);
  });

  it('가을의 덤: 배웅(카드), 관아에서 온 소식(안내하면 기력 -1·인심 +1), 돌아온 이웃의 한양 이야기(기력 +1, 덤 미션의 가을 몫)', () => {
    expect(deedOf(gone(), Y.sendoff)).toMatchObject({ requested: ZERO, newCards: ['s1395-fifteen-thousand'], sun: 1 });
    expect(said(openingLines(pack, gone(), Y.sendoff))).toMatch(/만 오천 명/); // 4,500 + 5,000 + 5,500 (F35)
    expect(deedOf(autumn(), `${Y.office}/guide`).requested).toEqual(delta({ body: -1, trust: 1 }));
    expect(deedOf(autumn(), `${Y.office}/tell`).requested).toEqual(ZERO);
    for (const choiceId of ['guide', 'tell']) expect(deedOf(autumn(), `${Y.office}/${choiceId}`).newCards).toEqual(['s1395-elder-rice']);
    const tale = deedOf(back(), Y.taleAutumn);
    expect(tale.requested).toEqual(delta({ body: 1 }));
    expect(tale.newFlags).toEqual(['tale.autumn']);
    expect(tale.missionId).toBe('s1395-m-tales');
    expect(tale.solved).toEqual([]);
    expect(said(openingLines(pack, back(), Y.taleAutumn))).toMatch(/사직단.*땅의 신과 곡식의 신/);
    // 한 해 내내 큰길의 소식은 떠나기 전에도 뒤에도 들을 수 있다
    for (const state of [autumn(), gone(), back(), reaped()]) expect(openIdsOf(state)).toContain(Y.office);
  });
});

describe.each(LOOKS)('① 겨울 · 농민 집 아이(%s)', (look) => {
  const winter = (over: Parameters<typeof seasonAt>[2] = {}) => seasonAt('winter', look, over);
  const lettersId = look === 'boy' ? Y.letters : Y.lettersGirl;
  const learnId = look === 'boy' ? 'attend' : 'learn';

  it('겨울의 처음: 꼭 할 일은 우리 집의 제삿날과, 모습에 맞는 자리의 글공부. 첫 줄은 경복궁 소식이다', () => {
    const first = winter();
    expect(seasonLine(pack, first)).toBe('시월, 새 궁궐에 경복궁이라는 이름이 붙었다는 소식이 온다.'); // spec 6.3
    expect(openIdsOf(first).filter((id) => happeningOf(pack, id).cost === 0).sort()).toEqual([Y.rite, lettersId].sort());
    expect(openIdsOf(first).filter((id) => happeningOf(pack, id).cost === 1).sort()).toEqual([Y.taleWinter, Y.share].sort());
    expect(spotOfMission(first, 's1395-m-rite')).toBe('home');
    expect(spotOfMission(first, 's1395-m-letters')).toBe(look === 'boy' ? 'hyanggyoRoad' : 'tree');
    // 인심이 8 이상이면 마을 어르신의 이야기가 열린다
    for (let trust = 0; trust <= 10; trust++) expect(openIdsOf(winter({ stats: { trust } })).includes(Y.elder), `인심 ${trust}`).toBe(trust >= 8);
  });

  it('「할아버지의 제삿날」: 절에 가는 길은 살림 1 이하에서 잠긴다(1에서 잠기고 2에서 열린다). 집에서 작게 차리는 길은 언제나 열려 있다', () => {
    for (let living = 0; living <= 10; living++) {
      const views = choiceViews(pack, winter({ stats: { living } }), Y.rite);
      expect(views.map((v) => v.id)).toEqual(['temple', 'home']);
      expect(views[0].locked, `살림 ${living}`).toBe(living <= 1);
      expect(views[0].reason, `살림 ${living}`).toBe(living <= 1 ? '절에 가져갈 쌀이 없어요' : undefined); // spec 6.3의 기준 문장
      expect(views[1].locked).toBe(false);
    }
    expect(choiceViews(pack, winter(), Y.rite).map((v) => v.label)).toEqual(['절에 가서 지낸다', '집에서 작게 상을 차린다']);
    // "조촐하게"는 5학년이 모를 말이라 "작게"로 썼다(review 1-라 31번). 어머니의 말도 같다
    expect(said(openingLines(pack, winter(), Y.rite))).toMatch(/집에서 작게 상을 차려도 돼요/);
    expect(said(openingLines(pack, winter(), Y.rite))).not.toMatch(/조촐/);
    // 농민 집에는 "집 안에 사당 자리를 마련한다"가 보이지 않는다(양반 집에만 — 아직 만들지 않았다)
    expect(said(choiceViews(pack, winter(), Y.rite).map((v) => ({ text: v.label })))).not.toMatch(/사당/);
  });

  it('「할아버지의 제삿날」: 집에서 지내면 살림 -1·기력 +1. 살림이 바닥이면 글이 갈리고 변화가 없다', () => {
    const home = deedOf(winter(), `${Y.rite}/home`);
    expect(home.requested).toEqual(delta({ living: -1, body: 1 }));
    expect(home.solved).toEqual(['s1395-m-rite']);
    expect(home.goTo).toBeUndefined();
    for (const living of [0, 1]) {
      const poor = winter({ stats: { living } });
      expect(said(openingLines(pack, poor, Y.rite))).toMatch(/쌀독은 바닥이 보인다.*물 한 그릇이라도/);
      const deed = deedOf(poor, `${Y.rite}/home`);
      expect(deed.requested).toEqual(ZERO);
      expect(said(deed.lines)).toMatch(/물 한 그릇과 묵은 나물/);
      expect(deed.solved).toEqual(['s1395-m-rite']);
    }
    expect(said(openingLines(pack, winter({ stats: { living: 2 } }), Y.rite))).toMatch(/절에 가서 스님과 함께 지내 왔단다/);
  });

  it('「할아버지의 제삿날」: 절에 가면 살림 -2·기력 +2. 봄에 스님들께 곡식을 보탰으면 스님이 알아보고 살림 -1(그 대신 절 마당의 눈을 쓴다)', () => {
    const chose = doAll(pack, winter(), [`${Y.rite}/temple`]);
    expect(lastDeed(chose)).toMatchObject({ requested: ZERO, solved: [], goTo: 'temple', newFlags: ['rite.temple'] });
    expect(chose.goTo).toBe('temple');
    expect(spotOfMission(chose, 's1395-m-rite')).toBe('temple');
    expect(openIdsOf(chose)).toContain(Y.riteTemple);
    const deed = deedOf(chose, Y.riteTemple);
    expect(deed.requested).toEqual(delta({ living: -2, body: 2 }));
    expect(deed.newCards).toEqual(['s1395-temple-rite']);
    expect(deed.solved).toEqual(['s1395-m-rite']);
    expect(said(openingLines(pack, chose, Y.riteTemple))).toMatch(/궁궐 일을 마친 스님이 돌아와 계신다/);
    const gave = doAll(pack, winter({ flags: ['return.give', 'return.done', 'sow.low'] }), [`${Y.rite}/temple`]);
    expect(openingLines(pack, gave, Y.riteTemple)[1]).toMatchObject({ who: 'monk', pose: 'glad' });
    expect(openingLines(pack, gave, Y.riteTemple)[1].text).toMatch(/봄에 곡식을 보태 준 아이로구나/);
    expect(deedOf(gave, Y.riteTemple).requested).toEqual(delta({ living: -1 }));
    expect(said(deedOf(gave, Y.riteTemple).lines)).toMatch(/봄에 받은 것이 있지 않느냐.*절 마당의 눈을 쓸었다/);
    expect(deedOf(gave, Y.riteTemple).lines).toHaveLength(3);
    // 그 판에서도 절에 가는 길이 집에서 지내는 길보다 모든 면에서 낫지 않다(집: 살림 -1·기력 +1 / 절: 살림 -1·카드 — review 1-라 14번)
    const gaveHome = deedOf(winter({ flags: ['return.give', 'return.done', 'sow.low'] }), `${Y.rite}/home`).requested;
    const gaveTemple = deedOf(gave, Y.riteTemple).requested;
    expect(STATS.every((stat) => gaveTemple[stat] >= gaveHome[stat])).toBe(false);
    expect(STATS.every((stat) => gaveHome[stat] >= gaveTemple[stat])).toBe(true); // 집이 수치로는 같거나 낫고, 절은 카드 「절에서 지낸 제사」를 남긴다
    expect(deedOf(gave, Y.riteTemple).newCards).toEqual(['s1395-temple-rite']);
    // 둘째 창이 첫 창의 "뒷산 절로 가자"를 되풀이하지 않는다(review 5.2)
    expect(lastDeed(chose)?.lines.map((line) => line.text)).toEqual([expect.stringMatching(/뒷산 절로 가자/), '쌀 자루를 메고 할머니 손을 잡았다. 눈길을 밟아 뒷산 절로 오른다.']);
    // 새 예절을 따르지 않아도 인심이 깎이지 않는다(예법의 무게 0 — spec 5.2의 9번): 제삿날의 어느 길도 인심을 바꾸지 않는다
    for (const id of [Y.rite, Y.riteTemple]) for (const outcome of outcomesOf(happeningOf(pack, id))) expect(outcome.effects?.trust ?? 0, id).toBe(0);
  });

  it(`「겨울 글공부」: ${look === 'boy' ? '향교 가는 길로 가서 선생께 여쭌다' : '향교 가는 길이 막혀 있어, 마을 어귀에서 향교에 다니는 동무에게 묻는다'}`, () => {
    const first = winter();
    const other = look === 'boy' ? Y.lettersGirl : Y.letters;
    expect(openIdsOf(first)).toContain(lettersId);
    expect(openIdsOf(first)).not.toContain(other);
    expect(() => doHappening(pack, first, { id: other, choiceId: 'ask' })).toThrow(/할 수 없는 일/);
    const h = happeningOf(pack, lettersId);
    expect(h.shows).toEqual({ look });
    expect(h.spot).toBe(look === 'boy' ? 'hyanggyoRoad' : 'tree');
    expect(h.stage.place).toBe(look === 'boy' ? 'hyanggyo' : 'entrance');
    expect((h.stage.cast ?? []).map((one) => one.who)).toEqual(look === 'boy' ? ['teacher', 'student'] : ['student']);
    const opening = said(openingLines(pack, first, lettersId));
    if (look === 'boy') {
      expect(opening).toMatch(/담 너머로 글 읽는 소리.*열여섯이 안 돼도.*농사짓는 집 아들도/);
      expect(h.note).toBe('새 나라는 농민의 아들도 원하면 고을의 향교에서 배울 수 있게 했어요.');
    } else {
      expect(opening).toMatch(/향교 가는 길은 내게 막혀 있다.*향교는 남자만 다녀/);
      expect(h.note).toBe('향교의 학생은 모두 남자였어요. 여자는 향교에 다닐 수 없었어요.');
    }
    // 향교에 서 있는 사람은 모두 남자다(향교는 남자만 다녔다 — F11)
    for (const who of ['teacher', 'student']) expect(pack.situation.people[who].sex).toBe('m');
  });

  it('「겨울 글공부」: 두 모습의 수치와 잠김이 같다 — 겨울 동안 배우면 살림 -1·기력 -1(살림 1 이하면 잠김), 몇 자만 물으면 그대로', () => {
    expect(choiceViews(pack, winter(), lettersId).map((v) => v.id)).toEqual([learnId, 'ask']);
    for (let living = 0; living <= 10; living++) {
      const views = choiceViews(pack, winter({ stats: { living } }), lettersId);
      expect(views[0].locked, `살림 ${living}`).toBe(living <= 1);
      expect(views[0].reason, `살림 ${living}`).toBe(living <= 1 ? '일손을 뺄 만큼 집 형편이 넉넉하지 않아요' : undefined);
      expect(views[1].locked).toBe(false);
    }
    const learned = deedOf(winter(), `${lettersId}/${learnId}`);
    expect(learned.requested).toEqual(delta({ living: -1, body: -1 }));
    expect(learned.newFlags.sort()).toEqual(['letters.done', 'letters.learned']);
    const asked = deedOf(winter(), `${lettersId}/ask`);
    expect(asked.requested).toEqual(ZERO);
    expect(asked.newFlags).toEqual(['letters.done']);
    for (const deed of [learned, asked]) {
      expect(deed.newCards).toEqual(['s1395-hyanggyo']);
      expect(deed.solved).toEqual(['s1395-m-letters']);
      // ②의 "새 글자"가 살도록 ①에서 배운 것이 한자라는 것을 밝힌다(review 5.2)
      expect(said(deed.lines)).toMatch(/한자 ‘하늘 천’.*‘땅 지’|‘하늘 천’은 이렇게, ‘땅 지’는/);
      expect(said(deed.lines)).not.toMatch(/곱아/);
    }
    // 글자를 익힌 한 해는 한 해 이름에 닿는다
    const facts = { role: ROLE, look, stats: { living: 4, body: 4, trust: 5 }, flags: ['letters.learned'], draw: 'normal', items: [] };
    expect(pack.situation.endings.find((ending) => ending.id === 's1395-letters')?.when).toEqual({ flags: ['letters.learned'] });
    expect(facts.flags).toContain(learned.newFlags.find((flag) => flag === 'letters.learned'));
  });

  it('겨울의 덤: 베 짜기는 제삿날 일을 정한 뒤에 나타나고, 한 필을 다 짜면 기력 -1·살림 +1과 「내가 짠 베」', () => {
    expect(openIdsOf(winter())).not.toContain(Y.weave);
    const atHome = doAll(pack, winter(), [`${Y.rite}/home`]);
    const toTemple = doAll(pack, winter(), [`${Y.rite}/temple`]);
    for (const state of [atHome, toTemple]) expect(openIdsOf(state)).toContain(Y.weave);
    const want: Record<string, [Partial<Stats>, string[]]> = { bolt: [{ body: -1, living: 1 }, ['s1395-my-cloth']], half: [{}, []], left: [{}, []] };
    const deeds = Object.entries(want).map(([play, [change, items]]) => {
      const deed = deedOf(atHome, `${Y.weave}//${play}`);
      expect(deed.requested, play).toEqual(delta(change));
      expect(deed.newItems, play).toEqual(items);
      expect(deed.newCards, play).toEqual(['s1395-cloth-bolt']); // 어느 모습으로 끝나도 남는 것이 있다
      expect(deed.sun).toBe(1);
      return deed;
    });
    expect(new Set(deeds.map((d) => said(d.lines))).size).toBe(3);
    // 맡기면 수치는 "반 필"과 같고, 어머니의 다른 일이 밀린다는 것은 말로만 치른다(review 1-라 10번)
    expect(playEndProblems({ bolt: deeds[0].requested, half: deeds[1].requested, left: deeds[2].requested }, 'half')).toEqual([]);
    expect(said(deeds[2].lines)).toMatch(/어머니가 하려던 다른 일은 내일로 밀렸다/);
    expect(deeds[1].lines[1].text).toBe('몇 뼘 짜는 데도 한참이 걸렸다. 어머니의 겨울이 길 만하다.');
  });

  it('겨울의 덤: 새 궁궐의 이름(카드 「경복궁」) — 봄·가을의 이야기까지 들었으면 덤 미션이 풀리고 카드 「새 나라 조선」', () => {
    const one = deedOf(winter(), Y.taleWinter);
    expect(one.requested).toEqual(ZERO);
    expect(one.newCards).toEqual(['s1395-gyeongbokgung']);
    expect(one.newFlags).toEqual(['tale.winter']);
    expect(one.solved).toEqual([]);
    for (const flags of [['tale.spring'], ['tale.autumn']]) expect(deedOf(winter({ flags }), Y.taleWinter).solved).toEqual([]);
    const all = deedOf(winter({ flags: ['tale.spring', 'tale.autumn'] }), Y.taleWinter);
    expect(all.newCards).toEqual(['s1395-gyeongbokgung', 's1395-new-joseon']);
    expect(all.solved).toEqual(['s1395-m-tales']);
    expect(said(all.lines)).toMatch(/새 나라 이야기 셋이 다 모였다/);
    expect(said(openingLines(pack, winter(), Y.taleWinter))).toMatch(/경복궁.*큰 복을 누리라는 뜻/);
    const tales = pack.missions.find((m) => m.id === 's1395-m-tales') as Mission;
    expect(missionProgress(tales, winter({ flags: ['tale.spring', 'tale.autumn'] }))).toEqual({ have: 2, need: 3 });
  });

  it('겨울의 덤: 곡식이 떨어진 옆집(곡식을 나누면 살림 -1·인심 +1, 땔나무를 해다 주면 기력 -1·인심 +1), 마을 어르신(기력 +1, 카드)', () => {
    for (let living = 0; living <= 10; living++) {
      const views = choiceViews(pack, winter({ stats: { living } }), Y.share);
      expect(views.map((v) => [v.id, v.locked]), `살림 ${living}`).toEqual([
        ['grain', living <= 1],
        ['wood', false],
      ]);
    }
    expect(viewOf(winter({ stats: { living: 1 } }), Y.share, 'grain')?.reason).toBe('나눌 곡식이 우리 집에도 없어요');
    expect(deedOf(winter(), `${Y.share}/grain`).requested).toEqual(delta({ living: -1, trust: 1 }));
    expect(deedOf(winter(), `${Y.share}/wood`).requested).toEqual(delta({ body: -1, trust: 1 }));
    // 옆집은 우리 집 마당이 아니다(자리 neighbor — 그림 bg/s1395/neighbor-winter). 동무는 내내 걱정하는 얼굴이고 손에 든 것이 없다(review 1-라 7번)
    const share = happeningOf(pack, Y.share);
    // 기본 표정 worried: 동무가 말하기 전의 첫 창과 "달라진 것" 창에서도 웃지 않는다(review 1-라 11.8 ① — 창마다는 pictures.test.ts가 본다)
    expect(share.stage).toEqual({ place: 'neighbor', cast: [{ who: 'friend-girl', at: 'center', pose: 'worried' }] });
    expect(bundle.places.find((place) => place.id === 'neighbor')?.label).toBe('옆집 앞');
    const girlLines = [...share.lines, ...outcomesOf(share).flatMap((outcome) => outcome.lines)].filter((line) => line.who === 'friend-girl');
    expect(girlLines.length).toBeGreaterThanOrEqual(3);
    for (const line of girlLines) expect(line.pose, line.text).toBe('worried');
    expect(said([...share.lines, ...outcomesOf(share).flatMap((outcome) => outcome.lines)])).not.toMatch(/바가지|됫박/);
    expect(choiceViews(pack, winter(), Y.share).map((v) => v.label)[0]).toBe('우리 집 곡식을 조금 나눈다');
    const elder = deedOf(winter({ stats: { trust: 8 } }), Y.elder);
    expect(elder.requested).toEqual(delta({ body: 1 }));
    expect(elder.newCards).toEqual(['s1395-even-share']);
    expect(() => doHappening(pack, winter({ stats: { trust: 7 } }), { id: Y.elder })).toThrow(/할 수 없는 일/);
  });

  it('덤 미션 「생활 카드 열 장」: 카드가 열 장이 되는 일에서 풀린다(어느 일에서 얻은 카드든 센다)', () => {
    const cards = pack.missions.find((m) => m.id === 's1395-m-cards') as Mission;
    expect(cards).toMatchObject({ must: false, season: 'year', parts: [], done: { cardCount: 10 } });
    const have = (n: number) => winter({ cards: Array.from({ length: n }, (_, index) => `held-${index}`) });
    expect(missionProgress(cards, have(0))).toEqual({ have: 0, need: 10 });
    expect(missionProgress(cards, have(7))).toEqual({ have: 7, need: 10 });
    expect(deedOf(have(8), Y.taleWinter).solved).toEqual([]);
    expect(deedOf(have(9), Y.taleWinter).solved).toEqual(['s1395-m-cards']);
    expect(deedOf(have(9), `${Y.rite}/home`).solved).toEqual(['s1395-m-rite']); // 카드를 주지 않는 일로는 풀리지 않는다
    expect(deedOf(have(9), `${lettersId}/ask`).solved).toEqual(['s1395-m-letters', 's1395-m-cards']);
    // 어느 일도 이 미션의 일로 적히지 않는다(우물가는 그대로 덤으로 하는 일이다)
    expect(deedOf(have(9), Y.taleWinter).missionId).toBe('s1395-m-tales');
    expect(deedOf(start(look), `${ID.well}/listen`).missionId).toBeUndefined();
    // 꼭 푸는 미션만으로는 여섯 장이다: 덤을 하지 않으면 열 장에 닿지 않는다
    const always = ['s1395-direct-sowing', 's1395-dano', 's1395-jongmyo', 's1395-state-share', 's1395-rice-cloth', 's1395-hyanggyo'];
    let state = start(look);
    for (let turn = 0; turn < SEASONS.length; turn++) {
      state = playMusts(pack, state, [`${ID.news}/help`, `${Y.rite}/home`]);
      if (turn < SEASONS.length - 1) state = advance(pack, state);
    }
    expect(state.cards.slice().sort()).toEqual(always.slice().sort());
    expect(state.solved).not.toContain('s1395-m-cards');
  });
});

describe('① 한 해 · 농민 집 아이: 한 해 이름, 올해의 바람, 남길 것', () => {
  const facts = (over: { stats?: Partial<Stats>; flags?: string[]; draw?: string } = {}) => ({
    role: ROLE,
    look: 'boy' as Look,
    stats: { living: 4, body: 5, trust: 5, ...over.stats },
    flags: over.flags ?? [],
    draw: over.draw ?? 'normal',
    items: [],
  });
  /** 겨울을 닫은 판을 지어내 돌아보기를 만든다 */
  const review = (over: Parameters<typeof facts>[0] = {}) => {
    const f = facts(over);
    const done: GameState = { ...start('boy'), seasonIndex: 3, phase: 'done', stats: f.stats, flags: f.flags, draw: f.draw, flow: Array.from({ length: 5 }, () => f.stats) };
    return reviewYear(pack, done);
  };
  const TALES = ['tale.spring', 'tale.autumn', 'tale.winter'];

  it('한 해 이름은 여덟 가지다. 위에서부터 처음 맞는 것: 어려웠던 해 → 큰비 → 글자 → 이웃 → 이야기 → 넉넉함 → 그 밖', () => {
    // 덤을 다 하면 거의 늘 맞는 "이야기 모으기"를 글자·이웃 뒤로 보냈다(review 1-라 13번)
    expect(pack.situation.endings.map((ending) => ending.id)).toEqual(['hard', 'worn', 's1395-flood', 's1395-letters', 'neighbors', 's1395-tales', 'full', 'steady']);
    expect(review().yearName).toMatchObject({ id: 'steady', title: '묵묵히 일군 한 해' });
    expect(review({ stats: { living: 6 } }).yearName.id).toBe('full');
    expect(review({ stats: { trust: 9 } }).yearName.id).toBe('neighbors');
    expect(review({ stats: { trust: 8, living: 6 } }).yearName.id).toBe('full');
    expect(review({ flags: ['letters.learned'], stats: { trust: 10, living: 9 } }).yearName).toMatchObject({ id: 's1395-letters', title: '글자를 익힌 한 해' });
    expect(review({ flags: TALES }).yearName).toMatchObject({ id: 's1395-tales', title: '새 나라 이야기를 모은 한 해' });
    expect(review({ flags: TALES, stats: { living: 9 } }).yearName.id).toBe('s1395-tales'); // 넉넉함보다는 앞이다
    expect(review({ flags: [...TALES, 'letters.learned'] }).yearName.id).toBe('s1395-letters');
    expect(review({ flags: TALES, stats: { trust: 9 } }).yearName.id).toBe('neighbors');
    expect(review({ flags: TALES.slice(0, 2) }).yearName.id).toBe('steady'); // 둘만 들어서는 아니다
    // 큰비가 온 해에 살림을 지켰으면(5 이상) — 평소 같은 해라면 "넉넉한 한 해"였을 판도
    expect(review({ draw: 'drought', stats: { living: 5 }, flags: TALES }).yearName).toMatchObject({
      id: 's1395-flood',
      title: '큰비를 이겨 낸 한 해',
      line: '여름 큰비에 논이 잠겼지만, 남은 벼를 거두고 아껴서 겨울 날 곡식을 지켰어요.', // 이웃 일을 하지 않은 판에도 뜨므로 "이웃"을 말하지 않는다
    });
    expect(review({ draw: 'drought', stats: { living: 4 } }).yearName.id).toBe('steady');
    expect(review({ draw: 'drought', stats: { living: 7 } }).yearName.id).toBe('s1395-flood');
    // 살림이나 기력이 바닥난 해는 그것이 먼저다
    expect(review({ stats: { living: 1 }, flags: [...TALES, 'letters.learned'] }).yearName.id).toBe('hard');
    expect(review({ stats: { body: 1, trust: 10 }, draw: 'drought' }).yearName.id).toBe('worn');
    expect(review({ stats: { living: 0, body: 0 } }).yearName.id).toBe('hard');
    // 문턱을 못 박는다: 살림 2는 "허리띠"가 아니고, 기력 2는 "고단"이 아니다(review 1-라 35번 ㉠)
    expect(review({ stats: { living: 2 } }).yearName.id).toBe('steady');
    expect(review({ stats: { body: 2 } }).yearName.id).toBe('steady');
    expect(review({ stats: { living: 2, body: 2 }, draw: 'drought' }).yearName.id).toBe('steady');
    for (const ending of pack.situation.endings) {
      expect(countChars(ending.title), ending.id).toBeLessThanOrEqual(20);
      expect(`${ending.title} ${ending.line}`, ending.id).not.toMatch(/잘했|못했|실패|성공|점수/);
    }
  });

  it('올해의 바람 "식구 모두 굶지 않고 겨울 나기": 살림으로 가리고, 이웃의 믿음이 살림을 메워 주기도 한다', () => {
    const wish = (over: Parameters<typeof facts>[0]) => review(over).wish;
    expect(wish({ stats: { living: 5 } })).toMatchObject({ text: '식구 모두 굶지 않고 겨울 나기', fulfilled: true });
    expect(wish({ stats: { living: 5 } }).reason).toMatch(/넉넉히 남아/);
    expect(wish({ stats: { living: 3 } })).toMatchObject({ fulfilled: true });
    expect(wish({ stats: { living: 3 } }).reason).toMatch(/아껴 먹으며/);
    expect(wish({ stats: { living: 1, trust: 8 } })).toMatchObject({ fulfilled: true });
    expect(wish({ stats: { living: 1, trust: 8 } }).reason).toMatch(/이웃과 서로 나누어/);
    expect(wish({ stats: { living: 2, trust: 7 } }).fulfilled).toBe(false);
    expect(wish({ stats: { living: 0, trust: 10 } }).fulfilled).toBe(false);
    // 이루지 못해도 실패라고 하지 않고 까닭을 말한다(큰비가 온 해에는 그 까닭)
    expect(wish({ stats: { living: 2 }, draw: 'drought' })).toMatchObject({ fulfilled: false }); // review 1-라 35번 ㉠
    expect(wish({ stats: { living: 2 }, draw: 'drought' }).reason).toMatch(/여름 큰비로 거둔 것이 적었어요/);
    expect(wish({ stats: { living: 3 }, draw: 'drought' }).fulfilled).toBe(true); // 큰비가 온 해에도 살림 3이면 이룬다
    expect(wish({ stats: { living: 2 }, draw: 'normal' }).reason).toMatch(/곡식 나갈 데가 많은 한 해/);
    for (const row of roleOf(pack, ROLE).wishOutcomes) expect(row.reason).not.toMatch(/실패|못했|잘못/);
  });

  it('남길 것 셋과 뒷이야기: 이름(id)은 그대로다(깬 기록이 쓴다)', () => {
    expect(pack.situation.legacy.map((one) => [one.id, one.kind])).toEqual([
      ['s1395-legacy-tree', 'tree'],
      ['s1395-legacy-thing', 'thing'],
      ['s1395-legacy-story', 'story'],
    ]);
    expect(pack.situation.legacy.map((one) => one.label)).toEqual(['마당에 심은 어린 느티나무', '손때 묻은 볍씨 자루', '아버지가 들려준 새 궁궐 이야기']);
    expect(review().epilogue).toBe('이듬해 도성과 네 대문이 섰다. 문 이름에 어짊·의로움·예의를 담았다.'); // spec 6.3
  });
});

describe('① 한 해 · 농민 집 아이: 글', () => {
  const year = pack.happenings;
  const allTexts = [
    ...year.flatMap(textsOf),
    ...pack.missions.flatMap((m) => [m.title, m.goal, m.doneLine]),
    ...bundle.cards.filter((card) => card.situation === 's1395').flatMap((card) => [card.title, card.text]),
    ...bundle.items.flatMap((item) => [item.label, item.text]),
    ...pack.situation.endings.flatMap((ending) => [ending.title, ending.line]),
    ...roleOf(pack, ROLE).wishOutcomes.map((row) => row.reason),
    ...(pack.situation.later ?? []).map((row) => row.line),
    ...Object.values(pack.situation.seasons).flatMap((row) => [row.line, ...(row.lineVariants ?? []).map((v) => v.line)]),
    ...pack.situation.legacy.map((one) => one.label),
    ...Object.values(pack.situation.people).map((person) => person.label),
  ];

  it('"사랑채"라고 쓰지 않는다(조선 전기 — "손님 맞는 채"). 확인하지 못한 것과 그때 없던 것을 쓰지 않는다', () => {
    for (const text of allTexts) expect(text).not.toMatch(/사랑채|소금 장수|팥죽|가마니|장터|서당|서원|고추|모내기|품앗이|두레/);
    expect(said(outcomesOf(happeningOf(pack, Y.manor)).flatMap((o) => o.lines))).toMatch(/양반 댁 손님 맞는 채/);
    // 5학년이 모를 말(봄에 고친 것들)을 여름~겨울에도 쓰지 않는다
    for (const text of allTexts) expect(text).not.toMatch(/양식|곳간|구실|첫째|관혼상제|재를 올|기일|예법/);
    // 엽전은 카드 「쌀과 베」의 설명("한참 뒤에야")에만 나온다
    expect(allTexts.filter((text) => /엽전/.test(text))).toEqual(['쌀과 베는 먹고 입는 것이면서 값이기도 했어요. 엽전은 한참 뒤에야 널리 쓰였어요.']);
  });

  it('대화창 한 창은 60자를 넘지 않는다. 배움 쪽지는 "~요"로 끝나고, 이야기 줄은 "~다"로 끝난다', () => {
    let longest = { text: '', id: '' };
    for (const h of year) {
      const windows = [...h.lines, ...(h.lineVariants ?? []).flatMap((v) => v.lines), ...outcomesOf(h).flatMap((o) => o.lines)];
      for (const line of windows) {
        expect(countChars(line.text), `${h.id}: ${line.text}`).toBeLessThanOrEqual(60);
        if (countChars(line.text) > countChars(longest.text)) longest = { text: line.text, id: h.id };
        // "나"의 이야기 줄은 이야기체다
        if (!line.who) expect(line.text, h.id).toMatch(/(다|까|자|지)[.?!…]*$/);
      }
      for (const note of [h.note, ...outcomesOf(h).map((o) => o.note ?? '')].filter(Boolean)) {
        expect(note, h.id).toMatch(/요\.$/);
        expect(countChars(note), h.id).toBeLessThanOrEqual(BUDGET.note);
      }
    }
    console.log(`[글] 가장 긴 대화창: ${countChars(longest.text)}자 (${longest.id}) "${longest.text}"`);
  });

  it('꼭 푸는 미션의 일에는 때를 못 박는 말이 없다(해 ☀는 덤에만 진다)', () => {
    for (const h of year.filter((one) => one.cost === 0)) {
      for (const text of textsOf(h)) expect(text, h.id).not.toMatch(/해가 기울|해가 지|해 질|저녁|밤이|밤에|밤마다|아침|한낮|온종일|하루 종일/);
    }
  });

  it('덤으로 하는 일 열넷에 모두 한마디가 있다: 24자 안, 서로 다르고, 소문처럼 들리고, 답을 미리 말하지 않는다', () => {
    const extras = year.filter((h) => h.cost === 1);
    expect(extras).toHaveLength(14);
    const map = getMap(roleOf(pack, ROLE).map);
    for (const h of extras) {
      const lure = h.lure ?? '';
      expect(countChars(lure), h.id).toBeGreaterThanOrEqual(8);
      expect(countChars(lure), h.id).toBeLessThanOrEqual(BUDGET.lure);
      expect(lure, h.id).toMatch(/(더라|고 한다)$/);
      expect(lure, h.id).not.toMatch(/[.!?\n]/);
      expect(lure, h.id).not.toMatch(/살림|기력|인심|카드|해 ?☀|\d/);
      const spot = map?.spots.find((one) => one.id === h.spot);
      if (spot) expect(lure, h.id).not.toContain(spot.label);
      expect(h.note, h.id).not.toContain(lure);
    }
    expect(new Set(extras.map((h) => h.lure)).size).toBe(extras.length);
    for (const h of year.filter((one) => one.cost === 0)) expect(h.lure, h.id).toBeUndefined();
  });

  it('해 ☀를 쓰고 얻는 것이 없는 선택이 없다: 덤의 어느 결과든 수치나 카드, 덤 미션의 한 걸음이 남는다', () => {
    for (const h of year.filter((one) => one.cost === 1)) {
      for (const outcome of outcomesOf(h)) {
        const stats = Object.values(outcome.effects ?? {}).some((value) => value !== 0);
        const gives = stats || (outcome.cards ?? []).length > 0 || (outcome.setFlags ?? []).length > 0 || (outcome.items ?? []).length > 0;
        expect(gives, `${h.id}: ${outcome.lines[0]?.text}`).toBe(true);
        for (const value of Object.values(outcome.effects ?? {})) expect(Math.abs(value as number), h.id).toBeLessThanOrEqual(1);
      }
    }
    // 미션의 일은 -3~+3
    for (const h of year.filter((one) => one.cost === 0)) {
      for (const outcome of outcomesOf(h)) for (const value of Object.values(outcome.effects ?? {})) expect(Math.abs(value as number), h.id).toBeLessThanOrEqual(3);
    }
  });

  it('주고받음: 선택지가 있는 일에서 한쪽이 모든 수치에서 같거나 나은 일이 없다(같으면 얻는 것이 달라야 한다)', () => {
    const base = (h: Happening) => (h.choices ?? []).map((choice) => ({ id: choice.id, effects: { ...ZERO, ...(choice.effects ?? {}) }, flags: choice.setFlags ?? [] }));
    for (const h of year.filter((one) => (one.choices ?? []).length > 1)) {
      const rows = base(h);
      for (const a of rows) {
        for (const b of rows) {
          if (a === b) continue;
          const better = STATS.every((stat) => a.effects[stat] >= b.effects[stat]) && STATS.some((stat) => a.effects[stat] > b.effects[stat]);
          // 수치로는 한쪽이 나아 보여도 다른 쪽이 따로 남기는 것이 있으면 된다(글자를 익힘, 가는 길이 다름 — 그 표시가 뒤에서 읽힌다)
          const only = b.flags.filter((flag) => !a.flags.includes(flag));
          if (better) expect(only.length, `${h.id}: ${a.id}가 ${b.id}보다 늘 낫다`).toBeGreaterThan(0);
        }
      }
    }
  });

  it('카드 열일곱 장: 카드마다 주는 일이 있고, 카드의 글은 그 일의 배움 쪽지와 다른 것을 알려 준다', () => {
    const cards = bundle.cards.filter((card) => card.situation === 's1395');
    expect(cards).toHaveLength(17);
    const sentences = (text: string) => text.split(/(?<=[.!?])\s+/).map((one) => one.trim()).filter(Boolean);
    for (const card of cards) {
      const givers = year.filter((h) => outcomesOf(h).some((outcome) => (outcome.cards ?? []).includes(card.id)));
      expect(givers.length, card.id).toBeGreaterThan(0);
      expect(countChars(card.title), card.id).toBeLessThanOrEqual(BUDGET.cardTitle);
      expect(countChars(card.text), card.id).toBeLessThanOrEqual(BUDGET.cardText);
      expect(card.text, card.id).toMatch(/요\.$/);
      for (const h of givers) {
        const notes = [h.note, ...outcomesOf(h).map((outcome) => outcome.note ?? '')].filter(Boolean);
        for (const note of notes) {
          for (const one of sentences(card.text)) expect(sentences(note), `${card.id} / ${h.id}`).not.toContain(one);
          const heads = sentences(note).map((one) => one.slice(0, 8));
          for (const one of sentences(card.text)) expect(heads, `${card.id} / ${h.id}`).not.toContain(one.slice(0, 8));
        }
      }
    }
    // 물건 둘도 주는 일이 있다
    for (const item of bundle.items) expect(year.some((h) => outcomesOf(h).some((outcome) => (outcome.items ?? []).includes(item.id))), item.id).toBe(true);
  });

  it('잠긴 까닭은 형편을 주어로 쓴다(사람을 탓하지 않는다). 30자 안이다', () => {
    const reasons = year.flatMap((h) =>
      (h.choices ?? [])
        .filter((choice) => choice.lock)
        .flatMap((choice) => [[h.id, choice.id, choice.lock!.reason], ...(choice.lock!.reasons ?? []).map((one) => [h.id, `${choice.id}(갈림)`, one.reason])]),
    );
    expect(reasons).toHaveLength(13); // 잠기는 선택지 열둘과, 김매기 "서로 거들기"의 인심 때문일 때의 까닭 하나
    for (const [id, choiceId, reason] of reasons) {
      expect(countChars(reason), `${id}/${choiceId}`).toBeLessThanOrEqual(BUDGET.lockReason);
      expect(reason, `${id}/${choiceId}`).toMatch(/요$/);
      expect(reason, `${id}/${choiceId}`).not.toMatch(/네가|너는|게을|못나|탓/);
    }
  });
});

// 한 해 전체를 엔진으로 걷는다(막다른 길 0). 실제 시작 수치에서 닿는 모든 형편을 계절마다 걸어, 닿는 형편을 모아 다음 계절로 넘긴다.
// 한 가지(모습 × 날씨)에 형편 42만~58만 가지(계절마다의 한도는 fixtures의 YEAR_WALK_LIMITS), 한가한 컴퓨터에서 9~13초쯤 걸린다(다른 일이 함께 돌면 몇 배 걸려 시간 한도를 넉넉히 두었다).
// 넷을 걷는다 — 이 파일에서 둘, playthrough.test.ts에서 둘.
describe.each([
  ['boy', 'drought'],
  ['girl', 'normal'],
] as [Look, string][])('① 농민 집 아이(%s)의 한 해를 모두 걷는다 — %s', (look, weather) => {
  it('어느 걸음에서도 막다른 길이 없고, 닿을 수 있는 잠김과 도움의 길, 한 해 이름이 모두 나온다', () => {
    const walked = exploreYear(pack, ROLE, look, weather);
    console.log(
      `[한 해 걷기] ${look}/${weather}: 계절마다 처음 형편 ${walked.starts.join(' → ')}가지, 살핀 형편 ${walked.states.join(' → ')}가지, 한 해의 끝 ${walked.ends}가지\n` +
        `  한 해 이름: ${[...walked.names.keys()].sort().join(', ')}\n  만난 잠김: ${[...walked.locksSeen].sort().join(', ')}\n  인심이 깎인 일: ${[...walked.trustLoss].sort().join(', ')}`,
    );
    expect(walked.stuck).toEqual([]);
    expect(walked.starts[0]).toBe(1);
    expect(walked.starts.every((n) => n > 0)).toBe(true);
    expect(walked.states[0]).toBe(1120); // 봄(바퀴 1-다에서는 1,568 — 1-라 고치기에서 볍씨의 맡김이 듬성듬성과 같아져 형편이 합쳐졌다)
    const rain = weather === 'drought';
    const lettersLock = look === 'boy' ? `${Y.letters}/attend` : `${Y.lettersGirl}/learn`;
    // 잠김: 봄의 "곡식을 보탠다"는 닿지 않고(살림이 4에서 시작한다), 여름부터는 실제로 만난다
    expect([...walked.locksSeen]).not.toContain(`${ID.news}/give`);
    const locks = [`${Y.dano}/treat`, `${Y.weed}/all`, `${Y.weed}/swap`, `${Y.weed}/rest`, `${Y.leave}/tend`, `${Y.rite}/temple`, lettersLock, `${Y.share}/grain`];
    for (const id of locks) expect([...walked.locksSeen], id).toContain(id);
    // 소금의 잠김과 그 도움의 길은 큰비가 온 해에만 닿는다(다른 해에는 가을걷이로 살림이 넉넉하다)
    for (const id of [`${Y.salt}/ours`, `${Y.salt}/share`]) expect(walked.locksSeen.has(id), id).toBe(rain);
    expect(walked.did.has(Y.saltHelp)).toBe(rain);
    expect(walked.did.has(Y.bank)).toBe(rain);
    expect(walked.did.has(Y.weedHelp)).toBe(true);
    // 그 모습에게 벌어지는 일은 모두 한 번은 한다
    const mine = pack.happenings.filter((h) => (!h.shows?.look || h.shows.look === look) && (rain || ![Y.bank, Y.saltHelp].includes(h.id as typeof Y.bank)));
    for (const h of mine) expect(walked.did.has(h.id), h.id).toBe(true);
    expect(walked.did.size).toBe(mine.length);
    // 인심이 깎이는 길
    for (const id of [`${ID.ours}/`, `${Y.dano}/work`, `${Y.leave}/ours`]) expect([...walked.trustLoss], id).toContain(id);
    expect(walked.trustLoss.has(`${Y.bank}/ours`)).toBe(rain);
    // 한 해 이름: 큰비가 온 해에는 "넉넉한 한 해" 대신 "큰비를 이겨 낸 한 해"
    const names = ['hard', 'worn', 's1395-tales', 's1395-letters', 'neighbors', 'steady', rain ? 's1395-flood' : 'full'];
    expect([...walked.names.keys()].sort()).toEqual(names.sort());
  }, 600000);
});
