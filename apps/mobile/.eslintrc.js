module.exports = {
  root: true,
  extends: '@react-native',
  // Munim rule (see root AGENTS.md): `any`/`unknown` are banned. The no-unsafe-*
  // rules are type-aware and need the TS project — but they can only run on
  // TS/TSX files: @react-native's config parses .js files with @babel/eslint-parser,
  // which doesn't forward `parserOptions.project` (linting .eslintrc.js etc. would
  // crash). Scoping to TS/TSX via overrides keeps both working.
  overrides: [
    {
      files: ['*.ts', '*.tsx'],
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: __dirname,
      },
      rules: {
        '@typescript-eslint/no-explicit-any': 'error',
        '@typescript-eslint/no-unsafe-assignment': 'error',
        '@typescript-eslint/no-unsafe-member-access': 'error',
        '@typescript-eslint/no-unsafe-call': 'error',
        '@typescript-eslint/no-unsafe-return': 'error',
        '@typescript-eslint/no-unsafe-argument': 'error',
      },
    },
  ],
};
