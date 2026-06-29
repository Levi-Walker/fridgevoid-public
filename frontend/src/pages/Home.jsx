import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { LeftoversAPI, LocationsAPI } from "../api";
import LeftoverCard from "../components/LeftoverCard.jsx";
import LeftoverDetailModal from "../components/LeftoverDetailModal.jsx";
import { getLocationNameList } from "../services/locations";
import { applyStoredNotes } from "../services/leftoverNotes";
import { STATUS_META, groupLeftoversByStatus } from "../services/leftoverStatus";
import { applyStoredVisuals } from "../services/leftoverVisuals";
import { useUserPreferences } from "../contexts/UserPreferencesContext.jsx";
import { DEFAULT_STATUS_ORDER } from "../services/preferences";
import "../css/Home.css";

function buildTagFilterOptions(leftovers) {
    return [...new Set(
        leftovers.flatMap((leftover) => leftover.tags || [])
            .map((tag) => tag?.trim().toLowerCase())
            .filter(Boolean)
    )].sort((firstTag, secondTag) => firstTag.localeCompare(secondTag));
}

function matchesSelectedTags(leftover, selectedTags) {
    if (selectedTags.length === 0) {
        return true;
    }

    const normalizedTags = (leftover.tags || [])
        .map((tag) => tag?.trim().toLowerCase())
        .filter(Boolean);

    return selectedTags.some((tag) => normalizedTags.includes(tag));
}

function flattenHomeGroups(homeData) {
    return [
        ...(homeData.expiring || []),
        ...(homeData.useSoon || []),
        ...(homeData.expired || []),
        ...(homeData.fresh || []),
    ];
}

function getExpirationTime(leftover) {
    if (!leftover.expiration) {
        return Number.MAX_SAFE_INTEGER;
    }

    const parsedTime = new Date(leftover.expiration).getTime();
    return Number.isNaN(parsedTime) ? Number.MAX_SAFE_INTEGER : parsedTime;
}

function sortLeftovers(leftovers, sortBy) {
    const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });

    return [...leftovers].sort((first, second) => {
        if (sortBy === "name") {
            return collator.compare(first.food || "", second.food || "");
        }

        if (sortBy === "location") {
            return collator.compare(first.location || "", second.location || "") ||
                getExpirationTime(first) - getExpirationTime(second);
        }

        if (sortBy === "status") {
            return DEFAULT_STATUS_ORDER.indexOf(first.status) - DEFAULT_STATUS_ORDER.indexOf(second.status) ||
                getExpirationTime(first) - getExpirationTime(second);
        }

        return getExpirationTime(first) - getExpirationTime(second) ||
            collator.compare(first.food || "", second.food || "");
    });
}

