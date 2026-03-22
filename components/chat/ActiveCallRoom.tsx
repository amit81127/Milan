import { useEffect, useState } from "react";
import { useWebRTC } from "@/lib/hooks/useWebRTC";
import { VideoCall } from "./VideoCall";
import { useMediaStream } from "@/lib/hooks/useMediaStream";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

interface ActiveCallRoomProps {
    callId: string;
    isInitiator: boolean;
    onEndCall: () => void;
}

export function ActiveCallRoom({ callId, isInitiator, onEndCall }: ActiveCallRoomProps) {
    const updateCallStatus = useMutation(api.calls.updateCallStatus);
    const { stream: localStream, startStream, stopStream } = useMediaStream();
    const { 
        remoteStream, 
        startCall, 
        answerCall, 
        endCall,
        incomingOffer 
    } = useWebRTC({ callId });

    const [hasAnswered, setHasAnswered] = useState(isInitiator);

    // Get hardware permissions immediately
    useEffect(() => {
        startStream();
        return () => stopStream();
    }, [startStream, stopStream]);

    // If we are the person who initiated the call, generate & send the WebRTC offer
    useEffect(() => {
        if (isInitiator && localStream) {
            // Give 1 second for localStream to settle before building RTCPeerConnection
            const t = setTimeout(() => {
                startCall(localStream);
            }, 500);
            return () => clearTimeout(t);
        }
    }, [isInitiator, localStream, startCall]);

    // If we are receiving the call, auto-answer once we have localStream and the offer has arrived
    // (Assuming the user already clicked "Accept" on an IncomingCall modal to mount this component)
    useEffect(() => {
        if (!isInitiator && localStream && incomingOffer && !hasAnswered) {
            answerCall(incomingOffer, localStream);
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setHasAnswered(true);
            
            // Mark call as active in Convex
            updateCallStatus({ callId, status: "active" }).catch(console.error);
        }
    }, [isInitiator, localStream, incomingOffer, answerCall, hasAnswered, callId, updateCallStatus]);

    const handleDisconnect = () => {
        endCall();
        stopStream();
        updateCallStatus({ callId, status: "ended" }).catch(console.error);
        onEndCall();
    };

    return (
        <div className="fixed inset-0 z-[200] bg-black">
            <VideoCall 
                localStream={localStream}
                remoteStream={remoteStream}
                onEndCall={handleDisconnect}
            />
        </div>
    );
}
