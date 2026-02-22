import { cn } from "@/lib/utils";

interface AvatarProps {
    src?: string;
    name?: string;
    className?: string;
    isGroup?: boolean;
}

export function Avatar({ src, name, className = "w-11 h-11", isGroup = false }: AvatarProps) {
    if (isGroup) {
        return (
            <div className={cn("bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/20", className)}>
                <svg className="w-1/2 h-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
            </div>
        );
    }

    if (src) {
        return (
            <div className={cn("relative rounded-2xl overflow-hidden shadow-lg shadow-zinc-500/10", className)}>
                <img src={src} alt={name} className="w-full h-full object-cover" />
            </div>
        );
    }

    const initials = name
        ? name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)
        : '?';

    return (
        <div className={cn("bg-zinc-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center text-zinc-600 dark:text-zinc-400 font-bold shadow-lg shadow-zinc-500/5", className)}>
            {initials}
        </div>
    );
}
