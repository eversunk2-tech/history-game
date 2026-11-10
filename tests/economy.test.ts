// 돈 엔진 시험(spec 5.5·5.6의 1번·6.5, 11.1 사의 ㉡ 칸): 꾸민 값(쌀 한 되 = 5닢 꼴, 베 한 자 = 3닢 꼴), 그 시대의 돈,
// 가게에서 건넨 만큼 빼기(넉넉히 얹으면 그만큼 더 나감, 모자라면 거절), 할아버지께 맡기기, 되팔기 상한, 사고팔기로 돈을 불리지 못함,
// 에피소드·서당의 돈, 마을 소개의 첫 선물.

import { describe, expect, it } from 'vitest';
import {
  addPurse,
  canAfford,
  emptyPurse,
  episodePurse,
  eraMoney,
  fairHand,
  hasPurse,
  introGift,
  latestStory,
  moneyFor,
  payHanded,
  resale,
  sell,
  seodangPurse,
  takePurse,
  worth,
} from '../src/engine/economy';
import { mulberry32 } from '../src/engine/rng';
import type { Purse } from '../src/engine/types4';
import { episode41 } from './fixtures4';

const p = (rice = 0, cloth = 0, coin = 0): Purse => ({ rice, cloth, coin });

describe('주머니와 꾸민 값', () => {
  it('쌀 한 되 = 5닢 꼴, 베 한 자 = 3닢 꼴', () => {
    expect(worth(p(1))).toBe(5);
    expect(worth(p(0, 1))).toBe(3);
    expect(worth(p(6, 3))).toBe(39);
    expect(worth(undefined)).toBe(0);
  });

  it('더하고 빼기(모자라면 던진다), 칸마다 넉넉한가', () => {
    expect(addPurse(p(1, 2, 3), { rice: 2 })).toEqual(p(3, 2, 3));
    expect(takePurse(p(3, 2, 3), { cloth: 2 })).toEqual(p(3, 0, 3));
    expect(() => takePurse(p(1), { rice: 2 })).toThrow();
    expect(hasPurse(p(1, 1), { rice: 1, cloth: 2 })).toBe(false);
  });

  it('마을 소개의 첫 선물: 쌀 3되 · 베 2자', () => {
    expect(introGift()).toEqual(p(3, 2));
    expect(emptyPurse()).toEqual(p());
  });
});

describe('그 시대의 돈', () => {
  it('①~④는 쌀·베, ⑤~⑦은 엽전', () => {
    for (const s of ['s1395', 's1446', 's1592', 's1636']) expect(eraMoney(s)).toBe('goods');
    for (const s of ['s1795', 's1863', 's1899']) expect(eraMoney(s)).toBe('coin');
    expect(eraMoney('모르는-이야기')).toBe('goods');
  });

  it('가 본 가장 늦은 시대(없으면 ①), 그 시대의 돈으로 바꾸기', () => {
    expect(latestStory([])).toBe('s1395');
    expect(latestStory(['s1446', 's1395', 's1795'])).toBe('s1795');
    expect(moneyFor(10, 's1395')).toEqual(p(2));
    expect(moneyFor(13, 's1446')).toEqual(p(2, 1));
    expect(moneyFor(10, 's1795')).toEqual(p(0, 0, 10));
    // 쌀·베로 바꿀 때 값을 넘지 않는다(8닢부터는 꼭 맞다) — 바꾸기로 돈이 늘지 않는다
    for (let n = 0; n <= 200; n++) {
      const got = worth(moneyFor(n, 's1395'));
      expect(got).toBeLessThanOrEqual(n);
      if (n >= 8) expect(got).toBe(n);
    }
    expect(moneyFor(7, 's1395')).toEqual(p(0, 2));
  });

  it('에피소드를 처음 깨면: ①-1은 쌀 6되 · 베 3자, 표에 없으면 이야기 배수로 그 시대의 돈', () => {
    expect(episodePurse(episode41)).toEqual(p(6, 3));
    const bare = { ...episode41, rewards: { ...episode41.rewards, purse: p() } };
    expect(episodePurse(bare, 's1446')).toEqual(p(7, 4));
    expect(episodePurse({ ...bare, story: 's1899' })).toEqual(p(0, 0, Math.round(39 * 1.55)));
  });

  it('서당 한 판: 10닢 꼴(①이면 쌀 2되), 같은 주제의 몫을 따른다', () => {
    expect(seodangPurse('s1395')).toEqual(p(2));
    expect(seodangPurse('s1395', 0.5)).toEqual(p(1));
    expect(seodangPurse('s1395', 0)).toEqual(p());
    expect(seodangPurse('s1863')).toEqual(p(0, 0, 10));
  });
});

