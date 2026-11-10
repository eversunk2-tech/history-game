// 겨루기 엔진 시험(spec 8.1·8.2·8.3·5.3, 11.1 사의 ㉡ 칸): 시작(덱·손패·기운·귀띔), 예고 = 한 일, 카드의 힘과 상성,
// 단계와 방패(지혜 겨루기·맞힘·덧효과·그늘·저절로 깎임), 기세와 합동 기술, 틀린 문제 다시, 귀띔, 끝(넘김·구해 줌·해거름)과 별·점수,
// 막다른 판이 없음(카드 내는 차례 × 맞힘 비율 × 레벨 × 씨앗, 뒤 에피소드의 어림으로 만든 고비까지), 상성이 실제로 빠르게 함, 같은 씨앗이면 같은 판.
// 엔진만으로 돈다(화면·문제의 꼴 없이 — 문제는 tests/fixtures4.ts의 가짜 문제).

import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/engine/balance';
import {
  NO_ASK,
  affinityOf,
  answer,
  battleResult,
  canCombo,
  cardPower,
  chooseCard,
  comesAgain,
  hintSeed,
  phaseFloor,
  previewOf,
  startBattle,
  useCombo,
  useHint,
  type Battle,
  type BattleAsk,
} from '../src/engine/battle';
import { battleAsk, hintChoice } from '../src/engine/quiz';
import type { Foe } from '../src/engine/types4';
import {
  allQuestions,
  autoBattle,
  bossSetup,
  cards41,
  dokkaebi,
  episode41,
  evenStats,
  fakeBoss,
  fieldCards,
  hardsoil,
  hoe,
  starter,
  storyQuestions,
  type AutoPolicy,
  type CardOrder,
} from './fixtures4';

const askFor = (seed = 1): BattleAsk => battleAsk({ questions: allQuestions, logs: {}, episode: episode41, seed });

/** 고비를 넘지 않는 고비(기운이 아주 많고 깎지 않는다) — 해거름과 방패의 셈을 따로 보려고 */
const wall = (over: Partial<Foe> = {}): Foe => ({
  ...dokkaebi,
  id: 'wall',
  hp: 100000,
  moves: [{ id: 'rest', line: '쉰다', icon: 'rest', weight: 1 }],
  weak: [],
  ...over,
});

/** 카드 하나를 내고 답한다 */
function play(b: Battle, card: string, right: boolean, ask: BattleAsk = askFor()): Battle {
  return answer(chooseCard(b, card, ask), right, ask);
}

/** 지혜 겨루기를 모두 답한다 */
function answerWisdom(b: Battle, rights: boolean[], ask: BattleAsk = askFor()): Battle {
  let out = b;
  for (const right of rights) {
    if (out.pending?.kind !== 'wisdom') break;
    out = answer(out, right, ask);
  }
  return out;
}

const first = (b: Battle) => b.hand.find((c) => c !== b.frozen) as string;

describe('시작', () => {
  it('손패 넷, 나머지는 더미, 기운은 20 + 힘×3 + 레벨×2 − (5 − 기력)⁺×3', () => {
    const b = startBattle(bossSetup(dokkaebi));
    expect(b.hand).toHaveLength(4);
    expect(b.pile).toHaveLength(2);
    expect(new Set([...b.hand, ...b.pile])).toEqual(new Set(starter));
    expect(b.me).toBe(31);
    expect(b.meMax).toBe(31);
    expect(startBattle(bossSetup(dokkaebi, { body: 3 })).me).toBe(25);
    expect(startBattle(bossSetup(dokkaebi, { body: 0 })).me).toBe(16);
    expect(b.foeHp).toBe(90);
    expect(b.phase).toBe(1);
    expect(b.shield).toBe(0);
    expect(b.momentum).toBe(0);
  });

  it('현장에서 얻은 카드가 더해지면 여덟 장을 넘어도 된다(같은 id는 한 번)', () => {
    const b = startBattle(bossSetup(dokkaebi, { deck: [...starter, ...fieldCards, 'skill-help'] }));
    expect(b.hand.length + b.pile.length).toBe(10);
  });

  it('빈 덱은 던진다', () => {
    expect(() => startBattle(bossSetup(dokkaebi, { deck: [] }))).toThrow();
    expect(() => startBattle(bossSetup(dokkaebi, { deck: ['없는-카드'] }))).toThrow();
  });

  it('귀띔: 큰 고비마다 1 + 지혜 5마다 1, 작은 고비는 지혜 몫만', () => {
    const at = (wisdom: number, foe: Foe) => startBattle(bossSetup(foe, { stats: { power: 3, wisdom, craft: 3, heart: 3 } })).hints;
    expect(at(3, dokkaebi)).toBe(1);
    expect(at(5, dokkaebi)).toBe(2);
    expect(at(10, dokkaebi)).toBe(3);
    expect(at(3, hardsoil)).toBe(0);
    expect(at(5, hardsoil)).toBe(1);
  });

  it('작은 고비는 3차례 한도, 큰 고비는 16차례', () => {
    expect(startBattle(bossSetup(hardsoil)).ctx.limit).toBe(3);
    expect(startBattle(bossSetup(hardsoil)).kind).toBe('minor');
    expect(startBattle(bossSetup(dokkaebi)).ctx.limit).toBe(16);
    expect(startBattle(bossSetup(dokkaebi)).kind).toBe('boss');
  });

  it('같은 씨앗이면 같은 판, 씨앗이 다르면 덱의 차례가 다르다', () => {
    const policy: AutoPolicy = { order: 'random', rightRate: 0.6, seed: 9 };
    const a = autoBattle(bossSetup(dokkaebi, { seed: 5 }), askFor(5), policy);
    const b = autoBattle(bossSetup(dokkaebi, { seed: 5 }), askFor(5), policy);
    expect(b.battle).toEqual(a.battle);
    const hands = new Set(Array.from({ length: 12 }, (_, i) => startBattle(bossSetup(dokkaebi, { seed: i + 1 })).hand.join(',')));
    expect(hands.size).toBeGreaterThan(6);
  });

  it('상태를 고치지 않는다(얼린 판으로도 끝까지 간다)', () => {
    const ask = askFor();
    let b = startBattle(bossSetup(dokkaebi));
    for (let i = 0; i < 40 && !b.end; i++) {
      Object.freeze(b);
      b = b.pending?.kind === 'wisdom' ? answer(b, i % 2 === 0, ask) : play(b, first(b), i % 3 !== 0, ask);
    }
    expect(b.end).toBeDefined();
  });
});

