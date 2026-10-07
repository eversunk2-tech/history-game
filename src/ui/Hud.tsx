// 위쪽 띠: 계절 띠 + 지금 어디의 누구인지 + 수치 세 개.

import type { JSX } from 'preact';
import { drawLabels, seasonLabels } from '../content/labels';
import { SEASONS, STATS, type GameState, type SituationPack } from '../engine/types';
import { askHome } from '../state/store';
import { Meter } from './Meter';

/**
 * 계절 띠. 지금 계절은 굵은 테두리와 ● 표시로, 지나간 계절은 채운 바탕과 · 표시로 알린다.
 * (맞음 표시로 읽힐 수 있는 ✓는 쓰지 않는다.)
 */
function SeasonBand({ current }: { current: number }): JSX.Element {
  return (
    <ol class="season-band" aria-label="한 해의 계절">
      {SEASONS.map((season, index) => {
        const now = index === current;
        const past = index < current;
        return (
          <li
            key={season}
            class={`season-chip season-${season}${now ? ' now' : ''}${past ? ' past' : ''}`}
            aria-current={now ? 'step' : undefined}
          >
            <span class="season-mark" aria-hidden="true">
              {now ? '●' : past ? '·' : ''}
            </span>
            {seasonLabels[season].label}
            {past && <span class="visually-hidden"> (지나감)</span>}
          </li>
        );
      })}
    </ol>
  );
}

export function Hud({ pack, game }: { pack: SituationPack; game: GameState }): JSX.Element {
  const { situation } = pack;
  const draw = game.draw ? drawLabels[situation.draw.kind]?.values[game.draw] : undefined;
  return (
    <header class="hud">
      <SeasonBand current={game.seasonIndex} />
      <div class="hud-who">
        <span class="hud-year">{situation.year}년 느티골</span>
        <span class="hud-role">{situation.roles[game.role].label}</span>
        {draw && <span class="hud-draw">{draw.label}</span>}
      </div>
      <div class="hud-meters">
        {STATS.map((stat) => (
          <Meter key={stat} stat={stat} value={game.stats[stat]} />
        ))}
      </div>
      <button type="button" class="hud-home" onClick={askHome}>
        처음으로
      </button>
    </header>
  );
}
