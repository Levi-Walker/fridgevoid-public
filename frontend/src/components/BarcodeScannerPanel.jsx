import { useEffect, useRef, useState } from "react";
import { setModuleArgs } from "@undecaf/zbar-wasm";
import "react-barcode-scanner/polyfill";
import zbarWasmUrl from "@undecaf/zbar-wasm/dist/zbar.wasm?url";
import "../css/DevBarcodeScanner.css";

const REQUESTED_FORMATS = [
    "databar",
    "databar_exp",
    "code_128",
    "code_39",
    "code_93",
    "codabar",
    "ean_13",
    "ean_8",
    "itf",
    "qr_code",
    "upc_a",
    "upc_e",
];

const CAMERA_CONSTRAINTS = {
    audio: false,
    video: {
        facingMode: { ideal: "environment" },
        width: { min: 640, ideal: 1280 },
        height: { min: 480, ideal: 720 },
        advanced: [
            { width: 1920, height: 1280 },
            { aspectRatio: 1.333 },
        ],
    },
};

const SCAN_DELAY_MS = 350;

setModuleArgs({
    locateFile: () => zbarWasmUrl,
});

function formatCaptureSignature(barcodes) {
    return JSON.stringify(
        (barcodes || []).map((barcode) => ({
            rawValue: barcode.rawValue,
            format: barcode.format,
        }))
    );
}

function toErrorMessage(error) {
    if (!error) {
        return "Barcode scanner failed to start.";
    }

    if (typeof error === "string") {
        return error;
    }

    switch (error.name) {
        case "NotAllowedError":
        case "PermissionDeniedError":
            return "Camera access was blocked. Allow camera permission and reload the scanner.";
        case "NotFoundError":
        case "DevicesNotFoundError":
            return "No camera was found on this device.";
        case "NotReadableError":
        case "TrackStartError":
            return "The camera is already in use by another app or tab.";
        case "OverconstrainedError":
        case "ConstraintNotSatisfiedError":
            return "The selected camera constraints are not supported on this device.";
        case "SecurityError":
            return "Camera access requires a secure origin. Use HTTPS or localhost.";
        default:
            return error.message || "Barcode scanner failed to start.";
    }
}

