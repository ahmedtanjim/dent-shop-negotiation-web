export interface ShopSummary {
  shopId: string
  shopName: string
  role: string
}

export interface AuthResponse {
  token: string
  userId: string
  shopId: string
  displayName: string
  role: string
  emailVerified: boolean
  phoneVerified: boolean
  shops: ShopSummary[]
}

export type CaseStatus = 'Open' | 'Settled' | 'Litigation' | 'Closed'

export interface CaseListItem {
  id: string
  title: string
  status: CaseStatus
  insurerName: string | null
  insurerClaimNumber: string | null
  customerName: string | null
  state: string | null
  invoiceTotalCents: number
  messageCount: number
  updatedAt: string
  createdAt: string
}

export interface UpsertCase {
  title: string
  insurerName?: string | null
  insurerClaimNumber?: string | null
  adjusterName?: string | null
  adjusterEmail?: string | null
  adjusterPhone?: string | null
  customerName?: string | null
  vehicleDescription?: string | null
  state?: string | null
  /** decimal dollars on the wire */
  invoiceTotal: number
  /** decimal dollars on the wire */
  storagePerDay: number
  notes?: string | null
  /** CRM customer link — set when picked from the customer search */
  customerId?: string | null
  /** TL-invoice fee override, decimal dollars; null = shop default */
  adminFee?: number | null
  /** TL-invoice fee override, decimal dollars; null = shop default */
  lotFee?: number | null
  /** TL-invoice tax override, percent; null = shop default */
  salesTaxPercent?: number | null
  /** first day of storage accrual (yyyy-mm-dd); null = storage not computed */
  storageStartDate?: string | null
  /** last day of storage accrual; null = still accruing through today */
  storageEndDate?: string | null
}

export type MessageKind = 'Inbound' | 'Draft' | 'Sent'
export type DraftTone = 'Cooperative' | 'Firm' | 'Escalation'
export type DraftVoice = 'Shop' | 'Customer'
export type Tactic =
  | 'None'
  | 'InfoRequest'
  | 'RedundantRequest'
  | 'Stall'
  | 'Lowball'
  | 'LiabilityShift'
  | 'Denial'
  | 'Harassment'
  | 'Other'

export interface NegMessage {
  id: string
  kind: MessageKind
  tone: DraftTone | null
  voice: DraftVoice | null
  customerAuthorized: boolean
  fromName: string | null
  fromEmail: string | null
  tactic: Tactic
  subject: string
  body: string
  analysisSummary: string | null
  occurredAt: string | null
  createdAt: string
}

export interface Fact {
  id: string
  factDate: string
  assertion: string
  sourceMessageId: string | null
  documentId: string | null
  createdAt: string
}

export interface NegDocument {
  id: string
  fileName: string
  contentType: string
  sizeBytes: number
  label: string | null
  createdAt: string
}

export interface CaseDetail {
  case: CaseListItem
  adjusterName: string | null
  adjusterEmail: string | null
  adjusterPhone: string | null
  vehicleDescription: string | null
  storagePerDayCents: number
  notes: string | null
  claimId: string | null
  messages: NegMessage[]
  facts: Fact[]
  documents: NegDocument[]
  /** false = this state has no verified legal playbook; drafts cite no statutes */
  hasPlaybook: boolean
  /** linked CRM customer — context syncs live from the CRM record when set */
  customerId: string | null
  /** TL-invoice fee override, decimal dollars; null = shop default */
  adminFee: number | null
  lotFee: number | null
  salesTaxPercent: number | null
  storageStartDate: string | null
  storageEndDate: string | null
}

export interface ShopProfile {
  id: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  mailingAddress: string | null
  taxId: string | null
  contactName: string | null
  contactPhone: string | null
  /** decimal dollars — the shop's standard daily storage rate, 0 = unset */
  defaultStoragePerDay: number
  /** decimal dollars — TL-invoice defaults, 0 = unset */
  adminFee: number
  lotFee: number
  /** percent, 0 = no tax */
  salesTaxPercent: number
}

/** One generated boilerplate letter — deterministic fill-in, no AI. */
export interface GeneratedDoc {
  key: string
  title: string
  voice: DraftVoice
  scenario: string
  subject: string
  body: string
}

/** The computed Total Loss invoice (decimal dollars). */
export interface InvoiceBreakdown {
  adminFee: number
  lotFee: number
  storageStart: string | null
  storageEnd: string | null
  storageDays: number
  storagePerDay: number
  storageTotal: number
  taxPercent: number
  tax: number
  subtotal: number
  total: number
}

export interface GeneratedDocs {
  invoice: InvoiceBreakdown
  documents: GeneratedDoc[]
}

export interface ChatMessage {
  id: string
  role: 'User' | 'Assistant'
  content: string
  createdAt: string
}

export interface DraftRequest {
  /** omit for auto — the assistant picks the tier from the case's escalation ladder */
  tone?: DraftTone
  voice: DraftVoice
  customerAuthorized: boolean
  replyToMessageId?: string | null
  instructions?: string | null
}

export interface DraftResult {
  draft: NegMessage
  recommendsCounsel: boolean
}

export interface CustomerSearchResult {
  id: string
  fullName: string
  phone: string | null
  email: string | null
  vehicleLabel: string | null
}

export interface PasteExtraction {
  fromName: string | null
  fromEmail: string | null
  subject: string | null
  sentAt: string | null
  body: string
  isForward: boolean
  isThread: boolean
  /** only when explicitly written in the email — never guessed */
  claimNumber: string | null
}

export interface IntakeRequest {
  subject: string
  body: string
  fromName?: string | null
  fromEmail?: string | null
  occurredAt?: string | null
  /** fills the case's claim number when the case doesn't have one yet */
  claimNumber?: string | null
}
