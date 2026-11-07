import tseslint from 'typescript-eslint';
export default tseslint.config(
  { ignores: ['node_modules/**', 'dist/**', 'scripts/**', 'vendor/**', 'examples/**', 'outputs/**', 'work/**', 'app/chatgpt-auth.ts', 'db/**', '.openai/**'] },
  ...tseslint.configs.recommended,
  { rules: { '@typescript-eslint/no-explicit-any': 'off', '@typescript-eslint/no-unused-vars': 'off' } },
);
