// 미션 시험: 실제 콘텐츠 ① 1395년의 봄(농민 집 아이)을 엔진으로 모든 길을 걸어 본다.
//   - 꼭 푸는 미션 둘이 어떤 길로도 풀린다(막다른 길이 없다). 수치를 바닥(0·0·0)까지 떨어뜨려도 풀린다.
//   - 답을 맞혀야 풀리는 미션이 없다: 푸는 길이 둘 이상이고 길에 따라 결과가 다르다.
//   - 두 모습(남자아이·여자아이) 모두에서 그렇다.
//   - 풀렸을 때 Deed.solved에 적힌다. 덤은 해 ☀만큼만 할 수 있다. 볍씨 선택과 일 놀이의 표시가 남는다.
//   - spec 6.3의 숫자(곡식을 보태는 길의 잠김, 나중에 나타나는 결과와 그것이 붙는 계절, 궂은 해의 이름)와
//     바퀴 1-다 고치기에서 정한 것(덤의 한마디와 작은 선택, 글의 앞뒤와 쉬운 말)을 실제 묶음에 묶어 둔다(review 20번).
// 검사기(validate.ts)의 걸어 보기와 따로, 시험의 도구(fixtures.ts의 explore)로 걷는다.

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
  roleOf,
  type DoInput,
} from '../src/engine/game';
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
import { doAll, explore, movesOf, stateKey, withStats } from './fixtures';

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

  it('놀이를 어떻게 끝내도(어른께 맡겨도) 미션은 풀리고, 차이는 수치 ±1뿐이다', () => {
    for (const view of choiceViews(pack, start(look), sowHappening.id)) {
      const deeds = ends.map((play) => lastDeed(doHappening(pack, start(look), { id: sowHappening.id, choiceId: view.id, play })) as Deed);
      for (const deed of deeds) expect(deed.solved).toEqual([sowMission.id]);
      for (const stat of STATS) {
        const values = deeds.map((d) => d.requested[stat]);
        expect(Math.max(...values) - Math.min(...values), `${view.id} ${stat}`).toBeLessThanOrEqual(1);
      }
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

  it('볍씨 뿌리기: 고루 뿌리면 기력 -1·살림 +1, 듬성듬성이면 기력 -1, 어른께 맡기면 그대로다(두 논 모두)', () => {
    for (const choiceId of ['low', 'split']) {
      const requested = (play: string) => lastDeed(doHappening(pack, start('boy'), { id: ID.sow, choiceId, play }))?.requested;
      expect(requested('even'), choiceId).toEqual(delta({ body: -1, living: 1 }));
      expect(requested('patchy'), choiceId).toEqual(delta({ body: -1 }));
      expect(requested('left'), choiceId).toEqual(ZERO);
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

  it('나중 결과 셋은 여름을 닫을 때 붙는다: 낮은 논+큰비 -3, 낮은 논+다른 해 +1, 나눠 뿌림+큰비 -1', () => {
    const summer = (flag: string, draw: string) => closingAt('summer', [flag, 'return.done'], draw);
    expect(summer('sow.low', 'drought').delta).toEqual(delta({ living: -3 }));
    expect(summer('sow.low', 'normal').delta).toEqual(delta({ living: 1 }));
    expect(summer('sow.low', 'bumper').delta).toEqual(delta({ living: 1 }));
    expect(summer('sow.split', 'drought').delta).toEqual(delta({ living: -1 }));
    expect(summer('sow.split', 'normal').delta).toEqual(ZERO);
    expect(summer('sow.split', 'bumper').delta).toEqual(ZERO);
    // 붙은 줄은 하나씩이고, 나눠 뿌린 논은 큰비가 아니면 줄이 없다
    expect(summer('sow.low', 'drought').lines).toHaveLength(1);
    expect(summer('sow.low', 'drought').lines[0]).toMatch(/큰비.*낮은 논.*잠겼다/);
    expect(summer('sow.low', 'normal').lines).toHaveLength(1);
    expect(summer('sow.low', 'normal').lines[0]).toMatch(/낮은 논/);
    expect(summer('sow.split', 'drought').lines).toHaveLength(1);
    expect(summer('sow.split', 'drought').lines[0]).toMatch(/높은 논/);
    expect(summer('sow.split', 'normal').lines).toEqual([]);
    // 살림은 0 아래로 내려가지 않는다
    expect(closingAt('summer', ['sow.low'], 'drought', { living: 2, body: 5, trust: 5 }).after.living).toBe(0);
  });

  it('볍씨 선택의 결과는 여름이 아닌 계절을 닫을 때는 붙지 않는다', () => {
    expect(sowLines).toHaveLength(3);
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
    expect(later.filter((row) => sowLines.includes(row.line)).map((row) => row.at)).toEqual(['summer', 'summer', 'summer']);
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
    expect(tales.parts).toEqual([ID.tale]);
    expect(missionProgress(tales, start('boy'))).toEqual({ have: 0, need: 3 });
    const did = doHappening(pack, start('boy'), { id: ID.tale });
    expect(lastDeed(did)?.newFlags).toEqual(['tale.spring']);
    expect(lastDeed(did)?.requested).toEqual(delta({ body: 1 }));
    expect(lastDeed(did)?.missionId).toBe(tales.id);
    expect(missionProgress(tales, did)).toEqual({ have: 1, need: 3 });
    expect(did.solved).toEqual([]); // 가을과 겨울 몫이 아직 없어 풀리지 않은 채 남는다
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
    const factNumbers = (ids: string[]) => new Set(bundle.sources.filter((source) => ids.includes(source.id)).flatMap((source) => numbersIn(source.fact)));
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
