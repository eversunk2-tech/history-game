import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';

// 판 번호(저장에 적히고 제목 화면 귀퉁이와 "이 기기" 줄에 보인다): 빌드한 날 + 커밋 앞 일곱 글자.
// 커밋 값은 빌드하는 곳이 주는 것을 쓴다 — Cloudflare Pages의 CF_PAGES_COMMIT_SHA, 없으면 Vercel의 VERCEL_GIT_COMMIT_SHA,
// 둘 다 없으면(내 컴퓨터) 빌드한 시각을 붙인다. Cloudflare에서 main이 아닌 가지(미리 보기 — 예: v4-1)를 지으면 뒤에 가지 이름을 붙인다
// (예: 20261106-abc1234 · v4-1). 이름은 Cloudflare Pages 문서 "Build configuration"의 환경 변수 표(2026-11-06 다시 읽음).
// 개발 서버와 시험에서는 'dev'.
function stamp(commit: string | undefined, branch?: string): string {
  const d = new Date();
  const two = (n: number): string => String(n).padStart(2, '0');
  const day = `${d.getFullYear()}${two(d.getMonth() + 1)}${two(d.getDate())}`;
  const tail = commit && /^[0-9a-f]{7,}$/i.test(commit) ? commit.slice(0, 7) : `${two(d.getHours())}${two(d.getMinutes())}`;
  return `${day}-${tail}${branch && branch !== 'main' ? ` · ${branch}` : ''}`;
}

function buildStamp(mode: string): string {
  const env = loadEnv(mode, '.', ['CF_PAGES', 'VERCEL_GIT_COMMIT_SHA']);
  return stamp(env.CF_PAGES_COMMIT_SHA || env.VERCEL_GIT_COMMIT_SHA, env.CF_PAGES_BRANCH);
}

// 서버 없이 도는 정적 사이트. 빌드 결과(dist)를 어느 폴더에 두어도 열리도록 상대 경로를 쓴다.
export default defineConfig(({ command, mode }) => ({
  // 코드에서는 import.meta.env.VITE_BUILD로 읽는다(src/state/storage.ts의 BUILD)
  define: command === 'build' ? { 'import.meta.env.VITE_BUILD': JSON.stringify(buildStamp(mode)) } : {},
  base: './',
  plugins: [preact()],
  server: { port: 5173, strictPort: true },
  preview: { port: 4173 },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
}));
