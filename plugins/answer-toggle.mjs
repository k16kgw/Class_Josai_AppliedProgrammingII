import { existsSync, readdirSync, unlinkSync } from 'node:fs';
import { resolve, join } from 'node:path';

/**
 * MyST 1.x copies original Markdown into its web assets even with downloads: [].
 * Never publish those source copies: they bypass directive rendering entirely.
 * Only generated, content-hashed Markdown files are removed, not author files.
 */
export function removeSourceCopies(buildDir = resolve('_build')) {
  for (const folder of ['site/public', 'html/build']) {
    const directory = join(buildDir, folder);
    if (!existsSync(directory)) continue;
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (!entry.isFile() || !/-[a-f0-9]{32}\.md$/.test(entry.name)) continue;
      const file = join(directory, entry.name);
      // Remove all original Markdown copies, including stale pre-migration ones.
      unlinkSync(file);
    }
  }
}

// Runs after static HTML has copied the web assets; also applies to --site/PDF.
// During `myst start`, use a static build for publication (see README).
process.once('exit', () => removeSourceCopies());

/** Answer visibility is resolved before HTML, search and PDF rendering. */
function discardSource(node) {
  if (!node) return;
  delete node.value;
  delete node.arg;
  delete node.options;
}

export const visibleAnswer = {
  name: 'visible-answer',
  arg: { type: 'myst' },
  body: { type: 'myst' },
  run(data) {
    discardSource(data.node);
    return [{
      // The standard admonition dropdown also has a PDF renderer; bare
      // `details` nodes are not supported by MyST 1.9's LaTeX renderer.
      type: 'admonition',
      class: 'dropdown simple',
      icon: false,
      open: false,
      children: [
        { type: 'admonitionTitle', children: data.arg?.length ? data.arg : [{ type: 'text', value: '解答例' }] },
        ...(data.body ?? []),
      ],
    }];
  },
};

export const hiddenAnswer = {
  name: 'hidden-answer',
  // String prevents nested directives (including images/includes) from running.
  arg: { type: String },
  body: { type: String },
  run(data) {
    discardSource(data.node);
    return [];
  },
};

export default {
  name: 'Answer visibility',
  directives: [visibleAnswer, hiddenAnswer],
  transforms: [{
    name: 'remove-answer-source',
    stage: 'document',
    // Enclosing directives may retain raw source containing a hidden answer.
    plugin: () => function clean(node) {
      if (node.type === 'mystDirective' || node.type === 'mystRole') discardSource(node);
      if (Array.isArray(node.children)) {
        node.children = node.children.filter(child => !(
          child.type === 'mystDirective' && child.name === 'hidden-answer'
        ));
        node.children.forEach(clean);
      }
    },
  }],
};
