<template>
  <div class="page-container">
    <div class="monitor-layout">
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <span style="font-size:0.95rem;font-weight:600;color:var(--color-text-secondary);">Serial Monitor</span>
        <span class="badge badge-neutral">Debug Channel</span>
      </div>
      <SerialMonitor />
    </div>
  </div>
</template>

<script setup lang="ts">
useHead({ title: 'Serial Monitor — ScrollView' });
</script>

<style scoped>
.page-container {
  max-width: 900px;
  margin: 0 auto;
}
.monitor-layout {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
</style>
