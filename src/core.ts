import { sify } from "chinese-conv";
import type { Music, Version, MusicDifficultyID } from "maimai_music_metadata";
import {
    getChartScoreKey,
    type ComboStatus,
    type LoadedScoreData,
    type LoadedScoreRecord,
    type RankRate,
    type SyncStatus,
} from "./scoreBackup";

type ChartType = "sd" | "dx" | "utage";
type Chart = Music["charts"][number];

export interface ChartSearchResult {
    music: Music;
    chart: Chart;
    score: number;
    scoreRecord?: LoadedScoreRecord;
}

export interface SearchOptions {
    scores?: LoadedScoreData | null;
}

type AliasToken = {
    raw: string;
    apply: (parsed: ParsedQueryBranch) => void;
};

interface ParsedQuery {
    keyword: string;
    branches: ParsedQueryBranch[];
}

interface ParsedQueryBranch {
    musicIds: Set<number>;
    categories: Set<string>;
    versions: Set<string>;
    difficulties: Set<MusicDifficultyID>;
    chartTypes: Set<ChartType>;
    levels: Set<string>;
    minInternalLevel?: number;
    maxInternalLevel?: number;
    minComboStatus?: ComboStatus;
    minSyncStatus?: SyncStatus;
    minRankRate?: RankRate;
    minDxScoreTier?: number;
    b50Only?: boolean;
}

const Difficulty = {
    Basic: 0,
    Advanced: 1,
    Expert: 2,
    Master: 3,
    ReMaster: 4,
    Utage: 10,
} as const satisfies Record<string, MusicDifficultyID>;

const COMBO_STATUS_ORDER: ComboStatus[] = ["", "fc", "fcp", "ap", "app"];
const SYNC_STATUS_ORDER: SyncStatus[] = ["", "sync", "fs", "fsp", "fsd", "fsdp"];
const RANK_RATE_ORDER: RankRate[] = [
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
];

function normalizeText(text: string): string {
    return sify(text)
        .toLowerCase()
        .normalize("NFKC")
        .replace(/\s+/g, "")
        .replace(/[‐-‒–—―]/g, "-");
}

function addAliasToken(
    tokens: AliasToken[],
    raw: string,
    apply: (parsed: ParsedQueryBranch) => void,
) {
    tokens.push({ raw: normalizeText(raw), apply });
}

function setMinByOrder<T>(
    current: T | undefined,
    incoming: T,
    order: readonly T[],
): T {
    if (current === undefined) return incoming;
    return order.indexOf(incoming) > order.indexOf(current) ? incoming : current;
}

function setMinComboStatus(branch: ParsedQueryBranch, status: ComboStatus) {
    branch.minComboStatus = setMinByOrder(branch.minComboStatus, status, COMBO_STATUS_ORDER);
}

function setMinSyncStatus(branch: ParsedQueryBranch, status: SyncStatus) {
    branch.minSyncStatus = setMinByOrder(branch.minSyncStatus, status, SYNC_STATUS_ORDER);
}

function setMinRankRate(branch: ParsedQueryBranch, rank: RankRate) {
    branch.minRankRate = setMinByOrder(branch.minRankRate, rank, RANK_RATE_ORDER);
}

function setMinDxScoreTier(branch: ParsedQueryBranch, tier: number) {
    branch.minDxScoreTier = Math.max(branch.minDxScoreTier ?? 0, tier);
}

