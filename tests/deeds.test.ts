// 결과 종이와 "지난 이야기"가 쓰는 셈(src/ui/deeds.ts — 4-1 ㉢에서 3판 ui/year.ts의 deedRows·factsBefore만 옮겼다)의 시험.
// 3판의 tests/year.test.ts에서 이 둘의 시험과 넘겨 보기 칸(ui/More)의 시험만 옮겨 살렸다(spec 11.1 사의 "지금 시험 가운데 지우거나 바꿔야 하는 것").
// 지운 것(한 해 돌아보기의 계절 칸·수치의 흐름, 이야기책의 도장, 제목의 이어 하기 줄, 계절 끝의 값)은 그 화면과 셈을 지웠기 때문이다.
// 견본 이야기(tests/fixtures.ts)는 엔진의 한 해 길(계절 넘기기)로 판을 만든다 — 엔진·자료 시험은 보류한 3판 길을 그대로 쓴다(앱은 부르지 않는다).

import { describe, expect, it } from 'vitest';
import { getPack } from '../src/content';
import { linesOf } from '../src/engine/conditions';
import { closeSeason, deedsOfSeason, newGame, nextSeason } from '../src/engine/game';
import { SEASONS, type Deed, type GameState } from '../src/engine/types';
import { EXTRAS_ROW, deedRows, factsBefore } from '../src/ui/deeds';
import { hasMoreBelow } from '../src/ui/More';
import { doAll, playYearRandom, seedFor, testPack, withStats } from './fixtures';

/** 견본 이야기로 봄을 정해진 대로 하고(돕기 → 낮은 논 → 할머니 이야기) 한 해를 끝까지 넘긴다 */
function yearOf(weather: 'drought' | 'normal' | 'bumper', look: 'boy' | 'girl' = 'girl'): GameState {
  let g = newGame(testPack, 'farmer', look, seedFor(weather));
  g = doAll(testPack, g, ['t-news/help', 't-help', 't-sow/low/even', 't-granny/story']);
  g = nextSeason(testPack, closeSeason(testPack, g));
  g = doAll(testPack, g, ['t-weed/all']);
  for (let i = 1; i < SEASONS.length; i++) g = nextSeason(testPack, closeSeason(testPack, g));
  return g;
}

