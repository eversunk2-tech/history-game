// 디자인의 바탕 시험(3판 다듬기 ㉠ — spec.md 1절·4.5·6.2): 토큰의 대비, 글자 크기의 바닥, 누를 자리 56px, 주홍의 자리,
// 움직임 줄이기, ✓·✗ 없음, 글꼴 파일과 글자 빠짐, 그림 파일의 크기. 브라우저 없이 CSS·코드의 글자와 글꼴 기록(coverage.json)을 읽는다.
// 화면에서 보는 것(실제 계산된 글자 크기, 겹침, 그림 위의 대비)은 Review가 머리 없는 크롬으로 따로 잰다.

import { describe, expect, it } from 'vitest';
import coverage from '../src/assets/fonts/coverage.json';
import { getPack } from '../src/content';
import { OPEN_GAP_MS, TapGate } from '../src/ui/taps';
import { bookStamp } from '../src/ui/year';

// CSS는 시험 도구가 글자로 넘겨주지 않는다(css 처리를 끈 vitest — 빈 글자가 온다). 그래서 Node의 fs로 읽는다(device.test.ts와 같은 길).
const FS = (await import(/* @vite-ignore */ ['node', 'fs'].join(':'))) as {
  readdirSync(path: string): string[];
  readFileSync(path: string): Uint8Array;
  statSync(path: string): { size: number };
};
const pathOf = (rel: string): string => decodeURIComponent(new URL(rel, import.meta.url).pathname);
const CSS: Record<string, string> = Object.fromEntries(
  FS.readdirSync(pathOf('../src/styles/'))
    .filter((name) => name.endsWith('.css'))
    .map((name) => [`../src/styles/${name}`, new TextDecoder().decode(FS.readFileSync(pathOf(`../src/styles/${name}`)))]),
);
const CODE = import.meta.glob<string>(['../src/**/*.ts', '../src/**/*.tsx'], { eager: true, query: '?raw', import: 'default' });
const CHARSET = import.meta.glob<string>('../src/assets/fonts/charset.txt', { eager: true, query: '?raw', import: 'default' });
const FONT_FILES = import.meta.glob<string>('../src/assets/fonts/*.woff2', { eager: true, query: '?url', import: 'default' });
const UI_FILES = import.meta.glob<string>('../src/assets/ui/*', { eager: true, query: '?url', import: 'default' });

const css = (name: string): string => CSS[`../src/styles/${name}`] ?? '';
const code = (end: string): string => CODE[Object.keys(CODE).find((path) => path.endsWith(end)) ?? ''] ?? '';

/** 파일 크기(바이트) */
async function fileSize(rel: string): Promise<number> {
  return FS.statSync(pathOf(rel)).size;
}

// ── CSS 읽기 ────────────────────────────────────────────────

interface Rule {
  file: string;
  /** 쉼표로 나눈 선택자 하나하나 */
  selectors: string[];
  body: string;
  /** 감싼 @media·@supports 머리들 */
  at: string[];
}

/** 아주 작은 CSS 읽개: 설명을 빼고 규칙과 그 규칙을 감싼 @media를 모은다. @keyframes는 이름만 모은다. */
function parseCss(file: string, text: string): { rules: Rule[]; keyframes: string[] } {
  const src = text.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules: Rule[] = [];
  const keyframes: string[] = [];
  const walk = (part: string, at: string[]): void => {
    let i = 0;
    while (i < part.length) {
      const open = part.indexOf('{', i);
      if (open < 0) break;
      const head = part.slice(i, open).trim();
      // 짝 맞는 닫는 괄호
      let depth = 1;
      let j = open + 1;
      for (; j < part.length && depth > 0; j++) {
        if (part[j] === '{') depth++;
        else if (part[j] === '}') depth--;
      }
      const inner = part.slice(open + 1, j - 1);
      if (head.startsWith('@keyframes')) keyframes.push(head.replace('@keyframes', '').trim());
      else if (head.startsWith('@media') || head.startsWith('@supports') || head.startsWith('@container')) walk(inner, [...at, head]);
      else if (!head.startsWith('@')) rules.push({ file, selectors: head.split(',').map((one) => one.trim().replace(/\s+/g, ' ')), body: inner, at });
      i = j;
    }
  };
  walk(src, []);
  return { rules, keyframes };
}

