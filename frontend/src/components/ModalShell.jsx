import { createPortal } from "react-dom";
import { useEffect } from "react";
import "../css/LeftoverModal.css";

function ModalShell({ open, onClose, children }) {
    useEffect(() => {
        if (!open) {
            return undefined;
        }

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        const handleKeyDown = (event) => {
            if (event.key === "Escape") {
                onClose();
            }
        };

        window.addEventListener("keydown", handleKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [open, onClose]);

    if (!open) {
        return null;
    }

    return createPortal(
        <div className="leftover-modal-backdrop" onClick={onClose}>
            <div className="leftover-modal" onClick={(event) => event.stopPropagation()}>
                {children}
            </div>
        </div>,
        document.body
    );
}

export default ModalShell;
