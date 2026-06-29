import { useEffect, useState } from "react";
import PresetForm from "../components/PresetForm";
import PresetCard from "../components/PresetCard";
import ModalShell from "../components/ModalShell";
import { PresetsAPI } from "../services/presets";
import "../css/Presets.css";

function Presets() {
    const [presets, setPresets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState("");
    const [deletingPresetId, setDeletingPresetId] = useState("");
    const [editingPreset, setEditingPreset] = useState(null);

    const notifyPresetsChanged = () => {
        window.dispatchEvent(new Event("fridgevoid:presets-changed"));
    };

    const loadPresets = async () => {
        setLoading(true);
        setErrorMessage("");
        try {
            setPresets(await PresetsAPI.getAll());
        } catch (error) {
            console.error("Failed to load presets", error);
            setPresets([]);
            setErrorMessage("Presets could not be loaded.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadPresets();
    }, []);

    const handleDelete = async (presetId) => {
        setDeletingPresetId(presetId);

        try {
            await PresetsAPI.remove(presetId);
            setPresets((currentPresets) => currentPresets.filter((preset) => preset.id !== presetId));
            if (editingPreset?.id === presetId) {
                setEditingPreset(null);
            }
            notifyPresetsChanged();
        } catch (error) {
            console.error("Failed to delete preset", error);
            setErrorMessage("Preset could not be deleted.");
        } finally {
            setDeletingPresetId("");
        }
    };

    const handlePresetSaved = async () => {
        await loadPresets();
        setEditingPreset(null);
        notifyPresetsChanged();
    };

    return (
        <div className="presets-page">
            <section className="presets-panel">
                <div className="presets-header">
                    <div>
                        <h1>Cooking presets</h1>
                    </div>
                </div>

                <PresetForm onSaved={handlePresetSaved} />
            </section>

            <ModalShell open={Boolean(editingPreset)} onClose={() => setEditingPreset(null)}>
                <div className="preset-edit-modal">
                    <button
                        type="button"
                        className="leftover-modal-close"
                        onClick={() => setEditingPreset(null)}
                    >
                        Close
                    </button>
                    <PresetForm
                        initialPreset={editingPreset}
                        onSaved={handlePresetSaved}
                        onCancel={() => setEditingPreset(null)}
                    />
                </div>
            </ModalShell>

            <section className="presets-panel">
                <div className="presets-header">
                    <div>
                        <h2>Available presets</h2>
                    </div>
                </div>

                {loading ? (
                    <div className="presets-empty-state">
                        <p>Loading presets...</p>
                    </div>
                ) : errorMessage ? (
                    <div className="presets-empty-state">
                        <p>{errorMessage}</p>
                    </div>
                ) : presets.length === 0 ? (
                    <div className="presets-empty-state">
                        <p>No presets yet.</p>
                    </div>
                ) : (
                    <div className="preset-grid">
                        {presets.map((preset) => (
                            <PresetCard
                                key={preset.id}
                                preset={preset}
                                onEdit={setEditingPreset}
                                onDelete={() => handleDelete(preset.id)}
                                isDeleting={deletingPresetId === preset.id}
                            />
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}

export default Presets;
