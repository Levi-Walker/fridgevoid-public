import { useEffect, useState } from "react";
import { resolveImageUrl } from "../api";

function VisualPreview({
    visualType = "emoji",
    emoji,
    imageUrl,
    className = "",
    fallbackClassName = className,
}) {
    const [hasImageError, setHasImageError] = useState(false);

    useEffect(() => {
        setHasImageError(false);
    }, [imageUrl, visualType]);

    if (visualType === "image" && imageUrl && !hasImageError) {
        return (
            <img
                className={className}
                src={resolveImageUrl(imageUrl)}
                alt=""
                onError={() => setHasImageError(true)}
            />
        );
    }

    return <span className={fallbackClassName}>{emoji || "🍽️"}</span>;
}

export default VisualPreview;
