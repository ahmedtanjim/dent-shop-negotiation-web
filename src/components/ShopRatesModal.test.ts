import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { ShopProfile } from '@/api/types'
import type { ShopRates } from '@/api/shops'

const shops = vi.hoisted(() => ({
  getShopProfile: vi.fn(),
  updateShopRates: vi.fn(async (_shopId: string, _rates: ShopRates) => ({})),
}))
vi.mock('@/api/shops', () => shops)

import ShopRatesModal from './ShopRatesModal.vue'
import { useAuthStore } from '@/stores/auth'

/** The profile as the dialog read it: admin $150, lot not set, $45/day, 8.25% tax. */
const profile: ShopProfile = {
  id: 'shop-1',
  name: 'Test Shop',
  phone: null,
  email: null,
  address: null,
  mailingAddress: null,
  taxId: null,
  contactName: null,
  contactPhone: null,
  adminFee: 150,
  lotFee: 0,
  defaultStoragePerDay: 45,
  salesTaxPercent: 8.25,
}

async function open() {
  setActivePinia(createPinia())
  useAuthStore().shopId = 'shop-1'
  shops.getShopProfile.mockResolvedValue(profile)
  const wrapper = mount(ShopRatesModal)
  await flushPromises()
  const box = (label: string) => wrapper.findAll('label.field').find((l) => l.text().startsWith(label))!.get('input')
  async function save(): Promise<ShopRates> {
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(shops.updateShopRates).toHaveBeenCalledTimes(1)
    return shops.updateShopRates.mock.calls[0][1]
  }
  return { wrapper, box, save }
}

describe('ShopRatesModal sends only the boxes the user changed', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('saving untouched boxes sends null for every rate (keep what the server has now)', async () => {
    const { box, save } = await open()
    expect(box('Admin').element.value).toBe('150.00')
    expect(await save()).toEqual({ defaultStoragePerDay: null, adminFee: null, lotFee: null, salesTaxPercent: null })
  })

  it('an edited box sends its value; the others stay null', async () => {
    const { box, save } = await open()
    await box('Storage per day').setValue('55')
    await box('Commercial lot').setValue('$1,250.50')
    expect(await save()).toEqual({ defaultStoragePerDay: 55, adminFee: null, lotFee: 1250.5, salesTaxPercent: null })
  })

  it('0 clears a rate; an emptied box keeps it', async () => {
    const { box, save } = await open()
    await box('Admin').setValue('0')
    await box('Sales tax').setValue('')
    expect(await save()).toEqual({ defaultStoragePerDay: null, adminFee: 0, lotFee: null, salesTaxPercent: null })
  })

  it('a box typed back to its opening text (spaces aside) counts as unchanged', async () => {
    const { box, save } = await open()
    await box('Storage per day').setValue('99')
    await box('Storage per day').setValue(' 45.00 ')
    expect(await save()).toEqual({ defaultStoragePerDay: null, adminFee: null, lotFee: null, salesTaxPercent: null })
  })
})
