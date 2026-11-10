// 돈의 셈(spec 5.5·5.6의 1번·6.5): 돈 주머니(쌀 되·베 자·엽전 닢)와 꾸민 값(쌀 한 되 = 5닢 꼴, 베 한 자 = 3닢 꼴),
// 그 시대의 돈(①~④ 쌀·베, ⑤~⑦ 엽전 — 이야기 id로), 가게에서 건넨 만큼 빼기(넉넉히 얹으면 그만큼 더 나간다, 모자라면 거절),
// 할아버지께 셈을 맡기기(알맞게 치른다), 되팔기 상한(산 값보다 비싸게 되팔 수 없다), 에피소드·서당의 돈, 마을 소개의 첫 선물.
// 화면·브라우저·저장·시계를 모른다. 상태를 고치지 않고 새 주머니를 돌려준다. 숫자는 balance.ts의 표만 읽는다.
// 값은 꾸민 값이다(그때의 실제 값이 아니다 — 5.5).
//
// ── 쓰는 법(㉢·㉣) ─────────────────────────────────────────────
//   worth(p)                         → 주머니(또는 값)의 닢 꼴
//   addPurse(a, b) / takePurse(a, b) → 더한 주머니 / 뺀 주머니(모자라면 던진다)
//   hasPurse(p, need)                → 칸마다 넉넉한가
//   eraMoney(story) / latestStory(ids) → 'goods'(쌀·베) | 'coin'(엽전) / 가 본 가장 늦은 이야기
//   moneyFor(닢, story)              → 그 시대의 돈으로 바꾼 주머니(①이면 10닢 → 쌀 2되)
//   payHanded(purse, price, handed)  → { ok, purse, over } 「쌀과 베로 값 치르기」에서 건넨 만큼 뺀다(값보다 적으면 'short', 주머니에 없으면 'lack')
//   fairHand(purse, price)           → 할아버지께 맡겼을 때 건넬 것(덜 얹는 쪽). 치를 수 없으면 null
//   canAfford(purse, price)          → 치를 수 있나(없으면 화면은 놀이 없이 "쌀·베가 모자라요")
//   resale(bought, offer)            → 되팔아 받는 닢(산 값을 넘지 않는다)
//   sell(purse, bought, offer, story) → 되판 뒤의 주머니
//   episodePurse(episode, story)     → 에피소드를 처음 깼을 때 받는 돈(다시 하기는 0 — episode.ts)
//   seodangPurse(story, share)       → 서당 한 판의 돈(가 본 가장 늦은 시대의 돈, 같은 주제 몫)
//   introGift()                      → 마을 소개의 첫 선물(쌀 3되 · 베 2자)

import { BALANCE } from './balance';
import { storyMul } from './growth';
import type { Episode, Purse } from './types4';

export function emptyPurse(): Purse {
  return { rice: 0, cloth: 0, coin: 0 };
}

/** 닢 꼴: 쌀 한 되 5, 베 한 자 3, 엽전 하나 1 */
export function worth(p: Partial<Purse> | undefined): number {
  return (p?.rice ?? 0) * BALANCE.riceCoin + (p?.cloth ?? 0) * BALANCE.clothCoin + (p?.coin ?? 0);
}

export function addPurse(a: Purse, b: Partial<Purse>): Purse {
  return { rice: a.rice + (b.rice ?? 0), cloth: a.cloth + (b.cloth ?? 0), coin: a.coin + (b.coin ?? 0) };
}

/** 칸마다 넉넉한가 */
export function hasPurse(p: Purse, need: Partial<Purse>): boolean {
  return p.rice >= (need.rice ?? 0) && p.cloth >= (need.cloth ?? 0) && p.coin >= (need.coin ?? 0);
}

/** 뺀 주머니. 칸 하나라도 모자라면 던진다 */
export function takePurse(a: Purse, b: Partial<Purse>): Purse {
  if (!hasPurse(a, b)) throw new Error('주머니에 그만큼이 없다');
  return { rice: a.rice - (b.rice ?? 0), cloth: a.cloth - (b.cloth ?? 0), coin: a.coin - (b.coin ?? 0) };
}

// ── 그 시대의 돈(6.5) ───────────────────────────────────────────

/** ①~④는 쌀·베, ⑤~⑦은 엽전(상평통보). 모르는 이야기는 쌀·베 */
export function eraMoney(story: string): 'goods' | 'coin' {
  const order = BALANCE.stories;
  const at = order.indexOf(story);
  return at >= 0 && at >= order.indexOf(BALANCE.coinFrom) ? 'coin' : 'goods';
}

/** 가 본 이야기 가운데 가장 늦은 시대(없으면 ①) */
export function latestStory(stories: readonly string[]): string {
  const order = BALANCE.stories;
  let best = order[0];
  for (const s of stories) if (order.indexOf(s) > order.indexOf(best)) best = s;
  return best;
}

/**
 * 닢 꼴의 값을 그 시대의 돈으로. 엽전의 때에는 닢 그대로. 쌀·베의 때에는 그 값을 넘지 않는 가장 가까운 쌀·베(같으면 쌀을 많이)
 * — 10닢 → 쌀 2되, 13닢 → 쌀 2되·베 1자, 7닢 → 베 2자(6닢 꼴). 8닢부터는 꼭 맞게 바뀐다. 넘게 바꾸지 않으므로 바꾸기로 돈이 늘지 않는다.
 */
