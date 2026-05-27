<script setup lang="ts">
import { ref, onMounted }from "vue";
import { loadFullMetadata } from "maimai_music_metadata";

const metadata = ref<any>(null);
const loading = ref(true);
const error = ref<any>(null);

onMounted(async () => {
  try {
    metadata.value = await loadFullMetadata();
  } catch (e) {
    error.value = e;
    console.error("Failed to load metadata:", e);
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="container">
    <h1>maimai song query resolver (try)</h1>
    <div v-if="loading">Loading metadata...</div>
    <div v-else-if="error">Error: {{ error }}</div>
    <div v-else>
      <pre>{{ JSON.stringify(metadata, null, 2) }}</pre>
    </div>
  </div>
</template>

<style scoped>
.container {
  padding: 2rem;
  font-family: sans-serif;
}

pre {
  background: #f4f4f4;
  padding: 1rem;
  border-radius: 4px;
  overflow: auto;
  max-height: 80vh;
}
</style>
