// 콘텐츠 시험: 검사기가 실제 묶음을 잘못 없이 통과시키는지, 일부러 한 군데씩 망가뜨린 견본을 잡아내는지.
// 아직 만들지 않은 계절·역할·이야기는 잘못이 아니라 알림이다(목록으로 찍어 본다).
// 바퀴 1-라: ① 농민 집 아이의 네 계절이 다 찼다. "한 해가 다 차야 맞는 것"이 그 역할에게는 잘못으로 바뀌는지,
// 한 해의 글자 수와 어림 시간이 얼마인지 본다(다른 세 집은 아직 없어 알림으로 남는다).

import { describe, expect, it } from 'vitest';
import { bundle, getPack, packs, shelf } from '../src/content';
import { four } from '../src/content/four';
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
import { missionsOf, playableRoles } from '../src/engine/game';
import { drawValues } from '../src/engine/rng';
import { SEASONS, THEME_IDS, type Condition, type Happening, type Look, type Mission, type Season, type SituationPack } from '../src/engine/types';
import { advance, playMusts, testBundle, testPack, toSeason } from './fixtures';

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
    // 일마다 자리가 맵에 있고, 그 일이 나타나는 모습으로 걸어서 닿는다(한쪽 모습에만 나타나는 일은 그 모습으로만 본다)
    const map = bundle.maps.find((one) => one.id === s1395.situation.roles.find((r) => r.id === 'farmer')!.map)!;
    for (const h of s1395.happenings) {
      expect(map.hasSpot(h.spot), h.id).toBe(true);
      for (const look of ['boy', 'girl'] as const) {
        if (h.shows?.look && h.shows.look !== look) continue;
        expect(map.canReach(h.spot, { role: 'farmer', look }), `${h.id}/${look}`).toBe(true);
      }
    }
  });

  it('향교 가는 길은 남자아이 모습만 닿는다: 「겨울 글공부」의 두 일이 모습에 따라 자리가 다르다', () => {
    const map = bundle.maps.find((one) => one.id === 'neutigol')!;
    const boys = s1395.happenings.find((h) => h.id === 's1395-winter-letters')!;
    const girls = s1395.happenings.find((h) => h.id === 's1395-winter-letters-girl')!;
    expect([boys.shows, girls.shows]).toEqual([{ look: 'boy' }, { look: 'girl' }]);
    expect(boys.spot).toBe('hyanggyoRoad');
    expect(girls.spot).not.toBe(boys.spot);
    expect(map.canReach(boys.spot, { role: 'farmer', look: 'boy' })).toBe(true);
    expect(map.canReach(boys.spot, { role: 'farmer', look: 'girl' })).toBe(false); // 여자아이 모습에게는 막혀 있다
    expect(map.canReach(girls.spot, { role: 'farmer', look: 'girl' })).toBe(true);
    // 남자아이의 일을 두 모습 모두에게 나타나게 하면(shows를 지우면) 여자아이 모습이 닿지 못해 잡힌다
    const copy = structuredClone(s1395);
    delete copy.happenings.find((h) => h.id === 's1395-winter-letters')!.shows;
    const issues = errorsOf(validatePack(copy, bundle, { walk: false }));
    expect(issues.map((i) => [i.rule, i.where])).toContainEqual(['spot-unreachable', 's1395-winter-letters (farmer/girl)']);
  });

  it('막다른 길을 찾느라 걸어 본 횟수를 찍어 본다(네 계절을 이어 걷는다 — 한도에 걸리지 않는다)', () => {
    const walked = walkRole(s1395, 'farmer');
    console.log(`[걸어 보기] s1395 농민 집 아이: ${walked.walks}번 걸어 형편 ${walked.states}가지를 살폈다`);
    expect(walked.issues).toEqual([]); // 막다른 길도, "길이 너무 많아 다 걷지 못했다"는 알림도 없다
    expect(gapRules(issues, 'walk-capped')).toEqual([]);
    // 두 모습 × (봄: 뽑기 전 / 여름~겨울: 날씨 셋) × 앞선 선택 × (덤까지 모든 길 + 수치의 모서리와 가운데 스물일곱)
    expect(walked.walks).toBeGreaterThanOrEqual(2 * 29 + 3 * 2 * 3 * 30);
  }, 60000);

  it('① 농민 집 아이의 한 해가 다 찼다: 꼭 푸는 미션 여덟(계절마다 둘), 미션으로 만나는 물음 여섯', () => {
    expect(builtSeasons(s1395, 'farmer')).toEqual([...SEASONS]);
    const musts = missionsOf(s1395, 'farmer').filter((m) => m.must);
    expect(musts.map((m) => [m.season, m.title])).toEqual([
      ['spring', '돌아온 사람들, 떠나는 스님들'],
      ['spring', '볍씨 뿌리기'],
      ['summer', '단오 놀이판'],
      ['summer', '김매기'],
      ['autumn', '한양으로 떠난 장정들'],
      ['autumn', '가을걷이와 나라 몫'],
      ['winter', '할아버지의 제삿날'],
      ['winter', '겨울 글공부'],
    ]);
    expect(missionsOf(s1395, 'farmer').filter((m) => !m.must).map((m) => [m.id, m.season])).toEqual([
      ['s1395-m-tales', 'year'],
      ['s1395-m-cards', 'year'],
    ]);
    // spec 6.3: 농민 집 아이만 혼인을 미션으로 만나지 못한다(평민의 혼인 풍습은 자료가 사대부 중심이다). 나머지 여섯 물음은 꼭 푸는 미션이 다룬다.
    expect(new Set(musts.map((m) => m.theme))).toEqual(new Set(THEME_IDS.filter((theme) => theme !== 'marriage')));
    expect(gapRules(issues, 'theme-role').map((g) => [g.where, g.message])).toEqual([
      ['s1395 farmer', '이 역할이 미션으로 만나지 못하는 견주기 물음: "marriage"'],
    ]);
    // 미션마다 차시가 달려 있고, 미션과 일에 역할(농민 집)이 적혀 있다
    for (const m of s1395.missions) {
      expect(m.lesson, m.id).toMatch(/차시/);
      expect(m.roles, m.id).toEqual(['farmer']);
    }
    for (const h of s1395.happenings) expect(h.roles, h.id).toEqual(['farmer']);
  });

  it('실제 묶음의 알림은 아직 만들지 않은 것과, 봄보다 가볍게 잡은 덤뿐이다', () => {
    expect(new Set(gapsOf(issues).map((g) => g.rule))).toEqual(
      new Set(['situation-soon', 'role-empty', 'extras-few', 'status-lock-missing', 'theme-coverage', 'theme-role']),
    );
    expect(gapRules(issues, 'role-empty').map((g) => g.where)).toEqual(['s1395 son', 's1395 daughter', 's1395 nobi']);
    // 여름과 가을의 덤은 셋(여름의 하나는 큰비가 온 해에만 나타난다), 겨울은 넷이다. 해 ☀는 셋.
    expect(gapRules(issues, 'extras-few').map((g) => g.where)).toEqual(['s1395 farmer summer', 's1395 farmer autumn']);
    const extras = (season: Season) => s1395.happenings.filter((h) => h.season === season && h.cost === 1).length;
    expect(SEASONS.map(extras)).toEqual([4, 3, 3, 4]);
    // 한 해가 다 차야 맞는 것들이 모두 맞다: 남기는 곳이 없는 표시도, 읽히지 않는 표시도, 겹치는 자리도 없다
    for (const rule of ['flag-unread', 'flag-unknown', 'mission-count', 'season-soon', 'happening-idle', 'spot-shared', 'variant-drops', 'trust-loss', 'stat-lock', 'wish']) {
      expect(gapRules(issues, rule), rule).toEqual([]);
    }
  });

  it('한 해가 다 찬 농민 집의 것은 이제 잘못으로 잡힌다(실제 묶음을 한 군데씩 망가뜨려 본다)', () => {
    const brokenReal = (mutate: (pack: SituationPack) => void): Issue[] => {
      const copy = structuredClone(s1395);
      mutate(copy);
      return validatePack(copy, bundle, { walk: false });
    };
    const real = (pack: SituationPack, id: string) => pack.happenings.find((h) => h.id === id)!;
    const farmer = (pack: SituationPack) => pack.situation.roles.find((r) => r.id === 'farmer')!;
    expect(rules(brokenReal(() => undefined))).toEqual([]);
    // 읽히지 않는 표시
    const unread = brokenReal((p) => void (real(p, 's1395-summer-manor').after!.setFlags = ['manor.heard']));
    expect(errorsOf(unread).map((i) => [i.rule, i.where])).toEqual([['flag-unread', 's1395 표시 manor.heard']]);
    // 남기는 곳이 없는 표시를 읽는 바람과 덤 미션(이 역할의 것) — 한 해 이름은 다른 집이 남길 수도 있어 알림이다
    const wish = brokenReal((p) => void (farmer(p).wishOutcomes[0].when = { flags: ['year.rich'] }));
    expect(errorsOf(wish).map((i) => [i.rule, i.where])).toEqual([['flag-unknown', 's1395 역할 farmer 바람 1']]);
    const tales = brokenReal((p) => void p.missions.find((m) => m.id === 's1395-m-tales')!.done.flags!.push('tale.summer'));
    expect(errorsOf(tales).map((i) => [i.rule, i.where])).toEqual([['flag-unknown', '미션 s1395-m-tales 풀림 조건']]);
    const ending = brokenReal((p) => void (p.situation.endings[0].when = { flags: ['year.rich'] }));
    expect(rules(ending)).toEqual([]);
    expect(gapRules(ending, 'flag-unknown').map((g) => g.where)).toEqual(['s1395 한 해 이름 hard']);
    // 꼭 푸는 미션이 여섯보다 적으면
    const few = brokenReal((p) => {
      p.missions = p.missions.filter((m) => !['s1395-m-dano', 's1395-m-leave', 's1395-m-rite'].includes(m.id));
    });
    expect(errorOf(few, 'mission-count')?.where).toBe('s1395 farmer');
    expect(errorOf(few, 'mission-count')?.message).toContain('5개');
    // 모을 카드가 이야기의 카드보다 많으면
    const cards = brokenReal((p) => void (p.missions.find((m) => m.id === 's1395-m-cards')!.done.cardCount = 30));
    expect(errorsOf(cards).map((i) => [i.rule, i.where])).toEqual([['card-count', '미션 s1395-m-cards 풀림 조건']]);
    // 인심이 깎이는 길과 살림·기력 잠김이 하나도 없으면
    const soft = brokenReal((p) => {
      for (const h of p.happenings) {
        for (const outcome of [...(h.choices ?? []).flatMap((c) => [c, ...(c.variants ?? [])]), ...(h.after ? [h.after, ...(h.after.variants ?? [])] : [])]) {
          if ((outcome.effects?.trust ?? 0) < 0) outcome.effects = { ...outcome.effects, trust: 0 };
        }
        for (const choice of h.choices ?? []) delete choice.lock;
      }
    });
    expect(errorsOf(soft).map((i) => [i.rule, i.where, i.message.slice(0, 2)])).toEqual([
      ['trust-loss', 's1395 farmer', '인심'],
      ['stat-lock', 's1395 farmer', '살림'],
      ['stat-lock', 's1395 farmer', '기력'],
    ]);
  });

  it('① 한 해의 글자 수와 시간 어림(계절마다, 한 해 — 분당 300자)을 찍어 본다', () => {
    const lines: string[] = ['[① 한 해 · 농민 집 아이의 글자 수와 시간 어림] 꼭 푸는 미션만(짧은 길~긴 길) / 덤까지(짧은 길~긴 길)'];
    const totals: { name: string; must: number; all: number; mustChars: number; allChars: number }[] = [];
    for (const look of ['boy', 'girl'] as Look[]) {
      for (const weather of ['normal', 'drought']) {
        let state = toSeason(s1395, 'farmer', look, 'spring', { weather });
        const sum = { must: [0, 0], all: [0, 0], mustChars: [0, 0], allChars: [0, 0] };
        for (const season of SEASONS) {
          expect(state.phase).toBe('season');
          const size = measureSeason(s1395, 'farmer', look, state);
          expect(size, `${look}/${weather}/${season}`).not.toBeNull();
          if (!size) break;
          expect(size.season).toBe(season);
          lines.push(
            `  ${look}/${weather}/${season}: ${size.must.short.chars}~${size.must.long.chars}자, 일 ${size.must.short.happenings}~${size.must.long.happenings}개(놀이 ${size.must.long.plays}) ${size.must.short.minutes}~${size.must.long.minutes}분` +
              ` / ${size.all.short.chars}~${size.all.long.chars}자, 일 ${size.all.short.happenings}~${size.all.long.happenings}개 ${size.all.short.minutes}~${size.all.long.minutes}분`,
          );
          sum.must[0] += size.must.short.minutes;
          sum.must[1] += size.must.long.minutes;
          sum.all[0] += size.all.short.minutes;
          sum.all[1] += size.all.long.minutes;
          sum.mustChars[0] += size.must.short.chars;
          sum.mustChars[1] += size.must.long.chars;
          sum.allChars[0] += size.all.short.chars;
          sum.allChars[1] += size.all.long.chars;
          // 여름과 겨울은 봄(1,077자·7.6분)보다 가볍다. 가을은 미션 둘이 일 둘씩이고 놀이가 둘이라 봄보다 길다(읽기 4.5분, 모두 10분쯤).
          const cap = { spring: [1100, 8, 12], summer: [850, 6.5, 10.5], autumn: [1400, 10.5, 15], winter: [1100, 7, 10] }[season];
          expect(size.must.long.chars, `${look}/${weather}/${season}`).toBeLessThanOrEqual(cap[0]);
          expect(size.must.long.minutes, `${look}/${weather}/${season}`).toBeLessThanOrEqual(cap[1]);
          expect(size.all.long.minutes, `${look}/${weather}/${season}`).toBeLessThanOrEqual(cap[2]);
          state = playMusts(s1395, state);
          if (season !== 'winter') state = advance(s1395, state);
        }
        const round = (n: number) => Math.round(n * 10) / 10;
        lines.push(
          `  ${look}/${weather} 한 해: ${sum.mustChars[0]}~${sum.mustChars[1]}자 ${round(sum.must[0])}~${round(sum.must[1])}분 / ${sum.allChars[0]}~${sum.allChars[1]}자 ${round(sum.all[0])}~${round(sum.all[1])}분`,
        );
        totals.push({ name: `${look}/${weather}`, must: sum.must[1], all: sum.all[1], mustChars: sum.mustChars[1], allChars: sum.allChars[1] });
      }
    }
    console.log(lines.join('\n'));
    // spec 5.2의 11번: 이야기 하나 30분 안팎(26~34분, 끝 화면 포함), 덤까지 다 하면 45분쯤. 계절 열고 닫기는 어림에 들어 있고 끝 화면(2분쯤)은 빠져 있다.
    for (const row of totals) {
      expect(row.must, row.name).toBeLessThanOrEqual(32);
      expect(row.must, row.name).toBeGreaterThanOrEqual(24);
      expect(row.all, row.name).toBeLessThanOrEqual(47);
      expect(row.mustChars, row.name).toBeLessThanOrEqual(4400);
    }
  }, 60000);
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
    expect(gapRules(issues, 'flag-unread').map((g) => g.where).sort()).toEqual(['t0001 표시 sow.helped', 't0001 표시 weed.swap']);
    expect(gapRules(issues, 'flag-unread')[0].message).toContain('t-sow-rescue 결과');
  });

  it('일 놀이의 끝난 모습 표시: 한 끝이라도 읽히면 읽히지 않는 끝은 "그 밖의 끝"(바탕 결과)이라 알리지 않는다', () => {
    // 견본의 볍씨 뿌리기: heaped와 left를 결과의 갈림이 읽고, even은 바탕 결과다
    expect(gapRules(issues, 'flag-unread').map((g) => g.where)).not.toContain('t0001 표시 sow.even');
    // 어느 끝도 읽히지 않으면(놀이가 결과를 바꾸지 않으면) 세 끝을 모두 알린다
    const flat = broken((p) => {
      for (const choice of hap(p, 't-sow').choices!) choice.variants = [];
    });
    expect(gapRules(flat, 'flag-unread').map((g) => g.where).sort()).toEqual(
      ['sow.even', 'sow.heaped', 'sow.helped', 'sow.left', 'weed.swap'].map((flag) => `t0001 표시 ${flag}`),
    );
    expect(gapRules(flat, 'flag-unread').find((g) => g.where.endsWith('sow.even'))?.message).toContain('t-sow 놀이');
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

  it('형편마다 갈리는 잠긴 까닭(lock.reasons)도 바탕 까닭과 같은 잣대로 본다: 30자, 탓하지 않음, 조건, 글 모음', () => {
    const withReason = (reason: string, when: Condition = { min: { body: 3 } }) =>
      broken((p) => void (hap(p, 't-news').choices![2].lock!.reasons = [{ when, reason }]));
    expect(rules(withReason('일손이 모자라 지금은 보탤 수 없어요'))).toEqual([]);
    expect(rules(withReason(long(31)))).toEqual(['budget-lock']);
    expect(rules(withReason(''))).toEqual(['lock-reason']);
    expect(rules(withReason('네가 게을러서 안 돼요'))).toContain('lock-blame');
    expect(rules(withReason('일손이 모자라 지금은 보탤 수 없어요', { min: { luck: 3 } as never }))).toContain('condition');
    // 바탕 까닭과 글이 같으면 알림(쓸모없는 갈림)
    const same = broken((p) => {
      const lock = hap(p, 't-news').choices![2].lock!;
      lock.reasons = [{ when: { min: { body: 3 } }, reason: lock.reason }];
    });
    expect(gapRules(same, 'lock-reason-same')).toHaveLength(1);
    // 화면에 보일 수 있는 글 모음에 들어간다(대본과 견주는 시험이 이 글도 본다)
    const pack = structuredClone(testPack);
    hap(pack, 't-news').choices![2].lock!.reasons = [{ when: { min: { body: 3 } }, reason: '일손이 모자라 지금은 보탤 수 없어요' }];
    expect(textsOfPack(pack).map((one) => one.text)).toContain('일손이 모자라 지금은 보탤 수 없어요');
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

  // Review 1-라 11.8 ①: 무대의 사람에 기본 표정(pose)을 적을 수 있다. 없는 표정이면 잡는다.
  it('무대에 선 사람의 기본 표정이 없는 표정이면', () => {
    const sad = broken((p) => void (hap(p, 't-news').stage.cast![0].pose = 'sad' as 'worried'));
    expect(errorsOf(sad).map((i) => [i.rule, i.where])).toEqual([['cast', 't-news 무대']]);
    expect(rules(broken((p) => void (hap(p, 't-news').stage.cast![0].pose = 'worried')))).toEqual([]);
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
    // 여름의 덤이 셋으로 줄었다: 농민 집의 해가 셋이라 덤을 다 할 수 있다 — 봄이 아닌 계절은 알림이다(노비 집은 해가 둘이라 알리지 않는다)
    expect(rules(issues)).toEqual([]);
    expect(gapRules(issues, 'extras-few').map((g) => g.where)).toEqual(['t0001 farmer summer']);
  });

  it('덤의 수: 봄은 해 ☀보다 많아야 하고, 뒤 계절은 둘은 있어야 한다(해보다 많지 않으면 알림)', () => {
    expect(gapRules(baseIssues, 'extras-few')).toEqual([]);
    const one = broken((p) => {
      p.happenings = p.happenings.filter((h) => !['t-summer-2', 't-summer-3', 't-summer-4'].includes(h.id));
    });
    expect(errorsOf(one).map((i) => [i.rule, i.where])).toEqual([
      ['extras-count', 't0001 farmer summer'],
      ['extras-count', 't0001 nobi summer'],
    ]);
    expect(errorOf(one, 'extras-count')?.message).toContain('둘은 있어야 한다');
    const two = broken((p) => {
      p.happenings = p.happenings.filter((h) => !['t-summer-3', 't-summer-4'].includes(h.id));
    });
    expect(rules(two)).toEqual([]);
    expect(gapRules(two, 'extras-few').map((g) => g.where)).toEqual(['t0001 farmer summer', 't0001 nobi summer']);
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
    expect(errorsOf(issues).filter((i) => i.rule === 'flag-unread').map((i) => i.where)).toEqual(['t0001 표시 sow.helped', 't0001 표시 weed.swap']);
    expect(gapRules(issues, 'season-soon')).toEqual([]);
    // 한 해 이름과 바람도 이제는 있어야 한다
    full.situation.endings = [];
    full.situation.roles[0].wishOutcomes = [];
    expect(rules(validatePack(full, testBundle, { walk: false }))).toEqual(expect.arrayContaining(['endings', 'wish']));
  });

  /** 농민 집만 한 해를 채운다(노비 집은 여름까지, 양반 집 아들은 비어 있다) — 지금의 ① 1395년과 같은 꼴 */
  function farmerYear(): SituationPack {
    const copy = structuredClone(testPack);
    for (const season of ['autumn', 'winter'] as const) {
      const weed = structuredClone(hap(copy, 't-weed'));
      const id = `t-${season}`;
      copy.happenings.push({
        ...weed,
        id,
        season,
        roles: ['farmer'],
        lineVariants: [],
        choices: weed.choices!.map((c) => ({ ...c, variants: [], setFlags: [`${season}.done`] })),
      });
      copy.missions.push({
        ...structuredClone(mis(copy, 'm-weed')),
        id: `m-${season}`,
        season,
        roles: ['farmer'],
        parts: [id],
        done: { flags: [`${season}.done`] },
      });
    }
    return copy;
  }
  const of = (issues: Issue[], rule: string) => errorsOf(issues).filter((i) => i.rule === rule).map((i) => i.where);

  it('한 역할의 한 해만 다 차도 그 역할의 것은 잘못이 된다(다른 역할의 것은 알림으로 남는다)', () => {
    const pack = farmerYear();
    expect(builtSeasons(pack, 'farmer')).toEqual([...SEASONS]);
    expect(builtSeasons(pack, 'nobi')).toEqual(['spring', 'summer']);
    const issues = validatePack(pack, testBundle, { walk: false });
    // 꼭 푸는 미션 6~10개
    expect(of(issues, 'mission-count')).toEqual(['t0001 farmer']);
    expect(gapRules(issues, 'mission-count').map((g) => g.where)).toEqual(['t0001 nobi']);
    expect(gapRules(issues, 'season-soon').map((g) => g.where)).toEqual(['t0001 nobi']);
    // 읽히지 않는 표시: 농민 집의 일만 남기는 것(sow.helped)은 잘못, 노비 집도 하는 일이 남기는 것(weed.swap)은 뒤 계절이 읽을 수 있어 알림
    expect(of(issues, 'flag-unread')).toEqual(['t0001 표시 sow.helped']);
    expect(gapRules(issues, 'flag-unread').map((g) => g.where)).toEqual(['t0001 표시 weed.swap']);
    // 일곱 물음: 이야기 전체는 모든 역할이 다 찰 때까지 알림이고, 한 해가 다 찬 역할이 미션으로 만나지 못하는 물음을 따로 알린다
    expect(of(issues, 'theme-coverage')).toEqual([]);
    expect(gapRules(issues, 'theme-coverage')).toHaveLength(3);
    expect(gapRules(issues, 'theme-role').map((g) => g.where)).toEqual(['t0001 farmer']);
    expect(gapRules(issues, 'theme-role')[0].message).toMatch(/"paying".*"inheritance".*"learning"/);
    // 견본 그대로(둘 다 여름까지)는 역할마다의 알림이 없다
    expect(gapRules(baseIssues, 'theme-role')).toEqual([]);
  });

  it('한 해가 다 찬 역할: 바람을 가릴 줄, 인심이 깎이는 길, 살림 잠김이 없으면 잘못이다', () => {
    const noWish = farmerYear();
    noWish.situation.roles[0].wishOutcomes = [];
    noWish.situation.roles[1].wishOutcomes = [];
    const wish = validatePack(noWish, testBundle, { walk: false });
    expect(of(wish, 'wish')).toEqual(['t0001 역할 farmer']);
    expect(gapRules(wish, 'wish').map((g) => g.where)).toEqual(['t0001 역할 nobi']);

    const soft = farmerYear();
    hap(soft, 't-own').after!.effects = { living: 1 };
    hap(soft, 't-sow-rescue').after!.effects = {};
    delete hap(soft, 't-news').choices![2].lock;
    const issues = validatePack(soft, testBundle, { walk: false });
    expect(of(issues, 'trust-loss')).toEqual(['t0001 farmer']);
    expect(errorsOf(issues).filter((i) => i.rule === 'stat-lock').map((i) => [i.where, i.message])).toEqual([
      ['t0001 farmer', '살림 때문에 잠기는 선택지가 하나도 없다'],
    ]);
    expect(gapRules(issues, 'stat-lock').map((g) => g.where)).toEqual(['t0001 nobi']);
  });

  it('한 해가 다 찬 역할의 바람과 덤 미션이 읽는 표시는 남기는 곳이 있어야 한다', () => {
    const pack = farmerYear();
    pack.situation.roles[0].wishOutcomes[0].when = { flags: ['year.rich'] };
    pack.situation.roles[1].wishOutcomes[0].when = { flags: ['year.rich'] };
    mis(pack, 'm-stories').done = { flags: ['story.granny', 'story.temple', 'story.autumn'] };
    const issues = validatePack(pack, testBundle, { walk: false });
    expect(of(issues, 'flag-unknown')).toEqual(['t0001 역할 farmer 바람 1']);
    // 노비 집의 바람과, 모든 역할이 함께 푸는 덤 미션은 아직 알림이다
    expect(gapRules(issues, 'flag-unknown').map((g) => g.where)).toEqual(['t0001 역할 nobi 바람 1', '미션 m-stories 풀림 조건']);
    mis(pack, 'm-stories').roles = ['farmer'];
    expect(of(validatePack(pack, testBundle, { walk: false }), 'flag-unknown')).toEqual(['t0001 역할 farmer 바람 1', '미션 m-stories 풀림 조건']);
  });
});

describe('바퀴 1-라에서 더한 규칙', () => {
  it('카드를 세는 조건(cardCount): 1 이상의 정수여야 하고, 이야기의 카드보다 많으면 알린다', () => {
    // 견본의 카드는 두 장이다
    const two = broken((p) => void (mis(p, 'm-stories').done = { cardCount: 2 }));
    expect(rules(two)).toEqual([]);
    expect(gapRules(two, 'card-count')).toEqual([]);
    const many = broken((p) => void (mis(p, 'm-stories').done = { cardCount: 3 }));
    expect(rules(many)).toEqual([]);
    expect(gapRules(many, 'card-count').map((g) => g.where)).toEqual(['미션 m-stories 풀림 조건']);
    expect(rules(broken((p) => void (mis(p, 'm-stories').done = { cardCount: 0 })))).toContain('condition');
    // 카드를 세는 덤 미션은 딸린 일이 없어도 된다. 꼭 푸는 미션이나 표시를 읽는 미션은 일이 있어야 한다.
    const partless = broken((p) => {
      mis(p, 'm-stories').done = { cardCount: 2 };
      mis(p, 'm-stories').parts = [];
    });
    expect(rules(partless)).toEqual([]);
    expect(rules(broken((p) => void (mis(p, 'm-stories').parts = [])))).toContain('mission-parts');
  });

  it('한쪽 모습에만 나타나는 일은 그 모습이 자리에 닿으면 된다', () => {
    // 견본 맵의 향교(school)는 여자아이 모습에게 막혀 있다
    const boys = broken((p) => {
      hap(p, 't-sow').spot = 'school';
      hap(p, 't-sow').shows = { look: 'boy' };
    });
    expect(rules(boys).filter((rule) => rule === 'spot-unreachable')).toEqual([]);
    const girls = broken((p) => {
      hap(p, 't-sow').spot = 'school';
      hap(p, 't-sow').shows = { look: 'girl' };
    });
    expect(errorsOf(girls).filter((i) => i.rule === 'spot-unreachable').map((i) => i.where)).toEqual(['t-sow (farmer/girl)']);
  });

  it('같은 자리를 쓰는 두 일: 차례로 나타나거나 모습이 갈리면 알리지 않는다', () => {
    const same = broken((p) => void (hap(p, 't-temple').spot = 'well'));
    expect(gapRules(same, 'spot-shared').map((g) => g.where)).toEqual(['t-well · t-temple']);
    // 뒷일이 앞일을 마친 뒤에야 나타나면(앞일이 남긴 표시를 읽으면) 함께 뜨지 않는다
    const after = broken((p) => {
      hap(p, 't-temple').spot = 'well';
      hap(p, 't-well').choices![0].setFlags = ['well.heard'];
      hap(p, 't-well').choices![0].variants![0].setFlags = ['well.heard'];
      hap(p, 't-temple').shows = { flags: ['well.heard'] };
    });
    expect(gapRules(after, 'spot-shared')).toEqual([]);
    // 앞일을 하기 전에만 나타나는 것(notFlags)은 함께 뜰 수 있다
    const before = broken((p) => {
      hap(p, 't-temple').spot = 'well';
      hap(p, 't-well').choices![0].setFlags = ['well.heard'];
      hap(p, 't-well').choices![0].variants![0].setFlags = ['well.heard'];
      hap(p, 't-temple').shows = { notFlags: ['well.heard'] };
    });
    expect(gapRules(before, 'spot-shared').map((g) => g.where)).toEqual(['t-well · t-temple']);
    const looks = broken((p) => {
      hap(p, 't-temple').spot = 'well';
      hap(p, 't-well').shows = { look: 'boy' };
      hap(p, 't-temple').shows = { look: 'girl' };
    });
    expect(gapRules(looks, 'spot-shared')).toEqual([]);
  });
});

// ── 대본과 자료 ─────────────────────────────────────────────────

/** 대본(docs/script-1395.md). "이 문서의 글이 곧 자료다" — 자료의 글이 대본에 그대로 있는지 본다(Review가 둘을 견준다). */
const SCRIPT = Object.values(import.meta.glob<string>('../docs/script-1395.md', { eager: true, query: '?raw', import: 'default' }))[0] ?? '';

/**
 * 대본에서 "바뀐 글" 절 둘 — 12절("바퀴 1-다 고치기에서 바뀐 글")과 25절("바퀴 1-라 고치기에서 바뀐 글과 수치") — 을 뺀 것.
 * 고치기 전의 글을 함께 적은 기록이라, 자료의 글은 이것을 뺀 본문에서 찾는다
 * (4-1 ㉠, 1-라 Review 11.8 ⑩: 대본 전체에서 찾으면 고친 글을 "전" 글로 되돌려도 통과했다. 4-1 ㉡에서 12절도 뺐다).
 * 절은 다음 "# "·"## " 머리까지다(12절 뒤에는 여름·가을·겨울 대본의 머리 "# 대본 — …"이 온다).
 */
const withoutSection = (text: string, no: number): string => {
  const at = text.indexOf(`\n## ${no}. `);
  if (at < 0) return text;
  const rest = text.slice(at + 1);
  const next = rest.search(/\n#{1,2} /);
  return text.slice(0, at) + (next < 0 ? '' : rest.slice(next));
};
const SCRIPT_BODY = withoutSection(withoutSection(SCRIPT, 25), 12);
/** 거점의 대본(docs/script-hub.md — 4-1 ㉡) */
const HUB_SCRIPT = Object.values(import.meta.glob<string>('../docs/script-hub.md', { eager: true, query: '?raw', import: 'default' }))[0] ?? '';

// 4-1 ㉠(1-라 11.8 ⑨): 값 치르기를 알맞게 끝내면 놀이판의 마지막 말 바로 뒤에 결과 첫 창이 같은 말("알맞게 가져왔구나")로 떴다
describe('값 치르기 놀이판의 마지막 말', () => {
  const PAY = Object.values(import.meta.glob<string>('../src/plays/Pay.tsx', { eager: true, query: '?raw', import: 'default' }))[0] ?? '';
  it('알맞게 내면 "그만하면 됐다. 소금 가져가거라."이고, 결과 첫 창과 말머리가 겹치지 않는다. 대본에도 같은 글이 있다', () => {
    expect(PAY.length).toBeGreaterThan(1000);
    expect(PAY).toContain("'그만하면 됐다. 소금 가져가거라.'");
    expect(PAY).not.toContain('알맞게 가져왔구나. 소금 가져가거라.');
    const exact = JSON.stringify(s1395).includes(JSON.stringify('알맞게 가져왔구나. 자, 소금 받아라.'));
    expect(exact).toBe(true);
    expect(SCRIPT).toContain('"그만하면 됐다. 소금 가져가거라."');
  });
});

describe('대본과 자료가 같은 글이다', () => {
  const missing = (texts: [string, string][]): string[] => texts.filter(([, text]) => text.length > 0 && !SCRIPT_BODY.includes(text)).map(([where, text]) => `${where}: ${text}`);

  it('25절(고치기 전의 글)은 빼고 찾는다. 그리고 25.2의 "전" 글은 자료에 하나도 없다(고친 글을 되돌리면 잡는다)', () => {
    expect(SCRIPT).toContain('## 25. 바퀴 1-라 고치기에서 바뀐 글과 수치');
    expect(SCRIPT_BODY).not.toContain('## 25.');
    // 12절(바퀴 1-다 고치기에서 바뀐 글)도 뺀다. 그 뒤의 여름·가을·겨울 대본과 26절(4판 ①-1)은 남는다
    expect(SCRIPT).toContain('## 12. 바퀴 1-다 고치기에서 바뀐 글');
    expect(SCRIPT_BODY).not.toContain('## 12. ');
    expect(SCRIPT_BODY).toContain('# 대본 — ① 새 나라, 새 도읍 한양 · 1395년 · 여름·가을·겨울 · 농민 집 아이');
    expect(SCRIPT_BODY).toContain('## 13. ');
    expect(SCRIPT_BODY).toContain('## 26. ');
    expect(SCRIPT_BODY.length).toBeGreaterThan(SCRIPT.length * 0.7);
    // 25.2의 표: | 어디 | 전 | 후 | review |
    const table = SCRIPT.slice(SCRIPT.indexOf('### 25.2'), SCRIPT.indexOf('### 25.3'));
    const before = table
      .split('\n')
      .filter((row) => row.startsWith('| ') && !row.startsWith('| 어디') && !row.startsWith('|---'))
      .map((row) => row.split('|').map((cell) => cell.trim()))
      .map((cells) => [cells[2], cells[3]] as const)
      .filter(([was, now]) => was.length > 0 && was !== now);
    expect(before.length).toBeGreaterThan(40);
    // 자료(이야기 꾸러미와 카드·물건·자리 이름)의 글자값 가운데 "전" 글과 꼭 같은 것. 다른 갈림에서 그대로 쓰는 글(본문에도 있는 글)은 뺀다
    const data = JSON.stringify([s1395, bundle]);
    const gone = before.filter(([was]) => !SCRIPT_BODY.includes(was));
    expect(gone.length).toBeGreaterThan(30);
    expect(gone.filter(([was]) => data.includes(JSON.stringify(was))).map(([was]) => was)).toEqual([]);
    // 본문의 설명에도 옛 글이 남은 것(review 18번·5번)은 직접 못 박는다
    for (const old of ['딱 맞게 가져왔구나', '셈이 밝은 아이로다', '궁궐보다 먼저']) expect(data, old).not.toContain(old);
    expect(data).toContain(JSON.stringify('알맞게 가져왔구나. 자, 소금 받아라.'));
  });

  it('대본을 읽었다', () => {
    expect(SCRIPT.length).toBeGreaterThan(50000);
    expect(SCRIPT).toContain('# 대본 — ① 새 나라, 새 도읍 한양 · 1395년 · 여름·가을·겨울 · 농민 집 아이');
  });

  it('일의 모든 글(여는 대화와 그 갈림, 선택지, 잠긴 까닭, 결과 대화, 배움 쪽지, 한마디)이 대본에 한 글자도 다르지 않게 있다', () => {
    const texts: [string, string][] = [];
    for (const h of s1395.happenings) {
      for (const line of [...h.lines, ...(h.lineVariants ?? []).flatMap((v) => v.lines)]) texts.push([`${h.id} 여는 대화`, line.text]);
      for (const choice of h.choices ?? []) {
        texts.push([`${h.id}/${choice.id} 선택지`, choice.label]);
        if (choice.lock) texts.push([`${h.id}/${choice.id} 잠긴 까닭`, choice.lock.reason]);
        for (const outcome of [choice, ...(choice.variants ?? [])]) {
          for (const line of outcome.lines) texts.push([`${h.id}/${choice.id} 결과`, line.text]);
          if (outcome.note) texts.push([`${h.id}/${choice.id} 쪽지`, outcome.note]);
        }
      }
      for (const outcome of h.after ? [h.after, ...(h.after.variants ?? [])] : []) {
        for (const line of outcome.lines) texts.push([`${h.id} 결과`, line.text]);
        if (outcome.note) texts.push([`${h.id} 쪽지`, outcome.note]);
      }
      texts.push([`${h.id} 쪽지`, h.note], [`${h.id} 한마디`, h.lure ?? '']);
    }
    expect(texts.length).toBeGreaterThan(400);
    expect(missing(texts)).toEqual([]);
  });

  it('미션, 카드, 물건, 한 해 이름, 바람, 나중 결과, 계절 첫 줄, 남길 것, 이름표, 뒷이야기도 대본에 그대로 있다', () => {
    const farmer = s1395.situation.roles.find((r) => r.id === 'farmer')!;
    const texts: [string, string][] = [
      ...s1395.missions.flatMap((m): [string, string][] => [[`${m.id} 이름`, m.title], [`${m.id} 할 일`, m.goal], [`${m.id} 해낸 일`, m.doneLine]]),
      ...bundle.cards.filter((card) => card.situation === 's1395').flatMap((card): [string, string][] => [[`${card.id} 이름`, card.title], [`${card.id} 글`, card.text]]),
      ...bundle.items.flatMap((item): [string, string][] => [[`${item.id} 이름`, item.label], [`${item.id} 글`, item.text]]),
      ...s1395.situation.endings.flatMap((ending): [string, string][] => [[`${ending.id} 이름`, ending.title], [`${ending.id} 한 줄`, ending.line]]),
      ...farmer.wishOutcomes.map((row, index): [string, string] => [`바람 ${index + 1}`, row.reason]),
      ['바람', farmer.wish],
      ...(s1395.situation.later ?? []).map((row, index): [string, string] => [`나중 결과 ${index + 1}`, row.line]),
      ...Object.entries(s1395.situation.seasons).flatMap(([season, row]): [string, string][] => [[`${season} 첫 줄`, row.line], ...(row.lineVariants ?? []).map((v): [string, string] => [`${season} 첫 줄 갈림`, v.line])]),
      ...s1395.situation.legacy.map((one): [string, string] => [one.id, one.label]),
      ...Object.entries(s1395.situation.people).map(([who, person]): [string, string] => [who, person.label]),
      ['뒷이야기', s1395.situation.epilogue],
      ...bundle.places.map((place): [string, string] => [`배경 ${place.id}`, place.label]),
    ];
    expect(missing(texts)).toEqual([]);
  });

  it('대본에 적힌 이름들이 자료에 있다: 일·미션·카드·표시의 이름', () => {
    for (const h of s1395.happenings) expect(SCRIPT, h.id).toContain(h.id.replace(/^s1395-(summer|autumn|winter)-/, (_, season: string) => `s1395-${season}-`));
    for (const m of s1395.missions) expect(SCRIPT, m.id).toContain(m.id);
    for (const card of bundle.cards.filter((one) => one.situation === 's1395')) expect(SCRIPT, card.id).toContain(card.id);
    // 대본이 드는 표시(`…`로 적힌 것 가운데 점이 든 이름)는 모두 자료가 남기거나 읽는 표시다
    const known = new Set<string>();
    const take = (cond: { flags?: string[]; notFlags?: string[]; anyOf?: unknown[] } | undefined): void => {
      if (!cond) return;
      for (const flag of [...(cond.flags ?? []), ...(cond.notFlags ?? [])]) known.add(flag);
      for (const one of cond.anyOf ?? []) take(one as { flags?: string[] });
    };
    for (const h of s1395.happenings) {
      for (const flag of Object.values(h.play?.flags ?? {})) known.add(flag);
      take(h.shows);
      for (const outcome of [...(h.choices ?? []).flatMap((c) => [c, ...(c.variants ?? [])]), ...(h.after ? [h.after, ...(h.after.variants ?? [])] : [])]) {
        for (const flag of outcome.setFlags ?? []) known.add(flag);
      }
    }
    const named = [...SCRIPT.matchAll(/`((?:return|sow|tale|dano|weed|leave|autumn|harvest|salt|pay|rite|letters|weave)\.[a-z]+)`/g)]
      .map((m) => m[1])
      .filter((name) => !name.endsWith('.ts')); // `autumn.ts` 같은 파일 이름은 뺀다
    expect(named.length).toBeGreaterThan(50);
    expect([...new Set(named)].filter((flag) => !known.has(flag))).toEqual([]);
  });
});

// 4-1 ㉡(11.1 라): 겨루기·거점의 글도 대본에 먼저 쓰고 옮긴다 — 코드의 글이 대본(26절 등 — 12·25절 뺌)이나 거점 대본에 한 글자도 다르지 않게 있다.
describe('겨루기·거점의 글도 대본과 같은 글이다', () => {
  const texts = (): [string, string][] => {
    const out: [string, string][] = [];
    const walk = (where: string, value: unknown): void => {
      if (typeof value === 'string') out.push([where, value]);
      else if (Array.isArray(value)) value.forEach((one, i) => walk(`${where}[${i}]`, one));
      else if (value && typeof value === 'object') for (const [key, one] of Object.entries(value as Record<string, unknown>)) walk(`${where}.${key}`, one);
    };
    // 글 칸만(id·그림 이름·꼬리표·근거 번호·빛깔·갈래 같은 이름표는 뺀다)
    for (const foe of four.foes) {
      out.push([`${foe.id} 이름`, foe.name], [`${foe.id} 방패가 깎일 때`, foe.fade]);
      for (const move of foe.moves) out.push([`${foe.id}/${move.id} 예고`, move.line]);
      for (const key of ['opening', 'win', 'rescue', 'dusk', 'phaseOpen', 'wisdom'] as const) foe[key].forEach((line, i) => out.push([`${foe.id} ${key}[${i}]`, line.text]));
    }
    for (const card of four.skills) out.push([`${card.id} 이름`, card.name], [`${card.id} 글`, card.text]);
    for (const g of four.gear) out.push([`${g.id} 이름`, g.name], [`${g.id} 쪽지`, g.text], [`${g.id} 잠긴 까닭`, g.lock]);
    for (const o of four.outfits) out.push([`${o.id} 이름`, o.label], [`${o.id} 쪽지`, o.note]);
    for (const r of four.relics) out.push([`${r.id} 이름`, r.name], [`${r.id} 글`, r.text]);
    for (const f of four.facilities) out.push([`시설 ${f.id} 이름`, f.name], [`시설 ${f.id} 하는 일`, f.does]);
    for (const k of four.keepers) {
      out.push([`시설지기 ${k.id}`, k.label]);
      k.greet.forEach((line, i) => out.push([`시설지기 ${k.id} 말[${i}]`, line.text]));
    }
    for (const note of four.board) out.push([`알림판 ${note.id} 이름`, note.title], [`알림판 ${note.id} 글`, note.text]);
    walk('거점의 글', four.texts);
    for (const plan of four.plans) for (const ep of plan.episodes) out.push([`${ep.id} 이름`, ep.title], [`${ep.id} 때`, ep.when], [`${ep.id} 의뢰`, ep.goal], [`${ep.id} 정령의 물음`, ep.ask]);
    for (const q of four.questions.filter((one) => one.topic.startsWith('ep-'))) {
      out.push([`${q.id} 물음`, q.ask], [`${q.id} 풀이`, q.explain]);
      for (const one of [...(q.choices ?? []), ...(q.items ?? []), ...(q.pairs ?? []).flat()]) out.push([`${q.id} 고를 것`, one]);
    }
    return out.filter(([, text]) => text.length > 0);
  };
  // 글에 섞이는 이름표(정령의 who 열쇠 등)는 글이 아니라 뺀다. 거점의 글 가운데 id·그림 이름처럼 영문 소문자로만 된 것도 뺀다
  const isLabel = (text: string): boolean => /^[a-z0-9:'_-]+$/.test(text);

  it('거점 대본을 읽었다', () => {
    expect(HUB_SCRIPT.length).toBeGreaterThan(3000);
    expect(HUB_SCRIPT).toContain('# 대본 — 느티나무 마을(거점) · 4판 4-1');
  });

  it('고비·솜씨 카드·장비·꾸미기·유물·거점·정령의 말·①-1의 줄·이야기 문제의 글이 대본(12·25절 뺌)이나 거점 대본에 그대로 있다', () => {
    const all = texts().filter(([, text]) => !isLabel(text));
    expect(all.length).toBeGreaterThan(250);
    const gone = all.filter(([, text]) => !SCRIPT_BODY.includes(text) && !HUB_SCRIPT.includes(text)).map(([where, text]) => `${where}: ${text}`);
    expect(gone).toEqual([]);
  });
});
