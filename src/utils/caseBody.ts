import type { CaseDetail, CustomerCar, CustomerSearchResult, UpsertCase } from '@/api/types'
import { US_STATES } from '@/utils/format'

/**
 * Full UpsertCase body built from the server's current state. The workspace has two
 * editors that save independently (Case details in the sidebar, the Total Loss invoice
 * inputs on the invoice card) — each starts from this round-trip and overrides only its
 * own fields, so neither save wipes the other's.
 */
export function caseBodyFromDetail(d: CaseDetail): UpsertCase {
  return {
    title: d.case.title,
    insurerName: d.case.insurerName,
    insurerClaimNumber: d.case.insurerClaimNumber,
    adjusterName: d.adjusterName,
    adjusterEmail: d.adjusterEmail,
    adjusterPhone: d.adjusterPhone,
    customerName: d.case.customerName,
    customerId: d.customerId,
    vehicleDescription: d.vehicleDescription,
    state: d.case.state,
    invoiceTotal: d.case.invoiceTotalCents / 100,
    storagePerDay: d.storagePerDayCents / 100,
    storageStartDate: d.storageStartDate ? d.storageStartDate.slice(0, 10) : null,
    storageEndDate: d.storageEndDate ? d.storageEndDate.slice(0, 10) : null,
    adminFee: d.adminFee,
    lotFee: d.lotFee,
    salesTaxPercent: d.salesTaxPercent,
    notes: d.notes,
  }
}

/** The fields a picked customer's car fills (owner 2026-10-28 / 2026-11-03: "isn't pulling the
 *  claim number or insurance company from the garage"). */
export interface CarFillable {
  insurerName: string
  insurerClaimNumber: string
  state: string
}

/**
 * Fills the blank insurer and claim # from the picked customer's car in the garage; what the
 * user typed stays. The car's storm state fills a blank state, and with `replaceState` also
 * replaces one (New case guesses the state from the shop's address — the storm's is better).
 */
export function fillFromCar<T extends CarFillable>(
  fields: T,
  car: CustomerCar | null | undefined,
  opts: { replaceState?: boolean } = {},
): T {
  if (!car) return fields
  const out = { ...fields }
  if (!out.insurerName.trim() && car.insurerName) out.insurerName = car.insurerName
  if (!out.insurerClaimNumber.trim() && car.claimNumber) out.insurerClaimNumber = car.claimNumber
  if (car.state && US_STATES.includes(car.state) && (opts.replaceState || !out.state)) out.state = car.state
  return out
}

/**
 * The form fields the user changed since the form was last reset from the server. On save, a
 * field the user left alone keeps the server's current value: a refresh held back while the
 * form had edits (linking a car fills the insurer and claim #) must not be wiped by the form's
 * stale copy of that field.
 */
export function editedFields<T extends object>(pristine: T, form: T): Set<keyof T> {
  const out = new Set<keyof T>()
  for (const k of Object.keys(form) as (keyof T)[]) if (form[k] !== pristine[k]) out.add(k)
  return out
}

/** The fields a picked customer fills on an existing case (Case details). */
export interface CustomerPickFields extends CarFillable {
  vehicleDescription: string
}

const FILL_LABELS: [keyof CustomerPickFields, string][] = [
  ['insurerName', 'insurer'],
  ['insurerClaimNumber', 'claim #'],
  ['state', 'state'],
  ['vehicleDescription', 'vehicle'],
]

/** "Insurer and claim #" for the fields that changed between `before` and `after`, or null. */
export function filledLabel(before: Partial<CustomerPickFields>, after: Partial<CustomerPickFields>): string | null {
  const names = FILL_LABELS.filter(([k]) => k in after && before[k] !== after[k]).map(([, n]) => n)
  if (!names.length) return null
  const text = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** The vehicle a picked customer brings: their suggested car's own (a case linked to that car must
 *  name it), else — no car, or an older API — the customer's newest vehicle. */
export function carVehicle(customer: CustomerSearchResult): string | null {
  const car = customer.latestCar
  if (car && car.vehicleLabel !== undefined) return car.vehicleLabel ?? null
  return customer.vehicleLabel
}

/** What picking a customer on an existing case does. */
export interface CustomerPick<T> {
  fields: T
  /** The car the fields came from (or that the case should link to), or null. */
  car: CustomerCar | null
  /** Link the case to `car` (the case has no car yet and that car has no case). */
  link: boolean
  /** "Insurer and claim #" — what actually changed, or null. */
  filled: string | null
}

/**
 * Picking the customer in Case details. The customer's suggested car fills the blanks only when it
 * is this case's car, or the case has no car and the suggested one has no case either. A case
 * linked to another car takes nothing from the suggestion: the server already fills its blanks
 * from its own car, and the suggested car's claim # would go to the insurer on letters (review
 * 2026-11-03). The vehicle is the car's own; the customer's newest vehicle only when they have no
 * car in the garage.
 */
export function pickCustomerOnCase<T extends CustomerPickFields>(
  fields: T,
  customer: CustomerSearchResult,
  linkedClaimId: string | null,
): CustomerPick<T> {
  const suggested = customer.latestCar ?? null
  const usable = suggested
    ? linkedClaimId
      ? suggested.claimId === linkedClaimId
      : !suggested.hasCase
    : false
  let out = { ...fields }
  if (usable && suggested) {
    out = fillFromCar(out, suggested)
    const vehicle = carVehicle(customer)
    if (!out.vehicleDescription.trim() && vehicle) out.vehicleDescription = vehicle
  } else if (!suggested && !linkedClaimId && !out.vehicleDescription.trim() && customer.vehicleLabel) {
    out.vehicleDescription = customer.vehicleLabel
  }
  return {
    fields: out,
    car: usable ? suggested : null,
    link: usable && !linkedClaimId,
    filled: filledLabel(fields, out),
  }
}

/** The note under the customer picker: only what really happened, or null. */
export function customerPickNote(
  filled: string | null,
  roNumber: number | null,
  link: 'linked' | 'failed' | 'none',
): string | null {
  if (roNumber === null) return filled ? `${filled} filled from the customer's record.` : null
  const ro = `RO-${roNumber}`
  if (link === 'linked') return filled ? `${filled} filled from ${ro}, and the case is linked to that car.` : `Linked to ${ro}.`
  if (link === 'failed')
    return filled
      ? `${filled} filled from ${ro}. Link the car below to share its letters.`
      : `Couldn't link ${ro}. Link the car below to share its letters.`
  return filled ? `${filled} filled from ${ro}.` : null
}
