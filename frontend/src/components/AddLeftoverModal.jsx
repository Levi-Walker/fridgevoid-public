import { useEffect, useMemo, useState } from "react";
import { LeftoversAPI, ScannedProductsAPI } from "../api";
import { clearDraft, loadDraft, saveDraft } from "../services/draftStorage";
import { getDefaultLocation, getLocationNameList } from "../services/locations";
import { saveLeftoverNotes } from "../services/leftoverNotes";
import { PresetsAPI } from "../services/presets";
import { normalizeScannedCode } from "../services/scannedProducts";
import { saveLeftoverVisual } from "../services/leftoverVisuals";
import {
    getDefaultExpirationState,
    resolveExpirationState,
} from "../utils/expiration";
import ModalShell from "./ModalShell";
import ExpirationInput from "./ExpirationInput";
import VisualPicker from "./VisualPicker";
import BarcodeCaptureField from "./BarcodeCaptureField";
import { useUserPreferences } from "../contexts/UserPreferencesContext.jsx";
import "../css/FormControls.css";

function parseTags(tagsInput) {
    return [...new Set(
        tagsInput
            .split(",")
            .map((tag) => tag.trim().toLowerCase())
            .filter((tag) => tag && tag !== "expired")
    )];
}

function createInitialState(preset, defaultVisualMode = "image") {
    const expirationState = getDefaultExpirationState();
    const relativeAmount = preset?.shelfLifeDays ? String(preset.shelfLifeDays) : expirationState.relativeAmount;

    return {
        food: preset?.name || "",
        container: preset?.container || "",
        notes: "",
        tagsInput: (preset?.tags || []).join(", "),
        location: preset?.location || getDefaultLocation(),
        visualType: preset?.imageUrl ? "image" : defaultVisualMode,
        emoji: preset?.emoji || "",
        imageUrl: preset?.imageUrl || "",
        imageFile: null,
        saveAsPreset: false,
        presetShelfLifeDays: preset?.shelfLifeDays ? String(preset.shelfLifeDays) : "5",
        selectedPresetId: preset?.id || "",
        expirationMode: expirationState.expirationMode,
        relativeAmount,
        relativeUnit: expirationState.relativeUnit,
        absoluteDate: expirationState.absoluteDate,
        resolvedExpirationDate: expirationState.resolvedExpirationDate,
    };
}

