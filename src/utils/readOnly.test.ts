import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref, type Ref } from 'vue'
import { provideCaseReadOnly, useCaseReadOnly } from './readOnly'

/** A panel that renders what useCaseReadOnly() says. */
const Panel = defineComponent({
  setup() {
    const readOnly = useCaseReadOnly()
    return () => h('span', readOnly.value ? 'read-only' : 'editable')
  },
})

const Workspace = (flag: Ref<boolean>) =>
  defineComponent({
    setup() {
      provideCaseReadOnly(flag)
      return () => h(Panel)
    },
  })

describe('case read-only flag', () => {
  it('outside a case workspace a panel is never read-only', () => {
    expect(mount(Panel).text()).toBe('editable')
  })

  it('panels follow the workspace flag, including when the plan ends mid-visit', async () => {
    const flag = ref(false)
    const w = mount(Workspace(flag))
    expect(w.text()).toBe('editable')
    flag.value = true
    await nextTick()
    expect(w.text()).toBe('read-only')
  })
})
