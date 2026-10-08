// 콘텐츠 시험: 검사기가 실제 묶음을 잘못 없이 통과시키는지, 일부러 한 군데씩 망가뜨린 견본을 잡아내는지.
// 아직 만들지 않은 계절·역할·이야기는 잘못이 아니라 알림이다(목록으로 찍어 본다).

import { describe, expect, it } from 'vitest';
import { bundle, getPack, packs, shelf } from '../src/content';
import { catalog } from '../src/content/situations/catalog';
import {
  BANNED_WORDS,
  BUDGET,
  builtSeasons,
  countChars,
  errorsOf,
  findAllLocked,
  formatIssue,
  gapsOf,
  measureSeason,
  numbersIn,
  textsOfPack,
  validateContent,
  validatePack,
  walkRole,
  type ContentBundle,
  type Issue,
} from '../src/content/validate';
import { playableRoles } from '../src/engine/game';
import { drawValues } from '../src/engine/rng';
import { SEASONS, THEME_IDS, type Happening, type Mission, type SituationPack } from '../src/engine/types';
import { testBundle, testPack } from './fixtures';

const s1395 = getPack('s1395')!;

/** 견본을 베껴서 한 군데를 망가뜨린 뒤 검사한다(글과 꼴만 본다 — 걸어 보지 않아 빠르다) */
function broken(mutate: (pack: SituationPack) => void): Issue[] {
  const copy = structuredClone(testPack);
  mutate(copy);
  return validatePack(copy, testBundle, { walk: false });
}

/** 망가뜨린 뒤 엔진으로 걸어 보기까지 한다(막다른 길, 푸는 길의 수) */
function walked(mutate: (pack: SituationPack) => void): Issue[] {
  const copy = structuredClone(testPack);
  mutate(copy);
  return validatePack(copy, testBundle);
}

/** 견본 그대로를 검사한 것(걸어 보기까지) */
const baseIssues = validatePack(testPack, testBundle);

/** 곁 자료(카드·근거·맵 …)를 망가뜨린 묶음. 맵에는 함수가 있어 통째로 베끼지 않는다. */
function brokenBundle(mutate: (copy: ContentBundle) => void): Issue[] {
  const copy: ContentBundle = {
    ...testBundle,
    packs: [structuredClone(testPack)],
    catalog: structuredClone(testBundle.catalog),
    cards: structuredClone(testBundle.cards),
    items: structuredClone(testBundle.items),
    sources: structuredClone(testBundle.sources),
    places: structuredClone(testBundle.places),
    maps: [...testBundle.maps],
  };
  mutate(copy);
  return validateContent(copy, { walk: false });
}

const rules = (issues: Issue[]): string[] => errorsOf(issues).map((issue) => issue.rule);
const gapRules = (issues: Issue[], rule: string): Issue[] => gapsOf(issues).filter((issue) => issue.rule === rule);
const errorOf = (issues: Issue[], rule: string): Issue | undefined => errorsOf(issues).find((issue) => issue.rule === rule);

const hap = (pack: SituationPack, id: string): Happening => {
  const found = pack.happenings.find((h) => h.id === id);
  if (!found) throw new Error(`견본에 없는 일: ${id}`);
  return found;
};
const mis = (pack: SituationPack, id: string): Mission => {
  const found = pack.missions.find((m) => m.id === id);
  if (!found) throw new Error(`견본에 없는 미션: ${id}`);
  return found;
};
const long = (length: number) => '가'.repeat(length);
const lines = (count: number, each: number) => Array.from({ length: count }, () => ({ text: long(each) }));

// ── 실제 묶음 ─────────────────────────────────────────────────

