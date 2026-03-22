import { useEffect, useRef } from "react";
import { Mic, MicOff, Video as VideoIcon, VideoOff, PhoneOff } from "lucide-react";

export interface VideoParticipant {
    /** Unique ID for the participant */
    id: string;
    /** Display name of the participant */
    name: string;
    /** The actual WebRTC media stream containing their video/audio tracks */
    stream: MediaStream | null;
    /** Used to highlight the Google-Meet style active speaker ring */
    isSpeaking: boolean;
    /** If true, the video will be locally muted to prevent audio feedback loops */
    isLocal?: boolean;
}

interface GroupVideoCallProps {
    /** Array of all connected room participants */
    participants: VideoParticipant[];
    /** State representing if local microphone is broadcasting */
    isMicOn: boolean;
    /** State representing if local camera is broadcasting */
    isVideoOn: boolean;
    /** Triggers hardware mute via your local tracking state */
    onToggleMic: () => void;
    /** Triggers hardware camera disable via your local tracking state */
    onToggleVideo: () => void;
    /** Ends the connection and leaves the room */
    onLeave: () => void;
}

export function GroupVideoCall({
    participants,
    isMicOn,
    isVideoOn,
    onToggleMic,
    onToggleVideo,
    onLeave,
}: GroupVideoCallProps) {
    /**
     * Calculates the perfect responsive grid layout based on participant count, exactly like Google Meet.
     */
    const getGridClass = (count: number) => {
        if (count === 1) return "grid-cols-1";
        if (count === 2) return "grid-cols-1 md:grid-cols-2";
        if (count <= 4) return "grid-cols-2 lg:grid-cols-2";
        if (count <= 6) return "grid-cols-2 lg:grid-cols-3";
        if (count <= 9) return "grid-cols-3 lg:grid-cols-3";
        // Maxes out at 4 columns wide before vertically scrolling
        return "grid-cols-3 lg:grid-cols-4";
    };

    return (
        <div className="relative w-full h-screen bg-zinc-950 flex flex-col items-center justify-center p-2 sm:p-4">
            {/* Dynamic Grid Container */}
            <div className={`w-full max-h-[calc(100vh-120px)] flex-1 grid gap-3 sm:gap-4 mx-auto max-w-7xl auto-rows-fr ${getGridClass(participants.length)}`}>
                {participants.map((p) => (
                    <ParticipantCard key={p.id} participant={p} />
                ))}
            </div>

            {/* Google-Meet style floating control bar */}
            <div className="absolute bottom-6 md:bottom-8 flex justify-center gap-4 bg-zinc-900/80 backdrop-blur-xl border border-zinc-700/50 rounded-full px-6 py-3 shadow-2xl z-50">
                <button
                    onClick={onToggleMic}
                    className={`w-12 h-12 flex items-center justify-center rounded-full transition-all duration-200 ${
                        !isMicOn 
                            ? "bg-red-500/10 text-red-500 hover:bg-red-500/20" 
                            : "bg-zinc-700 text-white hover:bg-zinc-600"
                    }`}
                    title="Toggle Microphone"
                >
                    {!isMicOn ? <MicOff size={20} /> : <Mic size={20} />}
                </button>

                <button
                    onClick={onToggleVideo}
                    className={`w-12 h-12 flex items-center justify-center rounded-full transition-all duration-200 ${
                        !isVideoOn 
                            ? "bg-red-500/10 text-red-500 hover:bg-red-500/20" 
                            : "bg-zinc-700 text-white hover:bg-zinc-600"
                    }`}
                    title="Toggle Camera"
                >
                    {!isVideoOn ? <VideoOff size={20} /> : <VideoIcon size={20} />}
                </button>

                <div className="w-[1px] h-8 bg-zinc-700/80 self-center mx-1 md:mx-2" />

                <button
                    onClick={onLeave}
                    className="w-12 h-12 flex items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors duration-200 shadow-md shadow-red-500/20"
                    title="Leave Call"
                >
                    <PhoneOff size={20} />
                </button>
            </div>
        </div>
    );
}

/**
 * Individual video cell for the grid layout.
 * Includes the active speaker highlighting ring and name overlays.
 */
function ParticipantCard({ participant }: { participant: VideoParticipant }) {
    const videoRef = useRef<HTMLVideoElement>(null);

    // Bind WebRTC stream to HTML video element
    useEffect(() => {
        if (videoRef.current && participant.stream) {
            videoRef.current.srcObject = participant.stream;
        }
    }, [participant.stream]);

    return (
        <div 
            className={`relative w-full h-full min-h-[150px] bg-zinc-900 rounded-2xl overflow-hidden border-[3px] transition-all duration-300 ${
                participant.isSpeaking 
                    // 💡 Critical Highlight Logic: Deep blue glowing border when actively speaking
                    ? 'border-blue-500 shadow-[0_0_40px_rgba(59,130,246,0.3)] z-10 scale-[1.02]' 
                    : 'border-zinc-800 shadow-lg'
            }`}
        >
            {/* Renders video if they have their camera enabled */}
            {participant.stream ? (
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    // CRITICAL: Mute local preview (Your own video) to prevent echo loops
                    muted={participant.isLocal} 
                    className="absolute inset-0 w-full h-full object-cover"
                />
            ) : (
                // Displays an avatar placeholder if their camera is off
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-800 text-zinc-500">
                    <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-full bg-zinc-700 flex items-center justify-center text-2xl sm:text-4xl text-white font-medium mb-4 shadow-inner">
                        {participant.name?.charAt(0)?.toUpperCase()}
                    </div>
                </div>
            )}
            
            {/* Bottom-left nametag overlay */}
            <div className="absolute bottom-3 left-3 sm:bottom-4 sm:left-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg flex items-center gap-2">
                <span className="text-white text-xs sm:text-sm font-medium tracking-wide">
                    {participant.name} {participant.isLocal && "(You)"}
                </span>
                
                {/* Shows a red crossed out camera icon if they disabled video */}
                {!participant.stream && <VideoOff size={14} className="text-red-400" />}
            </div>
        </div>
    );
}
