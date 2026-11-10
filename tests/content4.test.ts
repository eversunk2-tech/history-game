// 4판 자료의 검사(src/content/validate4.ts, validate.ts의 walkEpisodes·계절 맵 걷기 — spec 11.1 다 "검사기가 더 볼 것")와 ①-1의 자료.
// ① 실제 4판 묶음(content/four.ts의 bundle4)이 잘못 0 ② 규칙마다 틀린 견본을 넣어 그 규칙이 잡는다
// ③ 맵·놀이가 읽는 농민 집 표시가 이름표(marks)에서 온다(1-라 Review 43번) ④ 꾸미기·옛이야기의 자료(11.1 사의 ㉡ 칸).

import { describe, expect, it } from 'vitest';
import { bundle, getPack } from '../src/content';
import { marks, plan, s1395_1 } from '../src/content/episodes/s1395';
import { bankSources } from '../src/content/bank/sources';
import { bundle4, four, mapRef4, maps4, seasonLooks, sources4, type LooksOf } from '../src/content/four';
import type { MapData } from '../src/map/types';
import { foes } from '../src/content/foes';
import { gear } from '../src/content/gear';
import { outfits } from '../src/content/outfits';
import { FLAGS } from '../src/content/situations/s1395/spring';
import { SUMMER } from '../src/content/situations/s1395/summer';
import { AUTUMN } from '../src/content/situations/s1395/autumn';
import { errorsOf, formatIssue, validateContent, walkEpisodes, type ContentBundle, type MapRef } from '../src/content/validate';
import { allWrongRun, cardsWithin, validateFour, type Content4 } from '../src/content/validate4';
import { skills } from '../src/content/skills';
import { SEASONS } from '../src/engine/types';
import { stripComments } from './sourceText';

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
/** four를 고친 묶음으로 4판 검사(validateFour)만 돌린 잘못의 규칙들 */
function rulesWith(edit: (f: Content4) => void): string[] {
  const f = clone(four);
  edit(f);
  return [...new Set(validateFour({ ...bundle4, four: f }).filter((i) => i.level === 'error').map((i) => i.rule))].sort();
}

describe('실제 4판 묶음', () => {
  it('검사기를 잘못 없이 통과한다(3판 검사 + 4판 검사 + 에피소드 걷기 + 계절 맵 걷기)', () => {
    const issues = validateContent(bundle4);
    expect(errorsOf(issues).map(formatIssue)).toEqual([]);
  }, 120_000);

  it('4판 검사의 알림은 아직 만들지 않은 곳뿐이다(은행에 아직 없는 서당 주제, 낫의 거두기 카드는 4-3)', () => {
    // 은행이 비었든 찼든 돈다: 은행 문제의 "비슷한 물음"(사람이 볼 것 — ㉮의 몫)은 빼고 본다
    const bankIds = new Set(four.topics.filter((t) => t.kind === 'bank').map((t) => t.id));
    const gaps = validateFour({ ...bundle4, four })
      .filter((i) => i.level === 'gap')
      .filter((g) => !(g.rule === 'ask-similar' && [...bankIds].some((id) => g.where.startsWith(`문제 ${id}-`))));
    const linked = [...new Set([...four.plans.flatMap((p) => p.episodes.flatMap((ep) => ep.topics)), ...four.skills.flatMap((s) => s.tags.filter((t) => t.startsWith('topic:')).map((t) => t.slice('topic:'.length)))])];
    const missing = linked.filter((id) => !bankIds.has(id));
    expect([...new Set(gaps.map((g) => g.rule))].sort()).toEqual(missing.length > 0 ? ['bank-empty', 'gear-idle'] : ['gear-idle']);
    // bank-empty는 은행에 아직 없는 주제만 가리킨다
    for (const g of gaps.filter((one) => one.rule === 'bank-empty')) expect(missing.some((id) => g.message.includes(`"${id}"`) || g.message.includes(`"topic:${id}"`)), g.message).toBe(true);
  });

  it('3판 묶음(지금 앱이 쓰는 것)에는 4판 자료가 없어 지금과 같게 검사한다', () => {
    expect(bundle.four).toBeUndefined();
    expect(bundle.maps.every((m) => m.canReachIn === undefined)).toBe(true);
  });

  it('근거 목록은 이야기의 근거와 은행의 근거를 합친 것이다', () => {
    expect(sources4.map((s) => s.id)).toEqual([...bundle.sources, ...bankSources].map((s) => s.id));
    expect(sources4.map((s) => s.id)).toEqual(expect.arrayContaining(['F71', 'F80', 'F82', 'F84', 'E9']));
  });
});