describe('실제 묶음', () => {
  const issues = validateContent(bundle);

  it('검사기를 잘못 없이 통과한다', () => {
    expect(errorsOf(issues).map(formatIssue)).toEqual([]);
  });

  it('알림은 목록으로 찍힌다(아직 만들지 않은 것과 사람이 한 번 볼 것)', () => {
    const gaps = gapsOf(issues);
    console.log(['[검사기 알림]', ...gaps.map(formatIssue)].join('\n'));
    expect(gaps.every((gap) => gap.rule && gap.where && gap.message)).toBe(true);
    // 폴더가 아직 없는 이야기는 "준비 중"으로 알린다(이야기가 늘면 이 목록은 저절로 준다)
    const soon = catalog.filter((entry) => !packs.some((pack) => pack.situation.id === entry.id));
    expect(gapRules(issues, 'situation-soon').map((g) => g.where)).toEqual(soon.map((entry) => `catalog.ts ${entry.id}`));
  });

  it('근거 글에 없는 숫자가 실제 묶음에 하나도 없다(알림으로 찍기만 하지 않고 0건을 단언한다)', () => {
    expect(gapRules(issues, 'number-unsourced').map(formatIssue)).toEqual([]);
    // 검사기가 숫자를 보는 글에는 덤의 한마디도 들어 있다
    const lures = textsOfPack(s1395).filter((piece) => piece.field === 'lure');
    expect(lures.map((piece) => piece.where).sort()).toEqual(
      s1395.happenings.filter((h) => h.lure !== undefined).map((h) => `${h.id} 한마디`).sort(),
    );
    // 실제 묶음의 글에 근거에 없는 숫자를 하나 넣으면 잡힌다(이 단언이 헛돌지 않는다)
    const copy = structuredClone(s1395);
    copy.happenings.find((h) => h.id === 's1395-spring-well')!.lines[0].text = '1399년, 우물가에 사람들이 모였다.';
    const dirty = validatePack(copy, bundle, { walk: false });
    expect(gapRules(dirty, 'number-unsourced').map((g) => g.where)).toEqual(['s1395-spring-well 여는 대화 1번째 창']);
    // 그 일의 근거 글에 있는 숫자(F34의 1394)는 알리지 않는다
    copy.happenings.find((h) => h.id === 's1395-spring-well')!.lines[0].text = '1394년, 도읍을 옮겼다.';
    expect(gapRules(validatePack(copy, bundle, { walk: false }), 'number-unsourced')).toEqual([]);
  });

  it('덤으로 하는 일에는 모두 한마디(lure)가 있다: 24자 안이고, 빠졌다는 알림이 없다', () => {
    const extras = s1395.happenings.filter((h) => h.cost === 1);
    expect(extras.length).toBeGreaterThanOrEqual(4);
    for (const h of extras) {
      expect(h.lure?.trim().length, h.id).toBeGreaterThan(0);
      expect(countChars(h.lure ?? ''), h.id).toBeLessThanOrEqual(BUDGET.lure);
    }
    expect(gapRules(issues, 'lure-missing')).toEqual([]);
    expect(rules(issues)).not.toContain('budget-lure');
  });

  it('이야기책에는 일곱 이야기가 다 있고, 미션이 만들어진 역할이 있는 이야기만 열린다', () => {
    const items = shelf();
    expect(items.map((item) => item.id)).toEqual(['s1395', 's1446', 's1592', 's1636', 's1795', 's1863', 's1899']);
    for (const item of items) {
      const pack = getPack(item.id);
      expect(item.playable).toEqual(pack ? playableRoles(pack) : []);
      expect(item.ready).toBe(item.playable.length > 0);
    }
    // ① 1395년은 열려 있고 농민 집 아이는 봄을 할 수 있다(바퀴 1-다)
    expect(items[0].ready).toBe(true);
    expect(playableRoles(s1395)).toContain('farmer');
    expect(builtSeasons(s1395, 'farmer')[0]).toBe('spring');
  });

  it('만들지 않은 역할과 계절은 잘못이 아니라 알림이다', () => {
    for (const pack of packs) {
      const sid = pack.situation.id;
      const roles = pack.situation.roles.map((r) => r.id);
      const empty = roles.filter((id) => builtSeasons(pack, id).length === 0);
      const partial = roles.filter((id) => builtSeasons(pack, id).length > 0 && builtSeasons(pack, id).length < SEASONS.length);
      const mine = (rule: string) => gapRules(issues, rule).map((g) => g.where).filter((where) => where.startsWith(`${sid} `));
      expect(mine('role-empty')).toEqual(empty.map((id) => `${sid} ${id}`));
      expect(mine('season-soon')).toEqual(partial.map((id) => `${sid} ${id}`));
    }
  });

  it('시기 묶음 넷에 이야기가 2·2·2·1개씩 들어 있다', () => {
    const count = (group: string) => catalog.filter((entry) => entry.group === group).length;
    expect([count('early'), count('middle'), count('late'), count('opening')]).toEqual([2, 2, 2, 1]);
  });

  it('① 네 역할의 시작 수치와 해 ☀는 spec 7.1의 표와 같다', () => {
    const row = (id: string) => {
      const def = s1395.situation.roles.find((r) => r.id === id)!;
      return [def.label, def.start.living, def.start.body, def.start.trust, def.suns, def.looks];
    };
    expect(row('son')).toEqual(['양반 집 아들', 7, 6, 6, 3, ['boy']]);
    expect(row('daughter')).toEqual(['양반 집 딸', 7, 6, 6, 3, ['girl']]);
    expect(row('farmer')).toEqual(['농민 집 아이', 4, 6, 5, 3, ['boy', 'girl']]);
    expect(row('nobi')).toEqual(['노비 집 아이', 2, 6, 4, 2, ['boy', 'girl']]);
  });

  it('① 견주기 답 일곱 개가 빠짐없고, 날씨 이름은 "풍년"이라고 하지 않는다', () => {
    for (const theme of THEME_IDS) expect(s1395.situation.themes[theme].length).toBeGreaterThan(0);
    const labels = s1395.situation.draw.labels ?? {};
    expect(Object.keys(labels).sort()).toEqual([...drawValues('weather')].sort());
    for (const piece of textsOfPack(s1395)) expect(piece.text).not.toContain('풍년');
  });

  it('모든 일에 근거 번호가 있고, 무대에는 두 명까지 선다', () => {
    const ids = new Set(bundle.sources.map((source) => source.id));
    for (const h of s1395.happenings) {
      expect(h.facts.length).toBeGreaterThan(0);
      for (const fact of h.facts) expect(ids.has(fact)).toBe(true);
      expect((h.stage.cast ?? []).length).toBeLessThanOrEqual(2);
    }
  });

  it('① 봄의 글자 수와 시간 어림(분당 300자)을 찍어 본다', () => {
    for (const look of ['boy', 'girl'] as const) {
      const size = measureSeason(s1395, 'farmer', look);
      expect(size).not.toBeNull();
      if (!size) continue;
      const row = (name: string, p: { chars: number; happenings: number; plays: number; readMinutes: number; minutes: number }) =>
        `  ${name}: ${p.chars}자, 일 ${p.happenings}개(놀이 ${p.plays}) — 읽기 ${p.readMinutes}분, 걷기·놀이·계절 열고 닫기까지 ${p.minutes}분`;
      console.log(
        [
          `[① 봄 · 농민 집 아이(${look})의 글자 수와 시간 어림]`,
          row('꼭 푸는 미션만(짧은 길)', size.must.short),
          row('꼭 푸는 미션만(긴 길)  ', size.must.long),
          row('덤까지(짧은 길)        ', size.all.short),
          row('덤까지(긴 길)          ', size.all.long),
        ].join('\n'),
      );
      expect(size.season).toBe('spring');
      expect(size.must.short.chars).toBeLessThanOrEqual(size.must.long.chars);
      expect(size.must.long.chars).toBeLessThan(size.all.short.chars);
      expect(size.all.long.happenings - size.must.long.happenings).toBe(3); // 덤은 해 ☀ 셋만큼
      // spec 11절의 시간 기준(어림): 꼭 푸는 미션만 9분 안, 덤까지 13분 안
      expect(size.must.long.minutes).toBeLessThanOrEqual(9);
      expect(size.all.long.minutes).toBeLessThanOrEqual(13);
    }
  });

  it('실제 맵에 물려 있다: 없는 자리와, 농민 집 아이가 들어갈 수 없는 양반 댁 안마당을 잡아낸다', () => {
    const moved = (spot: string) => {
      const copy = structuredClone(s1395);
      copy.happenings.find((h) => h.season === 'spring' && h.cost === 1 && (!h.roles || h.roles.includes('farmer')))!.spot = spot;
      return errorsOf(validatePack(copy, bundle, { walk: false }))
        .filter((issue) => issue.where.includes('(farmer'))
        .map((issue) => [issue.rule, issue.where.replace(/^\S+ /, '')]);
    };
    expect(moved('nowhere')).toEqual([['spot-unknown', '(farmer)']]);
    expect(moved('innerYard')).toEqual([
      ['spot-unreachable', '(farmer/boy)'],
      ['spot-unreachable', '(farmer/girl)'],
    ]);
    // 일마다 자리가 맵에 있고, 두 모습 모두 걸어서 닿는다
    const map = bundle.maps.find((one) => one.id === s1395.situation.roles.find((r) => r.id === 'farmer')!.map)!;
    for (const h of s1395.happenings) {
      expect(map.hasSpot(h.spot), h.id).toBe(true);
      for (const look of ['boy', 'girl'] as const) expect(map.canReach(h.spot, { role: 'farmer', look }), `${h.id}/${look}`).toBe(true);
    }
  });

  it('막다른 길을 찾느라 걸어 본 횟수를 찍어 본다', () => {
    const walked = walkRole(s1395, 'farmer');
    console.log(`[걸어 보기] s1395 농민 집 아이: ${walked.walks}번 걸어 형편 ${walked.states}가지를 살폈다`);
    expect(walked.issues).toEqual([]);
    expect(walked.walks).toBeGreaterThanOrEqual(2 * 27); // 두 모습 × 수치의 모서리와 가운데
  });
});

// ── 견본 ─────────────────────────────────────────────────────

