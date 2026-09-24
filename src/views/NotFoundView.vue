<script setup lang="ts">
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

/** Any URL the app doesn't know — a typo, an old link, /privacy. Says so plainly instead
 *  of silently dropping the visitor on the landing page. Works signed in or out. */
const auth = useAuthStore()
const route = useRoute()
</script>

<template>
  <div class="nf">
    <div class="nf-card card">
      <p class="code mono">404</p>
      <h1>Page not found</h1>
      <p class="muted">
        There's no page at <span class="mono path">{{ route.path }}</span>. The link may be
        mistyped or out of date.
      </p>
      <div class="nf-actions">
        <template v-if="auth.isAuthed">
          <RouterLink :to="{ name: 'cases' }" class="btn btn-primary">Go to your cases</RouterLink>
        </template>
        <template v-else>
          <RouterLink :to="{ name: 'welcome' }" class="btn btn-primary">Go to the home page</RouterLink>
          <RouterLink :to="{ name: 'login' }" class="btn">Sign in</RouterLink>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.nf {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px 16px;
}
.nf-card {
  max-width: 460px;
  width: 100%;
  padding: 32px 28px;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.code {
  font-size: 13px;
  letter-spacing: 0.2em;
  color: var(--text-faint);
}
h1 {
  font-size: 24px;
  letter-spacing: -0.015em;
}
.path {
  font-size: 13px;
  word-break: break-all;
  color: var(--text);
}
.nf-actions {
  display: flex;
  gap: 10px;
  justify-content: center;
  flex-wrap: wrap;
  margin-top: 8px;
}
.nf-actions a:hover {
  text-decoration: none;
}
</style>
