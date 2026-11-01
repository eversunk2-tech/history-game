// 그림 자리의 시험: 이름을 찾는 차례(그 이름 → 같은 자리의 다른 계절 → 없음, 표정 → plain → 없음, 확장자 차례)와
// 실제 그림 폴더의 이름이 약속한 꼴인지. 화면 없이(브라우저 없이) 본다.

import { describe, expect, it, vi } from 'vitest';
import { getPack, packs } from '../src/content';
import { EXT_ORDER, backgroundNameIn, buildIndex, figureNameIn, preloadOrder, type Pose } from '../src/art/pictureNames';
import { PRELOAD_AT_ONCE, backgroundName, figureName, hasPicture, pictureNames } from '../src/art/pictures';
import { BACKDROP_PLACES, paintBackdrop } from '../src/art/backdrop';
import { standInByAge, standInSprite } from '../src/art/standIn';
import { SEASONS, type Deed, type GameState, type Line, type Person, type SituationPack } from '../src/engine/types';
import { personOf } from '../src/pixel/people';
import type { Px } from '../src/pixel/px';
import { choiceViews, doHappening, happeningOf, lastDeed, openHappenings, openingLines } from '../src/engine/game';
import { poseOf, windowOf, type Step } from '../src/screens/Talk';
import { toSeason, withStats } from './fixtures';

// 코드 그림을 여러 장 그리는 시험이 있다(한 장에 수십 밀리초). 다른 시험들과 함께 돌아 바쁠 때도 넉넉하게(Review 1-라 35번 ㉢).
vi.setConfig({ testTimeout: 60_000 });

const hasIn = (names: readonly string[]): ((name: string) => boolean) => {
  const set = new Set(names);
  return (name) => set.has(name);
};

describe('그림 자리 — 파일 길에서 자리 이름으로', () => {
  it("'/pictures/' 아래의 길에서 확장자를 뗀 것이 자리 이름이다", () => {
    const index = buildIndex({
      '../assets/pictures/bg/s1395/entrance-spring.jpg': '/a.jpg',
      '../assets/pictures/char/s1395/monk-plain.webp': '/b.webp',
    });
    expect([...index.keys()].sort()).toEqual(['bg/s1395/entrance-spring', 'char/s1395/monk-plain']);
    expect(index.get('bg/s1395/entrance-spring')).toBe('/a.jpg');
    expect(index.get('char/s1395/monk-plain')).toBe('/b.webp');
  });

  it('같은 이름에 확장자가 여럿이면 webp · jpg · jpeg · png 차례로 하나를 고른다', () => {
    expect(EXT_ORDER).toEqual(['webp', 'jpg', 'jpeg', 'png']);
    const all = {
      '/x/pictures/bg/s/yard-spring.png': 'png',
      '/x/pictures/bg/s/yard-spring.jpeg': 'jpeg',
      '/x/pictures/bg/s/yard-spring.jpg': 'jpg',
      '/x/pictures/bg/s/yard-spring.webp': 'webp',
    };
    expect(buildIndex(all).get('bg/s/yard-spring')).toBe('webp');
    // 넣는 차례와 상관없다
    const reversed = Object.fromEntries(Object.entries(all).reverse());
    expect(buildIndex(reversed).get('bg/s/yard-spring')).toBe('webp');
    const { '/x/pictures/bg/s/yard-spring.webp': _webp, ...noWebp } = all;
    expect(buildIndex(noWebp).get('bg/s/yard-spring')).toBe('jpg');
    const { '/x/pictures/bg/s/yard-spring.jpg': _jpg, ...noJpg } = noWebp;
    expect(buildIndex(noJpg).get('bg/s/yard-spring')).toBe('jpeg');
    expect(buildIndex({ '/x/pictures/bg/s/yard-spring.png': 'png' }).get('bg/s/yard-spring')).toBe('png');
  });

  it('확장자는 대소문자를 가리지 않는다', () => {
    const index = buildIndex({ '/x/pictures/bg/s/well-spring.JPG': 'big', '/x/pictures/bg/s/well-spring.png': 'png' });
    expect(index.get('bg/s/well-spring')).toBe('big');
  });

  it("그림 폴더 밖의 길, 확장자가 없는 길, 모르는 확장자, 주소가 글자가 아닌 것은 버린다", () => {
    const index = buildIndex({
      '/x/other/bg/s/a-spring.jpg': 'out',
      '/x/pictures/bg/s/noext': 'noext',
      '/x/pictures/bg/s/b-spring.gif': 'gif',
      '/x/pictures/bg/s/c-spring.jpg': 7,
      '/x/pictures/.jpg': 'empty',
      '/x/pictures/bg/s/d-spring.jpg': 'ok',
    });
    expect([...index.keys()]).toEqual(['bg/s/d-spring']);
  });

  it('빈 폴더여도 된다', () => {
    expect(buildIndex({}).size).toBe(0);
  });
});

