// 선택지 단추. 잠긴 선택지는 숨기지 않고 흐리게 보여 주며 자물쇠 표시와 까닭 한 줄을 붙인다.

import type { JSX } from 'preact';
import type { ChoiceView } from '../engine/game';
import { LockIcon } from './icons';

export function ChoiceButton({ view, onPick }: { view: ChoiceView; onPick: () => void }): JSX.Element {
  if (view.locked) {
    return (
      <div class="choice locked" role="group" aria-label={`잠긴 선택지: ${view.label}`}>
        <span class="choice-text">
          <span class="choice-label">
            <LockIcon />
            <span>{view.label}</span>
          </span>
          <span class="choice-reason">{view.reason}</span>
        </span>
      </div>
    );
  }
  return (
    <button type="button" class="choice" onClick={onPick}>
      <span class="choice-text">
        <span class="choice-label">{view.label}</span>
      </span>
    </button>
  );
}
