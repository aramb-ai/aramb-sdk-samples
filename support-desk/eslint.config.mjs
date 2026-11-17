import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

// R1: the app talks to aramb only through the public SDK. No deep imports, no
// raw WebSocket client, no hand-written calls to an aramb URL.
const arambUrl = '/aramb|\\/gw\\b/i';

const config = [
  ...nextVitals,
  ...nextTs,
  { ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts'] },
  {
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [{ name: 'ws', message: 'Use the Session from @aramb-ai/sdk.' }],
          patterns: [{ group: ['@aramb-ai/sdk/*'], message: 'Import only the public entry point @aramb-ai/sdk.' }],
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'WebSocket', message: 'Use the Session from @aramb-ai/sdk.' },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='WebSocket'], NewExpression[callee.property.name='WebSocket']",
          message: 'Use the Session from @aramb-ai/sdk.',
        },
        {
          selector: `CallExpression[callee.name='fetch'] > Literal.arguments:first-child[value=${arambUrl}]`,
          message: 'Call aramb through @aramb-ai/sdk, not fetch.',
        },
        {
          selector: `CallExpression[callee.name='fetch'] > TemplateLiteral.arguments:first-child > TemplateElement[value.raw=${arambUrl}]`,
          message: 'Call aramb through @aramb-ai/sdk, not fetch.',
        },
        {
          selector: "CallExpression[callee.name='fetch'] MemberExpression[object.object.name='process'][object.property.name='env']",
          message: 'Do not fetch an env-configured URL; call aramb through @aramb-ai/sdk.',
        },
      ],
    },
  },
];

export default config;
