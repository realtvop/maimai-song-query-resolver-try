import type { Music, MusicDifficultyID, Version } from "maimai_music_metadata";

type ChartType = "sd" | "dx" | "utage";
type Chart = Music["charts"][number];

export type ComboStatus = "" | "fc" | "fcp" | "ap" | "app";
export type SyncStatus = "" | "sync" | "fs" | "fsp" | "fsd" | "fsdp";
export type B50Bucket = "older" | "newer";
export type RankRate =
    | "d"
    | "c"
    | "b"
    | "bb"
    | "bbb"
    | "a"
    | "aa"
    | "aaa"
    | "s"
    | "sp"
    | "ss"
    | "ssp"
    | "sss"
    | "sssp";

export interface SaltNetBackupMusicDetail {
    musicId: number;
    level: number;
    playCount: number;
    achievement: number;
    comboStatus: number;
    syncStatus: number;
    deluxscoreMax: number;
    scoreRank: number;
    extNum1?: number;
    extNum2?: number;
}

export interface SaltNetBackup {
    userName?: string | null;
    userRating?: number | null;
    userMusicDetailList: SaltNetBackupMusicDetail[];
    userItemList?: unknown[];
    userCharacterList?: unknown[];
}

export interface LoadedScoreRecord {
    key: string;
    sourceMusicId: number;
    musicId: number;
    chartType: ChartType;
    difficulty: MusicDifficultyID;
    version: string | null;
    achievement: number;
    comboStatus: ComboStatus;
    syncStatus: SyncStatus;
    rankRate: RankRate;
    dxScore: number;
    dxScoreMax: number;
    dxScoreTier: number;
    deluxeRating: number;
    playCount: number;
    isB50: boolean;
    b50Bucket: B50Bucket | null;
    isNew: boolean;
}

export interface LoadedScoreData {
    userName: string | null;
    userRating: number | null;
    records: LoadedScoreRecord[];
    recordMap: Map<string, LoadedScoreRecord>;
    b50Keys: Set<string>;
    b50: {
        older: LoadedScoreRecord[];
        newer: LoadedScoreRecord[];
    };
    sourceRecordCount: number;
    matchedRecords: number;
    unmatchedRecords: number;
}

const COMBO_STATUS_ORDER = ["", "fc", "fcp", "ap", "app"] as const;
const SYNC_STATUS_ORDER = ["", "sync", "fs", "fsp", "fsd", "fsdp"] as const;
const SCORE_RANK_ORDER = [
    "d",
    "c",
    "b",
    "bb",
    "bbb",
    "a",
    "aa",
    "aaa",
    "s",
    "sp",
    "ss",
    "ssp",
    "sss",
    "sssp",
] as const;

const SCORE_COEFFICIENT_TABLE = [
    [0, 0],
    [10, 1.6],
    [20, 3.2],
    [30, 4.8],
    [40, 6.4],
    [50, 8.0],
    [60, 9.6],
    [70, 11.2],
    [75, 12.0],
    [79.9999, 12.8],
    [80, 13.6],
    [90, 15.2],
    [94, 16.8],
    [96.9999, 17.6],
    [97, 20.0],
    [98, 20.3],
    [98.9999, 20.6],
    [99, 20.8],
    [99.5, 21.1],
    [99.9999, 21.4],
    [100, 21.6],
    [100.4999, 21.6],
    [100.5, 22.4],
] as const;

function normalizeMusicId(id: number): number {
    return id >= 10000 && id <= 99999 ? id % 10000 : id;
}

function getBackupChartType(detail: SaltNetBackupMusicDetail): ChartType {
    if (detail.level === 10) return "utage";
    return detail.musicId >= 10000 ? "dx" : "sd";
}

export function getScoreKey(
    musicId: number,
    chartType: ChartType,
    difficulty: MusicDifficultyID,
): string {
    return `${musicId}:${chartType}:${difficulty}`;
}

export function getChartScoreKey(music: Music, chart: Chart): string {
    return getScoreKey(music.id, chart.type, chart.difficulty);
}

function getIndexValue<T>(values: readonly T[], index: number, fallback: T): T {
    return Number.isInteger(index) && index >= 0 && index < values.length
        ? values[index]
        : fallback;
}

function calculateDeluxeScoreTier(dxScore: number, dxScoreMax: number): number {
    if (!Number.isFinite(dxScore) || !Number.isFinite(dxScoreMax) || dxScoreMax <= 0) {
        return 0;
    }

    const percent = dxScore / dxScoreMax;
    if (percent >= 0.97) return 5;
    if (percent >= 0.95) return 4;
    if (percent >= 0.93) return 3;
    if (percent >= 0.9) return 2;
    if (percent >= 0.85) return 1;
    return 0;
}

function calculateRating(achievement: number, internalLevel: number): number {
    const coefficient =
        SCORE_COEFFICIENT_TABLE.find((_, index) => {
            const next = SCORE_COEFFICIENT_TABLE[index + 1];
            return !next || achievement < next[0];
        })?.[1] ?? 0;

    return Math.floor((coefficient * internalLevel * Math.min(100.5, achievement)) / 100);
}

function createVersionReleaseDateMap(versions: Version[]): Map<string, string> {
    return new Map(
        versions
            .filter(version => version.releaseDate)
            .map(version => [version.version, version.releaseDate]),
    );
}

function isB50Candidate(record: LoadedScoreRecord): boolean {
    return record.chartType !== "utage" && record.difficulty !== 10;
}

