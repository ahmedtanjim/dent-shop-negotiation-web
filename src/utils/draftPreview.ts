import { ref } from 'vue'

/** The letter so far while a draft is being written, shown on the timeline. Only a preview:
 *  the saved draft replaces it when the checks have run. */
export const draftPreview = ref('')
