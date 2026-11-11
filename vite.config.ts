import { loadEnv, type Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';

// 판 번호(저장에 적히고 제목 화면 귀퉁이와 "이 기기" 줄에 보인다): 빌드한 날 + 커밋 앞 일곱 글자.
// 커밋 값은 Vercel이 빌드 때 주는 것(VERCEL_GIT_COMMIT_SHA)을 쓰고, 없으면(내 컴퓨터) 빌드한 시각을 붙인다.
// 개발 서버와 시험에서는 'dev'.
function stamp(commit: string | undefined): string {
  const d = new Date();
  const two = (n: number): string => String(n).padStart(2, '0');
  const day = `${d.getFullYear()}${two(d.getMonth() + 1)}${two(d.getDate())}`;
  const tail = commit && /^[0-9a-f]{7,}$/i.test(commit) ? commit.slice(0, 7) : `${two(d.getHours())}${two(d.getMinutes())}`;
  return `${day}-${tail}`;
}

// 첫 문서에서 바로 받기 시작할 파일(spec.md 4.3과 그 끝의 "고침"): 제목 그림과 주아(제목·단추·이름표의 글꼴).
// 게임은 코드가 돌아야 글자를 그리므로, 미리 받기 줄이 없는 파일은 코드를 다 받고 첫 화면을 그릴 때에야 받기 시작한다.
// 주아를 미리 받으면 제목이 처음부터 주아로 떠서 가장 큰 글자가 바뀌는 순간이 보이지 않는다(조정자가 정함, 2026-11-11).
// 고운바탕·Pretendard는 미리 받지 않는다 — 교실 와이파이 가정(10Mbps·왕복 40ms·CPU 4배 늦춤, spec.md 6.3)에서 잰 첫 그림(FCP):
//   지금 판 약 1.03초 / 글꼴 넷+그림 1.57초(늦다) / 주아+그림 약 1.03초(지금 판과 같다) / 그림만 0.90초 — 코드와 망을 나눠 쓰는 만큼 늦어진다.
//   둘은 첫 화면을 그릴 때 받기 시작하고(fonts.css, swap — 글은 먼저 보인다) 글꼴 셋이 다 쓰이는 때는 약 1.6초(지금 판 2.6초).
// 파일 이름에는 빌드 때 해시가 붙으므로, 빌드 결과에서 찾아 줄을 넣는다(새 꾸러미 없이 Vite의 transformIndexHtml만 쓴다).
// 하나라도 못 찾으면 빌드를 멈춘다(이름이 바뀌어 미리 받기가 조용히 빠지는 일이 없게). 개발 서버에서는 넣지 않는다.
export const FIRST_SCREEN: readonly { as: 'image' | 'font'; type: string; file: RegExp }[] = [
  { as: 'image', type: 'image/webp', file: /^assets\/title-dawn-[\w-]+\.webp$/ },
  { as: 'font', type: 'font/woff2', file: /^assets\/jua-2350-[\w-]+\.woff2$/ },
];

function preloadFirstScreen(): Plugin {
  return {
    name: 'joseon-preload-first-screen',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        const files = Object.keys(ctx.bundle ?? {});
        return FIRST_SCREEN.map((one) => {
          const file = files.find((name) => one.file.test(name));
          if (!file) throw new Error(`미리 받을 파일을 빌드 결과에서 찾지 못했다: ${one.file}`);
          const attrs: Record<string, string | boolean> = { rel: 'preload', as: one.as, type: one.type, href: `./${file}` };
          // 글꼴은 crossorigin이 있어야 CSS가 받는 것과 같은 것으로 쳐진다
          if (one.as === 'font') attrs.crossorigin = true;
          return { tag: 'link', attrs, injectTo: 'head' as const };
        });
      },
    },
  };
}

// 서버 없이 도는 정적 사이트. 빌드 결과(dist)를 어느 폴더에 두어도 열리도록 상대 경로를 쓴다.
export default defineConfig(({ command, mode }) => ({
  // 코드에서는 import.meta.env.VITE_BUILD로 읽는다(src/state/storage.ts의 BUILD)
  define: command === 'build' ? { 'import.meta.env.VITE_BUILD': JSON.stringify(stamp(loadEnv(mode, '.', 'VERCEL_GIT_COMMIT_SHA').VERCEL_GIT_COMMIT_SHA)) } : {},
  base: './',
  plugins: [preact(), preloadFirstScreen()],
  server: { port: 5173, strictPort: true },
  preview: { port: 4173 },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
}));
