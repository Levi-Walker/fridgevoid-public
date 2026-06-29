import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
    DEFAULT_THEME_COLORS,
    UI_COLOR_FIELDS,
    loadUiColors,
    saveUiColors,
} from "../services/uiColors";
import "../css/Settings.css";

function ColorSettings({ activeTheme = "light" }) {
    const [themeColors, setThemeColors] = useState(DEFAULT_THEME_COLORS);
    const [activeMode, setActiveMode] = useState(activeTheme === "dark" ? "dark" : "light");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [hasPendingChanges, setHasPendingChanges] = useState(false);
    const [statusMessage, setStatusMessage] = useState("");
    const [errorMessage, setErrorMessage] = useState("");
    const activeColors = themeColors[activeMode];

    useEffect(() => {
        setActiveMode(activeTheme === "dark" ? "dark" : "light");
    }, [activeTheme]);

    useEffect(() => {
        let cancelled = false;

        loadUiColors()
            .then((colors) => {
                if (!cancelled) {
                    setThemeColors(colors);
                    setHasPendingChanges(false);
                    setErrorMessage("");
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setErrorMessage("Theme colors could not be loaded. Temporary defaults are shown.");
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, []);

    const applyBackendColors = (colors) => {
        setThemeColors(colors);
        window.dispatchEvent(new CustomEvent("fridgevoid:ui-colors-changed", {
            detail: { colors },
        }));
    };

    const updateColor = (key, value) => {
        const nextColors = {
            ...themeColors,
            [activeMode]: {
                ...themeColors[activeMode],
                [key]: value,
            },
        };

        setThemeColors(nextColors);
        setHasPendingChanges(true);
        setStatusMessage("");
        setErrorMessage("");
    };

    const resetActiveMode = () => {
        setThemeColors((currentColors) => ({
            ...currentColors,
            [activeMode]: {
                ...DEFAULT_THEME_COLORS[activeMode],
            },
        }));
        setHasPendingChanges(true);
        setStatusMessage("");
        setErrorMessage("");
    };

    const saveThemeColors = async (nextColors = themeColors) => {
        setSaving(true);
        setStatusMessage("");
        setErrorMessage("");

        try {
            const savedColors = await saveUiColors(nextColors);
            applyBackendColors(savedColors);
            setHasPendingChanges(false);
            setStatusMessage("Theme saved.");
        } catch {
            setErrorMessage("Theme could not be saved.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="settings-page color-settings-page">
            <section className="settings-panel settings-card">
                <div className="settings-card-header">
                    <div>
                        <h1>Theme</h1>
                    </div>
                    <Link to="/settings" className="settings-button">
                        Back to settings
                    </Link>
                </div>

                {loading ? <p className="settings-card-copy">Loading theme...</p> : null}
                {errorMessage ? <p className="settings-card-copy settings-card-copy-error">{errorMessage}</p> : null}

                <div className="color-mode-tabs" role="group" aria-label="Theme mode">
                    <button
                        type="button"
                        className={activeMode === "light" ? "color-mode-tab color-mode-tab-active" : "color-mode-tab"}
                        onClick={() => setActiveMode("light")}
                    >
                        Light
                    </button>
                    <button
                        type="button"
                        className={activeMode === "dark" ? "color-mode-tab color-mode-tab-active" : "color-mode-tab"}
                        onClick={() => setActiveMode("dark")}
                    >
                        Dark
                    </button>
                </div>

                <div className="color-settings-grid">
                    {UI_COLOR_FIELDS.map((field) => (
                        <label key={field.key} className="color-settings-field">
                            <span>{field.label}</span>
                            <div className="color-input-row">
                                <input
                                    type="color"
                                    value={activeColors[field.key]}
                                    onChange={(event) => updateColor(field.key, event.target.value)}
                                    disabled={loading}
                                />
                                <input
                                    type="text"
                                    value={activeColors[field.key]}
                                    readOnly
                                    disabled={loading}
                                />
                            </div>
                        </label>
                    ))}
                </div>

                <div className="color-preview" style={{
                    "--preview-bg": activeColors.backgroundColor,
                    "--preview-surface": activeColors.surfaceColor,
                    "--preview-text": activeColors.textColor,
                    "--preview-accent": activeColors.primaryColor,
                    "--preview-danger": activeColors.accentColor,
                }}>
                    <div className="color-preview-panel">
                        <span>Preview</span>
                        <strong>Inventory card</strong>
                        <div className="color-preview-actions">
                            <button type="button">Primary</button>
                            <button type="button">Accent</button>
                        </div>
                    </div>
                </div>

                <div className="settings-footer-actions">
                    <button
                        type="button"
                        className="settings-button"
                        onClick={resetActiveMode}
                        disabled={loading || saving}
                    >
                        Reset {activeMode}
                    </button>
                    <button
                        type="button"
                        className="settings-button settings-button-primary"
                        onClick={() => saveThemeColors()}
                        disabled={loading || saving || !hasPendingChanges}
                    >
                        {saving ? "Saving..." : "Save theme"}
                    </button>
                </div>

                {statusMessage ? (
                    <section className="settings-status settings-status-success">
                        <p>{statusMessage}</p>
                    </section>
                ) : null}
            </section>
        </div>
    );
}

export default ColorSettings;
