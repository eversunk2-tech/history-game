// 콘텐츠 시험: 검사기가 지금 자료를 통과시키는지, 일부러 망가뜨린 자료를 잡아내는지.

import { describe, expect, it } from 'vitest';
import { bundle, getPack, packs, shelf } from '../src/content';
import { cards } from '../src/content/cards';
import { drawLabels } from '../src/content/labels';
import { catalog } from '../src/content/situations/catalog';
import { sources } from '../src/content/sources';
import {
  BANNED_WORDS,
  BUDGET,
  countChars,
  errorsOf,
  findAllLocked,
  formatIssue,
  gapsOf,
  numbersIn,
  validateContent,
  validatePack,
  type Issue,
} from '../src/content/validate';
import { playableRoles } from '../src/engine/game';
import { drawValues } from '../src/engine/rng';
import { THEME_IDS, type Choice, type Scene, type SituationPack } from '../src/engine/types';
import { playRandom } from './fixtures';

const s1395 = getPack('s1395')!;

/** s1395를 베껴서 한 군데를 망가뜨린 뒤 검사한다 */
function broken(mutate: (pack: SituationPack) => void): Issue[] {
  const copy = structuredClone(s1395);
  mutate(copy);
  return validatePack(copy, bundle);
}

function rules(issues: Issue[]): string[] {
  return errorsOf(issues).map((issue) => issue.rule);
}

const sceneOf = (pack: SituationPack, id: string): Scene => {
  const scene = pack.scenes.find((s) => s.id === id);
  if (!scene) throw new Error(`장면이 없다: ${id}`);
  return scene;
};

const long = (length: number) => '가'.repeat(length);