function Home() {
    const location = useLocation();
    const navigate = useNavigate();
    const { preferences } = useUserPreferences();
    const [textQuery, setTextQuery] = useState("");
    const [selectedTags, setSelectedTags] = useState([]);
    const [selectedLocation, setSelectedLocation] = useState("");
    const [selectedStatusFilter, setSelectedStatusFilter] = useState(null);
    const [allLeftovers, setAllLeftovers] = useState([]);
    const [locations, setLocations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [locationsLoading, setLocationsLoading] = useState(true);
    const [leftoversError, setLeftoversError] = useState("");
    const [locationsError, setLocationsError] = useState("");
    const [showAllFilters, setShowAllFilters] = useState(false);
    const [selectedLeftover, setSelectedLeftover] = useState(null);

    const locationNames = useMemo(() => getLocationNameList(locations), [locations]);

    const loadLocations = async () => {
        setLocationsLoading(true);
        setLocationsError("");

        try {
            setLocations(await LocationsAPI.getAll());
        } catch (error) {
            console.error("Failed to load locations", error);
            setLocations([]);
            setLocationsError("Locations could not be loaded.");
        } finally {
            setLocationsLoading(false);
        }
    };

    const loadHome = async () => {
        setLoading(true);
        setLeftoversError("");

        try {
            const response = await LeftoversAPI.getHome();
            const hydratedHome = {
                expiring: applyStoredNotes(applyStoredVisuals(response.expiring || [])),
                useSoon: applyStoredNotes(applyStoredVisuals(response.useSoon || [])),
                expired: applyStoredNotes(applyStoredVisuals(response.expired || [])),
                fresh: applyStoredNotes(applyStoredVisuals(response.fresh || [])),
            };

            const flattened = flattenHomeGroups(hydratedHome);
            setAllLeftovers(flattened);
            setSelectedLeftover((currentLeftover) => {
                if (!currentLeftover) {
                    return null;
                }

                return flattened.find((leftover) => leftover.id === currentLeftover.id) || null;
            });
        } catch (error) {
            console.error("Failed to load leftovers:", error.message);
            setAllLeftovers([]);
            setLeftoversError("Leftovers could not be loaded.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadLocations();
    }, []);

    useEffect(() => {
        const handleLocationsChanged = () => {
            loadLocations();
        };

        window.addEventListener("fridgevoid:locations-changed", handleLocationsChanged);
        return () => window.removeEventListener("fridgevoid:locations-changed", handleLocationsChanged);
    }, []);

    useEffect(() => {
        loadHome();
    }, []);

    useEffect(() => {
        const handleInventoryChanged = (event) => {
            if (event.detail?.source === "home") {
                return;
            }
            loadHome();
        };

        window.addEventListener("fridgevoid:inventory-changed", handleInventoryChanged);
        return () => window.removeEventListener("fridgevoid:inventory-changed", handleInventoryChanged);
    }, []);

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        setTextQuery(params.get("q") || "");
        const tag = params.get("tag")?.trim().toLowerCase();
        setSelectedTags(tag ? [tag] : []);
    }, [location.search]);

    const handleRefresh = async (conflictDetected = false) => {
        if (conflictDetected) {
            console.info("This item changed elsewhere. The latest backend version is now shown.");
        }

        await Promise.all([
            loadLocations(),
            loadHome(),
        ]);
    };

    const filterOptions = useMemo(() => buildTagFilterOptions(allLeftovers), [allLeftovers]);

    useEffect(() => {
        setSelectedTags((currentTags) => currentTags.filter((tag) => filterOptions.includes(tag)));
    }, [filterOptions]);

    useEffect(() => {
        if (selectedLocation && !locationNames.includes(selectedLocation)) {
            setSelectedLocation("");
        }
    }, [locationNames, selectedLocation]);

    const filteredLeftovers = useMemo(() => {
        const normalizedQuery = textQuery.trim().toLowerCase();

        return allLeftovers.filter((leftover) => {
            const matchesQuery = !normalizedQuery || (leftover.food || "").toLowerCase().includes(normalizedQuery);
            const matchesTags = matchesSelectedTags(leftover, selectedTags);
            const matchesLocation = !selectedLocation || (leftover.location || "Fridge") === selectedLocation;
            return matchesQuery && matchesTags && matchesLocation;
        });
    }, [allLeftovers, selectedLocation, selectedTags, textQuery]);

    const chipCountLeftovers = useMemo(() => {
        const normalizedQuery = textQuery.trim().toLowerCase();

        return allLeftovers.filter((leftover) => {
            const matchesQuery = !normalizedQuery || (leftover.food || "").toLowerCase().includes(normalizedQuery);
            const matchesTags = matchesSelectedTags(leftover, selectedTags);
            return matchesQuery && matchesTags;
        });
    }, [allLeftovers, selectedTags, textQuery]);

    const groupedLeftovers = useMemo(() => {
        const groups = groupLeftoversByStatus(filteredLeftovers);
        return preferences.statusOrder.map((statusKey) => {
            const group = groups.find((candidate) => candidate.key === statusKey);
            return {
                ...STATUS_META[statusKey],
                label: preferences.statusLabels[statusKey],
                items: sortLeftovers(group?.items || [], "expiration"),
            };
        });
    }, [filteredLeftovers, preferences.statusLabels, preferences.statusOrder]);

    const statusChipGroups = useMemo(() => {
        const groups = groupLeftoversByStatus(chipCountLeftovers);
        return preferences.statusOrder.map((statusKey) => {
            const group = groups.find((candidate) => candidate.key === statusKey);
            return {
                ...STATUS_META[statusKey],
                label: preferences.statusLabels[statusKey],
                items: group?.items || [],
            };
        });
    }, [chipCountLeftovers, preferences.statusLabels, preferences.statusOrder]);

    const displayedGroups = useMemo(() => {
        if (!selectedStatusFilter) {
            return groupedLeftovers;
        }

        const selectedGroup = groupedLeftovers.find((group) => group.key === selectedStatusFilter);
        return selectedGroup ? [selectedGroup] : groupedLeftovers;
    }, [groupedLeftovers, selectedStatusFilter]);

    const visibleFilterOptions = showAllFilters
        ? filterOptions
        : [...new Set([...selectedTags, ...filterOptions])].slice(0, 6);
    const hasHiddenFilters = filterOptions.length > 6;

    const locationCounts = useMemo(() => {
        return chipCountLeftovers.reduce((counts, leftover) => {
            const locationName = leftover.location || "Fridge";
            counts[locationName] = (counts[locationName] || 0) + 1;
            return counts;
        }, {});
    }, [chipCountLeftovers]);

    const hasActiveFilters = Boolean(
        textQuery.trim() ||
        selectedLocation ||
        selectedStatusFilter ||
        selectedTags.length > 0
    );

    const toggleTag = (tag) => {
        const nextParams = new URLSearchParams(location.search);
        if (selectedTags.includes(tag)) {
            nextParams.delete("tag");
        } else {
            nextParams.set("tag", tag);
        }
        navigate(`/${nextParams.toString() ? `?${nextParams.toString()}` : ""}`, { replace: false });
    };

    const handleTagFilter = (tag) => {
        const nextParams = new URLSearchParams(location.search);
        nextParams.set("tag", tag);
        navigate(`/?${nextParams.toString()}`);
    };

    const resetFilters = () => {
        setSelectedLocation("");
        setSelectedTags([]);
        setSelectedStatusFilter(null);
        setShowAllFilters(false);

        if (location.search) {
            navigate("/", { replace: true });
        } else {
            setTextQuery("");
        }
    };

    return (
        <div className={`home${preferences.compactCardMode ? " home-compact-cards" : ""}`}>
            <div className="home-inventory-main">
                <section className="home-control-panel home-panel">
                    <div className="home-control-top">
                        <div className="home-overview-copy">
                            <h1>Use what needs attention</h1>
                        </div>
                    </div>

                    <div className="home-category-controls" aria-label="Category filters">
                        <div className="home-category-chip-list">
                            {visibleFilterOptions.map((tag) => (
                                <button
                                    key={tag}
                                    type="button"
                                    className={`tag-chip${selectedTags.includes(tag) ? " active" : ""}`}
                                    onClick={() => toggleTag(tag)}
                                >
                                    {tag}
                                </button>
                            ))}

                            {hasHiddenFilters ? (
                                <button
                                    type="button"
                                    className="tag-chip tag-chip-toggle"
                                    onClick={() => setShowAllFilters((currentValue) => !currentValue)}
                                >
                                    {showAllFilters ? "Show less" : `+${filterOptions.length - visibleFilterOptions.length}`}
                                </button>
                            ) : null}
                        </div>

                        <div className="home-reset-filter-slot">
                            <button
                                type="button"
                                className="home-reset-filters"
                                onClick={resetFilters}
                                disabled={!hasActiveFilters}
                            >
                                Reset filters
                            </button>
                        </div>
                    </div>

                    <div className="filter-controls">
                        <div className="filter-group">
                            <span className="filter-group-label">Location</span>
                            <div className="tag-bar" role="tablist" aria-label="Locations">
                                <button
                                    type="button"
                                    className={`tag-chip${selectedLocation === "" ? " active" : ""}`}
                                    onClick={() => setSelectedLocation("")}
                                >
                                    All <strong>{chipCountLeftovers.length}</strong>
                                </button>
                                {locationNames.map((location) => (
                                    <button
                                        key={location}
                                        type="button"
                                        className={`tag-chip${selectedLocation === location ? " active" : ""}`}
                                        onClick={() => setSelectedLocation(location)}
                                    >
                                        {location} <strong>{locationCounts[location] || 0}</strong>
                                    </button>
                                ))}
                            </div>
                            {locationsError && !locationsLoading ? <p className="filter-message filter-message-error">{locationsError}</p> : null}
                        </div>

                        <div className="filter-group filter-group-status">
                            <span className="filter-group-label">Status</span>
                            <div className="home-status-controls" aria-label="Status filters">
                                {statusChipGroups.map((group) => (
                                    <button
                                        key={group.key}
                                        type="button"
                                        className={`home-summary-chip home-summary-chip-${group.cssKey}${selectedStatusFilter === group.key ? " active" : ""}`}
                                        onClick={() => setSelectedStatusFilter(selectedStatusFilter === group.key ? null : group.key)}
                                    >
                                        <span>{group.label}</span>
                                        <strong>{group.items.length}</strong>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                {leftoversError ? <div className="home-empty-state"><p>{leftoversError}</p></div> : null}

                {loading ? (
                    <div className="home-empty-state">
                        <p>Loading your items...</p>
                    </div>
                ) : filteredLeftovers.length === 0 ? (
                    <div className="home-empty-state">
                        <p>No items match your filters. Try adjusting your search or location.</p>
                    </div>
                ) : (
                    displayedGroups
                        .filter((group) => group.items.length > 0)
                        .map((group) => (
                            <section key={group.key} className={`home-section-card home-panel home-status-section home-status-section-${group.cssKey}`}>
                                <div className={`home-section-header home-section-header-${group.cssKey}`}>
                                    <div>
                                        <h2>{group.label}</h2>
                                    </div>
                                    <span className={`home-section-count home-section-count-${group.cssKey}`}>{group.items.length}</span>
                                </div>
                                <div className="leftover-grid">
                                    {group.items.map((leftover) => (
                                        <LeftoverCard
                                            key={leftover.id}
                                            leftover={leftover}
                                            onUpdated={handleRefresh}
                                            onSelect={setSelectedLeftover}
                                            onTagFilter={handleTagFilter}
                                            locations={locations}
                                        />
                                    ))}
                                </div>
                            </section>
                        ))
                )}
            </div>

            <LeftoverDetailModal
                open={Boolean(selectedLeftover)}
                leftover={selectedLeftover}
                onClose={() => setSelectedLeftover(null)}
                onUpdated={handleRefresh}
                locations={locations}
            />
        </div>
    );
}

export default Home;
