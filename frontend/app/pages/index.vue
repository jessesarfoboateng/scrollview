<template>
  <div class="page-container">
    <!-- Reconnecting banner -->
    <div v-if="state.connectionStatus.value === 'reconnecting'"
         style="background:var(--color-amber-bg);border:1px solid var(--color-amber);border-radius:var(--radius-sm);padding:0.625rem 1rem;margin-bottom:1.25rem;display:flex;align-items:center;gap:0.625rem;font-size:0.8125rem;color:var(--color-amber);">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="flex-shrink:0;">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <strong>Reconnecting to Bluetooth device…</strong> The LED display continues operating independently.
    </div>

    <div class="dashboard-grid">
      <!-- Left side: Connection Panel -->
      <div class="panel-section">
        <ConnectionPanel />
      </div>

      <!-- Right side: Status Cards & Quick Info -->
      <div class="panel-section flex-col gap-4">
        <StatusCard />
        
        <div class="card bg-surface">
          <div class="card-title">Quick Actions</div>
          <p style="font-size: 0.85rem; color: var(--color-text-secondary); margin-bottom: 1rem;">
            Quickly navigate to manage messages or adjust display speeds and modes.
          </p>
          <div class="flex gap-2">
            <NuxtLink to="/messages" class="btn btn-primary" style="flex:1; text-align:center;">Manage Messages</NuxtLink>
            <NuxtLink to="/controls" class="btn btn-secondary" style="flex:1; text-align:center;">Speed Controls</NuxtLink>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
useHead({ title: 'Dashboard — ScrollView' });
const state = useBoardState();
</script>

<style scoped>
.page-container {
  max-width: 1200px;
  margin: 0 auto;
}
.dashboard-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  align-items: start;
}
@media (max-width: 900px) {
  .dashboard-grid {
    grid-template-columns: 1fr;
  }
}
.panel-section {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}
</style>