export function moneyFor(coins: number, story: string): Purse {
  const n = Math.max(0, Math.floor(coins));
  if (eraMoney(story) === 'coin') return { rice: 0, cloth: 0, coin: n };
  let best = { rice: 0, cloth: 0, coin: 0 };
  let bestWorth = -1;
  for (let rice = Math.floor(n / BALANCE.riceCoin); rice >= 0; rice--) {
    const cloth = Math.floor((n - rice * BALANCE.riceCoin) / BALANCE.clothCoin);
    const w = rice * BALANCE.riceCoin + cloth * BALANCE.clothCoin;
    if (w > bestWorth) {
      best = { rice, cloth, coin: 0 };
      bestWorth = w;
    }
    if (w === n) break;
  }
  return best;
}

// ── 가게(6.5 — 「쌀과 베로 값 치르기」) ─────────────────────────────

export type PayResult = { ok: true; purse: Purse; over: number } | { ok: false; why: 'short' | 'lack' };

/**
 * 놀이에서 건넨 만큼 뺀다. 건넨 것이 값보다 적으면 거절('short'), 주머니에 없는 것을 건넸으면 거절('lack').
 * 값보다 넉넉히 얹었으면 그만큼 더 나간다(거슬러 주지 않는다 — over는 더 나간 닢 꼴).
 */
export function payHanded(purse: Purse, price: Partial<Purse>, handed: Partial<Purse>): PayResult {
  if (!hasPurse(purse, handed)) return { ok: false, why: 'lack' };
  if (worth(handed) < worth(price)) return { ok: false, why: 'short' };
  return { ok: true, purse: takePurse(purse, handed), over: worth(handed) - worth(price) };
}

/**
 * 할아버지께 셈을 맡긴다: 주머니에서 값에 닿는 것 가운데 덜 얹는 것(같으면 적게 건네는 것). 값 그대로 있으면 그대로.
 * 치를 수 없으면 null.
 */
export function fairHand(purse: Purse, price: Partial<Purse>): Purse | null {
  const need = worth(price);
  if (hasPurse(purse, price)) return { rice: price.rice ?? 0, cloth: price.cloth ?? 0, coin: price.coin ?? 0 };
  if (worth(purse) < need) return null;
  let best: Purse | null = null;
  let bestOver = Infinity;
  let bestCount = Infinity;
  for (let rice = 0; rice <= purse.rice; rice++) {
    for (let cloth = 0; cloth <= purse.cloth; cloth++) {
      const goods = rice * BALANCE.riceCoin + cloth * BALANCE.clothCoin;
      const coin = Math.max(0, need - goods);
      if (coin > purse.coin) continue;
      const over = goods + coin - need;
      const count = rice + cloth + coin;
      if (over < bestOver || (over === bestOver && count < bestCount)) {
        best = { rice, cloth, coin };
        bestOver = over;
        bestCount = count;
      }
      if (goods >= need) break;
    }
  }
  return best;
}

export function canAfford(purse: Purse, price: Partial<Purse>): boolean {
  return fairHand(purse, price) !== null;
}

// ── 되팔기(5.6의 1번) ──────────────────────────────────────────

/** 되팔아 받는 닢 꼴: 부른 값과 산 값 가운데 작은 것(산 값보다 비싸게 되팔 수 없다) */
export function resale(bought: Partial<Purse> | number, offer: Partial<Purse> | number): number {
  const paid = typeof bought === 'number' ? bought : worth(bought);
  const asked = typeof offer === 'number' ? offer : worth(offer);
  return Math.max(0, Math.min(paid, asked));
}

/** 되판 뒤의 주머니(그 시대의 돈으로 받는다) */
export function sell(purse: Purse, bought: Partial<Purse> | number, offer: Partial<Purse> | number, story: string): Purse {
  return addPurse(purse, moneyFor(resale(bought, offer), story));
}

// ── 받는 돈 ────────────────────────────────────────────────────

/**
 * 에피소드를 처음 깼을 때 받는 돈: 에피소드 표의 rewards.purse(있으면 그대로), 없으면 ①의 어림(쌀 6되 · 베 3자, 39닢 꼴)에
 * 이야기 배수를 곱해 그 시대의 돈으로(⑤~⑦은 엽전).
 */
export function episodePurse(episode: Pick<Episode, 'rewards' | 'story'>, story: string = episode.story): Purse {
  const given = episode.rewards.purse;
  if (worth(given) > 0) return { ...given };
  const mul = storyMul(story);
  if (eraMoney(story) === 'coin') {
    return { rice: 0, cloth: 0, coin: Math.round((BALANCE.episodeRice * BALANCE.riceCoin + BALANCE.episodeCloth * BALANCE.clothCoin) * mul) };
  }
  return { rice: Math.round(BALANCE.episodeRice * mul), cloth: Math.round(BALANCE.episodeCloth * mul), coin: 0 };
}

/** (정함) 서당 한 판의 돈: 10닢 꼴을 가 본 가장 늦은 시대의 돈으로. 같은 날 같은 주제의 몫(1 · 0.5 · 0)을 경험치와 같이 따른다 */
export function seodangPurse(latest: string, share = 1): Purse {
  return moneyFor(BALANCE.quizCoin * Math.max(0, share), latest);
}

/** 마을 소개의 첫 선물: 쌀 3되 · 베 2자 */
export function introGift(): Purse {
  return { rice: BALANCE.giftRice, cloth: BALANCE.giftCloth, coin: 0 };
}
