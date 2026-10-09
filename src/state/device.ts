// 기기와 홈 화면 가리기(spec 10절 "태블릿과 홈 화면").
// 홈 화면의 아이콘으로 열렸는지, 갤럭시탭(안드로이드 크롬)인지 아이패드인지를 가린다.
// 기기의 갈래는 안내 문구를 고르고 세로 안내를 띄우는 데만 쓴다. 게임의 규칙은 기기를 모른다.

import { signal } from '@preact/signals';

/** android: 갤럭시탭 등 안드로이드의 크롬 · ipad: 아이패드(와 아이폰) · other: PC, TV, 그 밖 */
export type DeviceKind = 'android' | 'ipad' | 'other';

/**
 * 기기의 갈래. 태블릿의 브라우저는 "데스크톱 사이트"로 열면 컴퓨터라고 말한다. 그때는 손가락 닿는 점으로 가려낸다.
 *  - 아이패드는 맥이라고 말한다(Macintosh). 손가락 점이 여럿인 맥은 아이패드로 본다.
 *  - 큰 갤럭시탭의 크롬은 "데스크톱 사이트"를 기본으로 켜고 리눅스 컴퓨터라고 말한다(X11; Linux x86_64).
 *    손가락 점이 여럿인 리눅스는 갤럭시탭으로 본다. 크롬북은 CrOS라고 말하므로 걸리지 않고, 윈도 노트북도 걸리지 않는다.
 *    손가락이 닿는 리눅스 노트북은 갤럭시탭으로 잘못 가려질 수 있다 — 그때 뜨는 것은 닫을 수 있는 안내와,
 *    창을 세로로 길게 했을 때의 세로 안내뿐이다.
 */
export function kindOf(userAgent: string, maxTouchPoints: number): DeviceKind {
  if (/Android/i.test(userAgent)) return 'android';
  if (/iPad|iPhone|iPod/i.test(userAgent)) return 'ipad';
  if (/Macintosh/i.test(userAgent) && maxTouchPoints > 1) return 'ipad';
  if (/X11;\s*Linux/i.test(userAgent) && !/CrOS/i.test(userAgent) && maxTouchPoints > 1) return 'android';
  return 'other';
}

interface WindowLike {
  matchMedia?: (query: string) => { matches: boolean };
  navigator?: { standalone?: boolean };
}

/**
 * 홈 화면에서 열렸는가: 매니페스트의 화면 가득(fullscreen)이나 따로 뜬 앱(standalone)으로 열렸거나,
 * WebKit이 알려 주는 값(navigator.standalone)이 참이면 그렇다.
 */
export function standaloneOf(win: WindowLike): boolean {
  try {
    if (win.navigator?.standalone === true) return true;
    const mm = win.matchMedia;
    if (!mm) return false;
    return ['fullscreen', 'standalone', 'minimal-ui'].some((mode) => mm.call(win, `(display-mode: ${mode})`).matches);
  } catch {
    return false;
  }
}

/** 크롬 엔진이 "설치할 수 있다"고 알려 줄 때 오는 것(안드로이드 크롬). 쥐고 있다가 단추를 누르면 물음을 띄운다. */
interface InstallPromptEvent extends Event {
  prompt(): Promise<unknown>;
  userChoice?: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const hasWindow = typeof window !== 'undefined' && typeof navigator !== 'undefined';

export const deviceKind: DeviceKind = hasWindow ? kindOf(navigator.userAgent ?? '', navigator.maxTouchPoints ?? 0) : 'other';
/** 홈 화면의 아이콘으로 열렸는가 */
export const standalone = signal<boolean>(hasWindow ? standaloneOf(window as unknown as WindowLike) : false);
/** 브라우저가 설치 물음을 띄울 수 있다고 알려 왔는가(안드로이드 크롬에서만 온다) */
export const canPromptInstall = signal(false);
/** 방금 홈 화면에 추가되었는가 */
export const justInstalled = signal(false);

let stashed: InstallPromptEvent | null = null;

if (hasWindow && typeof window.addEventListener === 'function') {
  window.addEventListener('beforeinstallprompt', (ev) => {
    // 브라우저가 저절로 띄우는 작은 띠 대신 우리 안내의 단추로 띄운다
    ev.preventDefault();
    stashed = ev as InstallPromptEvent;
    canPromptInstall.value = true;
  });
  window.addEventListener('appinstalled', () => {
    stashed = null;
    canPromptInstall.value = false;
    justInstalled.value = true;
  });
  // 세로 안내는 손가락으로 쓰는 기기(태블릿)에서만 띄운다. CSS가 이 표시를 본다.
  if (deviceKind !== 'other' && typeof document !== 'undefined') document.documentElement.classList.add('is-tablet');
}

/** 설치 물음에 어떻게 답했는가: accepted 추가하겠다 · dismissed 그만두었다 · unavailable 물음을 띄울 수 없었다 */
export type InstallAnswer = 'accepted' | 'dismissed' | 'unavailable';

/** "홈 화면에 추가" 단추: 브라우저의 설치 물음을 띄우고 답을 돌려준다. */
export async function promptInstall(): Promise<InstallAnswer> {
  const ev = stashed;
  if (!ev) return 'unavailable';
  try {
    await ev.prompt();
    const choice = await ev.userChoice;
    // 물음은 한 번만 쓸 수 있다
    stashed = null;
    canPromptInstall.value = false;
    return choice?.outcome === 'accepted' ? 'accepted' : 'dismissed';
  } catch {
    return 'unavailable';
  }
}

/** 브라우저 탭으로 연 태블릿인가(홈 화면에 추가하라고 안내할 때) */
export function inTabOnTablet(): boolean {
  return deviceKind !== 'other' && !standalone.value;
}

export const KIND_LABELS: Record<DeviceKind, string> = {
  android: '갤럭시탭(안드로이드)',
  ipad: '아이패드',
  other: '컴퓨터·그 밖',
};

/** 브라우저가 이 저장을 지켜 주기로 했는가(들어줄지는 브라우저가 정한다). 알 수 없으면 null. */
export async function persistedNow(): Promise<boolean | null> {
  try {
    const storage = navigator.storage;
    if (!storage?.persisted) return null;
    return await storage.persisted();
  } catch {
    return null;
  }
}
