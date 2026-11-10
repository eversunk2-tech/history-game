// 저장 꼴 5(src/state/save5.ts — spec 5.8, 11.1 다의 Save5). 4-1 ㉢부터 앱이 쓰는 저장이다(store.test.ts가 앱의 흐름으로 본다).
// ① 꼴 5 견본(tests/fixtures/saves/v5/schema5-*)마다 읽고 쓰고 다시 읽어 같다 ② 옛 꼴 2~4의 견본 스물일곱 벌은 옮기지 않고 알림 + 한 벌 + 처음부터
// ③ 새 꼴·읽을 수 없는 것·잘라 낸 것 ④ 한 칸 100KB ⑤ 반·은행 칸은 따로 ⑥ 겨루기는 저장하지 않는다.
// 견본은 엔진(episode·battle·quiz·growth)으로 실제 판을 흉내 내어 만들었다(①-1: 거점 → 현장 도중 → 큰 고비 앞 → 결과 종이 도중 → 깬 뒤 → 서당 도중).

import { describe, expect, it } from 'vitest';
import {
  BACKUP5_KEY,
  BACKUP_KEY,
  BANK_KEY_PREFIX,
  CLASS_KEY,
  OLD_NOTICE,
  SAVE_KEY,
  SAVE_LIMIT,
  checkSave5,
  emptySave5,
  episodeRecord,
  loadSave5,
  parseSave5,
  readSlot,
  resumeAt,
  saveBytes,
  serializeSave5,
  wipeSave5,
  writeSave5,
  writeSlot,
} from '../src/state/save5';
import { SCHEMA } from '../src/state/storage';
import type { StorageLike } from '../src/state/storage';
import type { QuizLog, Save5 } from '../src/engine/types4';
import { packBits } from '../src/engine/quiz';

// 꼴 5 견본은 tests/fixtures/saves/v5/에 둔다(tests/fixtures/saves/*.json은 옛 꼴 2~4 스물일곱 벌 — 알림 + 한 벌 + 처음부터의 입력으로만 쓴다)
const FIXTURES = import.meta.glob<string>(['./fixtures/saves/*.json', './fixtures/saves/v5/*.json'], { eager: true, query: '?raw', import: 'default' });
const fixture = (name: string): string => FIXTURES[`./fixtures/saves/v5/${name}.json`] ?? FIXTURES[`./fixtures/saves/${name}.json`] ?? '';
const NEW = Object.keys(FIXTURES).filter((p) => /schema5-/.test(p)).map((p) => p.replace(/^.*\/(.*)\.json$/, '$1')).sort();
const OLD = Object.keys(FIXTURES).filter((p) => /schema[234]-/.test(p)).sort();

/** 기기 저장소 흉내(쓴 것을 적어 둔다) */
function memory(start: Record<string, string> = {}): StorageLike & { data: Record<string, string>; writes: string[] } {
  const data = { ...start };
  const writes: string[] = [];
  return {
    data,
    writes,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      writes.push(k);
      data[k] = v;
    },
    removeItem: (k) => {
      delete data[k];
    },
  };
}

