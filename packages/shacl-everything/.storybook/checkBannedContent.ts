import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import type { Plugin } from "vite";

const BANNED = "https://vocab.eccenca.com/shui/";

function findFiles(dir: string): string[] {
    const results: string[] = [];
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
            results.push(...findFiles(full));
        } else {
            results.push(full);
        }
    }
    return results;
}

export function checkBannedContent(srcDir: string): Plugin {
    return {
        name: "check-banned-content",
        buildStart() {
            const hits: string[] = [];
            for (const file of findFiles(srcDir)) {
                const content = readFileSync(file, "utf8");
                if (content.includes(BANNED)) {
                    hits.push(relative(srcDir, file));
                }
            }
            if (hits.length > 0) {
                throw new Error(
                    `Banned content found — "${BANNED}" must never appear in source files.\n` +
                        hits.map((f) => `  • ${f}`).join("\n"),
                );
            }
        },
    };
}
