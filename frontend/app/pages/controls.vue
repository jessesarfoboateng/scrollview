<template>
  <div class="page-container">
    <div class="controls-layout">
      <SpeedControl />
    </div>
  </div>
</template>

<script setup lang="ts">
useHead({ title: 'Display Controls — ScrollView' });
</script>

<style scoped>
.page-container {
  max-width: 600px;
  margin: 0 auto;
}
.controls-layout {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}
</style>
