/* JS lint – Node + ESM */
module.exports = {
  root: true,
  env: { node: true, es2022: true },
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  extends: ['eslint:recommended', 'plugin:import/recommended', 'plugin:n/recommended'],
  rules: {
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'import/order': ['warn', { 'newlines-between': 'always', alphabetize: { order: 'asc' } }],
    'n/no-missing-import': 'off', // ESM + aliasok miatt ne legyen téves riasztás
  },
  ignorePatterns: ['public/**', 'node_modules/**'],
};
