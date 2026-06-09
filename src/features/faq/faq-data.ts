// Static FAQ content for the in-app /faq page. First pass: hardcoded copy, no DB.
// Edit this array to change the FAQ. Types colocate here — they describe this data's shape.

export type FaqEndpointRowT = { method: string; endpoint: string; purpose: string }

export type FaqItemT = {
  question: string
  answer: string
  // Only the CLI-endpoint Q&A uses this — rendered as a real table, not crammed into prose.
  endpoints?: readonly FaqEndpointRowT[]
}

export type FaqSectionT = {
  id: string
  title: string
  // Optional framing shown once above the section's items (e.g. the BYOK note).
  intro?: string
  items: readonly FaqItemT[]
}

export const FAQ_SECTIONS: readonly FaqSectionT[] = [
  {
    id: 'your-data',
    title: 'Your data',
    items: [
      {
        question: 'Can I export or send my data out?',
        answer:
          'Not yet — there is no export or download today. The "Contact me" button in the footer sends a message to the operator; it does not export your data.',
      },
      {
        question: 'How do I delete my data?',
        answer:
          'Go to Settings → Danger zone → Delete Account. This is permanent and irreversible: it cascades to delete all of your subjects, notes, and memory cards along with your account.',
      },
    ],
  },
  {
    id: 'ai-features',
    title: 'AI features',
    intro:
      'AI generation is bring-your-own-key: you connect your own OpenRouter key in Settings. Generation runs server-side, your key is encrypted at rest, and every AI result is preview-gated — you review and edit it before anything is saved.',
    items: [
      {
        question: 'How are notes generated with AI?',
        answer:
          'Two ways today: from a topic string on the create-note form, or by importing text/markdown on the Import page and letting AI decompose it into multiple notes. PDF / vision import is coming soon.',
      },
      {
        question: 'How are memory cards generated with AI?',
        answer:
          'Three ways: from an existing saved note, from a topic string, or inline while you are drafting a note. As with notes, you preview and edit the cards before they save.',
      },
      {
        question: 'How do I use AI to author notes?',
        answer:
          'Use the topic generator at the top of the create-note form, or the AI decompose option on the Import page. Both produce draft content you can edit before saving — nothing is written until you confirm.',
      },
      {
        question: 'Can I disconnect OpenRouter or revoke access later?',
        answer:
          'Yes, at any time. You can disconnect your OpenRouter account from Settings, which removes the key this app holds. If you want to cut access at the source, you can also revoke this app from your OpenRouter account home (the connected-apps / keys page on openrouter.ai) — that invalidates the key regardless of what is stored here.',
      },
      {
        question: 'Can I let my own coding agent author content in this app?',
        answer:
          'Yes. Settings has a "Download agent skill" action that gives you a ready-made skill to hand to your coding agent — it teaches the agent to create notes and memory cards here on your behalf. It works over the token-authenticated endpoints described in the "CLI / agent API" section below, where you also generate and manage the access tokens.',
      },
    ],
  },
  {
    id: 'cli-api',
    title: 'CLI / agent API',
    items: [
      {
        question: 'What API endpoints are exposed?',
        answer:
          'A small token-authenticated HTTP API lets a CLI or coding agent read and create your content:',
        endpoints: [
          { method: 'GET', endpoint: '/api/subjects', purpose: 'List your subjects (id, title)' },
          {
            method: 'GET',
            endpoint: '/api/notes',
            purpose: 'List your notes (id, title); optional ?subject=<uuid> filter',
          },
          {
            method: 'POST',
            endpoint: '/api/notes',
            purpose: 'Create a note (and optional cards); returns the note id',
          },
          {
            method: 'POST',
            endpoint: '/api/memory-cards',
            purpose: 'Create card(s) on a note or standalone; returns the card ids',
          },
        ],
      },
      {
        question: 'How do I authenticate?',
        answer:
          'Send your token in the Authorization header as "Bearer <token>". Tokens are prefixed with "clc_"; only their SHA-256 hash is stored server-side, and every call is scoped to your account so you can only ever read or write your own data.',
      },
      {
        question: 'How do I point an agent at the API?',
        answer:
          'Easiest path: use "Download agent skill" in Settings to get a ready-made skill (your account\'s base URL is baked in) and hand it to your coding agent. Prefer to wire it yourself? Give the agent your token and the base URL, and have it call GET /api/subjects first to pick or confirm a subject, then POST /api/notes and POST /api/memory-cards to author content.',
      },
    ],
  },
] as const
