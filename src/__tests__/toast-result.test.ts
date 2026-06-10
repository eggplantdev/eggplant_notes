import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ActionResultT } from '@/types/action'

// Capture every toast[type](message) call. react-toastify is stubbed so these unit tests assert
// the result→toast branching without a DOM/portal. `toast` is indexed by type (toast.error(...),
// toast.success(...)), so a Proxy records the type + message of each call.
const calls: { type: string; message: string }[] = []
vi.mock('react-toastify', () => ({
  Bounce: 'Bounce',
  toast: new Proxy(
    {},
    { get: (_target, type: string) => (message: string) => calls.push({ type, message }) },
  ),
}))

import { toastActionResult } from '@/components/forms/toast-result'
import { TOAST_MESSAGES } from '@/components/toast-messages'
import { toastResult } from '@/components/toasts'

const ok: ActionResultT = { success: true }
const fail: ActionResultT = { success: false, error: 'Boom' }

beforeEach(() => {
  calls.length = 0
})

describe('toastResult — shared result→toast branching', () => {
  it('toasts the error message as an error on failure', () => {
    toastResult(fail)
    expect(calls).toEqual([{ type: 'error', message: 'Boom' }])
  })

  it('fires a success toast when a message is given (display copy not asserted)', () => {
    toastResult(ok, 'Saved')
    expect(calls).toEqual([{ type: 'success', message: expect.any(String) }])
  })

  it('stays silent on success with no message', () => {
    toastResult(ok)
    expect(calls).toEqual([])
  })

  it('ignores the success message on failure (only the error toasts)', () => {
    toastResult(fail, 'Saved')
    expect(calls).toEqual([{ type: 'error', message: 'Boom' }])
  })
})

describe('toastActionResult — form-seam wrapper', () => {
  it('returns false and toasts the error on failure', () => {
    expect(toastActionResult(fail)).toBe(false)
    expect(calls).toEqual([{ type: 'error', message: 'Boom' }])
  })

  it('returns true and fires a success toast on success (display copy not asserted)', () => {
    expect(toastActionResult(ok, { successMessage: 'Done' })).toBe(true)
    expect(calls).toEqual([{ type: 'success', message: expect.any(String) }])
  })

  it('returns true with no toast when success carries no message', () => {
    expect(toastActionResult(ok)).toBe(true)
    expect(calls).toEqual([])
  })
})

describe('TOAST_MESSAGES — post-redirect key→message map', () => {
  it('maps every redirect-action key to a non-empty message', () => {
    const keys = [
      'note-saved',
      'note-deleted',
      'subject-saved',
      'subject-deleted',
      'signed-up',
      'password-updated',
      'account-deleted',
    ] as const
    for (const key of keys) {
      expect(TOAST_MESSAGES[key], `missing message for ${key}`).toBeTruthy()
    }
  })
})
