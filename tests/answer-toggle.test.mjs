import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import plugin, { visibleAnswer, hiddenAnswer, removeSourceCopies } from '../plugins/answer-toggle.mjs';

test('visible answers use a closed, PDF-compatible standard dropdown', () => {
  const title = [{ type: 'text', value: 'Answer' }];
  const body = [{ type: 'paragraph', children: [{ type: 'text', value: 'Solution' }] }];
  const [node] = visibleAnswer.run({ arg: title, body });
  assert.equal(node.type, 'admonition');
  assert.equal(node.class, 'dropdown simple');
  assert.equal(node.open, false);
  assert.deepEqual(node.children, [{ type: 'admonitionTitle', children: title }, ...body]);
  assert.equal(visibleAnswer.run({})[0].children[0].children[0].value, '解答例');
});

test('hidden answers discard raw source without processing their body', () => {
  assert.equal(hiddenAnswer.body.type, String);
  const node = { type: 'mystDirective', value: 'secret', arg: 'secret title', options: {} };
  assert.deepEqual(hiddenAnswer.run({ node, arg: 'secret title', body: 'secret' }), []);
  assert.equal(JSON.stringify(node).includes('secret'), false);
});

test('enclosing directive source cannot leak a nested hidden answer', () => {
  const tree = { type: 'root', children: [{ type: 'mystDirective', value: 'secret', children: [
    { type: 'mystDirective', name: 'hidden-answer', value: 'secret', children: [] },
    { type: 'text', value: 'public' },
  ] }] };
  plugin.transforms[0].plugin()(tree);
  assert.equal(JSON.stringify(tree).includes('secret'), false);
  assert.equal(tree.children[0].children[0].value, 'public');
});

test('source-copy cleanup touches only generated hashed Markdown', () => {
  const dir = mkdtempSync(join(tmpdir(), 'answer-source-test-'));
  mkdirSync(join(dir, 'site/public'), { recursive: true });
  const source = join(dir, 'site/public', `lecture-${'a'.repeat(32)}.md`);
  const csv = join(dir, 'site/public', `data-${'b'.repeat(32)}.csv`);
  writeFileSync(source, 'secret');
  writeFileSync(csv, 'public data');
  writeFileSync(join(dir, 'lecture.md'), 'author source');
  removeSourceCopies(dir);
  assert.equal(existsSync(source), false);
  assert.equal(existsSync(csv), true);
  assert.equal(existsSync(join(dir, 'lecture.md')), true);
});

test('MyST build drops hidden text, titles and nested includes from all generated files', () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const dir = mkdtempSync(join(tmpdir(), 'answer-build-test-'));
  const pluginPath = join(root, 'plugins/answer-toggle.mjs');
  const source = '# Test\n\n````{visible-answer} Public\nPUBLIC_SENTINEL\n````\n\n'
    + '`````{note} Outer\nPublic note.\n\n````{hidden-answer} PRIVATE_TITLE_SENTINEL\n'
    + 'PRIVATE_BODY_SENTINEL\n\n```{include} missing-secret.md\n```\n````\n`````\n'
    + '\n````{hidden-answer} Switch answer\nPRIVATE_SWITCH_SENTINEL\n````\n';
  writeFileSync(join(dir, 'index.md'), source);
  writeFileSync(join(dir, 'myst.yml'), `version: 1\nproject:\n  downloads: []\n  source_url: null\n  edit_url: null\n  plugins:\n    - ${pluginPath}\n  toc:\n    - file: index.md\nsite:\n  template: book-theme\n`);
  if (existsSync(join(root, '_build/templates'))) {
    mkdirSync(join(dir, '_build'));
    symlinkSync(join(root, '_build/templates'), join(dir, '_build/templates'));
  }
  const result = spawnSync('myst', ['build', '--site', '--strict'], { cwd: dir, encoding: 'utf8', timeout: 60000 });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  function check(folder) {
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) continue;
      const file = join(folder, entry.name);
      if (entry.isDirectory()) check(file);
      else assert.equal(readFileSync(file).includes(Buffer.from('PRIVATE_')), false, file);
    }
  }
  check(join(dir, '_build'));
  assert.match(readFileSync(join(dir, '_build/site/myst.search.json'), 'utf8'), /PUBLIC_SENTINEL/);
  // Publication requires changing only the directive name.
  writeFileSync(join(dir, 'index.md'), source.replace('{hidden-answer} Switch answer', '{visible-answer} Switch answer'));
  const published = spawnSync('myst', ['build', '--site', '--strict'], { cwd: dir, encoding: 'utf8', timeout: 60000 });
  assert.equal(published.status, 0, published.stdout + published.stderr);
  const search = readFileSync(join(dir, '_build/site/myst.search.json'), 'utf8');
  assert.match(search, /PRIVATE_SWITCH_SENTINEL/);
  assert.doesNotMatch(search, /PRIVATE_BODY_SENTINEL/);
});
