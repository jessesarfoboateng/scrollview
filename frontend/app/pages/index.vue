<template>
  <div>
    <!-- Reconnecting banner -->
    <div v-if="state.connectionStatus.value === 'reconnecting'"
         style="background:var(--color-amber-bg);border:1px solid var(--color-amber);border-radius:var(--radius-sm);padding:0.625rem 1rem;margin-bottom:1.25rem;display:flex;align-items:center;gap:0.625rem;font-size:0.8125rem;color:var(--color-amber);">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="flex-shrink:0;">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <strong>Reconnecting to Bluetooth device…</strong> The LED display continues operating independently.
    </div>

    <!-- Dashboard grid: 2-col on desktop -->
    <div class="dashboard-grid">
      <!-- Left column -->
      <div style="display:flex;flex-direction:column;gap:1rem;">

        <!-- Connection panel -->
        <section id="section-dashboard">
          <ConnectionPanel />
        </section>

        <!-- Status stats -->
        <StatusCard />

        <!-- Speed / display controls -->
        <SpeedControl />

      </div>

      <!-- Right column -->
      <div style="display:flex;flex-direction:column;gap:1rem;">

        <!-- Message manager -->
        <MessageManager />

        <!-- Serial monitor -->
        <div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.5rem;">
            <span style="font-size:0.8125rem;font-weight:600;color:var(--color-text-secondary);">Serial Monitor</span>
            <span class="badge badge-neutral">Debug</span>
          </div>
          <SerialMonitor />
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
.dashboard-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  align-items: start;
}

@media (max-width: 900px) {
  .dashboard-grid {
    grid-template-columns: 1fr;
  }
}
</style>
