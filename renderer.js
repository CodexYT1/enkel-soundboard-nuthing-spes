const buttonsDiv = document.getElementById("buttons");
const addBtn = document.getElementById("add");

const popup = document.getElementById("popup");
const labelInput = document.getElementById("labelInput");
const keyInput = document.getElementById("keyInput");
const colorSelect = document.getElementById("colorSelect");
const confirmBtn = document.getElementById("confirm");
const cancelKey = document.getElementById("cancelKey");
const clearKey = document.getElementById("clearKey");

const deletePopup = document.getElementById("deletePopup");
const deleteYes = document.getElementById("deleteYes");
const deleteNo = document.getElementById("deleteNo");

const settingsBtn = document.getElementById("settingsBtn");
const settingsModal = document.getElementById("settingsModal");
const closeSettings = document.getElementById("closeSettings");

const deviceSelect = document.getElementById("deviceSelect");
const monitorSelect = document.getElementById("monitorSelect");
const monitorToggle = document.getElementById("monitorToggle");

const mixOut = document.getElementById("mixOut");
const monitorOut = document.getElementById("monitorOut");
const modalOverlay = document.getElementById("modalOverlay");

const minimizeBtn = document.getElementById("minimizeBtn");
const maximizeBtn = document.getElementById("maximizeBtn");
const closeBtn = document.getElementById("closeBtn");

const tourOverlay = document.getElementById("tourOverlay");
const tourHighlight = document.getElementById("tourHighlight");
const tourBox = document.getElementById("tourBox");
const tourText = document.getElementById("tourText");
const tourNext = document.getElementById("tourNext");
const tourSkip = document.getElementById("tourSkip");
const startTourBtn = document.getElementById("startTour");

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
let monitorVolume = 1.0;

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

    if (mixOut.setSinkId && deviceSelect.value) await mixOut.setSinkId(deviceSelect.value);
    if (monitorOut.setSinkId && monitorSelect.value) await monitorOut.setSinkId(monitorSelect.value);
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

settingsBtn.onclick = () => {
    settingsModal.style.display = "flex";
    showModalOverlay();
};

closeSettings.onclick = () => {
    settingsModal.style.display = "none";
    hideModalOverlay();
};

minimizeBtn?.addEventListener("click", () => {
    window.api.minimizeWindow();
});

maximizeBtn?.addEventListener("click", () => {
    window.api.maximizeWindow();
});

closeBtn?.addEventListener("click", () => {
    window.api.closeWindow();
});

window.api.onWindowMaximized(() => {
    if (maximizeBtn) maximizeBtn.textContent = "🗗";
});

window.api.onWindowRestored(() => {
    if (maximizeBtn) maximizeBtn.textContent = "🗖";
});

function showModalOverlay() {
    modalOverlay?.classList.add("active");
}

function hideModalOverlay() {
    modalOverlay?.classList.remove("active");
}

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
    tile.dataset.key = entry.keybind || "";

    const deleteBtn = document.createElement("div");
    deleteBtn.className = "delete-btn";
    deleteBtn.textContent = "✖";
    deleteBtn.onclick = (e) => {
        e.stopPropagation();
        tileToDelete = tile;
        deletePopup.style.display = "flex";
        showModalOverlay();
    };

    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = 0;
    slider.max = 1;
    slider.step = 0.01;
    slider.value = entry.audio.volume;
    slider.className = "volume-slider";
    slider.oninput = (e) => {
        e.stopPropagation();
        entry.audio.volume = parseFloat(slider.value);
    };
    slider.onclick = (e) => {
        e.stopPropagation();
    };

    const labelRow = document.createElement("div");
    labelRow.className = "label-row";

    const colorDot = document.createElement("div");
    colorDot.className = "color-dot";
    colorDot.style.background = entry.color || "#5865f2";

    const labelText = document.createElement("div");
    labelText.className = "label-text";
    labelText.textContent = entry.keybind
        ? `${entry.keybind.toUpperCase()} - ${entry.label}`
        : entry.label;

    labelRow.appendChild(labelText);

    const gearBtn = document.createElement("button");
    gearBtn.type = "button";
    gearBtn.className = "gear-btn";
    gearBtn.textContent = "⚙";
    gearBtn.onclick = (e) => {
        e.stopPropagation();
        editingEntry = entry;
        capturingKeybind = true;
        currentModifier = null;
        labelInput.value = entry.label;
        keyInput.value = entry.keybind ? entry.keybind.toUpperCase() : "Press ALT or CTRL…";
        colorSelect.value = entry.color || "#5865f2";
        popup.style.display = "flex";
        showModalOverlay();
    };

    tile.onclick = () => {
        playSound(entry);
    };

    tile.appendChild(deleteBtn);
    tile.appendChild(gearBtn);
    tile.appendChild(colorDot);
    tile.appendChild(slider);
    tile.appendChild(labelRow);
    buttonsDiv.appendChild(tile);

    if (entry.keybind) {
        window.api.registerHotkey(entry.keybind);
    }

    entry._tile = tile;
    entry._colorDot = colorDot;
    entry._labelText = labelText;
}

