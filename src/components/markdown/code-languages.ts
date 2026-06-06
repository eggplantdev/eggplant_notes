// `value` must be the Shiki language id (written into the fence so the detail view highlights it).
// Curated, not exhaustive; ordered alphabetically by label since the combobox preserves source order.
export const CODE_LANGUAGES = [
  { value: 'bash', label: 'Bash' },
  { value: 'c', label: 'C' },
  { value: 'cpp', label: 'C++' },
  { value: 'css', label: 'CSS' },
  { value: 'go', label: 'Go' },
  { value: 'html', label: 'HTML' },
  { value: 'java', label: 'Java' },
  { value: 'js', label: 'JavaScript' },
  { value: 'json', label: 'JSON' },
  { value: 'jsx', label: 'JSX' },
  { value: 'md', label: 'Markdown' },
  { value: 'php', label: 'PHP' },
  { value: 'text', label: 'Plain text' },
  { value: 'python', label: 'Python' },
  { value: 'ruby', label: 'Ruby' },
  { value: 'rust', label: 'Rust' },
  { value: 'sql', label: 'SQL' },
  { value: 'tsx', label: 'TSX' },
  { value: 'ts', label: 'TypeScript' },
  { value: 'yaml', label: 'YAML' },
] as const

// Derived from CODE_LANGUAGES so the insertable set and Shiki's preloaded grammars can never drift.
export const SHIKI_LANGS: readonly string[] = CODE_LANGUAGES.map((l) => l.value)
