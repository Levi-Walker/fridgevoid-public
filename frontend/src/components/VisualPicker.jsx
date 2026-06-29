import { useEffect, useId, useRef, useState } from "react";
import { clearDraft, loadDraft, saveDraft } from "../services/draftStorage";
import "../css/FormControls.css";
import VisualPreview from "./VisualPreview";

function VisualPicker({
    visualType,
    onVisualTypeChange,
    emoji,
    onEmojiChange,
    imageUrl,
    imageFile,
    onImageFileChange,
    draftKey = "",
}) {
    const uploadInputId = useId();
    const cameraInputId = useId();
    const [previewUrl, setPreviewUrl] = useState("");
    const [cameraOpen, setCameraOpen] = useState(false);
    const [cameraReady, setCameraReady] = useState(false);
    const [cameraError, setCameraError] = useState("");
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const restoredDraftRef = useRef(false);

    useEffect(() => {
        if (!imageFile) {
            setPreviewUrl("");
            return undefined;
        }

        const objectUrl = URL.createObjectURL(imageFile);
        setPreviewUrl(objectUrl);

        return () => {
            URL.revokeObjectURL(objectUrl);
        };
    }, [imageFile]);

    useEffect(() => {
        if (!draftKey || imageFile || restoredDraftRef.current) {
            return;
        }

        const savedImageDraft = loadDraft(`${draftKey}:image`, null);
        if (!savedImageDraft?.dataUrl || !savedImageDraft?.type) {
            restoredDraftRef.current = true;
            return;
        }

        restoredDraftRef.current = true;

        fetch(savedImageDraft.dataUrl)
            .then((response) => response.blob())
            .then((blob) => {
                const restoredFile = new File(
                    [blob],
                    savedImageDraft.name || `image-${Date.now()}.jpg`,
                    { type: savedImageDraft.type }
                );
                onImageFileChange(restoredFile);
            })
            .catch(() => {
                clearDraft(`${draftKey}:image`);
            });
    }, [draftKey, imageFile, onImageFileChange]);

    useEffect(() => {
        if (!cameraOpen) {
            setCameraReady(false);
            setCameraError("");
            return undefined;
        }

        let isCancelled = false;

        const startCamera = async () => {
            if (!navigator.mediaDevices?.getUserMedia) {
                setCameraError("Camera access is not supported in this browser.");
                return;
            }

            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: "user" },
                    audio: false,
                });

                if (isCancelled) {
                    stream.getTracks().forEach((track) => track.stop());
                    return;
                }

                streamRef.current = stream;

                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    await videoRef.current.play().catch(() => {});
                }

                setCameraReady(true);
            } catch (error) {
                console.error("Failed to access camera", error);
                setCameraError("Camera access was unavailable. You can still upload a photo.");
            }
        };

        startCamera();

        return () => {
            isCancelled = true;
            if (streamRef.current) {
                streamRef.current.getTracks().forEach((track) => track.stop());
                streamRef.current = null;
            }
        };
    }, [cameraOpen]);

    const handleFileChange = (event) => {
        const file = event.target.files?.[0];
        onImageFileChange(file || null);

        if (draftKey && file) {
            const reader = new FileReader();
            reader.onload = () => {
                saveDraft(`${draftKey}:image`, {
                    name: file.name,
                    type: file.type,
                    dataUrl: typeof reader.result === "string" ? reader.result : "",
                });
            };
            reader.readAsDataURL(file);
        }

        if (draftKey && !file) {
            clearDraft(`${draftKey}:image`);
        }

        event.target.value = "";
    };

    const isMobileDevice = () => {
        const userAgent = navigator.userAgent || navigator.vendor || "";
        return /android|iphone|ipad|ipod|mobile/i.test(userAgent);
    };

    const handleTakePhoto = (event) => {
        event.preventDefault();

        setCameraOpen(true);
    };

    const handleCapturePhoto = async () => {
        if (!videoRef.current) {
            return;
        }

        const video = videoRef.current;
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth || 1280;
        canvas.height = video.videoHeight || 720;

        const context = canvas.getContext("2d");
        if (!context) {
            setCameraError("Could not capture from camera.");
            return;
        }

        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
        if (!blob) {
            setCameraError("Could not capture from camera.");
            return;
        }

        const file = new File([blob], `camera-${Date.now()}.jpg`, { type: "image/jpeg" });
        onImageFileChange(file);
        setCameraOpen(false);
    };

    const hasExistingImage = Boolean(imageUrl) && !imageFile;
    const hasImagePreview = Boolean(previewUrl || imageUrl);

    return (
        <div className="form-block">
            <div className="form-block-header">
                <span className="form-block-label">Visual</span>
                <div className="segmented-control">
                    <button
                        type="button"
                        className={`segmented-control-option${visualType === "emoji" ? " active" : ""}`}
                        onClick={() => onVisualTypeChange("emoji")}
                    >
                        Emoji
                    </button>
                    <button
                        type="button"
                        className={`segmented-control-option${visualType === "image" ? " active" : ""}`}
                        onClick={() => onVisualTypeChange("image")}
                    >
                        Image
                    </button>
                </div>
            </div>

            <div className="visual-picker">
                <div className="visual-picker-preview">
                    {visualType === "image" && !hasImagePreview ? (
                        <div className="visual-image-placeholder" aria-hidden="true" />
                    ) : (
                        <VisualPreview
                            visualType={visualType}
                            emoji={emoji}
                            imageUrl={previewUrl || imageUrl}
                            className={visualType === "image" ? "visual-preview-image" : "visual-preview-emoji"}
                            fallbackClassName="visual-preview-emoji"
                        />
                    )}
                </div>

                <div className="visual-picker-controls">
                    {visualType === "emoji" ? (
                        <label className="modal-field">
                            <span>Emoji</span>
                            <input
                                type="text"
                                value={emoji}
                                onChange={(event) => onEmojiChange(event.target.value)}
                                placeholder="🍲"
                                maxLength={4}
                            />
                        </label>
                    ) : (
                        <div className="modal-field">
                            <span>Image picker</span>
                            <div className="image-picker">
                                <input
                                    id={uploadInputId}
                                    className="file-picker-input"
                                    type="file"
                                    accept="image/*"
                                    onChange={handleFileChange}
                                />
                                <input
                                    id={cameraInputId}
                                    className="file-picker-input"
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    onChange={handleFileChange}
                                />
                                <div className="image-picker-preview">
                                    <div className="image-picker-preview-frame">
                                        {hasImagePreview ? (
                                            <VisualPreview
                                                visualType="image"
                                                emoji={emoji}
                                                imageUrl={previewUrl || imageUrl}
                                                className="visual-preview-image"
                                                fallbackClassName="visual-preview-emoji"
                                            />
                                        ) : (
                                            <div className="visual-image-placeholder" aria-hidden="true" />
                                        )}
                                    </div>
                                    <div className="image-picker-meta">
                                        <strong className="file-picker-title">
                                            {imageFile ? "Image selected" : hasExistingImage ? "Current image" : "No image selected"}
                                        </strong>
                                        <span className="file-picker-name">
                                            {imageFile?.name || (hasExistingImage ? "Saved image" : "Upload an image or take a photo")}
                                        </span>
                                    </div>
                                </div>
                                <div className="image-picker-actions">
                                    <label
                                        htmlFor={uploadInputId}
                                        className="image-picker-button"
                                    >
                                        Upload
                                    </label>
                                    {isMobileDevice() ? (
                                        <label
                                            htmlFor={cameraInputId}
                                            className="image-picker-button"
                                        >
                                            Take photo
                                        </label>
                                    ) : (
                                        <button
                                            type="button"
                                            className="image-picker-button"
                                            onClick={handleTakePhoto}
                                        >
                                            Take photo
                                        </button>
                                    )}
                                </div>
                            </div>
                            {cameraOpen ? (
                                <div className="camera-capture-panel">
                                    {cameraError ? <p className="form-error">{cameraError}</p> : null}
                                    <div className="camera-capture-shell">
                                        <video
                                            ref={videoRef}
                                            className="camera-capture-video"
                                            autoPlay
                                            muted
                                            playsInline
                                        />
                                        {!cameraReady && !cameraError ? (
                                            <div className="camera-capture-placeholder">Starting webcam...</div>
                                        ) : null}
                                    </div>
                                    <div className="camera-capture-actions">
                                        <button
                                            type="button"
                                            className="image-picker-button image-picker-button-accent"
                                            onClick={handleCapturePhoto}
                                            disabled={!cameraReady}
                                        >
                                            Capture
                                        </button>
                                        <button
                                            type="button"
                                            className="image-picker-button"
                                            onClick={() => setCameraOpen(false)}
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            ) : null}
                            <small className="field-hint">Selecting a new image replaces the current one when you save.</small>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default VisualPicker;
