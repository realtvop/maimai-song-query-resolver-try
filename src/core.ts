import type { Music } from "maimai_music_metadata";

/**
 * Basic search function for maimai music.
 * Filters by title, artist, Chinese aliases, or song ID (case-insensitive substring match).
 */
export function searchMusic(query: string, musics: Music[]): Music[] {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) {
        return musics;
    }

    return musics.filter((music) => {
        // 1. Check title
        if (music.title.toLowerCase().includes(trimmed)) {
            return true;
        }

        // 2. Check artist
        if (music.artist.toLowerCase().includes(trimmed)) {
            return true;
        }

        // 3. Check Chinese aliases
        if (music.aliases && music.aliases.cn) {
            const hasAliasMatch = music.aliases.cn.some((alias) =>
                alias.toLowerCase().includes(trimmed)
            );
            if (hasAliasMatch) {
                return true;
            }
        }

        // 4. Check ID
        if (music.id.toString() === trimmed) {
            return true;
        }

        return false;
    });
}
