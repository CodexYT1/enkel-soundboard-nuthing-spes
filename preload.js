const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
    pickSound: () => ipcRenderer.invoke("pick-sound"),
    saveSounds: (data) => ipcRenderer.send("save-sounds", data),
    onLoadSounds: (callback) => ipcRenderer.on("load-sounds", (event, data) => callback(data)),
    registerHotkey: (keybind) => ipcRenderer.send("register-hotkey", keybind),
    unregisterHotkey: (keybind) => ipcRenderer.send("unregister-hotkey", keybind),
    onPlaySound: (callback) => ipcRenderer.on("play-sound", (event, keybind) => callback(keybind))
});