describe('꼴 5 견본: 읽고 쓰고 다시 읽어 같다', () => {
  it('견본 여섯이 있다: 거점 · 현장 도중 · 겨루기 도중(큰 고비 앞) · 결과 종이 도중 · ①-1을 깬 뒤 · 서당 도중', () => {
    expect(NEW).toEqual(['schema5-battle-mid', 'schema5-cleared', 'schema5-field-mid', 'schema5-hub', 'schema5-result-mid', 'schema5-seodang-mid']);
  });

  for (const name of NEW) {
    it(`${name}: 꼴이 맞고, 읽은 것 = 적힌 것, 써서 다시 읽어도 같다(판 번호만 새로)`, () => {
      const raw = fixture(name);
      expect(checkSave5(JSON.parse(raw))).toEqual([]);
      const loaded = parseSave5(raw);
      expect(loaded.status).toBe('ok');
      expect(loaded.save).toEqual(JSON.parse(raw));
      const disk = memory();
      const wrote = writeSave5(loaded.save, disk, '20261110-test');
      expect(wrote).toEqual({ ok: true, bytes: saveBytes(disk.data[SAVE_KEY]) });
      expect(wrote.bytes).toBeLessThan(SAVE_LIMIT);
      const again = loadSave5(disk);
      expect(again.status).toBe('ok');
      expect(again.save).toEqual({ ...JSON.parse(raw), build: '20261110-test' });
      expect(disk.data[BACKUP_KEY]).toBeUndefined();
    });
  }

  it('이어 하기의 자리: 거점 · 현장(서 있던 칸) · 겨루기의 처음부터 · 결과 종이', () => {
    const at = (name: string) => parseSave5(fixture(name)).save;
    expect(resumeAt(at('schema5-hub'))).toBe('hub');
    expect(resumeAt(at('schema5-cleared'))).toBe('hub');
    expect(resumeAt(at('schema5-seodang-mid'))).toBe('hub');
    const field = at('schema5-field-mid');
    expect(resumeAt(field)).toBe('field');
    expect(field.current!.game.at).toBe('41,39');
    expect(field.current!.walked!.length).toBeGreaterThan(100);
    expect(resumeAt(at('schema5-battle-mid'))).toBe('battle');
    const result = at('schema5-result-mid');
    expect(resumeAt(result)).toBe('result');
    expect(result.current!.result!.stars[0]).toBe(true);
  });

  it('결과 종이 도중의 칸(4-1 ㉢에서 더함 — 처음 깸·새 별·최고 기록·레벨·유물·구해 줌)은 있으면 꼴을 보고, 없어도(㉡의 꼴) 읽는다', () => {
    const save = JSON.parse(fixture('schema5-result-mid')) as Save5;
    const r = save.current!.result!;
    expect(r.relics).toEqual(['relic-seed-sack']);
    expect(r.rescued).toBe(true);
    const bare = JSON.parse(JSON.stringify(save)) as Save5;
    for (const key of ['first', 'newStars', 'best', 'bestNew', 'levels', 'banked', 'stepped', 'relics', 'rescued']) delete (bare.current!.result as Record<string, unknown>)[key];
    expect(checkSave5(bare)).toEqual([]);
    expect(parseSave5(JSON.stringify(bare)).status).toBe('ok');
    const wrong = JSON.parse(JSON.stringify(save)) as Save5;
    (wrong.current!.result as Record<string, unknown>).best = -1;
    expect(checkSave5(wrong)).toContain('current.result');
    expect(parseSave5(JSON.stringify(wrong)).dropped).toEqual(['current']);
  });

  it('결과 종이 칸의 뼈대(별 셋·점수·경험치·쌀과 베·카드)가 어긋나면 하던 에피소드만 내려놓는다(4-1 ㉢ Review 권고 ㅁ — R27)', () => {
    const save = JSON.parse(fixture('schema5-result-mid')) as Save5;
    const breaks: [string, (r: Record<string, unknown>) => void][] = [
      ['별이 둘', (r) => (r.stars = [true, false])],
      ['별이 글자', (r) => (r.stars = ['★', '☆', '☆'])],
      ['점수가 음수', (r) => (r.score = -5)],
      ['점수가 없음', (r) => delete r.score],
      ['경험치가 글자', (r) => (r.xp = '10')],
      ['돈 주머니가 어긋남', (r) => (r.purse = { rice: 1 })],
      ['카드가 글자 하나', (r) => (r.cards = 'skill-sow')],
      ['칸이 비었음', (r) => void Object.keys(r).forEach((k) => delete r[k])],
    ];
    for (const [what, hurt] of breaks) {
      const wrong = JSON.parse(JSON.stringify(save)) as Save5;
      hurt(wrong.current!.result as unknown as Record<string, unknown>);
      expect(checkSave5(wrong), what).toContain('current.result');
      const read = parseSave5(JSON.stringify(wrong));
      expect(read.dropped, what).toEqual(['current']);
      expect(read.save.current, what).toBeUndefined();
    }
  });

  it('겨루기는 저장하지 않는다: 큰 고비 앞 견본에는 phase만 있고 겨루기 안의 것(기운·손패·예고·문제)은 없다', () => {
    const raw = fixture('schema5-battle-mid');
    const cur = JSON.parse(raw).current as Record<string, unknown>;
    expect(cur.phase).toBe('battle');
    const keys = new Set<string>();
    const walk = (v: unknown): void => {
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object') for (const [k, one] of Object.entries(v)) keys.add(k), walk(one);
    };
    walk(cur);
    for (const key of ['foeHp', 'hand', 'pile', 'intent', 'pending', 'asked', 'momentum', 'shield', 'battle']) expect(keys.has(key), key).toBe(false);
    expect(cur.minors).toEqual(['s1395-1-hardsoil', 's1395-1-sowing']);
  });

  it('깬 뒤의 기록: 별·최고 기록·판 수·처음 깬 판의 선택, 유물과 도리깨, 서당의 비트 묶음', () => {
    const save = parseSave5(fixture('schema5-seodang-mid')).save;
    const ep = episodeRecord(save, 's1395', 's1395-1');
    expect(ep.cleared).toBe(true);
    expect(ep.plays).toBe(1);
    expect(ep.best).toBeGreaterThan(0);
    expect(save.stories.s1395.firstRun['s1395-spring-return']).toBe('help');
    expect(save.items).toEqual(expect.arrayContaining(['gear-flail', 'relic-seed-sack']));
    expect(save.quiz['soc5-2-1'].wrong.length).toBeGreaterThan(0);
    expect(save.today.topics['soc5-2-1']).toBe(1);
    expect(episodeRecord(save, 's1395', 's1395-2')).toEqual({ stars: [false, false, false], best: 0, plays: 0, cleared: false });
  });
});

