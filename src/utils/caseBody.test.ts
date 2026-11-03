import { describe, expect, it } from 'vitest'
import type { CustomerCar } from '@/api/types'
import { editedFields, fillFromCar } from './caseBody'

const car: CustomerCar = {
  claimId: 'car-1',
  roNumber: 1042,
  insurerName: 'Grange',
  claimNumber: 'GR-123',
  state: 'OH',
  hasCase: false,
}
const blank = { insurerName: '', insurerClaimNumber: '', state: '' }

describe('fillFromCar', () => {
  it("fills the blank insurer, claim # and state from the customer's car", () => {
    expect(fillFromCar(blank, car)).toEqual({ insurerName: 'Grange', insurerClaimNumber: 'GR-123', state: 'OH' })
  })
  it('keeps what the user typed', () => {
    const typed = { insurerName: 'Grange TL desk', insurerClaimNumber: 'TL-9', state: 'PA' }
    expect(fillFromCar(typed, car)).toEqual(typed)
  })
  it("replaces a guessed state with the storm's when asked (New case)", () => {
    expect(fillFromCar({ ...blank, state: 'TX' }, car, { replaceState: true }).state).toBe('OH')
    expect(fillFromCar({ ...blank, state: 'TX' }, car).state).toBe('TX')
  })
  it('leaves the fields alone without a car, or with a car missing those details', () => {
    expect(fillFromCar(blank, null)).toEqual(blank)
    const bare = { ...car, insurerName: null, claimNumber: null, state: 'ZZ' }
    expect(fillFromCar(blank, bare)).toEqual(blank)
  })
  it('treats a whitespace-only field as blank', () => {
    expect(fillFromCar({ ...blank, insurerName: '  ' }, car).insurerName).toBe('Grange')
  })
})

describe('editedFields', () => {
  it('names only the fields the user changed', () => {
    const pristine = { title: 'Case', insurerName: '', insurerClaimNumber: '', notes: '' }
    const form = { ...pristine, notes: 'called the adjuster' }
    expect([...editedFields(pristine, form)]).toEqual(['notes'])
  })
  it('lets a server fill survive an unrelated edit: the untouched insurer is not sent back blank', () => {
    // The form was reset with a blank insurer; the user typed a note; meanwhile linking the car
    // filled the insurer on the server (the refresh was held back because the form had edits).
    const pristine = { insurerName: '', notes: '' }
    const form = { insurerName: '', notes: 'note' }
    expect(editedFields(pristine, form).has('insurerName')).toBe(false)
  })
})
