// 그림 자리의 시험: 이름을 찾는 차례(그 이름 → 같은 자리의 다른 계절 → 없음, 표정 → plain → 없음, 확장자 차례)와
// 실제 그림 폴더의 이름이 약속한 꼴인지. 화면 없이(브라우저 없이) 본다.

import { describe, expect, it } from 'vitest';
import { packs } from '../src/content';
import { EXT_ORDER, backgroundNameIn, buildIndex, figureNameIn } from '../src/art/pictureNames';
import { backgroundName, figureName, hasPicture, pictureNames } from '../src/art/pictures';
import { SEASONS } from '../src/engine/types';

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