function findLatestScoredVersionName(
    records: LoadedScoreRecord[],
    versionReleaseDates: Map<string, string>,
): string | null {
    let latestVersionName: string | null = null;
    let latestReleaseDate: string | null = null;

    for (const record of records) {
        if (!isB50Candidate(record) || !record.version) continue;

        const releaseDate = versionReleaseDates.get(record.version);
        if (!releaseDate) continue;

        if (latestReleaseDate === null || releaseDate.localeCompare(latestReleaseDate) > 0) {
            latestVersionName = record.version;
            latestReleaseDate = releaseDate;
        }
    }

    return latestVersionName;
}

function indexCharts(musics: Music[]) {
    const chartMap = new Map<string, { music: Music; chart: Chart }>();

    for (const music of musics) {
        for (const chart of music.charts) {
            const key = getChartScoreKey(music, chart);
            if (!chartMap.has(key)) {
                chartMap.set(key, { music, chart });
            }
        }
    }

    return chartMap;
}

function parseBackup(raw: unknown): SaltNetBackup {
    if (!raw || typeof raw !== "object") {
        throw new Error("备份内容不是有效的 JSON 对象");
    }

    const backup = raw as Partial<SaltNetBackup>;
    if (!Array.isArray(backup.userMusicDetailList)) {
        throw new Error("备份缺少 userMusicDetailList");
    }

    return {
        userName: typeof backup.userName === "string" ? backup.userName : null,
        userRating: typeof backup.userRating === "number" ? backup.userRating : null,
        userMusicDetailList: backup.userMusicDetailList,
        userItemList: backup.userItemList,
        userCharacterList: backup.userCharacterList,
    };
}

function isValidMusicDetail(detail: unknown): detail is SaltNetBackupMusicDetail {
    if (!detail || typeof detail !== "object") return false;

    const candidate = detail as Partial<SaltNetBackupMusicDetail>;
    return (
        typeof candidate.musicId === "number" &&
        typeof candidate.level === "number" &&
        typeof candidate.playCount === "number" &&
        typeof candidate.achievement === "number" &&
        typeof candidate.comboStatus === "number" &&
        typeof candidate.syncStatus === "number" &&
        typeof candidate.deluxscoreMax === "number" &&
        typeof candidate.scoreRank === "number"
    );
}

function sortB50Records(records: LoadedScoreRecord[]): LoadedScoreRecord[] {
    return [...records].sort((a, b) => {
        if (b.deluxeRating !== a.deluxeRating) return b.deluxeRating - a.deluxeRating;
        if (b.achievement !== a.achievement) return b.achievement - a.achievement;
        return b.dxScore - a.dxScore;
    });
}

export function parseSaltNetBackup(
    raw: unknown,
    musics: Music[],
    versions: Version[],
): LoadedScoreData {
    const backup = parseBackup(raw);
    const chartMap = indexCharts(musics);
    const versionReleaseDates = createVersionReleaseDateMap(versions);
    const records: LoadedScoreRecord[] = [];
    let unmatchedRecords = 0;

    for (const detail of backup.userMusicDetailList) {
        if (!isValidMusicDetail(detail)) {
            unmatchedRecords += 1;
            continue;
        }

        const musicId = normalizeMusicId(detail.musicId);
        const chartType = getBackupChartType(detail);
        const difficulty = detail.level as MusicDifficultyID;
        const key = getScoreKey(musicId, chartType, difficulty);
        const match = chartMap.get(key);

        if (!match) {
            unmatchedRecords += 1;
            continue;
        }

        const dxScore = detail.deluxscoreMax;
        const dxScoreMax = match.chart.noteCounts.total * 3;
        const achievement = detail.achievement / 10000;
        const record: LoadedScoreRecord = {
            key,
            sourceMusicId: detail.musicId,
            musicId,
            chartType,
            difficulty,
            version: match.chart.version,
            achievement,
            comboStatus: getIndexValue(COMBO_STATUS_ORDER, detail.comboStatus, ""),
            syncStatus: getIndexValue(SYNC_STATUS_ORDER, detail.syncStatus, ""),
            rankRate: getIndexValue(SCORE_RANK_ORDER, detail.scoreRank, "d"),
            dxScore,
            dxScoreMax,
            dxScoreTier: calculateDeluxeScoreTier(dxScore, dxScoreMax),
            deluxeRating: calculateRating(achievement, match.chart.internalLevel),
            playCount: detail.playCount,
            isB50: false,
            b50Bucket: null,
            isNew: false,
        };

        records.push(record);
    }

    const latestVersionName = findLatestScoredVersionName(records, versionReleaseDates);

    for (const record of records) {
        record.isNew = latestVersionName !== null && record.version === latestVersionName;
    }

    const b50Candidates = records.filter(isB50Candidate);
    const newer = sortB50Records(b50Candidates.filter(record => record.isNew)).slice(0, 15);
    const older = sortB50Records(b50Candidates.filter(record => !record.isNew)).slice(0, 35);
    const b50Keys = new Set([...newer, ...older].map(record => record.key));

    for (const record of newer) {
        record.b50Bucket = "newer";
    }

    for (const record of older) {
        record.b50Bucket = "older";
    }

    for (const record of records) {
        record.isB50 = b50Keys.has(record.key);
    }

    return {
        userName: backup.userName ?? null,
        userRating: backup.userRating ?? null,
        records,
        recordMap: new Map(records.map(record => [record.key, record])),
        b50Keys,
        b50: { older, newer },
        sourceRecordCount: backup.userMusicDetailList.length,
        matchedRecords: records.length,
        unmatchedRecords,
    };
}
