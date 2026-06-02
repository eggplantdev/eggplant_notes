import type { ComponentProps } from 'react'

// Minimal field-component props for F-01 auth forms (text/email/password inputs).
export type FormControlPropsT = {
  label?: string
  placeholder?: string
  disabled?: boolean
  type?: ComponentProps<'input'>['type']
  autoComplete?: ComponentProps<'input'>['autoComplete']
  className?: string
}
