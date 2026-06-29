const VISUALS_STORAGE_KEY = "fridgevoid-leftover-visuals";

function sanitizeImageUrl(imageUrl) {
    if (!imageUrl || imageUrl.startsWith("data:")) {
        return null;
    }

    return imageUrl;
}

function readVisuals() {
    const rawValue = window.localStorage.getItem(VISUALS_STORAGE_KEY);

    if (!rawValue) {
        return {};
    }

    try {
        return JSON.parse(rawValue);
    } catch (error) {
        console.error("Failed to parse leftover visuals", error);
        return {};
    }
}

function writeVisuals(visualMap) {
    window.localStorage.setItem(VISUALS_STORAGE_KEY, JSON.stringify(visualMap));
}

export function applyStoredVisuals(leftovers) {
    const storedVisuals = readVisuals();

    return leftovers.map((leftover) => {
        const storedVisual = storedVisuals[leftover.id];

        if (!storedVisual) {
            return leftover;
        }

        return {
            ...leftover,
            imageUrl: sanitizeImageUrl(storedVisual.imageUrl) || leftover.imageUrl || null,
            visualType: storedVisual.visualType || (leftover.imageUrl ? "image" : "emoji"),
        };
    });
}

export function saveLeftoverVisual(leftoverId, visual) {
    const storedVisuals = readVisuals();

    storedVisuals[leftoverId] = {
        visualType: visual.visualType,
        imageUrl: visual.visualType === "image" ? sanitizeImageUrl(visual.imageUrl) : null,
    };

    writeVisuals(storedVisuals);
}

export function removeLeftoverVisual(leftoverId) {
    const storedVisuals = readVisuals();
    delete storedVisuals[leftoverId];
    writeVisuals(storedVisuals);
}

export function clearAllLeftoverVisuals() {
    writeVisuals({});
}