describe('옛 꼴(2~4)은 옮기지 않는다 — 알림 + 한 벌 + 처음부터(5.8)', () => {
  it(`옛 견본 스물일곱 벌(꼴 2~4 — 지금 앱의 꼴은 ${SCHEMA})`, () => {
    expect(OLD).toHaveLength(27);
    for (const path of OLD) {
      const raw = FIXTURES[path];
      expect(JSON.parse(raw).schema, path).toBeLessThan(5);
      const parsed = parseSave5(raw);
      expect(parsed.status, path).toBe('old');
      expect(parsed.notice, path).toBe(OLD_NOTICE);
      // 처음부터: 깬 기록·카드·진행 중인 해를 옮기지 않는다
      expect(parsed.save, path).toEqual(emptySave5());
      const disk = memory({ [SAVE_KEY]: raw });
      const loaded = loadSave5(disk);
      expect(loaded.status, path).toBe('old');
      expect(disk.data[BACKUP_KEY], path).toBe(raw); // 옛 글자 한 벌(그대로)
      expect(disk.writes, path).toEqual([BACKUP_KEY]); // 저장 칸은 다음 저장이 덮어쓴다(읽기는 쓰지 않는다)
    }
  });

  it('알림은 "게임이 새로워져서 처음부터 해요"', () => {
    expect(OLD_NOTICE).toBe('게임이 새로워져서 처음부터 해요');
  });
});

