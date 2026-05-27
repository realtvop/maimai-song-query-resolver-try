<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { loadFullMetadata } from "maimai_music_metadata";
import type { Music, MusicMetadata, MusicDifficultyID } from "maimai_music_metadata";
import { searchCharts, type ChartSearchResult } from "./core";

const metadata = ref<MusicMetadata | null>(null);
const loading = ref(true);
const error = ref<any>(null);
const searchQuery = ref("");
const selectedMusic = ref<Music | null>(null);
const dialogRef = ref<HTMLDialogElement | null>(null);

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

const filteredCharts = computed(() => {
  if (!metadata.value) return [];
  return searchCharts(searchQuery.value, metadata.value.musics, metadata.value.versions);
});

const selectedMusicJson = computed(() => {
  if (!selectedMusic.value) return "";
  return JSON.stringify(selectedMusic.value, null, 2);
});

const difficultyLabels: Record<number, string> = {
  0: "BASIC",
  1: "ADVANCED",
  2: "EXPERT",
  3: "MASTER",
  4: "Re:MASTER",
  10: "UTAGE",
};

function getCoverUrl(id: number) {
  return `https://meta.salt.realtvop.top/covers/00${id.toString().padStart(6, "0").substring(2)}.png`;
}

function difficultyLabel(difficulty: MusicDifficultyID) {
  return difficultyLabels[difficulty] ?? `DIFFICULTY ${difficulty}`;
}

function chartTypeLabel(type: ChartSearchResult["chart"]["type"]) {
  return type.toUpperCase();
}

function formatInternalLevel(level: number) {
  return level.toFixed(1);
}

function difficultyClass(difficulty: MusicDifficultyID) {
  return `difficulty-${difficulty}`;
}

function chartResultKey(result: ChartSearchResult) {
  return [
    result.music.id,
    result.chart.type,
    result.chart.difficulty,
    result.chart.version ?? "none",
    result.chart.level,
  ].join("-");
}

function openMusicJson(music: Music) {
  selectedMusic.value = music;

  if (!dialogRef.value?.open) {
    dialogRef.value?.showModal();
  }
}

function closeMusicJson() {
  dialogRef.value?.close();
}

function hideBrokenCover(event: Event) {
  const image = event.currentTarget;

  if (image instanceof HTMLImageElement) {
    image.hidden = true;
  }
}
</script>

<template>
  <div class="container">
    <h1>maimai song query resolver</h1>
    
    <div v-if="loading">Loading metadata...</div>
    <div v-else-if="error">Error: {{ error }}</div>
    <div v-else>
      <div class="search-bar">
        <input 
          type="text" 
          v-model="searchQuery" 
          placeholder="Search" 
          class="search-input"
        />
        <span class="count-badge">Charts: {{ filteredCharts.length }}</span>
      </div>

      <div v-if="filteredCharts.length > 0" class="result-grid">
        <button
          v-for="result in filteredCharts"
          :key="chartResultKey(result)"
          type="button"
          :class="['chart-card', difficultyClass(result.chart.difficulty)]"
          :aria-label="`${result.music.title} ${difficultyLabel(result.chart.difficulty)}`"
          @click="openMusicJson(result.music)"
        >
          <span class="cover-frame" aria-hidden="true">
            <img
              class="cover-image"
              :src="getCoverUrl(result.music.id)"
              :alt="result.music.title"
              loading="lazy"
              @error="hideBrokenCover"
            />
          </span>

          <span class="card-content">
            <span class="card-title-row">
              <span class="card-title">{{ result.music.title }}</span>
              <span class="music-id">#{{ result.music.id }}</span>
            </span>

            <span class="artist-line">{{ result.music.artist }}</span>

            <span class="chart-line">
              <span class="difficulty-name">{{ difficultyLabel(result.chart.difficulty) }}</span>
              <span class="internal-level">{{ formatInternalLevel(result.chart.internalLevel) }}</span>
              <span>{{ chartTypeLabel(result.chart.type) }}</span>
              <span>{{ result.chart.version ?? "未知版本" }}</span>
            </span>

            <span class="designer-line">
              {{ result.chart.noteDesigner }}
            </span>
          </span>
        </button>
      </div>

      <p v-else class="empty-state">No results</p>
    </div>

    <dialog ref="dialogRef" class="music-dialog">
      <div class="dialog-header">
        <h2>{{ selectedMusic?.title }}</h2>
        <button type="button" class="dialog-close" aria-label="Close" @click="closeMusicJson">
          x
        </button>
      </div>
      <pre class="json-block">{{ selectedMusicJson }}</pre>
    </dialog>
  </div>
</template>

<style scoped>
:global(*) {
  box-sizing: border-box;
}

