import neo from 'neostandard';

export default [
  {
    ignores: [
      'public/**/*',
      'node_modules/**/*',
      'coverage/**/*'
    ]
  },
  ...neo({
    semi: true
  }),
  {
    // neostandard pins an older ecmaVersion, which rejects `using`/`await using` (ES2026).
    languageOptions: {
      ecmaVersion: 'latest'
    },
    rules: {
      '@stylistic/comma-dangle': ['error', {
        arrays: 'never',
        objects: 'never',
        imports: 'never',
        exports: 'never',
        functions: 'never'
      }],
      'max-len': ['error', {
        code: 120,
        tabWidth: 2,
        ignoreUrls: true,
        ignoreStrings: true,
        ignoreTemplateLiterals: true,
        ignoreRegExpLiterals: true,
        ignoreComments: true,
        ignoreTrailingComments: true
      }],
      '@stylistic/space-before-function-paren': 'off',
      camelcase: 'off'
    }
  },
  {
    // Os corpos passados a page.evaluate são serializados e executados no navegador,
    // não no Node. neostandard já conhece `document` e `window`; o resto do DOM que
    // os testes usam precisa ser declarado.
    files: ['tests/business/e2e/**/*.js'],
    languageOptions: {
      globals: {
        MutationObserver: 'readonly',
        getComputedStyle: 'readonly',
        localStorage: 'readonly',
        CustomEvent: 'readonly'
      }
    }
  }
];
