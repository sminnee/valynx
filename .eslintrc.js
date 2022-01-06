module.exports = {
  root: true,
  env: {
    browser: true,
    amd: true,
    node: true,
  },
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint", "jsx-a11y"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:jsx-a11y/recommended",
    "plugin:react/recommended",
  ],
  rules: {
    // Our code currently doesn't comply with these recommended setings, in a future refactor we should clean these up
    "no-extra-boolean-cast": "off",
    "prefer-const": "off",
    "no-unused-vars": "off",
    "no-case-declarations": "off",
    "prefer-rest-params": "off",
    "no-var": "off",
    "no-async-promise-executor": "off",
    "no-constant-condition": "off",

    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-unused-vars": "off",
    "@typescript-eslint/no-non-null-assertion": "off",
    "@typescript-eslint/ban-types": "off",
    "@typescript-eslint/no-inferrable-types": "off",
    "@typescript-eslint/no-empty-function": "off",
    "@typescript-eslint/no-empty-interface": "off",
    "@typescript-eslint/no-var-requires": "off",
    "@typescript-eslint/no-this-alias": "off",

    "jsx-a11y/label-has-associated-control": "off",
    "jsx-a11y/click-events-have-key-events": "off",
    "jsx-a11y/no-static-element-interactions": "off",
    "jsx-a11y/no-noninteractive-element-interactions": "off",
    "jsx-a11y/no-autofocus": "off",

    "react/no-unescaped-entities": "off",
    "react/display-name": "off",
    "react/no-deprecated": "off",
    "react/jsx-key": "off",
    "react/prop-types": "off",
  },
  settings: {
    react: {
      version: "detect",
    },
  },
};
