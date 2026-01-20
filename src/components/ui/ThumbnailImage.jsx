import { useState, useEffect } from "react";

/**
 * ThumbnailImage component with fallback support
 * Tries to load primary src, falls back to fallbackSrc on error
 */
export const ThumbnailImage = ({ src, fallbackSrc, alt, className }) => {
  const [imgSrc, setImgSrc] = useState(src || fallbackSrc);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setImgSrc(src || fallbackSrc);
    setHasError(false);
  }, [src, fallbackSrc]);

  const handleError = () => {
    if (!hasError && fallbackSrc && imgSrc !== fallbackSrc) {
      setImgSrc(fallbackSrc);
      setHasError(true);
    } else if (!hasError) {
      setHasError(true);
    }
  };

  if (hasError && (!fallbackSrc || imgSrc === fallbackSrc)) {
    return null;
  }

  return (
    <img
      src={imgSrc}
      alt={alt}
      className={className}
      onError={handleError}
    />
  );
};
