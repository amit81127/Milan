"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState, useEffect, useRef, Suspense } from "react";
import { useUser, SignOutButton } from "@clerk/nextjs";
import { Id } from "../../convex/_generated/dataModel";
import { useRouter, useSearchParams } from "next/navigation";

// --- Helper Functions ---
const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();

    const isToday = date.toDateString() === now.toDateString();
    if (isToday) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const isThisYear = date.getFullYear() === now.getFullYear();
    if (isThisYear) {
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }

    return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
};

const Avatar = ({ src, name, className = "w-11 h-11", isGroup = false }: { src?: string; name?: string; className?: string; isGroup?: boolean }) => {
    const initials = name ? name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : "?";

    if (isGroup) {
        return (
            <div className={`${className} bg-zinc-900 dark:bg-zinc-50 rounded-full flex items-center justify-center shadow-inner shrink-0 border-2 border-white dark:border-zinc-900`}>
                <span className="text-white dark:text-zinc-900 text-[10px] font-bold">GRP</span>
            </div>
        );
    }

    if (!src) {
        return (
            <div className={`${className} bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900 rounded-full flex items-center justify-center shadow-inner shrink-0 text-zinc-500 dark:text-zinc-400 font-bold text-xs border-2 border-white dark:border-zinc-900`}>
                {initials}
            </div>
        );
    }

    return (
        <img
            src={src}
            className={`${className} rounded-full object-cover shrink-0 border-2 border-white dark:border-zinc-900`}
            alt={name || "User"}
        />
    );
};

