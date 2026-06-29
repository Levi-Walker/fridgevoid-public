import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LeftoversAPI } from "../api";
import BarcodeScannerPanel from "../components/BarcodeScannerPanel";
import { clearAllLeftoverNotes } from "../services/leftoverNotes";
import { clearAllLeftoverVisuals } from "../services/leftoverVisuals";
import "../css/Settings.css";
import "../css/DevBarcodeScanner.css";

function DevTools() {
    const [busyAction, setBusyAction] = useState("");
    const [statusMessage, setStatusMessage] = useState("");
    const [statusTone, setStatusTone] = useState("idle");
    const [pendingClear, setPendingClear] = useState(false);
    const [scannerOpen, setScannerOpen] = useState(false);

    const setStatus = (tone, message) => {
        setStatusTone(tone);
        setStatusMessage(message);
    };

    useEffect(() => {
        if (!pendingClear) {
            return undefined;
        }

        const timeoutId = window.setTimeout(() => setPendingClear(false), 3200);
        return () => window.clearTimeout(timeoutId);
    }, [pendingClear]);

    const handlePopulate = async () => {
        setBusyAction("populate");
        setStatus("idle", "");

        try {
            const response = await LeftoversAPI.populate();
            const insertedCount = response?.insertedCount;
            setStatus(
                "success",
                insertedCount
                    ? `Sample data added. ${insertedCount} entries inserted.`
                    : "Sample data added."
            );
            window.dispatchEvent(new Event("fridgevoid:inventory-changed"));
        } catch (error) {
            console.error("Failed to populate leftovers", error);
            setStatus("error", "Sample data could not be added.");
        } finally {
            setBusyAction("");
        }
    };

    const handleClear = async () => {
        if (!pendingClear) {
            setPendingClear(true);
            return;
        }

        setBusyAction("clear");
        setStatus("idle", "");

        try {
            await LeftoversAPI.clear();
            clearAllLeftoverNotes();
            clearAllLeftoverVisuals();
            setPendingClear(false);
            setStatus("success", "All leftover entries were cleared.");
            window.dispatchEvent(new Event("fridgevoid:inventory-changed"));
        } catch (error) {
            console.error("Failed to clear leftovers", error);
            setStatus("error", "Entries could not be cleared.");
        } finally {
            setBusyAction("");
        }
    };

    return (
        <div className="settings-page">
            <section className="settings-hero settings-panel">
                <div>
                    <h1>Dev tools</h1>
                </div>
            </section>

            <section className="settings-panel settings-card">
                <div className="settings-card-header">
                    <div>
                        <h2>Populate or reset</h2>
                    </div>
                </div>

                <div className="settings-action-stack">
                    <article className="settings-action-card">
                        <div className="settings-action-copy">
                            <h3>Populate 100 sample items</h3>
                            <p>Add demo leftovers across expired, expiring, use-soon, and fresh statuses.</p>
                        </div>

                        <button
                            type="button"
                            className="settings-button settings-button-primary"
                            onClick={handlePopulate}
                            disabled={busyAction !== ""}
                        >
                            {busyAction === "populate" ? "Adding sample data..." : "Populate"}
                        </button>
                    </article>

                    <article className="settings-action-card settings-action-card-danger">
                        <div className="settings-action-copy">
                            <h3>Clear all entries</h3>
                            <p>Clears backend leftovers. Frontend note and visual caches are also cleared.</p>
                        </div>

                        <button
                            type="button"
                            className="settings-button settings-button-danger"
                            onClick={handleClear}
                            disabled={busyAction !== ""}
                        >
                            {busyAction === "clear" ? "Clearing entries..." : pendingClear ? "Confirm clear all" : "Clear all entries"}
                        </button>
                    </article>
                </div>
            </section>

            <section className="settings-panel settings-card">
                <div className="settings-card-header">
                    <div>
                        <h2>Barcode scanner route</h2>
                    </div>
                </div>

                <article className="settings-action-card">
                    <div className="settings-action-copy">
                        <h3>Toggle scanner test card</h3>
                    </div>

                    <div className="dev-scanner-dev-actions">
                        <button
                            type="button"
                            className="settings-button settings-button-primary"
                            onClick={() => setScannerOpen((currentOpen) => !currentOpen)}
                        >
                            {scannerOpen ? "Hide scanner card" : "Show scanner card"}
                        </button>

                        <Link to="/dev-tools/barcode-scanner" className="settings-button">
                            Open dedicated route
                        </Link>
                    </div>
                </article>

                {scannerOpen ? <BarcodeScannerPanel /> : null}
            </section>

            {statusMessage ? (
                <section className={`settings-status settings-status-${statusTone}`}>
                    <p>{statusMessage}</p>
                </section>
            ) : null}
        </div>
    );
}

export default DevTools;
