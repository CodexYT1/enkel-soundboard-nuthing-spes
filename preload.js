const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
    pickSound: () => ipcRenderer.invoke("pick-sound"),
    saveSounds: (data) => ipcRenderer.send("save-sounds", data),
    onLoadSounds: (callback) => ipcRenderer.on("load-sounds", (event, data) => callback(data)),
    registerHotkey: (keybind) => ipcRenderer.send("register-hotkey", keybind),
    unregisterHotkey: (keybind) => ipcRenderer.send("unregister-hotkey", keybind),
    onPlaySound: (callback) => ipcRenderer.on("play-sound", (event, keybind) => callback(keybind)),
    minimizeWindow: () => ipcRenderer.send("window-minimize"),
    maximizeWindow: () => ipcRenderer.send("window-maximize-toggle"),
    closeWindow: () => ipcRenderer.send("window-close"),
    onWindowMaximized: (callback) => ipcRenderer.on("window-maximized", () => callback()),
    onWindowRestored: (callback) => ipcRenderer.on("window-restored", () => callback())
});