describe('견본', () => {
  const issues = validateContent(testBundle);

  it('견본은 잘못 없이 통과한다(그래야 망가뜨린 한 군데만 잡힌다)', () => {
    expect(errorsOf(issues).map(formatIssue)).toEqual([]);
  });

  it('만들지 않은 계절과 역할, 한 해가 다 차야 맞는 것은 알림이다', () => {
    expect(gapRules(issues, 'role-empty').map((g) => g.where)).toEqual(['t0001 son']);
    expect(gapRules(issues, 'season-soon').map((g) => [g.where, g.message])).toEqual([
      ['t0001 farmer', '아직 만들지 않은 계절: autumn, winter'],
      ['t0001 nobi', '아직 만들지 않은 계절: autumn, winter'],
    ]);
    expect(gapRules(issues, 'mission-count').map((g) => g.where)).toEqual(['t0001 farmer', 't0001 nobi']);
    expect(gapRules(issues, 'theme-coverage').map((g) => g.message.match(/"(\w+)"/)?.[1])).toEqual(['paying', 'inheritance', 'learning']);
    expect(builtSeasons(testPack, 'farmer')).toEqual(['spring', 'summer']);
    expect(builtSeasons(testPack, 'son')).toEqual([]);
  });

  it('남기기만 하고 읽히지 않는 표시를 알린다(뒤 계절이 읽을 수도 있어 알림이다)', () => {
    expect(gapRules(issues, 'flag-unread').map((g) => g.where).sort()).toEqual([
      't0001 표시 sow.even',
      't0001 표시 sow.helped',
      't0001 표시 weed.swap',
    ]);
    expect(gapRules(issues, 'flag-unread')[0].message).toContain('t-sow 놀이');
  });

  it('두 계절을 이어 걷는다(봄의 선택이 여름으로 넘어간다)', () => {
    const farmer = walkRole(testPack, 'farmer');
    const nobi = walkRole(testPack, 'nobi');
    expect(farmer.issues).toEqual([]);
    expect(nobi.issues).toEqual([]);
    expect(farmer.walks).toBeGreaterThan(nobi.walks); // 두 모습, 봄의 볍씨 선택 두 가지
  });

  it('글자 수와 시간 어림을 돌려준다', () => {
    const size = measureSeason(testPack, 'farmer', 'boy')!;
    expect(size.must.short.happenings).toBe(3);
    expect(size.must.short.plays).toBe(1);
    expect(size.all.long.happenings).toBe(6); // 꼭 푸는 미션의 일 셋 + 해 ☀ 셋만큼의 덤
    expect(size.must.short.readMinutes).toBe(Math.round((size.must.short.chars / 300) * 10) / 10);
    expect(size.must.short.minutes).toBeGreaterThan(size.must.short.readMinutes);
    expect(size.all.short.chars).toBeGreaterThan(size.must.long.chars);
    // 모습에 따라 여는 대화가 달라 글자 수도 다르다
    expect(measureSeason(testPack, 'farmer', 'girl')!.must.short.chars).not.toBe(size.must.short.chars);
  });
});

// ── 망가뜨린 자료 ──────────────────────────────────────────────

describe('글의 한도를 넘으면 잡아낸다', () => {
  it('글자 수는 빈칸과 문장 부호까지 센다', () => {
    expect(countChars('가 나, 다.')).toBe(7);
    expect(BUDGET).toMatchObject({ line: 90, openChars: 200, resultChars: 120, extraOpenChars: 120, extraResultChars: 80, label: 26, lockReason: 30, note: 50 });
    expect(BUDGET).toMatchObject({ intro: 100, seasonLine: 40, missionTitle: 18, missionGoal: 40, personLabel: 6, cardTitle: 12, cardText: 60 });
  });

  it('대화창 한 창 90자', () => {
    expect(rules(broken((p) => void (hap(p, 't-news').lines[0].text = long(91))))).toContain('budget-line');
    expect(rules(broken((p) => void (hap(p, 't-news').lines[0].text = long(90))))).not.toContain('budget-line');
    expect(rules(broken((p) => void (hap(p, 't-news').choices![0].lines[0].text = long(91))))).toContain('budget-line');
    expect(rules(broken((p) => void (hap(p, 't-news').lineVariants![0].lines[0].text = long(91))))).toContain('budget-line');
  });

  it('미션의 일: 여는 대화 다섯 창 200자, 결과 세 창 120자', () => {
    expect(rules(broken((p) => void (hap(p, 't-news').lines = lines(5, 40))))).toEqual([]);
    expect(rules(broken((p) => void (hap(p, 't-news').lines = lines(6, 10))))).toEqual(['budget-open']);
    expect(rules(broken((p) => void (hap(p, 't-news').lines = lines(5, 41))))).toEqual(['budget-open']);
    expect(rules(broken((p) => void (hap(p, 't-news').choices![0].lines = lines(3, 40))))).toEqual([]);
    expect(rules(broken((p) => void (hap(p, 't-news').choices![0].lines = lines(4, 10))))).toEqual(['budget-result']);
    expect(rules(broken((p) => void (hap(p, 't-help').after!.lines = lines(3, 41))))).toEqual(['budget-result']);
    // 갈린 결과도 센다
    expect(rules(broken((p) => void (hap(p, 't-sow').choices![0].variants![0].lines = lines(2, 61))))).toEqual(['budget-result']);
  });

  it('덤으로 하는 일: 여는 대화 세 창 120자, 결과 두 창 80자', () => {
    expect(rules(broken((p) => void (hap(p, 't-well').lines = lines(3, 40))))).toEqual([]);
    expect(rules(broken((p) => void (hap(p, 't-well').lines = lines(4, 10))))).toEqual(['budget-open']);
    expect(rules(broken((p) => void (hap(p, 't-well').lines = lines(3, 41))))).toEqual(['budget-open']);
    expect(rules(broken((p) => void (hap(p, 't-temple').after!.lines = lines(2, 40))))).toEqual([]);
    expect(rules(broken((p) => void (hap(p, 't-temple').after!.lines = lines(3, 10))))).toEqual(['budget-result']);
    expect(rules(broken((p) => void (hap(p, 't-well').choices![0].lines = lines(2, 41))))).toEqual(['budget-result']);
  });

  it('선택지 26자, 잠긴 까닭 30자, 배움 쪽지 50자', () => {
    expect(rules(broken((p) => void (hap(p, 't-news').choices![0].label = long(27))))).toEqual(['budget-label']);
    expect(rules(broken((p) => void (hap(p, 't-news').choices![0].label = long(26))))).toEqual([]);
    expect(rules(broken((p) => void (hap(p, 't-news').choices![2].lock!.reason = long(31))))).toEqual(['budget-lock']);
    expect(rules(broken((p) => void (hap(p, 't-news').note = `${long(50)}요`)))).toEqual(['budget-note']);
    expect(rules(broken((p) => void (hap(p, 't-news').note = `${long(49)}요`)))).toEqual([]);
  });

  it('덤의 한마디(lure) 24자', () => {
    expect(BUDGET.lure).toBe(24);
    expect(rules(broken((p) => void (hap(p, 't-well').lure = long(25))))).toEqual(['budget-lure']);
    expect(rules(broken((p) => void (hap(p, 't-well').lure = long(24))))).toEqual([]);
    expect(rules(broken((p) => void (hap(p, 't-well').lure = '아주머니가 한양 이야기를 한다더라')))).toEqual([]);
    const over = errorOf(broken((p) => void (hap(p, 't-woods').lure = `${long(20)} 가나, 다.`)), 'budget-lure'); // 빈칸과 문장 부호까지 27자
    expect(over?.where).toBe('t-woods 한마디');
    expect(over?.message).toContain('27자');
    // 미션의 일에 달아도 길이는 본다(쪽지에는 쓰이지 않는다)
    expect(rules(broken((p) => void (hap(p, 't-news').lure = long(25))))).toEqual(['budget-lure']);
  });

  it('소개 글 100자, 계절 첫 줄 40자, 미션 이름 18자·할 일 한 줄 40자, 이름표 6자', () => {
    expect(rules(broken((p) => void (p.situation.roles[0].intro = long(101))))).toEqual(['budget-intro']);
    expect(rules(broken((p) => void (p.situation.seasons.spring.line = long(41))))).toEqual(['budget-season']);
    expect(rules(broken((p) => void (p.situation.seasons.summer.lineVariants![0].line = long(41))))).toEqual(['budget-season']);
    expect(rules(broken((p) => void (mis(p, 'm-news').title = long(19))))).toEqual(['budget-mission']);
    expect(rules(broken((p) => void (mis(p, 'm-news').goal = long(41))))).toEqual(['budget-mission']);
    expect(rules(broken((p) => void (p.situation.people.elder.label = long(7))))).toEqual(['budget-person']);
    expect(rules(broken((p) => void (p.situation.people.elder.label = long(6))))).toEqual([]);
  });

  it('카드 이름 12자·글 60자, 이야기책의 한 줄 소개', () => {
    expect(rules(brokenBundle((b) => void (b.cards[0].title = long(13))))).toEqual(['budget-card']);
    expect(rules(brokenBundle((b) => void (b.cards[0].text = long(61))))).toEqual(['budget-card']);
    expect(rules(brokenBundle((b) => void (b.catalog[0].blurb = long(BUDGET.blurb + 1))))).toEqual(['budget-blurb']);
  });
});

