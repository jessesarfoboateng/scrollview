<template>
  <div class="app-shell">
    <!-- Mobile sidebar backdrop -->
    <div
      class="sidebar-mobile-overlay"
      :class="{ active: sidebarOpen }"
      @click="sidebarOpen = false"
    />

    <!-- Sidebar -->
    <aside class="app-sidebar" :class="{ 'mobile-open': sidebarOpen }">
      <!-- Logo -->
      <div class="sidebar-logo">
        <div class="sidebar-logo-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <rect x="2" y="6" width="20" height="12" rx="2" fill="white" opacity="0.9"/>
            <rect x="4" y="8" width="3" height="3" rx="0.5" fill="#111827"/>
            <rect x="8" y="8" width="3" height="3" rx="0.5" fill="#111827"/>
            <rect x="12" y="8" width="3" height="3" rx="0.5" fill="#111827"/>
            <rect x="16" y="8" width="3" height="3" rx="0.5" fill="#111827" opacity="0.4"/>
            <rect x="4" y="13" width="3" height="3" rx="0.5" fill="#111827" opacity="0.4"/>
            <rect x="8" y="13" width="3" height="3" rx="0.5" fill="#111827"/>
            <rect x="12" y="13" width="3" height="3" rx="0.5" fill="#111827"/>
            <rect x="16" y="13" width="3" height="3" rx="0.5" fill="#111827"/>
          </svg>
        </div>
        <span class="sidebar-logo-text">ScrollView</span>
      </div>

      <!-- Nav -->
      <span class="sidebar-section-label">Control</span>
      <nav class="sidebar-nav">
        <NuxtLink to="/" class="sidebar-nav-item" active-class="active" @click="sidebarOpen = false">
          <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="7" rx="1"/>
            <rect x="14" y="3" width="7" height="7" rx="1"/>
            <rect x="3" y="14" width="7" height="7" rx="1"/>
            <rect x="14" y="14" width="7" height="7" rx="1"/>
          </svg>
          Dashboard
        </NuxtLink>
        <NuxtLink to="/messages" class="sidebar-nav-item" active-class="active" @click="sidebarOpen = false">
          <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          Messages
          <span v-if="state.messages.value.length" class="badge badge-neutral" style="margin-left:auto;font-size:0.7rem;padding:0.1em 0.5em;">{{ state.messages.value.length }}</span>
        </NuxtLink>
        <NuxtLink to="/controls" class="sidebar-nav-item" active-class="active" @click="sidebarOpen = false">
          <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
          </svg>
          Display Controls
        </NuxtLink>
        <NuxtLink to="/monitor" class="sidebar-nav-item" active-class="active" @click="sidebarOpen = false">
          <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>
          </svg>
          Serial Monitor
        </NuxtLink>
      </nav>

      <div class="sidebar-footer">
        <div class="status-dot" :class="state.connectionStatus.value">
          {{ statusLabel }}
        </div>
        <div v-if="state.connectedPort.value" style="font-size:0.725rem;color:var(--color-text-muted);margin-top:0.25rem;">
          {{ state.connectedPort.value }}
        </div>
      </div>
    </aside>

    <!-- Main area -->
    <div class="app-main">
      <!-- Header -->
      <header class="app-header">
        <!-- Mobile hamburger -->
        <button class="btn btn-ghost btn-icon hamburger-btn" @click="sidebarOpen = !sidebarOpen">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
        <div>
          <h1 style="font-size:0.9375rem;font-weight:600;">LED Notice Board Controller</h1>
          <p style="font-size:0.75rem;color:var(--color-text-muted);">Bluetooth SPP · HC-05/HC-06 · Arduino Mega</p>
        </div>
        <div class="flex items-center gap-3">
          <span class="status-dot" :class="state.connectionStatus.value">{{ statusLabel }}</span>
        </div>
      </header>

      <!-- Page content -->
      <main class="app-content">
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
const state = useBoardState();
const sidebarOpen = ref(false);

const statusLabel = computed(() => {
  switch (state.connectionStatus.value) {
    case 'connected':    return 'Connected';
    case 'reconnecting': return 'Reconnecting…';
    default:             return 'Disconnected';
  }
});

const route = useRoute();
watch(() => route.path, () => {
  sidebarOpen.value = false;
});

onMounted(() => {
  state.init();
});
</script>

<style scoped>
/* Only show hamburger on mobile */
.hamburger-btn {
  display: none;
}
@media (max-width: 768px) {
  .hamburger-btn {
    display: inline-flex;
  }
}
</style>
