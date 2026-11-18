import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parsePreviewAddress as parse } from '../electron/generated/preview-address-parser.mjs';
import { previewAddressTarget as target } from '../electron/preview-address.mjs';

test('original address parser resolves website paths and carries the current scheme', () => {
  assert.deepEqual(parse('/about?q=1', 'https://example.test/a'), { kind: 'navigate', url: 'https://example.test/about?q=1' });
  assert.deepEqual(parse('/about', ''), { kind: 'file', path: '/about' });
  assert.deepEqual(parse('other.test/path', 'http://localhost:3000/'), { kind: 'navigate', url: 'http://other.test/path' });
  assert.deepEqual(parse('intranet:8080', ''), { kind: 'navigate', url: 'https://intranet:8080' });
  assert.deepEqual(parse('example.test', ''), { kind: 'navigate', url: 'https://example.test' });
  assert.deepEqual(parse('localhost:3000', ''), { kind: 'navigate', url: 'http://localhost:3000' });
  assert.deepEqual(parse('127.2.3.4:3000', ''), { kind: 'navigate', url: 'http://127.2.3.4:3000' });
  assert.deepEqual(parse('sub.localhost:3000', 'https://localhost:3000/'), { kind: 'navigate', url: 'https://sub.localhost:3000' });
  assert.deepEqual(parse('sub.localhost:3001', 'https://localhost:3000/'), { kind: 'navigate', url: 'http://sub.localhost:3001' });
  assert.deepEqual(parse('example.test/path', 'https://example.test/path'), { kind: 'navigate', url: 'https://example.test/path' });
});

test('original parser protects credential-like searches and handles malformed Unicode', () => {
  for (const input of ['user:secret@example.test', 'ghp_fake@example.test', 'github_pat_fake@example.test', 'glpat-fake@example.test']) assert.equal(parse(input, ''), null, input);
  assert.deepEqual(parse('find café', ''), { kind: 'search', url: 'https://www.google.com/search?q=find%20caf%C3%A9' });
  assert.deepEqual(parse('hello\ud800 world', ''), { kind: 'search', url: 'https://www.google.com/search?q=hello%EF%BF%BD%20world' });
  assert.equal(parse('\ud800/secret', ''), null, 'removing an unpaired surrogate would expose a path');
  assert.equal(parse('local\ud800host:3000', ''), null, 'removing an unpaired surrogate would produce a URL');
  assert.equal(parse('file://remote/private', ''), null);
  assert.equal(parse('\\\\server\\private', ''), null);
  assert.equal(parse('  ', ''), null);
});

test('host resolves source file intents relative to the session; displayed file path reloads', () => {
  const cwd=path.resolve('/tmp/project'),home=path.resolve('/tmp/home'),file=path.join(cwd,'a b.html'),url=pathToFileURL(file).href;
  assert.deepEqual(target('./a b.html', 'http://localhost:3000/', {cwd,home}), {kind:'file',url});
  assert.deepEqual(target(url, '', {cwd,home}), {kind:'file',url});
  assert.deepEqual(target(file, url, {cwd,home}), {kind:'reload',url});
  assert.deepEqual(target('~/file.html', '', {cwd,home}), {kind:'file',url:pathToFileURL(path.join(home,'file.html')).href});
  assert.deepEqual(target('/about', 'http://localhost:3000/', {cwd,home}), {kind:'navigate',url:'http://localhost:3000/about'});
  for (const value of ['some file words', '$HOME/private', '%USERPROFILE%/private']) assert.equal(target(value,url,{cwd,home}),null,value);
  assert.equal(target(null,url,{cwd,home}),null);
  assert.deepEqual(target('https://example.test',url,{cwd,home}),{kind:'navigate',url:'https://example.test'});
});