describe('그림 자리 — 배경을 찾는 차례', () => {
  it('그 계절의 그림이 있으면 그것을 쓴다', () => {
    const has = hasIn(['bg/s1/yard-spring', 'bg/s1/yard-autumn']);
    expect(backgroundNameIn(has, 's1', 'yard', 'spring')).toBe('bg/s1/yard-spring');
    expect(backgroundNameIn(has, 's1', 'yard', 'autumn')).toBe('bg/s1/yard-autumn');
  });

  it('없으면 같은 자리의 다른 계절을 쓴다(봄·여름·가을·겨울 차례로 처음 있는 것)', () => {
    const has = hasIn(['bg/s1/yard-autumn', 'bg/s1/yard-summer']);
    expect(backgroundNameIn(has, 's1', 'yard', 'spring')).toBe('bg/s1/yard-summer');
    expect(backgroundNameIn(has, 's1', 'yard', 'winter')).toBe('bg/s1/yard-summer');
    expect(backgroundNameIn(hasIn(['bg/s1/yard-winter']), 's1', 'yard', 'spring')).toBe('bg/s1/yard-winter');
    expect(backgroundNameIn(hasIn(['bg/s1/yard-spring']), 's1', 'yard', 'winter')).toBe('bg/s1/yard-spring');
  });

  it('그 자리의 그림이 하나도 없으면 null이다(코드 그림이 나온다)', () => {
    const has = hasIn(['bg/s1/yard-spring', 'bg/s2/well-spring', 'char/s1/well-plain']);
    for (const season of SEASONS) expect(backgroundNameIn(has, 's1', 'well', season)).toBeNull();
    expect(backgroundNameIn(hasIn([]), 's1', 'yard', 'spring')).toBeNull();
  });

  it('다른 이야기나 다른 자리의 그림을 가져다 쓰지 않는다', () => {
    const has = hasIn(['bg/s2/yard-spring', 'bg/s1/yard2-spring', 'bg/s1/backyard-spring']);
    expect(backgroundNameIn(has, 's1', 'yard', 'spring')).toBeNull();
  });
});

describe('그림 자리 — 인물을 찾는 차례', () => {
  it('그 표정의 그림이 있으면 그것을 쓴다', () => {
    const has = hasIn(['char/s1/monk-plain', 'char/s1/monk-glad']);
    expect(figureNameIn(has, 's1', 'monk', 'glad')).toBe('char/s1/monk-glad');
    expect(figureNameIn(has, 's1', 'monk', 'plain')).toBe('char/s1/monk-plain');
  });

  it('없으면 plain을 쓴다', () => {
    const has = hasIn(['char/s1/monk-plain', 'char/s1/monk-glad']);
    expect(figureNameIn(has, 's1', 'monk', 'worried')).toBe('char/s1/monk-plain');
    expect(figureNameIn(has, 's1', 'monk')).toBe('char/s1/monk-plain');
  });

  it('plain도 없으면 null이다(다른 표정을 가져다 쓰지 않는다 — 도트 인물이 선다)', () => {
    expect(figureNameIn(hasIn(['char/s1/monk-glad']), 's1', 'monk', 'worried')).toBeNull();
    expect(figureNameIn(hasIn(['char/s1/monk-glad']), 's1', 'monk', 'plain')).toBeNull();
    expect(figureNameIn(hasIn(['char/s2/monk-plain', 'bg/s1/monk-plain']), 's1', 'monk', 'plain')).toBeNull();
  });
});

