// 한 해를 끝맺는 화면들이 쓰는 셈(src/ui/year.ts)의 시험: 계절 닫기의 줄, 한 해 돌아보기의 계절 칸과 수치의 흐름,
// 이야기책의 한 해 이름 도장, 제목의 "이어 하기" 한 줄, 지난 이야기가 되살리는 그때의 형편. 화면 없이(브라우저 없이) 본다.

import { describe, expect, it } from 'vitest';
import { getPack } from '../src/content';
import { linesOf } from '../src/engine/conditions';
import { closeSeason, deedsOfSeason, newGame, nextSeason, seasonReady } from '../src/engine/game';
import { reviewYear } from '../src/engine/review';
import { SEASONS, STATS, type Deed, type GameState, type Stats } from '../src/engine/types';
import { hasMoreBelow } from '../src/ui/More';
import { timesWord } from '../src/ui/words';
import {
  EXTRAS_ROW,
  PLAIN_STAMP,
  bookStamp,
  deedRows,
  endingTitle,
  factsBefore,
  flowDots,
  flowLabels,
  flowWords,
  laterRows,
  laterValue,
  livedAs,
  savedLineOf,
  seasonRecap,
  weatherOf,
  weatherShownIn,
} from '../src/ui/year';
import { doAll, playYearRandom, seedFor, testPack, withStats } from './fixtures';

