import { normalizeScannedCode } from "./services/scannedProducts";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? "/api" : "http://localhost:8080")

const IMAGE_UPLOAD_PATH = "/uploads";

function isAbsoluteUrl(value) {
    return /^([a-z]+:)?\/\//i.test(value);
}

export function resolveImageUrl(imageUrl) {
    if (!imageUrl) {
        return "";
    }

    if (
        imageUrl.startsWith("data:") ||
        imageUrl.startsWith("blob:") ||
        isAbsoluteUrl(imageUrl)
    ) {
        return imageUrl;
    }

    const normalizedPath = imageUrl.startsWith("/") ? imageUrl : `/${imageUrl}`;
    return `${BASE_URL}${normalizedPath}`;
}

function normalizeLeftover(leftover) {
    if (!leftover || typeof leftover !== "object") {
        return leftover;
    }

    const looksLikeLeftover =
        "food" in leftover ||
        "expirationDate" in leftover ||
        "status" in leftover ||
        "recoverableUntil" in leftover ||
        "deletedAt" in leftover;

    if (!looksLikeLeftover) {
        return leftover;
    }

    const expiration = leftover.expiration ?? leftover.expirationDate ?? null;

    return {
        ...leftover,
        expiration,
        expirationDate: expiration,
        location: leftover.location ?? "Fridge",
        createdAt: leftover.createdAt ?? null,
        updatedAt: leftover.updatedAt ?? null,
        deletedAt: leftover.deletedAt ?? null,
        recoverableUntil: leftover.recoverableUntil ?? leftover.restoreUntil ?? null,
        status: leftover.status ?? null,
        recoverable: Boolean(leftover.recoverable),
    };
}

function normalizeResponse(data) {
    if (data && typeof data === "object" && !Array.isArray(data)) {
        if (data.item) {
            return {
                ...data,
                item: normalizeLeftover(data.item),
            };
        }

        if (data.location) {
            return data;
        }

        if (
            "expiring" in data ||
            "useSoon" in data ||
            "expired" in data ||
            "fresh" in data
        ) {
            return {
                expiring: (data.expiring || []).map(normalizeLeftover),
                useSoon: (data.useSoon || []).map(normalizeLeftover),
                expired: (data.expired || []).map(normalizeLeftover),
                fresh: (data.fresh || []).map(normalizeLeftover),
            };
        }
    }

    if (Array.isArray(data)) {
        return data.map(normalizeLeftover);
    }

    return normalizeLeftover(data);
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
        const error = new Error(errorData.error || errorData.message || "API request failed");
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

    try {
        return normalizeResponse(JSON.parse(text));
    } catch {
        return text;
    }
}

async function uploadImage(file) {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`${BASE_URL}${IMAGE_UPLOAD_PATH}`, {
        method: "POST",
        body: formData,
    });

    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Image upload failed");
    }

    const data = await res.json().catch(() => ({}));
    const imageUrl = data.imageUrl || data.url || data.path || null;

    if (!imageUrl) {
        throw new Error("Image upload response did not include imageUrl");
    }

    return imageUrl;
}

export const LeftoversAPI = {
    getAll: ({ location, status, food, tag, sort = "home" } = {}) => {
        const params = new URLSearchParams();

        if (location?.trim()) {
            params.set("location", location.trim());
        }

        if (status?.trim()) {
            params.set("status", status.trim());
        }

        if (food?.trim()) {
            params.set("food", food.trim());
        }

        if (tag?.trim()) {
            params.set("tag", tag.trim());
        }

        params.set("sort", sort);
        return request(`/leftovers?${params.toString()}`);
    },

    getHome: ({ location } = {}) => {
        const params = new URLSearchParams();

        if (location?.trim()) {
            params.set("location", location.trim());
        }

        const query = params.toString();
        return request(`/leftovers/home${query ? `?${query}` : ""}`);
    },

    getOne: (id) => request(`/leftovers/${id}`),

    search: ({ food, location } = {}) => {
        const params = new URLSearchParams();
        params.set("food", food);

        if (location?.trim()) {
            params.set("location", location.trim());
        }

        return request(`/leftovers/search?${params.toString()}`);
    },

    filter: ({ food, tag, location } = {}) => {
        const params = new URLSearchParams();

        if (food?.trim()) {
            params.set("food", food.trim());
        }

        if (tag?.trim()) {
            params.set("tag", tag.trim());
        }

        if (location?.trim()) {
            params.set("location", location.trim());
        }

        const query = params.toString();
        return request(`/leftovers/filter${query ? `?${query}` : ""}`);
    },

    create: (data) =>
        request("/leftovers", {
            method: "POST",
            body: JSON.stringify(data),
        }),

    uploadImage,

    update: (id, data) =>
        request(`/leftovers/${id}`, {
            method: "PUT",
            body: JSON.stringify(data),
        }),

    remove: (id) =>
        request(`/leftovers/${id}`, {
            method: "DELETE",
        }),

    markUsedUp: (id) =>
        request(`/leftovers/${id}/used-up`, {
            method: "POST",
        }),

    clear: () =>
        request("/leftovers/clear", {
            method: "DELETE",
        }),

    populate: () =>
        request("/leftovers/populate", {
            method: "POST",
        }),

    getDeleted: ({ location } = {}) => {
        const params = new URLSearchParams();

        if (location?.trim()) {
            params.set("location", location.trim());
        }

        const query = params.toString();
        return request(`/leftovers/recently-deleted${query ? `?${query}` : ""}`);
    },

    restoreDeleted: (id) =>
        request(`/leftovers/${id}/restore`, {
            method: "POST",
        }),
};

export const LocationsAPI = {
    getAll: () => request("/locations"),

    create: (name) =>
        request("/locations", {
            method: "POST",
            body: JSON.stringify({ name }),
        }),

    remove: (id) =>
        request(`/locations/${id}`, {
            method: "DELETE",
        }),
};

export const ScannedProductsAPI = {
    getOne: (code) => request(`/scanned-products/${encodeURIComponent(normalizeScannedCode(code))}`),

    create: (payload) =>
        request("/scanned-products", {
            method: "POST",
            body: JSON.stringify({
                code: normalizeScannedCode(payload?.code),
                name: payload?.name ?? "",
            }),
        }),

    update: (code, payload) =>
        request(`/scanned-products/${encodeURIComponent(normalizeScannedCode(code))}`, {
            method: "PUT",
            body: JSON.stringify({
                code: normalizeScannedCode(code),
                name: payload?.name ?? "",
            }),
        }),
};
