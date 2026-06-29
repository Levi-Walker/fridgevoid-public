import { useEffect, useMemo, useState } from "react";
import { LeftoversAPI } from "../api";
import { getDefaultLocation, getLocationNameList } from "../services/locations";
import { saveLeftoverNotes } from "../services/leftoverNotes";
import { removeLeftoverVisual, saveLeftoverVisual } from "../services/leftoverVisuals";
import { getExpirationStateFromDate, resolveExpirationState } from "../utils/expiration";
import ExpirationInput from "./ExpirationInput";
import ModalShell from "./ModalShell";
import VisualPicker from "./VisualPicker";
import { useUserPreferences } from "../contexts/UserPreferencesContext.jsx";
import "../css/FormControls.css";

function tagsToInput(tags = []) {
    return tags.filter(Boolean).join(", ");
}

function parseTags(tagsInput) {
    return [...new Set(
        tagsInput
            .split(",")
            .map((tag) => tag.trim().toLowerCase())
            .filter((tag) => tag && tag !== "expired")
    )];
}

function LeftoverModal({ open, leftover, onClose, onUpdated, locations = [] }) {
    const { preferences } = useUserPreferences();
    const [foodInput, setFoodInput] = useState("");
    const [containerInput, setContainerInput] = useState("");
    const [locationInput, setLocationInput] = useState("Fridge");
    const [notesInput, setNotesInput] = useState("");
    const [tagsInput, setTagsInput] = useState("");
    const [visualType, setVisualType] = useState(preferences.defaultVisualMode);
    const [emojiInput, setEmojiInput] = useState("");
    const [imageUrl, setImageUrl] = useState("");
    const [imageFile, setImageFile] = useState(null);
    const [expirationState, setExpirationState] = useState(getExpirationStateFromDate(new Date()));
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [showExpirationValidation, setShowExpirationValidation] = useState(false);
    const [expirationDirty, setExpirationDirty] = useState(false);
    const [pendingDelete, setPendingDelete] = useState(false);
    const availableLocationNames = getLocationNameList(locations);

    useEffect(() => {
        if (!leftover || !open) {
            return;
        }

        setFoodInput(leftover.food || "");
        setContainerInput(leftover.container || "");
        setLocationInput(leftover.location || "Fridge");
        setNotesInput(leftover.notes || "");
        setTagsInput(tagsToInput(leftover.tags));
        setVisualType(leftover.imageUrl ? "image" : preferences.defaultVisualMode);
        setEmojiInput(leftover.emoji || "");
        setImageUrl(leftover.imageUrl || "");
        setImageFile(null);
        setExpirationState(getExpirationStateFromDate(leftover.expiration ? new Date(leftover.expiration) : new Date()));
        setErrorMessage("");
        setShowExpirationValidation(false);
        setExpirationDirty(false);
        setPendingDelete(false);
    }, [leftover, open, preferences.defaultVisualMode]);

    useEffect(() => {
        if (!pendingDelete) {
            return undefined;
        }

        const timeoutId = window.setTimeout(() => setPendingDelete(false), 2800);
        return () => window.clearTimeout(timeoutId);
    }, [pendingDelete]);

    const resolvedExpiration = useMemo(() => resolveExpirationState(expirationState), [expirationState]);

    const updateExpirationState = (patch) => {
        setExpirationState((currentState) => {
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

    if (!leftover) {
        return null;
    }

    const handleSave = async () => {
        if (!foodInput.trim()) {
            setErrorMessage("Food name is required.");
            return;
        }

        if (expirationDirty) {
            setShowExpirationValidation(true);
        }

        if (expirationDirty && (resolvedExpiration.errorMessage || !resolvedExpiration.resolvedExpirationDate)) {
            setErrorMessage(resolvedExpiration.errorMessage || "Choose a future expiration date.");
            return;
        }

        setIsSaving(true);
        setErrorMessage("");

        try {
            let nextImageUrl = visualType === "image" ? imageUrl || null : null;

            if (visualType === "image" && imageFile) {
                nextImageUrl = await LeftoversAPI.uploadImage(imageFile);
            }

            const payload = {
                food: foodInput.trim(),
                container: containerInput.trim() || null,
                notes: notesInput.trim() || null,
                location: locationInput,
                emoji: visualType === "emoji" ? emojiInput.trim() || null : null,
                imageUrl: nextImageUrl,
                tags: parseTags(tagsInput),
                lastKnownUpdatedAt: leftover.updatedAt || null,
            };

            if (expirationDirty && resolvedExpiration.resolvedExpirationDate) {
                payload.expirationDate = resolvedExpiration.resolvedExpirationDate.toISOString();
            }

            const response = await LeftoversAPI.update(leftover.id, payload);

            if (visualType === "image" && nextImageUrl) {
                saveLeftoverVisual(leftover.id, {
                    visualType,
                    imageUrl: nextImageUrl,
                });
            } else {
                removeLeftoverVisual(leftover.id);
            }

            saveLeftoverNotes(leftover.id, notesInput);

            onClose();
            if (onUpdated) {
                await onUpdated(response?.conflictDetected);
            }
        } catch (error) {
            console.error("Failed to update leftover", error);
            setErrorMessage("Update failed. Try again.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!pendingDelete) {
            setPendingDelete(true);
            return;
        }

        setIsDeleting(true);
        setErrorMessage("");

        try {
            await LeftoversAPI.remove(leftover.id);
            onClose();
            if (onUpdated) {
                await onUpdated();
            }
        } catch (error) {
            console.error("Failed to delete leftover", error);
            setErrorMessage("Delete failed. Try again.");
        } finally {
            setIsDeleting(false);
        }
    };

    const updateExpirationField = (patch) => {
        setExpirationDirty(true);
        setShowExpirationValidation(true);
        updateExpirationState(patch);
    };

    return (
        <ModalShell open={open} onClose={isSaving || isDeleting ? () => {} : onClose}>
            <button
                type="button"
                className="leftover-modal-close"
                onClick={onClose}
                disabled={isSaving || isDeleting}
            >
                Close
            </button>

            <div className="leftover-modal-header">
                <div>
                    <h2>Edit {leftover.food}</h2>
                </div>
            </div>

            <div className="leftover-modal-form">
                <label className="modal-field">
                    <span>Food</span>
                    <input
                        type="text"
                        value={foodInput}
                        onChange={(event) => setFoodInput(event.target.value)}
                        placeholder="Tomato soup"
                        autoFocus
                    />
                </label>

                <div className="form-grid">
                    <label className="modal-field">
                        <span>Container</span>
                        <input
                            type="text"
                            value={containerInput}
                            onChange={(event) => setContainerInput(event.target.value)}
                            placeholder="Glass container"
                        />
                    </label>

                    <label className="modal-field">
                        <span>Location</span>
                        <select
                            value={locationInput}
                            onChange={(event) => setLocationInput(event.target.value)}
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
                            value={tagsInput}
                            onChange={(event) => setTagsInput(event.target.value)}
                            placeholder="fruit, meal"
                        />
                    </label>

                    <label className="modal-field">
                        <span>Notes</span>
                        <textarea
                            value={notesInput}
                            onChange={(event) => setNotesInput(event.target.value)}
                            placeholder="Reheat gently"
                            rows={3}
                        />
                    </label>
                </div>

                <VisualPicker
                    visualType={visualType}
                    onVisualTypeChange={(nextVisualType) => {
                        setVisualType(nextVisualType);
                        if (nextVisualType !== "image") {
                            setImageFile(null);
                        }
                    }}
                    emoji={emojiInput}
                    onEmojiChange={setEmojiInput}
                    imageUrl={imageUrl}
                    imageFile={imageFile}
                    onImageFileChange={(nextImageFile) => {
                        setImageFile(nextImageFile);
                        if (nextImageFile) {
                            setImageUrl("");
                        }
                    }}
                />

                <ExpirationInput
                    expirationMode={expirationState.expirationMode}
                    onExpirationModeChange={(expirationMode) => updateExpirationField({ expirationMode })}
                    absoluteDate={expirationState.absoluteDate}
                    onAbsoluteDateChange={(absoluteDate) => updateExpirationField({ absoluteDate })}
                    relativeAmount={expirationState.relativeAmount}
                    onRelativeAmountChange={(relativeAmount) => updateExpirationField({ relativeAmount })}
                    resolvedExpirationDate={resolvedExpiration.resolvedExpirationDate}
                    errorMessage={expirationDirty && showExpirationValidation ? resolvedExpiration.errorMessage : null}
                />

                {errorMessage ? <p className="form-error">{errorMessage}</p> : null}

                <div className="leftover-modal-actions">
                    <button
                        type="button"
                        className="leftover-modal-danger"
                        onClick={handleDelete}
                        disabled={isSaving || isDeleting}
                    >
                        {isDeleting ? "Deleting..." : pendingDelete ? "Confirm delete" : "Delete"}
                    </button>
                    <button
                        type="button"
                        className="leftover-modal-secondary"
                        onClick={onClose}
                        disabled={isSaving || isDeleting}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="leftover-modal-primary"
                        onClick={handleSave}
                        disabled={isSaving || isDeleting}
                    >
                        {isSaving ? "Saving..." : "Save changes"}
                    </button>
                </div>
            </div>
        </ModalShell>
    );
}

export default LeftoverModal;
