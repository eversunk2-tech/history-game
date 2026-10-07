// 5-라. 계절 닫기 — 이 계절에 고른 일과 수치가 어떻게 바뀌었나.

import type { JSX } from 'preact';
import { Picture } from '../art/Picture';
import { seasonLabels } from '../content/labels';
import { summarizeSeason } from '../engine/review';
import { SEASONS, type GameState, type SituationPack } from '../engine/types';
import { nextNow } from '../state/store';
import { Changes } from '../ui/Changes';
import { Split } from '../ui/Split';
import { josa, ro } from '../ui/words';

export function SeasonClose({ game }: { pack: SituationPack; game: GameState }): JSX.Element {
  const summary = summarizeSeason(game, game.seasonIndex);
  const label = seasonLabels[summary.season].label;
  const nextSeason = SEASONS[game.seasonIndex + 1];
  return (
    <Split art={<Picture season={summary.season} place="village" people={[game.role]} label={`${label}의 느티골`} />}>
      <p class="kicker">계절이 바뀌어요</p>
      <h1 class="screen-title">{josa(label, '을', '를')} 보냈다</h1>
      <div class="close-list">
        <span class="box-head">{label}에 내가 고른 일</span>
        <ul>
          {summary.turns.map((turn) => (
            <li key={turn.sceneId}>{turn.label}</li>
          ))}
        </ul>
      </div>
      <div class="close-changes">
        <span class="box-head">{label} 동안 달라진 것</span>
        <Changes
          requested={summary.delta}
          delta={summary.delta}
          before={summary.start}
          after={summary.end}
          emptyText="처음과 같아요. 살림도 기력도 인심도 그대로예요."
        />
      </div>
      <button type="button" class="btn primary push-down" onClick={nextNow}>
        {nextSeason ? `${ro(seasonLabels[nextSeason].label)} 가기` : '한 해 돌아보기'}
      </button>
    </Split>
  );
}