describe('계절 닫기 — 이 계절에 한 일의 줄', () => {
  const done = yearOf('normal');
  const spring = deedsOfSeason(done, 'spring');

  it('미션의 일은 미션마다 한 줄로 묶고 내가 고른 것을 적는다', () => {
    const rows = deedRows(testPack, done, spring, true);
    const news = rows.find((row) => row.key === 'm-news');
    expect(news?.head).toBe('「돌아온 사람들」');
    expect(news?.tag).toBe('꼭 할 일');
    expect(news?.solved).toBe(true);
    expect(news?.texts.length).toBeGreaterThan(0);
    // 같은 미션의 일을 둘 했어도(듣고 → 가서 마친다) 줄은 하나다
    expect(rows.filter((row) => row.key === 'm-news')).toHaveLength(1);
    const sow = rows.find((row) => row.key === 'm-sow');
    expect(sow?.solved).toBe(true);
  });

  it('덤으로 한 일은 한 줄에 모은다(덤 미션에 딸린 덤도 — 덤 미션의 줄에 묻히지 않는다). 덤 미션의 줄은 맨 끝', () => {
    const rows = deedRows(testPack, done, spring, true);
    const extras = rows.filter((row) => row.key === EXTRAS_ROW);
    expect(extras).toHaveLength(1);
    expect(extras[0].head).toBe('덤으로 한 일');
    expect(extras[0].solved).toBeNull();
    // 견본 맵에는 자리 이름이 없어 수만 센다(할머니의 옛이야기 하나)
    expect(extras[0].texts).toEqual(['1가지를 했어요.']);
    // 덤에서 고른 것은 다시 적지 않는다(대화에서 읽었다)
    expect(rows.flatMap((row) => row.texts)).not.toContain('옛이야기를 청한다');
    expect(rows[rows.length - 1].key).toBe('m-stories');
  });

  it('이 계절에 풀린 덤 미션은 "해냄"과 "해낸 일" 한 줄로 적히고, 다음 계절에는 다시 적지 않는다', () => {
    let g = newGame(testPack, 'farmer', 'girl', seedFor('normal'));
    g = doAll(testPack, g, ['t-news/help', 't-help', 't-sow/low/even', 't-granny/story', 't-temple']);
    expect(g.solved).toContain('m-stories');
    const rows = deedRows(testPack, g, deedsOfSeason(g, 'spring'), true);
    const stories = rows.find((row) => row.key === 'm-stories');
    expect(stories?.solved).toBe(true);
    expect(stories?.texts).toEqual(['시험 미션을 해냈다.']);
    expect(rows.filter((row) => row.key === EXTRAS_ROW).map((row) => row.texts)).toEqual([['2가지를 했어요.']]);
    // 여름을 닫을 때: 봄에 풀린 덤 미션은 다시 나오지 않는다
    g = doAll(testPack, nextSeason(testPack, closeSeason(testPack, g)), ['t-weed/rest']);
    expect(deedRows(testPack, g, deedsOfSeason(g, 'summer'), true).map((row) => row.key)).toEqual(['m-weed']);
  });

  it('풀리지 않은 미션은 "해냄"이 아니고, 어디까지 했는지를 적는다', () => {
    const rows = deedRows(testPack, done, spring, true);
    const stories = rows.find((row) => row.key === 'm-stories');
    expect(stories?.tag).toBe('덤 미션');
    expect(stories?.solved).toBe(false);
    expect(stories?.texts.join(' ')).toContain('둘 가운데 하나를 했어요');
    // 계절이 더 남았으면 꼬리말이 붙고, 마지막 계절이면 붙지 않는다
    expect(stories?.texts.join(' ')).toContain('나머지는 다음 에피소드에서 해요');
    expect(deedRows(testPack, done, spring, false).find((row) => row.key === 'm-stories')?.texts.join(' ')).not.toContain('다음 에피소드');
  });

  it('고른 것이 없는 풀린 미션에는 "해낸 일" 한 줄을 적는다(도움의 길로 풀린 미션)', () => {
    // 기력이 바닥이라 볍씨 뿌리기의 선택지가 모두 잠기고, 이웃이 거드는 도움의 일로 풀린다
    const tired = doAll(testPack, withStats(newGame(testPack, 'farmer', 'boy', 3), { body: 1 }), ['t-sow-rescue']);
    const rows = deedRows(testPack, tired, deedsOfSeason(tired, 'spring'), true);
    expect(rows).toHaveLength(1);
    expect(rows[0].key).toBe('m-sow');
    expect(rows[0].solved).toBe(true);
    expect(rows[0].texts).toEqual(['시험 미션을 해냈다.']);
  });

  it('고른 것이 있으면 그것을 적는다(같은 글은 한 번만)', () => {
    const rows = deedRows(testPack, done, deedsOfSeason(done, 'summer'), true);
    expect(rows.find((row) => row.key === 'm-weed')?.texts).toEqual(['온 식구가 매달린다']);
  });

  it('미션에 딸리지 않은 덤도 그 한 줄에 들고, 풀림 표시가 없다', () => {
    const extra: Deed = { ...spring[0], happeningId: 't-well', missionId: undefined, label: '물을 길어 드린다', solved: [] };
    const rows = deedRows(testPack, done, [extra], true);
    expect(rows).toHaveLength(1);
    expect(rows[0].key).toBe(EXTRAS_ROW);
    expect(rows[0].solved).toBeNull();
    expect(rows[0].texts).toEqual(['1가지를 했어요.']);
  });

  it('①: 덤으로 한 자리는 칩 하나씩, 같은 자리는 한 번만, 덤에서 고른 글은 적지 않는다', () => {
    const real = getPack('s1395')!;
    for (let seed = 1; seed <= 30; seed++) {
      const g = playYearRandom(real, 'farmer', seed % 2 ? 'boy' : 'girl', seed);
      for (const [index, season] of SEASONS.entries()) {
        const deeds = deedsOfSeason(g, season);
        const rows = deedRows(real, g, deeds, index < SEASONS.length - 1);
        const extras = rows.filter((row) => row.key === EXTRAS_ROW);
        expect(extras.length, `${seed}/${season}`).toBeLessThanOrEqual(1);
        const chips = extras[0]?.chips ?? [];
        expect(new Set(chips).size, `${seed}/${season}`).toBe(chips.length);
        // 미션의 줄은 꼭 할 일과 덤 미션뿐이고, 꼭 할 일의 줄은 미션마다 하나
        const musts = rows.filter((row) => row.tag === '꼭 할 일').map((row) => row.key);
        expect(new Set(musts).size).toBe(musts.length);
        // 덤에서 고른 글(미션에 딸리지 않았거나 덤 미션에 딸린 일의 선택지)은 줄에 없다
        const extraLabels = deeds.filter((deed) => !real.missions.find((m) => m.id === deed.missionId)?.must && deed.label).map((deed) => deed.label as string);
        const mustLabels = new Set(deeds.filter((deed) => real.missions.find((m) => m.id === deed.missionId)?.must && deed.label).map((deed) => deed.label as string));
        for (const label of extraLabels) if (!mustLabels.has(label)) expect(rows.flatMap((row) => row.texts), `${seed}/${season}`).not.toContain(label);
      }
    }
  });

  it('한 일이 없으면 줄도 없다', () => {
    expect(deedRows(testPack, done, [], true)).toEqual([]);
  });
});

