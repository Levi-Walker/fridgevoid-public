import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { LeftoversAPI, LocationsAPI } from "../api";
import AddLeftoverModal from "./AddLeftoverModal.jsx";
import { clearDraft, loadDraft, saveDraft } from "../services/draftStorage";
import VisualPreview from "./VisualPreview.jsx";
import { getDefaultLocation } from "../services/locations";
import { applyStoredNotes, saveLeftoverNotes } from "../services/leftoverNotes";
import { getLeftoverStatus } from "../services/leftoverStatus";
import { PresetsAPI } from "../services/presets";
import { applyStoredVisuals, saveLeftoverVisual } from "../services/leftoverVisuals";
import { useUserPreferences } from "../contexts/UserPreferencesContext.jsx";
import "../css/LeftRail.css";

const NAV_ITEMS = [
    { to: "/", label: "Home" },
    { to: "/presets", label: "Presets" },
    { to: "/settings", label: "Settings" },
];

const ADD_MODAL_STATE_KEY = "fridgevoid:add-leftover:modal";
const NEXT_FOOD_GROUP_KEYS = ["expiring", "useSoon", "fresh"];
const NEXT_FOOD_LIMIT = 3;

function startOfToday() {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
}

function getExpirationTime(leftover) {
    if (!leftover?.expiration) {
        return Number.MAX_SAFE_INTEGER;
    }

    const parsedTime = new Date(leftover.expiration).getTime();
    return Number.isNaN(parsedTime) ? Number.MAX_SAFE_INTEGER : parsedTime;
}

function getNextFoods(homeData) {
    const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });
    const todayTime = startOfToday().getTime();
    const candidates = NEXT_FOOD_GROUP_KEYS.flatMap((groupKey) => homeData?.[groupKey] || [])
        .filter((leftover) => {
            const expirationTime = getExpirationTime(leftover);
            return expirationTime !== Number.MAX_SAFE_INTEGER && expirationTime >= todayTime;
        });

    return candidates.sort((first, second) =>
        getExpirationTime(first) - getExpirationTime(second) ||
        collator.compare(first.food || "", second.food || "")
    ).slice(0, NEXT_FOOD_LIMIT);
}

function formatNextFoodTiming(leftover) {
    if (!leftover?.expiration) {
        return "No date set";
    }

    const today = startOfToday();

    const expiration = new Date(leftover.expiration);
    expiration.setHours(0, 0, 0, 0);

    if (Number.isNaN(expiration.getTime())) {
        return "No date set";
    }

    const dayDelta = Math.round((expiration - today) / (1000 * 60 * 60 * 24));

    if (dayDelta < 0) {
        return `${Math.abs(dayDelta)}d past date`;
    }

    if (dayDelta === 0) {
        return "Expires today";
    }

    if (dayDelta === 1) {
        return "Expires tomorrow";
    }

    return `Expires in ${dayDelta}d`;
}

function sortPresets(presets) {
    return [...presets].sort((first, second) => {
        const firstUsed = Number(first.usedCount) || 0;
        const secondUsed = Number(second.usedCount) || 0;

        if (firstUsed !== secondUsed) {
            return secondUsed - firstUsed;
        }

        return (first.name || "").localeCompare(second.name || "");
    });
}

function normalizeSearchValue(value) {
    return (value || "").trim().toLowerCase();
}

function getNextFoodRoute(food, activeSearch) {
    const foodName = food || "";

    if (normalizeSearchValue(foodName) === normalizeSearchValue(activeSearch)) {
        return "/";
    }

    return `/?q=${encodeURIComponent(foodName)}`;
}

