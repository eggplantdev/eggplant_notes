import { CopySkillButton } from '@/features/api-tokens/components/copy-skill-button'

type PropsT = { skill: string }

// Renders the agent skill verbatim in the FAQ as a copyable block. Shown RAW (not markdown-rendered)
// on purpose: it's exactly the text you paste into an agent, so a faithful preview beats a prettified
// one. `skill` is injected with the deployment origin server-side (same fillSkillTemplate path as the
// Settings copy/download), so this preview is single-sourced and can't drift from the real skill.
export function SkillPreview({ skill }: PropsT) {
  return (
    <div className="flex flex-col gap-3">
      <CopySkillButton skill={skill} />
      <pre className="border-border bg-muted max-h-96 overflow-auto rounded-md border p-4 font-mono text-xs whitespace-pre">
        {skill}
      </pre>
    </div>
  )
}
