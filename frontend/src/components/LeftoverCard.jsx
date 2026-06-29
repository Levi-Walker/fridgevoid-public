import "../css/LeftoverCard.css";
import { useEffect, useState } from "react";
import { LeftoversAPI } from "../api";
import { saveLeftoverNotes } from "../services/leftoverNotes";
import { getLeftoverStatus } from "../services/leftoverStatus";
import LeftoverModal from "./LeftoverModal";
import VisualPreview from "./VisualPreview";
import { useUserPreferences } from "../contexts/UserPreferencesContext.jsx";

function formatCardDate(value) {
    if (!value) {
        return "No date";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "No date";
    }

    const options = { month: "short", day: "numeric" };
    if (date.getFullYear() !== new Date().getFullYear()) {
        options.year = "numeric";
    }

    return new Intl.DateTimeFormat(undefined, options).format(date);
}

function LeftoverCard({ leftover, onUpdated, onSelect, onTagFilter, locations = [] }) {
    const { preferences } = useUserPreferences();
    const [showModal, setShowModal] = useState(false);
    const [isRemoving, setIsRemoving] = useState(false);
    const [notesModalOpen, setNotesModalOpen] = useState(false);
    const [notesDraft, setNotesDraft] = useState(leftover.notes || "");
    const [isSavingNotes, setIsSavingNotes] = useState(false);
    const [pendingRemove, setPendingRemove] = useState(false);
    const status = getLeftoverStatus(leftover);

    useEffect(() => {
        setNotesDraft(leftover.notes || "");
    }, [leftover]);

    useEffect(() => {
        if (!pendingRemove) {
            return undefined;
        }

        const timeoutId = window.setTimeout(() => setPendingRemove(false), 2800);
        return () => window.clearTimeout(timeoutId);
    }, [pendingRemove]);

    function onEditClick(event) {
        event.preventDefault();
        event.stopPropagation();
        setPendingRemove(false);
        setShowModal(true);
    }

    async function markUsedUp() {
        setIsRemoving(true);

        try {
            await LeftoversAPI.markUsedUp(leftover.id);
            window.dispatchEvent(new CustomEvent("fridgevoid:inventory-changed", {
                detail: { source: "home" },
            }));

            if (onUpdated) {
                await onUpdated();
            }
        } catch (error) {
            console.error("Failed to remove leftover", error);
        } finally {
            setIsRemoving(false);
        }
    }

    async function onUsedUpClick() {
        if (!pendingRemove) {
            setPendingRemove(true);
            return;
        }

        await markUsedUp();
    }

    async function saveNotes() {
        setIsSavingNotes(true);

        try {
            await LeftoversAPI.update(leftover.id, {
                notes: notesDraft.trim() || null,
                lastKnownUpdatedAt: leftover.updatedAt || null,
            });
            saveLeftoverNotes(leftover.id, notesDraft);
            setNotesModalOpen(false);

            if (onUpdated) {
                await onUpdated();
            }
        } catch (error) {
            console.error("Failed to save notes", error);
        } finally {
            setIsSavingNotes(false);
        }
    }

    function onCardClick() {
        if (onSelect) {
            onSelect(leftover);
        }
    }

    function onCardKeyDown(event) {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onCardClick();
        }
    }

    const statusLabel = preferences.statusLabels[status.key] || status.label;

    return (
        <>
            <div
                className={`leftover-card leftover-card-${status.cssKey}`}
                onClick={onCardClick}
                onKeyDown={onCardKeyDown}
                role="button"
                tabIndex={0}
                aria-label={`Open details for ${leftover.food}`}
            >
                <div className="leftover-image">
                    <VisualPreview
                        visualType={leftover.imageUrl ? "image" : "emoji"}
                        emoji={leftover.emoji}
                        imageUrl={leftover.imageUrl}
                        className={leftover.imageUrl ? "leftover-image-preview" : "leftover-emoji"}
                        fallbackClassName="leftover-emoji"
                    />
                    <span className={`leftover-status leftover-status-${status.cssKey}`}>{statusLabel}</span>
                    <div className="leftover-title-overlay">
                        <h3>{leftover.food}</h3>
                    </div>
                </div>
                <div className="leftover-info">
                    <dl className="leftover-meta">
                        <div>
                            <dt>Expires</dt>
                            <dd>{formatCardDate(leftover.expiration)}</dd>
                        </div>
                        <div>
                            <dt>Location</dt>
                            <dd>{leftover.location || "Fridge"}</dd>
                        </div>
                    </dl>
                    {leftover.tags?.length ? (
                        <div className="leftover-tags" aria-label={`Tags for ${leftover.food}`}>
                            {leftover.tags.map((tag) => (
                                <button
                                    key={tag}
                                    type="button"
                                    className="leftover-tag"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        onTagFilter?.(tag);
                                    }}
                                >
                                    {tag}
                                </button>
                            ))}
                        </div>
                    ) : null}
                    {leftover.container ? (
                        <div className="leftover-container-row">
                            <span className="leftover-container">{leftover.container}</span>
                        </div>
                    ) : null}
                    <div className={`leftover-card-actions ${leftover.notes ? "leftover-card-actions-three" : ""}`}>
                        {leftover.notes ? (
                            <button
                                type="button"
                                className="leftover-card-button leftover-card-button-secondary leftover-notes-button"
                                aria-label={`Open notes for ${leftover.food}`}
                                onClick={(event) => {
                                    event.stopPropagation();
                                    setNotesModalOpen(true);
                                }}
                            >
                                Notes
                            </button>
                        ) : null}
                        <button
                            className="leftover-card-button leftover-card-button-secondary"
                            onClick={onEditClick}
                            aria-label={`Edit ${leftover.food}`}
                            disabled={isRemoving}
                        >
                            Edit
                        </button>
                        <button
                            className="leftover-card-button leftover-card-button-danger"
                            onClick={(event) => {
                                event.stopPropagation();
                                onUsedUpClick();
                            }}
                            aria-label={`Mark ${leftover.food} as used up`}
                            disabled={isRemoving}
                        >
                            {isRemoving ? "Removing" : pendingRemove ? "Confirm" : "Remove"}
                        </button>
                    </div>
                </div>
            </div>

            <LeftoverModal
                open={showModal}
                leftover={leftover}
                onClose={() => setShowModal(false)}
                onUpdated={onUpdated}
                locations={locations}
            />

            {notesModalOpen ? (
                <div className="notes-dialog-backdrop" role="presentation" onClick={() => setNotesModalOpen(false)}>
                    <div
                        className="notes-dialog"
                        role="dialog"
                        aria-modal="true"
                        aria-label={`Notes for ${leftover.food}`}
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="notes-dialog-header">
                            <div>
                                <h3>Notes</h3>
                                <p>{leftover.food}</p>
                            </div>
                            <button type="button" onClick={() => setNotesModalOpen(false)} disabled={isSavingNotes}>
                                Close
                            </button>
                        </div>
                        <textarea
                            className="notes-dialog-input"
                            value={notesDraft}
                            onChange={(event) => setNotesDraft(event.target.value)}
                            autoFocus
                        />
                        <div className="notes-dialog-actions">
                            <button type="button" onClick={() => setNotesModalOpen(false)} disabled={isSavingNotes}>
                                Cancel
                            </button>
                            <button type="button" className="notes-dialog-primary" onClick={saveNotes} disabled={isSavingNotes}>
                                {isSavingNotes ? "Saving..." : "Save notes"}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

        </>
    );
}

export default LeftoverCard;
