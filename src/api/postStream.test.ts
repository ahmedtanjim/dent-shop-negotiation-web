import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError } from './client'

function sse(...chunks: string[]) {
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      for (const chunk of chunks) c.enqueue(new TextEncoder().encode(chunk))
      c.close()
    },
  })
  return new Response(body, { headers: { 'Content-Type': 'text/event-stream' } })
}

const event = (e: object) => `data: ${JSON.stringify(e)}\n\n`

afterEach(() => vi.unstubAllGlobals())

describe('api.postStream', () => {
  it('passes the text on and returns the finished result, however the bytes are split', async () => {
    const all = event({ type: 'text', text: 'Dear ' }) + event({ type: 'text', text: 'Dana' }) + event({ type: 'done', result: { ok: 1 } })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sse(all.slice(0, 9), all.slice(9, 50), all.slice(50))))
    const seen: string[] = []
    await expect(api.postStream('/x', {}, (t) => seen.push(t))).resolves.toEqual({ ok: 1 })
    expect(seen.join('')).toBe('Dear Dana')
  })

  it('accepts a plain JSON answer', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ ok: 2 })))
    await expect(api.postStream('/x', {}, () => {})).resolves.toEqual({ ok: 2 })
  })

  it('reports a refusal with the server message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ message: 'In litigation' }, { status: 400 })))
    await expect(api.postStream('/x', {}, () => {})).rejects.toMatchObject({ status: 400, message: 'In litigation' })
  })

  it('reports a failure part-way and a stream that just ends', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sse(event({ type: 'error', message: 'Busy' }))))
    await expect(api.postStream('/x', {}, () => {})).rejects.toThrow('Busy')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sse(event({ type: 'text', text: 'Dear' }))))
    await expect(api.postStream('/x', {}, () => {})).rejects.toBeInstanceOf(ApiError)
  })
})
