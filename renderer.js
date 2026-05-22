const buttonsDiv = document.getElementById("buttons");
const addBtn = document.getElementById("add");

const popup = document.getElementById("popup");
const labelInput = document.getElementById("labelInput");
const keyInput = document.getElementById("keyInput");
const confirmBtn = document.getElementById("confirm");

const deletePopup = document.getElementById("deletePopup");
const deleteYes = document.getElementById("deleteYes");
const deleteNo = document.getElementById("deleteNo");

const deviceSelect = document.getElementById("deviceSelect");
const monitorSelect = document.getElementById("monitorSelect");
const monitorToggle = document.getElementById("monitorToggle");

const mixOut = document.getElementById("mixOut");
const monitorOut = document.getElementById("monitorOut");

let pendingFile = null;
let sounds = [];
let tileToDelete = null;

let capturingKeybind = false;
let currentModifier = null;
let editingEntry = null;

let audioCtx = null;
let mixDestination = null;
let soundboardGain = null;

let monitorEnabled = false;
let monitorVolume = 1.0; // fixed volume since slider is removed

function toFileUrl(path) {
    return "file://" + path.replace(/\\/g, "/");
}

async function initAudioGraph() {
    if (audioCtx) return;

    audioCtx = new AudioContext();
    mixDestination = audioCtx.createMediaStreamDestination();

    soundboardGain = audioCtx.createGain();
    soundboardGain.gain.value = 2;
    soundboardGain.connect(mixDestination);

    const keepAliveOsc = audioCtx.createOscillator();
    const keepAliveGain = audioCtx.createGain();
    keepAliveGain.gain.value = 0.00001;
    keepAliveOsc.connect(keepAliveGain).connect(soundboardGain);
    keepAliveOsc.start();

    mixOut.srcObject = mixDestination.stream;
}

async function populateDevices() {
    const devices = await navigator.mediaDevices.enumerateDevices();

    deviceSelect.innerHTML = "";
    monitorSelect.innerHTML = "";

    devices.forEach(d => {
        if (d.kind === "audiooutput") {
            const opt1 = document.createElement("option");
            opt1.value = d.deviceId;
            opt1.textContent = d.label || `Output: ${d.deviceId}`;
            deviceSelect.appendChild(opt1);

            const opt2 = document.createElement("option");
            opt2.value = d.deviceId;
            opt2.textContent = d.label || `Output: ${d.deviceId}`;
            monitorSelect.appendChild(opt2);
        }
    });

    if (mixOut.setSinkId) await mixOut.setSinkId(deviceSelect.value);
    if (monitorOut.setSinkId) await monitorOut.setSinkId(monitorSelect.value);
}

deviceSelect.addEventListener("change", async () => {
    if (mixOut.setSinkId) await mixOut.setSinkId(deviceSelect.value);
});

monitorSelect.addEventListener("change", async () => {
    if (monitorOut.setSinkId) await monitorOut.setSinkId(monitorSelect.value);
});

monitorToggle.addEventListener("change", () => {
    monitorEnabled = monitorToggle.checked;
});

function playSound(entry) {
    entry.audio.currentTime = 0;
    entry.audio.play();

    if (monitorEnabled) {
        const clone = new Audio(entry.audio.src);
        clone.volume = entry.audio.volume * monitorVolume;
        clone.play();
    }
}

function parseKeybind(str) {
    const parts = str.toLowerCase().split("+").map(s => s.trim());
    return {
        alt: parts.includes("alt"),
        ctrl: parts.includes("ctrl"),
        key: parts.find(p => p !== "alt" && p !== "ctrl")
    };
}

function createTile(entry) {
    const tile = document.createElement("div");
    tile.className = "sound-tile";
    tile.dataset.key = entry.keybind;

    const deleteBtn = document.createElement("div");
    deleteBtn.className = "delete-btn";
    deleteBtn.textContent = "✖";
    deleteBtn.onclick = () => {
        tileToDelete = tile;
        deletePopup.style.display = "flex";
    };

    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = 0;
    slider.max = 1;
    slider.step = 0.01;
    slider.value = entry.audio.volume;
    slider.className = "volume-slider";
    slider.oninput = () => entry.audio.volume = parseFloat(slider.value);

    const labelText = document.createElement("div");
    labelText.className = "label-text";
    labelText.textContent = `${entry.keybind.toUpperCase()} - ${entry.label}`;
    labelText.style.cursor = "pointer";
    labelText.onclick = () => {
        editingEntry = entry;
        capturingKeybind = true;
        currentModifier = null;
        keyInput.value = "Press ALT or CTRL…";
        popup.style.display = "flex";
    };

    tile.appendChild(deleteBtn);
    tile.appendChild(slider);
    tile.appendChild(labelText);
    buttonsDiv.appendChild(tile);

    window.api.registerHotkey(entry.keybind);
}

