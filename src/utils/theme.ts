import { ref, watchEffect } from 'vue'

const KEY = 'dsm_neg_theme'

/** Dark is the product's home look; the choice sticks per browser. */
export const theme = ref<'dark' | 'light'>(
  localStorage.getItem(KEY) === 'light' ? 'light' : 'dark',
)

export function toggleTheme(): void {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
}

watchEffect(() => {
  document.documentElement.dataset.theme = theme.value
  localStorage.setItem(KEY, theme.value)
})