describe('계절의 맵도 걷는다(1-라 Review 43번)', () => {
  it('계절마다 맵의 모습: 봄 1 · 여름 3(맑은 해, 큰비 해 단오 앞뒤) · 가을 8(때 넷 × 큰물) · 겨울 1', () => {
    expect(SEASONS.map((s) => seasonLooks('neutigol', s).length)).toEqual([1, 3, 8, 1]);
  });

  it('농민 집 아이(두 모습)의 모든 일의 자리에 그 계절의 모든 모습에서 닿는다', () => {
    const pack = getPack('s1395')!;
    const map = maps4.find((m) => m.id === 'neutigol')!;
    let checked = 0;
    for (const h of pack.happenings) {
      for (const look of ['boy', 'girl'] as const) {
        if (h.shows?.look && h.shows.look !== look) continue;
        expect(map.canReachIn!(h.spot, { role: 'farmer', look }, h.season), `${h.id} ${look}`).toEqual([]);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(50);
  });

  it('걷기는 그 계절의 모습을 걷는다: 가을의 한 모습에서만 막힌 자리는 가을에 그 모습의 이름이 나오고, 봄에는 빈 목록이다', () => {
    // 꾸민 맵(가로 5 × 세로 3): 왼쪽 끝에서 서서 오른쪽 끝의 자리로 간다. 가을의 '꾸밈/가을/막힘' 모습만 가운데 줄이 막혔다
    const tiny = (name: string, wall: boolean) => {
      const w = 5;
      const h = 3;
      const blocked = new Uint8Array(w * h);
      if (wall) for (let y = 0; y < h; y++) blocked[y * w + 2] = 1;
      const map: MapData = {
        id: 'tiny', season: 'autumn', weather: 'clear', raining: false, w, h,
        terrain: new Uint8Array(w * h), blocked, objects: [], spots: [{ id: 'yard', at: [4, 1], stand: [4, 1], label: '마당' }],
        gates: [], zones: [], dwellers: [], notes: [], sights: [], start: { farmer: [0, 1] },
      };
      return { name, map };
    };
    const looks: LooksOf = (_id, season) =>
      season === 'autumn' ? [tiny('꾸밈/가을/트임', false), tiny('꾸밈/가을/막힘', true)] : [tiny(`꾸밈/${season}`, false)];
    const base: MapRef = { id: 'tiny', hasSpot: (spot) => spot === 'yard', canReach: () => true };
    const walk = mapRef4(base, looks);
    const who = { role: 'farmer', look: 'boy' } as const;
    expect(walk.canReachIn!('yard', who, 'autumn')).toEqual(['꾸밈/가을/막힘']);
    expect(walk.canReachIn!('yard', who, 'spring')).toEqual([]);
    expect(walk.canReachIn!('yard', who, 'winter')).toEqual([]);
    // 걸은 길을 기억해 둔 뒤에 다시 물어도 같다
    expect(walk.canReachIn!('yard', who, 'autumn')).toEqual(['꾸밈/가을/막힘']);
  });

  it('묶음의 걷기(maps4)는 계절마다 seasonLooks의 모습을 모두 걷는다(없는 자리를 물으면 그 계절의 모습 이름이 모두 나온다)', () => {
    const map = maps4.find((m) => m.id === 'neutigol')!;
    for (const season of SEASONS) {
      expect(map.canReachIn!('no-such-spot', { role: 'farmer', look: 'girl' }, season), season).toEqual(seasonLooks('neutigol', season).map((l) => l.name));
    }
  });

  it('어느 모습에서 닿지 못하면 잡는다(spot-unreachable)', () => {
    const blind: MapRef[] = bundle4.maps.map((m) => ({ ...m, canReachIn: (spot, _who, season) => (season === 'autumn' && spot === 'threshing' ? ['autumn/clear/done'] : []) }));
    const issues = validateContent({ ...bundle, maps: blind } as ContentBundle, { walk: false });
    expect(errorsOf(issues).filter((i) => i.rule === 'spot-unreachable').length).toBeGreaterThan(0);
    expect(errorsOf(issues).every((i) => i.rule === 'spot-unreachable')).toBe(true);
  });
});

describe('맵·놀이가 읽는 농민 집 표시는 에피소드 표의 이름표에서 온다(1-라 Review 43번)', () => {
  const SRC = import.meta.glob<string>(['../src/content/maps/neutigol.ts', '../src/content/maps/index.ts', '../src/plays/Harvest.tsx'], { eager: true, query: '?raw', import: 'default' });
  const source = (end: string) => stripComments(Object.entries(SRC).find(([p]) => p.endsWith(end))?.[1] ?? '');

  it('이름표의 값은 3판 그대로다(①의 일이 쓰는 표시 이름)', () => {
    expect(marks).toEqual({ leaveTend: 'leave.tend', leaveOurs: 'leave.ours', leaveBack: 'leave.back', harvestDone: 'harvest.done', danoDone: 'dano.done', sowLow: 'sow.low' });
    // 이야기 묶음이 남기는 표시와 같은 값(봄·여름·가을의 표시 이름표)
    expect(marks.sowLow).toBe(FLAGS.sowLow);
    expect(marks.danoDone).toBe(SUMMER.danoDone);
    expect([marks.leaveTend, marks.leaveOurs, marks.leaveBack, marks.harvestDone]).toEqual([AUTUMN.leaveTend, AUTUMN.leaveOurs, AUTUMN.leaveBack, AUTUMN.harvestDone]);
    expect(plan.marks).toBe(marks);
  });

  it('맵(neutigol.ts·maps/index.ts)과 가을걷이 놀이(Harvest.tsx)의 코드에 표시 이름의 글자가 없고 이름표를 읽는다', () => {
    for (const end of ['/maps/neutigol.ts', '/maps/index.ts', '/plays/Harvest.tsx']) {
      const text = source(end);
      expect(text.length, end).toBeGreaterThan(200);
      for (const flag of Object.values(marks)) expect(text, `${end} — ${flag}`).not.toContain(`'${flag}'`);
      expect(text, end).toMatch(/from '\.\.\/(episodes|content\/episodes)\/s1395'/);
    }
    expect(source('/maps/neutigol.ts')).toMatch(/const FLAG = \{ tend: marks\.leaveTend, ours: marks\.leaveOurs, back: marks\.leaveBack, harvest: marks\.harvestDone, dano: marks\.danoDone \} as const;/);
    expect(source('/maps/index.ts')).toMatch(/at\.flags \?\? \[marks\.leaveTend, marks\.leaveBack\]/);
    expect(source('/plays/Harvest.tsx')).toMatch(/const LOW_ONLY = marks\.sowLow;/);
  });

  it('검사기는 이름표의 값마다 그 이야기의 일이 실제로 남기는지 본다(marks)', () => {
    expect(rulesWith((f) => (f.plans[0].marks = { ...f.plans[0].marks, sowLow: 'sow.lower' }))).toEqual(['marks']);
  });
});

describe('규칙마다 틀린 견본을 잡는다 — 에피소드', () => {
  const ep = (f: Content4) => f.plans[0].episodes[0];
  it('꼭 할 일·덤·작은 고비의 자리가 묶음에 있고 그 계절이다', () => {
    expect(rulesWith((f) => ep(f).missions.push('s1395-m-dano'))).toEqual(['episode']);
    expect(rulesWith((f) => (ep(f).missions = []))).toEqual(['episode']);
    expect(rulesWith((f) => ep(f).extras.push('s1395-summer-news'))).toContain('episode');
    expect(rulesWith((f) => (ep(f).minors[0].at = 's1395-spring-nothing'))).toEqual(['episode']);
    expect(rulesWith((f) => (ep(f).minors[0].foe = 's1395-dokkaebi-bet'))).toEqual(['episode']);
  });
  it('덤이 해 ☀보다 많다', () => {
    expect(rulesWith((f) => (ep(f).suns = 4))).toEqual(['episode']);
  });
  it('정해 준 덱은 갈래마다 하나 이상, 카드는 그 이야기에 가져갈 수 있다(시대 잠김)', () => {
    expect(rulesWith((f) => (ep(f).starter = ['skill-bund', 'skill-carry', 'skill-reckon', 'skill-tithe', 'skill-soil']))).toEqual(['episode']);
    expect(rulesWith((f) => (f.skills.find((s) => s.id === 'skill-call')!.eras = ['s1446']))).toEqual(['eras']);
  });
  it('고비의 센 카드가 그 에피소드까지 얻을 수 있는 카드 안에 있다', () => {
    expect([...cardsWithin(plan, 's1395-1')].sort()).toEqual(skills.map((s) => s.id).sort());
    expect(rulesWith((f) => (f.foes.find((x) => x.id === 's1395-dokkaebi-bet')!.moves[0].strong = 'heart'))).toEqual([]);
    expect(rulesWith((f) => {
      ep(f).starter = ['skill-bund', 'skill-carry', 'skill-tithe', 'skill-reckon', 'skill-call', 'skill-soil'].filter((id) => id !== 'skill-soil').concat('skill-call');
      ep(f).skills = ep(f).skills.filter((s) => s.card !== 'skill-sow');
    })).toContain('foe-strong');
  });
  it('핵심 물음은 6~9개, 모두 이야기 문제 주제에 있고 core 꼬리표를 달았다', () => {
    expect(rulesWith((f) => (ep(f).core = ep(f).core.slice(0, 5)))).toContain('core');
    expect(rulesWith((f) => (ep(f).core[0] = 'ep-s1395-1-020'))).toEqual(['core']);
    expect(rulesWith((f) => (f.questions.find((q) => q.id === 'ep-s1395-1-001')!.tags = ['ep:s1395-1']))).toEqual(['core']);
  });
  it('의뢰 40자, 정령의 물음, 유물·보상', () => {
    expect(rulesWith((f) => (ep(f).goal = '가'.repeat(41)))).toEqual(['budget-goal']);
    expect(rulesWith((f) => (ep(f).ask = ''))).toEqual(['episode']);
    expect(rulesWith((f) => (ep(f).rewards.relics = ['relic-none']))).toEqual(['episode']);
  });
});

describe('규칙마다 틀린 견본을 잡는다 — 고비', () => {
  const dok = (f: Content4) => f.foes.find((x) => x.id === 's1395-dokkaebi-bet')!;
  it('예고 한 줄 30자, 할 일의 꼴', () => {
    expect(rulesWith((f) => (dok(f).moves[0].line = '가'.repeat(31)))).toEqual(['budget-intent']);
    expect(rulesWith((f) => (dok(f).moves[1].hit = [7, 5]))).toEqual(['foe']);
    expect(rulesWith((f) => (dok(f).moves[1].effect = 'explode' as never))).toEqual(['foe']);
  });
  it('옛이야기 고비: 표시(tale)와 근거(F70~F74), 정령의 "옛이야기야"가 먼저', () => {
    expect(rulesWith((f) => delete (dok(f) as { tale?: true }).tale)).toEqual(['tale']);
    expect(rulesWith((f) => (dok(f).facts = ['F34']))).toEqual(['tale']);
    expect(rulesWith((f) => dok(f).opening.reverse())).toEqual(['tale']);
  });
  it('실제 나라·사람 이름, "쓰러뜨린다", 쓰지 않는 각편·그림(뿔·호랑이 가죽·쇠못·혹부리)', () => {
    expect(rulesWith((f) => (dok(f).win[0].text = '왜군이 물러갔다.'))).toEqual(['real-name']);
    expect(rulesWith((f) => (dok(f).win[0].text = '도깨비를 쓰러뜨렸다.'))).toEqual(['fight-word']);
    expect(rulesWith((f) => (dok(f).opening[1].text = '뿔 달린 누군가가 나타났다.'))).toEqual(['tale-unused']);
    expect(rulesWith((f) => (dok(f).opening[1].text = '호랑이 가죽을 두른 누군가가 나타났다.'))).toEqual(['tale-unused']);
    expect(rulesWith((f) => (dok(f).rescue[0].text = '혹부리 영감이 왔다.'))).toEqual(['tale-unused']);
    expect(rulesWith((f) => (dok(f).rescue[0].text = '사람들이 뿔뿔이 흩어졌다가 다시 모였다.'))).toEqual([]);
  });
  it('정령의 한 창은 60자, 대화 한 창은 90자', () => {
    expect(rulesWith((f) => (dok(f).opening[0].text = `옛이야기야. ${'가'.repeat(60)}`))).toEqual(['budget-spirit']);
    expect(rulesWith((f) => (dok(f).win[1].text = '가'.repeat(91)))).toEqual(['budget-line']);
  });
  it('모두 틀려도 차례 한도 안에 끝나고 별 ①을 받는다(엔진으로 걸어 본다)', () => {
    for (const foe of foes) {
      const limit = foe.phases > 1 ? 16 : 3;
      for (const body of [0, 6]) {
        const run = allWrongRun(foe, skills, s1395_1.starter!, body, 7, 'first');
        expect(run.end, foe.id).toBeDefined();
        expect(run.turns, foe.id).toBeLessThanOrEqual(limit);
        expect(run.stars?.[0], foe.id).toBe(true);
      }
    }
  });
});

describe('규칙마다 틀린 견본을 잡는다 — 카드·장비·꾸미기·유물·거점·돈', () => {
  it('솜씨 카드: id·이름(3판 카드와 가름)·갈래·덧효과·기본 힘·꼬리표(문제 20 이상)·근거', () => {
    const card = (f: Content4) => f.skills[0];
    expect(rulesWith((f) => (card(f).id = 's1395-bund'))).toContain('card');
    expect(rulesWith((f) => (card(f).name = '궁궐 공사'))).toEqual(['card']);
    expect(rulesWith((f) => (card(f).name = '가'.repeat(13)))).toEqual(['budget-card']);
    expect(rulesWith((f) => (card(f).base = 13))).toEqual(['card']);
    expect(rulesWith((f) => (card(f).kind = 'luck' as never))).toContain('card');
    expect(rulesWith((f) => (card(f).tags = ['card:논둑']))).toEqual(['card']);
    // 문제들의 theme:duty도 지워, 은행이 무엇을 달든 그 꼬리표에 닿는 문제가 0이 되게 한다
    expect(rulesWith((f) => {
      card(f).tags = ['theme:duty'];
      for (const q of f.questions) q.tags = q.tags?.filter((t) => t !== 'theme:duty');
    })).toEqual(['card-tag']);
    expect(rulesWith((f) => (card(f).facts = ['F99']))).toEqual(['facts']);
    expect(rulesWith((f) => (card(f).text = '도깨비와 씨름하던 솜씨예요.'))).toEqual(['tale']);
  });
  it('장비: 시대 잠김(잠긴 까닭, 열린 이야기에 잠긴 것은 팔지 않는다 — 도리깨), 덧힘의 카드', () => {
    const flail = (f: Content4) => f.gear.find((g) => g.id === 'gear-flail')!;
    expect(rulesWith((f) => (flail(f).lock = ''))).toEqual(['gear']);
    expect(rulesWith((f) => (flail(f).price = { rice: 2, cloth: 0, coin: 0 }))).toEqual(['eras']);
    expect(rulesWith((f) => (f.gear[0].boost.cards = ['skill-none']))).toEqual(['gear']);
    expect(rulesWith((f) => (flail(f).lock = '가'.repeat(31)))).toEqual(['budget-lock']);
  });
  it('꾸미기: 근거가 있거나 "꾸민 차림"(쪽지에 밝힘), 빛깔·값의 꼴', () => {
    const real = (f: Content4) => f.outfits.find((o) => !o.made)!;
    const made = (f: Content4) => f.outfits.find((o) => o.made)!;
    expect(rulesWith((f) => (real(f).facts = []))).toEqual(['outfit']);
    expect(rulesWith((f) => (made(f).note = '조선 초의 저고리예요.'))).toEqual(['outfit']);
    expect(rulesWith((f) => (real(f).color = 'red'))).toEqual(['outfit']);
    expect(rulesWith((f) => (real(f).price = { rice: -1, cloth: 0, coin: 0 }))).toContain('outfit');
  });
  it('유물·거점', () => {
    expect(rulesWith((f) => (f.relics[0].facts = []))).toEqual(['facts']);
    expect(rulesWith((f) => (f.facilities = f.facilities.slice(1)))).toEqual(['hub']);
    expect(rulesWith((f) => (f.facilities[2].keeper = 'nobody'))).toEqual(['hub']);
    expect(rulesWith((f) => f.keepers.forEach((k) => (k.sex = 'm')))).toEqual(['hub']);
    expect(rulesWith((f) => (f.board[0].episode = 's1395-9'))).toEqual(['hub']);
    expect(rulesWith((f) => ((f.texts as { spirit: { intro: { text: string }[] } }).spirit.intro[0].text = '가'.repeat(61)))).toEqual(['budget-spirit']);
  });
  it('문제 전수 검사의 잘못도 함께 알린다(bankRules)', () => {
    // 이야기 문제를 id로 집는다(four.questions의 앞에는 은행 문제가 온다 — 은행이 차도 같은 문제를 본다)
    const story = (f: Content4) => f.questions.find((q) => q.id === 'ep-s1395-1-001')!;
    expect(rulesWith((f) => (story(f).answer = 9))).toEqual(['answer']);
    expect(rulesWith((f) => (story(f).facts = ['F99', 'E9']))).toEqual(['facts']);
  });
});

describe('에피소드의 일만 걷는다(walkEpisodes)', () => {
  it('실제 ①-1: 3판 걷기 검사와 "모든 길에서 작은 고비" 잘못 0', () => {
    expect(walkEpisodes(bundle.packs, four).map((i) => `${i.where}: ${i.message}`)).toEqual([]);
  }, 60_000);

  it('작은 고비를 지나지 않고 "큰 고비로"에 닿는 길이 있으면 잡는다(덤 자리에 둔 작은 고비)', () => {
    const f = clone(four);
    f.plans[0].episodes[0].minors[0].at = 's1395-spring-well';
    f.plans[0].episodes[0] = { ...f.plans[0].episodes[0] };
    const rules = [...new Set(walkEpisodes(bundle.packs, f).map((i) => i.rule))];
    expect(rules).toEqual(['minor-path']);
  }, 60_000);
});

describe('꾸미기·옛이야기의 자료(11.1 사의 ㉡ 칸)', () => {
  it('꾸미기 넷: 댕기 둘·저고리 둘, 항목마다 근거나 "꾸민 차림", 값은 댕기 베 1자·저고리 베 6자', () => {
    expect(outfits.filter((o) => o.part === 'ribbon')).toHaveLength(2);
    expect(outfits.filter((o) => o.part === 'jacket')).toHaveLength(2);
    for (const o of outfits) {
      expect(o.made || o.facts.length > 0, o.id).toBe(true);
      expect(o.price, o.id).toEqual(o.part === 'ribbon' ? { rice: 0, cloth: 1, coin: 0 } : { rice: 0, cloth: 6, coin: 0 });
    }
  });

  it('장비 셋: 호미·낫은 쌀 2되, 도리깨는 팔지 않고 ①에 잠긴다(F80)', () => {
    expect(gear.map((g) => g.id)).toEqual(['gear-hoe', 'gear-sickle', 'gear-flail']);
    expect(gear.find((g) => g.id === 'gear-hoe')!.price).toEqual({ rice: 2, cloth: 0, coin: 0 });
    const flail = gear.find((g) => g.id === 'gear-flail')!;
    expect(flail.price).toBeUndefined();
    expect(flail.eras).not.toContain('s1395');
    expect(flail.lock).toBe('이 시대의 기록에서 아직 찾지 못했어요');
    for (const g of gear) expect(g.facts).toContain('F80');
  });

  it('옛이야기 고비에는 tale과 근거가 있고, 삶의 고비에는 없다. 쓰지 않는 각편과 금지 낱말이 없다(검사기와 같은 셈)', () => {
    const tale = foes.filter((f) => f.kind === 'tale');
    expect(tale.map((f) => f.id)).toEqual(['s1395-dokkaebi-bet']);
    for (const f of tale) {
      expect(f.tale).toBe(true);
      expect(f.facts.some((x) => /^F7[0-4]$/.test(x))).toBe(true);
    }
    for (const f of foes.filter((x) => x.kind === 'life')) expect(f.tale).toBeUndefined();
    expect(validateFour({ ...bundle4, four }).filter((i) => i.level === 'error' && ['tale', 'tale-unused', 'banned', 'real-name', 'fight-word'].includes(i.rule))).toEqual([]);
  });
});
