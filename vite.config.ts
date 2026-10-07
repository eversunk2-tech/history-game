import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';

// 서버 없이 도는 정적 사이트. 빌드 결과(dist)를 어느 폴더에 두어도 열리도록 상대 경로를 쓴다.
export default defineConfig({
  base: './',
  plugins: [preact()],
  server: { port: 5173, strictPort: true },
  preview: { port: 4173 },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