describe('그림 자리 — 실제 그림 폴더', () => {
  const names = pictureNames();

  it('자리 이름은 bg/<이야기>/<자리>-<계절> 이거나 char/<이야기>/<누구>-<표정> 이다', () => {
    const stories = new Set(packs.map((p) => p.situation.id));
    for (const name of names) {
      const bg = /^bg\/([^/]+)\/([a-zA-Z0-9]+)-(spring|summer|autumn|winter)$/.exec(name);
      const ch = /^char\/([^/]+)\/([a-zA-Z0-9-]+)-(plain|glad|worried)$/.exec(name);
      expect(bg ?? ch, `꼴이 다른 그림 이름: ${name}`).not.toBeNull();
      expect(stories.has((bg ?? ch)![1]), `없는 이야기의 그림: ${name}`).toBe(true);
    }
  });

  it('찾아 준 이름은 실제로 있는 그림이다', () => {
    for (const pack of packs) {
      const story = pack.situation.id;
      for (const h of pack.happenings) {
        for (const season of SEASONS) {
          const bg = backgroundName(story, h.stage.place, season);
          if (bg !== null) expect(hasPicture(bg), bg).toBe(true);
        }
        for (const member of h.stage.cast ?? []) {
          const pic = pack.situation.people[member.who]?.pic ?? member.who;
          for (const pose of ['plain', 'glad', 'worried'] as const) {
            const name = figureName(story, pic, pose);
            if (name !== null) expect(hasPicture(name), name).toBe(true);
          }
        }
      }
    }
  });

  it('그 계절의 배경이 있으면 바로 그 이름을, 없는 자리는 null을 돌려준다', () => {
    for (const name of names) {
      const bg = /^bg\/([^/]+)\/([a-zA-Z0-9]+)-(spring|summer|autumn|winter)$/.exec(name);
      if (!bg) continue;
      expect(backgroundName(bg[1], bg[2], bg[3] as (typeof SEASONS)[number])).toBe(name);
      // 다른 계절에도 그 자리의 그림이 나온다(빈 배경이 되지 않는다)
      for (const season of SEASONS) expect(backgroundName(bg[1], bg[2], season)).not.toBeNull();
    }
    expect(backgroundName('s1395', 'no-such-place', 'spring')).toBeNull();
    expect(figureName('s1395', 'no-such-person', 'glad')).toBeNull();
  });
});

// 코드로 그린 배경(그림 파일이 없는 자리에 나온다)과 대신 서는 도트 인물. 브라우저 없이 화소 버퍼로 본다.
// 한 장을 그리는 데 수십 밀리초가 든다(열세 자리 × 네 계절). 다른 시험들과 함께 돌 때도 넉넉하게 시간을 준다.
const PAINT_TIMEOUT = 60_000;

