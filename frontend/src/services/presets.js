const BASE_URL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? "/api" : "http://localhost:8080");

function normalizePreset(preset) {
    if (!preset || typeof preset !== "object") {
        return preset;
    }

    const shelfLifeDays = Number(preset.shelfLifeDays);

    return {
        ...preset,
        shelfLifeDays: Number.isFinite(shelfLifeDays) && shelfLifeDays > 0 ? shelfLifeDays : 5,
        usedCount: Number.isFinite(Number(preset.usedCount)) ? Number(preset.usedCount) : 0,
        visualType: preset.imageUrl ? "image" : "emoji",
    };
}

async function request(path, options = {}) {
    const res = await fetch(`${BASE_URL}${path}`, {
        headers: {
            "Content-Type": "application/json",
        },
        ...options,
    });

    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const error = new Error(errorData.error || errorData.message || "Preset request failed");
        error.status = res.status;
        error.data = errorData;
        throw error;
    }

    if (res.status === 204) {
        return null;
    }

    const text = await res.text();
    if (!text) {
        return null;
    }

    const data = JSON.parse(text);
    return Array.isArray(data) ? data.map(normalizePreset) : normalizePreset(data);
}

export const PresetsAPI = {
    getAll: async () => request("/presets"),

    create: (presetInput) =>
        request("/presets", {
            method: "POST",
            body: JSON.stringify(presetInput),
        }),

    update: (presetId, presetInput) =>
        request(`/presets/${presetId}`, {
            method: "PUT",
            body: JSON.stringify(presetInput),
        }),

    remove: (presetId) =>
        request(`/presets/${presetId}`, {
            method: "DELETE",
        }),
};
