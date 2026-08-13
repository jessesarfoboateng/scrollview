<template>
  <div class="page-container">
    <div class="messages-layout">
      <!-- Active Message Status banner at the top -->
      <div v-if="state.activeMessageId.value !== null && state.activeMessageId.value !== 0" class="card active-banner-card">
        <span class="badge badge-blue">Now Displaying</span>
        <div class="active-text">
          "{{ activeMessageText }}"
        </div>
      </div>

      <MessageManager />
    </div>
  </div>
</template>

<script setup lang="ts">
useHead({ title: 'Messages — ScrollView' });
const state = useBoardState();

const activeMessageText = computed(() => {
  const activeId = state.activeMessageId.value;
  if (activeId === null) return '';
  const activeMsg = state.messages.value.find(m => m.id === activeId);
  return activeMsg ? activeMsg.text : `Message #${activeId}`;
});
</script>

<style scoped>
.page-container {
  max-width: 800px;
  margin: 0 auto;
}
.messages-layout {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}
.active-banner-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  background: var(--color-blue-bg);
  border-color: var(--color-blue);
  padding: 1rem;
}
.active-text {
  font-weight: 500;
  color: var(--color-blue);
  font-size: 0.95rem;
}
</style>