describe('말과 근거를 잡아낸다', () => {
  it('쓰지 않기로 한 낱말', () => {
    for (const word of ['상놈', '왜놈', '정답', '점수', '실패', '미신', '매질', '맞았어요']) {
      expect(BANNED_WORDS.map((b) => b.word)).toContain(word);
    }
    const inLine = broken((p) => void (hap(p, 't-news').lines[0].text = '상놈이라고 부른다.'));
    expect(errorOf(inLine, 'banned-word')?.where).toBe('t-news 여는 대화 1번째 창');
    expect(rules(broken((p) => void (hap(p, 't-news').choices![0].lines[0].text = '정답을 맞혔다.')))).toContain('banned-word');
    expect(rules(broken((p) => void (hap(p, 't-news').choices![1].label = '점수를 딴다')))).toContain('banned-word');
    expect(rules(broken((p) => void (mis(p, 'm-news').doneLine = '맞았어요!')))).toContain('banned-word');
    expect(rules(broken((p) => void (p.situation.roles[0].wishOutcomes[1].reason = '실패했어요.')))).toContain('banned-word');
    expect(rules(broken((p) => void (p.situation.endings[0].title = '실패한 한 해')))).toContain('banned-word');
    expect(rules(brokenBundle((b) => void (b.catalog[0].title = '상놈 이야기')))).toContain('banned-word');
    // 덤의 한마디도 본다
    const inLure = broken((p) => void (hap(p, 't-well').lure = '정답을 알려 준다더라'));
    expect(rules(inLure)).toEqual(['banned-word']);
    expect(errorOf(inLure, 'banned-word')?.where).toBe('t-well 한마디');
    expect(rules(broken((p) => void (hap(p, 't-woods').lure = '오랑캐가 온다더라')))).toEqual(['banned-word']); // 쪽지가 아니므로 설명으로도 못 쓴다
  });

  it('낮추어 본 말을 설명하는 것은 배움 쪽지에서만 된다', () => {
    expect(rules(broken((p) => void (hap(p, 't-news').note = '그때는 오랑캐라고 낮추어 불렀어요.')))).toEqual([]);
    expect(rules(broken((p) => void (hap(p, 't-news').lines[0].text = '오랑캐가 온다.')))).toEqual(['banned-word']);
  });

  it('배움 쪽지가 "요"로 끝나지 않으면', () => {
    expect(rules(broken((p) => void (hap(p, 't-news').note = '나라가 농민을 돌려보냈다.')))).toEqual(['note-ending']);
    expect(rules(broken((p) => void (hap(p, 't-news').note = '나라가 농민을 돌려보냈어요!')))).toEqual([]);
    expect(rules(broken((p) => void (hap(p, 't-news').note = '')))).toEqual(['note']);
    // 선택에만 붙는 쪽지도 본다
    expect(rules(broken((p) => void (hap(p, 't-sow').choices![0].variants![1].note = '어른이 맡았다.')))).toEqual(['note-ending']);
  });

  it('근거 번호가 없거나 sources에 없는 번호이면', () => {
    expect(rules(broken((p) => void (hap(p, 't-well').facts = [])))).toEqual(['facts']);
    expect(rules(broken((p) => void (hap(p, 't-well').facts = ['F99'])))).toEqual(['facts']);
    expect(rules(broken((p) => void (p.situation.later![0].facts = ['F99'])))).toEqual(['facts']);
    expect(rules(broken((p) => void (p.situation.proof.themes.farming = ['F98'])))).toEqual(['facts']);
    expect(rules(brokenBundle((b) => void (b.cards[0].facts = ['F99'])))).toEqual(['facts']);
    expect(rules(brokenBundle((b) => void b.sources.push({ ...b.sources[0] })))).toEqual(['sources']);
  });

  it('잠긴 까닭이 없거나 사람을 탓하면', () => {
    expect(rules(broken((p) => void (hap(p, 't-news').choices![2].lock!.reason = '')))).toEqual(['lock-reason']);
    expect(rules(broken((p) => void (hap(p, 't-news').choices![2].lock!.reason = '네가 게을러서 안 돼요')))).toContain('lock-blame');
  });

  it('신분으로 잠그지 않는 이야기(⑦)에서 신분 잠김을 쓰면', () => {
    const issues = broken((p) => {
      p.situation.statusLocks = false;
      hap(p, 't-well').choices![1].lock = { unless: { anyOf: [{ roles: ['farmer'] }, { min: { body: 9 } }] }, reason: '주인댁 일이 먼저였어요' };
    });
    expect(rules(issues)).toEqual(['status-lock']);
  });
});

describe('자리와 사람을 잡아낸다', () => {
  it('맵에 없는 자리, 걸어서 닿을 수 없는 자리', () => {
    const none = broken((p) => void (hap(p, 't-well').spot = 'moon'));
    expect(rules(none)).toEqual(['spot-unknown', 'spot-unknown']); // 농민 집, 노비 집
    expect(errorOf(none, 'spot-unknown')?.message).toContain('"moon"');
    // 향교는 여자아이 모습과 노비 집 아이에게 막혀 있다: 두 모습 모두 닿아야 한다
    const blocked = broken((p) => void (hap(p, 't-sow').spot = 'school'));
    expect(errorsOf(blocked).map((i) => [i.rule, i.where])).toEqual([['spot-unreachable', 't-sow (farmer/girl)']]);
    const both = broken((p) => void (hap(p, 't-well').spot = 'school'));
    expect(errorsOf(both).map((i) => i.where)).toEqual(['t-well (farmer/girl)', 't-well (nobi/boy)']);
    expect(rules(broken((p) => void (hap(p, 't-well').spot = '')))).toEqual(['spot-unknown']);
  });

  it('고른 일을 마치러 갈 자리(goTo)가 맵에 없으면', () => {
    const issues = broken((p) => void (hap(p, 't-news').choices![0].goTo = 'moon'));
    expect(new Set(rules(issues))).toEqual(new Set(['spot-unknown']));
    expect(errorOf(issues, 'spot-unknown')?.message).toContain('goTo');
  });

  it('없는 맵을 무대로 삼으면', () => {
    expect(rules(broken((p) => void (p.situation.roles[0].map = 'atlantis')))).toContain('map-unknown');
    // 아직 만들지 않은 역할의 맵은 알림이다
    const soon = broken((p) => void (p.situation.roles[2].map = 'atlantis'));
    expect(rules(soon)).toEqual([]);
    expect(gapRules(soon, 'map-unknown').map((g) => g.where)).toEqual(['t0001 역할 son']);
  });

  it('등장인물 표에 없는 사람이 말하거나 무대에 서면', () => {
    const speaks = broken((p) => void (hap(p, 't-news').lines[1].who = 'stranger'));
    expect(errorsOf(speaks).map((i) => [i.rule, i.where])).toEqual([['who-unknown', 't-news 여는 대화 2번째 창']]);
    expect(rules(broken((p) => void (hap(p, 't-help').after!.lines[0].who = 'stranger')))).toEqual(['who-unknown']);
    expect(rules(broken((p) => void (hap(p, 't-news').stage.cast![0].who = 'stranger')))).toEqual(['who-unknown']);
  });

  it('무대에 세 사람이 서면', () => {
    expect(rules(broken((p) => void hap(p, 't-news').stage.cast!.push({ who: 'granny' })))).toEqual(['cast']);
  });
});

