import DatePicker from "react-datepicker";
import "../css/FormControls.css";
import "react-datepicker/dist/react-datepicker.css";
import { formatResolvedExpiration } from "../utils/expiration";

function ExpirationInput({
    expirationMode,
    onExpirationModeChange,
    absoluteDate,
    onAbsoluteDateChange,
    relativeAmount,
    onRelativeAmountChange,
    resolvedExpirationDate,
    errorMessage,
}) {
    return (
        <div className="form-block">
            <div className="form-block-header">
                <span className="form-block-label">Expiration</span>
                <div className="segmented-control">
                    <button
                        type="button"
                        className={`segmented-control-option${expirationMode === "relative" ? " active" : ""}`}
                        onClick={() => onExpirationModeChange("relative")}
                    >
                        Relative
                    </button>
                    <button
                        type="button"
                        className={`segmented-control-option${expirationMode === "absolute" ? " active" : ""}`}
                        onClick={() => onExpirationModeChange("absolute")}
                    >
                        Calendar date
                    </button>
                </div>
            </div>

            {expirationMode === "relative" ? (
                <div className="relative-expiration-row">
                    <label className="modal-field">
                        <span>Shelf life in days</span>
                        <input
                            type="number"
                            min="1"
                            value={relativeAmount}
                            onChange={(event) => onRelativeAmountChange(event.target.value)}
                            placeholder="5"
                        />
                    </label>
                </div>
            ) : (
                <label className="modal-field">
                    <span>Date</span>
                    <DatePicker
                        selected={absoluteDate}
                        onChange={onAbsoluteDateChange}
                        dateFormat="yyyy-MM-dd"
                        showMonthDropdown
                        showYearDropdown
                        dropdownMode="select"
                        scrollableYearDropdown
                        yearDropdownItemNumber={60}
                        minDate={new Date()}
                        placeholderText="Select expiration date"
                    />
                </label>
            )}

            <p className="resolved-expiration">Saved as: {formatResolvedExpiration(resolvedExpirationDate)}</p>
            {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
        </div>
    );
}

export default ExpirationInput;
