import { api } from './client'
import type {
  CaseDetail,
  CaseListItem,
  CaseStatus,
  ChatMessage,
  DraftRequest,
  DraftResult,
  Fact,
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

export function updateCase(shopId: string, caseId: string, body: UpsertCase): Promise<void> {
  return api.put<void>(`${base(shopId)}/cases/${caseId}`, body)
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

export function intakeEml(shopId: string, caseId: string, file: File): Promise<NegMessage> {
  const form = new FormData()
  form.append('file', file)
  return api.postForm<NegMessage>(`${base(shopId)}/cases/${caseId}/intake-eml`, form)
}

export function createDraft(
  shopId: string,
  caseId: string,
  body: DraftRequest,
): Promise<DraftResult> {
  return api.post<DraftResult>(`${base(shopId)}/cases/${caseId}/drafts`, body)
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
  const blob = await api.blob(`${base(shopId)}/cases/${caseId}/documents/${doc.id}`)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = doc.fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function deleteDocument(shopId: string, caseId: string, documentId: string): Promise<void> {
  return api.del(`${base(shopId)}/cases/${caseId}/documents/${documentId}`)
}