function saveAll() {
    const data = sounds.map(s => ({
        keybind: s.keybind,
        label: s.label,
        file: s.file
    }));
    window.api.saveSounds(data);
}

addBtn.onclick = async () => {
    const file = await window.api.pickSound();
    if (!file) return;

    await initAudioGraph();

    pendingFile = file;
    labelInput.value = "";
    keyInput.value = "Press ALT or CTRL…";
    capturingKeybind = true;
    currentModifier = null;
    editingEntry = null;

    popup.style.display = "flex";
};

keyInput.onclick = () => {
    capturingKeybind = true;
    currentModifier = null;
    editingEntry = null;
    keyInput.value = "Press ALT or CTRL…";
};

document.addEventListener("keydown", (e) => {
    if (!capturingKeybind) return;

    if (!currentModifier) {
        if (e.altKey) {
            currentModifier = "alt";
            keyInput.value = "ALT +";
        } else if (e.ctrlKey) {
            currentModifier = "ctrl";
            keyInput.value = "CTRL +";
        }
        return;
    }

    if (currentModifier) {
        if (e.key.length === 1 || /^[a-z0-9]$/i.test(e.key)) {
            keyInput.value = `${currentModifier}+${e.key.toLowerCase()}`;
            capturingKeybind = false;
        }
    }
});

confirmBtn.onclick = async () => {
    const keybind = keyInput.value.trim().toLowerCase();
    const label = labelInput.value.trim();

    if (!keybind.includes("+")) return;

    const parsed = parseKeybind(keybind);
    if (!parsed.key) return;

    if (editingEntry) {
        const oldKey = editingEntry.keybind;
        window.api.unregisterHotkey(oldKey);

        editingEntry.keybind = keybind;

        const tile = [...buttonsDiv.children].find(t => t.dataset.key === oldKey);
        if (tile) {
            tile.dataset.key = keybind;
            tile.querySelector(".label-text").textContent = `${keybind.toUpperCase()} - ${editingEntry.label}`;
        }

        window.api.registerHotkey(keybind);
        saveAll();

        popup.style.display = "none";
        editingEntry = null;
        return;
    }

    if (!pendingFile) return;

    await initAudioGraph();

    const audio = new Audio(toFileUrl(pendingFile));
    audio.volume = 1;

    const source = audioCtx.createMediaElementSource(audio);
    source.connect(soundboardGain);

    const entry = { keybind, label, file: pendingFile, audio, source };
    sounds.push(entry);

    createTile(entry);
    saveAll();

    popup.style.display = "none";
    pendingFile = null;
};

deleteYes.onclick = () => {
    if (tileToDelete) {
        const keybind = tileToDelete.dataset.key;

        tileToDelete.remove();

        const index = sounds.findIndex(s => s.keybind === keybind);
        if (index !== -1) {
            const entry = sounds[index];
            if (entry.source) {
                try { entry.source.disconnect(); } catch {}
            }
            sounds.splice(index, 1);
        }

        window.api.unregisterHotkey(keybind);
        saveAll();

        tileToDelete = null;
    }
    deletePopup.style.display = "none";
};

deleteNo.onclick = () => {
    tileToDelete = null;
    deletePopup.style.display = "none";
};

window.api.onLoadSounds(async (saved) => {
    if (saved.length > 0) await initAudioGraph();

    saved.forEach(s => {
        const audio = new Audio(toFileUrl(s.file));
        audio.volume = 1;

        let source = null;
        if (audioCtx && soundboardGain) {
            source = audioCtx.createMediaElementSource(audio);
            source.connect(soundboardGain);
        }

        const entry = { ...s, audio, source };
        sounds.push(entry);
        createTile(entry);
    });

    await populateDevices();
});

window.api.onPlaySound((keybind) => {
    const entry = sounds.find(s => s.keybind === keybind);
    if (entry) playSound(entry);
});

(async () => {
    await populateDevices();
})();
