// 기기 저장. localStorage의 `joseon-year/v1` 하나에 아래 세 가지만 둔다(spec 10절).
//  - 해 본 조합(상황·역할·한 해 이름)
//  - 모은 카드
//  - 첫 판을 했는지
// 이름 같은 개인 정보는 받지도 두지도 않는다.
// 저장을 못 쓰는 환경(사생활 보호 창, 꽉 찬 저장소 등)에서도 게임은 돌아야 하므로
// 읽기와 쓰기는 모두 실패해도 조용히 넘어간다.

import { ROLE_IDS, type RoleId } from '../engine/types';

export const STORAGE_KEY = 'joseon-year/v1';

export interface PlayRecord {
  situation: string;
  role: RoleId;
  /** 한 해 이름의 id */
  yearName: string;
}

export interface Saved {
  plays: PlayRecord[];
  cards: string[];
  firstDone: boolean;
}

/** localStorage에서 쓰는 만큼만 */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function emptySaved(): Saved {
  return { plays: [], cards: [], firstDone: false };
}

/** 브라우저의 저장소. 쓸 수 없으면 null. */
export function browserStorage(): StorageLike | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

/** 저장된 글을 읽어 꼴을 맞춘다. 꼴이 어긋난 부분은 버린다. */
export function parseSaved(raw: string | null): Saved {
  if (!raw) return emptySaved();
  try {
    const data: unknown = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return emptySaved();
    const record = data as Record<string, unknown>;
    const plays: PlayRecord[] = [];
    if (Array.isArray(record.plays)) {
      for (const item of record.plays) {
        if (typeof item !== 'object' || item === null) continue;
        const play = item as Record<string, unknown>;
        if (
          typeof play.situation === 'string' &&
          typeof play.yearName === 'string' &&
          typeof play.role === 'string' &&
          (ROLE_IDS as readonly string[]).includes(play.role)
        ) {
          plays.push({ situation: play.situation, role: play.role as RoleId, yearName: play.yearName });
        }
      }
    }
    const cards = Array.isArray(record.cards)
      ? [...new Set(record.cards.filter((card): card is string => typeof card === 'string'))]
      : [];
    return { plays, cards, firstDone: record.firstDone === true || plays.length > 0 };
  } catch {
    return emptySaved();
  }
}

export function loadSaved(storage: StorageLike | null = browserStorage()): Saved {
  if (!storage) return emptySaved();
  try {
    return parseSaved(storage.getItem(STORAGE_KEY));
  } catch {
    return emptySaved();
  }
}

/** 저장했으면 true. 못 했어도 던지지 않는다. */
export function writeSaved(saved: Saved, storage: StorageLike | null = browserStorage()): boolean {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(saved));
    return true;
  } catch {
    return false;
  }
}

/** 카드를 더한다(겹치면 한 번만). */
export function withCards(saved: Saved, cards: readonly string[]): Saved {
  const fresh = cards.filter((card) => !saved.cards.includes(card));
  if (fresh.length === 0) return saved;
  return { ...saved, cards: [...saved.cards, ...fresh] };
}

/** 한 판을 마친 것을 적는다. 같은 조합은 한 번만 남긴다. */
export function withPlay(saved: Saved, play: PlayRecord): Saved {
  const seen = saved.plays.some(
    (p) => p.situation === play.situation && p.role === play.role && p.yearName === play.yearName,
  );
  return {
    ...saved,
    plays: seen ? saved.plays : [...saved.plays, play],
    firstDone: true,
  };
}
