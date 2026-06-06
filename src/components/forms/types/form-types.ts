import type { ComponentProps } from 'react'

export type FormControlPropsT = {
  label?: string
  placeholder?: string
  disabled?: boolean
  type?: ComponentProps<'input'>['type']
  autoComplete?: ComponentProps<'input'>['autoComplete']
  className?: string
}
