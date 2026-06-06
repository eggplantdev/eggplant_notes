import type { ReactNode } from 'react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type TitledCardPropsT = {
  title: string
  children: ReactNode
  description?: ReactNode
  className?: string
}

export function TitledCard({ title, children, description, className }: TitledCardPropsT) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}
