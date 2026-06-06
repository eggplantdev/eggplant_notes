import Link from 'next/link'
import type { ComponentProps } from 'react'
import { type VariantProps } from 'class-variance-authority'

import { Button, buttonVariants } from '@/components/ui/button'

type ButtonLinkPropsT = ComponentProps<typeof Link> & VariantProps<typeof buttonVariants>

function ButtonLink({ variant, size, className, ...linkProps }: ButtonLinkPropsT) {
  return (
    <Button asChild variant={variant} size={size}>
      <Link className={className} {...linkProps} />
    </Button>
  )
}

export { ButtonLink }
