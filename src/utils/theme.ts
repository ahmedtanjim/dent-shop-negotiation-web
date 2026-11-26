import { ref, watchEffect } from 'vue'
import { isEmbedded } from './embed'

const KEY = 'dsm_neg_theme'

/** Inside the shop system's car page the frame follows the shop system's theme: it comes as
 *  `?theme=` on the first address and as a message when it changes (utils/embed), and is never
 *  saved over this browser's own choice for the Negotiator. */
function embeddedTheme(): 'dark' | 'light' | null {
  if (!isEmbedded()) return null
  try {
    const t = new URLSearchParams(window.location.search).get('theme')
    return t === 'light' || t === 'dark' ? t : null
  } catch {
    return null
  }
}

/** Dark is the product's home look; the choice sticks per browser. */
export const theme = ref<'dark' | 'light'>(
  embeddedTheme() ?? (localStorage.getItem(KEY) === 'light' ? 'light' : 'dark'),
)

export function toggleTheme(): void {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
}

watchEffect(() => {
  document.documentElement.dataset.theme = theme.value
  if (!isEmbedded()) localStorage.setItem(KEY, theme.value)
})
