// Brand-dark surface, mirroring the .dark `--background` token (oklch(0.08 0 0)). Lives here as the
// one literal because its consumers — OG/Satori ImageResponse, the PWA manifest JSON, viewport
// metadata — are non-CSS contexts that can't read the `@theme` token at render time.
export const BRAND_DARK = '#0a0a0a'
