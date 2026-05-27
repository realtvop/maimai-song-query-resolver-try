<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { loadFullMetadata } from "maimai_music_metadata";
import type { Music, MusicMetadata, MusicDifficultyID } from "maimai_music_metadata";
import { queryNeedsScoreData, searchCharts, type ChartSearchResult } from "./core";
import {
  parseSaltNetBackup,
  type ComboStatus,
  type LoadedScoreData,
  type LoadedScoreRecord,
  type RankRate,
  type SyncStatus,
} from "./scoreBackup";

const SCORE_BACKUP_STORAGE_KEY = "saltnet-score-backup-json";

const metadata = ref<MusicMetadata | null>(null);
const loading = ref(true);
const error = ref<unknown>(null);
const searchQuery = ref("");
const activeSearchQuery = ref("");
const selectedMusic = ref<Music | null>(null);
const dialogRef = ref<HTMLDialogElement | null>(null);
const scoreData = ref<LoadedScoreData | null>(null);
const scoreBackupError = ref<string | null>(null);
const importingScoreBackup = ref(false);

onMounted(async () => {
  try {
    const loadedMetadata = await loadFullMetadata();
    metadata.value = loadedMetadata;
    restoreSavedScoreBackup(loadedMetadata);
  } catch (e) {
    error.value = e;
    console.error("Failed to load metadata:", e);
  } finally {
    loading.value = false;
  }
});

const filteredCharts = computed(() => {
  if (!metadata.value) return [];
  return searchCharts(activeSearchQuery.value, metadata.value.musics, metadata.value.versions, {
    scores: scoreData.value,
  });
});

const scoreFilterNeedsImport = computed(() => {
  if (!metadata.value || scoreData.value) return false;
  return queryNeedsScoreData(activeSearchQuery.value, metadata.value.versions);
});

