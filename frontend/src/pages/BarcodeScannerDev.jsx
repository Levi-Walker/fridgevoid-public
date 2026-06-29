import { Link } from "react-router-dom";
import BarcodeScannerPanel from "../components/BarcodeScannerPanel";
import "../css/Settings.css";

function BarcodeScannerDev() {
    return (
        <div className="settings-page">
            <section className="settings-hero settings-panel">
                <div>
                    <h1>Barcode scanner test</h1>
                </div>
            </section>

            <section className="settings-panel settings-card">
                <div className="settings-card-header">
                    <div>
                        <h2>Live camera preview</h2>
                        <p className="settings-subtitle">
                            Allow camera access when prompted. If your device has multiple cameras, the browser will choose the active video input.
                        </p>
                    </div>
                </div>

                <div className="dev-scanner-route-actions">
                    <Link to="/dev-tools" className="settings-button dev-scanner-back-link">
                        Back to dev tools
                    </Link>
                </div>

                <BarcodeScannerPanel />
            </section>
        </div>
    );
}

export default BarcodeScannerDev;
