import type { ReactNode } from 'react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type TitledCardPropsT = {
  title: string
  children: ReactNode
  description?: ReactNode
  className?: string
  // 'gradient' wraps the card in the brand neon ramp (green→cyan→fuchsia) as a 2px border.
  variant?: 'default' | 'gradient'
}

export function TitledCard({
  title,
  children,
  description,
  className,
  variant = 'default',
}: TitledCardPropsT) {
  const card = (
    <Card className={cn(variant === 'gradient' && 'ring-0', className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )

  if (variant === 'gradient') {
    return <div className="gradient-border rounded-xl bg-linear-to-br p-0.5">{card}</div>
  }

  return card
}