function AddLeftoverModal({ open, onClose, onSaved, initialPreset = null, locations = [] }) {
    const { preferences } = useUserPreferences();
    const draftKey = `fridgevoid:add-leftover:${initialPreset?.id || "custom"}`;
    const [formState, setFormState] = useState(() => createInitialState(initialPreset, preferences.defaultVisualMode));
    const [errorMessage, setErrorMessage] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [showExpirationValidation, setShowExpirationValidation] = useState(false);
    const [scannerOpen, setScannerOpen] = useState(false);
    const [scannedCode, setScannedCode] = useState("");
    const [scannedLookupLoading, setScannedLookupLoading] = useState(false);
    const [scannedLookupError, setScannedLookupError] = useState("");
    const [scannedLookupMessage, setScannedLookupMessage] = useState("");
    const [scannedNameDraft, setScannedNameDraft] = useState("");
    const [scannedProductKnown, setScannedProductKnown] = useState(null);
    const [scannedSaveLoading, setScannedSaveLoading] = useState(false);
    const availableLocationNames = getLocationNameList(locations);

    useEffect(() => {
        if (!open) {
            return;
        }

        const savedDraft = loadDraft(draftKey, null);
        setFormState(savedDraft?.formState || createInitialState(initialPreset, preferences.defaultVisualMode));
        setErrorMessage("");
        setShowExpirationValidation(Boolean(savedDraft?.showExpirationValidation));
        setScannerOpen(Boolean(savedDraft?.scannerOpen));
        setScannedCode(savedDraft?.scannedCode || "");
        setScannedLookupLoading(false);
        setScannedLookupError(savedDraft?.scannedLookupError || "");
        setScannedLookupMessage(savedDraft?.scannedLookupMessage || "");
        setScannedNameDraft(savedDraft?.scannedNameDraft || "");
        setScannedProductKnown(
            typeof savedDraft?.scannedProductKnown === "boolean" ? savedDraft.scannedProductKnown : null
        );
        setScannedSaveLoading(false);
    }, [draftKey, initialPreset, open, preferences.defaultVisualMode]);

    useEffect(() => {
        if (!open) {
            return;
        }

        saveDraft(draftKey, {
            formState: {
                ...formState,
                imageFile: null,
            },
            showExpirationValidation,
            scannerOpen,
            scannedCode,
            scannedLookupError,
            scannedLookupMessage,
            scannedNameDraft,
            scannedProductKnown,
        });
    }, [
        draftKey,
        formState,
        open,
        scannedCode,
        scannedLookupError,
        scannedLookupMessage,
        scannedNameDraft,
        scannedProductKnown,
        scannerOpen,
        showExpirationValidation,
    ]);

    useEffect(() => {
        if (!formState.saveAsPreset || formState.selectedPresetId) {
            return;
        }

        if (formState.expirationMode !== "relative") {
            return;
        }

        setFormState((currentState) => {
            if (currentState.presetShelfLifeDays === currentState.relativeAmount) {
                return currentState;
            }

            return {
                ...currentState,
                presetShelfLifeDays: currentState.relativeAmount,
            };
        });
    }, [formState.expirationMode, formState.relativeAmount, formState.saveAsPreset, formState.selectedPresetId]);

    const expirationValidation = useMemo(() => resolveExpirationState(formState), [formState]);

    const updateForm = (patch) => {
        setFormState((currentState) => {
            const nextState = { ...currentState, ...patch };
            const nextExpiration = resolveExpirationState(nextState);

            return {
                ...nextState,
                resolvedExpirationDate: nextExpiration.resolvedExpirationDate,
                absoluteDate: nextState.expirationMode === "relative" && nextExpiration.resolvedExpirationDate
                    ? nextExpiration.resolvedExpirationDate
                    : nextState.absoluteDate,
            };
        });
    };

    const handleBarcodeDetected = async (rawCode) => {
        const nextCode = normalizeScannedCode(rawCode);

        if (!nextCode) {
            setScannedLookupError("Scan a valid barcode.");
            return;
        }

        setScannerOpen(false);
        setScannedCode(nextCode);
        setScannedLookupLoading(true);
        setScannedLookupError("");
        setScannedLookupMessage("");
        setScannedNameDraft("");
        setScannedProductKnown(null);

        try {
            const product = await ScannedProductsAPI.getOne(nextCode);
            const nextName = product?.name?.trim() || "";

            if (nextName) {
                setScannedProductKnown(true);
                setScannedNameDraft(nextName);
                setScannedLookupMessage("Product found.");
                updateForm({ food: nextName });
                return;
            }

            setScannedProductKnown(false);
        } catch (error) {
            if (error.status === 404) {
                setScannedProductKnown(false);
                return;
            }

            console.error("Failed to look up scanned product", error);
            setScannedLookupError("Product lookup failed.");
        } finally {
            setScannedLookupLoading(false);
        }
    };

    const handleSaveScannedName = async () => {
        const nextCode = normalizeScannedCode(scannedCode);
        const nextName = scannedNameDraft.trim();

        if (!nextCode) {
            setScannedLookupError("Scan a product first.");
            return;
        }

        if (!nextName) {
            setScannedLookupError("Enter a product name.");
            return;
        }

        setScannedSaveLoading(true);
        setScannedLookupError("");
        setScannedLookupMessage("");

        try {
            await ScannedProductsAPI.create({
                code: nextCode,
                name: nextName,
            });
            setScannedProductKnown(true);
            setScannedLookupMessage("Product saved.");
            updateForm({ food: nextName });
        } catch (error) {
            console.error("Failed to save scanned product", error);
            setScannedLookupError("Product save failed.");
        } finally {
            setScannedSaveLoading(false);
        }
    };

    const handleSave = async () => {
        setShowExpirationValidation(true);

        if (!formState.food.trim()) {
            setErrorMessage("Food name is required.");
            return;
        }

        if (expirationValidation.errorMessage || !expirationValidation.resolvedExpirationDate) {
            setErrorMessage(expirationValidation.errorMessage || "Expiration date is required.");
            return;
        }

        if (!formState.selectedPresetId && formState.saveAsPreset) {
            const presetShelfLifeDays = Number(formState.presetShelfLifeDays);

            if (!Number.isFinite(presetShelfLifeDays) || presetShelfLifeDays <= 0) {
                setErrorMessage("Preset shelf life must be a positive number of days.");
                return;
            }
        }

        setIsSaving(true);
        setErrorMessage("");

        try {
            let imageUrl = formState.visualType === "image" ? formState.imageUrl || null : null;

            if (formState.visualType === "image" && formState.imageFile) {
                imageUrl = await LeftoversAPI.uploadImage(formState.imageFile);
            }

            const payload = {
                food: formState.food.trim(),
                expirationDate: expirationValidation.resolvedExpirationDate.toISOString(),
                container: formState.container.trim() || null,
                notes: formState.notes.trim() || null,
                location: formState.location,
                presetId: formState.selectedPresetId || null,
                emoji: formState.visualType === "emoji" ? formState.emoji.trim() || null : null,
                imageUrl,
                tags: parseTags(formState.tagsInput),
            };

            const createResponse = await LeftoversAPI.create(payload);

            if (createResponse?.id) {
                saveLeftoverVisual(createResponse.id, {
                    visualType: formState.visualType,
                    imageUrl,
                });
                saveLeftoverNotes(createResponse.id, formState.notes);
            }

            if (!formState.selectedPresetId && formState.saveAsPreset) {
                await PresetsAPI.create({
                    name: formState.food.trim(),
                    shelfLifeDays: Number(formState.presetShelfLifeDays),
                    container: formState.container.trim() || null,
                    tags: parseTags(formState.tagsInput),
                    emoji: formState.visualType === "emoji" ? formState.emoji.trim() || null : null,
                    imageUrl,
                });
                window.dispatchEvent(new Event("fridgevoid:presets-changed"));
            }

            clearDraft(draftKey);
            clearDraft(`${draftKey}:image`);
            onClose();
            if (onSaved) {
                await onSaved();
            }
        } catch (error) {
            console.error("Failed to save leftover", error);
            setErrorMessage("Failed to save leftover. Try again.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <ModalShell open={open} onClose={isSaving ? () => {} : onClose}>
            <button
                type="button"
                className="leftover-modal-close"
                onClick={onClose}
                disabled={isSaving}
            >
                Close
            </button>

            <div className="leftover-modal-header">
                <div>
                    <h2>{initialPreset ? `Add ${initialPreset.name}` : "Add a leftover"}</h2>
                </div>
            </div>

            <div className="leftover-modal-form">
                <label className="modal-field">
                    <span>Food</span>
                    <input
                        type="text"
                        value={formState.food}
                        onChange={(event) => updateForm({ food: event.target.value })}
                        placeholder="Falafel"
                        autoFocus
                    />
                </label>

                <div className="form-block barcode-flow-block">
                    <div className="form-block-header">
                        <span className="form-block-label">Barcode</span>
                        <button
                            type="button"
                            className="settings-inline-button"
                            onClick={() => setScannerOpen((currentOpen) => !currentOpen)}
                        >
                            {scannerOpen ? "Hide scanner" : "Scan product"}
                        </button>
                    </div>

                    {scannerOpen ? (
                        <BarcodeCaptureField
                            onDetected={handleBarcodeDetected}
                            busy={scannedLookupLoading || scannedSaveLoading}
                            busyMessage={scannedLookupLoading ? "Looking up product..." : "Saving product..."}
                        />
                    ) : null}

                    {scannedCode ? (
                        <label className="modal-field">
                            <span>Scanned product ID</span>
                            <input
                                type="text"
                                value={scannedCode}
                                readOnly
                            />
                        </label>
                    ) : null}

                    {scannedLookupMessage ? <p className="field-hint">{scannedLookupMessage}</p> : null}
                    {scannedLookupError ? <p className="form-error">{scannedLookupError}</p> : null}

                    {scannedCode ? (
                        <div className="barcode-name-editor">
                            <label className="modal-field">
                                <span>Product name</span>
                                <input
                                    type="text"
                                    value={scannedNameDraft}
                                    onChange={(event) => setScannedNameDraft(event.target.value)}
                                    placeholder="Great Value Apple Sauce"
                                />
                            </label>
                            <button
                                type="button"
                                className="settings-button settings-button-primary"
                                onClick={handleSaveScannedName}
                                disabled={scannedSaveLoading || scannedProductKnown === true}
                            >
                                {scannedSaveLoading ? "Saving..." : scannedProductKnown ? "Saved" : "Save name"}
                            </button>
                        </div>
                    ) : null}
                </div>

                <div className="form-grid">
                    <label className="modal-field">
                        <span>Container</span>
                        <input
                            type="text"
                            value={formState.container}
                            onChange={(event) => updateForm({ container: event.target.value })}
                            placeholder="Glass container"
                        />
                    </label>

                    <label className="modal-field">
                        <span>Location</span>
                        <select
                            value={formState.location}
                            onChange={(event) => updateForm({ location: event.target.value })}
                        >
                            {(availableLocationNames.length ? availableLocationNames : [getDefaultLocation()]).map((location) => (
                                <option key={location} value={location}>
                                    {location}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>

                <div className="form-grid">
                    <label className="modal-field">
                        <span>Tags</span>
                        <input
                            type="text"
                            value={formState.tagsInput}
                            onChange={(event) => updateForm({ tagsInput: event.target.value })}
                            placeholder="protein, snack"
                        />
                    </label>

                    <label className="modal-field">
                        <span>Notes</span>
                        <textarea
                            value={formState.notes}
                            onChange={(event) => updateForm({ notes: event.target.value })}
                            placeholder="Reheat gently"
                            rows={3}
                        />
                    </label>
                </div>

                <VisualPicker
                    draftKey={draftKey}
                    visualType={formState.visualType}
                    onVisualTypeChange={(visualType) => updateForm({
                        visualType,
                        imageFile: visualType === "image" ? formState.imageFile : null,
                    })}
                    emoji={formState.emoji}
                    onEmojiChange={(emoji) => updateForm({ emoji })}
                    imageUrl={formState.imageUrl}
                    imageFile={formState.imageFile}
                    onImageFileChange={(imageFile) => updateForm({
                        imageFile,
                        imageUrl: imageFile ? "" : formState.imageUrl,
                    })}
                />

                <ExpirationInput
                    expirationMode={formState.expirationMode}
                    onExpirationModeChange={(expirationMode) => updateForm({ expirationMode })}
                    absoluteDate={formState.absoluteDate}
                    onAbsoluteDateChange={(absoluteDate) => updateForm({ absoluteDate })}
                    relativeAmount={formState.relativeAmount}
                    onRelativeAmountChange={(relativeAmount) => {
                        setShowExpirationValidation(true);
                        updateForm({ relativeAmount });
                    }}
                    resolvedExpirationDate={expirationValidation.resolvedExpirationDate}
                    errorMessage={showExpirationValidation ? expirationValidation.errorMessage : null}
                />

                {!formState.selectedPresetId ? (
                    <div className={`preset-save-panel${formState.saveAsPreset ? " active" : ""}`}>
                        <label className="checkbox-row">
                            <input
                                type="checkbox"
                                checked={formState.saveAsPreset}
                                onChange={(event) => updateForm({
                                    saveAsPreset: event.target.checked,
                                    presetShelfLifeDays: event.target.checked && formState.expirationMode === "relative"
                                        ? formState.relativeAmount
                                        : formState.presetShelfLifeDays,
                                })}
                            />
                            <span>Quick save as preset</span>
                        </label>

                        {formState.saveAsPreset ? (
                            <div className="preset-save-fields">
                                <label className="modal-field">
                                    <span>Preset shelf life in days</span>
                                    <input
                                        type="number"
                                        min="1"
                                        step="1"
                                        value={formState.presetShelfLifeDays}
                                        onChange={(event) => updateForm({ presetShelfLifeDays: event.target.value })}
                                        placeholder="5"
                                    />
                                </label>
                            </div>
                        ) : null}
                    </div>
                ) : null}

                {errorMessage ? <p className="form-error">{errorMessage}</p> : null}

                <div className="leftover-modal-actions">
                    <button
                        type="button"
                        className="leftover-modal-secondary"
                        onClick={onClose}
                        disabled={isSaving}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="leftover-modal-primary"
                        onClick={handleSave}
                        disabled={isSaving || !expirationValidation.resolvedExpirationDate}
                    >
                        {isSaving ? "Saving..." : "Save leftover"}
                    </button>
                </div>
            </div>
        </ModalShell>
    );
}

export default AddLeftoverModal;
