// Languages offered by the markdown "insert code block" picker. `value` is the Shiki language
// id written into the ```fence (so the saved detail view highlights it); `label` is the human
// name shown in the combobox. Curated, not exhaustive — Shiki supports far more. Ordered
// alphabetically by label (the combobox preserves source order).
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