const stats = (living: number, body: number, trust: number): Stats => ({ living, body, trust });

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
    // 한 해 돌아보기의 봄 칸: 덤 미션은 고른 것 없이 "해낸 일"만, 덤 둘은 덤으로 센다
    for (let i = 1; i < SEASONS.length; i++) g = nextSeason(testPack, closeSeason(testPack, g));
    const recap = seasonRecap(testPack, g, reviewYear(testPack, g).seasons[0]);
    expect(recap.missions.map((m) => [m.id, m.must, m.picks.length])).toEqual([
      ['m-news', true, 1],
      ['m-sow', true, 1],
      ['m-stories', false, 0],
    ]);
    expect(recap.extraCount).toBe(2);
  });

  it('풀리지 않은 미션은 "해냄"이 아니고, 어디까지 했는지를 적는다', () => {
    const rows = deedRows(testPack, done, spring, true);
    const stories = rows.find((row) => row.key === 'm-stories');
    expect(stories?.tag).toBe('덤 미션');
    expect(stories?.solved).toBe(false);
    expect(stories?.texts.join(' ')).toContain('둘 가운데 하나를 했어요');
    // 계절이 더 남았으면 꼬리말이 붙고, 마지막 계절이면 붙지 않는다
    expect(stories?.texts.join(' ')).toContain('나머지는 다른 계절에 해요');
    expect(deedRows(testPack, done, spring, false).find((row) => row.key === 'm-stories')?.texts.join(' ')).not.toContain('다른 계절');
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

describe('한 해 돌아보기 — 계절 한 칸', () => {
  const done = yearOf('drought');
  const year = reviewYear(testPack, done);
  const recaps = year.seasons.map((summary) => seasonRecap(testPack, done, summary));

  it('계절은 넷이고 차례대로다', () => {
    expect(recaps.map((r) => r.season)).toEqual([...SEASONS]);
  });

  it('풀린 미션은 풀린 계절에 "해낸 일"과 내가 고른 것과 함께 적힌다(꼭 할 일이 먼저)', () => {
    const spring = recaps[0];
    expect(spring.missions.map((m) => m.id)).toEqual(['m-news', 'm-sow']);
    expect(spring.missions.every((m) => m.must && m.doneLine === '시험 미션을 해냈다.')).toBe(true);
    expect(spring.missions[0].picks.length).toBeGreaterThan(0);
    expect(recaps[0].missions[0].picks).toEqual(['이웃의 밀린 일을 거든다']);
    expect(recaps[0].missions[1].picks).toEqual(['낮은 논에 몰아 뿌린다']);
    expect(recaps[1].missions.map((m) => m.id)).toEqual(['m-weed']);
    expect(recaps[1].missions[0].picks).toEqual(['온 식구가 매달린다']);
  });

  it('풀린 꼭 할 일은 한 해에 한 번씩만 나온다', () => {
    const shown = recaps.flatMap((r) => r.missions.filter((m) => m.must).map((m) => m.id));
    expect(new Set(shown).size).toBe(shown.length);
    const musts = testPack.missions.filter((m) => m.must && done.solved.includes(m.id)).map((m) => m.id);
    expect([...shown].sort()).toEqual([...musts].sort());
  });

  it('덤으로 한 일은 세어지고, 풀리지 않은 덤 미션은 마지막 계절 칸에 어디까지 했는지가 적힌다', () => {
    expect(recaps[0].extraCount).toBe(1); // 할머니 이야기(덤 미션의 한 걸음)
    expect(recaps[0].underway).toEqual([]);
    const winter = recaps[3];
    expect(winter.underway.map((row) => row.id)).toEqual(['m-stories']);
    expect(winter.underway[0].line).toBe('둘 가운데 하나를 했어요.');
    expect(done.solved).not.toContain('m-stories');
  });

  it('계절의 끝에 생긴 일(나중에 나타난 결과)이 그 계절에 붙는다', () => {
    expect(recaps[0].ending.map((line) => line.text)).toEqual(['거들어 준 이웃이 고마워했다.']);
    expect(recaps[1].ending.map((line) => line.text)).toEqual(['낮은 논이 큰비에 잠겼다.']);
    expect(recaps[2].ending).toEqual([]);
  });

  it('그 줄이 실제로 바꾼 값이 붙는다(엔진이 적은 값 — 0~10에 묶인 뒤)', () => {
    const summer = done.closings.find((c) => c.season === 'summer');
    expect(summer?.effects).toBeDefined();
    expect(recaps[1].ending[0].value).toBe(laterValue(summer!.effects![0]));
    expect(recaps[1].ending[0].value).toMatch(/^\(살림 −\d\)$/);
  });

  it('그해의 날씨는 뽑는 계절(여름)의 칸에만 붙는다', () => {
    expect(recaps.map((r) => r.weather?.label ?? null)).toEqual([null, '큰비가 온 해', null, null]);
    expect(weatherShownIn(testPack, done, 'summer')).toBe(true);
    expect(weatherShownIn(testPack, done, 'spring')).toBe(false);
    expect(weatherOf(testPack, 'normal')?.label).toBe('여느 해');
    expect(weatherOf(testPack, null)).toBeNull();
    expect(weatherOf(testPack, 'no-such-weather')).toBeNull();
    // 아직 뽑지 않은 판(봄)에서는 여름의 날씨도 드러나지 않는다
    expect(weatherShownIn(testPack, newGame(testPack, 'farmer', 'girl', 1), 'summer')).toBe(false);
  });

  it('아무 일도 하지 않은 계절은 빈 칸이다(던지지 않는다)', () => {
    const autumn = recaps[2];
    expect(autumn.missions).toEqual([]);
    expect(autumn.extraCount).toBe(0);
    expect(autumn.before).not.toBeNull();
  });

  it('아무렇게나 한 해 200번: 돌아보기가 던지지 않고, 푼 꼭 할 일이 모두 한 번씩 적힌다', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const g = playYearRandom(testPack, 'farmer', seed % 2 === 0 ? 'girl' : 'boy', seed);
      expect(g.phase).toBe('done');
      const y = reviewYear(testPack, g);
      const all = y.seasons.map((summary) => seasonRecap(testPack, g, summary));
      const shown = all.flatMap((r) => r.missions.map((m) => m.id));
      expect(new Set(shown).size, `씨앗 ${seed}`).toBe(shown.length);
      expect([...shown].sort(), `씨앗 ${seed}`).toEqual([...g.solved].sort());
      expect(y.flow, `씨앗 ${seed}`).toHaveLength(SEASONS.length + 1);
    }
  });
});

