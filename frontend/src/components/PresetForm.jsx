import { useEffect, useMemo, useState } from "react";
import { LeftoversAPI } from "../api";
import { clearDraft, loadDraft, saveDraft } from "../services/draftStorage";
import { PresetsAPI } from "../services/presets";
import VisualPicker from "./VisualPicker";
import { useUserPreferences } from "../contexts/UserPreferencesContext.jsx";
import "../css/FormControls.css";

function parseTags(tagsInput) {
    return [...new Set(
        tagsInput
            .split(",")
            .map((tag) => tag.trim().toLowerCase())
            .filter(Boolean)
    )];
}

function createInitialPresetState(defaultVisualMode = "image") {
    return {
        name: "",
        container: "",
        tagsInput: "",
        visualType: defaultVisualMode,
        emoji: "",
        imageUrl: "",
        imageFile: null,
        shelfLifeDays: "5",
    };
}

function buildPresetState(preset, defaultVisualMode = "image") {
    if (!preset) {
        return createInitialPresetState(defaultVisualMode);
    }

    return {
        name: preset.name || "",
        container: preset.container || "",
        tagsInput: (preset.tags || []).join(", "),
        visualType: preset.imageUrl ? "image" : defaultVisualMode,
        emoji: preset.emoji || "",
        imageUrl: preset.imageUrl || "",
        imageFile: null,
        shelfLifeDays: String(preset.shelfLifeDays || 5),
    };
}

function PresetForm({ initialPreset = null, onSaved, onCancel }) {
    const { preferences } = useUserPreferences();
    const draftKey = `fridgevoid:preset-form:${initialPreset?.id || "new"}`;
    const [formState, setFormState] = useState(() => buildPresetState(initialPreset, preferences.defaultVisualMode));
    const [isSaving, setIsSaving] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const isEditing = Boolean(initialPreset?.id);
    const formTitle = useMemo(() => isEditing ? `Edit ${initialPreset.name}` : "Create preset", [initialPreset?.name, isEditing]);

    useEffect(() => {
        const savedDraft = loadDraft(draftKey, null);
        setFormState(savedDraft?.formState || buildPresetState(initialPreset, preferences.defaultVisualMode));
        setErrorMessage("");
    }, [draftKey, initialPreset, preferences.defaultVisualMode]);

    useEffect(() => {
        saveDraft(draftKey, {
            formState: {
                ...formState,
                imageFile: null,
            },
        });
    }, [draftKey, formState]);

    const updateForm = (patch) => {
        setFormState((currentState) => ({ ...currentState, ...patch }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (!formState.name.trim()) {
            setErrorMessage("Preset name is required.");
            return;
        }

        const shelfLifeDays = Number(formState.shelfLifeDays);

        if (!Number.isFinite(shelfLifeDays) || shelfLifeDays <= 0) {
            setErrorMessage("Shelf life must be a positive number of days.");
            return;
        }

        setIsSaving(true);
        setErrorMessage("");

        try {
            let imageUrl = formState.visualType === "image" ? formState.imageUrl || null : null;

            if (formState.visualType === "image" && formState.imageFile) {
                imageUrl = await LeftoversAPI.uploadImage(formState.imageFile);
            }

            const payload = {
                name: formState.name.trim(),
                shelfLifeDays,
                container: formState.container.trim() || null,
                tags: parseTags(formState.tagsInput),
                emoji: formState.visualType === "emoji" ? formState.emoji.trim() || null : null,
                imageUrl,
            };

            if (isEditing) {
                await PresetsAPI.update(initialPreset.id, payload);
            } else {
                await PresetsAPI.create(payload);
            }

            clearDraft(draftKey);
            clearDraft(`${draftKey}:image`);
            if (!isEditing) {
                setFormState(createInitialPresetState(preferences.defaultVisualMode));
            }
            if (onSaved) {
                await onSaved();
            }
        } catch (error) {
            console.error("Failed to save preset", error);
            setErrorMessage("Failed to save preset. Try again.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <form className="preset-form" onSubmit={handleSubmit}>
            <div className="preset-form-header">
                <div>
                    <h2>{formTitle}</h2>
                </div>
                {onCancel ? (
                    <button type="button" className="preset-form-cancel" onClick={onCancel} disabled={isSaving}>
                        Cancel
                    </button>
                ) : null}
            </div>

            <div className="preset-form-grid">
                <label className="modal-field">
                    <span>Name</span>
                    <input
                        type="text"
                        value={formState.name}
                        onChange={(event) => updateForm({ name: event.target.value })}
                        placeholder="Falafel"
                    />
                </label>

                <label className="modal-field">
                    <span>Tags</span>
                    <input
                        type="text"
                        value={formState.tagsInput}
                        onChange={(event) => updateForm({ tagsInput: event.target.value })}
                        placeholder="protein, meal"
                    />
                </label>

                <label className="modal-field">
                    <span>Container</span>
                    <input
                        type="text"
                        value={formState.container}
                        onChange={(event) => updateForm({ container: event.target.value })}
                        placeholder="Deli container"
                    />
                </label>

                <label className="modal-field">
                    <span>Shelf life</span>
                    <input
                        type="number"
                        min="1"
                        step="1"
                        value={formState.shelfLifeDays}
                        onChange={(event) => updateForm({ shelfLifeDays: event.target.value })}
                        placeholder="5"
                    />
                </label>
            </div>

            <VisualPicker
                draftKey={draftKey}
                visualType={formState.visualType}
                onVisualTypeChange={(visualType) => updateForm({ visualType })}
                emoji={formState.emoji}
                onEmojiChange={(emoji) => updateForm({ emoji })}
                imageUrl={formState.imageUrl}
                imageFile={formState.imageFile}
                onImageFileChange={(imageFile) => updateForm({
                    imageFile,
                    imageUrl: imageFile ? "" : formState.imageUrl,
                })}
            />

            {errorMessage ? <p className="form-error">{errorMessage}</p> : null}

            <div className="preset-form-actions">
                <button type="submit" className="leftover-modal-primary" disabled={isSaving}>
                    {isSaving ? "Saving..." : isEditing ? "Save changes" : "Save preset"}
                </button>
            </div>
        </form>
    );
}

export default PresetForm;
