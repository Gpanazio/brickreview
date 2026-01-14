import React, { useState, useEffect, useRef } from "react";

export function AutoSizer({ children, className = "", style = {} }) {
    const containerRef = useRef(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

    useEffect(() => {
        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                setDimensions({ width, height });
            }
        });

        if (containerRef.current) {
            observer.observe(containerRef.current);
        }

        return () => {
            observer.disconnect();
        };
    }, []);

    return (
        <div
            ref={containerRef}
            className={className}
            style={{ width: "100%", height: "100%", overflow: "hidden", ...style }}
        >
            {dimensions.width > 0 && dimensions.height > 0 && children(dimensions)}
        </div>
    );
}
