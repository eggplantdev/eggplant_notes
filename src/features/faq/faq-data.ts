// Static FAQ content for the in-app /faq page. First pass: hardcoded copy, no DB.

export type FaqEndpointRowT = { method: string; endpoint: string; purpose: string }

export type FaqItemT = {
  question: string
  answer: string
  // Only the CLI-endpoint Q&A uses this — rendered as a real table, not crammed into prose.
  endpoints?: readonly FaqEndpointRowT[]
  // Names an interactive block the accordion injects below this item's prose — keys into its `slots`
  // map (e.g. 'skill' = the live agent-skill preview, 'contact' = the contact-dialog trigger). The
  // node is server-supplied, so the skill preview stays single-sourced from SKILL_TEMPLATE.
  slot?: string
}

export type FaqSectionT = {
  id: string
  title: string
  intro?: string
  items: readonly FaqItemT[]
}

export const FAQ_SECTIONS: readonly FaqSectionT[] = [
  {
    id: 'overview',
    title: 'About this app',
    items: [
      {
        question: 'What is this app for?',
        answer:
          'It is a personal learning companion. You keep notes on whatever you are learning, group them into subjects, and turn them into spaced-repetition memory cards so the material actually sticks. Every card links back to the note it came from, so a review session always has a path back to the full context.',
      },
      {
        question: 'What can I do here?',
        answer:
          'Organize subjects and notes, generate notes and memory cards with AI (using your own OpenRouter key), and review your cards on a spaced-repetition schedule. You can also drive the whole thing from your own CLI or coding agent over a token-authenticated API — see the "CLI / agent API" section below.',
      },
      {
        question: "What can't I do yet?",
        answer:
          'This is an evolving MVP under active development, so a few things are intentionally missing for now: there is no data export or download, PDF / vision import is still coming, and AI features require you to connect your own OpenRouter key first. Expect this list to shrink as features land.',
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
          'Yes, at any time. You can disconnect your OpenRouter account from Settings, which removes the key this app holds. If you want to cut access at the source, you can also revoke this app from your OpenRouter account — that invalidates the key regardless of what is stored here.',
      },
      {
        question: 'Can I let my own coding agent author content in this app?',
        answer:
          'Yes. Settings has a "Download agent skill" action that gives you a ready-made skill to hand to your coding agent — it teaches the agent to work with your content here on your behalf: not just create notes and memory cards, but read, update, and delete them too. It works over the token-authenticated endpoints described in the "CLI / agent API" section below, where you also generate and manage the access tokens.',
      },
    ],
  },
  {
    id: 'cli-api',
    title: 'CLI / agent API',
    items: [
      {
        question: 'How do I point an agent at the API?',
        answer:
          'Easiest path: use "Download agent skill" in Settings to get a ready-made skill (your account\'s base URL is baked in). Store one of your access tokens once on your machine — either in an EGGPLANT_TOKEN environment variable or in a ~/.config/eggplant/token file — and the skill picks it up automatically on every run, so you never paste it into a chat again (the same approach the AWS and gh CLIs use; the token is deliberately not baked into the skill file). Prefer to wire it yourself? Point the agent at the base URL and that stored token, and have it call GET /api/subjects first to pick or confirm a subject, then POST /api/notes and POST /api/memory-cards to author content.',
      },
      {
        question: 'What API endpoints are exposed?',
        answer:
          'A small token-authenticated HTTP API lets a CLI or coding agent read, create, update, and delete your content:',
        endpoints: [
          { method: 'GET', endpoint: '/api/subjects', purpose: 'List your subjects (id, title)' },
          {
            method: 'POST',
            endpoint: '/api/subjects',
            purpose: 'Create a subject; returns the subject id',
          },
          {
            method: 'PATCH',
            endpoint: '/api/subjects/{id}',
            purpose: 'Rename or re-describe a subject',
          },
          {
            method: 'DELETE',
            endpoint: '/api/subjects/{id}',
            purpose: 'Delete a subject; its notes and cards are unfiled, not deleted',
          },
          {
            method: 'GET',
            endpoint: '/api/notes',
            purpose: 'List your notes (id, title); optional ?subject=<uuid> filter',
          },
          {
            method: 'GET',
            endpoint: '/api/notes/{id}',
            purpose: "Read a note's full content and its cards",
          },
          {
            method: 'POST',
            endpoint: '/api/notes',
            purpose: 'Create a note (and optional cards); returns the note id',
          },
          {
            method: 'PATCH',
            endpoint: '/api/notes/{id}',
            purpose: 'Edit a note and/or move it to another subject',
          },
          {
            method: 'DELETE',
            endpoint: '/api/notes/{id}',
            purpose: 'Delete a note and its cards',
          },
          {
            method: 'GET',
            endpoint: '/api/memory-cards',
            purpose: 'List your cards; optional ?note / ?subject / ?unfiled filters',
          },
          {
            method: 'POST',
            endpoint: '/api/memory-cards',
            purpose: 'Create card(s) on a note or standalone; returns the card ids',
          },
          {
            method: 'PATCH',
            endpoint: '/api/memory-cards/{id}',
            purpose: 'Edit a card and/or its subject',
          },
          {
            method: 'DELETE',
            endpoint: '/api/memory-cards/{id}',
            purpose: 'Delete a card',
          },
        ],
      },
      {
        question: 'See the agent skill',
        answer:
          'This is the exact skill the "Download agent skill" and "Copy skill" buttons in Settings give you — your account\'s base URL is already baked in, and authentication is covered inside it (store a token once on your machine, as described above, and the skill resolves it on every run). Paste it into your coding agent. It is generated from the same source as the API, so what you see here never drifts from what actually works.',
        slot: 'skill',
      },
    ],
  },
  {
    id: 'your-data',
    title: 'Your data',
    items: [
      {
        question: 'Can I export or send my data out?',
        answer:
          'Not yet — there is no export or download today. The "Contact" button in the footer sends a message to the operator; it does not export your data.',
      },
      {
        question: 'How do I delete my data?',
        answer:
          'Go to Settings → Danger zone → Delete Account. This is permanent and irreversible: it cascades to delete all of your subjects, notes, and memory cards along with your account.',
      },
    ],
  },
  {
    id: 'help',
    title: 'Help',
    items: [
      {
        question: "Something's broken, or my question isn't answered here?",
        answer:
          "Send me a message and I'll get back to you as soon as I can. Use the Contact button below — it's also in the footer of every page.",
        slot: 'contact',
      },
    ],
  },
] as const
