'use client'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { GoalCelebrationT } from '@/features/review/types'

type PropsT = { celebration: GoalCelebrationT | undefined; onClose: () => void }

function title(c: GoalCelebrationT): string {
  if (c.daily && c.weekly) return 'Daily + weekly goal hit!'
  if (c.weekly) return 'Weekly goal hit!'
  return 'Daily goal hit!'
}

function detail(c: GoalCelebrationT): string {
  const daily = `${c.dailyCount}/${c.dailyGoal} today`
  const weekly = `${c.weeklyCount}/${c.weeklyGoal} this week`
  if (c.daily && c.weekly) return `${daily} · ${weekly}`
  if (c.weekly) return weekly
  return daily
}

export function GoalCelebrationDialog({ celebration, onClose }: PropsT) {
  return (
    <Dialog
      open={!!celebration}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent>
        {celebration && (
          <>
            <DialogHeader>
              <DialogTitle className="text-neon-cyan">{title(celebration)} 🎉</DialogTitle>
              <DialogDescription>{detail(celebration)}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button>Nice!</Button>
              </DialogClose>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
