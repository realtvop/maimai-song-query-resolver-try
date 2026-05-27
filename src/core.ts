import type { Music, Version, MusicDifficultyID } from "maimai_music_metadata";

type ChartType = "sd" | "dx" | "utage";

interface ParsedQuery {
    keyword: string;
    categories: Set<string>;
    versions: Set<string>;
    difficulties: Set<MusicDifficultyID>;
    chartTypes: Set<ChartType>;
    levels: Set<string>;
    minInternalLevel?: number;
    maxInternalLevel?: number;
}

const Difficulty = {
    Basic: 0,
    Advanced: 1,
    Expert: 2,
    Master: 3,
    ReMaster: 4,
    Utage: 10,
} as const satisfies Record<string, MusicDifficultyID>;

function normalizeText(text: string): string {
    return text
        .toLowerCase()
        .normalize("NFKC")
        .replace(/\s+/g, "")
        .replace(/[‐-‒–—―]/g, "-");
}

function addAliasToken(
    tokens: Array<{ raw: string; apply: (parsed: ParsedQuery) => void }>,
    raw: string,
    apply: (parsed: ParsedQuery) => void,
) {
    tokens.push({ raw: normalizeText(raw), apply });
}

function buildTokens(versions: Version[]) {
    const tokens: Array<{ raw: string; apply: (parsed: ParsedQuery) => void }> = [];

    // 难度。注意长词优先，所以“紫谱”要比“紫”更优先。
    addAliasToken(tokens, "绿谱", p => p.difficulties.add(Difficulty.Basic));
    addAliasToken(tokens, "黄谱", p => p.difficulties.add(Difficulty.Advanced));
    addAliasToken(tokens, "红谱", p => p.difficulties.add(Difficulty.Expert));
    addAliasToken(tokens, "紫谱", p => p.difficulties.add(Difficulty.Master));
    addAliasToken(tokens, "白谱", p => p.difficulties.add(Difficulty.ReMaster));
    addAliasToken(tokens, "宴谱", p => p.difficulties.add(Difficulty.Utage));

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

    // 分类。分类名按仓库 categories 的实际字符串来。
    addAliasToken(tokens, "东方", p => p.categories.add("東方Project"));
    addAliasToken(tokens, "東方", p => p.categories.add("東方Project"));
    addAliasToken(tokens, "touhou", p => p.categories.add("東方Project"));

    addAliasToken(tokens, "术力口", p => p.categories.add("niconico＆ボーカロイド"));
    addAliasToken(tokens, "術力口", p => p.categories.add("niconico＆ボーカロイド"));
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
    addAliasToken(tokens, "遊戲", p => p.categories.add("ゲーム＆バラエティ"));
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

function createEmptyParsedQuery(): ParsedQuery {
    return {
        keyword: "",
        categories: new Set(),
        versions: new Set(),
        difficulties: new Set(),
        chartTypes: new Set(),
        levels: new Set(),
    };
}

function parseQuery(query: string, versions: Version[]): ParsedQuery {
    let rest = normalizeText(query);
    const parsed = createEmptyParsedQuery();
    const tokens = buildTokens(versions);

    // 1. 识别固定词典 token
    for (const token of tokens) {
        if (!token.raw) continue;

        while (rest.includes(token.raw)) {
            token.apply(parsed);
            rest = rest.replace(token.raw, "");
        }
    }

    // 2. 识别等级：12 / 12+ / 14+
    // 注意：这里是显示等级，不把 12+ 当 12.5。
    rest = rest.replace(/(?:^|[^a-z0-9])((?:1[0-5]|[1-9])\+?)(?=$|[^a-z0-9])/g, full => {
        const level = full.match(/(?:1[0-5]|[1-9])\+?/)?.[0];
        if (level) parsed.levels.add(level);
        return "";
    });

    // 3. 识别内部定数范围，比如 ds>=13.7 / 定数13.6 / ra14.2
    rest = rest.replace(/(?:ds|定数|internal)(>=|<=|>|<|=)?(\d+(?:\.\d+)?)/g, (_, op: string | undefined, rawValue: string) => {
        const value = Number(rawValue);
        if (!Number.isFinite(value)) return "";

        switch (op || "=") {
            case ">":
            case ">=":
                parsed.minInternalLevel = value;
                break;
            case "<":
            case "<=":
                parsed.maxInternalLevel = value;
                break;
            default:
                parsed.minInternalLevel = value;
                parsed.maxInternalLevel = value;
                break;
        }

        return "";
    });

    // 4. 识别但忽略玩家成绩条件：fc / fc+ / ap / ap+ / b50
    // 因为 Music metadata 里没有玩家成绩数据；移除它们是为了不污染 keyword。
    rest = rest.replace(/(?:ap\+|ap|fc\+|fcp|fc|b\d{1,3})/g, "");

    parsed.keyword = rest;

    return parsed;
}

function chartMatches(chart: Music["charts"][number], parsed: ParsedQuery): boolean {
    if (parsed.chartTypes.size > 0 && !parsed.chartTypes.has(chart.type)) {
        return false;
    }

    if (parsed.difficulties.size > 0 && !parsed.difficulties.has(chart.difficulty)) {
        return false;
    }

    if (parsed.levels.size > 0 && !parsed.levels.has(chart.level)) {
        return false;
    }

    if (parsed.versions.size > 0) {
        if (!chart.version || !parsed.versions.has(chart.version)) {
            return false;
        }
    }

    if (
        parsed.minInternalLevel !== undefined &&
        chart.internalLevel < parsed.minInternalLevel
    ) {
        return false;
    }

    if (
        parsed.maxInternalLevel !== undefined &&
        chart.internalLevel > parsed.maxInternalLevel
    ) {
        return false;
    }

    return true;
}

function musicKeywordScore(music: Music, keyword: string): number {
    if (!keyword) return 1;

    const fields = [
        music.title,
        music.artist,
        ...(music.aliases?.cn ?? []),
    ];

    let best = 0;

    for (const field of fields) {
        const f = normalizeText(field);
        const k = normalizeText(keyword);

        if (f === k) best = Math.max(best, 100);
        else if (f.startsWith(k)) best = Math.max(best, 80);
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
            if (parsed.categories.size > 0 && !parsed.categories.has(music.category)) {
                return null;
            }

            const hasMatchingChart =
                parsed.chartTypes.size === 0 &&
                    parsed.difficulties.size === 0 &&
                    parsed.levels.size === 0 &&
                    parsed.versions.size === 0 &&
                    parsed.minInternalLevel === undefined &&
                    parsed.maxInternalLevel === undefined
                    ? true
                    : music.charts.some(chart => chartMatches(chart, parsed));

            if (!hasMatchingChart) {
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