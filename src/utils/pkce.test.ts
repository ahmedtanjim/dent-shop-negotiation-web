import { beforeEach, describe, expect, it } from 'vitest'
import { challengeOf, isChallenge, newChallenge, takeVerifier } from './pkce'

describe('pkce', () => {
  beforeEach(() => sessionStorage.clear())

  it('matches the RFC 7636 S256 example', async () => {
    expect(await challengeOf('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    )
  })

  it('round-trips: the kept verifier hashes to the challenge that was sent', async () => {
    const challenge = await newChallenge()
    expect(isChallenge(challenge)).toBe(true)
    const verifier = takeVerifier()
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(await challengeOf(verifier!)).toBe(challenge)
  })

  it('hands the verifier out once', async () => {
    await newChallenge()
    expect(takeVerifier()).not.toBeNull()
    expect(takeVerifier()).toBeNull()
  })

  it('a new hand-off replaces the old verifier', async () => {
    const first = await newChallenge()
    const second = await newChallenge()
    expect(second).not.toBe(first)
    expect(await challengeOf(takeVerifier()!)).toBe(second)
  })

  it('accepts only a 43-character base64url challenge', () => {
    expect(isChallenge('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM')).toBe(true)
    expect(isChallenge('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-c')).toBe(false)
    expect(isChallenge('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw+cM')).toBe(false)
    expect(isChallenge(['E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'])).toBe(false)
    expect(isChallenge(undefined)).toBe(false)
  })
})
