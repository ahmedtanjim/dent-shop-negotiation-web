<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowRight, Check, Copy, Lock, User } from 'lucide-vue-next'
import { listMembers, openPortal, startCheckout } from '@/api/billing'
import { ApiError, CRM_URL } from '@/api/client'
import { useAuthStore } from '@/stores/auth'
import { useEntitlementStore } from '@/stores/entitlement'
import { theme } from '@/utils/theme'
import bgDark from '@/assets/paywall-dark.jpg'
import bgLight from '@/assets/paywall-light.jpg'

/** The Negotiator for a shop below the AI tier. The shop's own workspace sits blurred
 *  behind one sheet: one headline, one price, one button. Owners go to Stripe; everyone
 *  else gets a note to hand the owner. Coming back from Stripe (?status=success) this
 *  same view re-syncs the plan and drops itself. */

const auth = useAuthStore()
const ent = useEntitlementStore()
const route = useRoute()
const router = useRouter()

const shopId = () => auth.shopId ?? ''
const redirectTo = computed(() =>
  typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/')
    ? route.query.redirect
    : '/',
)

// ---- copy that depends on the plan the shop is on ----
const planLabel = computed(() => {
  switch (ent.tier) {
    case 'Annual': return 'Annual plan'
    case 'Monthly': return 'Monthly plan'
    case 'Ai': return 'AI plan'
    default: return 'Free plan'
  }
})
const paying = computed(() => ent.tier === 'Annual' || ent.tier === 'Monthly')
const headline = computed(() =>
  paying.value
    ? `Your ${planLabel.value} runs the shop. This is the tier above it.`
    : 'The Negotiator is part of the AI plan.',
)
const renews = computed(() => {
  const iso = ent.entitlement?.currentPeriodEnd
  if (!iso || !paying.value) return null
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
})
const statusLine = computed(() => {
  const parts = [auth.shopName ?? 'Your shop', planLabel.value]
  if (!auth.isOwner && auth.role) parts.push(`you're signed in as ${roleLabel(auth.role)}`)
  else if (renews.value) parts.push(`renews ${renews.value}`)
  return parts.join(' · ')
})
function roleLabel(role: string) {
  return role.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().replace(/^\w/, (c) => c.toUpperCase())
}

const ladder = [
  ['Cooperative response', 'answer, attach, restate the amounts'],
  ['Documented-delivery notice', 'when each item was sent, and to whom'],
  ['Firm demand', 'decline the re-request, set a deadline'],
  ['Bad-faith notice', 'the fair-claims provisions, cited'],
  ['Final notice', 'pay by a date, or the regulator and counsel'],
]
const checks = [
  ['Total Loss Invoice', 'storage accrues per day, PDF in one click'],
  ['Adjuster emails read for you', 'stall, lowball, redundant request, denial'],
  ['Your state’s insurance code', 'attorney-reviewed citations, nothing invented'],
  ['Copilot and fact ledger', '“what’s my next move?” answered from the file'],
]

// ---- owner: off to Stripe ----
const busy = ref(false)
const error = ref<string | null>(null)

function returnUrl() {
  const q = redirectTo.value !== '/' ? `?redirect=${encodeURIComponent(redirectTo.value)}` : ''
  return `${window.location.origin}/upgrade${q}`
}

async function upgrade() {
  busy.value = true
  error.value = null
  try {
    const r = ent.canUpgradeInPlace
      ? await openPortal(shopId(), 'ai', returnUrl())
      : await startCheckout(shopId(), 'ai', returnUrl())
    window.location.href = r.url
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : 'Could not open Stripe. Try again in a moment.'
    busy.value = false
  }
}

// ---- back from Stripe ----
const status = computed(() => (typeof route.query.status === 'string' ? route.query.status : null))
const activating = ref(false)
const activationFailed = ref(false)

async function awaitActivation() {
  activating.value = true
  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    await ent.sync(shopId()).catch(() => {})
    if (ent.isAi) {
      activating.value = false
      router.replace(redirectTo.value)
      return
    }
    await new Promise((r) => setTimeout(r, 2500))
  }
  activating.value = false
  activationFailed.value = true
}

// ---- everyone else: a note for the owner ----
const ownerName = ref<string | null>(null)
const copied = ref(false)

const note = computed(() => {
  const who = ownerName.value ? `Hi ${ownerName.value.split(' ')[0]},` : 'Hi,'
  const where = redirectTo.value !== '/' ? ` (${window.location.origin}${redirectTo.value})` : ''
  return (
    `${who} I tried to open the Negotiator${where} and it needs the AI plan — ` +
    (paying.value
      ? `$999/yr on top of our ${planLabel.value}, half the standalone price. `
      : `$1,999/yr with everything in Annual included. `) +
    `You can add it from Billing in Dent Shop Manager: ${CRM_URL}/billing`
  )
})