describe('한 해 돌아보기 — 수치의 흐름', () => {
  const flow = [stats(4, 6, 5), stats(5, 4, 7), stats(2, 4, 7), stats(3, 5, 10), stats(0, 5, 9)];

  it('점은 다섯이고 이름은 처음 · 봄 · 여름 · 가을 · 겨울이다', () => {
    expect(flowLabels(5)).toEqual(['처음', '봄', '여름', '가을', '겨울']);
    expect(flowDots(flow, 'living').map((d) => d.label)).toEqual(['처음', '봄', '여름', '가을', '겨울']);
    expect(flowDots(flow, 'living').map((d) => d.value)).toEqual([4, 5, 2, 3, 0]);
  });

  it('가로는 고르게 나뉘고 양 끝을 비운다. 세로는 수치가 클수록 위다(0은 맨 아래, 10은 맨 위)', () => {
    const dots = flowDots(flow, 'trust', 10);
    expect(dots.map((d) => d.x)).toEqual([10, 30, 50, 70, 90]);
    expect(dots[3].y).toBe(0); // 인심 10
    expect(flowDots(flow, 'living')[4].y).toBe(100); // 살림 0
    expect(flowDots(flow, 'living')[0].y).toBe(60); // 살림 4
    for (const stat of STATS) for (const d of flowDots(flow, stat)) expect(d.y >= 0 && d.y <= 100 && d.x >= 0 && d.x <= 100).toBe(true);
  });

  it('앞 점에서 바뀐 만큼을 함께 준다(첫 점은 0)', () => {
    expect(flowDots(flow, 'living').map((d) => d.change)).toEqual([0, 1, -3, 1, -3]);
  });

  it('점이 하나뿐이거나 없어도 던지지 않는다', () => {
    expect(flowDots([stats(4, 6, 5)], 'body')).toEqual([{ x: 50, y: 40, value: 6, label: '처음', change: 0 }]);
    expect(flowDots([], 'body')).toEqual([]);
  });

  it('한 해 동안 바뀐 것을 화살표와 글로 함께 말한다(색만으로 알리지 않는다)', () => {
    expect(flowWords(flow, 'living')).toEqual({ from: 4, to: 0, arrow: '▼', text: '4 줄었어요' });
    expect(flowWords(flow, 'trust')).toEqual({ from: 5, to: 9, arrow: '▲', text: '4 늘었어요' });
    expect(flowWords([stats(4, 6, 5), stats(4, 6, 5)], 'body')).toEqual({ from: 6, to: 6, arrow: '■', text: '처음과 같아요' });
  });

  it('흐름을 말하는 글에 점수·등수·맞음·틀림의 말이 없다', () => {
    const words = STATS.flatMap((stat) => [flowWords(flow, stat).text, flowWords(flow, stat).arrow]).join(' ');
    expect(words).not.toMatch(/점수|등수|정답|맞았|틀렸|✓|✗|성공|실패/);
  });
});

describe('이야기책 — 깬 이야기에 찍히는 한 해 이름', () => {
  const real = getPack('s1395');
  const ending = real?.situation.endings[0];

  it('깬 적이 없으면 도장이 없다', () => {
    expect(bookStamp(testPack, undefined)).toBeNull();
    expect(bookStamp(testPack, [])).toBeNull();
  });

  it('가장 최근에 깬 해의 한 해 이름이 찍힌다. 깬 횟수와 살아 본 모습이 함께 나온다', () => {
    const stamp = bookStamp(testPack, [
      { role: 'farmer', look: 'girl', ending: 'helped', legacy: 'tree' },
      { role: 'farmer', look: 'boy', ending: 'plain', legacy: 'tree' },
      { role: 'farmer', look: 'girl', ending: 'rich', legacy: '' },
    ]);
    expect(stamp?.title).toBe('넉넉한 한 해');
    expect(stamp?.times).toBe(3);
    expect(stamp?.lived.map((one) => [one.look, one.times, one.title])).toEqual([
      ['girl', 2, '넉넉한 한 해'],
      ['boy', 1, '여느 한 해'],
    ]);
    expect(stamp?.lived[0].who).toBe('농민 집 아이 · 여자아이 모습');
    expect(stamp?.legacy).toBeNull(); // 마지막 판에는 남긴 것이 적히지 않았다
    expect(livedAs(stamp ?? null, 'farmer', 'boy')?.title).toBe('여느 한 해');
    expect(livedAs(stamp ?? null, 'farmer')).not.toBeNull();
    expect(livedAs(stamp ?? null, 'nobi')).toBeNull();
    expect(livedAs(null, 'farmer', 'girl')).toBeNull();
  });

  it('모습이 하나뿐인 역할은 모습을 적지 않는다', () => {
    const stamp = bookStamp(testPack, [{ role: 'nobi', look: 'boy', ending: 'plain', legacy: 'tree' }]);
    expect(stamp?.lived[0].who).toBe('노비 집 아이');
    expect(stamp?.legacy).toBe('느티나무');
  });

  it('모르는 한 해 이름(옛 판의 것, 빈 것)이면 "한 해를 살았어요"가 찍힌다', () => {
    expect(PLAIN_STAMP).toBe('한 해를 살았어요');
    expect(endingTitle(testPack, 'no-such-ending')).toBe(PLAIN_STAMP);
    expect(endingTitle(testPack, '')).toBe(PLAIN_STAMP);
    expect(endingTitle(undefined, 'plain')).toBe(PLAIN_STAMP);
    expect(bookStamp(testPack, [{ role: 'farmer', look: 'girl', ending: 's-old', legacy: '' }])?.title).toBe(PLAIN_STAMP);
    // 없어진 역할의 기록이어도 던지지 않는다
    expect(bookStamp(testPack, [{ role: 'ghost', look: 'girl', ending: 'plain', legacy: '' }])?.times).toBe(1);
  });

  it('①의 한 해 이름은 모두 제목으로 찍힌다(20자 안)', () => {
    expect(real).toBeDefined();
    expect(ending).toBeDefined();
    for (const one of real!.situation.endings) {
      const title = endingTitle(real, one.id);
      expect(title).toBe(one.title);
      expect(title.length).toBeLessThanOrEqual(20);
    }
    const stamp = bookStamp(real, [{ role: 'farmer', look: 'girl', ending: ending!.id, legacy: real!.situation.legacy[0].id }]);
    expect(stamp?.title).toBe(ending!.title);
    expect(stamp?.legacy).toBe(real!.situation.legacy[0].label);
    expect(stamp?.lived[0].who).toBe('농민 집 아이 · 여자아이 모습');
  });

  it('횟수를 우리말로 센다', () => {
    expect([1, 2, 3, 4, 10].map(timesWord)).toEqual(['한 번', '두 번', '세 번', '네 번', '열 번']);
    expect(timesWord(12)).toBe('12번');
  });
});

