import { ref } from 'vue'

/** The one "Help & support" modal (HelpSupportModal, mounted in App.vue) — any page,
 *  signed in or out, opens it with openHelp(). */
export const helpOpen = ref(false)
export const openHelp = () => (helpOpen.value = true)
