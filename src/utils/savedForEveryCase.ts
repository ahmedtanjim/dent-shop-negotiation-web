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
