import type { CaseDetail, CustomerCar, UpsertCase } from '@/api/types'
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