function buildTokens(versions: Version[]) {
    const tokens: AliasToken[] = [];

    // 难度。注意长词优先，所以“紫谱”要比“紫”更优先。
    addAliasToken(tokens, "绿谱", p => p.difficulties.add(Difficulty.Basic));
    addAliasToken(tokens, "黄谱", p => p.difficulties.add(Difficulty.Advanced));
    addAliasToken(tokens, "红谱", p => p.difficulties.add(Difficulty.Expert));
    addAliasToken(tokens, "紫谱", p => p.difficulties.add(Difficulty.Master));
    addAliasToken(tokens, "白谱", p => p.difficulties.add(Difficulty.ReMaster));
    addAliasToken(tokens, "宴谱", p => p.difficulties.add(Difficulty.Utage));
    addAliasToken(tokens, "宴", p => p.difficulties.add(Difficulty.Utage));
    addAliasToken(tokens, "绿", p => p.difficulties.add(Difficulty.Basic));
    addAliasToken(tokens, "黄", p => p.difficulties.add(Difficulty.Advanced));
    addAliasToken(tokens, "红", p => p.difficulties.add(Difficulty.Expert));
    addAliasToken(tokens, "紫", p => p.difficulties.add(Difficulty.Master));
    addAliasToken(tokens, "白", p => p.difficulties.add(Difficulty.ReMaster));
    addAliasToken(tokens, "宴", p => p.difficulties.add(Difficulty.Utage));

    addAliasToken(tokens, "basic", p => p.difficulties.add(Difficulty.Basic));
    addAliasToken(tokens, "advanced", p => p.difficulties.add(Difficulty.Advanced));
    addAliasToken(tokens, "expert", p => p.difficulties.add(Difficulty.Expert));
    addAliasToken(tokens, "master", p => p.difficulties.add(Difficulty.Master));
    addAliasToken(tokens, "remaster", p => p.difficulties.add(Difficulty.ReMaster));
    addAliasToken(tokens, "re:master", p => p.difficulties.add(Difficulty.ReMaster));
    addAliasToken(tokens, "utage", p => p.difficulties.add(Difficulty.Utage));

    // 谱面类型
    addAliasToken(tokens, "标准谱", p => p.chartTypes.add("sd"));
    addAliasToken(tokens, "标准", p => p.chartTypes.add("sd"));
    addAliasToken(tokens, "标", p => p.chartTypes.add("sd"));
    addAliasToken(tokens, "sd", p => p.chartTypes.add("sd"));
    addAliasToken(tokens, "dx谱", p => p.chartTypes.add("dx"));
    addAliasToken(tokens, "dx", p => p.chartTypes.add("dx"));
    addAliasToken(tokens, "宴", p => p.chartTypes.add("utage"));

    // 玩家成绩：按“达到及以上”筛选。
    addAliasToken(tokens, "fc+", p => setMinComboStatus(p, "fcp"));
    addAliasToken(tokens, "fcp", p => setMinComboStatus(p, "fcp"));
    addAliasToken(tokens, "fc", p => setMinComboStatus(p, "fc"));
    addAliasToken(tokens, "ap+", p => setMinComboStatus(p, "app"));
    addAliasToken(tokens, "app", p => setMinComboStatus(p, "app"));
    addAliasToken(tokens, "ap", p => setMinComboStatus(p, "ap"));

    addAliasToken(tokens, "fsdx+", p => setMinSyncStatus(p, "fsdp"));
    addAliasToken(tokens, "fsd+", p => setMinSyncStatus(p, "fsdp"));
    addAliasToken(tokens, "fdx+", p => setMinSyncStatus(p, "fsdp"));
    addAliasToken(tokens, "fsdp", p => setMinSyncStatus(p, "fsdp"));
    addAliasToken(tokens, "fdxp", p => setMinSyncStatus(p, "fsdp"));
    addAliasToken(tokens, "fsdx", p => setMinSyncStatus(p, "fsd"));
    addAliasToken(tokens, "fsd", p => setMinSyncStatus(p, "fsd"));
    addAliasToken(tokens, "fdx", p => setMinSyncStatus(p, "fsd"));
    addAliasToken(tokens, "fs+", p => setMinSyncStatus(p, "fsp"));
    addAliasToken(tokens, "fsp", p => setMinSyncStatus(p, "fsp"));
    addAliasToken(tokens, "fs", p => setMinSyncStatus(p, "fs"));
    addAliasToken(tokens, "sync", p => setMinSyncStatus(p, "sync"));

    addAliasToken(tokens, "sss+", p => setMinRankRate(p, "sssp"));
    addAliasToken(tokens, "sssp", p => setMinRankRate(p, "sssp"));
    addAliasToken(tokens, "鸟加", p => setMinRankRate(p, "sssp"));
    addAliasToken(tokens, "鸟+", p => setMinRankRate(p, "sssp"));
    addAliasToken(tokens, "sss", p => setMinRankRate(p, "sss"));
    addAliasToken(tokens, "鸟", p => setMinRankRate(p, "sss"));
    addAliasToken(tokens, "ss+", p => setMinRankRate(p, "ssp"));
    addAliasToken(tokens, "ssp", p => setMinRankRate(p, "ssp"));
    addAliasToken(tokens, "ss", p => setMinRankRate(p, "ss"));
    addAliasToken(tokens, "s+", p => setMinRankRate(p, "sp"));
    addAliasToken(tokens, "sp", p => setMinRankRate(p, "sp"));
    addAliasToken(tokens, "aaa", p => setMinRankRate(p, "aaa"));
    addAliasToken(tokens, "aa", p => setMinRankRate(p, "aa"));
    addAliasToken(tokens, "bbb", p => setMinRankRate(p, "bbb"));
    addAliasToken(tokens, "bb", p => setMinRankRate(p, "bb"));

    addAliasToken(tokens, "b50", p => {
        p.b50Only = true;
    });

    const starAliases: Array<[string, number]> = [
        ["一", 1],
        ["二", 2],
        ["三", 3],
        ["四", 4],
        ["五", 5],
        ["1", 1],
        ["2", 2],
        ["3", 3],
        ["4", 4],
        ["5", 5],
    ];
    for (const [raw, tier] of starAliases) {
        addAliasToken(tokens, `${raw}星`, p => setMinDxScoreTier(p, tier));
        addAliasToken(tokens, `dx${raw}星`, p => setMinDxScoreTier(p, tier));
    }

    // 分类。分类名按仓库 categories 的实际字符串来。
    addAliasToken(tokens, "东方", p => p.categories.add("東方Project"));
    addAliasToken(tokens, "東方", p => p.categories.add("東方Project"));
    addAliasToken(tokens, "touhou", p => p.categories.add("東方Project"));

    addAliasToken(tokens, "术", p => p.categories.add("niconico＆ボーカロイド"));
    addAliasToken(tokens, "术曲", p => p.categories.add("niconico＆ボーカロイド"));
    addAliasToken(tokens, "术力口", p => p.categories.add("niconico＆ボーカロイド"));
    addAliasToken(tokens, "ボカロ", p => p.categories.add("niconico＆ボーカロイド"));
    addAliasToken(tokens, "vocaloid", p => p.categories.add("niconico＆ボーカロイド"));
    addAliasToken(tokens, "nico", p => p.categories.add("niconico＆ボーカロイド"));

    addAliasToken(tokens, "舞萌", p => p.categories.add("maimai"));
    addAliasToken(tokens, "maimai", p => p.categories.add("maimai"));

    addAliasToken(tokens, "中二", p => p.categories.add("オンゲキ＆CHUNITHM"));
    addAliasToken(tokens, "chunithm", p => p.categories.add("オンゲキ＆CHUNITHM"));
    addAliasToken(tokens, "ongeki", p => p.categories.add("オンゲキ＆CHUNITHM"));
    addAliasToken(tokens, "オンゲキ", p => p.categories.add("オンゲキ＆CHUNITHM"));

    addAliasToken(tokens, "游戏", p => p.categories.add("ゲーム＆バラエティ"));
    addAliasToken(tokens, "バラエティ", p => p.categories.add("ゲーム＆バラエティ"));

    addAliasToken(tokens, "动漫", p => p.categories.add("POPS＆アニメ"));
    addAliasToken(tokens, "動畫", p => p.categories.add("POPS＆アニメ"));
    addAliasToken(tokens, "アニメ", p => p.categories.add("POPS＆アニメ"));
    addAliasToken(tokens, "pops", p => p.categories.add("POPS＆アニメ"));

    // 版本：用 Version.word 和 Version.version 都可以搜。
    for (const version of versions) {
        addAliasToken(tokens, version.version, p => p.versions.add(version.version));

        if (version.word) {
            addAliasToken(tokens, version.word, p => p.versions.add(version.version));
        }

        // 例如国服年份版名。如果你不想支持可以删掉。
        if (version.cnVerOverride !== null) {
            addAliasToken(tokens, String(version.cnVerOverride), p => p.versions.add(version.version));
        }
    }

    // 长词优先，避免“紫谱”被“紫”抢走。
    tokens.sort((a, b) => b.raw.length - a.raw.length);

    return tokens;
}

