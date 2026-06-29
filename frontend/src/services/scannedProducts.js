export function normalizeScannedCode(value) {
    if (value === null || value === undefined) {
        return "";
    }

    return String(value).trim();
}