describe('선택지와 잠김을 잡아낸다', () => {
  it('어느 역할에게 보이는 선택지가 1개이거나 4개이면', () => {
    const four = walked((p) => void delete hap(p, 't-news').choices![3].only); // "주인댁 심부름"이 농민 집에도 보인다
    expect(errorsOf(four).map((i) => [i.rule, i.where])).toEqual([['choices-count', 't-news (farmer)']]);
    const one = broken((p) => void hap(p, 't-well').choices!.pop());
    expect(rules(one)).toEqual(['choices-count', 'choices-count']);
    expect(errorOf(one, 'choices-count')?.message).toContain('1개');
  });

  it('모든 선택지가 잠기는 수치가 있으면', () => {
    const issues = broken((p) => {
      hap(p, 't-well').choices![0].lock = { unless: { min: { trust: 3 } }, reason: '이웃과 아직 서먹해요' };
    });
    const issue = errorOf(issues, 'always-one-open');
    expect(issue?.where).toBe('t-well (farmer/boy)');
    expect(issue?.message).toContain('고를 수 있는 선택지가 없는 때가 있다');
    expect(issue?.message).toMatch(/기력 [0-2],/);
    expect(issue?.message).toMatch(/인심 [0-2],/);
  });

  it('서로 맞물려 언제나 하나는 열리는 잠김은 잘못이 아니다', () => {
    const fits = broken((p) => {
      const [story, greet] = hap(p, 't-granny').choices!;
      story.lock = { unless: { min: { trust: 6 } }, reason: '할머니는 아직 나를 잘 모르세요' };
      greet.lock = { unless: { max: { trust: 5 } }, reason: '벌써 인사를 드렸어요' };
    });
    expect(rules(fits)).toEqual([]);
    // 틈이 있으면 잡는다: 인심 5일 때는 둘 다 잠긴다
    const gapped = broken((p) => {
      const [story, greet] = hap(p, 't-granny').choices!;
      story.lock = { unless: { min: { trust: 6 } }, reason: '할머니는 아직 나를 잘 모르세요' };
      greet.lock = { unless: { max: { trust: 4 } }, reason: '벌써 인사를 드렸어요' };
    });
    expect(errorOf(gapped, 'always-one-open')?.message).toContain('인심 5');
  });

  it('"또는"·표시·물건·모습·뽑기가 얽힌 잠김도 모든 짝을 넣어 본다', () => {
    const h = structuredClone(hap(testPack, 't-granny'));
    const [story, greet] = h.choices!;
    // 견본 그대로: 인사는 늘 열려 있다
    expect(findAllLocked(h, { role: 'farmer', look: 'boy' }, [null])).toBeNull();
    greet.lock = { unless: { flags: ['news.help'] }, reason: '아직 뵌 적이 없어요' };
    // 표시가 없고 인심이 낮으면 둘 다 잠긴다
    expect(findAllLocked(h, { role: 'farmer', look: 'boy' }, [null])).toMatchObject({ flags: [], stats: { trust: 0 } });
    greet.lock = { unless: { look: 'girl' }, reason: '시험' };
    expect(findAllLocked(h, { role: 'farmer', look: 'girl' }, [null])).toBeNull();
    expect(findAllLocked(h, { role: 'farmer', look: 'boy' }, [null])).not.toBeNull();
    greet.lock = { unless: { draw: 'normal' }, reason: '시험' };
    story.lock = { unless: { items: ['firewood'] }, reason: '시험' };
    expect(findAllLocked(h, { role: 'farmer', look: 'boy' }, ['normal'])).toBeNull();
    expect(findAllLocked(h, { role: 'farmer', look: 'boy' }, ['drought', 'normal'])).toMatchObject({ draw: 'drought', items: [] });
    // 숨긴 선택지는 세지 않는다: 그 역할에게 보이는 것이 없으면 그것도 막힌 것이다
    story.only = ['nobi'];
    greet.only = ['nobi'];
    expect(findAllLocked(h, { role: 'farmer', look: 'boy' }, [null])).not.toBeNull();
    // 선택지가 없는 일은 볼 것이 없다
    expect(findAllLocked(hap(testPack, 't-temple'), { role: 'farmer', look: 'boy' }, [null])).toBeNull();
  });

  it('도움의 일이 있는 미션은 모든 선택지가 잠겨도 잘못이 아니다(견본의 볍씨 뿌리기)', () => {
    expect(findAllLocked(hap(testPack, 't-sow'), { role: 'farmer', look: 'boy' }, [null])).toMatchObject({ stats: { body: 0 } });
    expect(rules(baseIssues)).toEqual([]);
  });

  it('수치 변화가 한도를 벗어나면: 덤으로 하는 일은 -1~+1, 미션의 일은 -3~+3', () => {
    expect(rules(broken((p) => void (hap(p, 't-woods').after!.effects = { living: 2 })))).toEqual(['effect-range']);
    expect(rules(broken((p) => void (hap(p, 't-well').choices![1].effects = { body: -2, trust: 1 })))).toEqual(['effect-range']);
    expect(rules(broken((p) => void (hap(p, 't-well').choices![0].variants![0].effects = { trust: 2 })))).toEqual(['effect-range']);
    expect(rules(broken((p) => void (hap(p, 't-woods').after!.effects = { living: 1, body: -1 })))).toEqual([]);
    expect(rules(broken((p) => void (hap(p, 't-help').after!.effects = { body: -3, trust: 3 })))).toEqual([]);
    expect(rules(broken((p) => void (hap(p, 't-help').after!.effects = { body: -4 })))).toEqual(['effect-range']);
    expect(rules(broken((p) => void (hap(p, 't-help').after!.effects = { body: 1.5 })))).toEqual(['effect-range']);
    expect(rules(broken((p) => void (p.situation.later![1].effects = { living: -4 })))).toEqual(['effect-range']);
  });

  it('없는 카드·물건·표시·뽑기 값을 가리키면', () => {
    expect(rules(broken((p) => void (hap(p, 't-temple').after!.cards = ['nope'])))).toEqual(['card-unknown']);
    expect(rules(broken((p) => void (hap(p, 't-woods').after!.items = ['nope'])))).toContain('item-unknown');
    expect(rules(broken((p) => void (hap(p, 't-granny').choices![1].lock = { unless: { flags: ['typo'] }, reason: '시험' })))).toContain('flag-unknown');
    expect(rules(broken((p) => void (hap(p, 't-weed').lineVariants![0].when = { draw: 'flood' })))).toEqual(['draw-unknown']);
    expect(rules(broken((p) => void (p.situation.draw.labels!.flood = { label: '큰물', line: '큰물이 났다.' })))).toEqual(['draw-unknown']);
    // 어디서도 얻을 수 없는 물건을 조건으로 걸면
    const never = brokenBundle((b) => {
      b.items.push({ id: 'salt', label: '소금', text: '소금이에요.' });
      b.packs[0].happenings.find((h) => h.id === 't-fire')!.shows = { items: ['salt'] };
    });
    expect(errorOf(never, 'item-unknown')?.message).toContain('어디서도 얻을 수 없는 물건');
  });
});