function createEmptyParsedQueryBranch(): ParsedQueryBranch {
    return {
        musicIds: new Set(),
        categories: new Set(),
        versions: new Set(),
        difficulties: new Set(),
        chartTypes: new Set(),
        levels: new Set(),
    };
}

function cloneParsedQueryBranch(branch: ParsedQueryBranch): ParsedQueryBranch {
    return {
        musicIds: new Set(branch.musicIds),
        categories: new Set(branch.categories),
        versions: new Set(branch.versions),
        difficulties: new Set(branch.difficulties),
        chartTypes: new Set(branch.chartTypes),
        levels: new Set(branch.levels),
        minInternalLevel: branch.minInternalLevel,
        maxInternalLevel: branch.maxInternalLevel,
        minComboStatus: branch.minComboStatus,
        minSyncStatus: branch.minSyncStatus,
        minRankRate: branch.minRankRate,
        minDxScoreTier: branch.minDxScoreTier,
        b50Only: branch.b50Only,
    };
}

function branchKey(branch: ParsedQueryBranch): string {
    return JSON.stringify({
        musicIds: [...branch.musicIds].sort((a, b) => a - b),
        categories: [...branch.categories].sort(),
        versions: [...branch.versions].sort(),
        difficulties: [...branch.difficulties].sort((a, b) => a - b),
        chartTypes: [...branch.chartTypes].sort(),
        levels: [...branch.levels].sort(),
        minInternalLevel: branch.minInternalLevel,
        maxInternalLevel: branch.maxInternalLevel,
        minComboStatus: branch.minComboStatus,
        minSyncStatus: branch.minSyncStatus,
        minRankRate: branch.minRankRate,
        minDxScoreTier: branch.minDxScoreTier,
        b50Only: branch.b50Only,
    });
}

