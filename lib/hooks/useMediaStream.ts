/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useCallback, useRef, useEffect } from "react";

interface UseMediaStreamOptions {
    video?: boolean | MediaTrackConstraints;
    audio?: boolean | MediaTrackConstraints;
}

export function useMediaStream(options: UseMediaStreamOptions = { video: true, audio: true }) {
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<Error | null>(null);

    // Keep a stable ref to the active stream for immediate cleanup
    const streamRef = useRef<MediaStream | null>(null);

    const stopStream = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
            setStream(null);
        }
    }, []);

    const startStream = useCallback(async () => {
        // Prevent executing if there's already an active active stream
        if (streamRef.current) return;

        setIsLoading(true);
        setError(null);

        try {
            // Validate browser compatibility
            if (!navigator.mediaDevices?.getUserMedia) {
                throw new Error("Your browser does not support media devices.");
            }

            // Prompt user for permissions
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: options.video ?? true,
                audio: options.audio ?? true,
            });

            // On success, save the stream to state and ref
            streamRef.current = mediaStream;
            setStream(mediaStream);
        } catch (err: any) {
            const mediaError = err instanceof Error ? err : new Error(err.message || String(err));
            setError(mediaError);
            
            // Helpful logging for permission issues
            if (mediaError.name === "NotAllowedError") {
                console.error("Camera/Microphone permission denied by the user.");
            } else if (mediaError.name === "NotFoundError") {
                console.error("No Camera or Microphone found.");
            } else {
                console.error("Error accessing media devices:", err);
            }
        } finally {
            setIsLoading(false);
        }
    }, [options.video, options.audio]);

    // Cleanup: Automatically switch off camera & mic when the component unmounts
    useEffect(() => {
        return () => {
            stopStream();
        };
    }, [stopStream]);

    return {
        stream,
        isLoading,
        error,
        startStream,
        stopStream,
    };
}
