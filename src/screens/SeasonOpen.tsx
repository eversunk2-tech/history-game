// 5-가. 계절 열기 — 그림과 한 줄. 뽑기를 하는 계절이면 뽑힌 것을 보여 준다.

import type { JSX } from 'preact';
import { Picture } from '../art/Picture';
import { drawLabels, seasonLabels } from '../content/labels';
import { currentSeason } from '../engine/game';
import type { GameState, SituationPack } from '../engine/types';
import { nextNow } from '../state/store';
import { Split } from '../ui/Split';

export function SeasonOpen({ pack, game }: { pack: SituationPack; game: GameState }): JSX.Element {
  const { situation } = pack;
  const season = currentSeason(game);
  const info = seasonLabels[season];
  const drawKind = drawLabels[situation.draw.kind];
  const drawn =
    situation.draw.season === season && game.draw && drawKind ? { title: drawKind.title, ...drawKind.values[game.draw] } : null;
  return (
    <Split art={<Picture season={season} place="village" people={[game.role]} label={`${info.label}의 느티골`} />}>
      <p class="kicker">{situation.year}년 느티골</p>
      <h1 class="season-title">{info.label}</h1>
      <p class="story">{info.line}</p>
      {drawn && drawn.label && (
        <div class="draw-box">
          <span class="box-head">{drawn.title} 뽑기</span>
          <p class="draw-value">{drawn.label}</p>
          <p class="draw-line">{drawn.line}</p>
        </div>
      )}
      <button type="button" class="btn primary push-down" onClick={nextNow}>
        {info.label} 이야기 보기
      </button>
    </Split>
  );
}
