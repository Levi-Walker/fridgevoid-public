const BASE_URL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? "/api" : "http://localhost:8080");

export const UI_COLOR_FIELDS = [
    { key: "primaryColor", label: "Primary" },
    { key: "accentColor", label: "Accent" },
    { key: "backgroundColor", label: "Background" },
    { key: "surfaceColor", label: "Surface" },
    { key: "textColor", label: "Text" },
    { key: "freshColor", label: "Fresh" },
    { key: "useSoonColor", label: "Use soon" },
    { key: "expiringColor", label: "Expiring" },
    { key: "expiredColor", label: "Expired" },
];

export const DEFAULT_UI_COLORS = {
    primaryColor: "#2563eb",
    accentColor: "#64748b",
    backgroundColor: "#f8fafc",
    surfaceColor: "#ffffff",
    textColor: "#111827",
    freshColor: "#16a34a",
    useSoonColor: "#ca8a04",
    expiringColor: "#ea580c",
    expiredColor: "#dc2626",
};

export const DEFAULT_DARK_UI_COLORS = {
    primaryColor: "#60a5fa",
    accentColor: "#94a3b8",
    backgroundColor: "#111827",
    surfaceColor: "#1f2937",
    textColor: "#f9fafb",
    freshColor: "#4ade80",
    useSoonColor: "#facc15",
    expiringColor: "#fb923c",
    expiredColor: "#f87171",
};

export const DEFAULT_THEME_COLORS = {
    light: DEFAULT_UI_COLORS,
    dark: DEFAULT_DARK_UI_COLORS,
};

function isHexColor(value) {
    return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

function requireCompletePalette(colors) {
    return UI_COLOR_FIELDS.reduce((completeColors, field) => {
        const value = colors?.[field.key];
        if (!isHexColor(value)) {
            throw new Error(`${field.key} must be a #RRGGBB color`);
        }
        completeColors[field.key] = value.toLowerCase();
        return completeColors;
    }, {});
}

function requireCompleteTheme(colors) {
    if (colors?.light && colors?.dark) {
        return {
            light: requireCompletePalette(colors.light),
            dark: requireCompletePalette(colors.dark),
        };
    }

    return {
        light: requireCompletePalette(colors),
        dark: DEFAULT_DARK_UI_COLORS,
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
        const error = new Error(errorData.error || errorData.message || "Theme color request failed");
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

export async function loadUiColors() {
    return requireCompleteTheme(await request("/theme"));
}

export async function saveUiColors(colors) {
    const completeColors = requireCompleteTheme(colors);

    return request("/theme", {
        method: "PUT",
        body: JSON.stringify(completeColors),
    }).then(requireCompleteTheme);
}


export function applyUiColors(colors, mode = "light") {
    const root = document.documentElement;
    const themeColors = requireCompleteTheme(colors);
    const modeColors = themeColors[mode] || themeColors.light;

    root.style.setProperty("--custom-background", modeColors.backgroundColor);
    root.style.setProperty("--custom-surface", modeColors.surfaceColor);
    root.style.setProperty("--custom-text", modeColors.textColor);
    root.style.setProperty("--custom-accent", modeColors.primaryColor);
    root.style.setProperty("--custom-danger", modeColors.expiredColor);
    root.style.setProperty("--accent-moss", modeColors.accentColor);
    root.style.setProperty("--status-fresh-text", modeColors.freshColor);
    root.style.setProperty("--status-useSoon-text", modeColors.useSoonColor);
    root.style.setProperty("--status-expiring-text", modeColors.expiringColor);
    root.style.setProperty("--status-expired-text", modeColors.expiredColor);
    root.style.setProperty("--status-fresh-bg", `color-mix(in srgb, ${modeColors.freshColor} 12%, ${modeColors.surfaceColor})`);
    root.style.setProperty("--status-useSoon-bg", `color-mix(in srgb, ${modeColors.useSoonColor} 12%, ${modeColors.surfaceColor})`);
    root.style.setProperty("--status-expiring-bg", `color-mix(in srgb, ${modeColors.expiringColor} 12%, ${modeColors.surfaceColor})`);
    root.style.setProperty("--status-expiring-border", `color-mix(in srgb, ${modeColors.expiringColor} 36%, ${modeColors.surfaceColor})`);
    root.style.setProperty("--status-expired-bg", `color-mix(in srgb, ${modeColors.expiredColor} 16%, ${modeColors.surfaceColor})`);
}
