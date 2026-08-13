<template>
  <div class="card" id="section-controls">
    <div class="card-header">
      <div>
        <div class="card-title">Display Controls</div>
        <div class="card-subtitle">Speed &amp; mode settings</div>
      </div>
    </div>

    <!-- LED preview -->
    <div class="led-preview" style="margin-bottom:1rem;">
      <div
        class="led-preview-text"
        :class="{ scrolling: previewScrolling }"
        :style="{ '--scroll-duration': scrollDuration }"
      >
        {{ previewText }}
      </div>
    </div>

    <!-- Speed control mode -->
    <div class="form-group" style="margin-bottom:1rem;">
      <label class="form-label">Speed Control Mode</label>
      <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
        <button
          class="btn"
          :class="localMode === 'potentiometer' ? 'btn-primary' : 'btn-secondary'"
          :disabled="!connected || savingMode"
          @click="setLocalMode('potentiometer')"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
          </svg>
          Potentiometer
        </button>
        <button
          class="btn"
          :class="localMode === 'computer' ? 'btn-primary' : 'btn-secondary'"
          :disabled="!connected || savingMode"
          @click="setLocalMode('computer')"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
          Computer
        </button>
      </div>
      <p style="font-size:0.775rem;color:var(--color-text-muted);margin-top:0.375rem;">
        {{ localMode === 'potentiometer'
          ? 'Physical dial controls scroll speed. The slider below has no effect.'
          : 'Use the slider below to set scroll speed remotely.' }}
      </p>
    </div>

    <!-- Speed slider (computer mode only) -->
    <div class="form-group" style="margin-bottom:1rem;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;">
        <label class="form-label" style="margin:0;">Scroll Speed</label>
        <span style="font-size:0.8rem;font-weight:600;color:var(--color-text-primary);">{{ localSpeed }}</span>
      </div>
      <div style="display:flex;align-items:center;gap:0.75rem;">
        <span style="font-size:0.75rem;color:var(--color-text-muted);">Slow</span>
        <input
          type="range"
          class="speed-slider"
          min="1"
          max="100"
          :value="localSpeed"
          :disabled="localMode !== 'computer' || !connected"
          @input="onSliderInput"
          @change="commitSpeed"
        />
        <span style="font-size:0.75rem;color:var(--color-text-muted);">Fast</span>
      </div>
    </div>

    <p v-if="errorMsg" style="font-size:0.8rem;color:var(--color-red);">{{ errorMsg }}</p>
  </div>
</template>

<script setup lang="ts">
const api   = useApi();
const state = useBoardState();

const connected  = computed(() => state.connectionStatus.value === 'connected');
const localSpeed = ref(50);
const localMode  = ref<'potentiometer' | 'computer'>('potentiometer');
const savingMode = ref(false);
const errorMsg   = ref('');

// LED preview text
const messages    = computed(() => state.messages.value);
const previewText = computed(() => {
  const active = state.activeMessageId.value;
  if (active !== null) {
    const msg = messages.value.find((m) => m.id === active);
    if (msg) return msg.text + '   ';
  }
  if (messages.value.length > 0) return messages.value[0].text + '   ';
  return 'SCROLLVIEW   ';
});

const previewScrolling = computed(() => previewText.value.trim().length > 0);
const scrollDuration   = computed(() => {
  // Invert: speed 100 = 4s, speed 1 = 20s
  const s = localSpeed.value;
  const d = 20 - ((s - 1) / 99) * 16;
  return `${d.toFixed(1)}s`;
});

// Sync from board status
watch(() => state.boardStatus.value, (s) => {
  if (!s) return;
  localSpeed.value = s.speed;
  localMode.value  = s.mode;
}, { immediate: true });

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function onSliderInput(e: Event) {
  localSpeed.value = Number((e.target as HTMLInputElement).value);
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => commitSpeed(), 300);
}

async function commitSpeed() {
  if (localMode.value !== 'computer' || !connected.value) return;
  errorMsg.value = '';
  const res = await api.setSpeed(localSpeed.value);
  if (!res.ok) errorMsg.value = res.error ?? 'Failed to set speed';
}

async function setLocalMode(mode: 'potentiometer' | 'computer') {
  if (!connected.value) return;
  localMode.value  = mode;
  savingMode.value = true;
  errorMsg.value   = '';
  const res = await api.setMode(mode);
  if (!res.ok) errorMsg.value = res.error ?? 'Failed to set mode';
  savingMode.value = false;
}
</script>
