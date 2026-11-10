// 4판 엔진의 소스 검사(spec 11.1 나의 규칙, 사의 ㉡ 칸): battle·episode·growth·quiz·economy·balance·types4가
// 화면·브라우저·저장·시계를 모르는지(주석을 지운 뒤 금지 낱말과 가져오기를 찾는다), 계절 넘기기·한 해 돌아보기를 부르지 않는지,
// 숫자를 엔진에 박지 않고 balance만 읽는지(겨루기·성장·돈의 숫자 몇을 찾는다).
// 그리고 내용 파일(src/content/foes.ts·skills.ts·gear.ts·situations/s1395/questions.ts)이 생기면 시험 자료(fixtures4)의 숫자와 같은지 본다(없으면 건너뛴다).

import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/engine/balance';
import { battleReady } from '../src/engine/quiz';
import type { Foe, Gear, Question, SkillCard } from '../src/engine/types4';
import { cards41, foes41, hoe } from './fixtures4';

const ENGINES = ['battle', 'episode', 'growth', 'quiz', 'economy', 'balance', 'types4'];
const RAW = import.meta.glob<string>('../src/engine/*.ts', { eager: true, query: '?raw', import: 'default' });

function source(name: string): string {
  const text = RAW[`../src/engine/${name}.ts`];
  if (typeof text !== 'string') throw new Error(`없는 엔진 파일: ${name}`);
  return text;
}

