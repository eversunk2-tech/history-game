// 4. 나를 소개합니다 — 집과 식구, 시작 수치, 올해의 바람 한 가지.

import type { JSX } from 'preact';
import { Picture } from '../art/Picture';
import { STATS, type GameState, type SituationPack } from '../engine/types';
import { beginYear } from '../state/store';
import { Meter } from '../ui/Meter';
import { Split } from '../ui/Split';

export function Intro({ pack, game }: { pack: SituationPack; game: GameState }): JSX.Element {
  const { situation } = pack;
  const role = situation.roles[game.role];
  return (
    <main class="screen intro">
      <Split art={<Picture season="spring" place="yard" people={[game.role]} label={`${role.label}의 집 마당`} />}>
        <p class="kicker">
          {situation.year}년 느티골 · {role.label}
        </p>
        <h1 class="screen-title">나를 소개합니다</h1>
        <p class="story">{role.intro}</p>
        <div class="intro-meters" aria-label="한 해를 시작할 때의 형편">
          {STATS.map((stat) => (
            <Meter key={stat} stat={stat} value={game.stats[stat]} about />
          ))}
        </div>
        <div class="wish-box">
          <span class="box-head">올해의 바람</span>
          <p class="wish-text">{role.wish}</p>
        </div>
        <button type="button" class="btn primary push-down" onClick={beginYear}>
          한 해 시작하기
        </button>
      </Split>
    </main>
  );
}
