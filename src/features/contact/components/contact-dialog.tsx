'use client'

import { useState } from 'react'

import { FormError } from '@/components/forms/form-components/form-error'
import { useAppForm } from '@/components/forms/hooks/form-hooks'
import { toastActionResult } from '@/components/forms/toast-result'
import { getFieldErrorText } from '@/components/forms/utils'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { sendContactMessage } from '@/features/contact/actions/send-contact-message'
import { contactSchema } from '@/features/contact/schemas'

// The sender's email is not a field — the action derives it from the session. Success closes +
// resets; failure keeps the dialog open with an inline error so the user doesn't lose their message.
export function ContactDialog() {
  const [open, setOpen] = useState(false)
  const [formError, setFormError] = useState<string | undefined>(undefined)

  const form = useAppForm({
    defaultValues: { subject: '', message: '' },
    onSubmit: async ({ value }) => {
      const result = await sendContactMessage(value)
      if (toastActionResult(result, { successMessage: 'Message sent' })) {
        form.reset()
        setOpen(false)
        return
      }
      if (!result.success) setFormError(result.error)
    },
  })

  return (
    <>
      <Button variant="ghost" size="sm" data-testid="contact-trigger" onClick={() => setOpen(true)}>
        Contact me
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          // Clear a prior send error on close so reopening doesn't show a stale message.
          if (!next) setFormError(undefined)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Contact</DialogTitle>
            <DialogDescription>
              Send a message to eggplant_dev admin. I&apos;ll get back to you as soon as possible.
            </DialogDescription>
          </DialogHeader>

          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault()
              setFormError(undefined)
              form.handleSubmit()
            }}
          >
            <form.AppField
              name="subject"
              validators={{
                onBlur: contactSchema.shape.subject,
                onSubmit: contactSchema.shape.subject,
              }}
            >
              {(field) => <field.Input label="Subject" placeholder="What's this about?" />}
            </form.AppField>

            <form.Field name="message" validators={{ onSubmit: contactSchema.shape.message }}>
              {(field) => (
                <div className="grid gap-2">
                  <Label htmlFor={field.name}>Message</Label>
                  <Textarea
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    placeholder="Your message"
                    rows={5}
                    aria-invalid={field.state.meta.errors.length > 0}
                  />
                  <FormError message={getFieldErrorText(field.state.meta.errors)} />
                </div>
              )}
            </form.Field>

            <FormError message={formError} />

            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(isSubmitting) => (
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  data-testid="contact-submit"
                  className="self-end"
                >
                  {isSubmitting ? 'Sending…' : 'Send message'}
                </Button>
              )}
            </form.Subscribe>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
