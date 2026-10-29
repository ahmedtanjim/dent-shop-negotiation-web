import { computed, inject, provide, type InjectionKey, type Ref } from 'vue'

/* A shop whose DSM Negotiator plan ended keeps reading its cases, letters and PDFs, but the
   API refuses every write (402 ai_required; audit 2026-10-26 #10). The case workspace
   provides that state once and its panels inject it: they disable their inputs, hide their
   write actions and never flush a save on the way out — so nothing sends the user to the
   paywall for merely opening a case. */

const KEY: InjectionKey<Readonly<Ref<boolean>>> = Symbol('caseReadOnly')

export function provideCaseReadOnly(readOnly: Readonly<Ref<boolean>>): void {
  provide(KEY, readOnly)
}

/** true = read-only. Outside a provider (a component used elsewhere) it is never read-only. */
export function useCaseReadOnly(): Readonly<Ref<boolean>> {
  return inject(KEY, computed(() => false))
}
