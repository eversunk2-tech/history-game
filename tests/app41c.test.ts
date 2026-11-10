// 4-1 ㉢(출전 고리)의 앱 시험 — 화면 없이 소스와 자료로 본다(spec 11.1 가·사의 ㉢ 칸).
//   ① 앱(src/app·screens·state·ui)은 보류한 3판 한 해 길(계절 넘기기·한 해 돌아보기)과 지운 화면을 부르지 않는다(11.1 가 "쓰지 않는 길을 막는 법" ③④)
//   ② 겨루기 화면: 옛이야기 표시, 귀띔 단추는 지울 것이 있을 때만, 「느티나무 그늘」은 고비의 방패를 걷어 낸다, 화면 글은 정령의 말풍선에 띄우지 않는다
//   ③ 현장: 할 일 쪽지의 줄을 한 번 더 누르면 걸어가 그 일이 열린다, 작은 고비는 대화 장면의 놀이 앞, 의뢰 소개의 정령 말은 끝까지 읽어야 시작,
//      출전 준비의 "출전하기"는 넘기는 칸 밖(낮은 화면)
//   ④ 묶음 합치기: 서당 은행이 게임 묶음에 들어 겨루기의 카드 문제(topic:soc5-2-1·soc5-2-2)로 나간다(지도에서 찍기는 ㉣ — 내지 않는다)
// 소스는 주석을 지운 것으로 본다(tests/sourceText.ts — 주석에 남긴 줄에 속지 않게).

import { describe, expect, it } from 'vitest';
import { four } from '../src/content';
import { s1395_1 } from '../src/content/episodes/s1395';
import { s1395_1Lines } from '../src/content/episodes/s1395-lines';
import { foes } from '../src/content/foes';
import { spirit } from '../src/content/hub';
import { skills } from '../src/content/skills';
import { answer, chooseCard, startBattle, useCombo, type Battle } from '../src/engine/battle';
import { battleAsk } from '../src/engine/quiz';
import { newHero } from '../src/engine/growth';
import { BALANCE } from '../src/engine/balance';
import { AGAIN_WORDS, eventWords, hintOpen, wrongNote } from '../src/screens/Battle';
import { nextBubble, type BubbleKey, type BubbleState } from '../src/screens/MapScreen';
import { stripComments } from './sourceText';

