// 1. 제목 — 시작하기, 수첩, 선생님 자료. 수첩과 선생님 자료는 1-나에서 만든다.

import type { JSX } from 'preact';
import { Picture } from '../art/Picture';
import { goPick } from '../state/store';

export function Title(): JSX.Element {
  return (
    <main class="screen title">
      <div class="title-art">
        <Picture season="spring" place="village" label="느티나무가 선 마을 어귀" />
      </div>
      <div class="title-box">
        <p class="kicker">조선 시대 마을 느티골 이야기</p>
        <h1 class="title-name">
          조선에서
          <br />한 해 살기
        </h1>
        <p class="title-lead">
          열다섯 살이 되어 봄, 여름, 가을, 겨울을 살아 보아요. 내가 고르는 대로 한 해가 흘러가요.
        </p>
        <div class="title-buttons">
          <button type="button" class="btn primary" onClick={goPick}>
            시작하기
          </button>
          <button type="button" class="btn" disabled>
            수첩 <span class="soon">준비 중</span>
          </button>
          <button type="button" class="btn" disabled>
            선생님 자료 <span class="soon">준비 중</span>
          </button>
        </div>
      </div>
    </main>
  );
}
