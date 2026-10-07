// 5-나. 장면과 고르기 — 왼쪽 그림, 오른쪽 지문과 선택지.

import type { JSX } from 'preact';
import { Picture } from '../art/Picture';
import { placeLabel, seasonLabels } from '../content/labels';
import { choiceViews, currentScene, currentText } from '../engine/game';
import type { GameState, SituationPack } from '../engine/types';
import { chooseNow } from '../state/store';
import { ChoiceButton } from '../ui/ChoiceButton';
import { Split } from '../ui/Split';

export function SceneScreen({ pack, game }: { pack: SituationPack; game: GameState }): JSX.Element | null {
  const scene = currentScene(pack, game);
  if (!scene) return null;
  const views = choiceViews(pack, game);
  const where = placeLabel(scene.place);
  return (
    <Split art={<Picture season={scene.season} place={scene.place} people={[game.role]} label={`${where} 그림`} />}>
      <p class="kicker">
        {seasonLabels[scene.season].label}의 {game.slot === 0 ? '첫' : '두'} 번째 일 ·{' '}
        {scene.kind === 'world' ? '마을에 닥친 일' : '우리 집 일'}
      </p>
      <p class="story">{currentText(pack, game)}</p>
      <div class="choices" role="group" aria-label="어떻게 할까요?">
        <p class="choices-ask">어떻게 할까?</p>
        {views.map((view) => (
          <ChoiceButton key={view.id} view={view} onPick={() => chooseNow(view.id)} />
        ))}
      </div>
    </Split>
  );
}