describe('지난 이야기 — 그 일을 열던 때의 형편', () => {
  const done = yearOf('drought');

  it('표시는 그 일보다 앞선 기록이 남긴 것만 있다', () => {
    const at = done.history.findIndex((deed) => deed.happeningId === 't-sow');
    const facts = factsBefore(testPack, done, at);
    expect(facts.flags).toContain('news.help');
    expect(facts.flags).not.toContain('sow.low');
    expect(facts.stats).toEqual(done.history[at].before);
    expect(factsBefore(testPack, done, 0).flags).toEqual([]);
  });

  it('뽑기는 뽑는 계절부터 안다(봄의 일은 날씨를 모르는 채로 열렸다)', () => {
    const spring = done.history.findIndex((deed) => deed.season === 'spring');
    const summer = done.history.findIndex((deed) => deed.season === 'summer');
    expect(done.draw).toBe('drought');
    expect(factsBefore(testPack, done, spring).draw).toBeNull();
    expect(factsBefore(testPack, done, summer).draw).toBe('drought');
  });

  it('그때의 형편으로 여는 대화를 다시 고르면 그때 본 갈림이 나온다', () => {
    const summer = done.history.findIndex((deed) => deed.happeningId === 't-weed');
    const weed = testPack.happenings.find((h) => h.id === 't-weed');
    expect(weed).toBeDefined();
    const then = linesOf(weed!, factsBefore(testPack, done, summer));
    const base = linesOf(weed!, { ...factsBefore(testPack, done, summer), draw: null });
    // 견본의 김매기는 큰비가 온 해에 여는 대화가 갈린다(갈림이 없는 견본이면 둘이 같다)
    if (weed!.lineVariants?.some((variant) => variant.when.draw === 'drought')) expect(then).not.toEqual(base);
    else expect(then).toEqual(base);
  });

  it('없는 차례를 물어도 던지지 않는다', () => {
    expect(factsBefore(testPack, done, 999).flags.length).toBeGreaterThan(0);
    expect(factsBefore(testPack, done, 999).stats).toEqual(done.stats);
  });
});

describe('넘겨 볼 것이 아래에 더 있는가', () => {
  it('내용이 칸보다 길고 끝까지 내리지 않았을 때만 그렇다', () => {
    expect(hasMoreBelow(600, 0, 400)).toBe(true);
    expect(hasMoreBelow(600, 196, 400)).toBe(false);
    expect(hasMoreBelow(400, 0, 400)).toBe(false);
    expect(hasMoreBelow(404, 0, 400)).toBe(false); // 몇 점의 어긋남은 넘침으로 보지 않는다
  });
});

// Review 1-라 11번: 계절 닫기의 "…의 끝에 생긴 일" 줄 끝에 그 줄이 바꾼 값을 붙인다.
