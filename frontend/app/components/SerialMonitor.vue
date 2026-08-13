<template>
  <div class="serial-monitor" id="section-monitor">
    <div class="serial-monitor-header">
      <div class="serial-monitor-title">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>
        </svg>
        Serial Monitor
      </div>
      <div style="display:flex;gap:0.5rem;align-items:center;">
        <span style="font-size:0.7rem;color:#484F58;">{{ lines.length }} lines</span>
        <button
          style="background:none;border:none;color:#8B949E;cursor:pointer;font-size:0.7rem;padding:0.2rem 0.4rem;border-radius:4px;transition:background 0.1s;"
          @click="lines = []"
          title="Clear"
        >
          Clear
        </button>
        <button
          style="background:none;border:none;color:#8B949E;cursor:pointer;font-size:0.7rem;padding:0.2rem 0.4rem;border-radius:4px;transition:background 0.1s;"
          @click="autoscroll = !autoscroll"
          :style="{ color: autoscroll ? '#22C55E' : '#8B949E' }"
          :title="autoscroll ? 'Autoscroll: ON' : 'Autoscroll: OFF'"
        >
          {{ autoscroll ? 'Auto ↓' : 'Manual' }}
        </button>
      </div>
    </div>

    <div class="serial-monitor-body" ref="bodyEl">
      <div v-if="lines.length === 0" class="serial-line sys">
        <span class="content">Waiting for Bluetooth connection…</span>
      </div>
      <div
        v-for="(line, i) in lines"
        :key="i"
        class="serial-line"
        :class="line.dir === '>' ? 'tx' : line.dir === '<' ? 'rx' : 'sys'"
      >
        <span class="dir">{{ line.dir }}</span>
        <span class="ts">{{ line.ts }}</span>
        <span class="content">{{ line.text }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface LogLine { dir: string; ts: string; text: string }

const ws        = useWebSocket();
const lines     = ref<LogLine[]>([]);
const autoscroll= ref(true);
const bodyEl    = ref<HTMLElement | null>(null);
const MAX_LINES = 200;

function formatTs(epoch: number): string {
  const d = new Date(epoch);
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
}

function addLine(dir: string, text: string, ts?: number) {
  lines.value.push({ dir, ts: formatTs(ts ?? Date.now()), text });
  if (lines.value.length > MAX_LINES) lines.value.splice(0, lines.value.length - MAX_LINES);
  if (autoscroll.value) {
    nextTick(() => {
      if (bodyEl.value) bodyEl.value.scrollTop = bodyEl.value.scrollHeight;
    });
  }
}

let unsubLog:    (() => void) | null = null;
let unsubConn:   (() => void) | null = null;
let unsubDisc:   (() => void) | null = null;
let unsubReady:  (() => void) | null = null;
let unsubReconn: (() => void) | null = null;

onMounted(() => {
  unsubLog    = ws.on('log',          (e) => addLine(e.direction as string, e.line as string, e.ts as number));
  unsubConn   = ws.on('connected',    (e) => addLine('·', `Bluetooth connected — port ${String(e.port ?? '')}`, Date.now()));
  unsubDisc   = ws.on('disconnected', ()  => addLine('·', 'Bluetooth disconnected', Date.now()));
  unsubReady  = ws.on('ready',        ()  => addLine('·', 'Arduino sent READY — device booted/reset', Date.now()));
  unsubReconn = ws.on('reconnecting', (e) => addLine('·', `Reconnecting… attempt ${e.attempt}/${e.max}`, Date.now()));
});

onUnmounted(() => {
  unsubLog?.();
  unsubConn?.();
  unsubDisc?.();
  unsubReady?.();
  unsubReconn?.();
});
</script>