describe('제목의 "이어 하기" 한 줄', () => {
  const all = (): boolean => true;
  const cur = (seasonIndex: number, phase: GameState['phase']) => ({ role: 'farmer', seasonIndex, phase });

  it('맵을 걷는 중이면 그 계절을 적는다(네 계절 모두)', () => {
    expect(savedLineOf(testPack, cur(0, 'season'), all)).toBe('1년 봄 · 농민 집 아이');
    expect(savedLineOf(testPack, cur(1, 'season'), all)).toBe('1년 여름 · 농민 집 아이');
    expect(savedLineOf(testPack, cur(2, 'season'), all)).toBe('1년 가을 · 농민 집 아이');
    expect(savedLineOf(testPack, cur(3, 'season'), all)).toBe('1년 겨울 · 농민 집 아이');
  });

  it('계절을 닫는 중이면 "보내는 중"이라고 적는다(조사를 가려 붙인다)', () => {
    expect(savedLineOf(testPack, cur(0, 'seasonClose'), all)).toBe('1년 봄을 보내는 중 · 농민 집 아이');
    expect(savedLineOf(testPack, cur(1, 'seasonClose'), all)).toBe('1년 여름을 보내는 중 · 농민 집 아이');
    expect(savedLineOf(testPack, cur(2, 'seasonClose'), all)).toBe('1년 가을을 보내는 중 · 농민 집 아이');
    expect(savedLineOf(testPack, cur(3, 'seasonClose'), all)).toBe('1년 겨울을 보내는 중 · 농민 집 아이');
  });

  it('겨울까지 보내고 돌아보기를 마치지 않은 해는 "한 해 돌아보기"라고 적는다("겨울"이라고 적지 않는다)', () => {
    expect(savedLineOf(testPack, cur(3, 'done'), all)).toBe('1년 한 해 돌아보기 · 농민 집 아이');
  });

  it('다음 계절이 아직 만들어지지 않았으면 "~까지 했어요"라고 사실대로 적는다', () => {
    const untilSpring = (season: string): boolean => season === 'spring';
    expect(savedLineOf(testPack, cur(1, 'season'), untilSpring)).toBe('1년 봄까지 했어요 · 농민 집 아이');
    expect(savedLineOf(testPack, cur(0, 'season'), untilSpring)).toBe('1년 봄 · 농민 집 아이');
  });

  it('없는 역할이거나 계절 번호가 벗어나도 던지지 않는다', () => {
    expect(savedLineOf(testPack, { role: 'ghost', seasonIndex: 9, phase: 'season' }, all)).toBe('1년 겨울');
    expect(savedLineOf(testPack, { role: 'ghost', seasonIndex: -3, phase: 'season' }, all)).toBe('1년 봄');
  });

  it('①은 농민 집 아이의 저장이면 해와 역할이 함께 보인다', () => {
    const real = getPack('s1395');
    expect(real).toBeDefined();
    const line = savedLineOf(real!, cur(0, 'season'), (season) => seasonReady(real!, 'farmer', season));
    expect(line).toBe('1395년 봄 · 농민 집 아이');
    expect(savedLineOf(real!, cur(3, 'done'), all)).toBe('1395년 한 해 돌아보기 · 농민 집 아이');
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

describe('① 1395년 — 실제 콘텐츠로 한 해를 돌아본다', () => {
  const real = getPack('s1395');

  it('아무렇게나 한 해 60번(두 모습): 돌아보기·계절 칸·도장이 던지지 않고 푼 미션이 한 번씩 적힌다', () => {
    expect(real).toBeDefined();
    const pack = real!;
    const names = new Set<string>();
    for (let seed = 1; seed <= 60; seed++) {
      const look = seed % 2 === 0 ? 'girl' : 'boy';
      const g = playYearRandom(pack, 'farmer', look, seed);
      expect(g.phase, `씨앗 ${seed}`).toBe('done');
      const y = reviewYear(pack, g);
      const recaps = y.seasons.map((summary) => seasonRecap(pack, g, summary));
      expect(recaps).toHaveLength(SEASONS.length);
      const shown = recaps.flatMap((r) => r.missions.map((m) => m.id));
      expect(new Set(shown).size, `씨앗 ${seed}`).toBe(shown.length);
      expect([...shown].sort(), `씨앗 ${seed}`).toEqual([...g.solved].sort());
      // 계절 닫기의 줄도 계절마다 던지지 않는다
      for (const [index, season] of SEASONS.entries()) deedRows(pack, g, deedsOfSeason(g, season), index < SEASONS.length - 1);
      // 한 해 이름은 그 이야기의 것이고, 이야기책에 그대로 찍힌다
      const stamp = bookStamp(pack, [{ role: g.role, look: g.look, ending: y.yearName.id, legacy: pack.situation.legacy[0].id }]);
      expect(stamp?.title).toBe(y.yearName.title);
      expect(stamp?.title).not.toBe(PLAIN_STAMP);
      names.add(y.yearName.id);
      // 날씨가 뽑혔으면 이름이 있다
      if (y.draw) expect(weatherOf(pack, y.draw), `씨앗 ${seed}`).not.toBeNull();
      for (const stat of STATS) expect(flowDots(y.flow, stat)).toHaveLength(y.flow.length);
    }
    expect(names.size).toBeGreaterThan(0);
  });

  it('남길 것은 셋이고 갈래가 나무·물건·이야기다', () => {
    expect(real!.situation.legacy.map((one) => one.kind).sort()).toEqual(['story', 'thing', 'tree']);
    for (const one of real!.situation.legacy) expect(one.label.trim().length).toBeGreaterThan(0);
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
describe('계절의 끝에 생긴 일의 값', () => {
  const zero = { living: 0, body: 0, trust: 0 };

  it('바뀐 것만 이름과 부호로: "(살림 −3)", "(살림 +1, 기력 +1)"', () => {
    expect(laterValue({ ...zero, living: -3 })).toBe('(살림 −3)');
    expect(laterValue({ living: 1, body: 1, trust: 0 })).toBe('(살림 +1, 기력 +1)');
    expect(laterValue({ ...zero, trust: 2 })).toBe('(인심 +2)');
  });

  it('바뀐 것이 없으면 "(변화 없음)", 값을 모르면(옛 저장의 닫기) 붙이지 않는다', () => {
    expect(laterValue(zero)).toBe('(변화 없음)');
    expect(laterValue(undefined)).toBeNull();
    expect(laterRows({ lines: ['가', '나'] })).toEqual([
      { text: '가', value: null },
      { text: '나', value: null },
    ]);
    expect(laterRows({ lines: ['가', '나'], effects: [{ ...zero, living: -1 }] })).toEqual([
      { text: '가', value: '(살림 −1)' },
      { text: '나', value: null },
    ]);
    expect(laterRows(null)).toEqual([]);
  });

  it('①을 아무렇게나 40해: 닫기의 줄마다 값이 있다(바뀐 것은 이름과 부호, 없으면 "(변화 없음)")', () => {
    const real = getPack('s1395')!;
    for (let seed = 1; seed <= 40; seed++) {
      const g = playYearRandom(real, 'farmer', seed % 2 ? 'boy' : 'girl', seed);
      for (const closing of g.closings) {
        const rows = laterRows(closing);
        expect(rows.length).toBe(closing.lines.length);
        for (const row of rows) expect(row.value, `${seed}/${closing.season}`).toMatch(/^\((변화 없음|(살림|기력|인심) [+−]\d(, (기력|인심) [+−]\d)*)\)$/);
      }
    }
  });
});