describe('예고 = 한 일', () => {
  it('모든 차례에서 고비가 한 일이 그 차례의 예고와 같다(약하게로 줄어든 만큼만 다르다)', () => {
    let checked = 0;
    for (const foe of [dokkaebi, hardsoil, fakeBoss(7), fakeBoss(20, true)]) {
      for (const order of ['first', 'strong', 'weak', 'random'] as CardOrder[]) {
        for (const rate of [1, 0.6, 0]) {
          for (let seed = 1; seed <= 12; seed++) {
            const run = autoBattle(bossSetup(foe, { seed, level: foe === dokkaebi || foe === hardsoil ? 1 : 7 }), askFor(seed), {
              order,
              rightRate: rate,
              seed,
            });
            expect(run.mismatches, `${foe.id} ${order} ${rate} ${seed}`).toEqual([]);
            checked += run.battle.turn;
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(1000);
  });

  it('도깨비는 씨앗으로 고른 자리에서 수수께끼·씨름·일 겨루기를 차례대로 돈다', () => {
    const ids = dokkaebi.moves.map((m) => m.id);
    const starts = new Set<number>();
    for (let seed = 1; seed <= 20; seed++) {
      const run = autoBattle(bossSetup(wall({ moves: dokkaebi.moves, order: 'cycle' }), { seed }), askFor(seed), { order: 'first', rightRate: 1, seed });
      const start = ids.indexOf(run.intents[0]);
      starts.add(start);
      run.intents.forEach((id, i) => expect(id).toBe(ids[(start + i) % 3]));
    }
    expect(starts.size).toBe(3);
  });

  it('무게로 뽑는 고비: 같은 일이 셋 잇달아 나오지 않고, 둘 잇달아는 나온다', () => {
    let pairs = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const run = autoBattle(bossSetup(wall({ moves: hardsoil.moves.map((m) => ({ ...m, hit: [0, 0] as [number, number] })), order: 'weighted' }), { seed }), NO_ASK, {
        order: 'first',
        rightRate: 0,
        seed,
      });
      const seen = [...run.battle.moves];
      for (let i = 2; i < seen.length; i++) expect(seen[i] === seen[i - 1] && seen[i] === seen[i - 2], `씨앗 ${seed}: ${seen.join(',')}`).toBe(false);
      for (let i = 1; i < seen.length; i++) if (seen[i] === seen[i - 1]) pairs++;
    }
    expect(pairs).toBeGreaterThan(0);
  });

  it('깎는 기운은 할 일의 범위 안이고, 약하게를 걸면 예고가 그만큼 준다', () => {
    let b = startBattle(bossSetup(dokkaebi, { seed: 3 }));
    for (let i = 0; i < 30 && !b.end; i++) {
      const move = dokkaebi.moves.find((m) => m.id === b.intent);
      const [lo, hi] = move?.hit ?? [0, 0];
      expect(b.plan?.hit).toBeGreaterThanOrEqual(lo);
      expect(b.plan?.hit).toBeLessThanOrEqual(hi);
      b = b.pending?.kind === 'wisdom' ? answer(b, true, askFor()) : play(b, first(b), false);
    }
    // 'weaken' 카드(지게 지기)를 맞히면 이번 차례 고비의 일이 반이 된다
    const base = startBattle(bossSetup(dokkaebi, { seed: 4, deck: ['skill-carry', 'skill-soil', 'skill-bund', 'skill-reckon'] }));
    const planned = base.plan?.hit ?? 0;
    const after = play(base, 'skill-carry', true);
    const foe = after.events.find((e) => e.t === 'foe');
    expect(foe).toMatchObject({ t: 'foe', move: base.intent, planned, hit: Math.round(planned * BALANCE.weakenMul), weakened: true });
    const wrong = play(base, 'skill-carry', false);
    expect(wrong.events.find((e) => e.t === 'foe')).toMatchObject({ hit: planned, weakened: false });
    expect(previewOf(base)?.hit).toBe(planned);
  });
});

describe('카드의 힘과 상성', () => {
  const at = (b: Battle, card: string, right: boolean) => cardPower(b, card, right);

  it('기본 8 + 능력치 3 = 11, 맞히면 22, 상성까지 맞으면 33, 약하면 반(8.1의 어림)', () => {
    const b = startBattle(bossSetup(hardsoil, { seed: 1 }));
    expect(at(b, 'skill-reckon', false)).toBe(11);
    expect(at(b, 'skill-reckon', true)).toBe(22);
    expect(at(b, 'skill-soil', true)).toBe(33);
    expect(at(b, 'skill-bund', false)).toBe(17);
    const d = { ...startBattle(bossSetup(dokkaebi)), plan: { move: 'riddle', hit: 5, strong: 'wisdom' as const } };
    expect(affinityOf(d, 'skill-reckon')).toBe('strong');
    expect(affinityOf(d, 'skill-bund')).toBe('weak');
    expect(affinityOf(d, 'skill-call')).toBe('weak');
    expect(at(d, 'skill-bund', true)).toBe(11);
    expect(at(d, 'skill-bund', false)).toBe(6);
  });

  it('단계의 덧힘(1은 0, 2는 +2, 3은 +4)과 장비(호미 → 흙 카드 +2), 능력치', () => {
    const b = startBattle(bossSetup(wall(), { steps: { 'skill-reckon': 2, 'skill-tithe': 3 }, gear: [hoe] }));
    expect(b.ctx.base['skill-reckon']).toBe(13);
    expect(b.ctx.base['skill-tithe']).toBe(15);
    expect(b.ctx.base['skill-soil']).toBe(13);
    expect(b.ctx.base['skill-bund']).toBe(11);
    const strong = startBattle(bossSetup(wall(), { stats: { power: 9, wisdom: 3, craft: 3, heart: 3 } }));
    expect(strong.ctx.base['skill-bund']).toBe(17);
  });

  it('방패가 있으면 반, 고비가 건 약하게(weaken-next)도 반', () => {
    const b = startBattle(bossSetup(wall()));
    expect(at({ ...b, shield: 2 }, 'skill-reckon', true)).toBe(11);
    expect(at({ ...b, dull: true }, 'skill-reckon', true)).toBe(11);
    expect(at({ ...b, shield: 1, dull: true }, 'skill-reckon', false)).toBe(3);
  });

  it('센 것과 약한 것: 갈래나 id, OFF_TURN은 그 차례에 센 갈래가 따로 있을 때만, 둘 다면 센 것', () => {
    const foe = wall({ strong: ['skill-call'], weak: ['heart', 'skill-tithe', 'off-turn'] });
    const b = startBattle(bossSetup(foe));
    expect(affinityOf(b, 'skill-call')).toBe('strong');
    expect(affinityOf(b, 'skill-help')).toBe('weak');
    expect(affinityOf(b, 'skill-tithe')).toBe('weak');
    // 이번 차례에 센 갈래가 없으면 OFF_TURN은 걸리지 않는다
    expect(affinityOf(b, 'skill-bund')).toBe('normal');
    const turn = { ...b, plan: { move: 'x', hit: 0, strong: 'power' as const } };
    expect(affinityOf(turn, 'skill-bund')).toBe('strong');
    expect(affinityOf(turn, 'skill-reckon')).toBe('weak');
  });

  it('틀려도 기본 힘은 나가고(적어도 1), 넘친 힘은 그 단계의 바닥에서 버린다', () => {
    let b = startBattle(bossSetup(dokkaebi));
    b = { ...b, foeHp: 50 };
    const out = play(b, first(b), true);
    expect(out.foeHp).toBe(45);
    expect(out.dealt).toBe(5);
    expect(out.phase).toBe(2);
    const tiny = startBattle(bossSetup(wall(), { stats: { power: 0, wisdom: 0, craft: 0, heart: 0 } }));
    expect(cardPower({ ...tiny, shield: 3, dull: true, plan: { move: 'x', hit: 0, strong: 'power' } }, 'skill-reckon', false)).toBeGreaterThanOrEqual(1);
  });
});

describe('단계와 방패', () => {
  it('기운이 반이 되면 2단계: 방패 셋과 지혜 겨루기 세 문제(핵심 물음)', () => {
    let b = startBattle(bossSetup(dokkaebi));
    b = { ...b, foeHp: 46 };
    b = play(b, first(b), true);
    expect(b.phase).toBe(2);
    expect(b.shield).toBe(3);
    expect(b.events.some((e) => e.t === 'phase')).toBe(true);
    expect(b.pending?.kind).toBe('wisdom');
    expect(b.wisdomLeft).toHaveLength(3);
    const core = new Set(episode41.core);
    for (const q of b.wisdomLeft) expect(core.has(q)).toBe(true);
    // 지혜 겨루기 중에는 카드를 낼 수 없다
    expect(() => chooseCard(b, first(b), askFor())).toThrow();
  });

  it('지혜 겨루기: 맞힌 수만큼 방패가 깎인다', () => {
    for (const [rights, left] of [
      [[true, true, true], 0],
      [[true, false, true], 1],
      [[false, false, false], 3],
    ] as [boolean[], number][]) {
      let b = startBattle(bossSetup(dokkaebi));
      b = play({ ...b, foeHp: 46 }, first(b), true);
      b = answerWisdom(b, rights);
      expect(b.shield).toBe(left);
      expect(b.pending).toBeUndefined();
      expect(b.asked.filter((a) => !a.card)).toHaveLength(3);
    }
  });

  it('지혜 겨루기를 다 틀려도 방패는 세 차례마다 한 칸씩 저절로 깎인다', () => {
    let b = startBattle(bossSetup(wall({ phases: 2, hp: 1000 }), { level: 30, stats: evenStats(30) }));
    b = { ...b, foeHp: 501 };
    b = play(b, first(b), true);
    expect(b.phase).toBe(2);
    b = answerWisdom(b, [false, false, false]);
    expect(b.shield).toBe(3);
    const shields: number[] = [];
    for (let i = 0; i < 9; i++) {
      b = play(b, first(b), false);
      shields.push(b.shield);
    }
    expect(shields).toEqual([3, 3, 2, 2, 2, 1, 1, 1, 0]);
    expect(b.events.some((e) => e.t === 'shield' && e.why === 'fade')).toBe(true);
  });

  it('방패가 있을 때 카드의 문제를 맞히면 한 칸, 덧효과 "방패"면 한 칸 더', () => {
    const base = { ...startBattle(bossSetup(wall(), { deck: ['skill-bund', 'skill-reckon', 'skill-call', 'skill-soil'] })), phase: 2, shield: 3 };
    expect(play(base, 'skill-reckon', true).shield).toBe(2);
    expect(play(base, 'skill-bund', true).shield).toBe(1);
    expect(play(base, 'skill-bund', false).shield).toBe(3);
  });

  it('「느티나무 그늘」은 방패 한 칸과 기운 회복, 「함께 들기」는 방패가 있으면 반', () => {
    const base = { ...startBattle(bossSetup(wall())), phase: 2, shield: 2, momentum: 3, me: 10 };
    const shade = useCombo(base, 'shade', askFor());
    expect(shade.shield).toBe(1);
    expect(shade.me).toBe(10 + BALANCE.shadeHeal);
    const lift = useCombo(base, 'lift', askFor());
    expect(lift.dealt).toBe(BALANCE.liftPower * BALANCE.shieldMul);
    const bare = useCombo({ ...base, shield: 0 }, 'lift', askFor());
    expect(bare.dealt).toBe(BALANCE.liftPower);
  });

  it('정점(세 단계)은 3분의 1씩 단계가 열린다', () => {
    const foe = fakeBoss(7, true);
    const b = startBattle(bossSetup(foe, { level: 7 }));
    expect(foe.hp).toBe(Math.round((80 + 7 * 15) * 1.4));
    expect(phaseFloor(b, 1)).toBe(Math.round((foe.hp * 2) / 3));
    expect(phaseFloor(b, 2)).toBe(Math.round(foe.hp / 3));
    expect(phaseFloor(b, 3)).toBe(0);
  });

  it('고비가 방패를 세우는 일(2단계부터), 제 기운을 채우는 일(그 단계의 꼭대기까지), 카드를 얼리는 일', () => {
    const raise = wall({ moves: [{ id: 'wall', line: '', icon: '', effect: 'raise-shield', weight: 1 }] });
    let b = startBattle(bossSetup(raise));
    b = play(b, first(b), false);
    expect(b.shield).toBe(0);
    b = play({ ...b, phase: 2, shield: 1 }, first(b), false);
    expect(b.shield).toBe(2);
    const heal = wall({ hp: 90, phases: 2, moves: [{ id: 'grow', line: '', icon: '', effect: 'heal', weight: 1 }] });
    const h = startBattle(bossSetup(heal));
    // 그늘(힘을 주지 않는 합동 기술)로 한 차례를 보내 고비의 일만 본다
    expect(useCombo({ ...h, foeHp: 80, momentum: 3 }, 'shade', askFor()).foeHp).toBe(80 + BALANCE.foeHeal);
    expect(useCombo({ ...h, foeHp: 88, momentum: 3 }, 'shade', askFor()).foeHp).toBe(90);
    expect(useCombo({ ...h, phase: 2, foeHp: 43, momentum: 3 }, 'shade', askFor()).foeHp).toBe(45);
    const freeze = wall({ moves: [{ id: 'cold', line: '', icon: '', effect: 'freeze-card', weight: 1 }] });
    let f = startBattle(bossSetup(freeze));
    f = play(f, first(f), false);
    expect(f.frozen).toBeDefined();
    expect(f.hand).toContain(f.frozen);
    expect(() => chooseCard(f, f.frozen as string, askFor())).toThrow();
  });
});

describe('기세와 합동 기술', () => {
  it('맞히면 +1(덧효과 기세면 +2), 틀리면 −1, 0 아래로 안 감, 찬 칸을 넘지 않음', () => {
    const b = startBattle(bossSetup(wall(), { deck: ['skill-reckon', 'skill-bund', 'skill-call', 'skill-soil'] }));
    expect(play(b, 'skill-bund', true).momentum).toBe(1);
    expect(play(b, 'skill-reckon', true).momentum).toBe(2);
    expect(play(b, 'skill-bund', false).momentum).toBe(0);
    expect(play({ ...b, momentum: 2 }, 'skill-bund', false).momentum).toBe(1);
    expect(play({ ...b, momentum: 2 }, 'skill-reckon', true).momentum).toBe(3);
  });

  it('세 칸이 차야 합동 기술(어울림 8 이상이면 두 칸), 쓰면 0이고 한 차례를 쓴다', () => {
    const b = startBattle(bossSetup(dokkaebi));
    expect(canCombo({ ...b, momentum: 2 })).toBe(false);
    expect(canCombo({ ...b, momentum: 3 })).toBe(true);
    expect(() => useCombo({ ...b, momentum: 2 }, 'lift', askFor())).toThrow();
    const kind = startBattle(bossSetup(dokkaebi, { stats: { power: 3, wisdom: 3, craft: 3, heart: 8 } }));
    expect(kind.ctx.full).toBe(2);
    expect(canCombo({ ...kind, momentum: 2 })).toBe(true);
    const used = useCombo({ ...b, momentum: 3 }, 'lift', askFor());
    expect(used.momentum).toBe(0);
    expect(used.turn).toBe(1);
    expect(used.asked).toHaveLength(0);
    expect(used.events.some((e) => e.t === 'foe')).toBe(true);
  });

  it('도깨비의 웃음보(steal-momentum)는 기세 한 칸을 가져간다', () => {
    const foe = wall({ moves: [{ id: 'laugh', line: '', icon: '', effect: 'steal-momentum', weight: 1 }] });
    const b = startBattle(bossSetup(foe, { deck: ['skill-bund', 'skill-reckon', 'skill-call', 'skill-soil'] }));
    expect(play({ ...b, momentum: 2 }, 'skill-bund', true).momentum).toBe(2);
    expect(play({ ...b, momentum: 1 }, 'skill-bund', false).momentum).toBe(0);
  });
});

describe('틀린 문제 다시', () => {
  it('틀린 문제는 두 차례 뒤에 다른 문제보다 먼저 다시 나오고 again이다', () => {
    const ask = askFor();
    let b = startBattle(bossSetup(wall()));
    b = chooseCard(b, first(b), ask);
    const missed = b.pending?.q as string;
    b = answer(b, false, ask);
    expect(b.retry).toEqual([{ q: missed, at: 3 }]);
    b = chooseCard(b, first(b), ask);
    expect(b.pending?.q).not.toBe(missed);
    b = answer(b, true, ask);
    b = chooseCard(b, first(b), ask);
    expect(b.pending).toMatchObject({ q: missed, again: true });
    b = answer(b, true, ask);
    expect(b.asked.map((a) => a.again)).toEqual([false, false, true]);
  });

  it('comesAgain: 틀리면 다시 나올 차례가 한도 안에 남았을 때만 참이다(화면의 "두 차례 뒤에 다시 나와요" — 작은 고비 3차례, 큰 고비 16차례)', () => {
    const ask = askFor();
    // 작은 고비(한도 3차례 — 기운이 많은 굳은 논흙으로 3차례를 다 간다): 첫 차례에 틀린 것은 셋째 차례에 다시 나오고, 둘째·셋째 차례에 틀린 것은 다시 나오지 않는다
    let m = startBattle(bossSetup({ ...hardsoil, hp: 100000 }));
    const seen: { q: string; again: boolean }[] = [];
    for (let turn = 1; turn <= 3; turn++) {
      m = chooseCard(m, first(m), ask);
      const q = m.pending?.q as string;
      seen.push({ q, again: comesAgain(m) });
      m = answer(m, false, ask);
    }
    expect(seen.map((x) => x.again)).toEqual([true, false, false]);
    expect(m.end).toBe('dusk');
    expect(m.asked.filter((a) => a.again).map((a) => a.q)).toEqual([seen[0].q]);
    // 큰 고비: 열넷째 차례까지 틀린 것은 다시 나올 차례가 남고, 열다섯째·열여섯째는 남지 않는다
    let b = startBattle(bossSetup(wall()));
    const left: boolean[] = [];
    for (let turn = 1; turn <= 16 && !b.end; turn++) {
      b = chooseCard(b, first(b), ask);
      left.push(comesAgain(b));
      b = answer(b, false, ask);
    }
    expect(left).toEqual([...Array(14).fill(true), false, false]);
    // 답을 기다리는 문제가 없으면 거짓
    expect(comesAgain(startBattle(bossSetup(wall())))).toBe(false);
  });

  it('한 겨루기 안에서 같은 문제를 두 번 내지 않는다(틀려서 다시 내는 것 말고)', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const run = autoBattle(bossSetup(wall(), { seed }), askFor(seed), { order: 'random', rightRate: 0.5, seed });
      const firsts = run.battle.asked.filter((a) => !a.again).map((a) => a.q);
      expect(new Set(firsts).size).toBe(firsts.length);
      for (const a of run.battle.asked.filter((x) => x.again)) {
        const before = run.battle.asked.slice(0, run.battle.asked.indexOf(a));
        expect(before.some((x) => x.q === a.q && !x.right)).toBe(true);
      }
    }
  });

  it('쉬움 먼저, 맞힌 수가 늘면 보통·어려움', () => {
    const ask = askFor();
    let b = startBattle(bossSetup(wall()));
    const levels: number[] = [];
    const levelOf = new Map(allQuestions.map((q) => [q.id, q.level]));
    for (let i = 0; i < 6; i++) {
      b = chooseCard(b, first(b), ask);
      levels.push(levelOf.get(b.pending?.q as string) ?? 0);
      b = answer(b, true, ask);
    }
    expect(levels).toEqual([1, 1, 2, 2, 3, 3]);
  });
});

describe('귀띔', () => {
  it('귀띔은 남은 만큼만 쓰고, 틀린 고를 것 하나를 지운다(답은 지우지 않는다)', () => {
    const ask = askFor();
    let b = startBattle(bossSetup(dokkaebi));
    expect(() => useHint(b)).toThrow();
    b = chooseCard(b, first(b), ask);
    b = useHint(b);
    expect(b.hints).toBe(0);
    expect(() => useHint(b)).toThrow();
    const q = allQuestions.find((x) => x.id === b.pending?.q);
    expect(q).toBeDefined();
    if (q && q.form === 'pick') {
      const gone = hintChoice(q, hintSeed(b));
      expect(gone).not.toBeNull();
      expect(gone).not.toBe(q.answer);
    }
  });
});

describe('끝과 별·점수', () => {
  it('마지막 단계에서 고비의 기운이 0이면 넘김 — 고비는 그 차례에 아무것도 하지 않는다', () => {
    let b = startBattle(bossSetup(dokkaebi));
    b = { ...b, phase: 2, foeHp: 3, shield: 0 };
    const me = b.me;
    b = play(b, first(b), true);
    expect(b.end).toBe('win');
    expect(b.me).toBe(me);
    expect(b.events.some((e) => e.t === 'foe')).toBe(false);
    expect(b.turn).toBe(1);
  });

  it('내 기운이 0이면 구해 줌: 별 ①만(③은 그때까지 맞힌 만큼), 기력 −1', () => {
    const b0 = startBattle(bossSetup(dokkaebi, { deck: ['skill-reckon', 'skill-bund', 'skill-soil', 'skill-call'] }));
    let b: Battle = { ...b0, me: 1, plan: { move: 'riddle', hit: 5, strong: 'wisdom' } };
    b = play(b, 'skill-reckon', true);
    expect(b.end).toBe('rescue');
    expect(b.me).toBe(0);
    const r = battleResult(b);
    expect(r?.stars).toEqual([true, false, true]);
    expect(r?.rescued).toBe(true);
    expect(r?.bodyLoss).toBe(1);
  });

  it('16차례가 되면 해거름(함께 마무리): 구해 줌과 같게 센다 — 작은 고비는 3차례', () => {
    const run = autoBattle(bossSetup(wall()), askFor(), { order: 'first', rightRate: 1, combo: 'none' });
    expect(run.battle.end).toBe('dusk');
    expect(run.battle.turn).toBe(16);
    const r = battleResult(run.battle);
    expect(r?.stars[0]).toBe(true);
    expect(r?.stars[1]).toBe(false);
    expect(r?.rescued).toBe(true);
    expect(r?.bodyLoss).toBe(1);
    const minor = autoBattle(bossSetup(wall({ phases: 1, shield: 0 })), askFor(), { order: 'first', rightRate: 0 });
    expect(minor.battle.end).toBe('dusk');
    expect(minor.battle.turn).toBe(3);
  });

  it('별 ②: 구해 줌·해거름 없이 기운을 반 넘게 남김(꼭 반이면 없음)', () => {
    const won = (me: number) => battleResult({ ...startBattle(bossSetup(dokkaebi)), end: 'win', me, meMax: 30 });
    expect(won(16)?.stars[1]).toBe(true);
    expect(won(15)?.stars[1]).toBe(false);
  });

  it('별 ③: 낸 문제(다시 나온 것은 처음 것만)의 3분의 2 이상 + 상성이 맞는 카드를 한 번 이상', () => {
    const base = { ...startBattle(bossSetup(dokkaebi)), end: 'win' as const };
    const strongPlay = [{ card: 'skill-reckon', affinity: 'strong' as const, right: true, power: 33, dealt: 33 }];
    const a = (q: string, right: boolean, again = false) => ({ q, right, again, strong: false });
    const star3 = (asked: Battle['asked'], plays = strongPlay) => battleResult({ ...base, asked, plays })?.stars[2];
    expect(star3([a('1', true), a('2', true), a('3', false)])).toBe(true);
    expect(star3([a('1', true), a('2', false)])).toBe(false);
    expect(star3([a('1', true), a('2', true), a('3', false)], [])).toBe(false);
    // 다시 나온 문제를 맞혀도 처음 것만 센다: 처음 여섯 가운데 셋(반) → 없음. 다시 나온 셋까지 세면 아홉 가운데 여섯(3분의 2)이 되지만 세지 않는다
    const firsts = [a('1', false), a('2', true), a('3', true), a('4', false), a('5', false), a('6', true)];
    expect(star3([...firsts, a('1', true, true), a('4', true, true), a('5', true, true)])).toBe(false);
    expect(star3([...firsts.slice(0, 3), a('1', true, true)])).toBe(true);
    expect(star3([])).toBe(false);
  });

  it('점수 = 고비에게 준 힘 + 맞힌 문제 × 10 + 남은 기운 × 2 + 별 × 50', () => {
    const b = {
      ...startBattle(bossSetup(dokkaebi)),
      end: 'win' as const,
      dealt: 90,
      me: 20,
      meMax: 31,
      asked: [
        { q: '1', right: true, again: false, strong: true },
        { q: '2', right: false, again: false, strong: false },
        { q: '3', right: true, again: false, strong: false },
        { q: '2', right: true, again: true, strong: false },
      ],
      plays: [{ card: 'skill-reckon', affinity: 'strong' as const, right: true, power: 33, dealt: 33 }],
    };
    const r = battleResult(b);
    expect(r?.stars).toEqual([true, true, true]);
    expect(r?.rightQuestions).toBe(3);
    expect(r?.score).toBe(90 + 3 * 10 + 20 * 2 + 3 * 50);
    expect(battleResult(startBattle(bossSetup(dokkaebi)))).toBeNull();
  });

  it('문제 은행이 비어도 돈다(문제 없이 기본 힘, 기세는 그대로)', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const run = autoBattle(bossSetup(dokkaebi, { seed }), NO_ASK, { order: 'strong', rightRate: 1, seed });
      expect(run.battle.end).toBeDefined();
      expect(run.battle.asked).toHaveLength(0);
      expect(run.battle.momentum).toBe(0);
      expect(battleResult(run.battle)?.stars[2]).toBe(false);
    }
  });
});