async function copyNote() {
  try {
    await navigator.clipboard.writeText(note.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 2500)
  } catch {
    error.value = 'Could not copy. Select the note below and copy it by hand.'
  }
}

onMounted(async () => {
  if (status.value === 'success') void awaitActivation()
  if (!auth.isOwner && auth.shopId) {
    try {
      const members = await listMembers(auth.shopId)
      ownerName.value = members.find((m) => m.role.toLowerCase() === 'owner')?.displayName ?? null
    } catch {
      /* the note still works without a name */
    }
  }
})
</script>

<template>
  <div class="paywall">
    <img :src="theme === 'dark' ? bgDark : bgLight" class="bg" alt="" aria-hidden="true" />
    <div class="scrim" aria-hidden="true"></div>

    <section class="sheet card" :class="{ solo: !auth.isOwner }" aria-labelledby="pw-title">
      <div class="pitch">
        <div class="eyebrow">
          <span class="pill pill-violet"><Lock :size="11" /> AI plan</span>
          <span class="muted status-line">{{ statusLine }}</span>
        </div>

        <h1 id="pw-title">{{ auth.isOwner ? headline : 'The Negotiator isn’t on your shop’s plan yet.' }}</h1>

        <p v-if="auth.isOwner" class="lede muted">
          Total-loss invoices with storage that accrues by the day, adjuster emails sorted by
          tactic, and letters that quote your state's insurance code. Add it to the subscription
          you already have. Stripe prorates the difference and nothing restarts.
        </p>
        <p v-else-if="paying" class="lede muted">
          Only the shop owner can change the plan. It's $999 a year on top of the
          {{ planLabel }} your shop already has, half the standalone price, and it unlocks for
          the whole team the moment they confirm.
        </p>
        <p v-else class="lede muted">
          Only the shop owner can change the plan. It's the AI plan, $1,999 a year with
          everything in Annual included, and it unlocks for the whole team the moment they
          confirm.
        </p>

        <template v-if="auth.isOwner">
          <div class="price">
            <span class="mono price-num">{{ paying ? '$999' : '$1,999' }}</span>
            <span class="muted">/ year</span>
            <span v-if="paying" class="mono price-was muted">$1,999</span>
            <span v-if="paying" class="pill pill-green">Half price for DSM shops</span>
          </div>
          <p class="muted price-note">
            {{ paying ? 'About $83 a month. One recovered supplement covers the year.' : 'Everything in Annual included. One recovered supplement covers the year.' }}
          </p>

          <!-- Back from Stripe -->
          <div v-if="activating" class="notice-amber activating">
            <span class="spinner"></span> Thanks! Confirming with Stripe and unlocking the Negotiator…
          </div>
          <div v-else-if="activationFailed" class="notice-amber">
            Stripe took the payment but the plan hasn't switched here yet. Give it a minute and
            reload — if it still shows this screen, contact support.
          </div>
          <div v-else-if="status === 'cancel'" class="notice-amber">No changes were made to your plan.</div>

          <div class="ctas">
            <button class="btn btn-primary btn-lg" type="button" :disabled="busy || activating" @click="upgrade">
              <span v-if="busy" class="spinner"></span>
              Add the Negotiator · {{ paying ? '$999' : '$1,999' }}/yr <ArrowRight :size="16" />
            </button>
            <a class="btn btn-lg" :href="CRM_URL">Back to the shop system</a>
          </div>
          <p v-if="error" class="error-text">{{ error }}</p>
          <p class="fine muted">
            Confirm on Stripe, prorated to your renewal date · cancel anytime · every letter is
            yours to approve before it goes out.
          </p>
        </template>

        <template v-else>
          <div class="owner-row">
            <User :size="18" class="muted" />
            <span class="owner-text">
              <b>{{ ownerName ?? 'The shop owner' }}</b>
              <span class="muted"> · owner · can add it from Billing in the shop system</span>
            </span>
            <button class="btn btn-primary" type="button" @click="copyNote">
              <Check v-if="copied" :size="14" /><Copy v-else :size="14" />
              {{ copied ? 'Copied' : 'Copy a note for the owner' }}
            </button>
          </div>
          <p v-if="error" class="error-text">{{ error }}</p>
          <div class="ctas">
            <a class="btn" :href="CRM_URL">Back to the shop system</a>
            <span class="fine muted">The note carries the price, the page you were opening, and a link straight to Billing.</span>
          </div>
        </template>
      </div>

      <aside v-if="auth.isOwner" class="behind">
        <div class="panel-title">What's behind this screen</div>
        <ol class="ladder">
          <li v-for="([name, what], i) in ladder" :key="name" :class="{ here: i === 2 }">
            <span class="rung mono">{{ i + 1 }}</span>
            <span><b>{{ name }}</b><span class="muted"> · {{ what }}</span></span>
          </li>
        </ol>
        <ul class="checks">
          <li v-for="[name, what] in checks" :key="name">
            <Check :size="16" class="ck" />
            <span><b>{{ name }}</b><span class="muted"> · {{ what }}</span></span>
          </li>
        </ul>
      </aside>
    </section>
  </div>