const RAW = import.meta.glob<string>(['../src/**/*.ts', '../src/**/*.tsx'], { eager: true, query: '?raw', import: 'default' });
const SRC: Record<string, string> = Object.fromEntries(Object.entries(RAW).map(([path, text]) => [path.replace(/^.*\/src\//, 'src/'), stripComments(text)]));
const source = (path: string): string => SRC[path] ?? '';

describe('① 앱은 보류한 3판 한 해 길과 지운 화면을 부르지 않는다', () => {
  const app = Object.entries(SRC).filter(([path]) => /^src\/(app|screens|state|ui)\//.test(path));

  it('계절 넘기기(closeSeason·nextSeason)·한 해 돌아보기(reviewYear, engine/review)를 부르지 않는다', () => {
    expect(app.length).toBeGreaterThan(20);
    for (const [path, text] of app) {
      expect(text, path).not.toMatch(/\bcloseSeason\s*\(|\bnextSeason\s*\(|\breviewYear\s*\(/);
      expect(text, path).not.toMatch(/from '\.\.\/engine\/review'|from '\.\/engine\/review'/);
      expect(text, path).not.toMatch(/\b(closeSeasonNow|goNextSeason|finishYear|nextSeasonReady|openStory|goBook)\b/);
    }
  });

  it('3판의 한 해 화면(이야기책·계절 닫기·한 해 돌아보기·"다음에 만들어요")과 한 해 셈(ui/year.ts)은 지웠다', () => {
    for (const gone of ['src/screens/Book.tsx', 'src/screens/SeasonClose.tsx', 'src/screens/YearReview.tsx', 'src/screens/Next.tsx', 'src/ui/year.ts', 'src/content/four.ts']) {
      expect(Object.keys(SRC), gone).not.toContain(gone);
    }
    const store = source('src/state/store.ts');
    expect(store).not.toMatch(/'seasonClose'|'review'|'book'|'next'/);
    // 엔진의 그 길에는 "보류한 3판 한 해 길" 머리 주석이 있다(4-3에서 carries로 옮기며 지운다)
    const raw = (p: string): string => RAW[`../${p}`] ?? '';
    expect(raw('src/engine/review.ts')).toMatch(/보류한 3판 한 해 길\(4-3에서 carries로 옮기며 지운다\)/);
    expect(raw('src/engine/game.ts').match(/보류한 3판 한 해 길\(4-3에서 carries로 옮기며 지운다\)/g)?.length).toBe(3);
  });

  it('보류한 계절을 화면으로 볼 길은 개발 판 전용 ?field= 하나이고 저장하지 않는다(빌드에는 들지 않는다)', () => {
    const store = source('src/state/store.ts');
    const at = store.indexOf('export function openFromUrl(): void {');
    expect(at).toBeGreaterThan(0);
    expect(store.slice(at, at + 120)).toMatch(/if \(!import\.meta\.env\.DEV\) return;/);
    expect(store).toMatch(/q\.get\('field'\)/);
    // 보류한 계절 보기에서는 쓰지 않는다
    expect(store).toMatch(/if \(devField\.value\) return; \/\/ |if \(devField\.value\) return;/);
    // 3판의 ?from=·?season= 맵 길은 없다(?season=은 그림 견본에만)
    expect(store).not.toMatch(/q\.get\('from'\)|q\.get\('draw'\)/);
  });
});

describe('② 겨루기 화면', () => {
  const battle = source('src/screens/Battle.tsx');

  it('옛이야기 고비에는 「옛이야기」 표시를 달고(도깨비의 내기), 여는 말의 첫 창은 정령의 "옛이야기야"다', () => {
    expect(battle).toMatch(/\{foe\.tale && \(/);
    expect(battle).toMatch(/class="tale-mark"/);
    const dokkaebi = foes.find((f) => f.id === s1395_1.boss)!;
    expect(dokkaebi.tale).toBe(true);
    expect(dokkaebi.opening[0].who).toBe('neuti');
    expect(dokkaebi.opening[0].text).toContain('옛이야기야');
    // 삶의 고비(굳은 논흙)는 사람 꼴이 아니라 흙덩이 상징(SoilArt)으로
    expect(battle).toMatch(/<SoilArt /);
  });

  it('귀띔 단추와 정령의 권함 줄은 남은 귀띔이 있고 지울 고를 것이 있을 때만(hintOpen — ㉡ Review 권고 ㅇ, ㉢ Review 고쳐야 함 나)', () => {
    // 단추와 권함 줄이 같은 조건 하나를 쓴다(OX·순서·짝에서 단추 없이 "나를 눌러"만 뜨지 않게)
    expect(battle).toMatch(/export function hintOpen\(b: Battle, q: Question, gone: readonly number\[\]\): boolean \{\s*return b\.hints > 0 && hintChoice\(q, hintSeed\(b\), gone\) !== null;\s*\}/);
    expect(battle).toMatch(/hint=\{hintOpen\(b, pendingQ, gone\) \? \{/);
    expect(battle).toMatch(/setHintLine\(hintOpen\(chosen, asked, \[\]\) \? spirit\.hint\.offer : null\);/);
    expect(battle.match(/spirit\.hint\.offer/g)?.length).toBe(1);
    // 실제 문제로: 고를 것이 넷인 고르기만 참이다
    const foe = foes.find((f) => f.id === s1395_1.boss)!;
    const cards = skills.filter((c) => (s1395_1.starter ?? []).includes(c.id));
    const b = startBattle({ foe, cards, deck: s1395_1.starter!, stats: newHero('boy').stats, level: 1, body: 5, seed: 5, kind: 'boss' });
    expect(b.hints).toBeGreaterThan(0);
    const one = (form: string, n?: number) => four.questions.find((q) => q.form === form && (n === undefined || q.choices?.length === n))!;
    expect(hintOpen(b, one('pick', 4), [])).toBe(true);
    for (const q of [one('ox'), one('order'), one('match')]) expect(hintOpen(b, q, []), q.id).toBe(false);
    const two = four.questions.find((q) => q.form === 'pick' && q.choices?.length === 2);
    if (two) expect(hintOpen(b, two, [])).toBe(false);
    expect(hintOpen({ ...b, hints: 0 }, one('pick', 4), [])).toBe(false);
  });

  it('「느티나무 그늘」은 내 기운을 채우고 고비의 방패 한 칸을 걷어 낸다(엔진) — 쪽지의 글도 그렇게 말한다', () => {
    const shade = spirit.joint.find((j) => j.id === 'shade')!;
    expect(shade.text).toContain('고비의 방패 한 칸');
    const foe = { ...foes.find((f) => f.id === s1395_1.boss)! };
    const cards = skills.filter((c) => (s1395_1.starter ?? []).includes(c.id));
    const hero = newHero('girl');
    let b: Battle = startBattle({ foe, cards, deck: s1395_1.starter!, stats: hero.stats, level: 1, body: 5, seed: 3, kind: 'boss' });
    b = { ...b, shield: 2, phase: 2, momentum: b.ctx.full, me: 10 };
    const after = useCombo(b, 'shade', { card: () => null, wisdom: () => [] });
    expect(after.shield).toBe(2 - BALANCE.shadeShield);
    expect(after.me).toBeGreaterThan(10 - 8);
  });

  it('화면 글(별의 줄·자람의 한 줄·상한·출전 준비의 까닭·합동 기술의 쪽지·"생각해 봤어요")은 정령의 말풍선에 띄우지 않는다(권고 ㄷ·ㅂ)', () => {
    for (const [path, text] of Object.entries(SRC).filter(([p]) => p.startsWith('src/screens/') || p.startsWith('src/ui/'))) {
      for (const call of text.match(/<SpiritSay[^>]*>/g) ?? []) {
        expect(call, path).not.toMatch(/spirit\.(stars|statLines|capped|starterWhy|thought)|\.text\b(?=[^>]*joint)/);
      }
    }
    // 정령의 말풍선에 띄우는 것은 who: 'neuti'의 줄(합동 기술은 say)과 귀띔·기세의 말뿐이다
    expect(battle).toMatch(/joint\.say\.who === 'neuti' \? joint\.say\.text : null/);
  });

  it('겨루기의 작은 글(권고 ㅌ): 기록 줄은 고비가 한 일로, 그늘은 채운 기운을 한 줄로, "다시 나와요"는 참일 때만, 굳은 논흙의 예고 칸에도 센 카드', () => {
    const ask = battleAsk({ questions: four.questions.filter((q) => q.form !== 'map'), logs: {}, episode: s1395_1, done: [], seed: 2 });
    const cards = skills.filter((c) => (s1395_1.starter ?? []).includes(c.id));
    const dokkaebi = foes.find((f) => f.id === s1395_1.boss)!;
    let b = startBattle({ foe: dokkaebi, cards, deck: s1395_1.starter!, stats: newHero('girl').stats, level: 1, body: 5, seed: 4, kind: 'boss' });
    b = chooseCard(b, b.hand[0], ask);
    b = answer(b, false, ask);
    const foeEvent = b.events.find((e) => e.t === 'foe')!;
    const move = dokkaebi.moves.find((m) => foeEvent.t === 'foe' && m.id === foeEvent.move)!;
    const rows = eventWords(b, b.events);
    expect(rows.some((r) => r.startsWith(`${move.did} — 내 기운 −`))).toBe(true);
    expect(rows.join('\n')).not.toContain(move.line);
    for (const foe of foes) for (const m of foe.moves) expect(m.did, `${foe.id}/${m.id}`).toBeTruthy();
    // 「느티나무 그늘」을 1단계(방패 없음)에 쓰면: 채운 기운과 "걷어 낼 방패가 없어요"를 한 줄에
    const shade = useCombo({ ...b, momentum: b.ctx.full, me: 10 }, 'shade', ask);
    const shadeRows = eventWords(shade, shade.events);
    expect(shadeRows[0]).toBe(`「느티나무 그늘」 내 기운 +${BALANCE.shadeHeal} · 걷어 낼 방패가 없어요`);
    expect(shadeRows.filter((r) => r.startsWith('내 기운 +'))).toEqual([]);
    const lifted = useCombo({ ...b, phase: 2, shield: 2, momentum: b.ctx.full, me: 10 }, 'shade', ask);
    expect(eventWords(lifted, lifted.events)[0]).toBe(`「느티나무 그늘」 내 기운 +${BALANCE.shadeHeal}`);
    // 작은 고비(3차례): 첫 차례에 틀리면 "다시 나와요", 둘째 차례부터는 붙이지 않는다
    const soil = foes.find((f) => f.kind === 'life')!;
    let m = startBattle({ foe: { ...soil, hp: 999 }, cards, deck: s1395_1.starter!, stats: newHero('girl').stats, level: 1, body: 5, seed: 4, kind: 'minor' });
    const notes: (string | undefined)[] = [];
    for (let turn = 1; turn <= 3; turn++) {
      m = chooseCard(m, m.hand.find((id) => id !== m.frozen)!, ask);
      notes.push(wrongNote(m));
      m = answer(m, false, ask);
    }
    expect(notes[0]).toContain(AGAIN_WORDS);
    expect(notes.slice(1).some((n) => n?.includes(AGAIN_WORDS))).toBe(false);
    expect(notes.every((n) => n?.startsWith('나가는 힘 '))).toBe(true);
    // 예고 칸의 "★ 이번 판에 센 카드": 그 차례의 센 갈래가 없으면 고비가 늘 센 갈래(굳은 논흙 — 솜씨·힘)
    expect(battle).toMatch(/const strongKinds: CardKind\[\] = preview\?\.move\.strong \? \[preview\.move\.strong\] : foe\.strong\.filter/);
    expect(battle).toMatch(/\{strongKinds\.length > 0 && \(\s*<p class="intent-strong">/);
    expect(soil.strong.filter((k) => ['power', 'wisdom', 'craft', 'heart'].includes(k)).length).toBeGreaterThan(0);
    // 정령의 말풍선이 떠 있으면 기록 줄이 비켜 선다(spirit-on), 문제 창 귀퉁이의 이름표는 "느티"
    expect(battle).toMatch(/\$\{spiritOn \? ' spirit-on' : ''\}/);
    expect(battle).toMatch(/const spiritOn = \(Boolean\(hintLine\) && mode\.kind !== 'lines' && mode\.kind !== 'quiz'\) \|\| \(mode\.kind === 'lines' && line\?\.who === 'neuti'\);/);
    expect(source('src/quiz/QuizWindow.tsx')).toMatch(/<span class="quiz-spirit-name">\{neuti\.name\}<\/span>/);
    expect(spirit.name).toBe('느티');
  });

  it('모두 틀린 판도 엔진으로 끝까지(구해 줌 — 별 ①). 화면은 엔진이 준 문제만 낸다(화면으로 한 판은 Build의 크롬 기록)', () => {
    const foe = foes.find((f) => f.id === s1395_1.boss)!;
    const cards = skills.filter((c) => (s1395_1.starter ?? []).includes(c.id));
    const ask = battleAsk({ questions: four.questions.filter((q) => q.form !== 'map'), logs: {}, episode: s1395_1, done: [], seed: 1 });
    let b = startBattle({ foe, cards, deck: s1395_1.starter!, stats: newHero('boy').stats, level: 1, body: 5, seed: 11, kind: 'boss' });
    for (let k = 0; k < 60 && !b.end; k++) {
      if (!b.pending) b = chooseCard(b, b.hand[0], ask);
      b = answer(b, false, ask);
    }
    expect(b.end).toBe('rescue');
    expect(b.turn).toBeLessThanOrEqual(BALANCE.turnLimit);
  });
});

describe('③ 현장·대화 장면·의뢰 소개·출전 준비', () => {
  it('할 일 쪽지의 줄을 한 번 더 누르면(화살표가 이미 그 자리를 가리킬 때) 그 자리까지 걸어가 그 일이 열린다(13.2의 22번 — 줄 → 줄, 두 번)', () => {
    const map = source('src/screens/MapScreen.tsx');
    const at = map.indexOf('const pickGuide = (spot: string): void => {');
    const end = map.indexOf('};', at);
    const body = map.slice(at, end);
    // 맵 틀의 pressRow 하나로(㉣의 거점 시설 목록도 같은 길). 첫 누름에는 쪽지를 접지 않는다(둘째 누름이 같은 줄에 닿게) — 걷기 시작할 때만 접는다
    expect(body).toMatch(/const world = overlaid\(\) \? null : worldRef\.current;/);
    expect(body).toMatch(/if \(pressRow\(world, guide, target\) === 'walk' && world\) setNoteOpen\(false\);/);
    expect(body.match(/setNoteOpen/g)?.length).toBe(1);
    expect(body).toMatch(/setGuide\(spot\);/);
    // 둘째 누름은 깃발을 누른 것과 같다(walkToMark — 다다르면 'mark' 일). 표시가 없거나 길이 막혔을 때만 서는 칸으로(walkToSpot)
    const stage = source('src/map/stage.ts');
    const fn = stage.slice(stage.indexOf('export function pressRow('));
    expect(fn).toMatch(/if \(guide !== spot\.id\) return 'guide';/);
    expect(fn).toMatch(/walkToMark\(world, mark\);/);
    expect(stage).toMatch(/export function walkToSpot\(world: World, stand: readonly \[number, number\]\): void \{\s*tapWorld\(world, stand\[0\] \* TILE \+ 8, stand\[1\] \* TILE \+ 8\);/);
  });

  it('현장 말풍선은 대본 26.2의 차례로 하나씩 뜬다: 흔한 차례(미션 ① → 볍씨 뿌리기)에서도 toPaddy·sowDone·skillGot이 extras·bossReady보다 먼저(권고 ㅂ)', () => {
    const said = new Set<BubbleKey>();
    /** 그 형편에서 차례로 뜨는 말풍선(앞의 것이 사라진 뒤 다음 것 — 맵 화면이 하는 그대로) */
    const shown = (st: BubbleState): BubbleKey[] => {
      const out: BubbleKey[] = [];
      for (let k = nextBubble(st, said); k; k = nextBubble(st, said)) {
        said.add(k);
        out.push(k);
      }
      return out;
    };
    const base: BubbleState = { solvedReturn: false, solvedSow: false, gotSkill: false, allMustDone: false, extrasLeft: true, afterExtras: false };
    expect(shown(base)).toEqual([]);
    // 미션 ①을 ㉡ 우리 집 마당 길로 마침(솜씨 카드 없음) → 볍씨 뿌리기를 마침(마지막 꼭 할 일 — 「볍씨 고루 뿌리기」를 얻음, 해 둘이 남음)
    expect(shown({ ...base, solvedReturn: true })).toEqual(['returnDone', 'toPaddy']);
    const allDone = { ...base, solvedReturn: true, solvedSow: true, gotSkill: true, allMustDone: true };
    expect(shown(allDone)).toEqual(['sowDone', 'skillGot', 'extras']);
    // 덤을 하나 더 하면(해를 씀) "큰 고비로"를 알린다. 해가 다 지면 extras 없이 bossReady
    expect(shown({ ...allDone, afterExtras: true })).toEqual(['bossReady']);
    said.clear();
    expect(shown({ ...base, solvedReturn: true, gotSkill: true })).toEqual(['returnDone', 'toPaddy', 'skillGot']);
    expect(shown({ ...allDone, extrasLeft: false })).toEqual(['sowDone', 'bossReady']);
    // 미션 ①의 말풍선이 뜨기 전에 볍씨 뿌리기까지 마쳤으면(대화를 잇달아 함) toPaddy는 건너뛴다(볍씨 뿌리기 앞에만 맞는 말)
    said.clear();
    expect(shown(allDone)).toEqual(['returnDone', 'sowDone', 'skillGot', 'extras']);
    // 맵 화면은 앞의 말풍선이 떠 있는 동안 기다리고(bubble), 사라지면 다음 것을 고른다
    const map = source('src/screens/MapScreen.tsx');
    expect(map).toMatch(/if \(!bubbles \|\| busy \|\| !ready \|\| bubble\) return;/);
    expect(map).toMatch(/\}, \[busy, ready, bubble, solvedReturn, solvedSow, gotSkill, allMustDone, g\.sunsLeft\]\);/);
    // 열쇠는 대본 26.2의 글을 가진 것이다
    for (const k of ['returnDone', 'toPaddy', 'sowDone', 'skillGot', 'extras', 'bossReady'] as const) expect(s1395_1Lines.bubbles[k].length, k).toBeGreaterThan(0);
  });

  it('연표는 넘기는 칸(MoreBox)에 담는다 — 넘치면 "아래에 더 있어요"(권고 ㄷ)', () => {
    const gate = source('src/screens/Gate.tsx');
    const box = gate.indexOf('<MoreBox class="gate-body" hintClass="more-below gate-more">');
    expect(box).toBeGreaterThan(0);
    expect(gate.indexOf('<ol class="timeline">')).toBeGreaterThan(box);
    expect(gate.indexOf('</MoreBox>')).toBeGreaterThan(gate.lastIndexOf('<Outside key={name} name={name} />'));
  });

  it('정령 느티는 현장에서 주인공 곁에 떠 있다(맵 틀에 동료로 — 보류한 계절 보기에는 세우지 않는다)', () => {
    expect(source('src/screens/MapScreen.tsx')).toMatch(/companion: episode\.peek\(\) \? 'neuti' : undefined,/);
    expect(source('src/map/stage.ts')).toMatch(/companion: hooks\.companion,/);
  });

  it('작은 고비(굳은 논흙)는 대화 장면에서 고른 뒤·놀이 앞에 열린다', () => {
    const talk = source('src/screens/Talk.tsx');
    expect(talk).toMatch(/if \(!minorDone && minorPending\(happeningId\)\) \{\s*setStep\(\{ kind: 'minor', choiceId \}\);/);
    expect(talk).toMatch(/<MinorStep happeningId=\{happeningId\} onDone=\{\(\) => afterChoice\(step\.choiceId, true\)\} \/>/);
    expect(s1395_1.minors[0]).toMatchObject({ kind: 'battle', at: 's1395-spring-sow', before: 'play' });
  });

  it('의뢰 소개: 정령의 말을 끝까지 넘겨야 시작한다 — 넷째 창 앞의 줄로 핵심 물음 007(고려 → 조선의 차례)을 모든 아이가 듣는다', () => {
    const intro = source('src/screens/Intro.tsx');
    expect(intro).toMatch(/disabled=\{!last\} onClick=\{beginField\}/);
    const texts = s1395_1Lines.intro.map((l) => l.text);
    expect(texts).toHaveLength(4);
    expect(texts[2]).toContain('1392년');
    expect(texts[2]).toContain('고려에서 조선으로');
    for (const t of texts) expect([...t].length, t).toBeLessThanOrEqual(60);
    // 007은 이제 모든 아이가 듣는 것이라 'at:' 꼬리표를 달지 않는다
    const q7 = four.questions.find((q) => q.id === 'ep-s1395-1-007')!;
    expect(q7.tags?.some((t) => t.startsWith('at:'))).toBe(false);
  });

  it('출전 준비: 넷(집·모습·카드·손에 들 것)만 넘기는 칸에 두고 "출전하기"는 칸 밖이라 낮은 화면(1366×650)에서도 늘 보인다', () => {
    const prep = source('src/screens/Prep.tsx');
    const box = prep.indexOf('<MoreBox class="prep-body"');
    const close = prep.indexOf('</MoreBox>');
    const foot = prep.indexOf('<footer class="prep-foot">');
    expect(box).toBeGreaterThan(0);
    expect(prep.slice(box, close)).toContain('4. 손에 들 것');
    expect(foot).toBeGreaterThan(close);
  });
});

describe('④ 묶음 합치기 — 서당 은행이 겨루기의 카드 문제로 나간다', () => {
  const bank = four.questions.filter((q) => !q.topic.startsWith('ep-'));
  const ask = battleAsk({ questions: four.questions.filter((q) => q.form !== 'map'), logs: {}, episode: s1395_1, done: [], seed: 7 });
  const story = four.questions.filter((q) => q.topic === 'ep-s1395-1').map((q) => q.id);

  it.runIf(bank.length > 0)('이야기 문제를 다 내면 카드의 서당 주제(topic:soc5-2-1·soc5-2-2)의 은행 문제가 나간다', () => {
    for (const card of skills) {
      const topic = card.tags.find((t) => t.startsWith('topic:'))!.slice(6);
      const id = ask.card(card, { exclude: story, right: 0, turn: 1 });
      expect(id, card.id).not.toBeNull();
      const q = four.questions.find((x) => x.id === id)!;
      expect(q.topic, card.id).toBe(topic);
      expect(q.form, card.id).not.toBe('map');
    }
  });

  it('지도에서 찍기는 ㉣(한양 지도)이 열 때까지 겨루기에 내지 않는다 — 가게가 거른다', () => {
    expect(source('src/state/store.ts')).toMatch(/return four\.questions\.filter\(\(q\) => q\.form !== 'map'\);/);
  });
});

// 4-1 ㉢ 고침 바퀴(Review 권고 ㅁ): 화면이 엔진의 값·자료의 글을 그대로 그리는지, 가게·화면의 이음을 소스로 묶는다(망가뜨려 보기 R03·R04·R10·R17b·R19·R20·R34).
// 화면을 그리는 시험(브라우저)이 없어 지금 코드의 그리는 줄을 그대로 본다 — 줄을 바꾸면 이 시험도 함께 고친다.
describe('⑤ 화면은 엔진의 종이·자료를 그대로 그린다(권고 ㅁ)', () => {
  const done = source('src/screens/EpisodeDone.tsx');
  const result = done.slice(done.indexOf('export function EpisodeDone('), done.indexOf('export function Growth('));

  it('결과 종이는 종이(paper)의 값을 다시 셈하지 않는다 — 숫자는 paper.* 그대로(R03)', () => {
    expect(result.length).toBeGreaterThan(1000);
    // paper의 값에 셈을 붙이지 않는다(+ − × ÷ 나머지)
    expect(result).not.toMatch(/paper\.[\w.]+(?:\[[^\]]*\])?\s*[-+*/%]\s*[\w('"]/);
    expect(result).not.toMatch(/[\w)\]]\s*[-+*/%]\s*paper\./);
    for (const shown of ['경험치 +{paper.xp}', '<b>{paper.score}</b>점 · 내 최고 기록 {paper.best}점', '쌀 +{paper.purse.rice}되', '베 +{paper.purse.cloth}자', '레벨이 {paper.levels}만큼']) {
      expect(result, shown).toContain(shown);
    }
  });

  it('별은 엔진의 별(paper.stars) 그대로 켜고 끈다 — 구해 줌이어도 별 ②를 켜지 않는다(R04)', () => {
    expect(result).toMatch(/\{paper\.stars\.map\(\(on, i\) => \(\s*<li key=\{i\} class=\{on \? 'got' : 'missed'\}>/);
    expect(result.match(/'★'/g)?.length).toBe(1);
    expect(result).toContain(`{on ? '★' : '☆'}`);
    expect(result).toContain('{on ? `별 ${i + 1} 받음: ` : `별 ${i + 1} 아직: `}');
  });

  it('구해 줌으로 넘겼으면 별 ① 아래에 "이웃이 함께해 준 것도…" 한 줄(R34 — 벌처럼 보이지 않게)', () => {
    expect(result).toContain('{i === 0 && paper.rescued && <span class="result-rescued">{spirit.stars.rescued}</span>}');
    expect(spirit.stars.rescued).toContain('이웃이 함께해 준 것도');
  });

  it('문제 창의 귀띔 단추는 고르기에서만 그린다(R10 — 부르는 쪽의 hintOpen과 겹쳐 막는다)', () => {
    const quiz = source('src/quiz/QuizWindow.tsx');
    expect(quiz.match(/class="btn quiz-hint"/g)?.length).toBe(1);
    expect(quiz).toMatch(/\{hint && form === 'pick' && \(\s*<button type="button" class="btn quiz-hint" onClick=\{takeHint\}>/);
    expect(quiz).toMatch(/\{asking && \(form === 'pick' \|\| form === 'ox'\) && \(\(hint && form === 'pick'\) \|\| spirit\) && \(/);
  });

  it('작은 고비의 세 걸음 안내는 그 이야기에 깬 에피소드가 없을 때만(다시 하기에는 뜨지 않는다 — R17b)', () => {
    const talk = source('src/screens/Talk.tsx');
    expect(talk).toMatch(/const first = !ep \|\| !Object\.values\(save\.value\.stories\[ep\.story\]\?\.episodes \?\? \{\}\)\.some\(\(one\) => one\.cleared\);/);
    expect(talk).toMatch(/guide=\{first\}\n/);
    expect(talk.match(/guide=\{/g)?.length).toBe(1);
  });

  it('「옛이야기」 표시의 글은 대본·spec의 낱말 그대로 "옛이야기"(R19)', () => {
    const battle = source('src/screens/Battle.tsx');
    expect(battle).toMatch(/<span class="tale-mark" role="note">\s*<span aria-hidden="true">❖ <\/span>옛이야기\s*<\/span>/);
  });

  it('"큰 고비로": 해 ☀가 남았고 할 덤이 남았으면 한 번 묻는다(11.1 가 12 — R20)', () => {
    const band = source('src/ui/TopBand.tsx');
    expect(band).toMatch(/const moreToDo = canClose && openHappenings\(p, g\)\.some\(\(view\) => !view\.must && !view\.noSun\);/);
    expect(band).toMatch(/if \(canClose\) \{\s*if \(moreToDo\) setAsking\(true\);\s*else goBoss\(\);\s*return;\s*\}/);
    expect(band.match(/goBoss\(\)/g)?.length).toBe(2);
  });
});
