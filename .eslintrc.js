module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
    jest: true
  },
  extends: [
    'standard'
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  rules: {
    'indent': ['error', 2],
    'linebreak-style': ['error', 'unix'],
    'quotes': ['error', 'single'],
    'semi': ['error', 'always'],
    'no-unused-vars': ['warn', { 'argsIgnorePattern': '^_' }],
    'no-console': 'warn',
    'prefer-const': 'error',
    'no-var': 'error'
  },
  globals: {
    'require': 'readonly',
    'module': 'readonly',
    'exports': 'readonly',
    '__dirname': 'readonly',
    '__filename': 'readonly',
    'process': 'readonly',
    'Buffer': 'readonly',
    'global': 'readonly'
  }
}; 