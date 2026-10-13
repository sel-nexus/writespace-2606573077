/** Run isolated browser-like component and domain tests. */
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom', setupFiles: ['./src/test/setup.js'],
    include: ['src/test/**/*.test.{js,jsx}'],
    pool: 'forks', poolOptions: { forks: { singleFork: true } },
    coverage: { provider: 'v8', include: ['src/utils/*.js', 'src/components/*.jsx', 'src/pages/*.jsx', 'src/App.jsx'] }
  }
});