/** 주석을 지운다(글자 안의 '//'·'/*'는 남긴다) */
export function stripComments(src: string): string {
  let out = '';
  let i = 0;
  let quote: string | null = null;
  while (i < src.length) {
    const c = src[i];
    const next = src[i + 1];
    if (quote) {
      out += c;
      if (c === '\\') {
        out += next ?? '';
        i += 2;
        continue;
      }
      if (c === quote) quote = null;
      i++;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      quote = c;
      out += c;
      i++;
      continue;
    }
    if (c === '/' && next === '/') {
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && next === '*') {
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

const code = (name: string) => stripComments(source(name));

describe('엔진은 화면·브라우저·저장·시계를 모른다', () => {
  it('주석 지우기는 글자 안의 것을 남기고 주석만 지운다', () => {
    expect(stripComments("a // Date.now()\nb /* window */ c 'x//y' \"/*z*/\"")).toBe("a \nb  c 'x//y' \"/*z*/\"");
  });

  for (const name of ENGINES) {
    it(`${name}.ts: 금지 낱말·가져오기가 없다`, () => {
      const src = code(name);
      for (const word of [/\bDate\.now\b/, /\bnew Date\b/, /\bDate\(/, /\bMath\.random\b/, /\bperformance\b/, /\blocalStorage\b/, /\bsessionStorage\b/, /\bwindow\b/, /\bdocument\b/, /\bnavigator\b/, /\bsetTimeout\b/, /\bfetch\(/]) {
        expect(src, `${name}: ${word}`).not.toMatch(word);
      }
      const imports = [...src.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
      for (const from of imports) {
        expect(from, `${name}: ${from}`).toMatch(/^\.\/[a-z0-9]+$/);
        expect(from).not.toMatch(/state|screens|ui|map|art|pixel|preact|content/);
      }
    });
  }

  it('새 모듈은 계절 넘기기·한 해 돌아보기(closeSeason·nextSeason·reviewYear)를 부르지 않는다', () => {
    for (const name of ENGINES) {
      const src = code(name);
      expect(src, name).not.toMatch(/\b(closeSeason|nextSeason|reviewYear|summarizeSeason)\b/);
      expect(src, name).not.toMatch(/from\s+['"]\.\/review['"]/);
    }
  });

  it('3판 엔진(game.ts)은 새 모듈을 가져오지 않는다(에피소드 없이 부르는 길이 그대로)', () => {
    const src = code('game');
    expect(src).not.toMatch(/from\s+['"]\.\/(battle|episode|growth|quiz|economy|balance|types4)['"]/);
  });

  it('숫자는 balance.ts 한 곳에: 엔진에 balance의 숫자(소수, 그리고 11 이상)를 그대로 박지 않는다', () => {
    const literals = (name: string) => new Set([...code(name).matchAll(/(?<![\w.])(\d+(?:\.\d+)?)(?![\w.])/g)].map((m) => Number(m[1])));
    const table = new Set<number>();
    const visit = (v: unknown) => {
      if (typeof v === 'number') table.add(v);
      else if (Array.isArray(v)) v.forEach(visit);
      else if (v && typeof v === 'object') Object.values(v).forEach(visit);
    };
    visit(BALANCE);
    // 작은 정수(0~10)와 16(비트 묶음의 16진수)은 셈의 꼴(빈 것·하나·차례·자리)과 겹쳐 빼고 본다
    const telltale = [...table].filter((n) => !Number.isInteger(n) || (n > 10 && n !== 16));
    expect(telltale).toEqual(expect.arrayContaining([1.5, 0.5, 100, 15, 300, 80]));
    for (const name of ['battle', 'episode', 'growth', 'quiz', 'economy']) {
      const stray = [...literals(name)].filter((n) => telltale.includes(n));
      expect(stray, name).toEqual([]);
    }
  });
});

// ── 내용 파일과 견주기(생기면) ─────────────────────────────────────

/** 모듈의 내보낸 값에서 꼴이 맞는 것을 모은다(목록·하나·id → 것) */
function collect<T>(mods: Record<string, unknown>, ok: (x: unknown) => x is T): T[] {
  const out = new Map<string, T>();
  const visit = (v: unknown) => {
    if (ok(v)) out.set((v as { id: string }).id, v);
    else if (Array.isArray(v)) v.forEach((x) => ok(x) && out.set((x as { id: string }).id, x));
    else if (v && typeof v === 'object') for (const x of Object.values(v)) if (ok(x)) out.set((x as { id: string }).id, x);
  };
  for (const mod of Object.values(mods)) for (const v of Object.values(mod as Record<string, unknown>)) visit(v);
  return [...out.values()];
}

const isFoe = (x: unknown): x is Foe => Boolean(x && typeof x === 'object' && 'moves' in x && 'hp' in x && 'phases' in x);
const isCard = (x: unknown): x is SkillCard => Boolean(x && typeof x === 'object' && 'bonus' in x && 'base' in x && 'kind' in x);
const isGear = (x: unknown): x is Gear => Boolean(x && typeof x === 'object' && 'boost' in x && 'slot' in x);
const isQuestion = (x: unknown): x is Question => Boolean(x && typeof x === 'object' && 'ask' in x && 'form' in x && 'topic' in x);

const foeMods = import.meta.glob('../src/content/foes.ts', { eager: true }) as Record<string, unknown>;
const cardMods = import.meta.glob('../src/content/skills.ts', { eager: true }) as Record<string, unknown>;
const gearMods = import.meta.glob('../src/content/gear.ts', { eager: true }) as Record<string, unknown>;
const questionMods = import.meta.glob('../src/content/situations/s1395/questions.ts', { eager: true }) as Record<string, unknown>;

describe('내용 파일의 숫자 = 시험 자료의 숫자(①-1)', () => {
  it.skipIf(Object.keys(foeMods).length === 0)('고비 둘(foes.ts)', () => {
    const real = collect(foeMods, isFoe);
    for (const want of foes41) {
      const got = real.find((f) => f.id === want.id);
      expect(got, want.id).toBeDefined();
      if (!got) continue;
      expect({ hp: got.hp, phases: got.phases, shield: got.shield, strong: got.strong, weak: got.weak, order: got.order, kind: got.kind }).toEqual({
        hp: want.hp,
        phases: want.phases,
        shield: want.shield,
        strong: want.strong,
        weak: want.weak,
        order: want.order,
        kind: want.kind,
      });
      expect(got.moves.map((m) => ({ id: m.id, strong: m.strong, hit: m.hit, effect: m.effect, weight: m.weight }))).toEqual(
        want.moves.map((m) => ({ id: m.id, strong: m.strong, hit: m.hit, effect: m.effect, weight: m.weight })),
      );
    }
  });

  it.skipIf(Object.keys(cardMods).length === 0)('카드 열(skills.ts)', () => {
    const real = collect(cardMods, isCard);
    for (const want of cards41) {
      const got = real.find((c) => c.id === want.id);
      expect(got, want.id).toBeDefined();
      expect({ kind: got?.kind, base: got?.base, bonus: got?.bonus }).toEqual({ kind: want.kind, base: want.base, bonus: want.bonus });
      expect(got?.tags).toContain('ep:s1395-1');
      expect(got?.tags.some((t) => t === 'topic:soc5-2-1' || t === 'topic:soc5-2-2')).toBe(true);
    }
  });

  it.skipIf(Object.keys(gearMods).length === 0)('호미(gear.ts)', () => {
    const got = collect(gearMods, isGear).find((g) => g.id === hoe.id);
    expect(got?.boost).toEqual(hoe.boost);
  });

  it.skipIf(Object.keys(questionMods).length === 0)('이야기 문제 20(questions.ts): 쉬움 6·보통 10·어려움 4, 핵심 7, 모두 겨루기 꼴, 비트 자리가 겹치지 않음', () => {
    const qs = collect(questionMods, isQuestion).filter((q) => q.topic === 'ep-s1395-1');
    expect(qs).toHaveLength(20);
    expect([1, 2, 3].map((l) => qs.filter((q) => q.level === l).length)).toEqual([6, 10, 4]);
    expect(qs.filter((q) => (q.tags ?? []).includes('core'))).toHaveLength(7);
    for (const q of qs) expect(battleReady(q), q.id).toBe(true);
    const tails = qs.map((q) => Number(q.id.slice(q.id.lastIndexOf('-') + 1)));
    expect(new Set(tails).size).toBe(20);
  });
});
