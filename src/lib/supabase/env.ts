// Single source for the public Supabase env contract. Access must stay static
// (`process.env.NEXT_PUBLIC_*`) so Next.js inlines the values into the browser
// bundle — a dynamic `process.env[name]` lookup would not be inlined client-side.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
