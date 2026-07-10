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
}

export interface ChatMessage {
  id: string
  role: 'User' | 'Assistant'
  content: string
  createdAt: string
}

export interface DraftRequest {
  tone: DraftTone
  voice: DraftVoice
  customerAuthorized: boolean
  replyToMessageId?: string | null
  instructions?: string | null
}

export interface DraftResult {
  draft: NegMessage
  recommendsCounsel: boolean
}

export interface IntakeRequest {
  subject: string
  body: string
  fromName?: string | null
  fromEmail?: string | null
  occurredAt?: string | null
}