function LeftRail({ onInventoryChanged }) {
    const location = useLocation();
    const { preferences } = useUserPreferences();
    const [presets, setPresets] = useState([]);
    const [locations, setLocations] = useState([]);
    const [query, setQuery] = useState("");
    const [selectedLocation, setSelectedLocation] = useState(preferences.defaultQuickAddLocation || getDefaultLocation());
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState("");
    const [messageTone, setMessageTone] = useState("info");
    const [quickAddPresetId, setQuickAddPresetId] = useState("");
    const [showAddModal, setShowAddModal] = useState(false);
    const [addModalPreset, setAddModalPreset] = useState(null);
    const [nextFoods, setNextFoods] = useState([]);
    const [nextFoodLoading, setNextFoodLoading] = useState(true);
    const [nextFoodError, setNextFoodError] = useState("");

    const loadRailData = async () => {
        setLoading(true);

        try {
            const [nextPresets, nextLocations] = await Promise.all([
                PresetsAPI.getAll(),
                LocationsAPI.getAll(),
            ]);
            setPresets(nextPresets || []);
            setLocations(nextLocations || []);
        } catch (error) {
            console.error("Failed to load left rail data", error);
            setPresets([]);
            setLocations([]);
            setMessageTone("error");
            setMessage("Quick add could not be loaded.");
        } finally {
            setLoading(false);
        }
    };

    const loadNextFood = async () => {
        setNextFoodLoading(true);
        setNextFoodError("");

        try {
            const homeData = await LeftoversAPI.getHome();
            const nextItems = getNextFoods(homeData);
            setNextFoods(applyStoredNotes(applyStoredVisuals(nextItems)));
        } catch (error) {
            console.error("Failed to load next food", error);
            setNextFoods([]);
            setNextFoodError("Next food could not be loaded.");
        } finally {
            setNextFoodLoading(false);
        }
    };

    useEffect(() => {
        if (!message || messageTone !== "success") {
            return undefined;
        }

        const timeoutId = window.setTimeout(() => setMessage(""), 3500);
        return () => window.clearTimeout(timeoutId);
    }, [message, messageTone]);

    useEffect(() => {
        loadRailData();
        loadNextFood();
    }, []);

    useEffect(() => {
        const savedModalState = loadDraft(ADD_MODAL_STATE_KEY, null);
        if (!savedModalState?.open) {
            return;
        }

        if (savedModalState.presetId) {
            const matchingPreset = presets.find((preset) => preset.id === savedModalState.presetId);
            if (!matchingPreset) {
                return;
            }

            setAddModalPreset(matchingPreset);
            setShowAddModal(true);
            return;
        }

        setAddModalPreset(null);
        setShowAddModal(true);
    }, [presets]);

    useEffect(() => {
        const handlePresetsChanged = () => {
            loadRailData();
        };

        const handleLocationsChanged = () => {
            loadRailData();
            loadNextFood();
        };

        const handleInventoryChanged = () => {
            loadNextFood();
        };

        window.addEventListener("fridgevoid:presets-changed", handlePresetsChanged);
        window.addEventListener("fridgevoid:locations-changed", handleLocationsChanged);
        window.addEventListener("fridgevoid:inventory-changed", handleInventoryChanged);

        return () => {
            window.removeEventListener("fridgevoid:presets-changed", handlePresetsChanged);
            window.removeEventListener("fridgevoid:locations-changed", handleLocationsChanged);
            window.removeEventListener("fridgevoid:inventory-changed", handleInventoryChanged);
        };
    }, []);

    useEffect(() => {
        if (locations.length === 0) {
            return;
        }

        const locationNames = locations.map((location) => location.name);
        const preferredLocation = preferences.defaultQuickAddLocation;

        if (preferredLocation && locationNames.includes(preferredLocation) && selectedLocation === getDefaultLocation()) {
            setSelectedLocation(preferredLocation);
            return;
        }

        if (!locationNames.includes(selectedLocation)) {
            setSelectedLocation(locationNames.includes(getDefaultLocation()) ? getDefaultLocation() : locationNames[0]);
        }
    }, [locations, preferences.defaultQuickAddLocation, selectedLocation]);

    const filteredPresets = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();
        const sortedPresets = sortPresets(presets);

        if (!normalizedQuery) {
            return sortedPresets;
        }

        return sortedPresets.filter((preset) => {
            const searchableText = [
                preset.name,
                preset.container,
                ...(preset.tags || []),
            ].filter(Boolean).join(" ").toLowerCase();

            return searchableText.includes(normalizedQuery);
        });
    }, [presets, query]);

    const activeHomeSearch = useMemo(() => {
        const params = new URLSearchParams(location.search);
        return params.get("q") || "";
    }, [location.search]);

    const notifyInventoryChanged = async () => {
        await Promise.all([loadRailData(), loadNextFood()]);
        onInventoryChanged?.();
    };

    const openCustomItem = () => {
        setAddModalPreset(null);
        setShowAddModal(true);
        saveDraft(ADD_MODAL_STATE_KEY, { open: true, presetId: null });
    };

    const openPresetDetails = (preset) => {
        setAddModalPreset(preset);
        setShowAddModal(true);
        saveDraft(ADD_MODAL_STATE_KEY, { open: true, presetId: preset?.id || null });
    };

    const closeAddModal = () => {
        setShowAddModal(false);
        setAddModalPreset(null);
        clearDraft(ADD_MODAL_STATE_KEY);
    };

    const handleQuickAddPreset = async (preset) => {
        setQuickAddPresetId(preset.id);
        setMessage("");

        try {
            const imageUrl = preset.imageUrl || null;
            const createResponse = await LeftoversAPI.create({
                food: preset.name,
                shelfLifeDays: preset.shelfLifeDays || 5,
                container: preset.container || null,
                location: selectedLocation || getDefaultLocation(),
                presetId: preset.id,
                emoji: preset.visualType === "emoji" ? preset.emoji || null : null,
                imageUrl,
                tags: preset.tags || [],
            });

            const createdItem = createResponse?.item;

            if (createdItem?.id) {
                saveLeftoverNotes(createdItem.id, createdItem.notes || "");
                if (imageUrl) {
                    saveLeftoverVisual(createdItem.id, { visualType: "image", imageUrl });
                }
            }

            setMessageTone("success");
            setMessage(`${preset.name} added.`);
            await notifyInventoryChanged();
        } catch (error) {
            console.error("Failed to quick add preset", error);
            setMessageTone("error");
            setMessage(`Could not add ${preset.name}.`);
        } finally {
            setQuickAddPresetId("");
        }
    };

    return (
        <div className="left-rail">
            <section className="rail-section rail-quick-add">
                <div className="rail-section-header">
                    <div>
                        <p className="rail-kicker">Quick add</p>
                        <h2>Frequent items</h2>
                    </div>
                    <button type="button" className="rail-add-custom" onClick={openCustomItem}>
                        Add custom
                    </button>
                </div>

                <input
                    type="search"
                    className="rail-search"
                    placeholder="Find preset"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                />

                <label className="rail-location-field">
                    <span>Add to</span>
                    <select
                        className="rail-location"
                        value={selectedLocation}
                        onChange={(event) => setSelectedLocation(event.target.value)}
                        aria-label="Quick add destination location"
                    >
                        {locations.length === 0 ? (
                            <option value={getDefaultLocation()}>{getDefaultLocation()}</option>
                        ) : (
                            locations.map((location) => (
                                <option key={location.id} value={location.name}>
                                    {location.name}
                                </option>
                            ))
                        )}
                    </select>
                </label>

                {message ? <p className={`rail-message rail-message-${messageTone}`}>{message}</p> : null}

                <div className="rail-preset-list" aria-label="Quick add presets">
                    {loading ? (
                        <p className="rail-empty">Loading presets...</p>
                    ) : filteredPresets.length === 0 ? (
                        <p className="rail-empty">{query ? "No matching presets." : "No presets yet."}</p>
                    ) : (
                        filteredPresets.map((preset) => (
                            <div key={preset.id} className="rail-preset-row">
                                <div className="rail-preset-visual" aria-hidden="true">
                                    <VisualPreview
                                        visualType={preset.visualType}
                                        emoji={preset.emoji}
                                        imageUrl={preset.imageUrl}
                                        className={preset.visualType === "image" ? "rail-preset-image" : "rail-preset-emoji"}
                                        fallbackClassName="rail-preset-emoji"
                                    />
                                </div>
                                <button
                                    type="button"
                                    className="rail-preset-main"
                                    onClick={() => handleQuickAddPreset(preset)}
                                    disabled={quickAddPresetId === preset.id}
                                >
                                    <span>{preset.name}</span>
                                    <small>{quickAddPresetId === preset.id ? "Adding..." : preset.shelfLifeDays ? `${preset.shelfLifeDays}d shelf life` : "Quick add"}</small>
                                </button>
                                <button
                                    type="button"
                                    className="rail-preset-details"
                                    onClick={() => openPresetDetails(preset)}
                                    disabled={quickAddPresetId === preset.id}
                                >
                                    Details
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </section>

            <section className="rail-section rail-use-next" aria-label="Use next food">
                <p className="rail-kicker">Use next</p>
                {nextFoodLoading ? (
                    <p className="rail-empty">Loading next item...</p>
                ) : nextFoodError ? (
                    <p className="rail-empty">{nextFoodError}</p>
                ) : nextFoods.length > 0 ? (
                    <div className="rail-use-next-list">
                        {nextFoods.map((nextFood) => {
                            const nextFoodStatus = getLeftoverStatus(nextFood);

                            return (
                                <NavLink
                                    key={nextFood.id || `${nextFood.food}-${nextFood.expiration}`}
                                    className="rail-use-next-card"
                                    to={getNextFoodRoute(nextFood.food, activeHomeSearch)}
                                >
                                    <div className="rail-use-next-visual" aria-hidden="true">
                                        <VisualPreview
                                            visualType={nextFood.imageUrl ? "image" : "emoji"}
                                            emoji={nextFood.emoji}
                                            imageUrl={nextFood.imageUrl}
                                            className={nextFood.imageUrl ? "rail-use-next-image" : "rail-use-next-emoji"}
                                            fallbackClassName="rail-use-next-emoji"
                                        />
                                    </div>
                                    <div className="rail-use-next-copy">
                                        <h2>{nextFood.food || "Untitled item"}</h2>
                                        <p>{formatNextFoodTiming(nextFood)}</p>
                                        <span>{nextFood.location || "Fridge"} · {preferences.statusLabels[nextFoodStatus.key] || nextFoodStatus.label}</span>
                                    </div>
                                </NavLink>
                            );
                        })}
                    </div>
                ) : (
                    <p className="rail-empty">No upcoming dates.</p>
                )}
            </section>

            <section className="rail-section rail-navigation">
                <p className="rail-kicker">Navigation</p>
                <nav className="rail-nav" aria-label="Primary routes">
                    {NAV_ITEMS.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            end={item.to === "/"}
                            className={({ isActive }) => `rail-nav-link${isActive ? " active" : ""}`}
                        >
                            {item.label}
                        </NavLink>
                    ))}
                </nav>
            </section>

            <AddLeftoverModal
                open={showAddModal}
                onClose={closeAddModal}
                onSaved={notifyInventoryChanged}
                initialPreset={addModalPreset}
                locations={locations}
            />
        </div>
    );
}

export default LeftRail;
