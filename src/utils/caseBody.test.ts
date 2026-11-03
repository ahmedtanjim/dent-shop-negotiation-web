import { describe, expect, it } from 'vitest'
import type { CustomerCar, CustomerSearchResult } from '@/api/types'
import { carVehicle, customerPickNote, editedFields, fillFromCar, filledLabel, pickCustomerOnCase } from './caseBody'

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

const customer = (latestCar: CustomerCar | null, vehicleLabel: string | null = '2025 Toyota Camry'): CustomerSearchResult => ({
  id: 'cust-1',
  fullName: 'Vic Twocars',
  phone: null,
  email: null,
  vehicleLabel,
  latestCar,
})
const blankCase = { title: 'Case', insurerName: '', insurerClaimNumber: '', state: '', vehicleDescription: '' }
const honda: CustomerCar = { ...car, claimId: 'car-honda', roNumber: 200, claimNumber: 'SF-HONDA', insurerName: 'State Farm', vehicleLabel: '2023 Honda Accord' }

describe('pickCustomerOnCase', () => {
  it('a case with no car fills from the suggested car and links to it', () => {
    const pick = pickCustomerOnCase(blankCase, customer(honda), null)
    expect(pick.fields).toMatchObject({
      insurerName: 'State Farm',
      insurerClaimNumber: 'SF-HONDA',
      state: 'OH',
      vehicleDescription: '2023 Honda Accord', // the car's own, not the customer's newest
    })
    expect(pick.link).toBe(true)
    expect(pick.car?.claimId).toBe('car-honda')
    expect(pick.filled).toBe('Insurer, claim #, state and vehicle')
  })
  it('a case linked to car X takes nothing from a suggested car Y', () => {
    const pick = pickCustomerOnCase(blankCase, customer(honda), 'car-x')
    expect(pick.fields).toEqual(blankCase)
    expect(pick.link).toBe(false)
    expect(pick.car).toBeNull()
    expect(pick.filled).toBeNull()
    expect(customerPickNote(pick.filled, pick.car?.roNumber ?? null, 'none')).toBeNull()
  })
  it('a case linked to the suggested car fills its blanks and does not re-link', () => {
    const pick = pickCustomerOnCase({ ...blankCase, insurerName: 'State Farm' }, customer(honda), 'car-honda')
    expect(pick.fields.insurerClaimNumber).toBe('SF-HONDA')
    expect(pick.link).toBe(false)
    expect(pick.filled).toBe('Claim #, state and vehicle')
  })
  it("never fills from a car that belongs to another case", () => {
    const pick = pickCustomerOnCase(blankCase, customer({ ...honda, hasCase: true }), null)
    expect(pick.fields).toEqual(blankCase)
    expect(pick.link).toBe(false)
  })
  it("a customer with no car in the garage fills only their vehicle on an unlinked case", () => {
    const pick = pickCustomerOnCase(blankCase, customer(null), null)
    expect(pick.fields.vehicleDescription).toBe('2025 Toyota Camry')
    expect(pick.filled).toBe('Vehicle')
    expect(pickCustomerOnCase(blankCase, customer(null), 'car-x').filled).toBeNull()
  })
  it('reports nothing filled when the form already had everything', () => {
    const full = { ...blankCase, insurerName: 'A', insurerClaimNumber: 'B', state: 'TX', vehicleDescription: 'V' }
    const pick = pickCustomerOnCase(full, customer(honda), null)
    expect(pick.filled).toBeNull()
    expect(pick.link).toBe(true)
    expect(customerPickNote(pick.filled, 200, 'linked')).toBe('Linked to RO-200.')
  })
})

describe('carVehicle', () => {
  it("prefers the suggested car's own vehicle, falling back to the customer's on an older API", () => {
    expect(carVehicle(customer(honda))).toBe('2023 Honda Accord')
    expect(carVehicle(customer({ ...honda, vehicleLabel: null }))).toBeNull()
    const { vehicleLabel: _omit, ...oldApiCar } = honda
    expect(carVehicle(customer(oldApiCar))).toBe('2025 Toyota Camry')
    expect(carVehicle(customer(null))).toBe('2025 Toyota Camry')
  })
})

describe('customerPickNote', () => {
  it('names only what was filled', () => {
    expect(filledLabel({ insurerClaimNumber: '' }, { insurerClaimNumber: 'X' })).toBe('Claim #')
    expect(customerPickNote('Claim #', 12, 'none')).toBe('Claim # filled from RO-12.')
    expect(customerPickNote('Claim #', 12, 'linked')).toBe('Claim # filled from RO-12, and the case is linked to that car.')
    expect(customerPickNote(null, 12, 'failed')).toBe("Couldn't link RO-12. Link the car below to share its letters.")
    expect(customerPickNote(null, null, 'none')).toBeNull()
  })
})
