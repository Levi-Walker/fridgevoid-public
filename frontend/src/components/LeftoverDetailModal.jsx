import { useEffect, useState } from "react";
import { LeftoversAPI } from "../api";
import { saveLeftoverNotes } from "../services/leftoverNotes";
import { getLeftoverStatus } from "../services/leftoverStatus";
import ModalShell from "./ModalShell";
import LeftoverModal from "./LeftoverModal";
import VisualPreview from "./VisualPreview";
import { useUserPreferences } from "../contexts/UserPreferencesContext.jsx";
import "../css/LeftoverDetail.css";

function formatDate(value) {
    if (!value) {
        return "No date";
    }

    return new Date(value).toLocaleDateString();
}

function LeftoverDetailModal({ open, leftover, onClose, onUpdated, locations = [] }) {
    const { preferences } = useUserPreferences();
    const [showEditModal, setShowEditModal] = useState(false);
    const [isRemoving, setIsRemoving] = useState(false);
    const [isEditingNotes, setIsEditingNotes] = useState(false);
    const [isSavingNotes, setIsSavingNotes] = useState(false);
    const [notesDraft, setNotesDraft] = useState("");
    const [pendingRemove, setPendingRemove] = useState(false);

    useEffect(() => {
        setNotesDraft(leftover?.notes || "");
        setIsEditingNotes(false);
        setPendingRemove(false);
    }, [leftover]);

    useEffect(() => {
        if (!pendingRemove) {
            return undefined;
        }

        const timeoutId = window.setTimeout(() => setPendingRemove(false), 2800);
        return () => window.clearTimeout(timeoutId);
    }, [pendingRemove]);

    if (!leftover) {
        return null;
    }

    const status = getLeftoverStatus(leftover);
    const statusLabel = preferences.statusLabels[status.key] || status.label;

    const handleUsedUp = async () => {
        if (!pendingRemove) {
            setPendingRemove(true);
            return;
        }

        setIsRemoving(true);

        try {
            await LeftoversAPI.markUsedUp(leftover.id);
            window.dispatchEvent(new CustomEvent("fridgevoid:inventory-changed", {
                detail: { source: "home" },
            }));
            onClose();

            if (onUpdated) {
                await onUpdated();
            }
        } catch (error) {
            console.error("Failed to remove leftover", error);
        } finally {
            setIsRemoving(false);
        }
    };

    const handleUpdated = async () => {
        setShowEditModal(false);

        if (onUpdated) {
            await onUpdated();
        }

        onClose();
    };

    const handleSaveNotes = async () => {
        setIsSavingNotes(true);

        try {
            await LeftoversAPI.update(leftover.id, {
                notes: notesDraft.trim() || null,
                lastKnownUpdatedAt: leftover.updatedAt || null,
            });
            saveLeftoverNotes(leftover.id, notesDraft);
            setIsEditingNotes(false);

            if (onUpdated) {
                await onUpdated();
            }
        } catch (error) {
            console.error("Failed to update notes", error);
        } finally {
            setIsSavingNotes(false);
        }
    };

    return (
        <>
            <ModalShell open={open} onClose={isRemoving || isSavingNotes ? () => {} : onClose}>
                <button
                    type="button"
                    className="leftover-modal-close"
                    onClick={onClose}
                    disabled={isRemoving || isSavingNotes}
                >
                    Close
                </button>

                <div className="leftover-detail">
                    <div className="leftover-detail-hero">
                        <div className="leftover-detail-visual">
                            <VisualPreview
                                visualType={leftover.imageUrl ? "image" : "emoji"}
                                emoji={leftover.emoji}
                                imageUrl={leftover.imageUrl}
                                className={leftover.imageUrl ? "leftover-detail-image" : "leftover-detail-emoji"}
                                fallbackClassName="leftover-detail-emoji"
                            />
                        </div>

                        <div className="leftover-detail-heading">
                            <div className="leftover-detail-title-row">
                                <h2>{leftover.food}</h2>
                                <span className={`leftover-detail-status leftover-detail-status-${status.cssKey}`}>{statusLabel}</span>
                            </div>
                        </div>
                    </div>

                    <div className="leftover-detail-grid">
                        <section className="leftover-detail-section">
                            <h3>Details</h3>
                            <dl className="leftover-detail-list">
                                <div>
                                    <dt>Expiration</dt>
                                    <dd>{formatDate(leftover.expiration)}</dd>
                                </div>
                                <div>
                                    <dt>Container</dt>
                                    <dd>{leftover.container || "Not set"}</dd>
                                </div>
                                <div>
                                    <dt>Location</dt>
                                    <dd>{leftover.location || "Fridge"}</dd>
                                </div>
                            </dl>
                        </section>

                        <section className="leftover-detail-section">
                            <h3>Tags</h3>
                            {leftover.tags?.length ? (
                                <div className="leftover-detail-tags">
                                    {leftover.tags.map((tag) => (
                                        <span key={tag} className="leftover-detail-tag">{tag}</span>
                                    ))}
                                </div>
                            ) : (
                                <p className="leftover-detail-empty">No tags added.</p>
                            )}
                        </section>
                    </div>

                    {leftover.notes || isEditingNotes ? (
                        <section className="leftover-detail-section leftover-detail-notes">
                            <div className="leftover-detail-notes-header">
                                <h3>Notes</h3>
                                {isEditingNotes ? (
                                    <div className="leftover-detail-note-actions">
                                        <button
                                            type="button"
                                            className="leftover-detail-note-button"
                                            onClick={() => {
                                                setNotesDraft(leftover.notes || "");
                                                setIsEditingNotes(false);
                                            }}
                                            disabled={isSavingNotes}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            className="leftover-detail-note-button leftover-detail-note-button-primary"
                                            onClick={handleSaveNotes}
                                            disabled={isSavingNotes}
                                        >
                                            {isSavingNotes ? "Saving..." : "Save notes"}
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        className="leftover-detail-note-button"
                                        onClick={() => setIsEditingNotes(true)}
                                        disabled={isRemoving}
                                    >
                                        Edit notes
                                    </button>
                                )}
                            </div>
                            {isEditingNotes ? (
                                <textarea
                                    className="leftover-detail-notes-input"
                                    value={notesDraft}
                                    onChange={(event) => setNotesDraft(event.target.value)}
                                    placeholder="Add a note for reheating, ingredients, or what to use first."
                                    rows={4}
                                    disabled={isSavingNotes}
                                />
                            ) : (
                                <p className="leftover-detail-notes-text">{leftover.notes}</p>
                            )}
                        </section>
                    ) : (
                        <button
                            type="button"
                            className="leftover-detail-add-notes"
                            onClick={() => setIsEditingNotes(true)}
                            disabled={isRemoving}
                        >
                            Add notes
                        </button>
                    )}

                    <div className="leftover-detail-actions">
                        <button
                            type="button"
                            className="leftover-modal-primary"
                            onClick={() => setShowEditModal(true)}
                            disabled={isRemoving}
                        >
                            Edit leftover
                        </button>
                        <button
                            type="button"
                            className="leftover-modal-secondary"
                            onClick={onClose}
                            disabled={isRemoving}
                        >
                            Back to list
                        </button>
                        <button
                            type="button"
                            className="leftover-modal-danger leftover-detail-danger-action"
                            onClick={handleUsedUp}
                            disabled={isRemoving}
                        >
                            {isRemoving ? "Removing..." : pendingRemove ? "Confirm" : "Used up"}
                        </button>
                    </div>
                </div>
            </ModalShell>

            <LeftoverModal
                open={showEditModal}
                leftover={leftover}
                onClose={() => setShowEditModal(false)}
                onUpdated={handleUpdated}
                locations={locations}
            />
        </>
    );
}

export default LeftoverDetailModal;