const scoreBackupStatus = computed(() => {
  if (!scoreData.value) return "未导入成绩";

  const name = scoreData.value.userName ?? "未知玩家";
  const unmatched = scoreData.value.unmatchedRecords > 0
    ? `，${scoreData.value.unmatchedRecords} 未匹配`
    : "";

  return `${name} / ${scoreData.value.matchedRecords}/${scoreData.value.sourceRecordCount} 谱面${unmatched}`;
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

const rankDisplayNames: Record<RankRate, string> = {
  d: "D",
  c: "C",
  b: "B",
  bb: "BB",
  bbb: "BBB",
  a: "A",
  aa: "AA",
  aaa: "AAA",
  s: "S",
  sp: "S+",
  ss: "SS",
  ssp: "SS+",
  sss: "SSS",
  sssp: "SSS+",
};

const comboDisplayNames: Record<ComboStatus, string> = {
  "": "",
  fc: "FC",
  fcp: "FC+",
  ap: "AP",
  app: "AP+",
};

const syncDisplayNames: Record<SyncStatus, string> = {
  "": "",
  sync: "SYNC",
  fs: "FS",
  fsp: "FS+",
  fsd: "FSDX",
  fsdp: "FSDX+",
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

function formatAchievement(achievement: number) {
  return `${achievement.toFixed(4).replace(/\.?0+$/, "")}%`;
}

function formatRankRate(rankRate: RankRate) {
  return rankDisplayNames[rankRate];
}

function formatComboStatus(status: ComboStatus) {
  return comboDisplayNames[status];
}

function formatSyncStatus(status: SyncStatus) {
  return syncDisplayNames[status];
}

function formatDxScoreTier(record: LoadedScoreRecord) {
  return `${record.dxScoreTier}星`;
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

function handleDialogClick(event: MouseEvent) {
  if (event.target === dialogRef.value) {
    closeMusicJson();
  }
}

function hideBrokenCover(event: Event) {
  const image = event.currentTarget;

  if (image instanceof HTMLImageElement) {
    image.hidden = true;
  }
}

function getErrorMessage(value: unknown) {
  return value instanceof Error ? value.message : String(value);
}

function loadScoreBackupText(text: string, loadedMetadata: MusicMetadata, persist: boolean) {
  const raw = JSON.parse(text);
  const parsed = parseSaltNetBackup(raw, loadedMetadata.musics, loadedMetadata.versions);

  scoreData.value = parsed;
  scoreBackupError.value = null;

  if (persist) {
    localStorage.setItem(SCORE_BACKUP_STORAGE_KEY, text);
  }
}

function restoreSavedScoreBackup(loadedMetadata: MusicMetadata) {
  const saved = localStorage.getItem(SCORE_BACKUP_STORAGE_KEY);
  if (!saved) return;

  try {
    loadScoreBackupText(saved, loadedMetadata, false);
  } catch (e) {
    scoreBackupError.value = `已保存的成绩备份无法读取：${getErrorMessage(e)}`;
  }
}

async function handleScoreBackupFile(event: Event) {
  const input = event.currentTarget;
  if (!(input instanceof HTMLInputElement)) return;

  const file = input.files?.[0];
  input.value = "";
  if (!file) return;

  if (!metadata.value) {
    scoreBackupError.value = "曲目数据还没有加载完成";
    return;
  }

  importingScoreBackup.value = true;

  try {
    const text = await file.text();
    loadScoreBackupText(text, metadata.value, true);
  } catch (e) {
    scoreBackupError.value = `导入失败：${getErrorMessage(e)}`;
  } finally {
    importingScoreBackup.value = false;
  }
}

function clearScoreBackup() {
  scoreData.value = null;
  scoreBackupError.value = null;
  localStorage.removeItem(SCORE_BACKUP_STORAGE_KEY);
}

function triggerSearch() {
  activeSearchQuery.value = searchQuery.value;
}

function clearSearch() {
  searchQuery.value = "";
  activeSearchQuery.value = "";
}
</script>

<template>
  <div class="container">
    <header class="header">
      <h1>maimai song query resolver</h1>
      <a
        href="https://github.com/realtvop/maimai-song-query-resolver-try"
        target="_blank"
        rel="noopener noreferrer"
        class="github-link"
        aria-label="GitHub Repository"
      >
        <svg class="github-icon" viewBox="0 0 16 16" width="20" height="20" aria-hidden="true">
          <path
            fill="currentColor"
            d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"
          />
        </svg>
        <span>GitHub</span>
      </a>
    </header>
    
    <div v-if="loading">Loading metadata...</div>
    <div v-else-if="error">Error: {{ getErrorMessage(error) }}</div>
    <div v-else>
      <div class="search-bar">
        <div class="search-box">
          <div class="search-input-wrapper">
            <input 
              type="text" 
              v-model="searchQuery" 
              placeholder="Search" 
              class="search-input"
              @keydown.enter="triggerSearch"
            />
            <button
              v-if="searchQuery"
              type="button"
              class="clear-input-button"
              @click="clearSearch"
              aria-label="Clear search"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="clear-icon">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <button
            type="button"
            class="search-button"
            @click="triggerSearch"
          >
            搜索
          </button>
        </div>
        <span class="count-badge">Charts: {{ filteredCharts.length }}</span>
        <label class="file-button" :class="{ disabled: importingScoreBackup }">
          <input
            type="file"
            accept="application/json,.json"
            class="file-input"
            :disabled="importingScoreBackup"
            @change="handleScoreBackupFile"
          />
          {{ importingScoreBackup ? "导入中..." : "导入 SaltNet 数据备份" }}
        </label>
        <span class="score-status" :class="{ loaded: scoreData }">{{ scoreBackupStatus }}</span>
        <button
          v-if="scoreData"
          type="button"
          class="clear-score-button"
          @click="clearScoreBackup"
        >
          清除成绩
        </button>
      </div>

      <div v-if="scoreFilterNeedsImport || scoreBackupError" class="score-messages">
        <p v-if="scoreFilterNeedsImport" class="score-alert">
          当前查询包含成绩条件，导入 SaltNet 成绩备份后才会按成绩筛选。
        </p>
        <p v-if="scoreBackupError" class="score-error">{{ scoreBackupError }}</p>
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

            <span v-if="result.scoreRecord" class="score-badges">
              <span class="score-pill rank-pill">{{ formatRankRate(result.scoreRecord.rankRate) }}</span>
              <span class="score-pill">{{ formatAchievement(result.scoreRecord.achievement) }}</span>
              <span v-if="result.scoreRecord.comboStatus" class="score-pill combo-pill">
                {{ formatComboStatus(result.scoreRecord.comboStatus) }}
              </span>
              <span v-if="result.scoreRecord.syncStatus" class="score-pill sync-pill">
                {{ formatSyncStatus(result.scoreRecord.syncStatus) }}
              </span>
              <span v-if="result.scoreRecord.dxScoreTier > 0" class="score-pill dx-pill">
                {{ formatDxScoreTier(result.scoreRecord) }}
              </span>
              <span v-if="result.scoreRecord.isB50" class="score-pill b50-pill">B50</span>
            </span>

            <span class="designer-line">
              {{ result.chart.noteDesigner }}
            </span>
          </span>
        </button>
      </div>

      <p v-else class="empty-state">No results</p>
    </div>

    <dialog ref="dialogRef" class="music-dialog" @click="handleDialogClick">
      <div class="dialog-header">
        <h2>{{ selectedMusic?.title }}</h2>
        <button type="button" class="dialog-close" aria-label="Close" @click="closeMusicJson">
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="close-icon">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
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

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
}

h1 {
  margin: 0;
  font-size: 1.35rem;
  font-weight: 650;
  line-height: 1.2;
}

.github-link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  padding: 0 12px;
  border: 1px solid #d5d5d5;
  border-radius: 6px;
  color: #404040;
  text-decoration: none;
  font-size: 0.92rem;
  font-weight: 600;
  transition: all 0.2s ease;
}

.github-link:hover {
  border-color: #171717;
  color: #171717;
  background-color: #f7f7f7;
}

.github-icon {
  flex-shrink: 0;
}

.search-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  width: min(500px, 100%);
}

.search-input-wrapper {
  position: relative;
  flex: 1;
  min-width: 0;
}

.search-input {
  width: 100%;
  height: 42px;
  padding: 0 36px 0 12px;
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

.clear-input-button {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  display: inline-grid;
  place-items: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: #707070;
  cursor: pointer;
  transition: all 0.2s ease;
}

.clear-input-button:hover {
  background: #f0f0f0;
  color: #171717;
}

.clear-input-button:focus-visible {
  outline: 2px solid #171717;
}

.clear-icon {
  display: block;
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

.file-button,
.clear-score-button {
  position: relative;
  display: inline-flex;
  min-height: 42px;
  align-items: center;
  justify-content: center;
  padding: 0 12px;
  border: 1px solid #171717;
  border-radius: 6px;
  background: #171717;
  color: #ffffff;
  cursor: pointer;
  font: inherit;
  font-size: 0.92rem;
  font-weight: 650;
}

.file-button.disabled {
  cursor: progress;
  opacity: 0.72;
}

.file-input {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  opacity: 0;
  pointer-events: none;
}

.clear-score-button {
  border-color: #b8b8b8;
  background: #ffffff;
  color: #171717;
}

.search-button {
  display: inline-flex;
  min-height: 42px;
  align-items: center;
  justify-content: center;
  padding: 0 16px;
  border: 1px solid #171717;
  border-radius: 6px;
  background: #171717;
  color: #ffffff;
  cursor: pointer;
  font: inherit;
  font-size: 0.92rem;
  font-weight: 650;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.file-button:hover,
.file-button:focus-within,
.clear-score-button:hover,
.clear-score-button:focus-visible,
.search-button:hover,
.search-button:focus-visible {
  border-color: #000000;
  box-shadow: 0 0 0 2px rgb(0 0 0 / 12%);
}

.clear-score-button:focus-visible,
.search-button:focus-visible {
  outline: 2px solid #171717;
  outline-offset: 2px;
}

.score-status {
  display: inline-flex;
  min-height: 42px;
  max-width: min(460px, 100%);
  align-items: center;
  padding: 0 12px;
  overflow: hidden;
  border: 1px solid #d5d5d5;
  border-radius: 6px;
  color: #606060;
  font-size: 0.86rem;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.score-status.loaded {
  border-color: #9bc7a2;
  background: #f3fbf4;
  color: #265f31;
}

.score-messages {
  display: grid;
  gap: 8px;
  margin: -8px 0 20px;
}

.score-alert,
.score-error {
  margin: 0;
  padding: 10px 12px;
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: 560;
  line-height: 1.35;
}

.score-alert {
  border: 1px solid #e5c56b;
  background: #fff9e6;
  color: #725400;
}

.score-error {
  border: 1px solid #e0a0a0;
  background: #fff1f1;
  color: #8a1f1f;
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

.score-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  min-width: 0;
}

.score-pill {
  display: inline-flex;
  min-height: 22px;
  align-items: center;
  padding: 0 7px;
  border: 1px solid rgb(0 0 0 / 16%);
  border-radius: 999px;
  background: rgb(255 255 255 / 72%);
  color: #171717;
  font-size: 0.72rem;
  font-weight: 760;
  line-height: 1;
  white-space: nowrap;
}

.rank-pill {
  background: #fff0c7;
}

.combo-pill {
  background: #f1ddff;
}

.sync-pill {
  background: #dff2ff;
}

.dx-pill {
  background: #f7ffd9;
}

.b50-pill {
  background: #171717;
  color: #ffffff;
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
  transition: all 0.2s ease;
}

.dialog-close:hover,
.dialog-close:focus-visible {
  border-color: #171717;
  background-color: #f5f5f5;
  color: #000000;
}

.close-icon {
  display: block;
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

  .search-box,
  .count-badge,
  .file-button,
  .clear-score-button,
  .score-status {
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