function BarcodeScannerPanel() {
    const videoRef = useRef(null);
    const detectorRef = useRef(null);
    const cropCanvasRef = useRef(null);
    const lastCaptureSignatureRef = useRef("");
    const [paused, setPaused] = useState(false);
    const [latestCapture, setLatestCapture] = useState([]);
    const [scanHistory, setScanHistory] = useState([]);
    const [supportedFormats, setSupportedFormats] = useState([]);
    const [statusMessage, setStatusMessage] = useState("Checking barcode scanner support...");
    const [scannerError, setScannerError] = useState("");
    const latestResult = latestCapture[0] ?? null;

    const handleToggleScanner = () => {
        if (scannerError) {
            setScannerError("");
            setStatusMessage("Retrying scanner...");
            return;
        }

        setPaused((currentPaused) => !currentPaused);
    };

    const detectFromCenterCrop = async (videoElement, detector) => {
        const frameWidth = videoElement.videoWidth;
        const frameHeight = videoElement.videoHeight;

        if (!frameWidth || !frameHeight) {
            return [];
        }

        const canvas = cropCanvasRef.current ?? document.createElement("canvas");
        cropCanvasRef.current = canvas;

        const cropWidth = Math.round(frameWidth * 0.78);
        const cropHeight = Math.round(frameHeight * 0.42);
        const cropX = Math.round((frameWidth - cropWidth) / 2);
        const cropY = Math.round((frameHeight - cropHeight) / 2);

        canvas.width = cropWidth;
        canvas.height = cropHeight;

        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) {
            return [];
        }

        context.drawImage(
            videoElement,
            cropX,
            cropY,
            cropWidth,
            cropHeight,
            0,
            0,
            cropWidth,
            cropHeight
        );

        return detector.detect(canvas);
    };

    useEffect(() => {
        let cancelled = false;

        async function prepareScanner() {
            if (!navigator.mediaDevices?.getUserMedia) {
                if (!cancelled) {
                    setScannerError("Camera access requires a secure context in this browser. Use HTTPS, or test from localhost on the same device.");
                    setStatusMessage("Secure context required");
                }
                return;
            }

            if (typeof window.BarcodeDetector === "undefined") {
                if (!cancelled) {
                    setScannerError("Barcode detection is unavailable in this browser.");
                    setStatusMessage("Barcode detector unavailable");
                }
                return;
            }

            try {
                const detectedFormats = typeof window.BarcodeDetector.getSupportedFormats === "function"
                    ? await window.BarcodeDetector.getSupportedFormats()
                    : REQUESTED_FORMATS;
                const nextFormats = REQUESTED_FORMATS.filter((format) => detectedFormats.includes(format));

                if (!nextFormats.length) {
                    throw new Error("No supported barcode formats are available in this browser.");
                }

                if (!cancelled) {
                    detectorRef.current = new window.BarcodeDetector({ formats: nextFormats });
                    setSupportedFormats(nextFormats);
                    setScannerError("");
                    setStatusMessage("Ready to open the camera");
                }
            } catch (error) {
                if (!cancelled) {
                    setScannerError(toErrorMessage(error));
                    setStatusMessage("Scanner setup failed");
                }
            }
        }

        prepareScanner();

        return () => {
            cancelled = true;
            detectorRef.current = null;
        };
    }, []);

    useEffect(() => {
        if (paused || scannerError || !supportedFormats.length) {
            const videoElement = videoRef.current;
            const activeStream = videoElement?.srcObject;

            if (activeStream instanceof MediaStream) {
                activeStream.getTracks().forEach((track) => track.stop());
                videoElement.srcObject = null;
            }

            if (paused && !scannerError) {
                setStatusMessage("Scanner paused");
            }

            return undefined;
        }

        let cancelled = false;
        let nextStream;

        async function startCamera() {
            try {
                setStatusMessage("Requesting camera access...");
                const stream = await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS);

                if (cancelled) {
                    stream.getTracks().forEach((track) => track.stop());
                    return;
                }

                nextStream = stream;

                const videoElement = videoRef.current;
                if (!videoElement) {
                    stream.getTracks().forEach((track) => track.stop());
                    return;
                }

                videoElement.srcObject = stream;
                await videoElement.play();

                if (!cancelled) {
                    setScannerError("");
                    setStatusMessage("Camera live. Point it at a barcode or QR code.");
                }
            } catch (error) {
                if (!cancelled) {
                    setScannerError(toErrorMessage(error));
                    setStatusMessage("Camera failed to start");
                }
            }
        }

        startCamera();

        return () => {
            cancelled = true;
            nextStream?.getTracks().forEach((track) => track.stop());

            const videoElement = videoRef.current;
            const activeStream = videoElement?.srcObject;

            if (activeStream instanceof MediaStream) {
                activeStream.getTracks().forEach((track) => track.stop());
                videoElement.srcObject = null;
            }
        };
    }, [paused, scannerError, supportedFormats]);

    useEffect(() => {
        if (paused || scannerError || !supportedFormats.length) {
            return undefined;
        }

        let cancelled = false;
        let timeoutId;

        async function scanFrame() {
            const videoElement = videoRef.current;
            const detector = detectorRef.current;

            if (!videoElement || !detector || videoElement.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
                if (!cancelled) {
                    timeoutId = window.setTimeout(scanFrame, SCAN_DELAY_MS);
                }
                return;
            }

            try {
                let barcodes = await detector.detect(videoElement);

                if (!barcodes?.length) {
                    barcodes = await detectFromCenterCrop(videoElement, detector);
                }

                const nextCapture = Array.isArray(barcodes) ? barcodes : [];
                const nextSignature = formatCaptureSignature(nextCapture);

                if (nextCapture.length && nextSignature !== lastCaptureSignatureRef.current) {
                    lastCaptureSignatureRef.current = nextSignature;
                    setLatestCapture(nextCapture);
                    setScanHistory((currentHistory) => {
                        const nextEntries = nextCapture.map((barcode) => ({
                            id: `${barcode.format}-${barcode.rawValue}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                            rawValue: barcode.rawValue,
                            format: barcode.format,
                            capturedAt: new Date().toLocaleTimeString(),
                        }));

                        return [...nextEntries, ...currentHistory].slice(0, 8);
                    });
                    setStatusMessage(`Detected ${nextCapture.length} barcode${nextCapture.length === 1 ? "" : "s"}.`);
                }
            } catch (error) {
                if (!cancelled) {
                    setScannerError(`Detection failed: ${toErrorMessage(error)}`);
                    setStatusMessage("Scanning stopped");
                }
                return;
            }

            if (!cancelled) {
                timeoutId = window.setTimeout(scanFrame, SCAN_DELAY_MS);
            }
        }

        timeoutId = window.setTimeout(scanFrame, SCAN_DELAY_MS);

        return () => {
            cancelled = true;
            window.clearTimeout(timeoutId);
        };
    }, [paused, scannerError, supportedFormats]);

    const handleClear = () => {
        lastCaptureSignatureRef.current = "";
        setLatestCapture([]);
        setScanHistory([]);
    };

    return (
        <div className="dev-scanner-panel">
            <div className="dev-scanner-actions">
                <button
                    type="button"
                    className="settings-button settings-button-primary"
                    onClick={handleToggleScanner}
                    disabled={!supportedFormats.length && !scannerError}
                >
                    {scannerError ? "Retry scanner" : paused ? "Resume scanner" : "Pause scanner"}
                </button>

                <button
                    type="button"
                    className="settings-button"
                    onClick={handleClear}
                >
                    Clear results
                </button>
            </div>

            <div className="dev-scanner-layout">
                <div className="dev-scanner-frame">
                    <video
                        ref={videoRef}
                        aria-label="Barcode scanner camera preview"
                        playsInline
                        muted
                        autoPlay
                    />

                    {!supportedFormats.length || paused || scannerError ? (
                        <div className="dev-scanner-overlay">
                            <strong>{statusMessage}</strong>
                            <span>{scannerError || "The camera feed will appear here once the scanner is active."}</span>
                        </div>
                    ) : null}
                </div>

                <div className="dev-scanner-results">
                    <article className="settings-action-card">
                        <div className="settings-action-copy">
                            <h3>{latestResult ? latestResult.rawValue : "Waiting for a scan"}</h3>
                            <p>
                                {latestResult
                                    ? `Detected as ${latestResult.format}.`
                                    : statusMessage}
                            </p>
                        </div>

                        <div className="dev-scanner-result-grid" aria-label="Latest decoded barcode result">
                            <div className="dev-scanner-result-item">
                                <span>Formats</span>
                                <strong>{supportedFormats.length ? supportedFormats.join(", ") : "Checking..."}</strong>
                            </div>
                            <div className="dev-scanner-result-item">
                                <span>Status</span>
                                <strong>{scannerError || statusMessage}</strong>
                            </div>
                            <div className="dev-scanner-result-item">
                                <span>Count</span>
                                <strong>{latestCapture.length}</strong>
                            </div>
                        </div>

                        {latestResult ? (
                            <pre className="dev-scanner-pre">
                                <code>{JSON.stringify(latestCapture, null, 2)}</code>
                            </pre>
                        ) : null}
                    </article>

                    <article className="settings-action-card">
                        <div className="settings-action-copy">
                            <h3>History</h3>
                        </div>

                        {scanHistory.length ? (
                            <div className="dev-scanner-history">
                                {scanHistory.map((entry) => (
                                    <div key={entry.id} className="dev-scanner-history-item">
                                        <strong>{entry.rawValue}</strong>
                                        <span>{entry.format}</span>
                                        <time>{entry.capturedAt}</time>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="settings-card-copy">No scans recorded yet.</p>
                        )}
                    </article>
                </div>
            </div>
        </div>
    );
}

export default BarcodeScannerPanel;
