import { ref } from 'vue'

/** Bumped when something is saved for every case from outside the draft panel (the "Use in every
 *  letter" button on a rewritten draft), so the panel's "Saved for every case" list reloads. */
export const savedForEveryCaseVersion = ref(0)

/** What the owner told the assistant about a case is kept on its fact list with one of these
 *  openings: an answer to one of its questions, or something said about an earlier letter. */
const OWNER_SAID = ["Shop owner's answer — ", "Shop owner's feedback — "]

/** The owner's own sentence, without the opening; null for any other fact (read from an email). */
export function ownerSaid(assertion: string): string | null {
  const opening = OWNER_SAID.find((o) => assertion.startsWith(o))
  return opening ? assertion.slice(opening.length) : null
}

/** The same for a fact row: a fact that was read from an email or a document is never the
 *  owner's own words, whatever it starts with. */
export function saidByOwner(fact: {
  assertion: string
  sourceMessageId?: string | null
  documentId?: string | null
}): string | null {
  return fact.sourceMessageId || fact.documentId ? null : ownerSaid(fact.assertion)
}

/** The wishes the shop keeps for every case right now, lower-cased (the draft panel's list is the
 *  source; null until it has loaded). The note on a rewritten draft reads it, so "Saved for every
 *  case" there goes away again when the wish is removed in the panel. */
export const everyCaseWishes = ref<Set<string> | null>(null)

export function isSavedForEveryCase(text: string): boolean {
  return everyCaseWishes.value?.has(text.trim().toLowerCase()) ?? false
}

/** Shown as saved at once, before the panel's list has reloaded. */
export function noteSavedForEveryCase(text: string) {
  everyCaseWishes.value = new Set(everyCaseWishes.value ?? []).add(text.trim().toLowerCase())
}
