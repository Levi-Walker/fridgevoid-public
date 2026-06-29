function getStorage() {
    if (typeof window === "undefined") {
        return null;
    }

    return window.sessionStorage;
}

export function loadDraft(key, fallback = null) {
    const storage = getStorage();
    if (!storage || !key) {
        return fallback;
    }

    try {
        const rawValue = storage.getItem(key);
        return rawValue ? JSON.parse(rawValue) : fallback;
    } catch {
        return fallback;
    }
}

export function saveDraft(key, value) {
    const storage = getStorage();
    if (!storage || !key) {
        return;
    }

    storage.setItem(key, JSON.stringify(value));
}

export function clearDraft(key) {
    const storage = getStorage();
    if (!storage || !key) {
        return;
    }

    storage.removeItem(key);
}
