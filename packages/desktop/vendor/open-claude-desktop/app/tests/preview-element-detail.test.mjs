import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { createSelectedElementDetail } from '../src/generated/code-editor/preview-element-detail.mjs';

const h = React.createElement;
let server, details;
before(async () => {
  server = await createServer({ configFile: false, root: path.resolve(import.meta.dirname, '..'), plugins: [react()],
    server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'error' });
  const { kt: createIntl } = await server.ssrLoadModule('/src/generated/chat/vendor-intl-Cf4IuK3L.js');
  const intl = createIntl({ locale: 'en', defaultLocale: 'en', messages: {} });
  details = createSelectedElementDetail({
  useIntl: () => intl,
  Message: ({ defaultMessage, values }) => intl.formatMessage({ id: defaultMessage, defaultMessage }, values),
  Icon: ({ name }) => h('span', { 'data-icon': name }),
  // Expose the panel in server rendering so all original detail sections are
  // exercised. Interactive CDS opening/focus is verified by the future UI run.
  Collapsible: { Root: ({ children }) => h('section', null, children), Trigger: ({ children }) => h('button', null, children), Panel: ({ children }) => h('div', null, children) },
  });
});
after(() => server?.close());
const ctx = { tagName: 'button', classes: ['primary'], screenshot: 'cG5n', innerText: 'Save changes',
  attributes: { 'aria-label': 'Save' }, computedStyles: { display: 'flex' },
  parentPath: 'main > button', outerHTML: '<button>Save changes</button>',
  component: { name: 'SaveButton', owners: ['Form', 'App'], props: { disabled: false } } };

test('original detail renders its image, source section labels, ownership and folded-detail count', () => {
  const html = renderToStaticMarkup(h(details.Preview, { ctx, width: 320, scrollRegionLabel: '<SaveButton /> Save changes', openedVia: 'click' }));
  assert.match(html, /style="width:320px"/);
  assert.match(html, /max-h-\[360px\]/);
  assert.match(html, /max-h-\[120px\]/);
  assert.match(html, /alt="Screenshot of the selected element"/);
  assert.match(html, /src="data:image\/png;base64,cG5n"/);
  assert.match(html, /Included with your message/);
  assert.match(html, /Show 4 more details/);
  for (const label of ['Element', 'Component', 'Props', 'Text', 'Attributes', 'Selector', 'Computed styles', 'HTML']) assert.match(html, new RegExp('>' + label + '<'));
  assert.match(html, /in Form › App/);
  assert.match(html, /&lt;button&gt;Save changes&lt;\/button&gt;/);
  assert.doesNotMatch(html, /element-context-unsafe-notice/);
});

test('original preview exposes hidden characters without mutating the source context', () => {
  const unsafe = { ...ctx, innerText: '\u202Ehidden\u2066', screenshot: '' };
  const html = renderToStaticMarkup(h(details.Preview, { ctx: unsafe }));
  assert.match(html, /data-testid="element-context-unsafe-notice"/);
  assert.match(html, /Hidden characters are shown as codes/);
  assert.match(html, /\[U\+202E\]hidden\[U\+2066\]/);
  assert.doesNotMatch(html, /<img /);
  assert.equal(unsafe.innerText, '\u202Ehidden\u2066');
});