describe('코드 그림 — 배경', { timeout: PAINT_TIMEOUT }, () => {
  // 가장 좁은 무대(1024×690의 대화 장면)에서 그려지는 크기
  const W = 342;
  const H = 212;
  const cache = new Map<string, Px>();
  const paint = (place: string, season: (typeof SEASONS)[number]): Px => {
    const key = `${place}/${season}`;
    let px = cache.get(key);
    if (!px) {
      px = paintBackdrop(place, season, W, H);
      cache.set(key, px);
    }
    return px;
  };
  /** 두 그림에서 빛깔이 다른 점의 몫(0~1) */
  const differ = (a: Px, b: Px): number => {
    let n = 0;
    for (let i = 0; i < a.d.length; i++) if (a.d[i] !== b.d[i]) n++;
    return n / a.d.length;
  };

  it('자리는 열넷이다: 봄의 여섯, 여름~겨울의 일곱(냇가·큰길·타작 마당·고갯마루·향교 앞·양반 댁 대문 앞·집 안), 옆집', () => {
    expect([...BACKDROP_PLACES]).toEqual(['entrance', 'paddy', 'well', 'temple', 'hill', 'yard', 'stream', 'road', 'threshing', 'pass', 'hyanggyo', 'manor', 'room', 'neighbor']);
  });

  it('옆집은 우리 집 마당과 다른 그림이다(계절마다 점의 3분의 1 넘게 다르다)', () => {
    for (const season of SEASONS) expect(differ(paint('neighbor', season), paint('yard', season)), season).toBeGreaterThan(0.33);
  });

  it('자리마다 네 계절을 빈 점 없이 가득 그린다(달라는 크기 그대로)', () => {
    for (const place of BACKDROP_PLACES) {
      for (const season of SEASONS) {
        const px = paint(place, season);
        expect([px.w, px.h], `${place}/${season}`).toEqual([W, H]);
        expect(px.count(), `${place}/${season}: 빈 점이 있다`).toBe(W * H);
      }
    }
  });

  it('같은 자리도 계절마다 달라 보인다(어느 두 계절이든 점의 15% 넘게 다르다. 마당 흙과 기와는 사철 같다)', () => {
    for (const place of BACKDROP_PLACES) {
      for (let i = 0; i < SEASONS.length; i++) {
        for (let j = i + 1; j < SEASONS.length; j++) {
          const d = differ(paint(place, SEASONS[i]), paint(place, SEASONS[j]));
          // 집 안은 벽과 바닥이 같아 문틈과 살창의 빛, 겨울의 어둑함으로만 갈린다
          expect(d, `${place}: ${SEASONS[i]} / ${SEASONS[j]}`).toBeGreaterThan(place === 'room' ? 0.01 : 0.15);
        }
      }
    }
  });

  it('자리마다 다른 그림이다(같은 계절의 어느 두 자리든 점의 4분의 1 넘게 다르다)', () => {
    for (const season of ['spring', 'winter'] as const) {
      for (let i = 0; i < BACKDROP_PLACES.length; i++) {
        for (let j = i + 1; j < BACKDROP_PLACES.length; j++) {
          const d = differ(paint(BACKDROP_PLACES[i], season), paint(BACKDROP_PLACES[j], season));
          expect(d, `${season}: ${BACKDROP_PLACES[i]} / ${BACKDROP_PLACES[j]}`).toBeGreaterThan(0.25);
        }
      }
    }
  });

  it('같은 자리·계절·크기면 언제나 같은 그림이다(난수를 쓰지 않는다)', () => {
    for (const place of ['stream', 'room', 'paddy']) {
      expect(differ(paintBackdrop(place, 'autumn', W, H), paint(place, 'autumn'))).toBe(0);
    }
  });

  it('모르는 자리 이름이면 먼 마을 풍경이 나온다(던지지 않는다. 물려받은 이름에도 속지 않는다)', () => {
    const village = paintBackdrop('no-such-place', 'summer', W, H);
    expect(village.count()).toBe(W * H);
    for (const odd of ['constructor', 'toString', '__proto__', '']) {
      expect(differ(paintBackdrop(odd, 'summer', W, H), village), odd).toBe(0);
    }
  });

  it('아주 작거나 길쭉한 칸에도 던지지 않고 가득 그린다', () => {
    for (const [w, h] of [[8, 8], [300, 96], [96, 200]] as const) {
      for (const place of BACKDROP_PLACES) {
        const px = paintBackdrop(place, 'winter', w, h);
        expect(px.count(), `${place} ${w}x${h}`).toBe(w * h);
      }
    }
  });

  it('논은 계절에 따라 모습이 바뀐다: 물 댄 논 → 푸른 벼 → 누런 벼 → 눈 쌓인 빈 논', () => {
    // 논의 가운데 띠(가운데 논배미)에서 가장 흔한 빛깔이 계절마다 다르다
    const band = (season: (typeof SEASONS)[number]): number => {
      const px = paint('paddy', season);
      const count = new Map<number, number>();
      for (let y = Math.round(H * 0.72); y < Math.round(H * 0.8); y++) for (let x = 0; x < Math.round(W * 0.3); x++) count.set(px.get(x, y), (count.get(px.get(x, y)) ?? 0) + 1);
      return [...count.entries()].sort((a, b) => b[1] - a[1])[0][0];
    };
    const tones = SEASONS.map(band);
    expect(new Set(tones).size).toBe(SEASONS.length);
    const rgbOf = (c: number): [number, number, number] => [c & 255, (c >> 8) & 255, (c >> 16) & 255];
    const [, summer, autumn] = tones.map(rgbOf);
    expect(summer[1]).toBeGreaterThan(summer[0]); // 여름: 풀빛(초록이 빨강보다 세다)
    expect(autumn[0]).toBeGreaterThan(autumn[2] + 60); // 가을: 누런빛(빨강이 파랑보다 훨씬 세다)
  });

  it('대화 장면이 쓰는 자리마다 코드 그림이 있다(그림 파일이 없어도 그 자리의 그림이 나온다)', () => {
    const known = new Set<string>(BACKDROP_PLACES);
    for (const pack of packs) {
      for (const h of pack.happenings) expect(known.has(h.stage.place), `${h.id}: 코드 그림이 없는 자리 "${h.stage.place}"`).toBe(true);
    }
  });
});

