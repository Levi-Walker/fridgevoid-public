export const RELATIVE_UNITS = [
    { value: "days", label: "Days", days: 1 },
];

export function startOfToday() {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
}

export function normalizeDate(date) {
    if (!date) {
        return null;
    }

    const nextDate = new Date(date);
    nextDate.setHours(12, 0, 0, 0);
    return nextDate;
}

export function isFutureDate(date) {
    if (!date) {
        return false;
    }

    return normalizeDate(date) > startOfToday();
}

export function addRelativeDuration(anchorDate, amount, unit) {
    const normalizedAnchor = normalizeDate(anchorDate || new Date());
    const nextDate = new Date(normalizedAnchor);
    const selectedUnit = RELATIVE_UNITS.find((option) => option.value === unit) || RELATIVE_UNITS[0];

    nextDate.setDate(nextDate.getDate() + (Number(amount) * selectedUnit.days));
    return nextDate;
}

export function getDefaultExpirationState() {
    const relativeAmount = "5";
    const relativeUnit = "days";
    const resolvedExpirationDate = addRelativeDuration(new Date(), relativeAmount, relativeUnit);

    return {
        expirationMode: "relative",
        relativeAmount,
        relativeUnit,
        absoluteDate: resolvedExpirationDate,
        resolvedExpirationDate,
    };
}

export function getExpirationStateFromDate(date) {
    const normalizedDate = normalizeDate(date);

    if (!normalizedDate) {
        return getDefaultExpirationState();
    }

    return {
        expirationMode: "absolute",
        relativeAmount: "5",
        relativeUnit: "days",
        absoluteDate: normalizedDate,
        resolvedExpirationDate: normalizedDate,
    };
}

export function resolveExpirationState(expirationState) {
    if (expirationState.expirationMode === "relative") {
        const parsedAmount = Number(expirationState.relativeAmount);

        if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
            return {
                resolvedExpirationDate: null,
                errorMessage: "Enter a positive shelf life.",
            };
        }

        const resolvedExpirationDate = addRelativeDuration(new Date(), parsedAmount, expirationState.relativeUnit);
        return {
            resolvedExpirationDate,
            errorMessage: null,
        };
    }

    const absoluteDate = normalizeDate(expirationState.absoluteDate);

    if (!absoluteDate) {
        return {
            resolvedExpirationDate: null,
            errorMessage: "Expiration date is required.",
        };
    }

    if (!isFutureDate(absoluteDate)) {
        return {
            resolvedExpirationDate: null,
            errorMessage: "Choose a future expiration date.",
        };
    }

    return {
        resolvedExpirationDate: absoluteDate,
        errorMessage: null,
    };
}

export function formatResolvedExpiration(date) {
    if (!date) {
        return "Not set";
    }

    return new Date(date).toLocaleDateString();
}

export function getRelativeDurationFromDate(date) {
    const normalizedDate = normalizeDate(date);

    if (!normalizedDate) {
        return {
            amount: 5,
            unit: "days",
        };
    }

    const now = startOfToday();
    const diffInMs = normalizeDate(normalizedDate) - now;
    const diffInDays = Math.max(1, Math.ceil(diffInMs / (1000 * 60 * 60 * 24)));

    return {
        amount: diffInDays,
        unit: "days",
    };
}
