import { Phone, PhoneOff } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";

interface IncomingCallProps {
    /** The name of the user calling */
    callerName: string;
    /** The profile image URL of the user calling (optional) */
    callerAvatar?: string;
    /** Formally drops the call and removes the offer */
    onReject: () => void;
    /** Triggers the camera permissions and the WebRTC answerCall process */
    onAccept: () => void;
}

export function IncomingCall({ callerName, callerAvatar, onAccept, onReject }: IncomingCallProps) {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
            <div className="flex flex-col items-center bg-zinc-950 border border-zinc-800 rounded-3xl shadow-2xl p-8 max-w-sm w-full mx-4 animate-in zoom-in-95 duration-300">
                <p className="text-zinc-500 text-xs font-semibold tracking-[0.2em] uppercase mb-8">
                    Incoming Video Call
                </p>
                
                <div className="relative mb-8">
                    {/* Ringing ping animation behind avatar */}
                    <div className="absolute inset-0 rounded-full bg-green-500/20 animate-ping" style={{ animationDuration: '2s' }} />
                    <div className="absolute -inset-4 rounded-full border border-green-500/10 animate-pulse" />
                    
                    <Avatar 
                        src={callerAvatar} 
                        name={callerName} 
                        className="w-28 h-28 border-[3px] border-zinc-800 relative z-10 shadow-2xl bg-zinc-900" 
                    />
                </div>

                <h2 className="text-2xl font-bold text-white mb-2 text-center w-full truncate px-4">
                    {callerName}
                </h2>
                
                <p className="text-zinc-400 text-sm mb-10 text-center animate-pulse">
                    is inviting you to a video call...
                </p>

                <div className="flex w-full justify-around px-2">
                    <button
                        onClick={onReject}
                        className="flex flex-col items-center gap-3 group"
                    >
                        <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 group-hover:bg-red-500 group-hover:text-white transition-all duration-300 shadow-lg shadow-red-500/10 hover:scale-110">
                            <PhoneOff size={26} strokeWidth={2.5} />
                        </div>
                        <span className="text-[13px] font-semibold tracking-wide text-zinc-400 group-hover:text-red-400 transition-colors">
                            Decline
                        </span>
                    </button>

                    <button
                        onClick={onAccept}
                        className="flex flex-col items-center gap-3 group animate-bounce hover:animate-none"
                    >
                        <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center text-white group-hover:bg-green-600 border border-green-400/50 transition-all duration-300 shadow-xl shadow-green-500/30 hover:scale-110">
                            <Phone size={26} strokeWidth={2.5} className="fill-current" />
                        </div>
                        <span className="text-[13px] font-semibold tracking-wide text-zinc-400 group-hover:text-green-400 transition-colors">
                            Accept
                        </span>
                    </button>
                </div>
            </div>
        </div>
    );
}
