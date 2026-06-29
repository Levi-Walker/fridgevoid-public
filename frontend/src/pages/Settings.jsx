import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { LeftoversAPI, LocationsAPI, ScannedProductsAPI } from "../api";
import BarcodeCaptureField from "../components/BarcodeCaptureField";
import { getDefaultLocation } from "../services/locations";
import { normalizeScannedCode } from "../services/scannedProducts";
import { useUserPreferences } from "../contexts/UserPreferencesContext.jsx";
import {
    DEFAULT_STATUS_LABELS,
    DEFAULT_STATUS_ORDER,
    STATUS_KEYS,
} from "../services/preferences";
import "../css/Settings.css";

const STATUS_LABEL_MAX_LENGTH = DEFAULT_STATUS_LABELS.EXPIRING.length + 3;

function formatDateTime(value) {
    if (!value) {
        return "Unknown";
    }

    return new Date(value).toLocaleString();
}

function getCanonicalStatusLabel(statusLabels, statusKey) {
    const defaultLabel = DEFAULT_STATUS_LABELS[statusKey];
    const currentLabel = statusLabels[statusKey]?.trim() || defaultLabel;

    if (currentLabel.toLowerCase() === defaultLabel.toLowerCase()) {
        return defaultLabel;
    }

    return currentLabel;
}

function getCanonicalStatusLabels(statusLabels = {}) {
    return STATUS_KEYS.reduce((labels, statusKey) => {
        labels[statusKey] = getCanonicalStatusLabel(statusLabels, statusKey);
        return labels;
    }, {});
}

function getStatusInputValue(statusLabels, statusKey) {
    const value = statusLabels[statusKey];
    return typeof value === "string" ? value : DEFAULT_STATUS_LABELS[statusKey];
}

