// 새 판 알아차리기(spec 5.4 "새 판이 올라올 때", 10절).
// 태블릿은 게임을 닫지 않고 덮어만 두는 일이 많다. 화면이 30분 넘게 가려졌다 돌아왔는데 그사이 새 판이 올라와 있으면,
// 저장한 뒤 조용히 다시 불러온다(학생에게는 제목 화면이 보이고 "이어 하기"를 누르면 하던 자리다).
// 하던 도중에는 아무 일도 일어나지 않는다: 알림도 물음도 없다. 대화나 일 놀이 중이면 맵으로 돌아온 뒤에 한다.
// 새 판인지는 따로 만든 파일 없이, 첫 문서를 담아 두지 않고 다시 받아 그 안의 코드 파일 이름을 지금 돌고 있는 것과 견주어 안다.
// 인터넷이 끊겼거나 받기에 실패하면 아무것도 하지 않는다. 서비스 워커는 쓰지 않는다.

import { saveNow, talk } from './store';

/** 이만큼 넘게 가려졌다 돌아왔을 때만 본다(가정: 30분) */
export const AWAY_MS = 30 * 60 * 1000;

/** 첫 문서(index.html)의 글에서 코드 파일의 이름을 찾는다: "assets/index-ab12CD.js". 없으면 null. */
export function scriptNameIn(html: string): string | null {
  const found = /assets\/(index-[A-Za-z0-9_-]+\.js)/.exec(html);
  return found ? found[1] : null;
}

/** 다시 받은 첫 문서가 지금 돌고 있는 것과 다른 판을 가리키는가. 어느 한쪽이라도 이름을 모르면 아니라고 본다. */
export function isNewBuild(runningSrc: string | null, freshHtml: string): boolean {
  const running = runningSrc ? scriptNameIn(runningSrc) : null;
  const fresh = scriptNameIn(freshHtml);
  return running !== null && fresh !== null && running !== fresh;
}

/** 가려졌다 돌아온 시각으로 볼 때 새 판을 살필 때인가 */
export function awayLongEnough(hiddenAt: number | null, now: number): boolean {
  return hiddenAt !== null && now - hiddenAt >= AWAY_MS;
}

/** 지금 돌고 있는 코드 파일의 주소(빌드본에서만 이름에 해시가 붙는다) */
function runningScript(): string | null {
  const el = document.querySelector<HTMLScriptElement>('script[type="module"][src*="assets/index-"]');
  return el?.getAttribute('src') ?? null;
}

let started = false;

/** 앱이 뜰 때 한 번 부른다 */
export function watchForNewBuild(): void {
  if (started || typeof document === 'undefined') return;
  started = true;
  let hiddenAt: number | null = null;
  let waiting = false;

  const reloadWhenSafe = (): void => {
    if (waiting) return;
    waiting = true;
    let done = false;
    // 대화 장면이나 일 놀이가 떠 있으면 맵으로 돌아올 때까지 기다린다.
    // 저장과 다시 불러오기는 신호의 셈이 끝난 뒤에 한다(저장이 신호를 고치므로 지켜보는 자리 안에서 하지 않는다).
    talk.subscribe((now) => {
      if (now !== null || done) return;
      done = true;
      window.setTimeout(() => {
        saveNow();
        window.location.reload();
      }, 0);
    });
  };

  const check = async (): Promise<void> => {
    const running = runningScript();
    if (!running || navigator.onLine === false) return;
    try {
      const res = await fetch(document.baseURI.split(/[?#]/)[0], { cache: 'no-store' });
      if (!res.ok) return;
      if (isNewBuild(running, await res.text())) reloadWhenSafe();
    } catch {
      // 받지 못했으면 아무것도 하지 않는다(하던 판은 끝까지 간다)
    }
  };

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      hiddenAt = Date.now();
      return;
    }
    const long = awayLongEnough(hiddenAt, Date.now());
    hiddenAt = null;
    if (long) void check();
  });
}
