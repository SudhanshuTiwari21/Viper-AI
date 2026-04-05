/**
 * macOS Dock hover text is keyed heavily by bundle id. Patching Electron.app's plist often
 * still shows "Electron" because `com.github.Electron` stays the same.
 *
 * We APFS-clone (copy-on-write) `Electron.app` → `Viper.app`, set a distinct
 * CFBundleIdentifier + display name, point `path.txt` at Viper.app, then re-sign and
 * register with Launch Services so `npm run dev` launches as "Viper".
 */
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const APP_ROOT = path.resolve(__dirname, "..");
const DISPLAY_NAME = "Viper";
const DEV_BUNDLE_ID = "ai.viper.desktop.dev";

/** iconset members for `iconutil -c icns` (see Apple HIG / iconutil man page). */
const ICONSET_SIZES = [
  ["icon_16x16.png", 16, 16],
  ["icon_16x16@2x.png", 32, 32],
  ["icon_32x32.png", 32, 32],
  ["icon_32x32@2x.png", 64, 64],
  ["icon_128x128.png", 128, 128],
  ["icon_128x128@2x.png", 256, 256],
  ["icon_256x256.png", 256, 256],
  ["icon_256x256@2x.png", 512, 512],
  ["icon_512x512.png", 512, 512],
  ["icon_512x512@2x.png", 1024, 1024],
];

function collectElectronRoots() {
  /** @type {Set<string>} */
  const roots = new Set();

  for (const start of [APP_ROOT, path.join(APP_ROOT, "scripts")]) {
    try {
      roots.add(path.dirname(require.resolve("electron/package.json", { paths: [start] })));
    } catch {
      /* no electron */
    }
  }

  let dir = APP_ROOT;
  for (let i = 0; i < 12; i++) {
    const pkg = path.join(dir, "node_modules/electron/package.json");
    if (fs.existsSync(pkg)) {
      roots.add(path.dirname(pkg));
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return [...roots];
}

function cloneToViperApp(electronRoot) {
  const dist = path.join(electronRoot, "dist");
  const src = path.join(dist, "Electron.app");
  const dst = path.join(dist, "Viper.app");
  if (!fs.existsSync(src)) {
    return false;
  }
  fs.rmSync(dst, { recursive: true, force: true });
  try {
    execFileSync("cp", ["-cR", src, dst], { stdio: "pipe" });
  } catch {
    execFileSync("cp", ["-R", src, dst], { stdio: "pipe" });
  }
  return true;
}

function patchViperPlist(plistPath) {
  const buddy = "/usr/libexec/PlistBuddy";
  execFileSync(buddy, ["-c", `Set :CFBundleDisplayName ${DISPLAY_NAME}`, plistPath]);
  execFileSync(buddy, ["-c", `Set :CFBundleName ${DISPLAY_NAME}`, plistPath]);
  execFileSync(buddy, ["-c", `Set :CFBundleIdentifier ${DEV_BUNDLE_ID}`, plistPath]);
  // Bundle icon (Dock when app is quit, Finder, Cmd-Tab). Without this, quit shows Electron artwork.
  execFileSync(buddy, ["-c", "Set :CFBundleIconFile viper", plistPath]);
}

/**
 * @param {string} sourcePng 1024-ish master (e.g. resources/icon.png)
 * @param {string} outIcnsPath
 */
function buildIcnsFromPng(sourcePng, outIcnsPath) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "viper-icon-"));
  const iconset = path.join(tmpDir, "AppIcon.iconset");
  fs.mkdirSync(iconset);
  try {
    for (const [name, w, h] of ICONSET_SIZES) {
      execFileSync("sips", ["-z", String(h), String(w), sourcePng, "--out", path.join(iconset, name)], {
        stdio: "pipe",
      });
    }
    execFileSync("iconutil", ["-c", "icns", iconset, "-o", outIcnsPath], { stdio: "pipe" });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function installViperIcns(viperAppPlistPath) {
  const sourcePng = path.join(APP_ROOT, "resources", "icon.png");
  if (!fs.existsSync(sourcePng)) {
    console.warn("patch-electron-macos-branding: resources/icon.png missing; skipping .icns");
    return;
  }
  const resourcesDir = path.join(path.dirname(viperAppPlistPath), "Resources");
  const outIcns = path.join(resourcesDir, "viper.icns");
  buildIcnsFromPng(sourcePng, outIcns);
}

function refreshBundle(plistPath) {
  const appBundle = path.resolve(path.dirname(plistPath), "..");
  if (!appBundle.endsWith(".app") || !fs.existsSync(appBundle)) return;

  try {
    execFileSync("codesign", ["--force", "--deep", "--sign", "-", appBundle], {
      stdio: "pipe",
    });
  } catch {
    /* codesign can fail in restricted environments */
  }

  const lsregister =
    "/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister";
  if (fs.existsSync(lsregister)) {
    try {
      execFileSync(lsregister, ["-f", "-R", "-trusted", appBundle], { stdio: "pipe" });
    } catch {
      /* optional */
    }
  }
}

function pointPathTxtAtViper(electronRoot) {
  const rel = "Viper.app/Contents/MacOS/Electron";
  fs.writeFileSync(path.join(electronRoot, "path.txt"), rel, "utf8");
}

if (process.platform !== "darwin") {
  process.exit(0);
}

const roots = collectElectronRoots();
let patched = 0;

for (const root of roots) {
  try {
    if (!cloneToViperApp(root)) continue;
    const plist = path.join(root, "dist/Viper.app/Contents/Info.plist");
    if (!fs.existsSync(plist)) continue;
    patchViperPlist(plist);
    installViperIcns(plist);
    refreshBundle(plist);
    pointPathTxtAtViper(root);
    patched += 1;
  } catch (err) {
    console.warn(`patch-electron-macos-branding: skipped ${root}:`, err.message);
  }
}

if (patched === 0) {
  process.exit(0);
}

if (process.env.npm_lifecycle_event !== "postinstall") {
  console.log(
    `patch-electron-macos-branding: ${patched} install(s) → Viper.app + viper.icns (Dock icon stays correct when the app is quit). Remove any extra "Electron" tile from the Dock if you still see a duplicate.`,
  );
}