function hasScoreFilters(branch: ParsedQueryBranch): boolean {
    return (
        branch.minComboStatus !== undefined ||
        branch.minSyncStatus !== undefined ||
        branch.minRankRate !== undefined ||
        branch.minDxScoreTier !== undefined ||
        branch.b50Only === true
    );
}

function dedupeBranches(branches: ParsedQueryBranch[]): ParsedQueryBranch[] {
    const seen = new Set<string>();
    const result: ParsedQueryBranch[] = [];

    for (const branch of branches) {
        const key = branchKey(branch);
        if (seen.has(key)) continue;

        seen.add(key);
        result.push(branch);
    }

    return result;
}

function hasChartFilters(branch: ParsedQueryBranch): boolean {
    return (
        branch.chartTypes.size > 0 ||
        branch.difficulties.size > 0 ||
        branch.levels.size > 0 ||
        branch.versions.size > 0 ||
        branch.minInternalLevel !== undefined ||
        branch.maxInternalLevel !== undefined ||
        hasScoreFilters(branch)
    );
}

function groupTokensByRaw(tokens: AliasToken[]): AliasToken[][] {
    const groups = new Map<string, AliasToken[]>();

    for (const token of tokens) {
        if (!token.raw) continue;

        const group = groups.get(token.raw);
        if (group) {
            group.push(token);
        } else {
            groups.set(token.raw, [token]);
        }
    }

    return [...groups.values()];
}

function normalizeMusicId(id: number): number {
    return id >= 10000 && id <= 99999 ? id % 10000 : id;
}

