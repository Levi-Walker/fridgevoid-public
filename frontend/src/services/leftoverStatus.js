export const STATUS_ORDER = ["EXPIRING", "USE_SOON", "EXPIRED", "FRESH"];

export const STATUS_META = {
    EXPIRING: {
        key: "EXPIRING",
        cssKey: "expiring",
        label: "Use ASAP",
        description: "These expire today or tomorrow",
    },
    USE_SOON: {
        key: "USE_SOON",
        cssKey: "useSoon",
        label: "Use next",
        description: "Expiring within a few days",
    },
    EXPIRED: {
        key: "EXPIRED",
        cssKey: "expired",
        label: "Past date",
        description: "These have passed their use-by date",
    },
    FRESH: {
        key: "FRESH",
        cssKey: "fresh",
        label: "Good to go",
        description: "Plenty of time to use these",
    },
};

export function getLeftoverStatus(leftover) {
    return STATUS_META[leftover?.status] || STATUS_META.FRESH;
}

export function groupLeftoversByStatus(leftovers = []) {
    return STATUS_ORDER.map((statusKey) => ({
        ...STATUS_META[statusKey],
        items: leftovers.filter((leftover) => leftover.status === statusKey),
    }));
}
