import { describe, expect, it } from 'vitest'

import { isPdfFile, readFileAsBase64 } from '@/features/import/utils/read-file-base64'

function fileFrom(bytes: Uint8Array, name = 'doc.pdf', type = 'application/pdf'): File {
  return new File([bytes], name, { type })
}

describe('readFileAsBase64', () => {
  it('round-trips bytes to base64 (matches a known-good encoder)', async () => {
    const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x00, 0xff, 0x80]) // %PDF + edge byte values
    const result = await readFileAsBase64(fileFrom(bytes))
    expect(result).toBe(Buffer.from(bytes).toString('base64'))
  })

  it('encodes correctly across the 0x8000 chunk boundary', () => {
    // The reader chunks at 32KB to avoid a stack overflow from String.fromCharCode(...wholeArray).
    // A file just over one chunk proves the seam joins without corrupting bytes.
    const bytes = new Uint8Array(0x8000 + 257)
    for (let i = 0; i < bytes.length; i++) bytes[i] = i % 256
    return readFileAsBase64(fileFrom(bytes)).then((result) => {
      expect(result).toBe(Buffer.from(bytes).toString('base64'))
    })
  })

  it('handles an empty file', async () => {
    expect(await readFileAsBase64(fileFrom(new Uint8Array(0)))).toBe('')
  })
})

describe('isPdfFile', () => {
  it('accepts by MIME type', () => {
    expect(isPdfFile(fileFrom(new Uint8Array(0), 'x.bin', 'application/pdf'))).toBe(true)
  })

  it('accepts by extension when the type is missing, case-insensitively', () => {
    expect(isPdfFile(fileFrom(new Uint8Array(0), 'REPORT.PDF', ''))).toBe(true)
  })

  it('rejects non-pdf files', () => {
    expect(isPdfFile(fileFrom(new Uint8Array(0), 'notes.txt', 'text/plain'))).toBe(false)
  })
})
