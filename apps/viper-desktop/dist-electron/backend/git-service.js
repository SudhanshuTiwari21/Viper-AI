"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupGitService = setupGitService;
const electron_1 = require("electron");
const child_process_1 = require("child_process");
function runGit(root, args) {
    return new Promise((resolve, reject) => {
        const child = (0, child_process_1.spawn)("git", args, { cwd: root });
        let out = "";
        let err = "";
        child.stdout.on("data", (d) => { out += d.toString(); });
        child.stderr.on("data", (d) => { err += d.toString(); });
        child.on("close", (code) => {
            if (code === 0)
                resolve(out.trim());
            else
                reject(new Error(err || `git exited ${code}`));
        });
        child.on("error", reject);
    });
}
function setupGitService() {
    electron_1.ipcMain.handle("git:branch", async (_e, root) => {
        try {
            return await runGit(root, ["rev-parse", "--abbrev-ref", "HEAD"]);
        }
        catch {
            return "";
        }
    });
    electron_1.ipcMain.handle("git:log", async (_e, root, relPath) => {
        try {
            const out = await runGit(root, ["log", "--oneline", "-20", "--", relPath]);
            return out ? out.split("\n").filter(Boolean) : [];
        }
        catch {
            return [];
        }
    });
    electron_1.ipcMain.handle("git:status", async (_e, root) => {
        try {
            const out = await runGit(root, ["status", "--porcelain=v1"]);
            if (!out)
                return [];
            return out.split("\n").filter(Boolean).map((line) => {
                const status = line.slice(0, 2);
                const file = line.slice(3);
                return { status: status.trim(), file };
            });
        }
        catch {
            return [];
        }
    });
    electron_1.ipcMain.handle("git:diff", async (_e, root, filePath) => {
        try {
            const args = ["diff"];
            if (filePath)
                args.push("--", filePath);
            return await runGit(root, args);
        }
        catch {
            return "";
        }
    });
    electron_1.ipcMain.handle("git:stage", async (_e, root, filePath) => {
        try {
            await runGit(root, ["add", filePath]);
            return true;
        }
        catch {
            return false;
        }
    });
    electron_1.ipcMain.handle("git:unstage", async (_e, root, filePath) => {
        try {
            await runGit(root, ["reset", "HEAD", filePath]);
            return true;
        }
        catch {
            return false;
        }
    });
    electron_1.ipcMain.handle("git:commit", async (_e, root, message) => {
        try {
            await runGit(root, ["commit", "-m", message]);
            return true;
        }
        catch {
            return false;
        }
    });
    electron_1.ipcMain.handle("git:discard", async (_e, root, filePath) => {
        try {
            await runGit(root, ["checkout", "--", filePath]);
            return true;
        }
        catch {
            return false;
        }
    });
}
