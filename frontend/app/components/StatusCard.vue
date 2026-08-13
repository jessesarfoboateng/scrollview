<template>
  <!-- Stats row -->
  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-label">Messages</div>
      <div class="stat-value">{{ status?.messages ?? '—' }}</div>
      <div class="stat-sub">stored in EEPROM</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Speed</div>
      <div class="stat-value">{{ status?.speed ?? '—' }}</div>
      <div class="stat-sub">out of 100</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Mode</div>
      <div class="stat-value" style="font-size:1rem;margin-top:0.25rem;">
        <span class="badge" :class="modeClass">{{ modeLabel }}</span>
      </div>
      <div class="stat-sub">speed control</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Connection</div>
      <div class="stat-value" style="font-size:1rem;margin-top:0.25rem;">
        <span class="status-dot" :class="state.connectionStatus.value">{{ connLabel }}</span>
      </div>
      <div class="stat-sub">{{ state.connectedPort.value ?? 'no port' }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
const state  = useBoardState();
const status = computed(() => state.boardStatus.value);

const modeLabel = computed(() =>
  status.value?.mode === 'computer' ? 'Computer' : 'Potentiometer',
);

const modeClass = computed(() =>
  status.value?.mode === 'computer' ? 'badge-blue' : 'badge-neutral',
);

const connLabel = computed(() => {
  switch (state.connectionStatus.value) {
    case 'connected':    return 'Online';
    case 'reconnecting': return 'Reconnecting';
    default:             return 'Offline';
  }
});
</script>