describe('코드 그림 — 대신 서는 도트 인물', () => {
  it('자료에 적힌 도트 이름이 있으면 그것을 쓴다', () => {
    const monk: Person = { label: '스님', sex: 'm', age: 'adult', sprite: 'monk' };
    expect(standInSprite('monk', monk)).toBe('monk');
  });

  it('적힌 이름이 아직 그려지지 않았으면 성별과 나이대로 고른다(빈 무대가 되지 않는다)', () => {
    const cases: [Person['sex'], Person['age'], string][] = [
      ['m', 'adult', 'neighborMan'],
      ['f', 'adult', 'wellWoman'],
      ['m', 'old', 'elderMan'],
      ['f', 'old', 'granny'],
      ['m', 'child', 'boyKid'],
      ['f', 'child', 'girlKid'],
      ['m', 'young', 'brother'],
      ['f', 'young', 'sister'],
    ];
    for (const [sex, age, want] of cases) {
      expect(standInSprite('x', { label: '누구', sex, age, sprite: 'not-drawn-yet' }), `${sex}/${age}`).toBe(want);
      expect(standInSprite('x', { label: '누구', sex, age }), `${sex}/${age}`).toBe(want);
      expect(standInByAge({ sex, age })).toBe(want);
      expect(personOf(want), want).toBeDefined();
    }
  });

  it('자료에 없는 사람이어도 설 사람이 있다', () => {
    expect(standInSprite('monk', undefined)).toBe('monk');
    expect(personOf(standInSprite('nobody-at-all', undefined))).toBeDefined();
  });

  it('이야기의 모든 등장인물에게 설 도트 인물이 있다', () => {
    for (const pack of packs) {
      for (const [who, person] of Object.entries(pack.situation.people)) {
        expect(personOf(standInSprite(who, person)), `${pack.situation.id}/${who}`).toBeDefined();
      }
      for (const h of pack.happenings) {
        for (const member of h.stage.cast ?? []) {
          expect(personOf(standInSprite(member.who, pack.situation.people[member.who])), `${h.id}/${member.who}`).toBeDefined();
        }
      }
    }
  });
});

