// Темы подсветки кода курса (TextMate-темы для Shiki) в цветах платформы: одни и те же в редакторе
// (src/editor/monaco.ts через @shikijs/monaco) и в тексте урока (src/lesson/markdown.ts).
//
// Роли цветов: ключевые слова — фиолетовый; функции и методы — малиновый акцент PixiJS; классы и типы
// (Container, Sprite, Texture) — бирюзовый, чтобы API движка было видно сразу; числа — оранжевый (координаты,
// цвета 0xff0000 и размеры в коде Pixi встречаются постоянно). HTML-теги и атрибуты — для примеров index.html,
// GLSL — для шейдеров главы 16. Области (scopes) — из грамматик TypeScript, HTML, CSS и GLSL (VS Code).
import type { ThemeRegistration } from 'shiki/core';

interface Palette {
  background: string;
  foreground: string;
  comment: string;
  keyword: string;
  string: string;
  number: string;
  fn: string;
  tag: string;
  attribute: string;
  type: string;
  punctuation: string;
  /** Парные скобки по уровню вложенности (bracket pair colorization в Monaco) */
  brackets: [string, string, string];
  lineNumber: string;
  lineNumberActive: string;
  lineHighlight: string;
  selection: string;
  cursor: string;
}

function theme(name: string, type: 'light' | 'dark', c: Palette): ThemeRegistration {
  return {
    name,
    type,
    colors: {
      'editor.background': c.background,
      'editor.foreground': c.foreground,
      'editorLineNumber.foreground': c.lineNumber,
      'editorLineNumber.activeForeground': c.lineNumberActive,
      'editor.lineHighlightBackground': c.lineHighlight,
      'editor.selectionBackground': c.selection,
      'editorCursor.foreground': c.cursor,
      'editorIndentGuide.background1': c.lineHighlight,
      'editorBracketMatch.background': c.selection,
      'editorBracketMatch.border': c.selection,
      'editorBracketHighlight.foreground1': c.brackets[0],
      'editorBracketHighlight.foreground2': c.brackets[1],
      'editorBracketHighlight.foreground3': c.brackets[2],
    },
    tokenColors: [
      { settings: { foreground: c.foreground, background: c.background } },
      {
        scope: ['comment', 'punctuation.definition.comment'],
        settings: { foreground: c.comment, fontStyle: 'italic' },
      },
      {
        scope: [
          'keyword',
          'storage.type',
          'storage.modifier',
          'keyword.control',
          'keyword.operator.new',
          'keyword.operator.expression',
          'variable.language.this',
          'variable.language.super',
        ],
        settings: { foreground: c.keyword },
      },
      { scope: ['keyword.operator', 'punctuation', 'meta.brace'], settings: { foreground: c.punctuation } },
      { scope: ['string', 'punctuation.definition.string'], settings: { foreground: c.string } },
      {
        scope: ['constant.numeric', 'constant.language', 'constant.character.escape', 'keyword.other.unit'],
        settings: { foreground: c.number },
      },
      {
        scope: ['entity.name.function', 'support.function', 'meta.function-call entity.name.function'],
        settings: { foreground: c.fn },
      },
      {
        scope: [
          'entity.name.type',
          'support.type',
          'entity.name.class',
          'entity.other.inherited-class',
          'support.class',
          // `new Application()` грамматика TypeScript считает вызовом функции — а это класс
          'new.expr meta.function-call entity.name.function',
          'new.expr entity.name.type',
          // GLSL: vec2, sampler2D, uniform
          'storage.type.glsl',
        ],
        settings: { foreground: c.type },
      },
      { scope: ['meta.object-literal.key', 'support.type.property-name.json'], settings: { foreground: c.foreground } },
      // HTML: теги — как функции, атрибуты — янтарные
      { scope: ['entity.name.tag', 'punctuation.definition.tag'], settings: { foreground: c.tag } },
      { scope: ['entity.other.attribute-name'], settings: { foreground: c.attribute } },
      // CSS: селекторы — как теги, свойства — как типы, значения — как атрибуты
      { scope: ['entity.other.attribute-name.class.css', 'entity.name.tag.css'], settings: { foreground: c.tag } },
      { scope: ['support.type.property-name.css'], settings: { foreground: c.type } },
      {
        scope: ['variable.css', 'variable.argument.css', 'support.constant.property-value.css'],
        settings: { foreground: c.attribute },
      },
    ],
  };
}

export const courseLight = theme('course-light', 'light', {
  background: '#ffffff',
  foreground: '#1d1a26',
  comment: '#8c86a0',
  keyword: '#6741d9',
  string: '#2b8a3e',
  number: '#c2410c',
  fn: '#c2255c',
  tag: '#c2255c',
  attribute: '#9a5b00',
  type: '#0b7285',
  punctuation: '#6b6578',
  brackets: ['#6b6578', '#6741d9', '#0b7285'],
  lineNumber: '#bab5c7',
  lineNumberActive: '#6b6578',
  lineHighlight: '#f6f4fa',
  selection: '#f5d0de',
  cursor: '#d6336c',
});

export const courseDark = theme('course-dark', 'dark', {
  background: '#191722',
  foreground: '#ebe8f2',
  comment: '#7d7690',
  keyword: '#b197fc',
  string: '#8ce99a',
  number: '#ffa94d',
  fn: '#f783ac',
  tag: '#f783ac',
  attribute: '#f2c27b',
  type: '#66d9e8',
  punctuation: '#9c96ab',
  brackets: ['#9c96ab', '#b197fc', '#66d9e8'],
  lineNumber: '#4a4459',
  lineNumberActive: '#9c96ab',
  lineHighlight: '#221f2d',
  selection: '#4a2338',
  cursor: '#f06595',
});
