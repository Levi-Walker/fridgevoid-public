import { useEffect, useRef, useState } from "react";
import { setModuleArgs } from "@undecaf/zbar-wasm";
import "react-barcode-scanner/polyfill";
import zbarWasmUrl from "@undecaf/zbar-wasm/dist/zbar.wasm?url";
import { normalizeScannedCode } from "../services/scannedProducts";
import "../css/FormControls.css";

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

function toErrorMessage(error) {
    if (!error) {
        return "Scanner failed to start.";
    }

    if (typeof error === "string") {
        return error;
    }

    switch (error.name) {
        case "NotAllowedError":
        case "PermissionDeniedError":
            return "Camera access was blocked.";
        case "NotFoundError":
        case "DevicesNotFoundError":
            return "No camera was found.";
        case "NotReadableError":
        case "TrackStartError":
            return "The camera is already in use.";
        case "OverconstrainedError":
        case "ConstraintNotSatisfiedError":
            return "This camera setup is not supported.";
        case "SecurityError":
            return "Camera access requires HTTPS or localhost.";
        default:
            return error.message || "Scanner failed to start.";
    }
}

function BarcodeCaptureField({
    onDetected,
    busy = false,
    busyMessage = "Looking up product...",
    resultLabel = "Latest code",
}) {
    const videoRef = useRef(null);
    const detectorRef = useRef(null);
    const cropCanvasRef = useRef(null);
    const lastSubmittedCodeRef = useRef("");
    const [paused, setPaused] = useState(false);
    const [supportedFormats, setSupportedFormats] = useState([]);
    const [statusMessage, setStatusMessage] = useState("Checking scanner support...");
    const [scannerError, setScannerError] = useState("");
    const [latestCode, setLatestCode] = useState("");

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
                    setScannerError("Camera access requires HTTPS or localhost.");
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
                    throw new Error("No supported barcode formats are available.");
                }

                if (!cancelled) {
                    detectorRef.current = new window.BarcodeDetector({ formats: nextFormats });
                    setSupportedFormats(nextFormats);
                    setScannerError("");
                    setStatusMessage("Ready to scan");
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
                    setStatusMessage("Point the camera at a barcode.");
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

                const nextResult = Array.isArray(barcodes) ? barcodes[0] : null;
                const nextCode = normalizeScannedCode(nextResult?.rawValue);

                if (nextCode && nextCode !== lastSubmittedCodeRef.current) {
                    lastSubmittedCodeRef.current = nextCode;
                    setLatestCode(nextCode);
                    setStatusMessage("Barcode detected");
                    await onDetected?.(nextCode, nextResult);
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
    }, [onDetected, paused, scannerError, supportedFormats]);

    const handleReset = () => {
        lastSubmittedCodeRef.current = "";
        setLatestCode("");
        setScannerError("");
        setStatusMessage("Ready to scan");
    };

    const displayStatus = busy ? busyMessage : scannerError || statusMessage;

    return (
        <div className="barcode-capture-panel">
            <div className="barcode-capture-actions">
                <button
                    type="button"
                    className="settings-button settings-button-primary"
                    onClick={() => setPaused((currentPaused) => !currentPaused)}
                    disabled={!supportedFormats.length && !scannerError}
                >
                    {paused ? "Resume scanner" : "Pause scanner"}
                </button>
                <button
                    type="button"
                    className="settings-button"
                    onClick={handleReset}
                >
                    Scan again
                </button>
            </div>

            <div className="barcode-capture-shell">
                <video
                    ref={videoRef}
                    className="barcode-capture-video"
                    aria-label="Barcode scanner preview"
                    playsInline
                    muted
                    autoPlay
                />

                {!supportedFormats.length || paused || scannerError ? (
                    <div className="barcode-capture-overlay">
                        <strong>{statusMessage}</strong>
                        <span>{scannerError || "The camera preview will appear here."}</span>
                    </div>
                ) : null}
            </div>

            <div className="barcode-capture-meta">
                <p className="field-hint">{displayStatus}</p>
                {latestCode ? (
                    <p className="barcode-capture-result">
                        <span>{resultLabel}</span>
                        <strong>{latestCode}</strong>
                    </p>
                ) : null}
            </div>
        </div>
    );
}

export default BarcodeCaptureField;
