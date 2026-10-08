import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';

// 판 번호(저장에 적히고 제목 화면 귀퉁이에 보인다): 빌드한 날짜와 시각. 개발 서버와 시험에서는 'dev'.
function stamp(): string {
  const d = new Date();
  const two = (n: number): string => String(n).padStart(2, '0');
  return `1c-${d.getFullYear()}${two(d.getMonth() + 1)}${two(d.getDate())}-${two(d.getHours())}${two(d.getMinutes())}`;
}

// 서버 없이 도는 정적 사이트. 빌드 결과(dist)를 어느 폴더에 두어도 열리도록 상대 경로를 쓴다.
export default defineConfig(({ command }) => ({
  // 코드에서는 import.meta.env.VITE_BUILD로 읽는다(src/state/storage.ts의 BUILD)
  define: command === 'build' ? { 'import.meta.env.VITE_BUILD': JSON.stringify(stamp()) } : {},
  base: './',
  plugins: [preact()],
  server: { port: 5173, strictPort: true },
  preview: { port: 4173 },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
}));