</template>

<style scoped>
.paywall {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 20px 56px;
  overflow: hidden;
  isolation: isolate;
}
/* The shop's own workspace, visible but out of reach. */
.bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: top left;
  filter: blur(7px) saturate(0.85);
  transform: scale(1.04);
  z-index: -2;
  pointer-events: none;
}
.scrim {
  position: absolute;
  inset: 0;
  background: color-mix(in srgb, var(--bg) 66%, transparent);
  z-index: -1;
}
.sheet {
  width: 100%;
  max-width: 980px;
  display: grid;
  grid-template-columns: 1.12fr 0.88fr;
  gap: 44px;
  padding: 40px 44px 36px;
  border-color: var(--border);
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.04) inset, 0 30px 60px -30px rgba(0, 0, 0, 0.9);
}
.sheet.solo {
  max-width: 720px;
  grid-template-columns: 1fr;
}
.pitch {
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-width: 0;
}
.eyebrow {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.status-line {
  font-size: 13px;
}
h1 {
  font-size: 34px;
  line-height: 1.12;
  letter-spacing: -0.02em;
  text-wrap: balance;
}
.solo h1 {
  font-size: 28px;
}
.lede {
  font-size: 15px;
  line-height: 1.55;
  max-width: 52ch;
}
.price {
  display: flex;
  align-items: baseline;
  gap: 12px;
  flex-wrap: wrap;
  padding-top: 6px;
}
.price-num {
  font-family: var(--mono);
  font-size: 46px;
  font-weight: 600;
  letter-spacing: -0.03em;
  line-height: 1;
}
.price-was {
  font-family: var(--mono);
  font-size: 16px;
  text-decoration: line-through;
}
.price-note {
  margin-top: -8px;
  font-size: 13px;
}
.ctas {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  padding-top: 4px;
}
.btn-lg {
  padding: 12px 18px;
  font-size: 14.5px;
}
.btn-primary.btn-lg {
  font-weight: 700;
}
.fine {
  font-size: 12.5px;
  line-height: 1.5;
}
.activating {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* non-owner */
.owner-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  padding: 14px 16px;
  background: var(--bg-raised);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
}
.owner-text {
  flex: 1;
  min-width: 200px;
  font-size: 13.5px;
}

/* the ladder */
.behind {
  display: flex;
  flex-direction: column;
  gap: 14px;
  border-left: 1px solid var(--border-soft);
  padding-left: 36px;
  min-width: 0;
}
.behind .panel-title {
  margin-bottom: 0;
}
.ladder {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}
.ladder li {
  position: relative;
  display: grid;
  grid-template-columns: 22px 1fr;
  gap: 12px;
  align-items: start;
  padding-bottom: 10px;
  font-size: 13.5px;
  line-height: 1.4;
}
.ladder li:last-child {
  padding-bottom: 0;
}
.ladder li::before {
  content: '';
  position: absolute;
  left: 11px;
  top: 26px;
  bottom: 0;
  width: 1px;
  background: var(--border);
}
.ladder li:last-child::before {
  display: none;
}
.rung {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  background: var(--panel-soft);
  border: 1px solid var(--border);
  font-size: 11px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
}
.ladder li.here .rung {
  background: var(--accent-soft);
  border-color: var(--accent);
  color: var(--accent);
}
.checks {
  list-style: none;
  margin: 0;
  padding: 10px 0 0;
  border-top: 1px solid var(--border-soft);
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-size: 13.5px;
  line-height: 1.4;
}
.checks li {
  display: grid;
  grid-template-columns: 16px 1fr;
  gap: 10px;
  align-items: start;
}
.ck {
  color: var(--teal);
  margin-top: 2px;
}
b {
  font-weight: 600;
}

@media (max-width: 860px) {
  .paywall {
    align-items: flex-start;
    padding: 20px 12px 40px;
  }
  .sheet {
    grid-template-columns: 1fr;
    gap: 24px;
    padding: 24px 20px;
  }
  h1 {
    font-size: 26px;
  }
  .price-num {
    font-size: 38px;
  }
  .behind {
    border-left: 0;
    padding-left: 0;
    border-top: 1px solid var(--border-soft);
    padding-top: 20px;
  }
  .ctas .btn {
    width: 100%;
    justify-content: center;
    min-height: 46px;
  }
}
</style>