// --- Main Chat Content Component ---
function ChatContent() {
    const { user: clerkUser, isLoaded } = useUser();
    const router = useRouter();
    const searchParams = useSearchParams();

    // Sync selected conversation with URL
    const urlConversationId = searchParams.get("id") as Id<"conversations"> | null;
    const [selectedConversationId, setSelectedConversationId] = useState<Id<"conversations"> | null>(urlConversationId);

    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
    const [newMessageText, setNewMessageText] = useState("");
    const [isCreatingGroup, setIsCreatingGroup] = useState(false);
    const [selectedUserIds, setSelectedUserIds] = useState<Id<"users">[]>([]);
    const [groupName, setGroupName] = useState("");
    const [failedMessages, setFailedMessages] = useState<{ body: string; id: string }[]>([]);
    const [isEditingGroupName, setIsEditingGroupName] = useState(false);
    const [tempGroupName, setTempGroupName] = useState("");

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isTypingRef = useRef(false);
    const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

    // Convex queries & mutations
    const conversations = useQuery(api.conversations.list);
    const allUsers = useQuery(api.users.list, { search: debouncedSearchTerm });
    const messages = useQuery(api.messages.list, selectedConversationId ? { conversationId: selectedConversationId } : "skip");
    const presenceList = useQuery(api.presence.list);
    const typingUsers = useQuery(api.typing.list, selectedConversationId ? { conversationId: selectedConversationId } : "skip");
    const currentUser = useQuery(api.users.getMe);
    const selectedConversation = conversations?.find((c: any) => c?._id === selectedConversationId);

    const sendMessage = useMutation(api.messages.send);
    const deleteMessage = useMutation(api.messages.remove);
    const toggleReaction = useMutation(api.reactions.toggle);
    const storeUser = useMutation(api.users.store);
    const createConversation = useMutation(api.conversations.create);
    const updatePresence = useMutation(api.users.setOnline);
    const setOffline = useMutation(api.users.setOffline);
    const markAsRead = useMutation(api.conversations.markRead);
    const setTyping = useMutation(api.typing.update);
    const removeTyping = useMutation(api.typing.remove);
    const updateMessage = useMutation(api.messages.update);
    const updateGroupName = useMutation(api.conversations.updateName);

    // Update URL when selection changes
    useEffect(() => {
        if (selectedConversationId) {
            router.push(`/chat?id=${selectedConversationId}`);
        } else {
            router.push('/chat');
        }
    }, [selectedConversationId, router]);

    // Update state when URL changes (back button support)
    useEffect(() => {
        if (urlConversationId && urlConversationId !== selectedConversationId) {
            setSelectedConversationId(urlConversationId);
        }
    }, [urlConversationId]);

    // Sync user to Convex on load
    useEffect(() => {
        if (isLoaded && clerkUser) {
            storeUser();
        }
    }, [isLoaded, clerkUser, storeUser]);

    // Presence update interval & unload handler
    useEffect(() => {
        if (!clerkUser) return;

        // Mark online initially
        updatePresence();

        const interval = setInterval(() => {
            updatePresence();
        }, 30000); // Heartbeat every 30s

        const handleUnload = () => {
            setOffline();
        };

        window.addEventListener("beforeunload", handleUnload);

        return () => {
            clearInterval(interval);
            window.removeEventListener("beforeunload", handleUnload);
            setOffline();
        };
    }, [clerkUser, updatePresence, setOffline]);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Mark as read when conversation is selected or new messages arrive
    useEffect(() => {
        if (selectedConversationId && messages && selectedConversation?.unreadCount && selectedConversation.unreadCount > 0) {
            markAsRead({ conversationId: selectedConversationId });
        }
    }, [selectedConversationId, messages, markAsRead, selectedConversation?.unreadCount]);

    // Smart Auto-scroll logic
    useEffect(() => {
        if (shouldAutoScroll) {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, typingUsers, shouldAutoScroll]);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
        setShouldAutoScroll(isAtBottom);
    };

    const handleStartConversation = async (userId: Id<"users">) => {
        const id = await createConversation({
            participantIds: [userId],
            isGroup: false
        });
        setSelectedConversationId(id);
        setSearchTerm("");
    };

    const handleCreateGroup = async () => {
        if (selectedUserIds.length < 1) return;
        const id = await createConversation({
            participantIds: selectedUserIds,
            isGroup: true,
            name: groupName || "New Group"
        });
        setSelectedConversationId(id);
        setIsCreatingGroup(false);
        setGroupName("");
        setSelectedUserIds([]);
    };

    const toggleUserSelection = (userId: Id<"users">) => {
        setSelectedUserIds(prev =>
            prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
        );
    };

    const lastTypingTimeRef = useRef<number>(0);
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setNewMessageText(value);

        if (selectedConversationId) {
            const now = Date.now();
            // Send typing indication if we haven't sent one recently (every 3 seconds)
            if (value.trim().length > 0 && (!isTypingRef.current || now - lastTypingTimeRef.current > 3000)) {
                isTypingRef.current = true;
                lastTypingTimeRef.current = now;
                setTyping({ conversationId: selectedConversationId });
            }

            // If input is cleared, remove typing immediately
            if (value.trim().length === 0 && isTypingRef.current) {
                if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                removeTyping({ conversationId: selectedConversationId });
                isTypingRef.current = false;
            } else {
                // Otherwise, set a timeout to stop typing after 3 seconds of inactivity
                if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                typingTimeoutRef.current = setTimeout(() => {
                    if (isTypingRef.current) {
                        removeTyping({ conversationId: selectedConversationId });
                        isTypingRef.current = false;
                    }
                }, 3000);
            }
        }
    };

    const [editingMessage, setEditingMessage] = useState<any>(null);
    const [replyingTo, setReplyingTo] = useState<any>(null);

    const handleSendMessage = async (event: React.FormEvent, customText?: string) => {
        if (event) event.preventDefault();
        const text = customText || newMessageText.trim();
        if (!text || !selectedConversationId) return;

        try {
            if (editingMessage) {
                const msgId = editingMessage._id;
                setEditingMessage(null);
                setNewMessageText("");
                await updateMessage({ id: msgId, body: text });
            } else {
                if (!customText) setNewMessageText(""); // Pessimistic clear
                const replyId = replyingTo?._id;
                setReplyingTo(null);

                // Immediately clear typing state locally and on backend
                if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                isTypingRef.current = false;
                removeTyping({ conversationId: selectedConversationId });

                await sendMessage({
                    body: text,
                    conversationId: selectedConversationId,
                    replyTo: replyId,
                });
            }
            setShouldAutoScroll(true); // Jump to bottom on my own message

            // If it was a retry, remove from failed messages
            if (customText) {
                setFailedMessages(prev => prev.filter(m => m.body !== customText));
            }
        } catch (error) {
            console.error("Failed to send message:", error);
            if (!customText) {
                setNewMessageText(text); // Restore on error
                // Add to failed messages for retry
                const tempId = Math.random().toString(36).substring(7);
                setFailedMessages(prev => [...prev, { body: text, id: tempId }]);
            }
        }
    }

    const retryMessage = (text: string, id: string) => {
        setFailedMessages(prev => prev.filter(m => m.id !== id));
        handleSendMessage(undefined as any, text);
    };

    const isUserOnline = (user: any) => {
        if (!user) return false;
        return user.isOnline === true;
    };

    const otherTypingUsers = typingUsers?.filter((t: any) => t.userId !== currentUser?._id);
    const isLoading = conversations === undefined || allUsers === undefined;

    return (
        <div className="flex h-screen bg-zinc-50 dark:bg-zinc-950 overflow-hidden font-sans">
            {/* Sidebar */}
            <aside className={`w-full md:w-80 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col shrink-0 transition-all duration-300 ${selectedConversationId ? "hidden md:flex" : "flex"}`}>
                <header className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-white dark:bg-zinc-900 z-10 shrink-0">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-zinc-900 dark:bg-zinc-50 rounded-lg flex items-center justify-center shadow-lg shadow-zinc-500/10">
                            <svg className="w-5 h-5 text-white dark:text-zinc-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                            </svg>
                        </div>
                        <h1 className="font-bold text-lg dark:text-zinc-50 tracking-tight">Milan</h1>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setIsCreatingGroup(!isCreatingGroup)}
                            className={`p-2 rounded-full transition-colors ${isCreatingGroup ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white" : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                        </button>
                        <SignOutButton>
                            <button className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors group">
                                <svg className="w-5 h-5 text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-zinc-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                </svg>
                            </button>
                        </SignOutButton>
                    </div>
                </header>

                <div className="p-4 shrink-0">
                    {isCreatingGroup ? (
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                            <input
                                type="text"
                                placeholder="Group Name"
                                value={groupName}
                                onChange={(e) => setGroupName(e.target.value)}
                                className="w-full bg-zinc-100 dark:bg-zinc-800 border-none rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 transition-all font-medium"
                            />
                            <button
                                onClick={handleCreateGroup}
                                disabled={selectedUserIds.length < 1}
                                className="w-full bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 py-2 rounded-xl text-sm font-bold disabled:opacity-50 transition-all active:scale-95"
                            >
                                Create Group ({selectedUserIds.length})
                            </button>
                        </div>
                    ) : (
                        <div className="relative group">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </span>
                            <input
                                type="text"
                                placeholder="Search messages or people..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-zinc-100 dark:bg-zinc-800 border-none rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 transition-all"
                            />
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {isLoading ? (
                        <div className="p-4 space-y-4">
                            {[1, 2, 3, 4, 5].map(i => (
                                <div key={i} className="flex gap-3 animate-pulse">
                                    <div className="w-11 h-11 bg-zinc-100 dark:bg-zinc-800 rounded-full"></div>
                                    <div className="flex-1 space-y-2 py-1">
                                        <div className="h-3 bg-zinc-100 dark:bg-zinc-800 rounded w-1/3"></div>
                                        <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded w-1/2"></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (searchTerm || isCreatingGroup) ? (
                        <div className="px-2 pb-4">
                            <h2 className="text-[11px] uppercase tracking-[0.1em] text-zinc-400 font-bold px-3 mb-3">
                                {isCreatingGroup ? "Select Members" : "People"}
                            </h2>
                            {allUsers?.length === 0 ? (
                                <div className="p-8 text-center text-zinc-400 text-sm">No users found</div>
                            ) : (
                                allUsers?.map((user: any) => (
                                    <button
                                        key={user._id}
                                        onClick={() => isCreatingGroup ? toggleUserSelection(user._id) : handleStartConversation(user._id)}
                                        className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left group mb-1 ${isCreatingGroup && selectedUserIds.includes(user._id)
                                            ? "bg-zinc-100 dark:bg-zinc-800 ring-1 ring-zinc-200 dark:ring-zinc-700"
                                            : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                            }`}
                                    >
                                        <div className="relative shrink-0">
                                            <Avatar src={user.image} name={user.name} />
                                            {isUserOnline(user) && (
                                                <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-zinc-900 rounded-full"></span>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-semibold text-sm dark:text-zinc-200">{user.name}</div>
                                            <div className="text-xs text-zinc-500 truncate">{user.email}</div>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    ) : (
                        <div className="px-2 pb-4">
                            <h2 className="text-[11px] uppercase tracking-[0.1em] text-zinc-400 font-bold px-3 mb-3">Recents</h2>
                            {conversations?.length === 0 ? (
                                <div className="p-12 text-center">
                                    <p className="text-sm text-zinc-400">No chats yet. Start a new one!</p>
                                </div>
                            ) : (
                                conversations?.map((conv: any) => {
                                    if (!conv) return null;
                                    const isSelected = selectedConversationId === conv._id;
                                    const online = conv.otherMember ? isUserOnline(conv.otherMember) : false;
                                    return (
                                        <button
                                            key={conv._id}
                                            onClick={() => setSelectedConversationId(conv._id)}
                                            className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left mb-1 group ${isSelected ? "bg-zinc-100 dark:bg-zinc-800 shadow-sm" : "hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
                                                }`}
                                        >
                                            <div className="relative shrink-0">
                                                <Avatar
                                                    src={conv.isGroup ? undefined : conv.otherMember?.image}
                                                    name={conv.isGroup ? conv.name : conv.otherMember?.name}
                                                    isGroup={conv.isGroup}
                                                />
                                                {online && !conv.isGroup && (
                                                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-zinc-900 rounded-full"></span>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-baseline mb-0.5">
                                                    <div className="font-semibold text-sm dark:text-zinc-200 truncate pr-2">
                                                        {conv.isGroup ? `${conv.name} (${conv.memberCount})` : conv.otherMember?.name}
                                                    </div>
                                                    {conv.lastMessage && (
                                                        <span className="text-[10px] text-zinc-400 whitespace-nowrap">
                                                            {formatTimestamp(conv.lastMessage._creationTime)}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <div className={`text-xs truncate pr-2 ${conv.unreadCount > 0 ? "font-bold text-zinc-900 dark:text-zinc-100" : "text-zinc-500"}`}>
                                                        {conv.lastMessage?.body || "New conversation"}
                                                    </div>
                                                    {conv.unreadCount > 0 && (
                                                        <span className="bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[1.2rem] text-center">
                                                            {conv.unreadCount}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    )}
                </div>

                {clerkUser && (
                    <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/30 shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <Avatar src={clerkUser.imageUrl} name={clerkUser.fullName || ""} className="w-9 h-9" />
                                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-zinc-50 dark:border-zinc-900 rounded-full"></span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-bold dark:text-zinc-200 truncate">{clerkUser.firstName}</div>
                                <div className="text-[10px] text-green-500 font-medium tracking-tight">Active now</div>
                            </div>
                        </div>
                    </div>
                )}
            </aside>

            {/* Main Chat Area */}
            <main className={`flex-1 flex flex-col min-w-0 bg-white dark:bg-zinc-950 transition-all duration-300 ${!selectedConversationId ? "hidden md:flex" : "flex"}`}>
                {selectedConversationId ? (
                    <>
                        <header className="h-16 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center px-4 md:px-6 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md z-10 shrink-0">
                            <div className="flex items-center gap-3 md:gap-4 shrink-0">
                                <button
                                    onClick={() => setSelectedConversationId(null)}
                                    className="md:hidden p-2 -ml-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300"
                                >
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                                </button>
                                {selectedConversation && (
                                    <>
                                        <div className="relative">
                                            <Avatar
                                                src={selectedConversation.isGroup ? undefined : selectedConversation.otherMember?.image}
                                                name={selectedConversation.isGroup ? selectedConversation.name : selectedConversation.otherMember?.name}
                                                isGroup={selectedConversation.isGroup}
                                                className="w-9 h-9"
                                            />
                                            {!selectedConversation.isGroup && selectedConversation.otherMember && isUserOnline(selectedConversation.otherMember) && (
                                                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white dark:border-zinc-950 rounded-full"></span>
                                            )}
                                        </div>
                                        <div className="min-w-0">
                                            {isEditingGroupName ? (
                                                <input
                                                    autoFocus
                                                    type="text"
                                                    value={tempGroupName}
                                                    onChange={(e) => setTempGroupName(e.target.value)}
                                                    onBlur={() => {
                                                        if (tempGroupName.trim() && tempGroupName !== selectedConversation.name) {
                                                            updateGroupName({ conversationId: selectedConversation._id, name: tempGroupName.trim() });
                                                        }
                                                        setIsEditingGroupName(false);
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter") {
                                                            if (tempGroupName.trim() && tempGroupName !== selectedConversation.name) {
                                                                updateGroupName({ conversationId: selectedConversation._id, name: tempGroupName.trim() });
                                                            }
                                                            setIsEditingGroupName(false);
                                                        } else if (e.key === "Escape") {
                                                            setIsEditingGroupName(false);
                                                        }
                                                    }}
                                                    className="bg-zinc-100 dark:bg-zinc-800 border-none rounded-lg px-2 py-0.5 text-sm md:text-base font-bold dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 w-full"
                                                />
                                            ) : (
                                                <div className="flex items-center gap-2 group/title">
                                                    <h2 className="font-bold text-sm md:text-base dark:text-zinc-50 truncate tracking-tight">
                                                        {selectedConversation.isGroup ? selectedConversation.name : selectedConversation.otherMember?.name}
                                                    </h2>
                                                    {selectedConversation.isGroup && (
                                                        <button
                                                            onClick={() => {
                                                                setTempGroupName(selectedConversation.name || "");
                                                                setIsEditingGroupName(true);
                                                            }}
                                                            className="opacity-0 group-hover/title:opacity-100 p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-all text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                                                        >
                                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[10px] font-bold uppercase tracking-tight ${selectedConversation.otherMember?.isOnline ? "text-emerald-500" : "text-zinc-400 opacity-60"}`}>
                                                    {selectedConversation.isGroup
                                                        ? `${selectedConversation.memberProfiles.length + 1} participants`
                                                        : selectedConversation.otherMember?.isOnline ? "Active Now" :
                                                            selectedConversation.otherMember?.lastSeen ? `Last seen ${formatTimestamp(selectedConversation.otherMember.lastSeen)}` : "Offline"}
                                                </span>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </header>

                        <div
                            ref={scrollAreaRef}
                            onScroll={handleScroll}
                            className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 custom-scrollbar bg-zinc-50/10 dark:bg-zinc-950/10"
                        >
                            {messages === undefined ? (
                                <div className="p-4 space-y-6">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className={`flex flex-col ${i % 2 === 0 ? "items-end" : "items-start"} gap-2`}>
                                            <div className="h-10 w-48 bg-zinc-100 dark:bg-zinc-800 rounded-2xl animate-pulse"></div>
                                        </div>
                                    ))}
                                </div>
                            ) : messages.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                                    <div className="w-16 h-16 bg-zinc-50 dark:bg-zinc-900 rounded-[2rem] flex items-center justify-center shadow-inner">
                                        <svg className="w-8 h-8 text-zinc-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                                    </div>
                                    <p className="text-zinc-500 text-sm italic">New conversation started.</p>
                                </div>
                            ) : (
                                <div className="flex flex-col min-h-full">
                                    <div className="flex-1" /> {/* Spacer to push messages to bottom if few */}
                                    {messages.map((msg: any, index: number) => {
                                        const isMe = (currentUser && msg.authorId === currentUser._id) || (!currentUser && msg.authorName === clerkUser?.fullName);
                                        const isDeleted = msg.deleted === true;

                                        // Chronological context (Previous = older message above)
                                        const prevMsg = index > 0 ? messages[index - 1] : null;
                                        const isSameSender = prevMsg && prevMsg.authorId === msg.authorId;

                                        // Date Separator Logic
                                        const currentDate = new Date(msg._creationTime).toDateString();
                                        const prevDate = prevMsg ? new Date(prevMsg._creationTime).toDateString() : null;
                                        const showDateSeparator = currentDate !== prevDate;

                                        // Read Status Logic (for my messages)
                                        let messageStatus = "sent"; // default
                                        if (isMe && !isDeleted) {
                                            const otherReadTimes = msg.readBy
                                                ? msg.readBy.filter((r: any) => r.userId !== msg.authorId).map((r: any) => r.lastReadTime)
                                                : [];
                                            if (otherReadTimes.length > 0) {
                                                const allRead = otherReadTimes.every((t: number) => t >= msg._creationTime);
                                                const someRead = otherReadTimes.some((t: number) => t >= msg._creationTime);
                                                if (allRead) messageStatus = "read";
                                                else if (someRead) messageStatus = "delivered";
                                            }
                                        }

                                        return (
                                            <div key={msg._id} className="w-full flex flex-col">
                                                {showDateSeparator && (
                                                    <div className="flex justify-center my-6">
                                                        <span className="bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest shadow-sm">
                                                            {new Date(msg._creationTime).toLocaleDateString([], { month: 'long', day: 'numeric', year: new Date(msg._creationTime).getFullYear() === new Date().getFullYear() ? undefined : 'numeric' })}
                                                        </span>
                                                    </div>
                                                )}

                                                <div className={`flex ${isMe ? "justify-end" : "justify-start"} ${isSameSender ? "mt-1" : "mt-6"} px-4 group/msg w-full animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                                                    <div className={`flex ${isMe ? "flex-row-reverse" : "flex-row"} items-end gap-2 max-w-[85%] md:max-w-[75%]`}>
                                                        {/* Avatar Column (Received Messages) */}
                                                        {!isMe && (
                                                            <div className="w-8 shrink-0">
                                                                {!isSameSender ? (
                                                                    <Avatar
                                                                        src={selectedConversation?.memberProfiles?.find((p: any) => p?._id === msg.authorId)?.image}
                                                                        name={msg.authorName}
                                                                        className="w-8 h-8 rounded-full shadow-sm"
                                                                    />
                                                                ) : (
                                                                    <div className="w-8" />
                                                                )}
                                                            </div>
                                                        )}

                                                        {/* Message Content Column */}
                                                        <div className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                                                            {/* Group Context */}
                                                            {selectedConversation?.isGroup && !isMe && !isSameSender && (
                                                                <span className="text-[10px] font-bold text-zinc-500 mb-1 ml-1 uppercase tracking-tight">
                                                                    {msg.authorName}
                                                                </span>
                                                            )}

                                                            <div className="relative flex items-center gap-2 group">
                                                                <div className={`relative px-4 py-2.5 text-sm leading-relaxed shadow-sm transition-all ${isMe
                                                                    ? `bg-emerald-600 text-white shadow-emerald-500/10 ${isSameSender ? "rounded-2xl" : "rounded-2xl rounded-tr-none"}`
                                                                    : `bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-100 dark:border-zinc-700/50 ${isSameSender ? "rounded-2xl" : "rounded-2xl rounded-tl-none"}`
                                                                    }`}>
                                                                    {msg.repliedTo && (
                                                                        <div className={`mb-2 p-2 rounded-lg text-[11px] border-l-4 ${isMe ? "bg-emerald-700/40 border-emerald-400" : "bg-zinc-100 dark:bg-zinc-700/50 border-zinc-300 dark:border-zinc-500"}`}>
                                                                            <p className="font-black uppercase tracking-tighter mb-0.5">{msg.repliedTo.authorName}</p>
                                                                            <p className="opacity-80 truncate">{msg.repliedTo.deleted ? "Message deleted" : msg.repliedTo.body}</p>
                                                                        </div>
                                                                    )}
                                                                    <div className={`${isDeleted ? "italic opacity-60" : ""} whitespace-pre-wrap`}>
                                                                        {msg.body}
                                                                        {msg.edited && (
                                                                            <span className="text-[10px] opacity-40 ml-1.5 font-medium select-none">(edited)</span>
                                                                        )}
                                                                    </div>

                                                                    {/* Reactions Bar */}
                                                                    {msg.reactions && msg.reactions.length > 0 && (
                                                                        <div className={`absolute -bottom-4 flex flex-wrap gap-1 ${isMe ? "right-0" : "left-0"}`}>
                                                                            {(msg.reactions as any[]).map((data) => (
                                                                                <button
                                                                                    key={data.emoji}
                                                                                    onClick={() => toggleReaction({ messageId: msg._id, emoji: data.emoji })}
                                                                                    className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold border transition-all ${(currentUser && data.userIds.includes(currentUser._id))
                                                                                        ? "bg-zinc-100 dark:bg-zinc-700 border-zinc-300 dark:border-zinc-600 text-zinc-900 dark:text-zinc-100"
                                                                                        : "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-500"
                                                                                        }`}
                                                                                >
                                                                                    <span>{data.emoji}</span>
                                                                                    <span>{data.count}</span>
                                                                                </button>
                                                                            ))}
                                                                        </div>
                                                                    )}

                                                                    {/* Status Icons (Sent/Read/Delivered) - Only for Me */}
                                                                    {isMe && !isDeleted && (
                                                                        <div className="absolute right-2 bottom-1 flex items-center gap-0.5 opacity-60">
                                                                            {messageStatus === "sent" && (
                                                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                                                            )}
                                                                            {messageStatus === "delivered" && (
                                                                                <div className="flex -space-x-1.5">
                                                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                                                                </div>
                                                                            )}
                                                                            {messageStatus === "read" && (
                                                                                <div className="flex -space-x-1.5 text-blue-300">
                                                                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12.454 16.697L9.75 13.992l-1.06 1.06 3.765 3.765 8.25-8.25-1.06-1.06-7.191 7.19z" /><path d="M6.454 16.697L3.75 13.992l-1.06 1.06 3.765 3.765 8.25-8.25-1.06-1.06-7.191 7.19z" /></svg>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                {/* Action Overlay */}
                                                                <div className={`flex gap-0.5 opacity-0 group-hover:opacity-100 transition-all scale-90 ${isMe ? "origin-right flex-row-reverse" : "origin-left"}`}>
                                                                    <button
                                                                        onClick={() => { setReplyingTo(msg); setEditingMessage(null); setTimeout(() => inputRef.current?.focus(), 0); }}
                                                                        className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-xs transition-all active:scale-125 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                                                                    >
                                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                                                                    </button>
                                                                    {["👍", "❤️", "😂", "😮", "😢"].map((emoji) => (
                                                                        <button
                                                                            key={emoji}
                                                                            onClick={() => toggleReaction({ messageId: msg._id, emoji })}
                                                                            className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-xs transition-all active:scale-125"
                                                                        >
                                                                            {emoji}
                                                                        </button>
                                                                    ))}
                                                                    {isMe && (
                                                                        <button
                                                                            onClick={() => { setEditingMessage(msg); setNewMessageText(msg.body); setReplyingTo(null); setTimeout(() => inputRef.current?.focus(), 0); }}
                                                                            className="p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-all"
                                                                        >
                                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                                                        </button>
                                                                    )}
                                                                    {isMe && (
                                                                        <button
                                                                            onClick={() => deleteMessage({ id: msg._id })}
                                                                            className="p-1 text-zinc-400 hover:text-red-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-all"
                                                                        >
                                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {/* Subtle Timestamp */}
                                                            <div className={`flex items-center gap-1 mt-1 opacity-0 group-hover/msg:opacity-100 transition-opacity ${isMe ? "justify-end mr-1" : "justify-start ml-1"}`}>
                                                                <span className="text-[9px] text-zinc-400 font-medium">{formatTimestamp(msg._creationTime)}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {failedMessages.map((msg) => (
                                        <div key={msg.id} className="flex flex-col items-end px-4 mt-2 animate-in fade-in slide-in-from-right-2">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => retryMessage(msg.body, msg.id)}
                                                    className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-all flex items-center gap-1 text-[10px] font-bold uppercase"
                                                >
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                                    Retry
                                                </button>
                                                <div className="bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 rounded-2xl rounded-tr-none border border-red-100 dark:border-red-900/20 px-4 py-2 text-sm">
                                                    {msg.body}
                                                    <div className="text-[10px] font-bold opacity-60">Failed to send</div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                    {otherTypingUsers && otherTypingUsers.length > 0 && (
                                        <div className="flex flex-col items-start px-4 animate-in fade-in slide-in-from-bottom-1 duration-300">
                                            <div className="flex items-center gap-2">
                                                <div className="bg-white dark:bg-zinc-800 px-3 py-2 rounded-2xl rounded-tl-none border border-zinc-100 dark:border-zinc-700/50 shadow-sm flex gap-1 items-center">
                                                    <div className="flex gap-1">
                                                        <span className="w-1 h-1 bg-zinc-400 rounded-full animate-bounce"></span>
                                                        <span className="w-1 h-1 bg-zinc-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                                                        <span className="w-1 h-1 bg-zinc-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                                                    </div>
                                                </div>
                                                <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-tighter">
                                                    {otherTypingUsers.length === 1
                                                        ? `${otherTypingUsers[0].name} is typing...`
                                                        : otherTypingUsers.length === 2
                                                            ? `${otherTypingUsers[0].name} and ${otherTypingUsers[1].name} are typing...`
                                                            : `${otherTypingUsers[0].name} and ${otherTypingUsers.length - 1} others are typing...`}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {!shouldAutoScroll && (
                            <button
                                onClick={() => { setShouldAutoScroll(true); messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }}
                                className="absolute bottom-24 right-8 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 px-4 py-1.5 rounded-full text-[10px] font-bold shadow-xl animate-in slide-in-from-bottom-4 flex items-center gap-2 hover:scale-105 transition-transform"
                            >
                                New Messages <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 14l-7 7-7-7" /></svg>
                            </button>
                        )}
                        {shouldAutoScroll && (
                            <div className="absolute bottom-24 right-8 z-20">
                                {/* Handled by CSS/State above */}
                            </div>
                        )}

                        <form onSubmit={handleSendMessage} className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shrink-0 relative">
                            {replyingTo && (
                                <div className="absolute bottom-full left-0 right-0 p-3 bg-zinc-50 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between animate-in slide-in-from-bottom-2 duration-300">
                                    <div className="flex-1 min-w-0 border-l-4 border-emerald-500 pl-3">
                                        <p className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-widest">Replying to {replyingTo.authorName}</p>
                                        <p className="text-xs text-zinc-500 truncate">{replyingTo.body}</p>
                                    </div>
                                    <button onClick={() => setReplyingTo(null)} className="p-2 text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-all">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </div>
                            )}
                            {editingMessage && (
                                <div className="absolute bottom-full left-0 right-0 p-3 bg-zinc-50 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between animate-in slide-in-from-bottom-2 duration-300">
                                    <div className="flex-1 min-w-0 border-l-4 border-blue-500 pl-3">
                                        <p className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 tracking-widest">Editing Message</p>
                                        <p className="text-xs text-zinc-500 truncate">{editingMessage.body}</p>
                                    </div>
                                    <button onClick={() => { setEditingMessage(null); setNewMessageText(""); }} className="p-2 text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-all">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </div>
                            )}
                            <div className="max-w-4xl mx-auto flex gap-3 items-center">
                                <div className="flex-1 relative">
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        placeholder={editingMessage ? "Save changes..." : "Type a message..."}
                                        value={newMessageText}
                                        onChange={handleInputChange}
                                        className="w-full bg-zinc-100 dark:bg-zinc-800 border-none rounded-2xl px-5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all shadow-inner"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={!newMessageText.trim() && !editingMessage}
                                    className="p-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl shadow-lg shadow-emerald-500/20 transition-all active:scale-95 disabled:opacity-50 disabled:grayscale"
                                >
                                    {editingMessage ? (
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                    ) : (
                                        <svg className="w-5 h-5 translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                                    )}
                                </button>
                            </div>
                        </form>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-white dark:bg-zinc-950">
                        <div className="w-24 h-24 bg-zinc-50 dark:bg-zinc-900 rounded-[2.5rem] flex items-center justify-center mb-6 shadow-inner border border-zinc-100 dark:border-zinc-800">
                            <svg className="w-10 h-10 text-zinc-300 dark:text-zinc-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                        </div>
                        <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-3 tracking-tighter">Milan Messenger</h3>
                        <p className="max-w-xs text-zinc-500 text-sm leading-relaxed font-medium">Select a conversation or find people to start messaging in real-time.</p>
                        <button
                            onClick={() => (document.querySelector('input') as HTMLInputElement)?.focus()}
                            className="mt-8 text-sm font-bold text-zinc-900 dark:text-zinc-50 hover:underline flex items-center gap-2 transition-all hover:gap-3"
                        >
                            Find People <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                        </button>
                    </div>
                )}
            </main>
        </div>
    );
}

export default function ChatPage() {
    return (
        <Suspense fallback={
            <div className="h-screen w-screen flex items-center justify-center bg-zinc-950">
                <div className="w-10 h-10 border-4 border-zinc-800 border-t-zinc-50 rounded-full animate-spin"></div>
            </div>
        }>
            <ChatContent />
        </Suspense>
    );
}