const PARSED = Object.entries(CSS).map(([path, text]) => parseCss(path.split('/').pop() ?? path, text));
const RULES = PARSED.flatMap((one) => one.rules);
const KEYFRAMES = PARSED.flatMap((one) => one.keyframes);

/** :root(밖의 @media 없이)와 계절 묶음의 토큰 값 */
function tokens(selector: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rule of RULES.filter((r) => r.file === 'base.css' && r.at.length === 0 && r.selectors.includes(selector))) {
    for (const m of rule.body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  }
  return out;
}

// ── 대비(WCAG 2) ─────────────────────────────────────────────

function rgbOf(value: string): [number, number, number] {
  const hex = /^#([0-9a-f]{6})$/i.exec(value.trim());
  if (!hex) throw new Error(`색이 #rrggbb가 아니다: ${value}`);
  const n = parseInt(hex[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance(value: string): number {
  const [r, g, b] = rgbOf(value).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('토큰 — 값과 대비(spec.md 1.1의 표)', () => {
  const root = tokens(':root');
  const t = (name: string): string => {
    const value = root[name];
    if (!value) throw new Error(`토큰이 없다: ${name}`);
    return value;
  };

  it('지금 이름을 살리고 값을 시안 B로: 바탕 빛은 그대로(#f4ecd9 — 매니페스트·띠 빛과 묶여 있다)', () => {
    expect(t('--paper')).toBe('#f4ecd9');
    expect(t('--paper-light')).toBe('#fbf7ee');
    expect(t('--paper-deep')).toBe('#ede3cd');
    expect(t('--paper-deeper')).toBe('#e0d2b3');
    expect(t('--ink')).toBe('#2b241d');
    expect(t('--ink-soft')).toBe('#4b4137');
    expect(t('--ink-faint')).toBe('#6a5e50');
    expect(t('--btn')).toBe('#2e5591'); // 쪽빛
    expect(t('--btn-edge')).toBe('#1b3563');
    expect(t('--focus')).toBe('#2b241d'); // 초점 테는 먹(쪽빛 단추와 헷갈리지 않게)
    expect(t('--ju')).toBe('#c4462a');
    expect(t('--rok')).toBe('#1f7d74');
    expect(t('--hwang')).toBe('#e9ad2a');
  });

  it('글 4.5:1 넘게: 먹·먹2·먹3이 바탕·종이·파인 자리 위에서', () => {
    for (const bg of ['--paper', '--paper-light']) {
      for (const fg of ['--ink', '--ink-soft', '--ink-faint']) expect(contrast(t(fg), t(bg)), `${fg} / ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(t('--ink-faint'), t('--paper-deep'))).toBeGreaterThanOrEqual(4.5);
    // 가장 깊은 파인 자리 위에는 먹2부터(먹3은 4.22:1이라 쓰지 않는다 — 잠긴 단추의 글은 먹2)
    expect(contrast(t('--ink-soft'), t('--paper-deeper'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t('--ink-faint'), t('--paper-deeper'))).toBeLessThan(4.5);
    expect(css('base.css')).toMatch(/\.btn:disabled \{[^}]*color: var\(--ink-soft\);/);
  });

  it('쪽빛 단추: 흰 글 4.5:1 넘게, 단추 몸이 바탕과 3:1 넘게 갈린다. "다음 ▼"의 옅은 짝 위 먹·먹3', () => {
    expect(contrast(t('--btn-on'), t('--btn'))).toBeGreaterThanOrEqual(7);
    expect(contrast(t('--btn'), t('--paper'))).toBeGreaterThanOrEqual(3);
    expect(contrast(t('--ink'), t('--btn-soft'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t('--ink-faint'), t('--btn-soft'))).toBeGreaterThanOrEqual(4.5);
  });

  it('리본·황·주홍: 리본 위 흰 글, 황·황 옅게 위 먹, 주홍 칸의 테와 뇌록 도장의 테가 종이와 3:1 넘게', () => {
    expect(contrast(t('--baek'), t('--rok'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t('--ink'), t('--hwang'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t('--ink'), t('--hwang-soft'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t('--ju'), t('--paper-light'))).toBeGreaterThanOrEqual(3);
    expect(contrast(t('--rok-edge'), t('--paper-light'))).toBeGreaterThanOrEqual(3);
  });

  it('초점 테: 바탕 위 먹 테, 대화 장면(어두운 그림) 안에서는 한지빛 테 — 둘 다 3:1 넘게', () => {
    expect(contrast(t('--focus'), t('--paper'))).toBeGreaterThanOrEqual(3);
    const talk = RULES.find((rule) => rule.file === 'talk.css' && rule.selectors.includes('.talk') && /--focus/.test(rule.body));
    const light = /--focus:\s*(#[0-9a-f]{6})/i.exec(talk?.body ?? '')?.[1] ?? '';
    expect(light).toBe('#fbf7ee');
    expect(contrast(light, '#1b1410')).toBeGreaterThanOrEqual(3); // 대화 장면의 바탕
    expect(contrast(light, '#3c5a36')).toBeGreaterThanOrEqual(3); // 그림의 짙은 풀빛쯤
    expect(css('base.css')).toMatch(/button:focus-visible \{\s*outline: 3px solid var\(--focus\);\s*outline-offset: 3px;/);
    // 대사 창은 두 겹: 먹 테 3px을 한지빛(--focus)이 감싼다 — 흰 옷 위에서는 먹이, 어두운 그림 위에서는 한지빛이 갈린다(Review ㉠ 2)
    expect(css('talk.css')).toMatch(/button\.talk-box:focus-visible \{\s*outline: 3px solid var\(--ink\);\s*outline-offset: 3px;\s*box-shadow:[^;]*0 0 0 9px var\(--focus\);/);
    expect(contrast(t('--ink'), light)).toBeGreaterThanOrEqual(3);
    // 어느 바탕 빛에서든 두 겹 가운데 하나는 3:1 넘는다(먹 대 바탕, 한지빛 대 바탕 중 큰 쪽) — 회색 계단으로 확인
    for (let v = 0; v <= 255; v += 5) {
      const bg = `#${v.toString(16).padStart(2, '0').repeat(3)}`;
      expect(Math.max(contrast(t('--ink'), bg), contrast(light, bg)), bg).toBeGreaterThanOrEqual(3);
    }
  });

  it('계절 칩 위 먹 4.5:1, 계절 진한 빛 위 흰 4.5:1(네 계절 모두)', () => {
    for (const season of ['spring', 'summer', 'autumn', 'winter']) {
      const one = tokens(`.season-${season}`);
      expect(contrast(t('--ink'), one['--season-chip']), season).toBeGreaterThanOrEqual(4.5);
      expect(contrast('#ffffff', one['--season-deep']), season).toBeGreaterThanOrEqual(4.5);
    }
  });
});

// ── 크기 ──────────────────────────────────────────────────

/** 1.125rem(18px) 아래의 글자 크기를 써도 되는 자리: 글이 아닌 꾸밈 기호(● ▶ ▼)뿐 */
const SMALL_OK = ['.band-done-mark', '.band-send-go', '.season-mark', '.talk-next-tri'];

describe('글자 크기의 바닥과 누를 자리(spec.md 1.3·6.2)', () => {
  it('CSS의 글자 크기는 1.125rem(18px)부터 — 그 아래는 꾸밈 기호의 자리에만', () => {
    const small: string[] = [];
    for (const rule of RULES) {
      for (const m of rule.body.matchAll(/font-size:\s*([\d.]+)(rem|px|em)\b/g)) {
        const px = m[2] === 'rem' ? Number(m[1]) * 16 : m[2] === 'px' ? Number(m[1]) : Number.NaN;
        if (!(px >= 18) && !rule.selectors.every((sel) => SMALL_OK.includes(sel))) small.push(`${rule.file} ${rule.selectors.join(', ')} ${m[0]}`);
      }
    }
    expect(small).toEqual([]);
    // 문장(본문·대사·이야기 글)은 1.25rem부터
    expect(css('base.css')).toMatch(/body \{[^}]*font-size: 1\.25rem;/);
    expect(css('talk.css')).toMatch(/\.talk-box \{[^}]*font-size: 1\.5625rem;/);
  });

  it('문장의 자리는 1.25rem(20px)부터 — ㉠의 화면에서 문장이 놓이는 자리(띠의 한 줄 안내, 넘기는 법 알림, 대사, 안내 글 …)', () => {
    // 꼬리표(18px)가 아니라 문장이다(spec 1.3). 18px 바닥만 보던 시험이 띠의 한 줄 안내 19px(1.1875rem)를 놓쳤다(Review ㉠ 1).
    const SENTENCES = [
      '.band-hint',
      '.band-done-text',
      '.talk-box',
      '.talk-hint',
      '.title-lead',
      '.title-notice',
      '.role-guide',
      '.role-hero .role-say',
      '.role-hero-guide',
      '.role-say.wait',
      '.story',
      '.wish-text',
    ];
    for (const sel of SENTENCES) {
      const found = RULES.filter((rule) => rule.selectors.includes(sel));
      expect(found.length, `${sel}의 규칙이 없다`).toBeGreaterThan(0);
      for (const rule of found) {
        for (const m of rule.body.matchAll(/font-size:\s*([\d.]+)rem/g)) expect(Number(m[1]), `${rule.file} ${sel}`).toBeGreaterThanOrEqual(1.25);
      }
    }
    // 띠의 한 줄 안내는 크기를 스스로 적는다(바탕 글자를 물려받지 않는다)
    expect(css('band.css')).toMatch(/\.band-hint \{[^}]*font-size: 1\.25rem;/);
  });

  it('누르는 것은 56px(3.5rem)부터: ㉠ 화면의 단추마다 그 모양의 가장 낮은 높이', () => {
    const minHeight = (selector: string): number => {
      const found = RULES.filter((rule) => rule.selectors.includes(selector) && rule.at.length === 0);
      const values = found.flatMap((rule) => [...rule.body.matchAll(/(?:^|;|\s)(?:min-height|height):\s*([\d.]+)rem/g)].map((m) => Number(m[1])));
      return values.length > 0 ? Math.max(...values) : 0;
    };
    // 단추의 모양(클래스) → 그 모양의 CSS 선택자
    const SHAPES: Record<string, string> = {
      btn: '.btn',
      'title-sticker': '.title-sticker',
      'title-build': '.title .title-build',
      'talk-later': '.talk-later',
      'talk-choice': '.talk-choice',
    };
    for (const selector of Object.values(SHAPES)) expect(minHeight(selector), selector).toBeGreaterThanOrEqual(3.5);
    // 대사 창은 창 전체가 단추(가장 낮은 높이 --talk-box-h), 패의 누름 자리는 패 전체를 덮는다
    expect(css('talk.css')).toMatch(/--talk-box-h: 10\.75rem;/);
    expect(css('screens.css')).toMatch(/\.role-card-hit \{\s*position: absolute;\s*inset: 0;/);
    for (const file of ['/screens/Title.tsx', '/screens/RolePick.tsx', '/screens/Intro.tsx', '/ui/TopBand.tsx', '/screens/Talk.tsx']) {
      for (const m of code(file).matchAll(/<button[^>]*?class=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
        const first = (m[1] ?? m[2] ?? '').split(/[\s$]/)[0];
        expect([...Object.keys(SHAPES), 'role-card-hit', 'talk-box'], `${file}: ${first}`).toContain(first);
      }
    }
  });
});

// ── 빛깔의 자리와 표시 ───────────────────────────────────────

describe('빛깔의 자리와 표시(spec.md 1.2)', () => {
  it('주홍(--ju)은 "꼭 할 일" 표시의 자리에만 쓴다(쪽지의 네모·칸, 책갈피 윗줄, 작은 지도 견본)', () => {
    const uses = RULES.filter((rule) => /var\(--ju(-edge)?\)/.test(rule.body));
    for (const rule of uses) {
      for (const sel of rule.selectors) expect(sel, `${rule.file}: ${sel}`).toMatch(/must|todo|check|mark|tag|mini|bookmark/);
    }
    // 단청 띠의 맨 아랫줄은 황(주홍이 아니다 — 사용자 결정 2)
    expect(css('base.css')).toMatch(/\.dan \{[\s\S]*?var\(--hwang\) 6px 7px/);
  });

  it('흐르는 빛(.sheen)은 제목(과 ㉣의 한 해 돌아보기 "다음")에만', () => {
    // 화면의 클래스로 쓰인 곳(.tsx의 글자 안 — 그림 코드의 같은 낱말은 빼고)
    const where = Object.entries(CODE)
      .filter(([path]) => path.endsWith('.tsx'))
      .filter(([, text]) => /class=[^>]*\bsheen\b/.test(text.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, '')))
      .map(([path]) => path.split('/').pop());
    for (const file of where) expect(['Title.tsx', 'YearReview.tsx']).toContain(file);
    expect(where).toContain('Title.tsx');
  });

  it('화면 글에 ✓·✗를 쓰지 않는다(맞음 표시로 읽힌다 — 해낸 일은 채운 칸과 "해냄")', () => {
    for (const [path, text] of [...Object.entries(CODE), ...Object.entries(CSS)]) {
      const plain = text.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, '');
      expect(/[✓✔✗✘]/.test(plain), path).toBe(false);
    }
  });

  it('움직임 줄이기: 움직임 이름마다 줄이기 설정의 막음이 있다(그 자리에 animation: none, 또는 줄이지 않을 때만 움직인다)', () => {
    const reduce = RULES.filter((rule) => rule.at.some((head) => /prefers-reduced-motion:\s*reduce/.test(head)));
    const stops = (sel: string): boolean =>
      reduce.some((rule) => rule.selectors.includes(sel) && /animation(-name)?:\s*none|display:\s*none/.test(rule.body));
    const missing: string[] = [];
    const used = new Set<string>();
    for (const rule of RULES) {
      for (const m of rule.body.matchAll(/animation(?:-name)?:\s*([^;]+);/g)) {
        const names = m[1].split(/[\s,]+/).filter((word) => KEYFRAMES.includes(word));
        if (names.length === 0) continue;
        names.forEach((name) => used.add(name));
        if (rule.at.some((head) => /prefers-reduced-motion:\s*no-preference/.test(head))) continue;
        for (const sel of rule.selectors) if (!stops(sel)) missing.push(`${rule.file}: ${sel} (${names.join(', ')})`);
      }
    }
    expect(missing).toEqual([]);
    // ㉠의 움직임이 모두 있다(반짝 빛, ▼ 까딱임, 손가락 물결, 패 뒤집기 뒤의 종이)
    for (const name of ['sheen', 'talk-bob', 'talk-tap', 'role-hero-in']) expect(used).toContain(name);
    // 패 뒤집기(transition)도 줄이기 설정이면 바로 바뀐다
    expect(reduce.some((rule) => rule.selectors.includes('.role-card-inner') && /transition:\s*none/.test(rule.body))).toBe(true);
  });
});

// ── 제목 화면(Review ㉠ 권고 5·6) ─────────────────────────────────

describe('제목 화면 — 그림 위의 글과 낮은 화면', () => {
  it('소개 글에는 옅은 한지빛 빛 번짐을 깐다(1366×650처럼 산 그림 위에 놓일 때 4.5:1 넘게 — 화면에서 잰 값은 Build 보고)', () => {
    const lead = RULES.find((rule) => rule.file === 'screens.css' && rule.at.length === 0 && rule.selectors.includes('.title-lead'));
    const shadow = /text-shadow:([^;]+);/.exec(lead?.body ?? '')?.[1] ?? '';
    // 번짐(흐림 반경이 있는 그림자)이 둘 넘게, 모두 한지빛(밝은 빛)이다
    const glows = [...shadow.matchAll(/0 0 ([\d.]+)rem rgba\((\d+), (\d+), (\d+), ([\d.]+)\)/g)];
    expect(glows.length).toBeGreaterThanOrEqual(2);
    for (const g of glows) {
      expect(Number(g[2]) + Number(g[3]) + Number(g[4])).toBeGreaterThan(700);
      expect(Number(g[5])).toBeGreaterThanOrEqual(0.85);
    }
  });

  it('낮은 화면(높이 700 아래)에서는 제목 묶음의 위 여백을 줄여, 두 줄 알림이 떠도 "이어 하기"와 겹치지 않는다(단추 자리는 그대로)', () => {
    const low = RULES.filter((rule) => rule.file === 'screens.css' && rule.at.some((head) => /max-height:\s*700px/.test(head)));
    const top = low.find((rule) => rule.selectors.includes('.title-text'))?.body ?? '';
    expect(Number(/top:\s*([\d.]+)rem/.exec(top)?.[1] ?? '99')).toBeLessThan(3.25);
    expect(low.some((rule) => rule.selectors.includes('.title-actions'))).toBe(false);
  });
});

// ── 누가 될까 화면의 동작(spec.md 3.2~3.4) ─────────────────────────
// 브라우저 없이 도는 시험 틀이라 RolePick.tsx의 글을 읽어 지킨다(device.test.ts의 Talk.tsx 시험과 같은 길). 실제 화면은 Review가 크롬으로 본다.

describe('누가 될까 — 화면의 동작(RolePick.tsx)', () => {
  const pick = code('/screens/RolePick.tsx');

  it('패를 뒤집은 뒤에는 "← 이야기책"이 없다(뒤로 갔다 다시 열어 새로 뽑는 길을 막는다 — 3.4)', () => {
    expect(pick).toMatch(/\{!laid && \(\s*\n\s*<button type="button" class="btn small" onClick=\{goBook\}>/);
    expect((pick.match(/goBook/g) ?? []).length).toBe(2); // 불러오기 한 번, 단추 한 번
    // 다시 뽑기도 없다: 씨앗을 바꾸거나 이야기를 다시 여는 길이 화면에 없다
    expect(pick).not.toMatch(/openStory|freshSeed|seed\.value\s*=/);
  });

  it('정하는 것은 뽑힌 아이 그대로다: 뽑힌 집(drawn.role)과 뽑힌 모습(drawn.look)을 settleRole에 넘긴다', () => {
    expect(pick).toMatch(/const drawn = hero\.value;/);
    expect(pick).toMatch(/const role = roles\.find\(\(r\) => r\.id === drawn\.role\);/);
    const calls = [...pick.matchAll(/settleRole\(([^)]*)\)/g)].map((m) => m[1]);
    expect(calls).toEqual(['role.id, drawn.look']);
  });

  it('"살아 보지 않은 집과 모습이 더 자주 나와요."는 이 이야기를 깬 적이 있고 살아 보지 않은 것이 남았을 때만(처음 판에는 없다)', () => {
    expect(pick).toMatch(/const stamp = bookStamp\(p, save\.value\.cleared\[situation\.id\]\);/);
    expect(pick).toMatch(/const unlivedLeft = stamp !== null && roles\.some\(\(r\) => playable\.includes\(r\.id\) && r\.looks\.some\(\(look\) => !livedAs\(stamp, r\.id, look\)\)\);/);
    expect(pick).toMatch(/\{unlivedLeft && ' 살아 보지 않은 집과 모습이 더 자주 나와요\.'\}/);
    // 설명 줄을 뺀 글에서 그 말은 한 자리에만 있다(다른 자리에서 조건 없이 띄우지 않는다)
    expect((pick.replace(/\/\/[^\n]*/g, '').match(/더 자주 나와요/g) ?? []).length).toBe(1);
    // 깬 기록이 없으면(처음 판) 도장이 없다
    const p = getPack('s1395');
    expect(bookStamp(p, undefined)).toBeNull();
    expect(bookStamp(p, [])).toBeNull();
  });

  it('뽑힌 아이의 종이가 뜬 뒤 OPEN_GAP_MS(380ms) 동안은 "…로 한 해 살기 ▶"의 누름·Enter·Space를 받지 않는다(Review ㉠ 3)', () => {
    // 종이를 띄우는 그 때 문을 새로 세우고, 단추는 그 문을 지나야 정한다(Enter·Space도 단추의 누름으로 와 같은 문을 지난다)
    expect(pick).toMatch(/gate\.current = new TapGate\(Date\.now\(\)\);\s*\n\s*setPaper\(true\);/);
    expect(pick).toMatch(/if \(gate\.current\?\.pass\(Date\.now\(\)\)\) settleRole\(role\.id, drawn\.look\);/);
    expect(pick).toMatch(/import \{ TapGate \} from '\.\.\/ui\/taps';/);
    const at = 1_000_000;
    const gate = new TapGate(at);
    expect(gate.pass(at + 120)).toBe(false); // 잇달아 누른 둘째 누름(0.12초)
    expect(gate.pass(at + OPEN_GAP_MS - 1)).toBe(false);
    expect(new TapGate(at).pass(at + OPEN_GAP_MS)).toBe(true);
  });
});

// ── 글꼴(spec.md 4절) ─────────────────────────────────────────

/** 세 글꼴 모두에 없어 기기 글꼴이 그려도 되는 기호(SOURCES.md) */
const DEVICE_OK = ['➤', '⋮'];

/** 화면 글(설명 줄을 뺀 코드의 글자)에 나오는 글자들 */
function screenChars(): Set<string> {
  const out = new Set<string>();
  for (const [path, text] of Object.entries(CODE)) {
    if (path.includes('/plays/dev')) continue;
    const plain = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');
    for (const ch of plain) if (ch.codePointAt(0)! >= 0x80) out.add(ch);
  }
  return out;
}

describe('글꼴 — 파일, 미리 받기, 글자 빠짐(spec.md 4.5)', () => {
  const fonts = coverage.fonts as Record<string, { file: string; family: string; weight: number; bytes: number; chars: string }>;
  const charset = new Set([...(Object.values(CHARSET)[0] ?? '')].filter((ch) => ch !== '\n'));
  const used = screenChars();
  const hangul = [...used].filter((ch) => ch >= '가' && ch <= '힣');
  const isHangulOrJamo = (ch: string): boolean => (ch >= '가' && ch <= '힣') || (ch >= 'ㄱ' && ch <= 'ㅣ');

  it('글자 목록: KS X 1001 한글 2,350자 + 낱자 + ASCII + 기호, 세 글꼴(넷 파일)의 기록이 있다', () => {
    expect(coverage.charset.hangul).toBe(2350);
    expect([...charset].filter((ch) => ch >= '가' && ch <= '힣')).toHaveLength(2350);
    expect(Object.keys(fonts).sort()).toEqual(['gowun', 'jua', 'pretendard600', 'pretendard800']);
    expect(fonts.jua.family).toBe('Jua');
    expect(fonts.gowun).toMatchObject({ family: 'Gowun Batang', weight: 700 });
  });

  it('① 화면 글의 한글 음절은 모두 2,350자 안에 있고 네 파일 모두에 있다', () => {
    expect(hangul.length).toBeGreaterThan(500);
    expect(hangul.filter((ch) => !charset.has(ch))).toEqual([]);
    for (const [key, font] of Object.entries(fonts)) {
      const have = new Set(font.chars);
      expect(hangul.filter((ch) => !have.has(ch)), key).toEqual([]);
    }
  });

  it('② 한글이 아닌 기호는 글꼴 줄(어느 자리든 Pretendard·고운바탕이 뒤를 잇는다)에 있거나, 기기 글꼴로 그려도 되는 것이다', () => {
    const have = new Set([...fonts.gowun.chars, ...fonts.pretendard600.chars]);
    const lost = [...used].filter((ch) => !isHangulOrJamo(ch) && !have.has(ch) && !DEVICE_OK.includes(ch));
    expect(lost).toEqual([]);
    // 글꼴 줄: 주아 → Pretendard → 고운바탕, 고운바탕 → Pretendard, Pretendard → 고운바탕
    const root = tokens(':root');
    expect(root['--f-title']).toMatch(/^'Jua', 'Pretendard', 'Gowun Batang',/);
    expect(root['--f-story']).toMatch(/^'Gowun Batang', 'Pretendard',/);
    expect(root['--f-ui']).toMatch(/^'Pretendard', 'Gowun Batang',/);
    // 주아에 없는 ▲▶▼◀는 고운바탕이 담고 있다(Pretendard 조각에는 없다)
    for (const ch of '▲▶▼◀') {
      expect(fonts.jua.chars.includes(ch)).toBe(false);
      expect(fonts.pretendard600.chars.includes(ch)).toBe(false);
      expect(fonts.gowun.chars.includes(ch), ch).toBe(true);
    }
  });

  it('③ fonts.css의 @font-face 넷: 가리키는 파일이 있고 font-display: swap, 나뉜 조각(unicode-range)을 쓰지 않는다', async () => {
    const text = css('fonts.css');
    const faces = [...text.matchAll(/@font-face \{([^}]*)\}/g)].map((m) => m[1]);
    expect(faces).toHaveLength(4);
    for (const face of faces) {
      expect(face).toMatch(/font-display: swap;/);
      expect(face).not.toMatch(/unicode-range/);
      const url = /url\('([^']+)'\)/.exec(face)?.[1] ?? '';
      expect(await fileSize(`../src/styles/${url}`), url).toBeGreaterThan(100000);
    }
    expect(Object.keys(FONT_FILES).sort()).toEqual(['../src/assets/fonts/gowunbatang-bold-2350.woff2', '../src/assets/fonts/jua-2350.woff2']);
    // main.tsx는 fonts.css를 base.css보다 먼저 부르고, 옛 가변 글꼴(2MB)은 부르지 않는다
    const main = code('/main.tsx');
    expect(main.indexOf("import './styles/fonts.css';")).toBeGreaterThan(-1);
    expect(main.indexOf("import './styles/fonts.css';")).toBeLessThan(main.indexOf("import './styles/base.css';"));
    expect(main).not.toMatch(/pretendardvariable/);
  });

  it('글꼴·그림 파일의 크기: 처음 화면이 지금보다 가볍다(글꼴 넷 1.15MB 아래, 제목 그림 400KB 안팎, 한지 타일 수십 KB)', async () => {
    const fontBytes = Object.values(fonts).reduce((sum, font) => sum + font.bytes, 0);
    expect(fontBytes).toBeLessThan(1150 * 1024);
    for (const [key, font] of Object.entries(fonts)) expect(font.bytes, key).toBeLessThan(350 * 1024);
    expect(Object.keys(UI_FILES).sort()).toEqual(['../src/assets/ui/hanji-512.webp', '../src/assets/ui/title-dawn.webp']);
    expect(await fileSize('../src/assets/ui/title-dawn.webp')).toBeLessThan(450 * 1024);
    expect(await fileSize('../src/assets/ui/hanji-512.webp')).toBeLessThan(40 * 1024);
  });

  it('빌드본은 첫 문서에서 제목 그림과 주아를 미리 받는다(vite.config.ts의 작은 플러그인 — spec.md 4.3의 "고침"). 나머지 글꼴은 첫 화면을 그릴 때 받는다', async () => {
    const { FIRST_SCREEN } = await import('../vite.config');
    const picks = (name: string) => FIRST_SCREEN.filter((one) => one.file.test(name));
    expect(picks('assets/title-dawn-AbC_12-x.webp').map((one) => one.as)).toEqual(['image']);
    expect(picks('assets/jua-2350-AbC_12-x.woff2').map((one) => [one.as, one.type])).toEqual([['font', 'font/woff2']]);
    expect(FIRST_SCREEN).toHaveLength(2);
    // 코드와 망을 나눠 써 첫 그림이 늦어지지 않게(Build ㉠이 잰 값 — vite.config.ts의 설명) 고운바탕·Pretendard는 미리 받지 않는다
    for (const font of ['gowunbatang-bold-2350', 'Pretendard-SemiBold.subset', 'Pretendard-ExtraBold.subset']) {
      expect(picks(`assets/${font}-AbC_12-x.woff2`), font).toEqual([]);
    }
    // 글꼴에는 crossorigin이 붙는다(CSS가 받는 것과 같은 것으로 쳐져 두 번 받지 않게)
    const config = new TextDecoder().decode(FS.readFileSync(pathOf('../vite.config.ts')));
    expect(config).toMatch(/if \(one\.as === 'font'\) attrs\.crossorigin = true;/);
    expect(config).toMatch(/plugins: \[preact\(\), preloadFirstScreen\(\)\]/);
  });
});
