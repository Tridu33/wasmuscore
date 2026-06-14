import type { languages } from 'monaco-editor'

/**
 * Monarch syntax highlighting definition for ABC notation.
 * Covers: information fields (X:, T:, M:, etc.), notes, accidentals,
 * rests, bar lines, chord symbols, inline comments, lyrics.
 */
export const abcLanguage: languages.IMonarchLanguage = {
  tokenizer: {
    root: [
      // Information fields at start of line: X: T: C: M: L: K: etc.
      [/^[A-Za-z]:/, 'keyword'],

      // Chord symbols in quotes: "Am7" "G7" "Cmaj7"
      [/"[^"]*"/, 'type'],

      // Comments: % to end of line
      [/%.*$/, 'comment'],

      // Lyrics lines: w: ...
      [/^w:/, 'keyword'],

      // Inline commands: [I:...] [M:...] etc.
      [/\[[A-Za-z]:/, 'keyword'],

      // Accidentals + note: ^C _D =E c' d'' etc.
      [/[\^_=]+[A-Ga-g][,',]*/, 'string'],

      // Natural notes without accidental
      [/[A-Ga-g][,',]*/, 'string'],

      // Rests
      [/[zZX]/, 'variable'],

      // Note durations: 3/2, 1/4, etc.
      [/\d+\/\d+/, 'number'],

      // Octave markers and duration numbers
      [/\d+/, 'number'],

      // Fraction slashes
      [/\//, 'number'],

      // Bar lines: | || |] [| |: :| :: etc.
      [/:?\|:?\|?:?/, 'delimiter'],

      // Single bar or pipe
      [/\|/, 'delimiter'],

      // Beam / slur brackets: () [] {}
      [/[(){}]/, 'delimiter.bracket'],

      // Grace notes: { ... }
      [/{/, 'delimiter.bracket'],
      [/}/, 'delimiter.bracket'],

      // Decorations: +trill+ +accent+ etc.
      [/\+[a-zA-Z]+\+/, 'annotation'],

      // Whitespace
      [/\s+/, 'white'],
    ],
  },
}

export const abcLanguageConfiguration: languages.LanguageConfiguration = {
  comments: {
    lineComment: '%',
  },
  brackets: [
    ['{', '}'],
    ['(', ')'],
    ['[', ']'],
  ],
  autoClosingPairs: [
    { open: '{', close: '}' },
    { open: '(', close: ')' },
    { open: '[', close: ']' },
    { open: '"', close: '"' },
  ],
  surroundingPairs: [
    { open: '{', close: '}' },
    { open: '(', close: ')' },
    { open: '[', close: ']' },
    { open: '"', close: '"' },
  ],
}
