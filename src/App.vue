<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { loadFullMetadata } from "maimai_music_metadata";
import type { MusicMetadata } from "maimai_music_metadata";
import { searchMusic } from "./core";

const metadata = ref<MusicMetadata | null>(null);
const loading = ref(true);
const error = ref<any>(null);
const searchQuery = ref("");

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

const filteredMusics = computed(() => {
  if (!metadata.value) return [];
  return searchMusic(searchQuery.value, metadata.value.musics);
});
</script>

<template>
  <div class="container">
    <h1>maimai song query resolver (try)</h1>
    
    <div v-if="loading">Loading metadata...</div>
    <div v-else-if="error">Error: {{ error }}</div>
    <div v-else>
      <div class="search-bar">
        <input 
          type="text" 
          v-model="searchQuery" 
          placeholder="Search by song name, artist, alias, or ID..." 
          class="search-input"
        />
        <span class="count-badge">Found: {{ filteredMusics.length }}</span>
      </div>
      <pre>{{ JSON.stringify(filteredMusics, null, 2) }}</pre>
    </div>
  </div>
</template>

<style scoped>
.container {
  padding: 2rem;
  font-family: sans-serif;
}

.search-bar {
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.search-input {
  padding: 0.5rem;
  font-size: 1rem;
  width: 300px;
}

.count-badge {
  font-weight: bold;
}

pre {
  background: #f4f4f4;
  padding: 1rem;
  border-radius: 4px;
  overflow: auto;
  max-height: 80vh;
}
</style>