function saveAll() {
    const data = sounds.map(s => ({
        keybind: s.keybind,
        label: s.label,
        file: s.file,
        color: s.color || "#5865f2"
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
    colorSelect.value = "#5865f2";
    capturingKeybind = true;
    currentModifier = null;
    editingEntry = null;

    popup.style.display = "flex";
    showModalOverlay();
};

keyInput.onclick = () => {
    capturingKeybind = true;
    currentModifier = null;
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

cancelKey.onclick = () => {
    popup.style.display = "none";
    editingEntry = null;
    capturingKeybind = false;
    currentModifier = null;
    pendingFile = null;
    hideModalOverlay();
};

clearKey.onclick = () => {
    if (!editingEntry) return;

    const oldKey = editingEntry.keybind;
    if (oldKey) {
        window.api.unregisterHotkey(oldKey);
    }

    editingEntry.keybind = "";

    if (editingEntry._tile && editingEntry._labelText) {
        editingEntry._tile.dataset.key = "";
        editingEntry._labelText.textContent = editingEntry.label;
    }

    saveAll();
    popup.style.display = "none";
    editingEntry = null;
    capturingKeybind = false;
    hideModalOverlay();
};

confirmBtn.onclick = async () => {
    const keybindRaw = keyInput.value.trim().toLowerCase();
    const label = labelInput.value.trim();
    const color = colorSelect.value || "#5865f2";

    let keybind = "";
    if (keybindRaw.includes("+")) {
        const parsed = parseKeybind(keybindRaw);
        if (!parsed.key) return;
        keybind = `${parsed.alt ? "alt+" : parsed.ctrl ? "ctrl+" : ""}${parsed.key}`;
    }

    if (editingEntry) {
        const oldKey = editingEntry.keybind;
        if (oldKey && oldKey !== keybind) {
            window.api.unregisterHotkey(oldKey);
        }

        editingEntry.label = label || editingEntry.label;
        editingEntry.color = color;
        editingEntry.keybind = keybind;

        if (editingEntry._tile && editingEntry._labelText && editingEntry._colorDot) {
            editingEntry._tile.dataset.key = keybind || "";
            editingEntry._colorDot.style.background = color;
            editingEntry._labelText.textContent = keybind
                ? `${keybind.toUpperCase()} - ${editingEntry.label}`
                : editingEntry.label;
        }

        if (keybind) {
            window.api.registerHotkey(keybind);
        }

        saveAll();
        popup.style.display = "none";
        editingEntry = null;
        capturingKeybind = false;
        hideModalOverlay();
        return;
    }

    if (!pendingFile) return;

    await initAudioGraph();

    const audio = new Audio(toFileUrl(pendingFile));
    audio.volume = 1;

    const source = audioCtx.createMediaElementSource(audio);
    source.connect(soundboardGain);

    const entry = {
        keybind,
        label: label || "Sound",
        file: pendingFile,
        color,
        audio,
        source
    };
    sounds.push(entry);

    createTile(entry);
    saveAll();

    popup.style.display = "none";
    pendingFile = null;
    hideModalOverlay();
};

deleteYes.onclick = () => {
    if (tileToDelete) {
        const index = sounds.findIndex(s => s._tile === tileToDelete);
        if (index !== -1) {
            const entry = sounds[index];
            if (entry.keybind) {
                window.api.unregisterHotkey(entry.keybind);
            }
            if (entry.source) {
                try { entry.source.disconnect(); } catch {}
            }
            sounds.splice(index, 1);
        }

        tileToDelete.remove();
        saveAll();
        tileToDelete = null;
    }
    deletePopup.style.display = "none";
    hideModalOverlay();
};

deleteNo.onclick = () => {
    tileToDelete = null;
    deletePopup.style.display = "none";
    hideModalOverlay();
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

        const entry = {
            keybind: s.keybind || "",
            label: s.label,
            file: s.file,
            color: s.color || "#5865f2",
            audio,
            source
        };
        sounds.push(entry);
        createTile(entry);
    });

    await populateDevices();
});

window.api.onPlaySound((keybind) => {
    const entry = sounds.find(s => s.keybind === keybind);
    if (entry) playSound(entry);
});

/* Drag & drop sound importing */
document.addEventListener("dragover", (e) => {
    e.preventDefault();
});

document.addEventListener("drop", async (e) => {
    e.preventDefault();
    if (!e.dataTransfer.files || e.dataTransfer.files.length === 0) return;

    const file = e.dataTransfer.files[0];
    if (!file.path) return;

    await initAudioGraph();

    pendingFile = file.path;
    labelInput.value = file.name.replace(/\.[^/.]+$/, "");
    keyInput.value = "Press ALT or CTRL…";
    colorSelect.value = "#5865f2";
    capturingKeybind = true;
    currentModifier = null;
    editingEntry = null;

    popup.style.display = "flex";
});

/* Tutorial overlay */
const tourSteps = [
    {
        selector: "#add",
        text: "Click this button to add a new sound. Pick an audio file and set a keybind."
    },
    {
        selector: "#buttons",
        text: "Your sounds appear here as tiles. Click a tile to play it, or adjust its volume and keybind."
    },
    {
        selector: "#settingsBtn",
        text: "Open Settings to choose your output devices and whether you hear the soundboard yourself."
    }
];

let tourIndex = 0;

function positionTourStep() {
    const step = tourSteps[tourIndex];
    const el = document.querySelector(step.selector);
    if (!el) return;

    const rect = el.getBoundingClientRect();

    tourHighlight.style.left = rect.left - 6 + "px";
    tourHighlight.style.top = rect.top - 6 + "px";
    tourHighlight.style.width = rect.width + 12 + "px";
    tourHighlight.style.height = rect.height + 12 + "px";

    let boxX = rect.right + 16;
    let boxY = rect.top;

    if (boxX + 280 > window.innerWidth) {
        boxX = rect.left - 16 - 260;
    }
    if (boxX < 10) boxX = 10;
    if (boxY + 160 > window.innerHeight) {
        boxY = window.innerHeight - 170;
    }

    tourBox.style.left = boxX + "px";
    tourBox.style.top = boxY + "px";

    tourText.textContent = step.text;
}

function startTour() {
    tourIndex = 0;
    tourOverlay.style.display = "block";
    tourOverlay.style.pointerEvents = "auto";
    positionTourStep();
}

function endTour() {
    tourOverlay.style.display = "none";
    tourOverlay.style.pointerEvents = "none";
}

tourNext.onclick = () => {
    tourIndex++;
    if (tourIndex >= tourSteps.length) {
        endTour();
    } else {
        positionTourStep();
    }
};

tourSkip.onclick = () => {
    endTour();
};

startTourBtn.onclick = () => {
    settingsModal.style.display = "none";
    hideModalOverlay();
    startTour();
};

function endTour() {
    tourOverlay.style.display = "none";
    tourOverlay.style.pointerEvents = "none";
    hideModalOverlay();
}

window.addEventListener("resize", () => {
    if (tourOverlay.style.display === "block") {
        positionTourStep();
    }
});

(async () => {
    await populateDevices();
})();
