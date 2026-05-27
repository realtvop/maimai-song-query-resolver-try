import { sify } from "chinese-conv";
import type { Music, Version, MusicDifficultyID } from "maimai_music_metadata";
import {
    getChartScoreKey,
    type B50Bucket,
    type ComboStatus,
    type LoadedScoreData,
    type LoadedScoreRecord,
    type RankRate,
    type SyncStatus,
} from "./scoreBackup";

export type ChartType = "sd" | "dx" | "utage";
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

export interface ParsedSearchQuery {
    query: string;
    normalizedQuery: string;
    keyword: string;
    branches: ParsedSearchQueryBranch[];
}

export interface ParsedSearchQueryBranch {
    musicIds: number[];
    categories: string[];
    versions: string[];
    noteDesigners: string[];
    difficulties: MusicDifficultyID[];
    chartTypes: ChartType[];
    levels: string[];
    minInternalLevel?: number;
    maxInternalLevel?: number;
    minComboStatus?: ComboStatus;
    minSyncStatus?: SyncStatus;
    minRankRate?: RankRate;
    minDxScoreTier?: number;
    b50Only: boolean;
    b50Bucket?: B50Bucket;
    hasChartFilters: boolean;
    hasScoreFilters: boolean;
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
    noteDesigners: Set<string>;
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
    b50Bucket?: B50Bucket;
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

const NOTE_DESIGNER_ALIASES: Record<string, string[]> = {
    "はっぴー": ["哈皮", "谱面leader"],
    Jack: ["杰克", "王道谱谱师"],
    "譜面-100号": ["谱面100号", "谱面一百号", "抽象大师"],
    "チャン＠DP皆伝": ["DP皆传", "强哥"],
    ニャイン: ["喵因", "喵九"],
    "mai-Star": ["麦星", "麦斯达"],
    "某S氏": ["某S", "S氏"],
    "ロシェ＠ペンギン": ["企鹅", "罗谢企鹅", "企鹅哥"],
    "Techno Kitchen": ["技术厨房", "科技厨房", "TK"],
    rioN: ["里昂"],
    "Revo@LC": ["Revo"],
    ぴちネコ: ["皮奇猫", "猫", "猫猫"],
    しろいろ: ["白色"],
    "如月 ゆかり": ["如月由香里", "如月缘"],
    "Moon Strix": ["月鸮", "月猫头鹰"],
    玉子豆腐: ["玉子豆腐", "鸡蛋豆腐"],
    LabiLabi: ["拉比拉比"],
    小鳥遊さん: ["小鸟游", "小鸟游桑"],
    ものくろっく: ["单色钟", "黑白钟"],
    すきやき奉行: ["寿喜烧奉行", "寿喜烧"],
    サファ太: ["萨法太", "翠"],
    華火職人: ["花火职人", "烟花职人"],
    シチミヘルツ: ["七味赫兹", "7.3Hz", "7.3GHz"],
    うさぎランドリー: ["兔子洗衣房", "兔子洗衣店"],
    アマリリス: ["孤挺花", "朱顶红", "花"],
    群青リコリス: ["群青石蒜", "群青彼岸花"],
    隅田川星人: ["隅田川星人", "川哥"],
    アミノハバキリ: ["氨基羽羽斩", "氨基羽斩"],
    Redarrow: ["红箭"],
    翠楼屋: ["翠楼屋", "太"],
    あまくちジンジャー: ["甜口姜", "甜姜"],
    じゃこレモン: ["小鱼柠檬", "杂鱼柠檬"],
    カマボコ君: ["鱼糕君", "板鱼君"],
    メロンポップ: ["蜜瓜泡泡", "甜瓜汽水", "瓜泡"],
    みそかつ侍: ["味噌炸猪排武士", "味噌猪排武士"],
    鳩ホルダー: ["鸽子Holder", "鸽子持有者", "鸽哥"],
    "rintaro soma": ["rintaro", "soma"],
    Luxizhel: ["露西儿", "露西尔", "路西泽尔", "with U"],
    Ruby: ["鲁比", "红宝石"],
    "PG-NAKAGAWA": ["PG中川", "中川"],
    ミニミライト: ["迷你米光", "迷你灯"],
    "りんご Full Set": ["苹果Full Set", "苹果全套"],
    きょむりん: ["虚无凛", "虚无林"],
    まぐランド: ["马古乐园", "金枪鱼乐园"],
    せめんともり: ["水泥森林", "水泥森"],
    畳返し: ["掀榻榻米", "榻榻米返"],
};

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

function addNoteDesignerToken(tokens: AliasToken[], raw: string, noteDesigner: string) {
    addAliasToken(tokens, raw, p => p.noteDesigners.add(noteDesigner));
}

function getChartNoteDesigner(chart: Chart): string {
    return typeof chart.noteDesigner === "string" ? chart.noteDesigner.trim() : "";
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

export function buildNoteDesignerNames(musics: Music[]): string[] {
    const names = new Set<string>();

    for (const music of musics) {
        for (const chart of music.charts) {
            const name = getChartNoteDesigner(chart);
            if (name) {
                names.add(name);
            }
        }
    }

    return sortedStrings(names);
}

function buildTokens(versions: Version[], noteDesignerNames: string[]) {
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

    addAliasToken(tokens, "bas", p => p.difficulties.add(Difficulty.Basic));
    addAliasToken(tokens, "adv", p => p.difficulties.add(Difficulty.Advanced));
    addAliasToken(tokens, "exp", p => p.difficulties.add(Difficulty.Expert));
    addAliasToken(tokens, "mas", p => p.difficulties.add(Difficulty.Master));
    addAliasToken(tokens, "rem", p => p.difficulties.add(Difficulty.ReMaster));
    addAliasToken(tokens, "remas", p => p.difficulties.add(Difficulty.ReMaster));
    addAliasToken(tokens, "utage", p => p.difficulties.add(Difficulty.Utage));

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
    addAliasToken(tokens, "b35", p => {
        p.b50Bucket = "older";
    });
    addAliasToken(tokens, "b15", p => {
        p.b50Bucket = "newer";
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
            addAliasToken(tokens, `${version.word}代`, p => p.versions.add(version.version));
        }

        // 例如国服年份版名。如果你不想支持可以删掉。
        if (version.cnVerOverride !== null) {
            addAliasToken(tokens, String(version.cnVerOverride), p => p.versions.add(version.version));
        }
    }

    // 谱师：先收集当前 metadata 中真实出现过的名字，再挂上本地别名。
    for (const noteDesigner of noteDesignerNames) {
        if (noteDesigner.trim() === "" || noteDesigner.trim() === "-") continue;
        addNoteDesignerToken(tokens, noteDesigner, noteDesigner);
    }

    const noteDesignerByNormalizedName = new Map(
        noteDesignerNames.map(noteDesigner => [normalizeText(noteDesigner), noteDesigner]),
    );

    for (const [name, aliases] of Object.entries(NOTE_DESIGNER_ALIASES)) {
        const noteDesigner = noteDesignerByNormalizedName.get(normalizeText(name));
        if (!noteDesigner) continue;

        for (const alias of aliases) {
            addNoteDesignerToken(tokens, alias, noteDesigner);
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
        noteDesigners: new Set(),
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
        noteDesigners: new Set(branch.noteDesigners),
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
        b50Bucket: branch.b50Bucket,
    };
}

function branchKey(branch: ParsedQueryBranch): string {
    return JSON.stringify({
        musicIds: [...branch.musicIds].sort((a, b) => a - b),
        categories: [...branch.categories].sort(),
        versions: [...branch.versions].sort(),
        noteDesigners: [...branch.noteDesigners].sort(),
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
        b50Bucket: branch.b50Bucket,
    });
}

function hasScoreFilters(branch: ParsedQueryBranch): boolean {
    return (
        branch.minComboStatus !== undefined ||
        branch.minSyncStatus !== undefined ||
        branch.minRankRate !== undefined ||
        branch.minDxScoreTier !== undefined ||
        branch.b50Only === true ||
        branch.b50Bucket !== undefined
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
        branch.noteDesigners.size > 0 ||
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

function sortedNumbers<T extends number>(values: Set<T>): T[] {
    return [...values].sort((a, b) => a - b);
}

function sortedStrings<T extends string>(values: Set<T>): T[] {
    return [...values].sort((a, b) => a.localeCompare(b));
}

function escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseQuery(
    query: string,
    versions: Version[],
    noteDesignerNames: string[] = [],
): ParsedQuery {
    let rest = normalizeText(query);
    const parsed: ParsedQuery = {
        keyword: "",
        branches: [createEmptyParsedQueryBranch()],
    };
    const tokens = buildTokens(versions, noteDesignerNames);

    // 1. 识别固定词典 token
    for (const group of groupTokensByRaw(tokens)) {
        const raw = group[0].raw;

        let pattern = escapeRegExp(raw);
        if (/^[a-z]/.test(raw)) {
            pattern = `(?<![a-z])${pattern}`;
        }
        if (/[a-z]$/.test(raw)) {
            pattern = `${pattern}(?![a-z])`;
        }
        const regex = new RegExp(pattern, "i");

        while (regex.test(rest)) {
            const nextBranches: ParsedQueryBranch[] = [];

            for (const branch of parsed.branches) {
                for (const token of group) {
                    const nextBranch = cloneParsedQueryBranch(branch);
                    token.apply(nextBranch);
                    nextBranches.push(nextBranch);
                }
            }

            parsed.branches = dedupeBranches(nextBranches);
            rest = rest.replace(regex, "");
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

    // 3. 识别内部定数范围，比如 ds>=13.7 / 定数13.6 / ra14.2
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

    // 4. 识别直接定数和定数范围，如 13.4, 13.1-13.4, 13.1-.4, 13.1,13.2,13.4
    const itemPattern = `(?:\\d+(?:\\.\\d+)?-(?:\\d+(?:\\.\\d+)?|\\.\\d+)|\\d+\\.\\d+)`;
    const listRegex = new RegExp(`(?<![0-9.])(${itemPattern}(?:,${itemPattern})*)(?![0-9.])`, "g");

    rest = rest.replace(listRegex, (matchedString) => {
        // 必须包含点号，避免与不含点号的等级混淆
        if (!matchedString.includes(".")) {
            return matchedString;
        }

        const items = matchedString.split(",");
        const targets: { min: number; max: number }[] = [];

        for (const item of items) {
            if (item.includes("-")) {
                const parts = item.split("-");
                const left = parts[0];
                const right = parts[1];
                const leftVal = parseFloat(left);
                let rightVal: number;
                if (right.startsWith(".")) {
                    const integerPart = left.split(".")[0];
                    rightVal = parseFloat(integerPart + right);
                } else {
                    rightVal = parseFloat(right);
                }
                targets.push({
                    min: Math.min(leftVal, rightVal),
                    max: Math.max(leftVal, rightVal),
                });
            } else {
                const val = parseFloat(item);
                targets.push({ min: val, max: val });
            }
        }

        if (targets.length > 0) {
            const nextBranches: ParsedQueryBranch[] = [];
            for (const branch of parsed.branches) {
                for (const target of targets) {
                    const nextBranch = cloneParsedQueryBranch(branch);
                    nextBranch.minInternalLevel = target.min;
                    nextBranch.maxInternalLevel = target.max;
                    nextBranches.push(nextBranch);
                }
            }
            parsed.branches = dedupeBranches(nextBranches);
        }

        return "";
    });

    // 5. 识别等级：12 / 12+ / 14+
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

    // 6. 清掉旧查询里可能出现但暂不支持的 b 数字条件，避免污染 keyword。
    rest = rest.replace(/(?:ap\+|ap|fc\+|fcp|fc|b\d{1,3})/g, "");

    parsed.keyword = rest;

    return parsed;
}

export function parseSearchQuery(
    query: string,
    versions: Version[],
    noteDesignerNames: string[] = [],
): ParsedSearchQuery {
    const parsed = parseQuery(query, versions, noteDesignerNames);

    return {
        query,
        normalizedQuery: normalizeText(query),
        keyword: parsed.keyword,
        branches: parsed.branches.map(branch => ({
            musicIds: sortedNumbers(branch.musicIds),
            categories: sortedStrings(branch.categories),
            versions: sortedStrings(branch.versions),
            noteDesigners: sortedStrings(branch.noteDesigners),
            difficulties: sortedNumbers(branch.difficulties),
            chartTypes: sortedStrings(branch.chartTypes),
            levels: sortedStrings(branch.levels),
            minInternalLevel: branch.minInternalLevel,
            maxInternalLevel: branch.maxInternalLevel,
            minComboStatus: branch.minComboStatus,
            minSyncStatus: branch.minSyncStatus,
            minRankRate: branch.minRankRate,
            minDxScoreTier: branch.minDxScoreTier,
            b50Only: branch.b50Only === true,
            b50Bucket: branch.b50Bucket,
            hasChartFilters: hasChartFilters(branch),
            hasScoreFilters: hasScoreFilters(branch),
        })),
    };
}

export function queryNeedsScoreData(
    query: string,
    versions: Version[],
    noteDesignerNames: string[] = [],
): boolean {
    const parsed = parseQuery(query, versions, noteDesignerNames);
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
        branch.noteDesigners.size > 0 &&
        !branch.noteDesigners.has(getChartNoteDesigner(chart))
    ) {
        return false;
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

    if (branch.b50Bucket !== undefined && record.b50Bucket !== branch.b50Bucket) {
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

function songKeywordScore(music: Music, keyword: string): number {
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

function chartDesignerKeywordScore(chart: Chart, keyword: string): number {
    if (!keyword) return 1;

    const k = normalizeText(keyword);
    const designer = getChartNoteDesigner(chart);
    if (!designer) return 0;

    const designerNames = [designer];
    const normDesigner = normalizeText(designer);
    for (const [key, aliases] of Object.entries(NOTE_DESIGNER_ALIASES)) {
        if (normalizeText(key) === normDesigner) {
            designerNames.push(...aliases);
            break;
        }
    }

    let best = 0;
    for (const name of designerNames) {
        const f = normalizeText(name);
        if (f.length === 0) continue;

        if (f === k) best = Math.max(best, 100);
        else if (f.startsWith(k)) best = Math.max(best, 80);
        else if (f.includes(k)) best = Math.max(best, 60);
    }

    return best;
}

function musicKeywordScore(music: Music, keyword: string): number {
    if (!keyword) return 1;

    let best = songKeywordScore(music, keyword);

    for (const chart of music.charts) {
        best = Math.max(best, chartDesignerKeywordScore(chart, keyword));
    }

    return best;
}

export function searchMusic(
    query: string,
    musics: Music[],
    versions: Version[],
    noteDesignerNames: string[] = buildNoteDesignerNames(musics),
): Music[] {
    const parsed = parseQuery(query, versions, noteDesignerNames);

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
    noteDesignerNames: string[] = buildNoteDesignerNames(musics),
): ChartSearchResult[] {
    const parsed = parseQuery(query, versions, noteDesignerNames);
    const results: ChartSearchResult[] = [];
    const seen = new Set<string>();

    for (const music of musics) {
        const musicScore = musicKeywordScore(music, parsed.keyword);

        if (parsed.keyword && musicScore <= 0) {
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
                const score = parsed.keyword
                    ? Math.max(songKeywordScore(music, parsed.keyword), chartDesignerKeywordScore(chart, parsed.keyword))
                    : 1;

                if (parsed.keyword && score <= 0) {
                    continue;
                }

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
