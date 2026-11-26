/** Files the assistant reads with a question or with feedback on a draft. The API is the
 *  judge (it reads each file's bytes and refuses in plain words); this only keeps the pickers
 *  from offering what it would refuse. Same limits as the API's OwnerAttachmentLoader. */
export const MAX_ATTACHED_FILES = 5

const TEXT_EXT = /\.(txt|eml|csv|md|json|xml|html?)$/i
const READABLE_EXT = /\.(pdf|jpe?g|png|gif|webp)$/i
const READABLE_TYPE = /^(application\/pdf|image\/(jpeg|png|gif|webp))$/i

/** Whether the assistant can read a file of this name / type. */
export function attachableKind(fileName: string, contentType?: string | null): boolean {
  return TEXT_EXT.test(fileName) || READABLE_EXT.test(fileName) || READABLE_TYPE.test(contentType ?? '')
}

/** Adds or removes one id, never past the limit. */
export function toggleAttached(chosen: readonly string[], id: string): string[] {
  if (chosen.includes(id)) return chosen.filter((x) => x !== id)
  if (chosen.length >= MAX_ATTACHED_FILES) return [...chosen]
  return [...chosen, id]
}
