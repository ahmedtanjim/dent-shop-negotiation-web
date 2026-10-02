import { api } from './client'
import type {
  CaseDetail,
  CaseListItem,
  CaseStatus,
  ChatMessage,
  DraftQuestion,
  DraftRequest,
  DraftResult,
  Fact,
  GeneratedDocs,
  IntakeKind,
  IntakeRequest,
  NegDocument,
  NegMessage,
  PasteExtraction,
  UpsertCase,
} from './types'

function base(shopId: string): string {
  return `/api/shops/${shopId}/negotiation`
}

export function listCases(shopId: string): Promise<CaseListItem[]> {
  return api.get<CaseListItem[]>(`${base(shopId)}/cases`)
}

export function createCase(shopId: string, body: UpsertCase): Promise<CaseListItem> {
  return api.post<CaseListItem>(`${base(shopId)}/cases`, body)
}

export function getCase(shopId: string, caseId: string): Promise<CaseDetail> {
  return api.get<CaseDetail>(`${base(shopId)}/cases/${caseId}`)
}

export function updateCase(
  shopId: string,
  caseId: string,
  body: UpsertCase,
  opts?: { keepalive?: boolean },
): Promise<void> {
  return api.put<void>(`${base(shopId)}/cases/${caseId}`, body, opts)
}

export function setCaseStatus(shopId: string, caseId: string, status: CaseStatus): Promise<void> {
  return api.post<void>(`${base(shopId)}/cases/${caseId}/status`, { status })
}

export function extractPaste(shopId: string, text: string): Promise<PasteExtraction> {
  return api.post<PasteExtraction>(`${base(shopId)}/intake/extract`, { text })
}

export function intakeMessage(
  shopId: string,
  caseId: string,
  body: IntakeRequest,
): Promise<NegMessage> {
  return api.post<NegMessage>(`${base(shopId)}/cases/${caseId}/intake`, body)
}

/** `kind`: omit = decide from the sender (mail from the shop's own address is logged as a
 *  letter the shop sent); 'Sent' = log a letter the shop sent; 'Inbound' = received. */
export function intakeEml(
  shopId: string,
  caseId: string,
  file: File,
  kind?: IntakeKind,
): Promise<NegMessage> {
  const form = new FormData()
  form.append('file', file)
  if (kind) form.append('kind', kind)
  return api.postForm<NegMessage>(`${base(shopId)}/cases/${caseId}/intake-eml`, form)
}

/** Remove a timeline entry (received email, sent letter or draft) — audited server-side. */
export function deleteMessage(shopId: string, caseId: string, messageId: string): Promise<void> {
  return api.del(`${base(shopId)}/cases/${caseId}/messages/${messageId}`)
}

/** Re-file an email as received from the insurer or sent by the shop. */
export function setMessageKind(
  shopId: string,
  caseId: string,
  messageId: string,
  kind: 'Inbound' | 'Sent',
): Promise<NegMessage> {
  return api.post<NegMessage>(`${base(shopId)}/cases/${caseId}/messages/${messageId}/kind`, { kind })
}

export function createDraft(
  shopId: string,
  caseId: string,
  body: DraftRequest,
): Promise<DraftResult> {
  return api.post<DraftResult>(`${base(shopId)}/cases/${caseId}/drafts`, body)
}

/** Step one of drafting: up to 3 questions about facts the letter needs (empty = draft now).
 *  Same body as createDraft; the answers then ride on createDraft. */
export async function getDraftQuestions(
  shopId: string,
  caseId: string,
  body: DraftRequest,
): Promise<DraftQuestion[]> {
  const res = await api.post<{ questions: DraftQuestion[] }>(
    `${base(shopId)}/cases/${caseId}/drafts/questions`,
    body,
  )
  return res.questions ?? []
}

export function getGeneratedDocs(shopId: string, caseId: string): Promise<GeneratedDocs> {
  return api.get<GeneratedDocs>(`${base(shopId)}/cases/${caseId}/generated`)
}

export async function downloadInvoicePdf(
  shopId: string,
  caseId: string,
  customerName: string | null,
): Promise<void> {
  const { blob, filename } = await api.download(`${base(shopId)}/cases/${caseId}/generated/invoice.pdf`)
  // Prefer the server's name (Content-Disposition); fall back to the same rule locally.
  const name = customerName?.replace(/\s+/g, ' ').trim()
  saveBlob(blob, filename ?? (name ? `TL ${name}.pdf` : 'total-loss-invoice.pdf'))
}

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function markSent(shopId: string, caseId: string, messageId: string): Promise<NegMessage> {
  return api.post<NegMessage>(`${base(shopId)}/cases/${caseId}/messages/${messageId}/mark-sent`)
}

export function getChat(shopId: string, caseId: string): Promise<ChatMessage[]> {
  return api.get<ChatMessage[]>(`${base(shopId)}/cases/${caseId}/chat`)
}

export function sendChat(shopId: string, caseId: string, message: string): Promise<ChatMessage> {
  return api.post<ChatMessage>(`${base(shopId)}/cases/${caseId}/chat`, { message })
}

export function addFact(
  shopId: string,
  caseId: string,
  body: { factDate: string; assertion: string; documentId?: string | null },
): Promise<Fact> {
  return api.post<Fact>(`${base(shopId)}/cases/${caseId}/facts`, body)
}

export function deleteFact(shopId: string, caseId: string, factId: string): Promise<void> {
  return api.del(`${base(shopId)}/cases/${caseId}/facts/${factId}`)
}

export function uploadDocument(
  shopId: string,
  caseId: string,
  file: File,
  label?: string,
): Promise<NegDocument> {
  const form = new FormData()
  form.append('file', file)
  if (label) form.append('label', label)
  return api.postForm<NegDocument>(`${base(shopId)}/cases/${caseId}/documents`, form)
}

export async function downloadDocument(
  shopId: string,
  caseId: string,
  doc: NegDocument,
): Promise<void> {
  const { blob } = await api.download(`${base(shopId)}/cases/${caseId}/documents/${doc.id}`)
  saveBlob(blob, doc.fileName)
}

export function deleteDocument(shopId: string, caseId: string, documentId: string): Promise<void> {
  return api.del(`${base(shopId)}/cases/${caseId}/documents/${documentId}`)
}