describe('새 꼴·읽을 수 없는 것·잘라 낸 것', () => {
  const hub = () => JSON.parse(fixture('schema5-hub')) as Save5;
  const cleared = () => JSON.parse(fixture('schema5-cleared')) as Save5;

  it('코드보다 새 꼴(6)은 건드리지 않는다', () => {
    const raw = JSON.stringify({ ...hub(), schema: 6 });
    const disk = memory({ [SAVE_KEY]: raw });
    expect(loadSave5(disk).status).toBe('newer');
    expect(disk.writes).toEqual([]);
  });

  it('읽을 수 없는 글자·꼴 번호가 없는 것·주인공이 어긋난 것은 처음부터 하고 한 벌 남긴다', () => {
    for (const raw of ['{망가짐', '[]', JSON.stringify({ hero: {} }), JSON.stringify({ ...hub(), hero: { ...hub().hero, level: 0 } }), JSON.stringify({ ...hub(), purse: { rice: -1, cloth: 0, coin: 0 } })]) {
      const disk = memory({ [SAVE_KEY]: raw });
      const loaded = loadSave5(disk);
      expect(loaded.status, raw).toBe('unreadable');
      expect(loaded.save).toEqual(emptySave5());
      // 꼴 5를 읽을 수 없으면 꼴 5의 한 벌 칸에(옛 꼴의 한 벌 칸은 건드리지 않는다 — 4-1 ㉢, ㉡ Review 기록 3)
      expect(disk.data[BACKUP5_KEY]).toBe(raw);
      expect(disk.data[BACKUP_KEY]).toBeUndefined();
    }
  });

  it('하던 에피소드를 읽을 수 없으면 그것만 버리고 깬 기록·주인공·돈·서당 기록은 지킨다(한 벌)', () => {
    const save = JSON.parse(fixture('schema5-field-mid')) as Save5;
    (save.current as unknown as Record<string, unknown>).game = { situationId: 's1395' };
    const raw = JSON.stringify(save);
    const disk = memory({ [SAVE_KEY]: raw });
    const loaded = loadSave5(disk);
    expect(loaded.status).toBe('trimmed');
    expect(loaded.dropped).toEqual(['current']);
    expect(loaded.save.current).toBeUndefined();
    expect(loaded.save.hero).toEqual(save.hero);
    expect(loaded.save.purse).toEqual(save.purse);
    expect(disk.data[BACKUP5_KEY]).toBe(raw);
  });

  it('옛 꼴의 한 벌은 꼴 5가 나중에 어긋나도 덮이지 않는다(칸을 나눴다 — ㉡ Review 기록 3). "처음부터"도 옛 꼴의 한 벌은 남긴다', () => {
    const old = OLD.map((path) => FIXTURES[path])[0];
    const disk = memory({ [SAVE_KEY]: old });
    expect(loadSave5(disk).status).toBe('old');
    expect(disk.data[BACKUP_KEY]).toBe(old);
    // 꼴 5로 놀다가 하던 에피소드가 어긋난 저장이 되었다
    const broken = JSON.parse(fixture('schema5-field-mid')) as Save5;
    (broken.current as unknown as Record<string, unknown>).phase = 'nowhere';
    disk.data[SAVE_KEY] = JSON.stringify(broken);
    expect(loadSave5(disk).status).toBe('trimmed');
    expect(disk.data[BACKUP_KEY]).toBe(old);
    expect(disk.data[BACKUP5_KEY]).toBe(JSON.stringify(broken));
    // 처음부터(두 번 물은 뒤): 저장과 꼴 5의 한 벌을 지우고, 옛 꼴의 한 벌은 남긴다
    wipeSave5(disk);
    expect(disk.data[SAVE_KEY]).toBeUndefined();
    expect(disk.data[BACKUP5_KEY]).toBeUndefined();
    expect(disk.data[BACKUP_KEY]).toBe(old);
    expect(BACKUP5_KEY).toBe('joseon-year/backup5');
    expect(() => writeSlot(disk, BACKUP5_KEY, {})).toThrow();
  });

  it('이야기 하나·서당 한 주제가 어긋나면 그것만 버린다', () => {
    const save = cleared();
    (save.stories as Record<string, unknown>).s1446 = { role: 'farmer' };
    (save.quiz as Record<string, unknown>)['soc5-2-2'] = { seen: 'xyz' };
    const loaded = parseSave5(JSON.stringify(save));
    expect(loaded.status).toBe('trimmed');
    expect(loaded.dropped).toEqual(['stories.s1446', 'quiz.soc5-2-2']);
    expect(Object.keys(loaded.save.stories)).toEqual(['s1395']);
    expect(Object.keys(loaded.save.quiz)).toEqual(['ep-s1395-1']);
  });

  it('비어 있으면 처음부터(한 벌을 남기지 않는다), 저장이 안 되는 창이면 noStorage', () => {
    const disk = memory();
    expect(loadSave5(disk)).toEqual({ save: emptySave5(), status: 'empty' });
    expect(disk.writes).toEqual([]);
    expect(loadSave5(null).status).toBe('noStorage');
    expect(writeSave5(emptySave5(), null)).toEqual({ ok: false, bytes: saveBytes(serializeSave5(emptySave5())), why: 'noStorage' });
    const broken: StorageLike = { getItem: () => null, setItem: () => { throw new Error('가득 참'); }, removeItem: () => undefined };
    expect(writeSave5(emptySave5(), broken).why).toBe('failed');
  });
});

