module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
  },
  extends: [
    'plugin:vue/vue3-recommended',
    '@vue/airbnb',
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  rules: {
    'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    'vue/multi-word-component-names': 'off',
    'vue/no-setup-props-destructure': 'off',
    'import/no-unresolved': 'off',
    'import/extensions': 'off',
    'no-param-reassign': ['error', { props: false }],
    'no-underscore-dangle': 'off',
    'max-len': ['warn', { code: 150 }],
    'vuejs-accessibility/click-events-have-key-events': 'off',
    'vuejs-accessibility/anchor-has-content': 'off',
    'object-property-newline': 'off',
    'object-curly-newline': 'off',
    'vue/singleline-html-element-content-newline': 'off',
    'vue/multiline-html-element-content-newline': 'off',
    'func-names': 'off',
  },
  globals: {
    window: true,
    document: true,
  },
};
