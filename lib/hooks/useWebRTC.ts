/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useRef, useCallback, useEffect } from "react";
import { useAction, useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

interface UseWebRTCProps {
    callId: string;
}

export function useWebRTC({ callId }: UseWebRTCProps) {
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

    const peerConnection = useRef<RTCPeerConnection | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const pendingIceCandidates = useRef<RTCIceCandidateInit[]>([]);
    
    // Default fallback to public STUN. Will be dynamically replaced by our secure backend Action.
    const iceServersRef = useRef<RTCConfiguration>({
        iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" },
        ],
    });
    
    // Track processed signal IDs so we do not re-process signals on React re-renders
    const processedSignals = useRef<Set<Id<"signals">>>(new Set());

    // 1. Connect natively to Convex Real-time Subscriptions & Mutations
    const currentUser = useQuery(api.users.getMe);
    const signals = useQuery(api.calls.getSignals, callId ? { callId } : "skip");
    const sendSignalMutation = useMutation(api.calls.sendSignal);
    
    // Helper to securely ask the backend for our highly-restricted, bandwidth-expensive TURN tokens.
    // They are heavily billable so they should only be requested when the PC is verified initialized.
    const fetchIceServersAction = useAction(api.turn.getIceServers);

    useEffect(() => {
        // Only run once, resolving ephemeral credentials behind the scenes immediately
        // so that the WebRTC instance initiates with 99.9% NAT traversal routing guarantees.
        fetchIceServersAction()
            .then(servers => {
                if (servers && servers.length > 0) {
                    iceServersRef.current = { iceServers: servers };
                }
            })
            .catch(console.error);
    }, [fetchIceServersAction]);

    // Securely emit signals to your convex backend
    const emitSignal = useCallback((type: "offer" | "answer" | "ice", data: any) => {
        if (!callId) return;
        sendSignalMutation({ callId, type, data }).catch((error) => {
            console.error("Failed to push WebRTC signal to Convex:", error);
        });
    }, [callId, sendSignalMutation]);

    // 2. Initialize Media and Peer Connection
    const initPeerConnection = useCallback(async (streamToUse?: MediaStream) => {
        let stream = streamToUse;
        if (!stream) {
            stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true,
            });
        }
        setLocalStream(stream);
        localStreamRef.current = stream;

        // Initialize WebRTC peering mapping natively to the highly secure Ephemeral TURN parameters
        const pc = new RTCPeerConnection(iceServersRef.current);
        peerConnection.current = pc;

        // Broadcast local stream tracks to peers
        stream.getTracks().forEach((track) => {
            pc.addTrack(track, stream);
        });

        // Upon receiving remote tracks, set remoteStream state
        pc.ontrack = (event) => {
            if (event.streams && event.streams[0]) {
                setRemoteStream(event.streams[0]);
            }
        };

        // When a new ICE candidate is discovered, push it to Convex
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                emitSignal("ice", event.candidate.toJSON());
            }
        };

        return pc;
    }, [emitSignal]);

    // Helper: Drain queued ICE candidates if they arrived before description was set
    const drainIceCandidates = useCallback(async () => {
        const pc = peerConnection.current;
        if (!pc) return;
        
        for (const candidate of pendingIceCandidates.current) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
        pendingIceCandidates.current = [];
    }, []);

    // 3. Initiate Call (Caller Trigger)
    const startCall = useCallback(async (streamToUse?: MediaStream) => {
        const pc = await initPeerConnection(streamToUse);

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        emitSignal("offer", offer);
    }, [initPeerConnection, emitSignal]);

    // 4. Answer Call (Callee Trigger)
    const answerCall = useCallback(
        async (offerData: RTCSessionDescriptionInit, streamToUse?: MediaStream) => {
            const pc = await initPeerConnection(streamToUse);

            await pc.setRemoteDescription(new RTCSessionDescription(offerData));
            await drainIceCandidates();

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            emitSignal("answer", answer);
        },
        [initPeerConnection, drainIceCandidates, emitSignal]
    );

    // 5. Cleanup Resources
    const endCall = useCallback(() => {
        if (peerConnection.current) {
            peerConnection.current.close();
            peerConnection.current = null;
        }

        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((track) => track.stop());
            localStreamRef.current = null;
            setLocalStream(null);
        }

        setRemoteStream(null);
        pendingIceCandidates.current = [];
        processedSignals.current.clear();
    }, []);

    // 6. Automatically process incoming signals using Convex reactivity
    useEffect(() => {
        if (!signals || !currentUser) return;

        const processIncomingSignals = async () => {
            for (const signal of signals) {
                // Prevent echoing: Don't process our own signals or ones we already handled
                if (signal.senderId === currentUser._id || processedSignals.current.has(signal._id)) {
                    continue;
                }

                processedSignals.current.add(signal._id);

                try {
                    // Automatically resolve Answers
                    if (signal.type === "answer") {
                        const pc = peerConnection.current;
                        if (!pc) continue;

                        await pc.setRemoteDescription(new RTCSessionDescription(signal.data));
                        await drainIceCandidates();
                    } 
                    // Automatically add ICE Candidates
                    else if (signal.type === "ice") {
                        const pc = peerConnection.current;
                        if (pc && pc.remoteDescription) {
                            await pc.addIceCandidate(new RTCIceCandidate(signal.data));
                        } else {
                            // Queue ICE candidate if remote description isn't set yet
                            pendingIceCandidates.current.push(signal.data);
                        }
                    }
                } catch (err) {
                    console.error("Error applying incoming WebRTC signal:", err);
                }
            }
        };

        processIncomingSignals();
    }, [signals, currentUser, drainIceCandidates]);

    // Run cleanup automatically if component unmounts
    useEffect(() => {
        return () => endCall();
    }, [endCall]);

    // Grab the incoming offer object (if it exists) to trigger `answerCall(incomingOffer)` from UI
    const incomingOffer = signals?.find(
        (s: any) => s.type === "offer" && currentUser && s.senderId !== currentUser._id
    )?.data;

    return {
        localStream,
        remoteStream,
        startCall,
        answerCall,
        endCall,
        incomingOffer,
    };
}
