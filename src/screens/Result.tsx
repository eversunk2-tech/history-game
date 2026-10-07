// 5-다. 결과와 배움 쪽지 — 고른 일의 결과, 수치 변화(화살표와 글), 얻은 카드, 배움 쪽지.
// 맞고 틀림을 말하지 않는다. 일어난 일만 보여 준다.

import type { JSX } from 'preact';
import { Picture } from '../art/Picture';
import { cardById } from '../content/cards';
import { placeLabel } from '../content/labels';
import { currentScene, lastTurn } from '../engine/game';
import type { GameState, SituationPack } from '../engine/types';
import { nextNow } from '../state/store';
import { Changes } from '../ui/Changes';
import { Split } from '../ui/Split';

export function Result({ pack, game }: { pack: SituationPack; game: GameState }): JSX.Element | null {
  const scene = currentScene(pack, game);
  const turn = lastTurn(game);
  if (!scene || !turn) return null;
  const cardTitles = turn.newCards.map((id) => cardById(id)?.title ?? id);
  return (
    <Split
      art={
        <Picture
          season={scene.season}
          place={scene.place}
          people={[game.role]}
          label={`${placeLabel(scene.place)} 그림`}
        />
      }
    >
      <p class="picked">
        <span class="box-head">내가 고른 일</span>
        {turn.label}
      </p>
      <p class="story">{turn.result}</p>
      <Changes requested={turn.requested} delta={turn.delta} before={turn.before} after={turn.after} />
      {cardTitles.length > 0 && (
        <p class="gain">
          <span class="box-head">새 생활 카드</span>
          {cardTitles.join(', ')}
        </p>
      )}
      <aside class="note">
        <span class="box-head">배움 쪽지</span>
        <p>{turn.note}</p>
      </aside>
      <button type="button" class="btn primary push-down" onClick={nextNow}>
        다음
      </button>
    </Split>
  );
}