// Review 1-라 7번: 겨울 덤 「곡식이 떨어진 옆집」이 우리 집 마당 그림(yard-winter)과 웃는 얼굴로 나왔다.
// 그 일의 자리를 새 이름 neighbor로, 옆집 동무의 표정을 worried로 둔다. 그림이 오기 전에도 어긋나지 않아야 한다.
describe('그림 자리 — 옆집과 걱정하는 얼굴', () => {
  it('옆집의 배경: neighbor-winter가 있으면 그것, 없으면 코드 그림(우리 집 마당 yard-*로 넘어가지 않는다)', () => {
    const yardOnly = hasIn(['bg/s1395/yard-winter', 'bg/s1395/yard-spring', 'bg/s1395/yard-autumn']);
    expect(backgroundNameIn(yardOnly, 's1395', 'neighbor', 'winter')).toBeNull();
    const withNeighbor = hasIn(['bg/s1395/yard-winter', 'bg/s1395/neighbor-winter']);
    expect(backgroundNameIn(withNeighbor, 's1395', 'neighbor', 'winter')).toBe('bg/s1395/neighbor-winter');
    // 다른 계절에 쓰게 되면 옆집의 겨울 그림이 대신 나온다(역시 우리 집 마당이 아니다)
    expect(backgroundNameIn(withNeighbor, 's1395', 'neighbor', 'autumn')).toBe('bg/s1395/neighbor-winter');
    // 실제 그림 폴더에서도: 옆집의 그림 이름은 옆집의 것이거나 없다
    for (const season of SEASONS) {
      const name = backgroundName('s1395', 'neighbor', season);
      expect(name === null || name.startsWith('bg/s1395/neighbor-'), `${season}: ${name}`).toBe(true);
    }
  });

  it('옆집 동무의 걱정하는 얼굴: worried가 있으면 그것, 없으면 plain(웃는 얼굴 glad로 넘어가지 않는다)', () => {
    expect(figureNameIn(hasIn(['char/s1395/friend-girl-plain', 'char/s1395/friend-girl-glad']), 's1395', 'friend-girl', 'worried')).toBe('char/s1395/friend-girl-plain');
    expect(figureNameIn(hasIn(['char/s1395/friend-girl-plain', 'char/s1395/friend-girl-worried']), 's1395', 'friend-girl', 'worried')).toBe('char/s1395/friend-girl-worried');
    const real = figureName('s1395', 'friend-girl', 'worried');
    expect(real === null || real === 'char/s1395/friend-girl-worried' || real === 'char/s1395/friend-girl-plain', String(real)).toBe(true);
    if (hasPicture('char/s1395/friend-girl-worried')) expect(real).toBe('char/s1395/friend-girl-worried');
  });

  it('「곡식이 떨어진 옆집」이 옆집 자리를 쓰면, 그 자리의 코드 그림이 있다', () => {
    const p = packs.find((pack) => pack.situation.id === 's1395');
    const share = p?.happenings.find((h) => h.id === 's1395-winter-share');
    if (share && share.stage.place === 'neighbor') expect([...BACKDROP_PLACES]).toContain('neighbor');
    // 우리 집 마당을 쓰지 않는다(내용 일꾼이 바꾼 뒤에는 이 줄이 지킨다)
    if (share && share.stage.place !== 'yard') expect(share.stage.place).toBe('neighbor');
  });
});