describe('미션을 잡아낸다', () => {
  it('차시가 없으면', () => {
    expect(rules(broken((p) => void (mis(p, 'm-sow').lesson = '')))).toEqual(['lesson']);
  });

  it('미션의 일이나 도움의 일이 실제 일을 가리키지 않으면', () => {
    expect(rules(broken((p) => void mis(p, 'm-news').parts.push('t-nope')))).toEqual(['mission-parts']);
    expect(rules(broken((p) => void (mis(p, 'm-news').parts = [])))).toContain('mission-parts');
    expect(rules(broken((p) => void (mis(p, 'm-sow').rescue = 't-nope')))).toContain('mission-rescue');
    // 다른 계절의 일을 묶으면 그 계절에는 나타나지 않는다
    expect(rules(broken((p) => void mis(p, 'm-news').parts.push('t-weed')))).toContain('mission-parts');
  });

  it('도움의 일 하나를 두 미션이 함께 쓰면', () => {
    const issues = broken((p) => void (mis(p, 'm-news').rescue = 't-sow-rescue'));
    expect(errorOf(issues, 'mission-rescue')?.where).toBe('미션 m-sow');
  });

  it('한 일이 두 미션에 들어 있거나 두 일이 같은 자리를 쓰면 알린다', () => {
    const twice = broken((p) => void mis(p, 'm-stories').parts.push('t-help'));
    expect(gapRules(twice, 'mission-overlap').map((g) => g.where)).toEqual(['t-help']);
    const same = broken((p) => void (hap(p, 't-temple').spot = 'well'));
    expect(rules(same)).toEqual([]);
    expect(gapRules(same, 'spot-shared').map((g) => g.where)).toEqual(['t-well · t-temple']);
    // 견본에는 없다(같은 자리를 써도 계절이나 역할이 다르면 겹치지 않는다)
    expect(gapRules(baseIssues, 'spot-shared')).toEqual([]);
    expect(gapRules(baseIssues, 'mission-overlap')).toEqual([]);
  });

  it('아무 일도 하지 않았는데 풀려 있으면(풀림 조건이 비었으면)', () => {
    expect(rules(broken((p) => void (mis(p, 'm-sow').done = {})))).toContain('mission-done');
    expect(rules(broken((p) => void (mis(p, 'm-sow').done = { min: { living: 1 } })))).toContain('mission-done');
  });

  it('꼭 푸는 미션에 계절이 없으면', () => {
    expect(rules(broken((p) => void (mis(p, 'm-stories').must = true)))).toContain('mission');
  });

  it('막다른 미션: 도움의 일이 없으면 기력이 바닥일 때 볍씨 뿌리기를 풀 수 없다', () => {
    const issues = walked((p) => {
      delete mis(p, 'm-sow').rescue;
      p.happenings = p.happenings.filter((h) => h.id !== 't-sow-rescue');
    });
    expect(new Set(rules(issues))).toEqual(new Set(['always-one-open', 'dead-end']));
    const dead = errorOf(issues, 'dead-end');
    expect(dead?.where).toBe('t0001 farmer/boy spring');
    expect(dead?.message).toContain('「볍씨 뿌리기」');
    expect(dead?.message).toContain('처음 수치 살림 0·기력 0·인심 0');
    expect(dead?.message).toContain('(처음부터)');
    // 두 모습 모두에서 알린다
    expect(new Set(errorsOf(issues).filter((i) => i.rule === 'dead-end').map((i) => i.where))).toEqual(
      new Set(['t0001 farmer/boy spring', 't0001 farmer/girl spring']),
    );
    // 이웃이 거드는 일을 미션의 일로 넣으면(늘 나타나게 하면) 막다른 길은 없어진다. 선택지가 모두 잠기는 수치는 그대로 알린다.
    const open = walked((p) => {
      delete mis(p, 'm-sow').rescue;
      mis(p, 'm-sow').parts.push('t-sow-rescue');
    });
    expect(rules(open)).toEqual(['always-one-open']);
  });

  it('막다른 미션: 그 역할에게 없는 길로 들어설 수 있으면(숨겨야 할 선택지가 보이면)', () => {
    // "우리 집 일부터"는 농민 집의 일이다. 노비 집에도 보이면, 고른 뒤에 마치러 갈 일이 없다.
    const issues = walked((p) => void delete hap(p, 't-news').choices![1].only);
    expect(new Set(rules(issues))).toEqual(new Set(['choices-count', 'dead-end']));
    const dead = errorOf(issues, 'dead-end');
    expect(dead?.where).toBe('t0001 nobi/boy spring');
    expect(dead?.message).toContain('t-news/own');
  });

  it('막다른 미션: 고른 일을 마쳐도 풀림 표시가 남지 않으면', () => {
    const issues = walked((p) => void (hap(p, 't-own').after!.setFlags = []));
    expect(new Set(rules(issues))).toEqual(new Set(['flag-unknown', 'dead-end']));
    const dead = errorOf(issues, 'dead-end');
    expect(dead?.message).toContain('「돌아온 사람들」');
    expect(dead?.message).toContain('t-news/own');
  });

  it('막다른 미션: 걸어 다니다 얻은 것 때문에 길이 닫히면(덤이 미션을 막는 길)', () => {
    // 땔나무를 지고 있으면 논에 들어갈 수 없다고 해 보자: 뒷산에 먼저 다녀오면 볍씨 뿌리기가 영영 잠긴다
    const issues = walked((p) => {
      delete mis(p, 'm-sow').rescue;
      mis(p, 'm-sow').parts.push('t-sow-rescue');
      hap(p, 't-sow-rescue').shows = { notFlags: ['wood.carried'] };
      hap(p, 't-woods').after!.setFlags = ['wood.carried'];
      for (const choice of hap(p, 't-sow').choices!) choice.lock = { unless: { notFlags: ['wood.carried'] }, reason: '나뭇짐을 지고는 논에 들어갈 수 없어요' };
    });
    const dead = errorOf(issues, 'dead-end');
    expect(dead?.message).toContain('「볍씨 뿌리기」');
    expect(dead?.message).toContain('t-woods');
  });

  it('한쪽 모습에서만 풀리는 미션', () => {
    const issues = walked((p) => {
      for (const choice of hap(p, 't-weed').choices!) choice.lock = { unless: { look: 'boy' }, reason: '시험' };
    });
    expect(errorsOf(issues).filter((i) => i.rule === 'dead-end').every((i) => i.where === 't0001 farmer/girl summer')).toBe(true);
    expect(errorOf(issues, 'dead-end')?.message).toContain('「김매기」');
    expect(errorOf(issues, 'always-one-open')?.where).toBe('t-weed (farmer/girl)');
  });

  it('푸는 길이 하나뿐이거나 어느 길로 풀어도 결과가 같으면(답을 맞히는 미션이 된다)', () => {
    const one = walked((p) => {
      const h = hap(p, 't-errand');
      h.after = { setFlags: ['errand.done'], lines: [{ text: '심부름을 마쳤다.' }] };
      delete h.choices;
    });
    expect(errorsOf(one).map((i) => [i.rule, i.where])).toEqual([['mission-one-way', '미션 m-errand (nobi)']]);
    const same = walked((p) => {
      const [quick, slow] = hap(p, 't-errand').choices!;
      slow.effects = quick.effects;
      slow.lines = quick.lines;
    });
    expect(errorOf(same, 'mission-one-way')?.message).toContain('결과');
  });

  it('해 ☀: 꼭 푸는 미션의 일이 해를 쓰거나, 덤으로 하는 일이 해를 쓰지 않으면', () => {
    expect(rules(broken((p) => void (hap(p, 't-help').cost = 1)))).toContain('cost');
    expect(rules(broken((p) => void (hap(p, 't-well').cost = 0)))).toContain('cost');
  });

  it('덤으로 하는 일이 해 ☀보다 많지 않으면(고를 것이 없다)', () => {
    const issues = broken((p) => {
      p.happenings = p.happenings.filter((h) => !['t-fire', 't-woods'].includes(h.id));
    });
    expect(errorsOf(issues).map((i) => [i.rule, i.where])).toEqual([['extras-count', 't0001 farmer spring']]); // 덤 셋, 해 셋
    expect(errorOf(issues, 'extras-count')?.message).toContain('3개');
  });

  it('봄이 비었는데 뒤 계절의 미션이 있으면', () => {
    const issues = broken((p) => {
      mis(p, 'm-news').roles = ['farmer'];
      mis(p, 'm-errand').season = 'summer';
      hap(p, 't-errand').season = 'summer';
    });
    expect(errorOf(issues, 'season-order')?.where).toBe('t0001 nobi');
  });
});

