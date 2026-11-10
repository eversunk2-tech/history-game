// 5. 알림판(spec 11.1 가 5·16): 의뢰 종이. ①-1을 깨기 전에는 「새 도읍의 봄」, 깬 뒤에는 "①-2 「단오와 김매기」 — 곧 열려요".
// 작은 의뢰("도구점에서 연장 하나 사 보기", "서당에서 「조선의 건국과 한양」 한 판")는 ㉣(도구점·서당이 열릴 때)에 붙인다.

import type { JSX } from 'preact';
import { board, notices } from '../content/hub';
import type { BoardNote } from '../engine/types4';
import { backToHub, episodeOf, openFacility, save } from '../state/store';
import { HubBand } from '../ui/HubBand';

/** 지금 붙어 있는 의뢰 종이(작은 의뢰는 ㉣) */
export function boardNotes(cleared: (episode: string) => boolean): BoardNote[] {
  return board.filter((note) => {
    if (note.kind !== 'request') return false;
    const key = note.after ?? note.episode;
    if (!key || note.when === 'always') return true;
    return note.when === 'before' ? !cleared(key) : cleared(key);
  });
}

export function Board(): JSX.Element {
  const s = save.value;
  const cleared = (id: string): boolean => {
    const ep = episodeOf(id);
    return Boolean(ep && s.stories[ep.story]?.episodes[id]?.cleared);
  };
  const notes = boardNotes(cleared);
  return (
    <main class="screen hub board season-spring">
      <HubBand title="알림판" onBack={backToHub} />
      <div class="hub-stage">
        <section class="board-wall" aria-label="알림판의 종이">
          {notes.map((note) => {
            const ep = note.episode ? episodeOf(note.episode) : undefined;
            return (
              <article key={note.id} class={`paper board-note${ep ? '' : ' soon-note'}`}>
                <p class="paper-kicker">의뢰</p>
                <h2 class="paper-title">「{note.title}」</h2>
                <p class="board-text">{note.text}</p>
                {ep && (
                  <>
                    <p class="board-when">
                      {ep.when} · 권장 레벨 {ep.level}
                    </p>
                    <button type="button" class="btn primary" onClick={() => openFacility('gate')}>
                      시간의 문으로 ▶
                    </button>
                  </>
                )}
                {!ep && !note.text.includes(notices.soon) && <span class="soon">{notices.soon}</span>}
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}