// Review 1-라 11.8 ①: 위의 시험은 그림 이름 찾기만 보았다. 장면에서는 동무가 말하기 전의 첫 창과 "달라진 것" 창에서
// plain(이를 드러내고 웃는 얼굴)으로 섰다. 대화 장면(Talk.tsx)이 쓰는 표정 셈(windowOf → poseOf)을 그대로 불러 창마다 본다.
describe('대화 장면 — 「곡식이 떨어진 옆집」의 동무는 내내 걱정하는 얼굴', () => {
  const s1395 = getPack('s1395') as SituationPack;
  const ID = 's1395-winter-share';
  const share = happeningOf(s1395, ID);
  const girl = (share.stage.cast ?? []).find((member) => member.who === 'friend-girl');
  const poseIn = (step: Step, opening: Line[], result: Line[] | null): Pose => {
    const { lines, at } = windowOf(step, opening, result);
    return poseOf(girl as { who: string; pose?: Pose }, lines, at);
  };
  /** 한 장면에서 동무가 서는 모든 창(여는 창 → 선택지 → 결과 창 → "달라진 것")의 표정 */
  const posesOfScene = (opening: Line[], result: Line[]): [string, Pose][] => [
    ...opening.map((_, i): [string, Pose] => [`여는 ${i + 1}번째 창`, poseIn({ kind: 'open', i }, opening, null)]),
    ['선택지', poseIn({ kind: 'choose' }, opening, null)],
    ...result.map((_, i): [string, Pose] => [`결과 ${i + 1}번째 창`, poseIn({ kind: 'result', i }, opening, result)]),
    ['달라진 것', poseIn({ kind: 'change' }, opening, result)],
  ];

  it('동무가 무대에 서고, 기본 표정이 worried로 적혀 있다', () => {
    expect(share.stage.cast?.map((member) => member.who)).toEqual(['friend-girl']);
    expect(girl?.pose).toBe('worried');
  });

  it('실제 판에서: 여는 창, 선택지, 갈림(곡식·땔나무)마다의 결과 창, "달라진 것" 창이 모두 worried다', () => {
    for (const look of ['boy', 'girl'] as const) {
      // 곡식 길이 잠기지 않게 살림을 넉넉히, 덤을 할 수 있게 해 ☀를 채운다
      const winter: GameState = { ...withStats(toSeason(s1395, 'farmer', look, 'winter'), { living: 5, body: 5 }), sunsLeft: 3 };
      const view = openHappenings(s1395, winter).find((v) => v.happening.id === ID);
      expect(view && !view.noSun, `${look}: 겨울 맵에 옆집 덤이 열려 있다`).toBe(true);
      const opening = openingLines(s1395, winter, ID);
      const choices = choiceViews(s1395, winter, ID);
      expect(choices.map((c) => [c.id, c.locked])).toEqual([
        ['grain', false],
        ['wood', false],
      ]);
      for (const choice of choices) {
        const deed = lastDeed(doHappening(s1395, winter, { id: ID, choiceId: choice.id })) as Deed;
        expect(deed.lines.length, `${look}/${choice.id}: 결과 대화가 있다`).toBeGreaterThan(0);
        // "달라진 것" 창이 실제로 뜨는 일이다(수치나 해 ☀가 바뀐다)
        expect(deed.sun, `${look}/${choice.id}`).toBe(1);
        for (const [where, pose] of posesOfScene(opening, deed.lines)) expect(pose, `${look}/${choice.id}: ${where}`).toBe('worried');
      }
    }
  });

  it('자료의 모든 갈림에서도(여는 대화의 갈림 × 선택지와 그 갈림의 결과 대화) worried다 — 지금 판에서 닿지 않는 갈림까지', () => {
    const openings = [share.lines, ...(share.lineVariants ?? []).map((variant) => variant.lines)];
    const results = [
      ...(share.choices ?? []).flatMap((choice) => [choice.lines ?? [], ...(choice.variants ?? []).map((variant) => variant.lines ?? [])]),
      ...(share.after ? [share.after.lines ?? [], ...(share.after.variants ?? []).map((variant) => variant.lines ?? [])] : []),
    ];
    expect(results.length).toBeGreaterThanOrEqual(2);
    for (const [o, opening] of openings.entries()) {
      for (const [r, result] of results.entries()) {
        for (const [where, pose] of posesOfScene(opening, result)) expect(pose, `여는 갈림 ${o} × 결과 ${r}: ${where}`).toBe('worried');
      }
    }
  });

  it('표정 셈: 그 사람이 지은 표정이 기본 표정보다 앞서고, 기본 표정이 없으면 지금처럼 plain이다', () => {
    const lines: Line[] = [{ text: '이야기 줄' }, { who: 'friend-girl', pose: 'glad', text: '웃는다' }, { who: 'monk', pose: 'worried', text: '다른 사람' }];
    expect(poseOf({ who: 'friend-girl', pose: 'worried' }, lines, 0)).toBe('worried');
    expect(poseOf({ who: 'friend-girl', pose: 'worried' }, lines, 1)).toBe('glad');
    expect(poseOf({ who: 'friend-girl', pose: 'worried' }, lines, 2)).toBe('glad');
    expect(poseOf({ who: 'friend-girl' }, lines, 0)).toBe('plain');
    expect(poseOf({ who: 'friend-girl' }, lines, -1)).toBe('plain');
    expect(poseOf({ who: 'friend-girl', pose: 'worried' }, lines, -1)).toBe('worried');
    // 줄 묶음: 결과 창이면 결과의 줄, 선택지면 여는 대화의 마지막 줄, "달라진 것"은 줄이 없다
    const opening: Line[] = [{ text: 'a' }, { text: 'b' }];
    const result: Line[] = [{ text: 'c' }];
    expect(windowOf({ kind: 'result', i: 0 }, opening, result)).toEqual({ lines: result, at: 0 });
    expect(windowOf({ kind: 'choose' }, opening, null)).toEqual({ lines: opening, at: 1 });
    expect(windowOf({ kind: 'change' }, opening, result).at).toBe(-1);
  });
});

