const NOTES_STORAGE_KEY = "fridgevoid-leftover-notes";

function readNotes() {
    const rawValue = window.localStorage.getItem(NOTES_STORAGE_KEY);

    if (!rawValue) {
        return {};
    }

    try {
        return JSON.parse(rawValue);
    } catch (error) {
        console.error("Failed to parse leftover notes", error);
        return {};
    }
}

function writeNotes(noteMap) {
    window.localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(noteMap));
}

export function applyStoredNotes(leftovers) {
    const storedNotes = readNotes();

    return leftovers.map((leftover) => ({
        ...leftover,
        notes: storedNotes[leftover.id] ?? leftover.notes ?? "",
    }));
}

export function saveLeftoverNotes(leftoverId, notes) {
    const storedNotes = readNotes();
    const normalizedNotes = notes?.trim() || "";

    if (!normalizedNotes) {
        delete storedNotes[leftoverId];
    } else {
        storedNotes[leftoverId] = normalizedNotes;
    }

    writeNotes(storedNotes);
}

export function removeLeftoverNotes(leftoverId) {
    const storedNotes = readNotes();
    delete storedNotes[leftoverId];
    writeNotes(storedNotes);
}

export function clearAllLeftoverNotes() {
    writeNotes({});
}