describe('가게 — 「쌀과 베로 값 치르기」', () => {
  const hoe = p(2);

  it('건넨 만큼 빠진다: 값 그대로면 그대로, 넉넉히 얹으면 그만큼 더 나간다', () => {
    expect(payHanded(p(3, 2), hoe, p(2))).toEqual({ ok: true, purse: p(1, 2), over: 0 });
    expect(payHanded(p(3, 2), hoe, p(1, 2))).toEqual({ ok: true, purse: p(2, 0), over: 1 });
    expect(payHanded(p(3, 2), hoe, p(3, 0))).toEqual({ ok: true, purse: p(0, 2), over: 5 });
  });

  it('모자라게 건네면 거절, 주머니에 없는 것을 건네면 거절(주머니는 그대로)', () => {
    expect(payHanded(p(3, 2), hoe, p(1, 1))).toEqual({ ok: false, why: 'short' });
    expect(payHanded(p(1, 2), hoe, p(2))).toEqual({ ok: false, why: 'lack' });
  });

  it('할아버지께 맡기면 알맞게 치른다(덜 얹는 쪽), 치를 수 없으면 null', () => {
    expect(fairHand(p(3, 2), hoe)).toEqual(p(2));
    expect(fairHand(p(1, 2), hoe)).toEqual(p(1, 2));
    expect(fairHand(p(0, 4), hoe)).toEqual(p(0, 4));
    expect(fairHand(p(1, 1), hoe)).toBeNull();
    expect(canAfford(p(1, 1), hoe)).toBe(false);
    expect(canAfford(p(3, 2), hoe)).toBe(true);
    // 맡겨서 치른 것은 언제나 값에 닿고, 주머니 안의 것이다
    const rng = mulberry32(5);
    for (let i = 0; i < 200; i++) {
      const purse = p(Math.floor(rng() * 6), Math.floor(rng() * 6), Math.floor(rng() * 6));
      const price = p(Math.floor(rng() * 4), Math.floor(rng() * 3), Math.floor(rng() * 3));
      const hand = fairHand(purse, price);
      if (worth(purse) < worth(price)) expect(hand).toBeNull();
      if (hand) {
        expect(hasPurse(purse, hand)).toBe(true);
        expect(worth(hand)).toBeGreaterThanOrEqual(worth(price));
        expect(payHanded(purse, price, hand).ok).toBe(true);
      }
    }
  });
});

describe('되팔기 — 사고팔기로 돈을 불리지 못한다', () => {
  it('산 값보다 비싸게 되팔 수 없다', () => {
    expect(resale(p(2), p(3))).toBe(10);
    expect(resale(p(2), 6)).toBe(6);
    expect(resale(10, -5)).toBe(0);
    expect(sell(p(), p(2), p(5), 's1395')).toEqual(p(2));
    expect(sell(p(), 10, 30, 's1795')).toEqual(p(0, 0, 10));
  });

  it('사고 되팔기를 아무리 되풀이해도 닢 꼴이 늘지 않는다(넉넉히 얹은 것은 돌아오지 않는다)', () => {
    const rng = mulberry32(11);
    for (let run = 0; run < 50; run++) {
      let purse = p(10, 10);
      const start = worth(purse);
      for (let step = 0; step < 30; step++) {
        const price = p(Math.floor(rng() * 3) + 1, Math.floor(rng() * 2));
        const hand = rng() < 0.5 ? fairHand(purse, price) : p(Math.min(purse.rice, price.rice + 1), Math.min(purse.cloth, price.cloth + 1));
        if (!hand) break;
        const paid = payHanded(purse, price, hand);
        if (!paid.ok) continue;
        const before = worth(purse);
        purse = paid.purse;
        // 부르는 값이 아무리 높아도 산 값까지만
        purse = sell(purse, price, worth(price) * (1 + Math.floor(rng() * 5)), 's1395');
        expect(worth(purse)).toBeLessThanOrEqual(before);
      }
      expect(worth(purse)).toBeLessThanOrEqual(start);
    }
  });
});
