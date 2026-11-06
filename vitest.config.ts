import { configDefaults, defineConfig } from 'vitest/config';

// Agent worktrees live under .claude/worktrees and carry their own copies of tests/.
export default defineConfig({ test: { exclude: [...configDefaults.exclude, '.claude/**'] } });