describe('이야기의 뼈대를 잡아낸다', () => {
  it('시작 수치, 한 해 이름, 바람을 가릴 줄이 어긋나면', () => {
    expect(rules(broken((p) => void (p.situation.roles[1].start.living = 11)))).toContain('start-range');
    expect(rules(broken((p) => void (p.situation.endings[p.situation.endings.length - 1].when = { min: { living: 1 } })))).toEqual(['endings']);
    expect(rules(broken((p) => void p.situation.roles[0].wishOutcomes.pop()))).toEqual(['wish']);
    expect(rules(broken((p) => void (p.situation.roles[0].looks = [])))).toContain('roles');
    expect(rules(broken((p) => void (p.situation.roles[0].suns = 0)))).toContain('roles');
  });

  it('한 해 이름과 바람이 비어 있는 것은 한 해를 다 만들 때까지 알림이다', () => {
    const issues = broken((p) => {
      p.situation.endings = [];
      p.situation.roles[0].wishOutcomes = [];
    });
    expect(rules(issues)).toEqual([]);
    expect(gapRules(issues, 'endings')).toHaveLength(1);
    expect(gapRules(issues, 'wish').map((g) => g.where)).toEqual(['t0001 역할 farmer']);
  });

  it('일곱 물음의 답, 이야기 목록, 뽑기, 계절 첫 줄이 어긋나면', () => {
    expect(rules(broken((p) => void (p.situation.themes.marriage = '')))).toEqual(['themes']);
    expect(rules(broken((p) => void (p.situation.year = 1400)))).toEqual(['catalog']);
    expect(rules(broken((p) => void (p.situation.draw = { kind: 'weather' })))).toContain('draw');
    expect(rules(broken((p) => void (p.situation.seasons.spring.line = '')))).toEqual(['season-line']);
    // 아직 만들지 않은 계절의 첫 줄은 알림이다
    const soon = broken((p) => void (p.situation.seasons.winter.line = ''));
    expect(rules(soon)).toEqual([]);
    expect(gapRules(soon, 'season-line')).toHaveLength(1);
  });

  it('다른 이야기의 일이 섞이거나 id가 겹치면', () => {
    expect(rules(broken((p) => void (hap(p, 't-well').situation = 's1446')))).toContain('happening');
    expect(rules(broken((p) => void (hap(p, 't-well').id = 't-temple')))).toContain('happening');
    expect(rules(broken((p) => void (mis(p, 'm-sow').id = 'm-news')))).toContain('mission');
    expect(rules(broken((p) => void (mis(p, 'm-sow').roles = ['king'])))).toContain('mission');
  });

  it('등장인물의 성별·나이대가 빠지면 잘못, 한쪽으로 쏠리면 알림', () => {
    expect(rules(broken((p) => void ((p.situation.people.elder as { sex: string }).sex = '')))).toEqual(['people']);
    const tilted = broken((p) => {
      for (const id of ['mother', 'granny']) p.situation.people[id].sex = 'm';
    });
    expect(rules(tilted)).toEqual([]);
    expect(gapRules(tilted, 'people-balance')[0].message).toContain('남 5, 여 1');
    expect(gapRules(baseIssues, 'people-balance')).toEqual([]);
  });
});

