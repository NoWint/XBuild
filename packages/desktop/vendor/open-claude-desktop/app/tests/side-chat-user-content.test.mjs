import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { parseSideChatUserText as parse } from '../src/generated/code-editor/side-chat-user-segments.mjs';
import { renderSideChatUserSegment as renderSegment, sideChatTextBreaks } from '../src/generated/code-editor/side-chat-user-render.mjs';
const render = text => renderToStaticMarkup(React.createElement('div', null, parse(text).map((s,i)=>renderSegment(s,i,sideChatTextBreaks))));

test('source list parser keeps ordered starts and three-space nested lists', () => {
  const [intro,list]=parse('Intro\n\n3. third\n4. fourth\n   * child');
  assert.deepEqual(intro,{kind:'text',text:'Intro'});assert.equal(list.list.start,3);assert.equal(list.list.ordered,true);
  assert.deepEqual(list.list.items.map(i=>i.text),['third','fourth']);assert.equal(list.list.items[1].children[0].items[0].text,'child');
  const html=render('3. third\n4. fourth\n   * child');assert.match(html,/<ol start="3"/);assert.match(html,/<li>fourth<ul/);
});

test('ordinary text, unsupported bullets and non-canonical numbering stay literal', () => {
  for(const text of ['- one\n- two','01. first\n02. next','Intro\n* no separator','inline `code` https://example.com'])assert.deepEqual(parse(text),[{kind:'text',text}]);
  const html=render('inline `code` https://example.com');assert.doesNotMatch(html,/<a |<code/);assert.match(html,/`code` https:\/\/example.com/);
  assert.equal(parse('2. second\n4. fourth')[0].list.items[0].text,'second\n4. fourth','out-of-sequence numbering is a literal continuation');
});

test('fenced content remains literal while following ordinary lists are rendered', () => {
  const text='```js\n* literal\n```\n\n* real';const segments=parse(text);
  assert.equal(segments[0].text,'```js\n* literal\n```');assert.equal(segments[1].list.items[0].text,'real');
  const html=render(text);assert.doesNotMatch(html,/<pre|<code/);assert.match(html,/```js<br\/>\* literal<br\/>```/);assert.equal((html.match(/<ul/g)||[]).length,1);
});

test('source rendering retains trailing empty lines and escapes user HTML', () => {
  assert.match(render('one\n'),/one<br\/><br\/>/);assert.match(render('<script>example</script>'),/&lt;script&gt;example&lt;\/script&gt;/);
  assert.deepEqual(parse(''),[]);
});

test('source nesting limit flattens deeper levels without dropping their text', () => {
  const text=Array.from({length:12},(_,i)=>'   '.repeat(i)+'* level'+i).join('\n');
  const html=render(text);assert.equal((html.match(/<ul/g)||[]).length,8);
  for(let i=0;i<12;i++)assert.ok(html.includes('level'+i));
});

const { detectSideChatSecrets: detect, maskSideChatSecrets: mask } = await import('../src/generated/code-editor/side-chat-secrets.mjs');
test('current detector covers a fixed-length key suffix and keeps independent match boundaries', () => {
  const aws='AKIA'+'A'.repeat(24),github='ghp_'+'y'.repeat(32),text=aws+' '+github;
  assert.deepEqual(detect(text).map(s=>[s.patternId,s.start,s.end]),[['aws',0,aws.length],['github',aws.length+1,text.length]]);
  assert.equal(mask(text),aws.slice(0,8)+'•'.repeat(aws.length-8)+' '+github.slice(0,8)+'•'.repeat(github.length-8));
});
test('current detector masks invisible-character obfuscation and preserves PEM structure', () => {
  const token='sk-ant-'+'x'.repeat(10)+'\u200B'+'x'.repeat(22);assert.equal(detect(token)[0].value,token);assert.ok(!mask(token).includes('x'.repeat(10)));
  const pem='-----BEGIN PRIVATE KEY-----\nABCDEFGHIJKLMNOPQRSTUV0123456789\n-----END PRIVATE KEY-----';
  assert.equal(detect(pem)[0].patternId,'private_key');assert.equal(mask(pem),'-----BEGIN PRIVATE KEY-----\n'+'•'.repeat(32)+'\n-----END PRIVATE KEY-----');
});
test('current secret scan retains ordinary text and the original size boundary', () => {
  assert.equal(mask('normal question'), 'normal question');assert.deepEqual(detect('a'.repeat(262145)),[]);
});