describe('막다른 판이 없음', () => {
  const orders: CardOrder[] = ['first', 'strong', 'weak', 'random'];
  const rates = [1, 0.8, 0.6, 0.3, 0];

  it('①-1 도깨비: 카드 차례 × 맞힘 비율 × 레벨(권장 1 → 1~3, 가장 약한 주인공) × 씨앗 — 모두 16차례 안에 끝나고 모두 틀려도 별 ①', () => {
    const heroes = [
      { level: 1 },
      { level: 2 },
      { level: 3 },
      { level: 1, body: 0 },
      { level: 1, deck: [...starter, ...fieldCards], gear: [hoe] },
    ];
    let runs = 0;
    let longest = 0;
    for (const hero of heroes) {
      for (const order of orders) {
        for (const rate of rates) {
          for (let seed = 1; seed <= 15; seed++) {
            const run = autoBattle(bossSetup(dokkaebi, { ...hero, seed }), askFor(seed), { order, rightRate: rate, seed });
            const r = battleResult(run.battle);
            expect(r, `${JSON.stringify(hero)} ${order} ${rate} ${seed}`).not.toBeNull();
            expect(r?.turns).toBeLessThanOrEqual(BALANCE.turnLimit);
            expect(r?.stars[0]).toBe(true);
            expect(run.mismatches).toEqual([]);
            longest = Math.max(longest, r?.turns ?? 0);
            runs++;
          }
        }
      }
    }
    expect(runs).toBe(5 * 4 * 5 * 15);
    expect(longest).toBeLessThanOrEqual(16);
  });

  it('지혜 겨루기를 다 틀려도 끝난다', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const run = autoBattle(bossSetup(dokkaebi, { seed }), askFor(seed), { order: 'strong', rightRate: 1, wisdomRate: 0, seed });
      expect(run.battle.end).toBeDefined();
      expect(run.battle.turn).toBeLessThanOrEqual(16);
    }
  });

  it('작은 고비(굳은 논흙): 방패 없이 3차례 안에 끝난다', () => {
    for (const order of orders) {
      for (const rate of rates) {
        for (let seed = 1; seed <= 15; seed++) {
          const run = autoBattle(bossSetup(hardsoil, { seed }), askFor(seed), { order, rightRate: rate, seed });
          expect(run.battle.end).toBeDefined();
          expect(run.battle.turn).toBeLessThanOrEqual(3);
          expect(run.battle.shield).toBe(0);
          expect(run.battle.phase).toBe(1);
          expect(run.battle.asked.filter((a) => !a.card)).toHaveLength(0);
        }
      }
    }
  });

  it('뒤 에피소드의 어림(기운 80 + 15L, 깎는 기운 4 + 0.8L, 정점 1.4배)으로 만든 고비 — 레벨 3·7·12·20·29', () => {
    for (const level of [3, 7, 12, 20, 29]) {
      for (const peak of [false, true]) {
        for (const order of ['first', 'strong', 'random'] as CardOrder[]) {
          for (const rate of [1, 0.6, 0]) {
            for (let seed = 1; seed <= 6; seed++) {
              const run = autoBattle(bossSetup(fakeBoss(level, peak, seed % 2 ? 'weighted' : 'cycle'), { level, seed }), askFor(seed), {
                order,
                rightRate: rate,
                seed,
              });
              const r = battleResult(run.battle);
              expect(r?.turns).toBeLessThanOrEqual(16);
              expect(r?.stars[0]).toBe(true);
              expect(run.mismatches).toEqual([]);
            }
          }
        }
      }
    }
  });
});