function parseQuery(query: string, versions: Version[]): ParsedQuery {
    let rest = normalizeText(query);
    const parsed: ParsedQuery = {
        keyword: "",
        branches: [createEmptyParsedQueryBranch()],
    };
    const tokens = buildTokens(versions);

    // 1. 识别固定词典 token
    for (const group of groupTokensByRaw(tokens)) {
        const raw = group[0].raw;

        while (rest.includes(raw)) {
            const nextBranches: ParsedQueryBranch[] = [];

            for (const branch of parsed.branches) {
                for (const token of group) {
                    const nextBranch = cloneParsedQueryBranch(branch);
                    token.apply(nextBranch);
                    nextBranches.push(nextBranch);
                }
            }

            parsed.branches = dedupeBranches(nextBranches);
            rest = rest.replace(raw, "");
        }
    }

    // 2. 识别曲目 ID：id11451 / id8
    rest = rest.replace(/id(\d+)/g, (_, rawId: string) => {
        const id = Number(rawId);
        if (!Number.isSafeInteger(id)) return "";

        for (const branch of parsed.branches) {
            branch.musicIds.add(normalizeMusicId(id));
        }

        return "";
    });

    // 3. 识别等级：12 / 12+ / 14+
    // 注意：这里是显示等级，不把 12+ 当 12.5。
    rest = rest.replace(/(?:^|[^a-z0-9])((?:1[0-5]|[1-9])\+?)(?=$|[^a-z0-9])/g, full => {
        const level = full.match(/(?:1[0-5]|[1-9])\+?/)?.[0];
        if (level) {
            for (const branch of parsed.branches) {
                branch.levels.add(level);
            }
        }
        return "";
    });

    // 4. 识别内部定数范围，比如 ds>=13.7 / 定数13.6 / ra14.2
    rest = rest.replace(/(?:ds|定数|internal)(>=|<=|>|<|=)?(\d+(?:\.\d+)?)/g, (_, op: string | undefined, rawValue: string) => {
        const value = Number(rawValue);
        if (!Number.isFinite(value)) return "";

        for (const branch of parsed.branches) {
            switch (op || "=") {
                case ">":
                case ">=":
                    branch.minInternalLevel = value;
                    break;
                case "<":
                case "<=":
                    branch.maxInternalLevel = value;
                    break;
                default:
                    branch.minInternalLevel = value;
                    branch.maxInternalLevel = value;
                    break;
            }
        }

        return "";
    });

    // 5. 清掉旧查询里可能出现但暂不支持的 b 数字条件，避免污染 keyword。
    rest = rest.replace(/(?:ap\+|ap|fc\+|fcp|fc|b\d{1,3})/g, "");

    parsed.keyword = rest;

    return parsed;
}

export function queryNeedsScoreData(query: string, versions: Version[]): boolean {
    const parsed = parseQuery(query, versions);
    return parsed.branches.some(hasScoreFilters);
}

function chartMatches(chart: Music["charts"][number], branch: ParsedQueryBranch): boolean {
    if (branch.chartTypes.size > 0 && !branch.chartTypes.has(chart.type)) {
        return false;
    }

    if (branch.difficulties.size > 0 && !branch.difficulties.has(chart.difficulty)) {
        return false;
    }

    if (branch.levels.size > 0 && !branch.levels.has(chart.level)) {
        return false;
    }

    if (branch.versions.size > 0) {
        if (!chart.version || !branch.versions.has(chart.version)) {
            return false;
        }
    }

    if (
        branch.minInternalLevel !== undefined &&
        chart.internalLevel < branch.minInternalLevel
    ) {
        return false;
    }

    if (
        branch.maxInternalLevel !== undefined &&
        chart.internalLevel > branch.maxInternalLevel
    ) {
        return false;
    }

    return true;
}

function chartMatchesWithoutDifficulty(chart: Chart, branch: ParsedQueryBranch): boolean {
    const branchWithoutDifficulty = cloneParsedQueryBranch(branch);
    branchWithoutDifficulty.difficulties.clear();
    return chartMatches(chart, branchWithoutDifficulty);
}

function orderValue<T>(order: readonly T[], value: T): number {
    const index = order.indexOf(value);
    return index === -1 ? 0 : index;
}

function chartScoreMatches(
    music: Music,
    chart: Chart,
    branch: ParsedQueryBranch,
    options?: SearchOptions,
): boolean {
    if (!hasScoreFilters(branch)) return true;
    if (!options?.scores) return true;

    const record = options.scores.recordMap.get(getChartScoreKey(music, chart));
    if (!record) return false;

    if (branch.b50Only && !record.isB50) {
        return false;
    }

    if (
        branch.minComboStatus !== undefined &&
        orderValue(COMBO_STATUS_ORDER, record.comboStatus) <
            orderValue(COMBO_STATUS_ORDER, branch.minComboStatus)
    ) {
        return false;
    }

    if (
        branch.minSyncStatus !== undefined &&
        orderValue(SYNC_STATUS_ORDER, record.syncStatus) <
            orderValue(SYNC_STATUS_ORDER, branch.minSyncStatus)
    ) {
        return false;
    }

    if (
        branch.minRankRate !== undefined &&
        orderValue(RANK_RATE_ORDER, record.rankRate) <
            orderValue(RANK_RATE_ORDER, branch.minRankRate)
    ) {
        return false;
    }

    if (
        branch.minDxScoreTier !== undefined &&
        record.dxScoreTier < branch.minDxScoreTier
    ) {
        return false;
    }

    return true;
}