// Review 1-라 36번: 이야기를 열 때 서른 장 남짓을 이름순으로 한꺼번에 받아, 느린 망에서는 첫 대화의 사람이 한참 도트 대역이었다.
describe('그림 자리 — 미리 받는 차례', () => {
  const names = [
    'bg/s1/entrance-spring',
    'bg/s1/paddy-spring',
    'bg/s1/paddy-summer',
    'bg/s1/stream-summer',
    'bg/s1/room-winter',
    'bg/s1/unused-autumn',
    'char/s1/elder-plain',
    'char/s1/elder-glad',
    'char/s1/monk-plain',
    'char/s1/girl-plain',
    'char/s1/girl-worried',
    'char/s1/grandma-plain',
    'bg/s2/entrance-spring',
    'char/s2/elder-plain',
  ];
  const plan = [
    { season: 'spring' as const, places: ['entrance', 'paddy'], people: ['elder', 'monk'] },
    { season: 'summer' as const, places: ['stream', 'paddy'], people: ['girl'] },
    { season: 'autumn' as const, places: ['yard'], people: [] },
    { season: 'winter' as const, places: ['room'], people: ['grandma', 'girl'] },
  ];

  it('봄에 열면: 봄의 배경 → 봄에 서는 사람 → 여름 … → 쓰이지 않는 것은 맨 끝', () => {
    expect(preloadOrder(names, 's1', plan, 'spring')).toEqual([
      'bg/s1/entrance-spring',
      'bg/s1/paddy-spring',
      'char/s1/elder-plain',
      'char/s1/elder-glad',
      'char/s1/monk-plain',
      'bg/s1/stream-summer',
      'bg/s1/paddy-summer',
      'char/s1/girl-plain',
      'char/s1/girl-worried',
      'bg/s1/room-winter',
      'char/s1/grandma-plain',
      'bg/s1/unused-autumn',
    ]);
  });

  it('겨울에 이어 하면 겨울의 것부터, 그다음 봄으로 돌아간다', () => {
    const order = preloadOrder(names, 's1', plan, 'winter');
    expect(order.slice(0, 4)).toEqual(['bg/s1/room-winter', 'char/s1/grandma-plain', 'char/s1/girl-plain', 'char/s1/girl-worried']);
    expect(order[4]).toBe('bg/s1/entrance-spring');
  });

  it('그 계절의 그림이 없는 자리는 대신 나올 다른 계절의 그림을 받는다(가을의 마당 → 봄의 마당 없음이면 넣지 않는다)', () => {
    const order = preloadOrder([...names, 'bg/s1/yard-spring'], 's1', plan, 'autumn');
    expect(order[0]).toBe('bg/s1/yard-spring');
  });

  it('다른 이야기의 그림은 넣지 않고, 같은 이름은 한 번만, 없는 이름은 만들지 않는다', () => {
    const order = preloadOrder(names, 's1', plan, 'spring');
    expect(order.every((name) => name.includes('/s1/'))).toBe(true);
    expect(new Set(order).size).toBe(order.length);
    expect(order.every((name) => names.includes(name))).toBe(true);
    expect(order.length).toBe(names.filter((name) => name.includes('/s1/')).length);
  });

  it('한 번에 받는 수는 둘이다', () => {
    expect(PRELOAD_AT_ONCE).toBe(2);
  });

  it('실제 그림 폴더: ①의 그림이 모두 차례에 들고, 봄에 열면 봄 첫 일의 배경이 맨 앞이다', () => {
    const all = pictureNames();
    const p = packs.find((pack) => pack.situation.id === 's1395');
    expect(p).toBeDefined();
    const plan1395 = SEASONS.map((season) => ({
      season,
      places: [...new Set(p!.happenings.filter((h) => h.season === season).map((h) => h.stage.place))],
      people: [...new Set(p!.happenings.filter((h) => h.season === season).flatMap((h) => (h.stage.cast ?? []).map((c) => p!.situation.people[c.who]?.pic ?? c.who)))],
    }));
    const order = preloadOrder(all, 's1395', plan1395, 'spring');
    expect(order.length).toBe(all.filter((name) => name.includes('/s1395/')).length);
    const first = p!.happenings.find((h) => h.season === 'spring')!;
    const firstBg = backgroundName('s1395', first.stage.place, 'spring');
    if (firstBg) expect(order[0]).toBe(firstBg);
  });
});
