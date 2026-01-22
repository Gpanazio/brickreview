import { useState, useRef, useEffect, useCallback } from "react";

export function useVideoComparison({
    isComparing,
    videoUrl,
    isGuest,
    shareToken,
    sharePassword,
    token,
    quality,
    allVersions,
    currentVideoId,
    currentTime,
    playerRef
}) {
    const [compareVersionId, setCompareVersionId] = useState(null);
    const [compareVideoUrl, setCompareVideoUrl] = useState(null);

    const comparisonControllerRef = useRef(null);
    const compareSyncKeyRef = useRef(null);

    const compareOptions = allVersions.filter((version) => version.id !== currentVideoId);

    // Initialize comparison version
    useEffect(() => {
        if (!isComparing) return;
        if (compareVersionId && compareOptions.some((version) => version.id === compareVersionId))
            return;
        setCompareVersionId(compareOptions[0]?.id ?? null);
    }, [compareOptions, compareVersionId, isComparing]);

    // Fetch comparison URL
    useEffect(() => {
        if (!isComparing || !compareVersionId) {
            setCompareVideoUrl(null);
            return;
        }

        const fetchCompareStreamUrl = async () => {
            try {
                const endpoint = isGuest
                    ? `/api/shares/${shareToken}/video/${compareVersionId}/stream?quality=${quality}`
                    : `/api/videos/${compareVersionId}/stream?quality=${quality}`;

                const headers = isGuest
                    ? sharePassword
                        ? { "x-share-password": sharePassword }
                        : {}
                    : {};

                const response = await fetch(endpoint, { headers });
                if (response.ok) {
                    const data = await response.json();
                    if (data.url) {
                        setCompareVideoUrl(data.url);
                    }
                }
            } catch (error) {
                console.error("Erro ao buscar stream da versão comparada:", error);
            }
        };

        fetchCompareStreamUrl();
    }, [
        compareVersionId,
        isComparing,
        isGuest,
        quality,
        sharePassword,
        shareToken,
        token
    ]);

    // Sync logic
    useEffect(() => {
        if (!isComparing || !comparisonControllerRef.current || !videoUrl || !compareVideoUrl) return;
        const syncKey = `${videoUrl}|${compareVideoUrl}`;
        if (compareSyncKeyRef.current === syncKey) return;
        compareSyncKeyRef.current = syncKey;
        if (currentTime > 0) {
            comparisonControllerRef.current.currentTime = currentTime;
        }
    }, [compareVideoUrl, currentTime, isComparing, videoUrl]);

    const handleComparisonControllerReady = useCallback(
        (controller) => {
            comparisonControllerRef.current = controller;
            playerRef.current = controller ? { plyr: controller } : null;
        },
        [playerRef]
    );

    return {
        compareVersionId,
        setCompareVersionId,
        compareVideoUrl,
        compareOptions,
        handleComparisonControllerReady
    };
}
