import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Video, VideoOff, PhoneOff } from "lucide-react";

interface VideoCallProps {
    /** The local camera/microphone media stream bound via useWebRTC */
    localStream: MediaStream | null;
    /** The incoming remote feed from the paired peer */
    remoteStream: MediaStream | null;
    /** Triggered when the user hits the red End Call button */
    onEndCall: () => void;
}

export function VideoCall({ localStream, remoteStream, onEndCall }: VideoCallProps) {
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);

    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);

    // Bind local stream specifically to the local PIP video element
    useEffect(() => {
        if (localVideoRef.current && localStream) {
            localVideoRef.current.srcObject = localStream;
        }
    }, [localStream]);

    // Bind the remote peer's stream to the background video element
    useEffect(() => {
        if (remoteVideoRef.current && remoteStream) {
            remoteVideoRef.current.srcObject = remoteStream;
        }
    }, [remoteStream]);

    // Hardware Audio Track Control
    const toggleMic = () => {
        if (!localStream) return;
        localStream.getAudioTracks().forEach((track) => {
            track.enabled = !track.enabled; // Toggle mute hardware-wise
        });
        setIsMuted(!isMuted);
    };

    // Hardware Video Track Control
    const toggleVideo = () => {
        if (!localStream) return;
        localStream.getVideoTracks().forEach((track) => {
            track.enabled = !track.enabled; // Toggle camera hardware-wise
        });
        setIsVideoOff(!isVideoOff);
    };

    return (
        <div className="relative w-full h-full min-h-[500px] bg-zinc-950 rounded-2xl overflow-hidden shadow-2xl flex flex-col justify-center items-center border border-zinc-800">
            {/* 1. Remote Video (Main background feed) */}
            {remoteStream ? (
                <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className="absolute inset-0 w-full h-full object-cover"
                />
            ) : (
                <div className="text-zinc-500 flex flex-col items-center gap-3">
                    <div className="w-16 h-16 rounded-full bg-zinc-800 animate-pulse border-2 border-zinc-700/50" />
                    <p className="font-medium animate-pulse text-sm tracking-wide">Connecting signal...</p>
                </div>
            )}

            {/* 2. Local Video (Floating Picture-in-Picture) */}
            <div className={`absolute top-4 right-4 md:top-6 md:right-6 w-32 md:w-48 aspect-video bg-zinc-900 rounded-xl overflow-hidden border-2 border-zinc-700/80 shadow-2xl z-10 transition-transform duration-300 hover:scale-105 cursor-pointer ${!localStream ? 'hidden' : 'block'}`}>
                <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted // CRITICAL: Mute local preview to prevent echo/feedback loop
                    className={`w-full h-full object-cover ${isVideoOff ? 'hidden' : 'block'}`}
                />
                
                {/* Fallback state when the user turns off their camera */}
                {isVideoOff && (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-800 text-zinc-400">
                        <VideoOff size={24} className="mb-1" />
                        <span className="text-[10px] font-semibold tracking-widest text-zinc-500">CAMERA OFF</span>
                    </div>
                )}
            </div>

            {/* 3. Floating Controls Overlay */}
            <div className="absolute bottom-6 md:bottom-10 flex gap-4 px-6 py-4 bg-zinc-900/80 backdrop-blur-xl border border-zinc-700/50 rounded-full shadow-2xl z-20">
                <button
                    onClick={toggleMic}
                    className={`w-12 h-12 flex items-center justify-center rounded-full transition-colors duration-200 ${
                        isMuted 
                            ? "bg-red-500/10 text-red-500 hover:bg-red-500/20" 
                            : "bg-zinc-700 text-white hover:bg-zinc-600"
                    }`}
                    title="Toggle Microphone"
                >
                    {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
                </button>

                <button
                    onClick={toggleVideo}
                    className={`w-12 h-12 flex items-center justify-center rounded-full transition-colors duration-200 ${
                        isVideoOff 
                            ? "bg-red-500/10 text-red-500 hover:bg-red-500/20" 
                            : "bg-zinc-700 text-white hover:bg-zinc-600"
                    }`}
                    title="Toggle Camera"
                >
                    {isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
                </button>

                <div className="w-[1px] h-8 bg-zinc-700/80 self-center mx-1" />

                <button
                    onClick={onEndCall}
                    className="w-12 h-12 flex items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors duration-200 shadow-md shadow-red-500/20"
                    title="End Call"
                >
                    <PhoneOff size={20} />
                </button>
            </div>
        </div>
    );
}
