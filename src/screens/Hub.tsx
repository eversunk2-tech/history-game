// 4. 거점 — ㉢의 임시 마을 종이(spec 11.1 가 4): 느티나무 마을의 시설 목록 한 장. ㉣에서 48×36칸 거점 맵으로 바뀐다.
// 열리는 곳은 시간의 문·알림판 둘이다. 서당·도구점·「포목점·댕기방」과 나머지 여섯은 "곧 열려요"(㉣이 앞의 넷을 연다 — hub.ts의 open은 4-1 끝의 모습).
// 줄을 한 번 누르면 그 시설이 열린다(할 일 쪽지의 "두 번 누르면 걸어간다"(13.2의 22번)는 맵이 없는 종이에서는 한 번 누름으로 갈음한다).

import type { JSX } from 'preact';
import { PixelIcon } from '../art/PixelArt';
import { Scenery } from '../art/Scenery';
import { gear } from '../content/gear';
import { facilities, notices } from '../content/hub';
import { relics } from '../content/relics';
import type { FacilityId } from '../engine/types4';
import { openFacility, save } from '../state/store';
import { HubBand } from '../ui/HubBand';

/** ㉢의 임시 마을 종이에서 여는 곳(㉣에서 거점 맵과 함께 hub.ts의 open을 따른다) */
export const OPEN_NOW: readonly FacilityId[] = ['gate', 'board'];

/** 가진 것의 이름(장비·유물) */
export function itemName(id: string): string {
  return gear.find((g) => g.id === id)?.name ?? relics.find((r) => r.id === id)?.name ?? id;
}

export function Hub(): JSX.Element {
  const s = save.value;
  return (
    <main class="screen hub season-spring">
      <HubBand title="느티나무 마을" />
      <div class="hub-stage">
        <div class="hub-art" aria-hidden="true">
          <Scenery story="s1395" place="entrance" season="spring" />
        </div>
        <section class="paper hub-paper" aria-label="느티나무 마을의 시설">
          <h1 class="paper-title">느티나무 마을</h1>
          <p class="paper-small">시간 밖의 마을이에요. 가고 싶은 곳을 눌러요.</p>
          <ul class="hub-list">
            {facilities.map((f) => {
              const open = OPEN_NOW.includes(f.id);
              return (
                <li key={f.id}>
                  {open ? (
                    <button type="button" class={`hub-row open at-${f.id}`} onClick={() => openFacility(f.id as 'gate' | 'board')}>
                      <span class="hub-name">{f.name}</span>
                      <span class="hub-does">{f.does}</span>
                      <span class="hub-go" aria-hidden="true">
                        ▶
                      </span>
                    </button>
                  ) : (
                    <div class="hub-row shut" role="group" aria-label={`${f.name}, ${notices.soon}`}>
                      <span class="hub-name">{f.name}</span>
                      <span class="hub-does">{f.does}</span>
                      <span class="soon">{notices.soon}</span>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {s.items.length > 0 && (
            <p class="hub-have">
              <span class="box-head">가진 것</span>
              {s.items.map((id) => (
                <span key={id} class="hub-thing">
                  <PixelIcon name={id} size={32} />
                  {itemName(id)}
                </span>
              ))}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