describe('지금 자료', () => {
  it('검사기를 잘못 없이 통과한다', () => {
    const errors = errorsOf(validateContent(bundle));
    expect(errors.map(formatIssue)).toEqual([]);
  });

  it('비어 있는 곳을 알려 준다: 준비 중인 상황 여섯, 장면이 없는 집 셋, 견본 장면 넷', () => {
    const gaps = gapsOf(validateContent(bundle));
    expect(gaps.filter((g) => g.rule === 'situation-soon').map((g) => g.where)).toEqual([
      'catalog.ts s1446',
      'catalog.ts s1592',
      'catalog.ts s1636',
      'catalog.ts s1795',
      'catalog.ts s1863',
      'catalog.ts s1899',
    ]);
    expect(gaps.filter((g) => g.rule === 'role-empty').map((g) => g.where)).toEqual([
      's1395 son',
      's1395 daughter',
      's1395 nobi',
    ]);
    expect(
      gaps
        .filter((g) => g.rule === 'sample')
        .map((g) => g.where)
        .sort(),
    ).toEqual(['s1395-autumn-farmer', 's1395-summer-farmer', 's1395-summer-world', 's1395-winter-farmer']);
  });

  it('상황 일곱 가운데 ① 1395년만 고를 수 있고, 농민 집만 할 수 있다', () => {
    const items = shelf();
    expect(items.map((item) => item.id)).toEqual(['s1395', 's1446', 's1592', 's1636', 's1795', 's1863', 's1899']);
    expect(items.filter((item) => item.ready).map((item) => item.id)).toEqual(['s1395']);
    expect(packs.map((pack) => pack.situation.id)).toEqual(['s1395']);
    expect(playableRoles(s1395)).toEqual(['farmer']);
    expect(s1395.scenes).toHaveLength(8);
  });

  it('시기 묶음 넷에 상황이 2·2·2·1개씩 들어 있다', () => {
    const count = (group: string) => catalog.filter((entry) => entry.group === group).length;
    expect([count('early'), count('middle'), count('late'), count('opening')]).toEqual([2, 2, 2, 1]);
  });

  it('① 1395년의 견주기 답 일곱 개가 빠짐없다', () => {
    for (const theme of THEME_IDS) expect(s1395.situation.themes[theme].length).toBeGreaterThan(0);
  });

  it('모든 장면의 근거 번호가 sources.ts에 있다', () => {
    const ids = new Set(sources.map((source) => source.id));
    for (const scene of s1395.scenes) {
      expect(scene.facts.length).toBeGreaterThan(0);
      for (const fact of scene.facts) expect(ids.has(fact)).toBe(true);
    }
    for (const card of cards) for (const fact of card.facts) expect(ids.has(fact)).toBe(true);
  });

  it('spec 6.3의 예시 장면 넷은 표의 수치 그대로다', () => {
    const effects = (sceneId: string, choiceId: string) => {
      const choice = sceneOf(s1395, sceneId).choices.find((c) => c.id === choiceId);
      return { effects: choice?.effects ?? {}, cards: choice?.cards ?? [] };
    };
    // 봄 세상 (F34 F35)
    expect(effects('s1395-spring-world', 'father').effects).toEqual({ living: -2 });
    expect(effects('s1395-spring-world', 'me')).toEqual({ effects: { body: -2 }, cards: ['s1395-palace-work'] });
    expect(effects('s1395-spring-world', 'brother').effects).toEqual({ living: -1, body: -1 });
    expect(sceneOf(s1395, 's1395-spring-world').facts).toEqual(['F34', 'F35']);
    // 봄 농민 (F38): 책대로 → 가뭄이면 살림 -2(여름에 깎인다), 노인 말대로 → 살림 +1 인심 +1
    expect(effects('s1395-spring-farmer', 'book').effects).toEqual({});
    expect(effects('s1395-spring-farmer', 'elder').effects).toEqual({ living: 1, trust: 1 });
    expect(sceneOf(s1395, 's1395-spring-farmer').facts).toEqual(['F38']);
    // 가을 세상 (F34 F35)
    expect(effects('s1395-autumn-world', 'swap')).toEqual({
      effects: { body: -1, trust: 1 },
      cards: ['s1395-gyeongbokgung'],
    });
    expect(effects('s1395-autumn-world', 'ours').effects).toEqual({ living: 1 });
    // 겨울 세상 (F37): 새 예법을 따르지 않아도 인심이 깎이지 않는다
    expect(effects('s1395-winter-world', 'temple').effects).toEqual({ living: -1 });
    expect(effects('s1395-winter-world', 'home').effects).toEqual({ living: -1, trust: 1 });
    expect(sceneOf(s1395, 's1395-winter-world').facts).toEqual(['F37']);
  });

  it('책대로 농사지은 해에 가뭄이 들면 어떤 김매기를 골라도 살림이 2 이상 깎인다', () => {
    const summer = sceneOf(s1395, 's1395-summer-farmer');
    for (const choice of summer.choices) {
      const variant = choice.variants?.find((v) => v.when.draw === 'drought' && v.when.flags?.includes('farm-book'));
      expect(variant?.effects?.living).toBeLessThanOrEqual(-2);
    }
  });

  it('① 1395년에는 예법 때문에 인심이 깎이는 선택이 없다', () => {
    const outcomes = (choice: Choice) => [choice, ...(choice.variants ?? [])];
    for (const scene of s1395.scenes) {
      for (const choice of scene.choices) {
        for (const outcome of outcomes(choice)) expect(outcome.effects?.trust ?? 0).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('여름 장면에서 날씨 뽑기가 드러난다(지문이 날씨에 따라 다르다)', () => {
    const summer = sceneOf(s1395, 's1395-summer-farmer');
    expect(summer.textVariants?.map((v) => v.when.draw).sort()).toEqual(['bumper', 'drought']);
    expect(s1395.situation.draw).toEqual({ kind: 'weather', season: 'summer' });
  });

  it('네 역할의 시작 수치는 spec 7절 표와 같다', () => {
    const start = (role: 'son' | 'daughter' | 'farmer' | 'nobi') => {
      const { living, body, trust } = s1395.situation.roles[role].start;
      return [living, body, trust];
    };
    expect(s1395.situation.roles.son.label).toBe('양반 집 아들');
    expect(start('son')).toEqual([7, 6, 6]);
    expect(s1395.situation.roles.daughter.label).toBe('양반 집 딸');
    expect(start('daughter')).toEqual([7, 6, 6]);
    expect(s1395.situation.roles.farmer.label).toBe('농민 집 아이');
    expect(start('farmer')).toEqual([4, 6, 5]);
    expect(s1395.situation.roles.nobi.label).toBe('노비 집 아이');
    expect(start('nobi')).toEqual([2, 6, 4]);
  });

  it('날씨 이름은 날씨를 가리키는 말이다("풍년"이라고 하지 않는다)', () => {
    const weather = drawLabels.weather!;
    expect(Object.keys(weather.values).sort()).toEqual([...drawValues('weather')].sort());
    expect(weather.values.drought.label).toBe('가뭄 든 해');
    expect(weather.values.normal.label).toBe('여느 해');
    expect(weather.values.bumper.label).toBe('비와 볕이 고른 해');
    for (const value of Object.values(weather.values)) expect(`${value.label} ${value.line}`).not.toContain('풍년');
  });

  it('① 카드의 한 줄 소개에 "유교를 내세워"가 있다', () => {
    const blurb = catalog.find((entry) => entry.id === 's1395')!.blurb;
    expect(blurb).toContain('유교를 내세워');
    expect(countChars(blurb)).toBeLessThanOrEqual(BUDGET.blurb);
  });

  it('글자 수는 빈칸까지 센다', () => {
    expect(countChars('가 나, 다.')).toBe(7);
    expect(BUDGET).toMatchObject({ text: 100, label: 26, result: 90, note: 50 });
  });
});

describe('망가뜨린 자료를 잡아낸다', () => {
  it('세상 장면이 빠지면', () => {
    const issues = broken((pack) => {
      pack.scenes = pack.scenes.filter((s) => s.id !== 's1395-autumn-world');
    });
    expect(rules(issues)).toContain('scene-count');
    expect(errorsOf(issues).map((i) => i.where)).toContain('s1395 autumn');
  });

  it('있는 집의 내 장면이 하나 빠지면', () => {
    const issues = broken((pack) => {
      pack.scenes = pack.scenes.filter((s) => s.id !== 's1395-winter-farmer');
    });
    expect(errorsOf(issues).find((i) => i.rule === 'scene-count')?.where).toBe('s1395 farmer winter');
  });

  it('같은 집·계절의 내 장면이 둘이면', () => {
    const issues = broken((pack) => {
      pack.scenes.push({ ...sceneOf(pack, 's1395-spring-farmer'), id: 's1395-spring-farmer-2' });
    });
    expect(rules(issues)).toContain('scene-count');
  });

  it('장면이 하나뿐인 집은 "비어 있다"가 아니라 잘못이다', () => {
    const issues = broken((pack) => {
      pack.scenes.push({ ...sceneOf(pack, 's1395-spring-farmer'), id: 's1395-spring-son', role: 'son' });
    });
    const sonErrors = errorsOf(issues).filter((i) => i.where.startsWith('s1395 son'));
    expect(sonErrors.filter((i) => i.rule === 'scene-count')).toHaveLength(3); // 여름·가을·겨울
    expect(sonErrors.map((i) => i.rule)).toContain('wish'); // 바람을 가릴 줄도 있어야 한다
  });

  it('세상 장면과 내 장면의 차례가 같으면', () => {
    expect(rules(broken((pack) => void (sceneOf(pack, 's1395-spring-farmer').order = 1)))).toContain('scene-order');
  });

  it('선택지가 1개이거나 4개이면', () => {
    expect(rules(broken((pack) => void sceneOf(pack, 's1395-spring-farmer').choices.pop()))).toContain('choices-count');
    expect(
      rules(
        broken((pack) => {
          const scene = sceneOf(pack, 's1395-spring-world');
          scene.choices.push({ ...scene.choices[0], id: 'fourth' });
        }),
      ),
    ).toContain('choices-count');
  });

  it('어느 수치에서는 고를 수 있는 것이 하나도 없으면', () => {
    const issues = broken((pack) => {
      for (const choice of sceneOf(pack, 's1395-winter-farmer').choices) {
        choice.lock = { unless: { min: { living: 3 } }, reason: '곳간이 비었어요.' };
      }
    });
    const issue = errorsOf(issues).find((i) => i.rule === 'always-one-open');
    expect(issue?.where).toBe('s1395-winter-farmer (farmer)');
    expect(issue?.message).toContain('살림');
  });

  it('세상 장면이 어느 한 집에게 모두 잠기면', () => {
    const issues = broken((pack) => {
      for (const choice of sceneOf(pack, 's1395-autumn-world').choices) {
        choice.lock = { unless: { roles: ['son', 'daughter', 'farmer'] }, reason: '주인댁 일이 먼저였어요.' };
      }
    });
    expect(errorsOf(issues).filter((i) => i.rule === 'always-one-open').map((i) => i.where)).toEqual([
      's1395-autumn-world (nobi)',
    ]);
  });

  it('서로 맞물려 언제나 하나는 열리는 잠김은 잘못이 아니다', () => {
    const issues = broken((pack) => {
      const [first, second] = sceneOf(pack, 's1395-autumn-world').choices;
      first.lock = { unless: { min: { living: 4 } }, reason: '곳간에 내줄 것이 모자라요.' };
      second.lock = { unless: { max: { living: 3 } }, reason: '곳간이 넉넉해 그럴 까닭이 없어요.' };
    });
    expect(rules(issues)).not.toContain('always-one-open');
    // 틈이 있으면 잡는다: 살림 4일 때는 둘 다 잠긴다
    const gapped = broken((pack) => {
      const [first, second] = sceneOf(pack, 's1395-autumn-world').choices;
      first.lock = { unless: { min: { living: 5 } }, reason: '곳간에 내줄 것이 모자라요.' };
      second.lock = { unless: { max: { living: 3 } }, reason: '곳간이 넉넉해 그럴 까닭이 없어요.' };
    });
    expect(errorsOf(gapped).find((i) => i.rule === 'always-one-open')?.message).toContain('살림 4');
  });

  it('뽑기에 따라 모두 잠기는 때가 있으면', () => {
    const scene = structuredClone(sceneOf(s1395, 's1395-summer-farmer'));
    for (const choice of scene.choices) choice.lock = { unless: { draw: 'normal' }, reason: '날씨가 맞지 않아요.' };
    expect(findAllLocked(scene, 'farmer', ['normal'])).toBeNull();
    expect(findAllLocked(scene, 'farmer', ['drought', 'normal', 'bumper'])?.draw).toBe('drought');
  });

  it('글자 수 예산을 넘으면(지문 100, 선택지 26, 결과 90, 배움 쪽지 50)', () => {
    expect(rules(broken((p) => void (sceneOf(p, 's1395-spring-world').text = long(101))))).toContain('budget-text');
    expect(rules(broken((p) => void (sceneOf(p, 's1395-spring-world').text = long(100))))).not.toContain('budget-text');
    expect(rules(broken((p) => void (sceneOf(p, 's1395-spring-world').choices[0].label = long(27))))).toContain(
      'budget-label',
    );
    expect(rules(broken((p) => void (sceneOf(p, 's1395-spring-world').choices[0].result = long(91))))).toContain(
      'budget-result',
    );
    expect(rules(broken((p) => void (sceneOf(p, 's1395-spring-world').note = long(51))))).toContain('budget-note');
    // 갈린 지문과 갈린 결과도 센다
    expect(
      rules(broken((p) => void (sceneOf(p, 's1395-summer-farmer').textVariants![0].text = long(101)))),
    ).toContain('budget-text');
    expect(
      rules(broken((p) => void (sceneOf(p, 's1395-summer-farmer').choices[0].variants![0].result = long(91)))),
    ).toContain('budget-result');
    expect(
      rules(broken((p) => void (sceneOf(p, 's1395-summer-farmer').choices[2].lock!.reason = long(BUDGET.lockReason + 1)))),
    ).toContain('budget-lock');
  });

  it('수치 변화가 -3~+3을 벗어나면', () => {
    expect(rules(broken((p) => void (sceneOf(p, 's1395-spring-world').choices[0].effects = { living: -4 })))).toContain(
      'effect-range',
    );
    expect(rules(broken((p) => void (sceneOf(p, 's1395-spring-world').choices[0].effects = { body: 1.5 })))).toContain(
      'effect-range',
    );
    expect(
      rules(broken((p) => void (sceneOf(p, 's1395-summer-farmer').choices[0].variants![0].effects = { trust: 4 }))),
    ).toContain('effect-range');
    expect(rules(broken((p) => void (sceneOf(p, 's1395-spring-world').choices[0].effects = { living: -3 })))).not.toContain(
      'effect-range',
    );
  });

  it('근거 번호가 없거나 sources.ts에 없는 번호이면', () => {
    expect(rules(broken((p) => void (sceneOf(p, 's1395-winter-world').facts = [])))).toContain('facts');
    expect(rules(broken((p) => void (sceneOf(p, 's1395-winter-world').facts = ['F99'])))).toContain('facts');
  });

  it('일곱 물음 가운데 답이 빠지면', () => {
    expect(rules(broken((p) => void (p.situation.themes.marriage = '')))).toContain('themes');
  });

  it('쓰지 않기로 한 낱말이 있으면', () => {
    for (const word of ['상놈', '왜놈', '정답', '점수', '실패', '미신', '매질']) {
      expect(BANNED_WORDS.map((b) => b.word)).toContain(word);
    }
    const inText = broken((p) => void (sceneOf(p, 's1395-spring-world').text = '상놈이라고 부른다.'));
    expect(errorsOf(inText).find((i) => i.rule === 'banned-word')?.where).toBe('s1395-spring-world 지문');
    expect(rules(broken((p) => void (sceneOf(p, 's1395-spring-world').choices[1].result = '정답을 맞혔다.')))).toContain(
      'banned-word',
    );
    expect(rules(broken((p) => void (sceneOf(p, 's1395-spring-world').choices[1].label = '점수를 딴다')))).toContain(
      'banned-word',
    );
    expect(rules(broken((p) => void (p.situation.roles.farmer.wishOutcomes[4].reason = '실패했어요.')))).toContain(
      'banned-word',
    );
    expect(rules(broken((p) => void (p.situation.endings[0].title = '실패한 한 해')))).toContain('banned-word');
  });

  it('낮추어 본 말을 설명하는 것은 배움 쪽지에서만 된다', () => {
    expect(rules(broken((p) => void (sceneOf(p, 's1395-spring-world').note = '그때는 오랑캐라고 낮추어 불렀어요.')))).not.toContain(
      'banned-word',
    );
    expect(rules(broken((p) => void (sceneOf(p, 's1395-spring-world').text = '오랑캐가 온다.')))).toContain('banned-word');
  });

  it('잠긴 까닭이 없거나 사람을 탓하면', () => {
    expect(rules(broken((p) => void (sceneOf(p, 's1395-summer-farmer').choices[2].lock!.reason = '')))).toContain(
      'lock-reason',
    );
    expect(
      rules(broken((p) => void (sceneOf(p, 's1395-summer-farmer').choices[2].lock!.reason = '네가 게을러서 안 돼요.'))),
    ).toContain('lock-blame');
  });

  it('없는 카드·표시·뽑기 값·장소를 가리키면', () => {
    expect(rules(broken((p) => void (sceneOf(p, 's1395-spring-world').choices[1].cards = ['nope'])))).toContain(
      'card-unknown',
    );
    expect(
      rules(broken((p) => void (sceneOf(p, 's1395-summer-farmer').choices[0].variants![0].when = { flags: ['typo'] }))),
    ).toContain('flag-unknown');
    expect(
      rules(broken((p) => void (sceneOf(p, 's1395-summer-farmer').textVariants![0].when = { draw: 'flood' }))),
    ).toContain('draw-unknown');
    expect(rules(broken((p) => void (sceneOf(p, 's1395-spring-world').place = 'moon')))).toContain('place-unknown');
  });

  it('신분으로 잠그지 않는 상황(⑦)에서 신분 잠김을 쓰면', () => {
    const issues = broken((p) => {
      p.situation.statusLocks = false;
      sceneOf(p, 's1395-summer-world').choices[2].lock = { unless: { roles: ['son'] }, reason: '글방은 아들만 갔어요.' };
    });
    expect(rules(issues)).toContain('status-lock');
  });

  it('시작 수치, 한 해 이름, 바람을 가릴 줄이 어긋나면', () => {
    expect(rules(broken((p) => void (p.situation.roles.nobi.start.living = 11)))).toContain('start-range');
    expect(rules(broken((p) => void (p.situation.endings = [])))).toContain('endings');
    expect(
      rules(broken((p) => void (p.situation.endings[p.situation.endings.length - 1].when = { min: { living: 1 } }))),
    ).toContain('endings');
    expect(rules(broken((p) => void (p.situation.roles.farmer.wishOutcomes = [])))).toContain('wish');
    expect(rules(broken((p) => void p.situation.roles.farmer.wishOutcomes.pop()))).toContain('wish');
  });

  it('상황 목록(catalog)과 어긋나거나 다른 상황의 장면이 섞이면', () => {
    expect(rules(broken((p) => void (p.situation.year = 1400)))).toContain('catalog');
    expect(rules(broken((p) => void (sceneOf(p, 's1395-spring-world').situation = 's1446')))).toContain('scene');
    expect(rules(broken((p) => void (sceneOf(p, 's1395-spring-farmer').id = 's1395-spring-world')))).toContain('scene');
  });

  it('뽑기를 한다면서 계절을 적지 않으면', () => {
    expect(rules(broken((p) => void (p.situation.draw = { kind: 'weather' })))).toContain('draw');
  });

  it('함께 쓰는 자료(상황 목록·카드·근거)의 잘못도 잡는다', () => {
    const copy = structuredClone(bundle);
    copy.catalog[1].blurb = long(BUDGET.blurb + 1);
    copy.cards[0].facts = ['F99'];
    copy.sources.push({ ...copy.sources[0] });
    copy.catalog[2].title = '상놈 이야기';
    const found = rules(validateContent(copy));
    expect(found).toContain('budget-blurb');
    expect(found).toContain('facts');
    expect(found).toContain('sources');
    expect(found).toContain('banned-word');
  });
});

describe('알림(잘못은 아니지만 사람이 한 번 볼 것)', () => {
  const gapRules = (issues: Issue[], rule: string) => gapsOf(issues).filter((issue) => issue.rule === rule);

  it('지금 자료: 남기기만 하고 읽히지 않는 표시 다섯을 알린다', () => {
    const issues = validatePack(s1395, bundle);
    expect(gapRules(issues, 'flag-unread').map((g) => g.where).sort()).toEqual([
      's1395 표시 farm-elder',
      's1395 표시 rite-temple',
      's1395 표시 work-brother',
      's1395 표시 work-father',
      's1395 표시 work-me',
    ]);
    // 조건이 읽는 표시(farm-book, rite-home)는 알리지 않는다
    expect(gapRules(issues, 'flag-unread').map((g) => g.where)).not.toContain('s1395 표시 farm-book');
    // 지금 자료에는 근거 없는 숫자도, 카드·표시를 빠뜨린 갈린 결과도 없다
    expect(gapRules(issues, 'number-unsourced')).toEqual([]);
    expect(gapRules(issues, 'variant-drops')).toEqual([]);
    expect(errorsOf(issues)).toEqual([]);
  });

  it('표시를 읽는 조건이 생기면 알림이 없어진다', () => {
    const issues = broken((p) => {
      sceneOf(p, 's1395-autumn-world').choices[0].lock = {
        unless: { notFlags: ['work-father'] },
        reason: '아버지가 아직 돌아오지 않으셨어요.',
      };
      sceneOf(p, 's1395-autumn-world').choices[1].variants = [
        { when: { flags: ['farm-elder'] }, effects: { living: 1 }, result: '어른들 말씀대로 지은 논이라 잘 여물었다.' },
      ];
    });
    const unread = gapRules(issues, 'flag-unread').map((g) => g.where);
    expect(unread).not.toContain('s1395 표시 work-father');
    expect(unread).not.toContain('s1395 표시 farm-elder');
    expect(unread).toHaveLength(3);
  });

  it('지문·결과·쪽지의 숫자가 그 장면의 근거 글에 없으면 알린다', () => {
    expect(numbersIn('1394년 12월~1395년 9월, 66,067명')).toEqual(['1394', '12', '1395', '9', '66067']);
    // 근거 없는 연도: 잘못이 아니라 알림
    const text = broken((p) => void (sceneOf(p, 's1395-spring-world').text = '1399년 봄, 궁궐을 짓는다.'));
    expect(gapRules(text, 'number-unsourced').map((g) => g.where)).toEqual(['s1395-spring-world 지문']);
    expect(gapRules(text, 'number-unsourced')[0].message).toContain('"1399"');
    expect(rules(text)).toEqual([]);
    // 쪽지와 결과(갈린 결과 포함)도 본다
    const note = broken((p) => void (sceneOf(p, 's1395-winter-world').note = '백 집 가운데 99집이 그랬어요.'));
    expect(gapRules(note, 'number-unsourced').map((g) => g.where)).toEqual(['s1395-winter-world 배움 쪽지']);
    const result = broken(
      (p) => void (sceneOf(p, 's1395-summer-farmer').choices[0].variants![1].result = '김을 5번이나 맸다. 3번 더 매야 한다.'),
    );
    // F04의 글에 "4~5번", "2~3번"이 있어 5와 3은 근거가 있다
    expect(gapRules(result, 'number-unsourced')).toEqual([]);
    const result7 = broken(
      (p) => void (sceneOf(p, 's1395-summer-farmer').choices[0].variants![1].result = '김을 7번이나 맸다.'),
    );
    expect(gapRules(result7, 'number-unsourced').map((g) => g.where)).toEqual(['s1395-summer-farmer thorough 결과 3']);
    // 근거 글에 있는 연도는 알리지 않는다(F34·F35에 1395가 있다)
    const sourced = broken((p) => void (sceneOf(p, 's1395-spring-world').text = '1395년 봄, 궁궐을 짓는다.'));
    expect(gapRules(sourced, 'number-unsourced')).toEqual([]);
  });

  it('갈린 결과가 바탕 결과의 카드·표시를 빠뜨리면 알린다', () => {
    const cardDropped = broken((p) => void delete sceneOf(p, 's1395-summer-farmer').choices[0].variants![0].cards);
    expect(gapRules(cardDropped, 'variant-drops').map((g) => g.where)).toEqual([
      's1395-summer-farmer/thorough 결과 갈림 1',
    ]);
    expect(gapRules(cardDropped, 'variant-drops')[0].message).toContain('s1395-direct-sowing');
    expect(rules(cardDropped)).toEqual([]);

    const flagDropped = broken((p) => {
      const choice = sceneOf(p, 's1395-winter-world').choices[1]; // 바탕이 rite-home을 남긴다
      choice.variants = [{ when: { min: { trust: 9 } }, effects: { living: -1 }, result: '이웃들도 와서 함께 절을 올렸다.' }];
    });
    expect(gapRules(flagDropped, 'variant-drops')[0].message).toContain('rite-home');
  });
});

describe('장면만 있고 바람을 가릴 줄이 없는 집', () => {
  it('그 집은 "준비 중"으로 남고(할 수 있는 집이 아니다) 검사기가 잘못으로 알린다', () => {
    // Review가 한 것: 양반 집 아들의 장면 넷만 더하고 wishOutcomes는 비워 둔다
    const copy = structuredClone(s1395);
    copy.scenes.push(
      ...copy.scenes
        .filter((s) => s.role === 'farmer')
        .map((s) => ({ ...structuredClone(s), id: s.id.replace('farmer', 'son'), role: 'son' as const })),
    );
    expect(copy.situation.roles.son.wishOutcomes).toEqual([]);
    expect(playableRoles(copy)).toEqual(['farmer']);
    expect(errorsOf(validatePack(copy, bundle)).map((i) => `${i.rule} ${i.where}`)).toEqual(['wish s1395 son']);
    // 바람 줄을 채우면 풀린다
    copy.situation.roles.son.wishOutcomes = [{ fulfilled: true, reason: '바람대로 되었어요.' }];
    expect(playableRoles(copy)).toEqual(['son', 'farmer']);
    expect(errorsOf(validatePack(copy, bundle))).toEqual([]);
  });

  it('지금 자료에서 "할 수 있는 집"은 모두 바람을 가릴 줄이 있다', () => {
    for (const pack of packs) {
      for (const role of playableRoles(pack)) {
        expect(pack.situation.roles[role].wishOutcomes.length).toBeGreaterThan(0);
      }
      if (playableRoles(pack).length > 0) expect(pack.situation.endings.length).toBeGreaterThan(0);
    }
  });
});

describe('자료만 더하면 풀린다', () => {
  /** 농민 집의 내 장면을 베껴 다른 집의 장면을 만든다(1-나에서 장면 파일을 더하는 것을 흉내 낸다) */
  function withRole(pack: SituationPack, role: 'son' | 'daughter' | 'nobi'): SituationPack {
    const copy = structuredClone(pack);
    const extra = copy.scenes
      .filter((s) => s.role === 'farmer')
      .map((s) => ({ ...structuredClone(s), id: s.id.replace('farmer', role), role }));
    copy.scenes.push(...extra);
    copy.situation.roles[role].wishOutcomes = [{ fulfilled: true, reason: '바람대로 되었어요.' }];
    return copy;
  }

  it('한 집의 장면 넷을 더하면 코드 수정 없이 그 집을 할 수 있다', () => {
    const bigger = withRole(s1395, 'nobi');
    expect(playableRoles(bigger)).toEqual(['farmer', 'nobi']);
    expect(errorsOf(validatePack(bigger, bundle)).map(formatIssue)).toEqual([]);
    expect(gapsOf(validatePack(bigger, bundle)).filter((g) => g.rule === 'role-empty').map((g) => g.where)).toEqual([
      's1395 son',
      's1395 daughter',
    ]);
    const end = playRandom(bigger, 'nobi', 7);
    expect(end.history).toHaveLength(8);
    expect(end.history[0].before).toEqual({ living: 2, body: 6, trust: 4 }); // 노비 집의 시작 수치
  });

  it('네 집을 다 채우면 견주기 물음마다 장면이 있어야 한다', () => {
    const full = withRole(withRole(withRole(s1395, 'son'), 'daughter'), 'nobi');
    expect(playableRoles(full)).toEqual(['son', 'daughter', 'farmer', 'nobi']);
    // 견본 장면만으로는 혼인·글 배우기 물음을 다루는 장면이 없다 → 다 채운 상황에서는 잘못이다
    const coverage = errorsOf(validatePack(full, bundle)).filter((i) => i.rule === 'theme-coverage');
    expect(coverage.map((i) => i.message.match(/"(\w+)"/)?.[1])).toEqual(['marriage', 'learning']);
  });
});
