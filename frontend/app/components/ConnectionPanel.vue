<template>
  <div class="card" id="section-connection">
    <div class="card-header">
      <div>
        <div class="card-title">Bluetooth Connection</div>
        <div class="card-subtitle">Select the paired HC-05/HC-06 virtual COM port</div>
      </div>
      <button class="btn btn-ghost btn-icon" :class="{ 'spin': loadingPorts }" @click="loadPorts" title="Refresh ports">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
        </svg>
      </button>
    </div>

    <!-- Port selector -->
    <div class="form-group" style="margin-bottom:0.875rem;">
      <label class="form-label">Serial Port</label>
      <div class="flex gap-2">
        <div style="flex:1; position:relative;">
          <select
            v-model="selectedPort"
            class="form-input form-select"
            :disabled="loadingPorts"
            @mousedown="checkSwitch"
          >
            <option value="" disabled>{{ loadingPorts ? 'Loading ports…' : 'Select a COM port' }}</option>
            <option v-for="p in ports" :key="p.path" :value="p.path">
              {{ p.path }}{{ p.manufacturer ? ` — ${p.manufacturer}` : '' }}
            </option>
          </select>
        </div>
        <button
          v-if="state.connectionStatus.value !== 'connected'"
          class="btn btn-primary"
          style="white-space:nowrap;"
          :disabled="!selectedPort || connecting"
          @click="doConnect"
        >
          {{ connecting ? 'Connecting…' : 'Connect' }}
        </button>
        <button
          v-else
          class="btn btn-secondary"
          style="white-space:nowrap;"
          :disabled="disconnecting"
          @click="doDisconnect"
        >
          {{ disconnecting ? 'Disconnecting…' : 'Disconnect' }}
        </button>
      </div>
    </div>

    <!-- Switch Tip Notice -->
    <div v-if="state.connectionStatus.value === 'connected' && showSwitchTip" 
         style="margin-bottom: 0.875rem; padding: 0.625rem 0.75rem; background: var(--color-blue-bg); border: 1px solid var(--color-blue); border-radius: var(--radius-sm); font-size: 0.8rem; color: var(--color-blue); line-height: 1.4;">
      💡 <strong>Want to switch ports?</strong> Please click the <strong>Disconnect</strong> button first before choosing another COM port.
    </div>

    <!-- Status bar -->
    <div style="display:flex;align-items:center;gap:0.75rem;padding:0.625rem 0.75rem;background:var(--color-bg);border-radius:var(--radius-sm);border:1px solid var(--color-border);">
      <span class="status-dot" :class="state.connectionStatus.value">{{ statusLabel }}</span>
      <span v-if="errorMsg" style="font-size:0.8rem;color:var(--color-red);margin-left:auto;font-weight: 500;">⚠️ {{ errorMsg }}</span>
    </div>

    <!-- Hint when disconnected -->
    <p v-if="state.connectionStatus.value === 'disconnected' && ports.length === 0 && !loadingPorts"
       style="font-size:0.775rem;color:var(--color-text-muted);margin-top:0.625rem;line-height:1.5;">
      No ports found. Make sure the HC-05/HC-06 is <strong>paired</strong> in Windows Bluetooth settings first, then click refresh.
    </p>
  </div>
</template>

<script setup lang="ts">
interface Port { path: string; manufacturer?: string }

const api   = useApi();
const state = useBoardState();

const ports        = ref<Port[]>([]);
const selectedPort = ref('');
const loadingPorts = ref(false);
const connecting   = ref(false);
const disconnecting= ref(false);
const errorMsg     = ref('');
const showSwitchTip = ref(false);

function checkSwitch(event: MouseEvent) {
  if (state.connectionStatus.value === 'connected') {
    event.preventDefault(); // prevent dropdown from opening
    showSwitchTip.value = true;
    setTimeout(() => {
      showSwitchTip.value = false;
    }, 4500);
  }
}

const statusLabel = computed(() => {
  switch (state.connectionStatus.value) {
    case 'connected':    return 'Connected';
    case 'reconnecting': return 'Reconnecting…';
    default:             return 'Disconnected';
  }
});

async function loadPorts() {
  loadingPorts.value = true;
  errorMsg.value     = '';
  const res = await api.getPorts();
  if (res.ok && res.data) {
    ports.value = (res.data as { ports: Port[] }).ports;
  } else {
    errorMsg.value = res.error ?? 'Failed to list ports';
  }
  loadingPorts.value = false;
}

async function doConnect() {
  if (!selectedPort.value) return;
  connecting.value = true;
  errorMsg.value   = '';
  const res = await api.connect(selectedPort.value);
  if (res.ok) {
    state.setConnectionStatus('connected', selectedPort.value);
    errorMsg.value = '';
  } else {
    // Extract the most useful error message from the response
    const raw = (res.error ?? 'Connection failed');
    errorMsg.value = raw.includes('PING timeout')
      ? 'Arduino did not respond. Check it is powered on and HC-05 is wired correctly.'
      : raw.includes('Cannot open port')
        ? 'Cannot open port. Is the device paired? Is another app using this port?'
        : raw;
  }
  connecting.value = false;
}

async function doDisconnect() {
  disconnecting.value = true;
  errorMsg.value      = '';
  await api.disconnect();
  state.setConnectionStatus('disconnected');
  disconnecting.value = false;
}

// If backend says already connected on WS init, reflect that in the UI
watch(
  () => state.connectedPort.value,
  (port) => { if (port) selectedPort.value = port; },
  { immediate: true },
);

onMounted(() => loadPorts());
</script>

<style scoped>
@keyframes spin { to { transform: rotate(360deg); } }
.spin { animation: spin 0.8s linear infinite; }
</style>