describe('상성이 실제로 빠르게 한다', () => {
  const average = (order: CardOrder, rate: number) => {
    let turns = 0;
    let dealt = 0;
    const n = 80;
    for (let seed = 1; seed <= n; seed++) {
      const run = autoBattle(bossSetup(dokkaebi, { seed }), askFor(seed), { order, rightRate: rate, seed, combo: 'none' });
      turns += run.battle.turn;
      dealt += run.battle.dealt / Math.max(1, run.battle.turn);
    }
    return { turns: turns / n, perTurn: dealt / n };
  };

  it('센 카드를 먼저 내면 차례가 줄고 한 차례에 준 힘이 는다(모두 맞힘·6할)', () => {
    for (const rate of [1, 0.6]) {
      const strong = average('strong', rate);
      const plain = average('first', rate);
      const weak = average('weak', rate);
      expect(strong.perTurn).toBeGreaterThan(plain.perTurn * 1.2);
      expect(plain.perTurn).toBeGreaterThan(weak.perTurn);
      if (rate === 1) {
        expect(strong.turns).toBeLessThan(plain.turns);
        expect(plain.turns).toBeLessThan(weak.turns);
      }
    }
  });

  it('같은 덱이라도 그 차례의 판에 맞는 갈래만 센 것이 된다(도깨비의 세 판)', () => {
    const b = startBattle(bossSetup(dokkaebi));
    const kinds = { riddle: 'skill-reckon', ssireum: 'skill-bund', work: 'skill-soil' } as const;
    for (const move of dokkaebi.moves) {
      const turn = { ...b, plan: { move: move.id, hit: 5, strong: move.strong } };
      for (const [id, cardId] of Object.entries(kinds)) expect(affinityOf(turn, cardId)).toBe(id === move.id ? 'strong' : 'weak');
    }
  });
});

describe('①-1의 숫자', () => {
  it('카드 열의 갈래가 도깨비의 세 판과 굳은 논흙에 센 것을 다 갖는다', () => {
    const kinds = new Set(cards41.filter((c) => starter.includes(c.id)).map((c) => c.kind));
    for (const move of dokkaebi.moves) expect(kinds.has(move.strong as string as never)).toBe(true);
    for (const kind of hardsoil.strong) expect(kinds.has(kind as never)).toBe(true);
  });

  it('이야기 문제 20의 앞 일곱이 핵심 물음이다(가짜 문제)', () => {
    expect(storyQuestions).toHaveLength(20);
    expect(episode41.core).toHaveLength(7);
  });
});