function musicKeywordScore(music: Music, keyword: string): number {
    if (!keyword) return 1;

    const k = normalizeText(keyword);
    let best = 0;

    // Title and Artist
    const mainFields = [music.title, music.artist];
    for (const field of mainFields) {
        const f = normalizeText(field);
        if (f === k) best = Math.max(best, 100);
        else if (f.startsWith(k)) best = Math.max(best, 80);
        else if (f.includes(k)) best = Math.max(best, 60);
    }

    // Aliases (require at least 2/3 match length)
    const aliases = music.aliases?.cn ?? [];
    for (const alias of aliases) {
        const f = normalizeText(alias);
        if (f.length === 0) continue;

        if (f === k) best = Math.max(best, 100);
        else if (f.startsWith(k)) best = Math.max(best, 80);

        // Check if length of matching part (k.length) is at least 2/3 of the alias length (f.length)
        if (k.length * 3 < f.length * 2) {
            continue;
        }
        else if (f.includes(k)) best = Math.max(best, 60);
    }

    return best;
}

export function searchMusic(
    query: string,
    musics: Music[],
    versions: Version[],
): Music[] {
    const parsed = parseQuery(query, versions);

    const results = musics
        .map(music => {
            const hasMatchingBranch = parsed.branches.some(branch => {
                if (branch.musicIds.size > 0 && !branch.musicIds.has(music.id)) {
                    return false;
                }

                if (branch.categories.size > 0 && !branch.categories.has(music.category)) {
                    return false;
                }

                return hasChartFilters(branch)
                    ? music.charts.some(chart => chartMatches(chart, branch))
                    : true;
            });

            if (!hasMatchingBranch) {
                return null;
            }

            const score = musicKeywordScore(music, parsed.keyword);

            if (parsed.keyword && score <= 0) {
                return null;
            }

            return { music, score };
        })
        .filter((item): item is { music: Music; score: number } => item !== null)
        .sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return a.music.id - b.music.id;
        })
        .map(item => item.music);

    return results;
}

function chartResultKey(result: ChartSearchResult): string {
    return [
        result.music.id,
        result.chart.type,
        result.chart.difficulty,
        result.chart.version ?? "",
        result.chart.level,
    ].join(":");
}

export function searchCharts(
    query: string,
    musics: Music[],
    versions: Version[],
    options?: SearchOptions,
): ChartSearchResult[] {
    const parsed = parseQuery(query, versions);
    const results: ChartSearchResult[] = [];
    const seen = new Set<string>();

    for (const music of musics) {
        const score = musicKeywordScore(music, parsed.keyword);

        if (parsed.keyword && score <= 0) {
            continue;
        }

        for (const branch of parsed.branches) {
            if (branch.musicIds.size > 0 && !branch.musicIds.has(music.id)) {
                continue;
            }

            if (branch.categories.size > 0 && !branch.categories.has(music.category)) {
                continue;
            }

            const hasDifficultyFilter = branch.difficulties.size > 0;
            const matchingCharts = music.charts.filter(chart =>
                (
                    hasDifficultyFilter
                        ? chartMatches(chart, branch)
                        : chartMatchesWithoutDifficulty(chart, branch)
                ) && chartScoreMatches(music, chart, branch, options),
            );

            for (const chart of matchingCharts) {
                const scoreRecord = options?.scores?.recordMap.get(getChartScoreKey(music, chart));
                const result = { music, chart, score, scoreRecord };
                const key = chartResultKey(result);

                if (seen.has(key)) {
                    continue;
                }

                seen.add(key);
                results.push(result);
            }
        }
    }

    return results.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (a.music.id !== b.music.id) return a.music.id - b.music.id;
        if (a.chart.type !== b.chart.type) return a.chart.type.localeCompare(b.chart.type);
        return a.chart.difficulty - b.chart.difficulty;
    });
}
