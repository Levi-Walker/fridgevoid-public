const BASE_URL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? "/api" : "http://localhost:8080");

export const STATUS_KEYS = ["EXPIRING", "USE_SOON", "EXPIRED", "FRESH"];

const API_STATUS_KEYS = {
    EXPIRING: "about_to_expire",
    USE_SOON: "use_soon",
    EXPIRED: "expired",
    FRESH: "fresh",
};

const STATUS_KEY_ALIASES = {
    EXPIRING: "EXPIRING",
    ABOUTTOEXPIRE: "EXPIRING",
    ABOUT_TO_EXPIRE: "EXPIRING",
    USESOON: "USE_SOON",
    USE_SOON: "USE_SOON",
    EXPIRED: "EXPIRED",
    FRESH: "FRESH",
    ALLGOOD: "FRESH",
    ALL_GOOD: "FRESH",
};

export const DEFAULT_STATUS_LABELS = {
    EXPIRING: "About to expire",
    USE_SOON: "Use soon",
    EXPIRED: "Expired",
    FRESH: "Fresh",
};

export const DEFAULT_STATUS_ORDER = ["EXPIRING", "USE_SOON", "EXPIRED", "FRESH"];
export const DEFAULT_VISUAL_MODE = "image";

export const DEFAULT_PREFERENCES = {
    statusLabels: DEFAULT_STATUS_LABELS,
    statusOrder: DEFAULT_STATUS_ORDER,
    defaultVisualMode: DEFAULT_VISUAL_MODE,
    defaultQuickAddLocation: "",
    compactCardMode: false,
};

function normalizeStatusLabels(labels) {
    return STATUS_KEYS.reduce((normalizedLabels, statusKey) => {
        const label = getStatusLabel(labels, statusKey);
        normalizedLabels[statusKey] = label || DEFAULT_STATUS_LABELS[statusKey];
        return normalizedLabels;
    }, {});
}

function normalizeStatusKey(statusKey) {
    if (typeof statusKey !== "string") {
        return null;
    }

    const normalizedKey = statusKey.trim().replaceAll("-", "_").replaceAll(" ", "_").toUpperCase();
    return STATUS_KEY_ALIASES[normalizedKey] || null;
}

function getStatusLabel(labels, statusKey) {
    if (!labels || typeof labels !== "object") {
        return "";
    }

    for (const [rawKey, rawLabel] of Object.entries(labels)) {
        if (normalizeStatusKey(rawKey) === statusKey && typeof rawLabel === "string") {
            return rawLabel.trim();
        }
    }

    return "";
}

function normalizeStatusOrder(order) {
    if (!Array.isArray(order)) {
        return DEFAULT_STATUS_ORDER;
    }

    const uniqueKeys = order.reduce((normalizedOrder, rawStatusKey) => {
        const statusKey = normalizeStatusKey(rawStatusKey);

        if (statusKey && !normalizedOrder.includes(statusKey)) {
            normalizedOrder.push(statusKey);
        }

        return normalizedOrder;
    }, []);

    if (uniqueKeys.length !== STATUS_KEYS.length) {
        return DEFAULT_STATUS_ORDER;
    }

    return uniqueKeys;
}

function normalizeVisualMode(value) {
    return value === "emoji" ? "emoji" : "image";
}

function toApiStatusLabels(labels) {
    const normalizedLabels = normalizeStatusLabels(labels);

    return STATUS_KEYS.reduce((apiLabels, statusKey) => {
        apiLabels[API_STATUS_KEYS[statusKey]] = normalizedLabels[statusKey];
        return apiLabels;
    }, {});
}

function toApiStatusOrder(order) {
    return normalizeStatusOrder(order).map((statusKey) => API_STATUS_KEYS[statusKey]);
}

export function normalizePreferences(preferences) {
    if (!preferences || typeof preferences !== "object") {
        return DEFAULT_PREFERENCES;
    }

    const rawVisualMode = preferences.defaultVisualMode ?? preferences.defaultCardImageMode;

    return {
        statusLabels: normalizeStatusLabels(preferences.statusLabels),
        statusOrder: normalizeStatusOrder(preferences.statusOrder),
        defaultVisualMode: normalizeVisualMode(rawVisualMode),
        defaultQuickAddLocation: typeof preferences.defaultQuickAddLocation === "string"
            ? preferences.defaultQuickAddLocation.trim()
            : "",
        compactCardMode: Boolean(preferences.compactCardMode),
    };
}

export function preparePreferencesForSave(preferences) {
    const normalizedPreferences = normalizePreferences(preferences);

    return {
        statusLabels: toApiStatusLabels(preferences.statusLabels),
        statusOrder: toApiStatusOrder(preferences.statusOrder),
        defaultCardImageMode: normalizeVisualMode(preferences.defaultVisualMode ?? preferences.defaultCardImageMode),
        defaultQuickAddLocation: typeof preferences.defaultQuickAddLocation === "string"
            ? preferences.defaultQuickAddLocation.trim()
            : "",
        compactCardMode: Boolean(preferences.compactCardMode ?? normalizedPreferences.compactCardMode),
    };
}

async function request(path, options = {}) {
    const response = await fetch(`${BASE_URL}${path}`, {
        headers: {
            "Content-Type": "application/json",
        },
        ...options,
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const error = new Error(errorData.error || errorData.message || "Preferences request failed");
        error.status = response.status;
        error.data = errorData;
        throw error;
    }

    if (response.status === 204) {
        return null;
    }

    const text = await response.text();
    return text ? JSON.parse(text) : null;
}

export const PreferencesAPI = {
    get: async () => normalizePreferences(await request("/preferences")),

    update: async (preferences) => normalizePreferences(await request("/preferences", {
        method: "PUT",
        body: JSON.stringify(preparePreferencesForSave(preferences)),
    })),
};
