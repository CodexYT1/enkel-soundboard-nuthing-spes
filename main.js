const { app, BrowserWindow, ipcMain, dialog, globalShortcut } = require("electron");
const path = require("path");
const fs = require("fs");
const { autoUpdater } = require("electron-updater");

let dataFile;
let mainWindow;

function loadSounds() {
    try {
        if (!fs.existsSync(dataFile)) return [];
        return JSON.parse(fs.readFileSync(dataFile, "utf8"));
    } catch {
        return [];
    }
}

function saveSounds(sounds) {
    fs.writeFileSync(dataFile, JSON.stringify(sounds, null, 2));
}

function formatAccelerator(keybind) {
    const parts = keybind.toLowerCase().split("+").map(p => p.trim());
    const mods = [];
    let key = null;

    for (const p of parts) {
        if (p === "alt") mods.push("Alt");
        else if (p === "ctrl") mods.push("Control");
        else key = p;
    }

    if (!key) return null;
    return [...mods, key.toUpperCase()].join("+");
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 700,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    mainWindow.loadFile("index.html");

    mainWindow.webContents.on("did-finish-load", () => {
        mainWindow.webContents.send("load-sounds", loadSounds());
    });

    mainWindow.on("closed", () => {
        mainWindow = null;
    });
}

// =========================
// 🔄 AUTO UPDATE HANDLING
// =========================
function setupAutoUpdater() {
    autoUpdater.autoDownload = false; // we ask first

    autoUpdater.on("update-available", (info) => {
        if (!mainWindow) return;

        const result = dialog.showMessageBoxSync(mainWindow, {
            type: "info",
            buttons: ["Update now", "Later"],
            defaultId: 0,
            cancelId: 1,
            title: "Update available",
            message: "A new version of Enkel Soundboard is available.",
            detail: `Current version: ${app.getVersion()}\nNew version: ${info.version}\n\nDo you want to download and install it now?`
        });

        if (result === 0) {
            autoUpdater.downloadUpdate();
        }
    });

    autoUpdater.on("update-downloaded", () => {
        if (!mainWindow) return;

        const result = dialog.showMessageBoxSync(mainWindow, {
            type: "info",
            buttons: ["Restart now", "Later"],
            defaultId: 0,
            cancelId: 1,
            title: "Update ready",
            message: "The update has been downloaded.",
            detail: "Restart Enkel Soundboard to apply the update?"
        });

        if (result === 0) {
            autoUpdater.quitAndInstall();
        }
    });

    autoUpdater.on("error", (err) => {
        console.error("Auto update error:", err);
    });

    // Check for updates a few seconds after start
    setTimeout(() => {
        autoUpdater.checkForUpdates();
    }, 5000);
}

app.whenReady().then(() => {
    dataFile = path.join(app.getPath("userData"), "sounds.json");
    createWindow();
    setupAutoUpdater();
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

app.on("will-quit", () => {
    globalShortcut.unregisterAll();
});

// =========================
// IPC + HOTKEYS
// =========================
ipcMain.handle("pick-sound", async () => {
    const result = await dialog.showOpenDialog({
        filters: [{ name: "Audio", extensions: ["mp3", "wav", "ogg", "mp4"] }],
        properties: ["openFile"]
    });

    return result.canceled ? null : result.filePaths[0];
});

ipcMain.on("save-sounds", (event, sounds) => {
    saveSounds(sounds);
});

ipcMain.on("register-hotkey", (event, keybind) => {
    const accel = formatAccelerator(keybind);
    if (!accel) return;

    globalShortcut.unregister(accel);

    const senderId = event.sender.id;

    globalShortcut.register(accel, () => {
        const allWindows = BrowserWindow.getAllWindows();
        const target = allWindows.find(w => w.webContents.id === senderId);
        if (target) {
            target.webContents.send("play-sound", keybind);
        }
    });
});

ipcMain.on("unregister-hotkey", (event, keybind) => {
    const accel = formatAccelerator(keybind);
    if (!accel) return;
    globalShortcut.unregister(accel);
});