describe('한 칸 100KB 안(5.8)', () => {
  it('서당 스물여섯 주제(1,820문제)를 모두 풀고 에피소드 서른넷을 깬 저장도 100KB 안이다', () => {
    const save = parseSave5(fixture('schema5-cleared')).save;
    const quiz: Record<string, QuizLog> = {};
    for (let t = 0; t < 26; t++) {
      const n = t % 2 === 0 ? 80 : 60;
      const id = (i: number) => `soc5-${1 + Math.floor(t / 10)}-${(t % 10) + 1}-${String(i + 1).padStart(4, '0')}`;
      const all = Array.from({ length: n + 1 }, (_, i) => (i === 0 ? 0 : 1));
      quiz[`soc5-t${t}`] = {
        seen: packBits(all),
        right: packBits(all),
        wrong: Array.from({ length: 10 }, (_, i) => id(i)),
        lastRight: Array.from({ length: n }, (_, i) => id(i)),
        best: 100,
        laps: 3,
        rounds: 12,
      };
    }
    const episodes: Save5['stories'][string]['episodes'] = {};
    for (let e = 0; e < 34; e++) episodes[`s${1395 + e}-${e % 6}`] = { stars: [true, true, true], best: 999, plays: 9, cleared: true };
    const stories: Save5['stories'] = {};
    for (const story of ['s1395', 's1446', 's1592', 's1636', 's1795', 's1863', 's1899']) {
      stories[story] = { ...save.stories.s1395, episodes, firstRun: Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`${story}-happening-${i}`, `choice-${i}`])), met: Array.from({ length: 40 }, (_, i) => `place-${i}`) };
    }
    const full: Save5 = { ...save, quiz, stories, items: Array.from({ length: 60 }, (_, i) => `relic-${i}`) };
    expect(checkSave5(full)).toEqual([]);
    const bytes = saveBytes(full);
    expect(bytes).toBeLessThan(SAVE_LIMIT);
    expect(writeSave5(full, memory()).ok).toBe(true);
  });

  it('100KB를 넘으면 쓰지 않고 알린다(덮어쓰지 않는다)', () => {
    const big = { ...emptySave5(), items: Array.from({ length: 20000 }, (_, i) => `item-${i}`) };
    const disk = memory({ [SAVE_KEY]: 'before' });
    const wrote = writeSave5(big, disk);
    expect(wrote.ok).toBe(false);
    expect(wrote.why).toBe('tooBig');
    expect(wrote.bytes).toBeGreaterThan(SAVE_LIMIT);
    expect(disk.data[SAVE_KEY]).toBe('before');
  });
});

describe('반·은행 칸은 저장과 따로(5.8)', () => {
  it('반(joseon-year/class)과 받아 둔 주제(joseon-year/bank/<주제>)는 제 칸에 쓰고 읽는다. 저장 칸은 건드리지 않는다', () => {
    const disk = memory({ [SAVE_KEY]: fixture('schema5-hub') });
    expect(writeSlot(disk, CLASS_KEY, { code: 'ABCDEF', packVer: '2026-11-10' })).toBe(true);
    expect(writeSlot(disk, `${BANK_KEY_PREFIX}math-5-1-1`, { topic: 'math-5-1-1', questions: [] })).toBe(true);
    expect(readSlot(disk, CLASS_KEY)).toEqual({ code: 'ABCDEF', packVer: '2026-11-10' });
    expect(readSlot(disk, `${BANK_KEY_PREFIX}math-5-1-1`)).toEqual({ topic: 'math-5-1-1', questions: [] });
    expect(disk.data[SAVE_KEY]).toBe(fixture('schema5-hub'));
    expect(CLASS_KEY).toBe('joseon-year/class');
    expect(BANK_KEY_PREFIX).toBe('joseon-year/bank/');
    expect(() => writeSlot(disk, SAVE_KEY, {})).toThrow();
    expect(() => writeSlot(disk, 'joseon-year/other', {})).toThrow();
    expect(() => readSlot(disk, BACKUP_KEY)).toThrow();
    expect(readSlot(disk, `${BANK_KEY_PREFIX}none`)).toBeNull();
    expect(readSlot(memory({ [CLASS_KEY]: '{망가짐' }), CLASS_KEY)).toBeNull();
  });

  it('저장의 키는 3판 그대로(joseon-year/save, joseon-year/backup), 꼴 번호는 5', () => {
    expect(SAVE_KEY).toBe('joseon-year/save');
    expect(BACKUP_KEY).toBe('joseon-year/backup');
    expect(JSON.parse(serializeSave5(emptySave5())).schema).toBe(5);
    expect(SCHEMA).toBe(5); // 앱의 꼴은 5다(4-1 ㉢에서 바꿨다)
  });
});
