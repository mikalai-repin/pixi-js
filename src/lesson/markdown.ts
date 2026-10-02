import MarkdownIt from 'markdown-it';
import container from 'markdown-it-container';
import { createHighlighterCore, type HighlighterCore } from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';
import { findStepByDir, stepPath } from '../content/course';

// Подключаем только нужные языки: полный бандл Shiki тянет ~200 грамматик
const LANGS = ['ts', 'typescript', 'js', 'javascript', 'json', 'html', 'css', 'bash', 'sh', 'glsl'];

let highlighterPromise: Promise<HighlighterCore> | undefined;

function getHighlighter() {
  highlighterPromise ??= createHighlighterCore({
    themes: [import('shiki/themes/github-light.mjs'), import('shiki/themes/github-dark.mjs')],
    langs: [
      import('shiki/langs/typescript.mjs'),
      import('shiki/langs/javascript.mjs'),
      import('shiki/langs/json.mjs'),
      import('shiki/langs/html.mjs'),
      import('shiki/langs/css.mjs'),
      import('shiki/langs/bash.mjs'),
      import('shiki/langs/glsl.mjs'),
    ],
    engine: createJavaScriptRegexEngine(),
  });
  return highlighterPromise;
}

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** «3-4,7» → {3, 4, 7} */
function parseLineRanges(spec: string): Set<number> {
  const lines = new Set<number>();
  for (const part of spec.split(',')) {
    const [from, to] = part.split('-').map((n) => Number(n.trim()));
    if (!Number.isFinite(from)) continue;
    for (let line = from; line <= (Number.isFinite(to) ? to : from); line++) lines.add(line);
  }
  return lines;
}

/**
 * Строка после ``` : «ts main.ts {3-4}» → язык, имя файла, подсвеченные строки
 */
function parseFenceInfo(info: string) {
  const rangeMatch = /\{([\d,\s-]+)\}/.exec(info);
  const words = info.replace(/\{[^}]*\}/, '').trim().split(/\s+/).filter(Boolean);
  return {
    lang: words[0] ?? '',
    file: words[1],
    highlight: rangeMatch ? parseLineRanges(rangeMatch[1]) : new Set<number>(),
  };
}

const CALLOUT_TITLES: Record<string, string> = {
  tip: 'Совет',
  warning: 'Внимание',
  task: 'Задание',
};

function createMarkdown(highlighter: HighlighterCore) {
  const md = new MarkdownIt({ html: true, linkify: true, typographer: false });

  md.renderer.rules.fence = (tokens, idx) => {
    const token = tokens[idx];
    const { lang, file, highlight } = parseFenceInfo(token.info);
    const code = token.content.replace(/\n$/, '');
    const html = LANGS.includes(lang)
      ? highlighter.codeToHtml(code, {
          lang,
          themes: { light: 'github-light', dark: 'github-dark' },
          defaultColor: false,
          transformers: [
            {
              line(node, line) {
                if (highlight.has(line)) this.addClassToHast(node, 'hl');
              },
            },
          ],
        })
      : `<pre class="shiki"><code>${escapeHtml(code)}</code></pre>`;
    const header = file ? `<div class="code-file">${escapeHtml(file)}</div>` : '';
    return `<div class="code-block">${header}${html}</div>`;
  };

  for (const name of Object.keys(CALLOUT_TITLES)) {
    md.use(container, name, {
      render(tokens: { nesting: number; info: string }[], idx: number) {
        if (tokens[idx].nesting !== 1) return '</div></div>\n';
        const custom = tokens[idx].info.trim().slice(name.length).trim();
        const title = custom ? md.renderInline(custom) : CALLOUT_TITLES[name];
        return `<div class="callout callout-${name}"><div class="callout-title">${title}</div><div class="callout-body">\n`;
      },
    });
  }

  // Сворачиваемые блоки: «Под капотом» и подсказки к практикумам
  const COLLAPSIBLE: Record<string, string> = { deep: 'Под капотом', hint: 'Подсказка' };
  for (const [name, defaultTitle] of Object.entries(COLLAPSIBLE)) {
    md.use(container, name, {
      render(tokens: { nesting: number; info: string }[], idx: number) {
        if (tokens[idx].nesting !== 1) return '</div></details>\n';
        const custom = tokens[idx].info.trim().slice(name.length).trim();
        const title = custom ? md.renderInline(custom) : defaultTitle;
        return `<details class="collapsible ${name}"><summary>${title}</summary><div class="collapsible-body">\n`;
      },
    });
  }

  // Ссылки: step:02-sprites/04-anchor → внутренняя навигация, внешние — в новой вкладке
  const defaultLinkOpen =
    md.renderer.rules.link_open ?? ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));
  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const href = String(token.attrGet('href') ?? '');
    if (href.startsWith('step:')) {
      const step = findStepByDir(href.slice('step:'.length));
      token.attrSet('href', step ? stepPath(step) : '#');
      token.attrSet('data-internal', '');
      if (!step) token.attrSet('class', 'broken-link');
    } else if (/^https?:/.test(href)) {
      token.attrSet('target', '_blank');
      token.attrSet('rel', 'noopener');
    }
    return defaultLinkOpen(tokens, idx, options, env, self);
  };

  return md;
}

let mdPromise: Promise<ReturnType<typeof createMarkdown>> | undefined;

export async function renderMarkdown(source: string): Promise<string> {
  mdPromise ??= getHighlighter().then(createMarkdown);
  const md = await mdPromise;
  return md.render(source);
}