function Settings() {
    const { preferences, loading: preferencesLoading, errorMessage: preferencesError, savePreferences } = useUserPreferences();
    const [statusMessage, setStatusMessage] = useState("");
    const [statusTone, setStatusTone] = useState("idle");
    const [customLocationInput, setCustomLocationInput] = useState("");
    const [locations, setLocations] = useState([]);
    const [locationsLoading, setLocationsLoading] = useState(true);
    const [locationsError, setLocationsError] = useState("");
    const [deletedItems, setDeletedItems] = useState([]);
    const [deletedLoading, setDeletedLoading] = useState(true);
    const [deletedError, setDeletedError] = useState("");
    const [restoringId, setRestoringId] = useState("");
    const [selectedDeletedLocation, setSelectedDeletedLocation] = useState("");
    const [preferencesDraft, setPreferencesDraft] = useState(preferences);
    const [statusLabelWarnings, setStatusLabelWarnings] = useState({});
    const [preferencesSaving, setPreferencesSaving] = useState(false);
    const [barcodeScannerOpen, setBarcodeScannerOpen] = useState(false);
    const [scannedProductCode, setScannedProductCode] = useState("");
    const [scannedProductName, setScannedProductName] = useState("");
    const [scannedProductExists, setScannedProductExists] = useState(null);
    const [scannedProductLoading, setScannedProductLoading] = useState(false);
    const [scannedProductSaving, setScannedProductSaving] = useState(false);
    const [scannedProductError, setScannedProductError] = useState("");
    const [scannedProductMessage, setScannedProductMessage] = useState("");

    const setStatus = (tone, message) => {
        setStatusTone(tone);
        setStatusMessage(message);
    };

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

    const loadDeletedItems = async (location = selectedDeletedLocation) => {
        setDeletedLoading(true);
        setDeletedError("");

        try {
            const items = await LeftoversAPI.getDeleted({ location });
            setDeletedItems(items || []);
        } catch (error) {
            console.error("Failed to load deleted leftovers", error);
            setDeletedError("Recently deleted items could not be loaded.");
            setDeletedItems([]);
        } finally {
            setDeletedLoading(false);
        }
    };

    useEffect(() => {
        Promise.all([loadLocations(), loadDeletedItems("")]).catch(() => {});
    }, []);

    useEffect(() => {
        setPreferencesDraft({
            ...preferences,
            statusLabels: getCanonicalStatusLabels(preferences.statusLabels),
        });
        setStatusLabelWarnings({});
    }, [preferences]);

    useEffect(() => {
        loadDeletedItems(selectedDeletedLocation);
    }, [selectedDeletedLocation]);

    const defaultLocations = useMemo(
        () => locations.filter((location) => location.defaultLocation),
        [locations]
    );
    const customLocations = useMemo(
        () => locations.filter((location) => !location.defaultLocation),
        [locations]
    );

    const handleAddLocation = async () => {
        const trimmedValue = customLocationInput.trim();

        if (!trimmedValue) {
            setStatus("error", "Enter a location name.");
            return;
        }

        try {
            const response = await LocationsAPI.create(trimmedValue);
            setCustomLocationInput("");
            await loadLocations();
            window.dispatchEvent(new Event("fridgevoid:locations-changed"));
            setStatus("success", `${response?.location?.name || trimmedValue} added.`);
        } catch (error) {
            console.error("Failed to add location", error);
            setStatus("error", error.message || "Location could not be added.");
        }
    };

    const handleRemoveLocation = async (location) => {
        try {
            await LocationsAPI.remove(location.id);
            await loadLocations();
            window.dispatchEvent(new Event("fridgevoid:locations-changed"));
            setStatus("success", `${location.name} removed.`);
        } catch (error) {
            console.error("Failed to remove location", error);
            setStatus("error", error.message || "Location could not be removed.");
        }
    };

    const handleRestore = async (item) => {
        setRestoringId(item.id);
        setDeletedError("");

        try {
            await LeftoversAPI.restoreDeleted(item.id);
            setStatus("success", `${item.food} restored.`);
            await loadDeletedItems(selectedDeletedLocation);
        } catch (error) {
            console.error("Failed to restore leftover", error);
            setDeletedError("That item could not be restored.");
        } finally {
            setRestoringId("");
        }
    };

    const updateStatusLabelDraft = (statusKey, label) => {
        const nextLabel = label.slice(0, STATUS_LABEL_MAX_LENGTH);

        setStatusLabelWarnings((currentWarnings) => {
            if (!currentWarnings[statusKey]) {
                return currentWarnings;
            }

            const nextWarnings = { ...currentWarnings };
            delete nextWarnings[statusKey];
            return nextWarnings;
        });

        setPreferencesDraft((currentDraft) => ({
            ...currentDraft,
            statusLabels: {
                ...currentDraft.statusLabels,
                [statusKey]: nextLabel,
            },
        }));
    };

    const preparePreferencesDraftForSave = (draft) => {
        const emptyStatuses = [];
        const statusLabels = STATUS_KEYS.reduce((labels, statusKey) => {
            const defaultLabel = DEFAULT_STATUS_LABELS[statusKey];
            const label = draft.statusLabels[statusKey]?.trim() || "";

            if (!label) {
                emptyStatuses.push(statusKey);
                labels[statusKey] = defaultLabel;
                return labels;
            }

            labels[statusKey] = label.toLowerCase() === defaultLabel.toLowerCase() ? defaultLabel : label;
            return labels;
        }, {});

        return {
            nextDraft: {
                ...draft,
                statusLabels,
            },
            emptyStatuses,
        };
    };

    const showBlankStatusWarnings = (emptyStatuses) => {
        setStatusLabelWarnings((currentWarnings) => ({
            ...currentWarnings,
            ...emptyStatuses.reduce((warnings, statusKey) => {
                warnings[statusKey] = "Cannot be left blank";
                return warnings;
            }, {}),
        }));
    };

    const savePreferencesDraft = async (draft, { showSuccess = true } = {}) => {
        const { nextDraft, emptyStatuses } = preparePreferencesDraftForSave(draft);

        if (emptyStatuses.length > 0) {
            showBlankStatusWarnings(emptyStatuses);
        }

        setPreferencesDraft(nextDraft);
        setPreferencesSaving(true);
        setStatus("idle", "");

        try {
            await savePreferences(nextDraft);
            if (showSuccess) {
                setStatus("success", "Preferences saved.");
            }
        } catch (error) {
            setStatus("error", "Preferences could not be saved.");
        } finally {
            setPreferencesSaving(false);
        }
    };

    const saveStatusLabelOnBlur = async (statusKey) => {
        const defaultLabel = DEFAULT_STATUS_LABELS[statusKey];
        const rawLabel = getStatusInputValue(preferencesDraft.statusLabels, statusKey);
        const trimmedLabel = rawLabel.trim();
        const nextLabel = trimmedLabel.toLowerCase() === defaultLabel.toLowerCase() ? defaultLabel : rawLabel;
        const nextDraft = {
            ...preferencesDraft,
            statusLabels: {
                ...preferencesDraft.statusLabels,
                [statusKey]: trimmedLabel ? nextLabel : defaultLabel,
            },
        };

        if (!trimmedLabel) {
            showBlankStatusWarnings([statusKey]);
        }

        await savePreferencesDraft(nextDraft, { showSuccess: false });
    };

    const moveStatus = (statusKey, direction) => {
        setPreferencesDraft((currentDraft) => {
            const currentIndex = currentDraft.statusOrder.indexOf(statusKey);
            const nextIndex = currentIndex + direction;

            if (currentIndex < 0 || nextIndex < 0 || nextIndex >= currentDraft.statusOrder.length) {
                return currentDraft;
            }

            const nextOrder = [...currentDraft.statusOrder];
            [nextOrder[currentIndex], nextOrder[nextIndex]] = [nextOrder[nextIndex], nextOrder[currentIndex]];
            return { ...currentDraft, statusOrder: nextOrder };
        });
    };

    const handleSavePreferences = async () => {
        await savePreferencesDraft(preferencesDraft);
    };

    const resetStatusLabels = () => {
        setStatusLabelWarnings({});
        setPreferencesDraft((currentDraft) => ({
            ...currentDraft,
            statusLabels: DEFAULT_STATUS_LABELS,
        }));
    };

    const resetStatusOrder = () => {
        setPreferencesDraft((currentDraft) => ({
            ...currentDraft,
            statusOrder: DEFAULT_STATUS_ORDER,
        }));
    };

    const handleScannedProductDetected = async (rawCode) => {
        const nextCode = normalizeScannedCode(rawCode);

        if (!nextCode) {
            setScannedProductError("Scan a valid barcode.");
            return;
        }

        setScannedProductCode(nextCode);
        setScannedProductName("");
        setScannedProductExists(null);
        setScannedProductLoading(true);
        setScannedProductError("");
        setScannedProductMessage("");

        try {
            const product = await ScannedProductsAPI.getOne(nextCode);
            setScannedProductName(product?.name || "");
            setScannedProductExists(true);
            setScannedProductMessage("Product loaded.");
        } catch (error) {
            if (error.status === 404) {
                setScannedProductExists(false);
                return;
            }

            console.error("Failed to load scanned product", error);
            setScannedProductError("Product lookup failed.");
        } finally {
            setScannedProductLoading(false);
        }
    };

    const handleSaveScannedProduct = async () => {
        const nextCode = normalizeScannedCode(scannedProductCode);
        const nextName = scannedProductName.trim();

        if (!nextCode) {
            setScannedProductError("Scan a product first.");
            return;
        }

        if (!nextName) {
            setScannedProductError("Enter a product name.");
            return;
        }

        setScannedProductSaving(true);
        setScannedProductError("");
        setScannedProductMessage("");

        try {
            if (scannedProductExists) {
                await ScannedProductsAPI.update(nextCode, { name: nextName });
                setScannedProductMessage("Product name updated.");
            } else {
                await ScannedProductsAPI.create({ code: nextCode, name: nextName });
                setScannedProductExists(true);
                setScannedProductMessage("Product saved.");
            }
        } catch (error) {
            console.error("Failed to save scanned product", error);
            setScannedProductError("Product save failed.");
        } finally {
            setScannedProductSaving(false);
        }
    };

    return (
        <div className="settings-page">
            <section className="settings-hero settings-panel">
                <div>
                    <h1>App settings</h1>
                </div>
                <Link to="/settings/colors" className="settings-theme-link">
                    <span>
                        <strong>Theme</strong>
                    </span>
                    <span aria-hidden="true">Open</span>
                </Link>
            </section>

            <section className="settings-panel settings-card">
                <div className="settings-card-header">
                    <div>
                        <h2>Inventory</h2>
                    </div>
                </div>

                {preferencesLoading ? <p className="settings-card-copy">Loading preferences...</p> : null}
                {preferencesError ? <p className="settings-card-copy settings-card-copy-error">{preferencesError}</p> : null}

                <div className="settings-subsection">
                    <div className="settings-subsection-header">
                        <div>
                            <h3>Statuses</h3>
                            <p>Name each group and choose the order shown on the inventory page.</p>
                        </div>
                        <div className="settings-subsection-actions">
                            <button type="button" className="settings-inline-button" onClick={resetStatusLabels}>
                                Reset names
                            </button>
                            <button type="button" className="settings-inline-button" onClick={resetStatusOrder}>
                                Reset order
                            </button>
                        </div>
                    </div>
                    <div className="settings-status-editor-list">
                        {preferencesDraft.statusOrder.map((statusKey, index) => (
                            <article key={statusKey} className="settings-status-editor-item">
                                <label className="settings-field settings-status-label-field">
                                    <span className="settings-status-display-label">
                                        <strong>{DEFAULT_STATUS_LABELS[statusKey]}</strong>
                                    </span>
                                    <input
                                        type="text"
                                        maxLength={STATUS_LABEL_MAX_LENGTH}
                                        value={getStatusInputValue(preferencesDraft.statusLabels, statusKey)}
                                        onChange={(event) => updateStatusLabelDraft(statusKey, event.target.value)}
                                        onBlur={() => saveStatusLabelOnBlur(statusKey)}
                                    />
                                    {statusLabelWarnings[statusKey] ? (
                                        <small className="settings-field-note settings-field-note-error">
                                            {statusLabelWarnings[statusKey]}
                                        </small>
                                    ) : null}
                                </label>
                                <div className="settings-status-order-actions">
                                    <button
                                        type="button"
                                        className="settings-order-button"
                                        onClick={() => moveStatus(statusKey, -1)}
                                        disabled={index === 0}
                                    >
                                        Up
                                    </button>
                                    <button
                                        type="button"
                                        className="settings-order-button"
                                        onClick={() => moveStatus(statusKey, 1)}
                                        disabled={index === preferencesDraft.statusOrder.length - 1}
                                    >
                                        Down
                                    </button>
                                </div>
                            </article>
                        ))}
                    </div>
                </div>

                <div className="settings-subsection">
                    <div className="settings-subsection-header">
                        <div>
                            <h3>Defaults</h3>
                        </div>
                    </div>
                    <div className="settings-preference-grid">
                        <label className="settings-field">
                            <span>Default visual input</span>
                            <select
                                value={preferencesDraft.defaultVisualMode}
                                onChange={(event) => setPreferencesDraft((currentDraft) => ({
                                    ...currentDraft,
                                    defaultVisualMode: event.target.value,
                                }))}
                            >
                                <option value="image">Image</option>
                                <option value="emoji">Emoji</option>
                            </select>
                        </label>

                        <label className="settings-field">
                            <span>Default quick add location</span>
                            <select
                                value={preferencesDraft.defaultQuickAddLocation}
                                onChange={(event) => setPreferencesDraft((currentDraft) => ({
                                    ...currentDraft,
                                    defaultQuickAddLocation: event.target.value,
                                }))}
                            >
                                <option value="">App default</option>
                                {locations.map((location) => (
                                    <option key={location.id} value={location.name}>
                                        {location.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>
                </div>

                <div className="settings-footer-actions">
                    <button
                        type="button"
                        className="settings-button settings-button-primary"
                        onClick={handleSavePreferences}
                        disabled={preferencesSaving}
                    >
                        {preferencesSaving ? "Saving..." : "Save preferences"}
                    </button>
                </div>
            </section>

            <section className="settings-grid">
                <section className="settings-panel settings-card">
                    <div className="settings-card-header">
                        <div>
                            <h2>Locations</h2>
                        </div>
                    </div>

                    <div className="settings-location-add">
                        <input
                            type="text"
                            value={customLocationInput}
                            onChange={(event) => setCustomLocationInput(event.target.value)}
                            placeholder="Add custom location"
                        />
                        <button type="button" className="settings-button settings-button-primary" onClick={handleAddLocation}>
                            Add
                        </button>
                    </div>

                    {locationsError ? <p className="settings-card-copy settings-card-copy-error">{locationsError}</p> : null}
                    {locationsLoading ? <p className="settings-card-copy">Loading locations...</p> : null}

                    {!locationsLoading ? (
                        <div className="settings-location-list">
                            {defaultLocations.map((location) => (
                                <div key={location.id} className="settings-location-item">
                                    <span>{location.name}</span>
                                    <span className="settings-location-default">Default</span>
                                </div>
                            ))}
                            {customLocations.map((location) => (
                                <div key={location.id} className="settings-location-item">
                                    <span>{location.name}</span>
                                    <button
                                        type="button"
                                        className="settings-inline-button"
                                        onClick={() => handleRemoveLocation(location)}
                                        disabled={!location.removable}
                                    >
                                        Remove
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : null}
                </section>

                <section className="settings-panel settings-card">
                    <div className="settings-card-header">
                        <div>
                            <h2>Product names</h2>
                        </div>
                    </div>

                    <article className="settings-action-card">
                        <div className="settings-action-copy">
                            <h3>Scan a product</h3>
                        </div>

                        <button
                            type="button"
                            className="settings-button settings-button-primary"
                            onClick={() => setBarcodeScannerOpen((currentOpen) => !currentOpen)}
                        >
                            {barcodeScannerOpen ? "Hide scanner" : "Scan product"}
                        </button>

                        {barcodeScannerOpen ? (
                            <BarcodeCaptureField
                                onDetected={handleScannedProductDetected}
                                busy={scannedProductLoading || scannedProductSaving}
                                busyMessage={scannedProductLoading ? "Looking up product..." : "Saving product..."}
                            />
                        ) : null}

                        {scannedProductCode ? (
                            <p className="settings-card-copy">Code: {scannedProductCode}</p>
                        ) : null}
                        {scannedProductMessage ? (
                            <p className="settings-card-copy">{scannedProductMessage}</p>
                        ) : null}
                        {scannedProductError ? (
                            <p className="settings-card-copy settings-card-copy-error">{scannedProductError}</p>
                        ) : null}

                        {scannedProductCode ? (
                            <div className="settings-action-stack">
                                <label className="settings-field">
                                    <span>Product name</span>
                                    <input
                                        type="text"
                                        value={scannedProductName}
                                        onChange={(event) => setScannedProductName(event.target.value)}
                                        placeholder="Great Value Milk"
                                    />
                                </label>
                                <button
                                    type="button"
                                    className="settings-button settings-button-primary"
                                    onClick={handleSaveScannedProduct}
                                    disabled={scannedProductSaving}
                                >
                                    {scannedProductSaving ? "Saving..." : scannedProductExists ? "Save rename" : "Save name"}
                                </button>
                            </div>
                        ) : null}
                    </article>
                </section>

            </section>

            <section className="settings-panel settings-card">
                <div className="settings-card-header">
                    <div>
                        <h2>Development</h2>
                    </div>
                    <Link to="/dev-tools" className="settings-button settings-button-primary">
                        Open dev tools
                    </Link>
                </div>
            </section>

            <section className="settings-panel settings-card">
                <div className="settings-card-header">
                    <div>
                        <h2>Recently deleted</h2>
                    </div>
                </div>

                <div className="settings-location-add">
                    <select
                        value={selectedDeletedLocation}
                        onChange={(event) => setSelectedDeletedLocation(event.target.value)}
                    >
                        <option value="">All locations</option>
                        {locations.map((location) => (
                            <option key={location.id} value={location.name}>
                                {location.name}
                            </option>
                        ))}
                    </select>
                </div>

                {deletedLoading ? (
                    <p className="settings-card-copy">Loading recently deleted items...</p>
                ) : deletedError ? (
                    <p className="settings-card-copy settings-card-copy-error">{deletedError}</p>
                ) : deletedItems.length === 0 ? (
                    <p className="settings-card-copy">No recently deleted items.</p>
                ) : (
                    <div className="settings-recovery-list">
                        {deletedItems.map((item) => (
                            <article key={item.id} className="settings-recovery-item">
                                <div>
                                    <h3>{item.food}</h3>
                                    <p>Location: {item.location || getDefaultLocation()}</p>
                                    <p>Deleted: {formatDateTime(item.deletedAt)}</p>
                                    <p>Restore by: {formatDateTime(item.recoverableUntil)}</p>
                                </div>
                                <button
                                    type="button"
                                    className="settings-button settings-button-primary"
                                    onClick={() => handleRestore(item)}
                                    disabled={restoringId !== ""}
                                >
                                    {restoringId === item.id ? "Restoring..." : "Restore"}
                                </button>
                            </article>
                        ))}
                    </div>
                )}
            </section>

            {statusMessage ? (
                <section className={`settings-status settings-status-${statusTone}`}>
                    <p>{statusMessage}</p>
                </section>
            ) : null}
        </div>
    );
}

export default Settings;
