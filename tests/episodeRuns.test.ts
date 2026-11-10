// ①-1 무작위 판(spec 11.1 사의 ㉡ 칸 "①-1 무작위 1,000판 × 두 모습"): 실제 내용(src/content의 s1395 묶음·에피소드 표·고비·카드·장비·
// 이야기 문제 20)으로 현장(아무렇게나 걷기) → 작은 고비 「굳은 논흙」 → "큰 고비로" → 「도깨비의 내기」 → 결과까지를
// 흉내 낸 맞힘 비율(모두 맞힘 ~ 모두 틀림)과 카드 내는 차례로 돈다. 오류 0, 모든 판이 끝남, 별 셋의 길과 구해 줌의 길이 다 있음.
// 내용 파일이 없으면 건너뛴다(엔진 시험은 fixtures4로 따로 돈다).

import { describe, expect, it } from 'vitest';
import { getPack } from '../src/content';
import { s1395_1 } from '../src/content/episodes/s1395';
import { battleResult, type BattleResult } from '../src/engine/battle';
import {
  battleSetupFor,
  beginEpisode,
  canBoss,
  doField,
  fieldPack,
  finishEpisode,
  minorBefore,
  minorDone,
  toBoss,
  toResult,
} from '../src/engine/episode';
import { LEVEL_CAP_41, newHero } from '../src/engine/growth';
import { battleAsk, battleReady, recordAnswers } from '../src/engine/quiz';
import { mulberry32, pickOne } from '../src/engine/rng';
import type { SituationPack } from '../src/engine/types';
import type { Foe, Gear, Question, SkillCard } from '../src/engine/types4';
import { movesOf } from './fixtures';
import { autoBattle, type CardOrder } from './fixtures4';

const foeMods = import.meta.glob('../src/content/foes.ts', { eager: true }) as Record<string, { foes?: Foe[] }>;
const cardMods = import.meta.glob('../src/content/skills.ts', { eager: true }) as Record<string, { skills?: SkillCard[] }>;
const gearMods = import.meta.glob('../src/content/gear.ts', { eager: true }) as Record<string, { gear?: Gear[] }>;
const questionMods = import.meta.glob('../src/content/situations/s1395/questions.ts', { eager: true }) as Record<string, { storyQuestions?: Question[] }>;

const foes = Object.values(foeMods)[0]?.foes ?? [];
const skills = Object.values(cardMods)[0]?.skills ?? [];
const gear = Object.values(gearMods)[0]?.gear ?? [];
const questions = Object.values(questionMods)[0]?.storyQuestions ?? [];
const ready = foes.length > 0 && skills.length > 0 && questions.length > 0;

const RUNS = 1000;
const RATES = [1, 0.85, 0.7, 0.5, 0.3, 0];
const ORDERS: CardOrder[] = ['first', 'strong', 'weak', 'random'];

describe.skipIf(!ready)('①-1 무작위 판 — 실제 내용으로', () => {
  for (const look of ['boy', 'girl'] as const) {
    it(`${look}: ${RUNS}판이 오류 없이 끝나고, 별 셋과 구해 줌의 길이 다 있다`, () => {
      const pack = getPack('s1395') as SituationPack;
      const episode = s1395_1;
      const lib = { foes, cards: skills, gear };
      const tools = gear.filter((g) => g.eras.includes('s1395')).map((g) => g.id);
      const ends: Record<string, number> = {};
      const turns: number[] = [];
      let three = 0;
      let longest = 0;
      for (let run = 0; run < RUNS; run++) {
        const seed = run * 7919 + (look === 'boy' ? 1 : 2);
        const rng = mulberry32(seed);
        const rate = RATES[run % RATES.length];
        const order = ORDERS[Math.floor(run / RATES.length) % ORDERS.length];
        const hand = rng() < 0.7 ? pickOne(rng, tools) : undefined;
        const hero = { ...newHero(look), gear: hand ? { hand } : {} };
        let cur = beginEpisode(pack, episode, { role: 'farmer', look, seed, replay: false });
        const asked: { q: string; right: boolean }[] = [];
        for (let step = 0; step < 40; step++) {
          const moves = movesOf(fieldPack(pack, episode), cur.game);
          const closable = canBoss(pack, episode, cur.game);
          if (closable && (moves.length === 0 || rng() < 0.35)) break;
          expect(moves.length, `막다른 길: ${cur.game.done.join(',')}`).toBeGreaterThan(0);
          const move = pickOne(rng, moves);
          const minor = minorBefore(episode, move.id, cur.minors);
          if (minor) {
            const ask = battleAsk({ questions, logs: {}, episode, seed });
            const fight = autoBattle(battleSetupFor(lib, episode, minor, { hero, game: cur.game }), ask, { order, rightRate: rate, seed });
            expect(fight.mismatches).toEqual([]);
            expect(fight.battle.turn).toBeLessThanOrEqual(3);
            asked.push(...fight.battle.asked);
            cur = minorDone(cur, minor.id);
          }
          cur = doField(pack, episode, cur, move);
        }
        expect(canBoss(pack, episode, cur.game)).toBe(true);
        cur = toBoss(pack, episode, cur);
        const ask = battleAsk({ questions, logs: {}, episode, seed: seed + 1 });
        const fight = autoBattle(battleSetupFor(lib, episode, 'boss', { hero, game: cur.game }), ask, { order, rightRate: rate, seed });
        expect(fight.mismatches).toEqual([]);
        const boss = battleResult(fight.battle) as BattleResult;
        expect(boss.turns).toBeLessThanOrEqual(16);
        expect(boss.stars[0]).toBe(true);
        for (const a of fight.battle.asked) {
          const q = questions.find((x) => x.id === a.q);
          expect(q && battleReady(q), a.q).toBe(true);
        }
        asked.push(...fight.battle.asked);
        ends[boss.end] = (ends[boss.end] ?? 0) + 1;
        turns.push(boss.turns);
        longest = Math.max(longest, boss.turns);
        if (boss.stars.every(Boolean)) three++;
        const out = finishEpisode({
          episode,
          replay: false,
          game: cur.game,
          minors: cur.minors,
          boss,
          hero,
          purse: { rice: 3, cloth: 2, coin: 0 },
          items: [],
          today: undefined,
          date: '2026-11-07',
          cap: LEVEL_CAP_41,
        });
        expect(out.story.episodes['s1395-1'].cleared).toBe(true);
        expect(out.paper.xp).toBeGreaterThanOrEqual(80 + 30);
        expect(out.purse).toEqual({ rice: 9, cloth: 5, coin: 0 });
        const quiz = recordAnswers({}, asked, questions);
        expect(Object.keys(quiz).every((t) => t === 'ep-s1395-1')).toBe(true);
        cur = toResult(cur, out.paper);
        expect(cur.phase).toBe('result');
      }
      expect(three).toBeGreaterThan(0);
      expect(ends.rescue ?? 0).toBeGreaterThan(0);
      expect(ends.win ?? 0).toBeGreaterThan(0);
      expect(longest).toBeLessThanOrEqual(16);
    });
  }
});