.container {
  --difficulty-0-color: #96d767;
  --difficulty-1-color: #eeba41;
  --difficulty-2-color: #ef888f;
  --difficulty-3-color: #b54fdf;
  --difficulty-4-color: #d3acf9;
  --difficulty-5-color: #ee78f6;
  --difficulty-10-color: #ff6b9b;

  min-height: 100vh;
  padding: 32px;
  background: #ffffff;
  color: #171717;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

h1 {
  margin: 0 0 24px;
  font-size: 1.35rem;
  font-weight: 650;
  line-height: 1.2;
}

.search-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.search-input {
  width: min(420px, 100%);
  height: 42px;
  padding: 0 12px;
  border: 1px solid #b8b8b8;
  border-radius: 6px;
  background: #ffffff;
  color: inherit;
  font: inherit;
}

.search-input:focus {
  border-color: #171717;
  outline: 2px solid #171717;
  outline-offset: 1px;
}

.count-badge {
  display: inline-flex;
  min-height: 42px;
  align-items: center;
  padding: 0 12px;
  border: 1px solid #d5d5d5;
  border-radius: 6px;
  color: #404040;
  font-size: 0.92rem;
  font-weight: 600;
}

.result-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}

.chart-card {
  position: relative;
  display: grid;
  grid-template-columns: 88px minmax(0, 1fr);
  gap: 12px;
  width: 100%;
  min-height: 118px;
  padding: 12px;
  overflow: hidden;
  border: 1px solid rgb(0 0 0 / 20%);
  border-radius: 6px;
  background: var(--chart-difficulty-color, #ffffff);
  color: #171717;
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.chart-card::before {
  position: absolute;
  inset: 0;
  background: rgb(255 255 255 / 52%);
  content: "";
  pointer-events: none;
}

.chart-card > * {
  position: relative;
  z-index: 1;
}

.difficulty-0 {
  --chart-difficulty-color: var(--difficulty-0-color);
}

.difficulty-1 {
  --chart-difficulty-color: var(--difficulty-1-color);
}

.difficulty-2 {
  --chart-difficulty-color: var(--difficulty-2-color);
}

.difficulty-3 {
  --chart-difficulty-color: var(--difficulty-3-color);
}

.difficulty-4 {
  --chart-difficulty-color: var(--difficulty-4-color);
}

.difficulty-5 {
  --chart-difficulty-color: var(--difficulty-5-color);
}

.difficulty-10 {
  --chart-difficulty-color: var(--difficulty-10-color);
}

.chart-card:hover,
.chart-card:focus-visible {
  border-color: #171717;
}

.chart-card:focus-visible {
  outline: 2px solid #171717;
  outline-offset: 2px;
}

.cover-frame {
  display: block;
  width: 88px;
  aspect-ratio: 1;
  overflow: hidden;
  border: 1px solid #d8d8d8;
  border-radius: 4px;
  background: #f3f3f3;
}

.cover-image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.card-content {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 6px;
}

.card-title-row {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.card-title {
  min-width: 0;
  overflow-wrap: anywhere;
  font-size: 0.98rem;
  font-weight: 650;
  line-height: 1.22;
}

.music-id {
  flex: 0 0 auto;
  color: rgb(0 0 0 / 68%);
  font-size: 0.82rem;
  line-height: 1.4;
}

.artist-line {
  display: block;
  min-width: 0;
  overflow: hidden;
  color: rgb(0 0 0 / 76%);
  font-size: 0.82rem;
  font-weight: 520;
  line-height: 1.22;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chart-line {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 5px 8px;
  min-width: 0;
  color: rgb(0 0 0 / 74%);
  font-size: 0.76rem;
  font-weight: 650;
  line-height: 1.18;
}

.difficulty-name {
  color: #171717;
  font-size: 0.83rem;
  letter-spacing: 0;
}

.internal-level {
  color: #171717;
  font-size: 1.16rem;
  font-weight: 760;
}

.designer-line {
  display: block;
  min-width: 0;
  margin-top: auto;
  overflow: hidden;
  color: rgb(0 0 0 / 70%);
  font-size: 0.78rem;
  font-weight: 560;
  line-height: 1.18;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.empty-state {
  margin: 28px 0 0;
  color: #606060;
}

.music-dialog {
  width: min(920px, calc(100vw - 32px));
  max-height: min(760px, calc(100vh - 32px));
  padding: 0;
  border: 1px solid #b8b8b8;
  border-radius: 6px;
  background: #ffffff;
  color: #171717;
}

.music-dialog::backdrop {
  background: rgb(0 0 0 / 25%);
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid #d8d8d8;
}

.dialog-header h2 {
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
  font-size: 1rem;
  font-weight: 650;
  line-height: 1.25;
}

.dialog-close {
  display: inline-grid;
  flex: 0 0 auto;
  width: 32px;
  height: 32px;
  place-items: center;
  border: 1px solid #b8b8b8;
  border-radius: 4px;
  background: #ffffff;
  color: #171717;
  cursor: pointer;
  font: inherit;
}

.dialog-close:hover,
.dialog-close:focus-visible {
  border-color: #171717;
}

.dialog-close:focus-visible {
  outline: 2px solid #171717;
  outline-offset: 2px;
}

.json-block {
  max-height: calc(min(760px, 100vh - 32px) - 61px);
  margin: 0;
  padding: 16px;
  overflow: auto;
  background: #f7f7f7;
  color: #171717;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
  font-size: 0.84rem;
  line-height: 1.45;
}

@media (max-width: 620px) {
  .container {
    padding: 18px;
  }

  .search-input,
  .count-badge {
    width: 100%;
  }

  .result-grid {
    grid-template-columns: 1fr;
  }

  .chart-card {
    grid-template-columns: 76px minmax(0, 1fr);
    gap: 12px;
  }

  .cover-frame {
    width: 76px;
  }
}
</style>
