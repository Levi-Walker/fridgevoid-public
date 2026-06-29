import { useEffect, useState } from "react";
import VisualPreview from "./VisualPreview";
import "../css/Presets.css";

function PresetCard({
    preset,
    className = "",
    onQuickAdd,
    onAddDetails,
    onEdit,
    onDelete,
    isQuickAdding = false,
    isDeleting = false,
    showQuickActions = false,
}) {
    const [pendingDelete, setPendingDelete] = useState(false);
    const usedCount = Number.isFinite(Number(preset.usedCount)) ? Number(preset.usedCount) : 0;

    useEffect(() => {
        if (!pendingDelete) {
            return undefined;
        }

        const timeoutId = window.setTimeout(() => setPendingDelete(false), 2800);
        return () => window.clearTimeout(timeoutId);
    }, [pendingDelete]);

    const handleDelete = () => {
        if (!pendingDelete) {
            setPendingDelete(true);
            return;
        }

        setPendingDelete(false);
        onDelete?.(preset);
    };

    return (
        <article className={`preset-card ${className}`.trim()}>
            <div className="preset-visual">
                <VisualPreview
                    visualType={preset.visualType}
                    emoji={preset.emoji}
                    imageUrl={preset.imageUrl}
                    className={preset.visualType === "image" ? "preset-image" : "preset-emoji"}
                    fallbackClassName="preset-emoji"
                />
            </div>

            <div className="preset-card-body">
                <div className="preset-card-header">
                    <div className="preset-card-title-block">
                        <h3>{preset.name}</h3>
                        <p className="preset-usage">Used {usedCount} {usedCount === 1 ? "time" : "times"}</p>
                    </div>

                    {onEdit || onDelete ? (
                        <div className="preset-card-actions">
                            {onEdit ? (
                                <button
                                    type="button"
                                    className="preset-edit"
                                    onClick={() => onEdit(preset)}
                                    disabled={isDeleting || isQuickAdding}
                                >
                                    Edit
                                </button>
                            ) : null}
                            {onDelete ? (
                                <button
                                    type="button"
                                    className="preset-delete"
                                    onClick={handleDelete}
                                    disabled={isDeleting || isQuickAdding}
                                >
                                    {isDeleting ? "Deleting..." : pendingDelete ? "Confirm delete" : "Delete"}
                                </button>
                            ) : null}
                        </div>
                    ) : null}
                </div>

                <div className="preset-card-copy">
                    <p className="preset-meta">Shelf life: {preset.shelfLifeDays ? `${preset.shelfLifeDays} ${preset.shelfLifeDays === 1 ? "day" : "days"}` : "Not set"}</p>
                    {preset.container ? <p className="preset-meta">Container: {preset.container}</p> : null}
                    {preset.tags?.length ? (
                        <div className="preset-tags">
                            {preset.tags.map((tag) => (
                                <span key={tag} className="preset-tag">{tag}</span>
                            ))}
                        </div>
                    ) : null}
                </div>

                {showQuickActions ? (
                    <div className="preset-quick-actions">
                        <button
                            type="button"
                            className="quick-add-button quick-add-button-primary"
                            onClick={() => onQuickAdd?.(preset)}
                            disabled={isQuickAdding || isDeleting}
                        >
                            {isQuickAdding ? "Adding..." : "Add now"}
                        </button>
                        <button
                            type="button"
                            className="quick-add-button"
                            onClick={() => onAddDetails?.(preset)}
                            disabled={isQuickAdding || isDeleting}
                        >
                            Add details
                        </button>
                    </div>
                ) : null}
            </div>
        </article>
    );
}

export default PresetCard;