describe('알림(잘못은 아니지만 사람이 한 번 볼 것)', () => {
  it('표시를 읽는 조건이 생기면 알림이 없어진다', () => {
    const issues = broken((p) => {
      hap(p, 't-weed').choices![2].variants = [
        { when: { flags: ['sow.helped'] }, effects: { living: -1 }, setFlags: ['weed.done'], lines: [{ text: '이웃이 또 거들어 주었다.' }] },
      ];
    });
    expect(rules(issues)).toEqual([]);
    expect(gapRules(issues, 'flag-unread').map((g) => g.where)).not.toContain('t0001 표시 sow.helped');
  });

  it('뒤에 만들 것이 읽는 표시(한 해 이름, 바람, 덤 미션)는 아직 남기는 곳이 없어도 알림이다', () => {
    const issues = broken((p) => {
      p.situation.endings[0].when = { flags: ['winter.done'] };
      mis(p, 'm-stories').done = { flags: ['story.granny', 'story.temple', 'story.autumn'] };
    });
    expect(rules(issues)).toEqual([]);
    expect(gapRules(issues, 'flag-unknown').map((g) => g.where)).toEqual(['t0001 한 해 이름 empty', '미션 m-stories 풀림 조건']);
    // 지금 쓰이는 일이 읽는 표시는 잘못이다
    expect(rules(broken((p) => void (hap(p, 't-fire').shows = { flags: ['winter.done'] })))).toEqual(['flag-unknown']);
  });

  it('대화·결과·쪽지의 숫자가 그 일의 근거 글에 없으면 알린다', () => {
    expect(numbersIn('1394년 12월~1395년 9월, 66,067명')).toEqual(['1394', '12', '1395', '9', '66067']);
    const issues = broken((p) => void (hap(p, 't-news').lines[0].text = '1399년 봄, 궁궐을 짓는다.'));
    expect(rules(issues)).toEqual([]);
    expect(gapRules(issues, 'number-unsourced').map((g) => g.where)).toEqual(['t-news 여는 대화 1번째 창']);
    expect(gapRules(issues, 'number-unsourced')[0].message).toContain('"1399"');
    // 근거 글에 있는 숫자는 알리지 않는다
    const sourced = brokenBundle((b) => {
      b.sources[0].fact = '1399년에 있었던 일';
      b.packs[0].happenings.find((h) => h.id === 't-news')!.lines[0].text = '1399년 봄, 궁궐을 짓는다.';
    });
    expect(gapRules(sourced, 'number-unsourced')).toEqual([]);
  });

  it('갈린 결과가 바탕 결과의 카드·표시·물건·갈 자리를 빠뜨리면 알린다', () => {
    const issues = broken((p) => void delete hap(p, 't-give').after!.variants![0].cards);
    expect(rules(issues)).toEqual([]);
    expect(gapRules(issues, 'variant-drops').map((g) => g.where)).toEqual(['t-give 결과 결과 갈림 1']);
    expect(gapRules(issues, 'variant-drops')[0].message).toContain('카드 "c1"');
    const goTo = broken((p) => {
      hap(p, 't-news').choices![0].variants = [{ when: { min: { trust: 9 } }, setFlags: ['news.go.help'], lines: [{ text: '다들 반긴다.' }] }];
    });
    expect(gapRules(goTo, 'variant-drops')[0].message).toContain('갈 자리 "neighbor"');
  });

  it('인심이 깎이는 선택이나 살림·기력 잠김이 없으면 알린다(봄 한 철뿐이라 잘못으로 치지 않는다)', () => {
    const issues = broken((p) => {
      hap(p, 't-own').after!.effects = { living: 1 };
      hap(p, 't-sow-rescue').after!.effects = {};
      delete hap(p, 't-news').choices![2].lock;
    });
    expect(rules(issues)).toEqual([]);
    expect(gapRules(issues, 'trust-loss').map((g) => g.where)).toEqual(['t0001 farmer']);
    expect(gapRules(issues, 'stat-lock').map((g) => [g.where, g.message])).toEqual([
      ['t0001 farmer', '살림 때문에 잠기는 선택지가 하나도 없다'],
      ['t0001 nobi', '살림 때문에 잠기는 선택지가 하나도 없다'],
    ]);
    expect(gapRules(baseIssues, 'trust-loss')).toEqual([]);
    expect(gapRules(baseIssues, 'stat-lock')).toEqual([]);
  });

  it('덤으로 하는 일에 한마디(lure)가 없으면 알린다(잘못은 아니다 — 쪽지에 자리 이름만 뜬다)', () => {
    // 견본의 덤에는 한마디를 달지 않았다: 덤으로 하는 일(cost 1)마다 알림이 하나씩 뜨고, 미션의 일과 도움의 일에는 뜨지 않는다
    const extras = testPack.happenings.filter((h) => h.cost === 1).map((h) => h.id);
    expect(extras.length).toBeGreaterThan(4);
    expect(gapRules(baseIssues, 'lure-missing').map((g) => g.where)).toEqual(extras);
    expect(rules(baseIssues)).toEqual([]);
    // 달면 그 일의 알림이 없어진다
    const one = broken((p) => void (hap(p, 't-well').lure = '우물가에 소문이 돈다더라'));
    expect(rules(one)).toEqual([]);
    expect(gapRules(one, 'lure-missing').map((g) => g.where)).toEqual(extras.filter((id) => id !== 't-well'));
    // 빈칸뿐인 한마디는 없는 것으로 친다
    const blank = broken((p) => void (hap(p, 't-well').lure = '   '));
    expect(gapRules(blank, 'lure-missing').map((g) => g.where)).toContain('t-well');
    // 실제 묶음에서 한 군데를 지우면 그 일이 잡힌다
    const copy = structuredClone(s1395);
    delete copy.happenings.find((h) => h.id === 's1395-spring-woods')!.lure;
    const real = validatePack(copy, bundle, { walk: false });
    expect(rules(real)).toEqual([]);
    expect(gapRules(real, 'lure-missing').map((g) => g.where)).toEqual(['s1395-spring-woods']);
  });

  it('한마디에 적힌 숫자도 근거 글에 있는지 본다', () => {
    const issues = broken((p) => void (hap(p, 't-well').lure = '1399년 이야기를 한다더라'));
    expect(rules(issues)).toEqual([]);
    expect(gapRules(issues, 'number-unsourced').map((g) => g.where)).toEqual(['t-well 한마디']);
  });

  it('아직 쓰이지 않는 일(만들지 않은 계절의 것)은 알림이다', () => {
    const issues = broken((p) => void (hap(p, 't-summer-4').season = 'autumn'));
    expect(gapRules(issues, 'happening-idle').map((g) => g.where)).toEqual(['t-summer-4']);
    expect(errorsOf(issues).map((i) => [i.rule, i.where])).toEqual([['extras-count', 't0001 farmer summer']]); // 여름의 덤 셋, 농민 집의 해 셋
  });
});

describe('한 해가 다 만들어지면', () => {
  /** 견본에 가을·겨울의 꼭 푸는 미션을 하나씩 더해 한 해를 채운다(양반 집 아들은 뺀다) */
  function fullYear(): SituationPack {
    const copy = structuredClone(testPack);
    copy.situation.roles = copy.situation.roles.filter((r) => r.id !== 'son');
    for (const season of ['autumn', 'winter'] as const) {
      const weed = structuredClone(hap(copy, 't-weed'));
      const id = `t-${season}`;
      copy.happenings.push({
        ...weed,
        id,
        season,
        lineVariants: [],
        choices: weed.choices!.map((c) => ({ ...c, variants: [], setFlags: [`${season}.done`] })),
      });
      copy.missions.push({ ...structuredClone(mis(copy, 'm-weed')), id: `m-${season}`, season, parts: [id], done: { flags: [`${season}.done`] } });
    }
    return copy;
  }

  it('알림이던 것이 잘못이 된다: 미션 수, 일곱 물음, 읽히지 않는 표시', () => {
    const full = fullYear();
    expect(SEASONS.every((season) => builtSeasons(full, 'farmer').includes(season))).toBe(true);
    const issues = validatePack(full, testBundle);
    expect(errorsOf(issues).filter((i) => i.rule === 'mission-count').map((i) => i.where)).toEqual(['t0001 farmer', 't0001 nobi']);
    expect(errorsOf(issues).filter((i) => i.rule === 'theme-coverage')).toHaveLength(3);
    expect(errorsOf(issues).filter((i) => i.rule === 'flag-unread').map((i) => i.where)).toContain('t0001 표시 sow.even');
    expect(gapRules(issues, 'season-soon')).toEqual([]);
    // 한 해 이름과 바람도 이제는 있어야 한다
    full.situation.endings = [];
    full.situation.roles[0].wishOutcomes = [];
    expect(rules(validatePack(full, testBundle, { walk: false }))).toEqual(expect.arrayContaining(['endings', 'wish']));
  });
});
