import type { CaseDetail, UpsertCase } from '@/api/types'

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
