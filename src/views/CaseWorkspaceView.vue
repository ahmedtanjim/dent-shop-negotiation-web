<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ArrowLeft, AlertTriangle, X } from 'lucide-vue-next'
import { getCase } from '@/api/negotiation'
import { ApiError } from '@/api/client'
import type { CaseDetail } from '@/api/types'
import { centsToUsd } from '@/utils/format'
import { useAuthStore } from '@/stores/auth'
import StatusPill from '@/components/StatusPill.vue'
import CaseSidebar from '@/components/CaseSidebar.vue'
import TimelinePanel from '@/components/TimelinePanel.vue'
import DraftPanel from '@/components/DraftPanel.vue'
import CopilotChat from '@/components/CopilotChat.vue'
import { startWorkspaceTour, workspaceTourSeen } from '@/tour'

const props = defineProps<{ id: string }>()

const auth = useAuthStore()
const route = useRoute()

const detail = ref<CaseDetail | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const counselBanner = ref(false)

async function load(showSpinner = false) {
  if (!auth.shopId) return
  if (showSpinner) loading.value = true
  error.value = null
  try {
    detail.value = await getCase(auth.shopId, props.id)
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : 'Could not load the case.'
  } finally {
    loading.value = false
  }
}

function refresh() {
  load(false)
}

function onCounsel() {
  counselBanner.value = true
}

onMounted(async () => {
  await load(true)
  // First case ever opened: tour the workspace once its panels are mounted.
  if (detail.value && !workspaceTourSeen()) setTimeout(startWorkspaceTour, 600)
})
watch(
  () => route.params.id,
  () => load(true),
)
</script>

<template>
  <div class="workspace-page">
    <div v-if="loading" class="center-state muted"><span class="spinner"></span> Loading case…</div>

    <div v-else-if="error" class="center-state">
      <p class="error-text">{{ error }}</p>
      <RouterLink to="/" class="btn"><ArrowLeft :size="14" /> Back to cases</RouterLink>
    </div>

    <template v-else-if="detail">
      <header class="ws-head">
        <div class="ws-head-left">
          <RouterLink to="/" class="btn btn-ghost btn-sm back"><ArrowLeft :size="14" /></RouterLink>
          <div>
            <h1>{{ detail.case.title }}</h1>
            <p class="muted ws-sub">
              <StatusPill :status="detail.case.status" />
              <span v-if="detail.case.insurerName">{{ detail.case.insurerName }}</span>
              <span v-if="detail.case.insurerClaimNumber" class="mono">
                #{{ detail.case.insurerClaimNumber }}
              </span>
              <span>Invoice {{ centsToUsd(detail.case.invoiceTotalCents) }}</span>
            </p>
          </div>
        </div>
      </header>

      <div v-if="counselBanner" class="counsel-banner">
        <AlertTriangle :size="17" />
        <p>
          <strong>Consider retaining counsel.</strong> Based on the insurer's conduct in this case,
          the assistant recommends having an attorney review it before you escalate further.
        </p>
        <button class="btn btn-ghost btn-sm" @click="counselBanner = false"><X :size="14" /></button>
      </div>

      <div class="ws-grid">
        <CaseSidebar data-tour="ws-sidebar" :detail="detail" @refresh="refresh" />

        <TimelinePanel data-tour="ws-timeline" :detail="detail" @refresh="refresh" />

        <div class="ws-right">
          <DraftPanel
            data-tour="ws-draft"
            :detail="detail"
            @refresh="refresh"
            @counsel="onCounsel"
          />
          <CopilotChat data-tour="ws-copilot" :case-id="detail.case.id" />
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.workspace-page {
  width: 100%;
  max-width: 1560px;
  margin: 0 auto;
  padding: 20px 24px 60px;
}
.center-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 80px 20px;
}
.ws-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}
.ws-head-left {
  display: flex;
  align-items: center;
  gap: 10px;
}
.back {
  flex-shrink: 0;
}
.ws-head h1 {
  font-size: 19px;
}
.ws-sub {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  margin-top: 3px;
  flex-wrap: wrap;
}
.mono {
  font-family: var(--mono);
}
.counsel-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--amber-soft);
  border: 1px solid rgba(245, 158, 11, 0.5);
  border-radius: var(--radius);
  color: #fbc65d;
  padding: 12px 16px;
  margin-bottom: 14px;
  font-size: 13.5px;
}
.counsel-banner p {
  flex: 1;
}
.ws-grid {
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr) 340px;
  gap: 16px;
  align-items: start;
}
.ws-right {
  display: flex;
  flex-direction: column;
  gap: 14px;
  position: sticky;
  top: 68px;
}
@media (max-width: 1200px) {
  .ws-grid {
    grid-template-columns: 280px minmax(0, 1fr);
  }
  .ws-right {
    grid-column: 1 / -1;
    position: static;
    display: grid;
    grid-template-columns: 1fr 1fr;
    align-items: start;
  }
}
@media (max-width: 860px) {
  .ws-grid {
    grid-template-columns: 1fr;
  }
  .ws-right {
    grid-template-columns: 1fr;
  }
}
</style>
