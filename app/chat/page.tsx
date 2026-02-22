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

// --- Main Chat Content Component ---
function ChatContent() {
    const { user: clerkUser, isLoaded } = useUser();
    const router = useRouter();
    const searchParams = useSearchParams();

    // Sync selected conversation with URL
    const urlConversationId = searchParams.get("id") as Id<"conversations"> | null;
    const [selectedConversationId, setSelectedConversationId] = useState<Id<"conversations"> | null>(urlConversationId);

    const [searchTerm, setSearchTerm] = useState("");
    const [newMessageText, setNewMessageText] = useState("");
    const [isCreatingGroup, setIsCreatingGroup] = useState(false);
    const [selectedUserIds, setSelectedUserIds] = useState<Id<"users">[]>([]);
    const [groupName, setGroupName] = useState("");

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

    // Convex queries & mutations
    const conversations = useQuery(api.conversations.list);
    const allUsers = useQuery(api.users.list, { search: searchTerm });
    const messages = useQuery(api.messages.list, selectedConversationId ? { conversationId: selectedConversationId } : "skip");
    const presenceList = useQuery(api.presence.list);
    const typingUsers = useQuery(api.typing.list, selectedConversationId ? { conversationId: selectedConversationId } : "skip");

    const sendMessage = useMutation(api.messages.send);
    const deleteMessage = useMutation(api.messages.remove);
    const storeUser = useMutation(api.users.store);
    const createConversation = useMutation(api.conversations.create);
    const updatePresence = useMutation(api.presence.update);
    const markAsRead = useMutation(api.conversations.markRead);
    const setTyping = useMutation(api.typing.update);
    const removeTyping = useMutation(api.typing.remove);

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

    // Presence update interval
    useEffect(() => {
        const interval = setInterval(() => {
            if (clerkUser) updatePresence();
        }, 10000);
        return () => clearInterval(interval);
    }, [clerkUser, updatePresence]);

    // Mark as read when conversation is selected or new messages arrive
    useEffect(() => {
        if (selectedConversationId) {
            markAsRead({ conversationId: selectedConversationId });
        }
    }, [selectedConversationId, messages, markAsRead]);

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

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setNewMessageText(e.target.value);

        if (selectedConversationId) {
            setTyping({ conversationId: selectedConversationId });
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(() => {
                removeTyping({ conversationId: selectedConversationId });
            }, 3000);
        }
    };

    async function handleSendMessage(event: React.FormEvent) {
        event.preventDefault();
        const text = newMessageText.trim();
        if (!text || !selectedConversationId) return;

        try {
            setNewMessageText(""); // Pessimistic clear for faster feel
            await sendMessage({
                body: text,
                conversationId: selectedConversationId,
            });
            removeTyping({ conversationId: selectedConversationId });
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            setShouldAutoScroll(true); // Jump to bottom on my own message
        } catch (error) {
            console.error("Failed to send message:", error);
            setNewMessageText(text); // Restore on error
            alert("Failed to send message. Please retry.");
        }
    }

    const isUserOnline = (userId: Id<"users"> | undefined) => {
        if (!userId) return false;
        const presence = presenceList?.find((p: any) => p.userId === userId);
        if (!presence) return false;
        return Date.now() - presence.updatedAt < 30000;
    };

    const selectedConversation = conversations?.find((c: any) => c?._id === selectedConversationId);
    const otherTypingUsers = typingUsers?.filter((name: any) => name !== clerkUser?.fullName);
    const isLoading = conversations === undefined || allUsers === undefined;

    return (
        <div className="flex h-screen bg-zinc-50 dark:bg-zinc-950 overflow-hidden font-sans">
            {/* Sidebar */}
            <aside className={`w-full md:w-80 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col shrink-0 transition-all duration-300 ${selectedConversationId ? "hidden md:flex" : "flex"}`}>
                <header className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-white dark:bg-zinc-900 z-10 shrink-0">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-zinc-900 dark:bg-zinc-50 rounded-lg flex items-center justify-center">
                            <span className="text-white dark:text-zinc-900 font-bold text-lg">M</span>
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
                                            <img src={user.image} className="w-11 h-11 rounded-full object-cover ring-2 ring-white dark:ring-zinc-900" alt="" />
                                            {isUserOnline(user._id) && (
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
                                    const online = conv.otherMember ? isUserOnline(conv.otherMember._id) : false;
                                    return (
                                        <button
                                            key={conv._id}
                                            onClick={() => setSelectedConversationId(conv._id)}
                                            className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left mb-1 group ${isSelected ? "bg-zinc-100 dark:bg-zinc-800 shadow-sm" : "hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
                                                }`}
                                        >
                                            <div className="relative shrink-0">
                                                {conv.isGroup ? (
                                                    <div className="w-11 h-11 bg-zinc-900 dark:bg-zinc-50 rounded-full flex items-center justify-center">
                                                        <span className="text-white dark:text-zinc-900 text-[10px] font-bold">GRP</span>
                                                    </div>
                                                ) : (
                                                    <img src={conv.otherMember?.image} className="w-11 h-11 rounded-full object-cover" alt="" />
                                                )}
                                                {online && !conv.isGroup && (
                                                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-zinc-900 rounded-full"></span>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-baseline mb-0.5">
                                                    <div className="font-semibold text-sm dark:text-zinc-200 truncate pr-2">
                                                        {conv.isGroup ? conv.name : conv.otherMember?.name}
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
                                <img src={clerkUser.imageUrl} className="w-9 h-9 rounded-full" alt="" />
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
                {selectedConversation ? (
                    <>
                        <header className="h-16 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center px-4 md:px-6 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md z-10 shrink-0">
                            <div className="flex items-center gap-3 md:gap-4 shrink-0">
                                <button
                                    onClick={() => setSelectedConversationId(null)}
                                    className="md:hidden p-2 -ml-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300"
                                >
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                                </button>
                                <div className="relative">
                                    {selectedConversation.isGroup ? (
                                        <div className="w-9 h-9 bg-zinc-900 dark:bg-zinc-50 rounded-full flex items-center justify-center shadow-inner">
                                            <span className="text-white dark:text-zinc-900 text-[10px] font-bold">GRP</span>
                                        </div>
                                    ) : (
                                        <img src={selectedConversation.otherMember?.image} className="w-9 h-9 rounded-full object-cover shadow-sm" alt="" />
                                    )}
                                    {!selectedConversation.isGroup && selectedConversation.otherMember && isUserOnline(selectedConversation.otherMember._id) && (
                                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white dark:border-zinc-950 rounded-full"></span>
                                    )}
                                </div>
                                <div className="min-w-0">
                                    <h2 className="font-bold text-sm md:text-base dark:text-zinc-50 truncate tracking-tight">
                                        {selectedConversation.isGroup ? selectedConversation.name : selectedConversation.otherMember?.name}
                                    </h2>
                                    <div className="text-[10px] text-zinc-400 font-medium truncate">
                                        {selectedConversation.isGroup
                                            ? `${selectedConversation.memberProfiles.length + 1} participants`
                                            : isUserOnline(selectedConversation.otherMember?._id) ? "Online" : "Offline"}
                                    </div>
                                </div>
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
                                <>
                                    {messages.map((msg: any) => {
                                        const isMe = (msg.authorId && msg.authorId === (selectedConversation as any).userId) || msg.authorName === clerkUser?.fullName;
                                        return (
                                            <div key={msg._id} className={`flex flex-col ${isMe ? "items-end" : "items-start"} animate-in fade-in slide-in-from-bottom-2 duration-300 group`}>
                                                {!isMe && (
                                                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1 mb-1.5 opacity-80">
                                                        {msg.authorName.split(' ')[0]}
                                                    </span>
                                                )}
                                                <div className={`relative max-w-[85%] md:max-w-[75%] transition-all ${isMe ? "bg-zinc-900 text-white rounded-2xl rounded-tr-none shadow-md" : "bg-white dark:bg-zinc-800 dark:text-zinc-100 rounded-2xl rounded-tl-none border border-zinc-100 dark:border-zinc-700/50 shadow-sm"
                                                    }`}>
                                                    <div className="px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap">{msg.body}</div>

                                                    {isMe && (
                                                        <button
                                                            onClick={() => deleteMessage({ id: msg._id })}
                                                            className="absolute -left-10 top-1/2 -translate-y-1/2 p-2 text-zinc-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                        </button>
                                                    )}

                                                    <div className={`absolute bottom-[-18px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-zinc-400 ${isMe ? "right-0" : "left-0"}`}>
                                                        {formatTimestamp(msg._creationTime)}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    }).reverse()}

                                    {otherTypingUsers && otherTypingUsers.length > 0 && (
                                        <div className="flex flex-col items-start animate-in fade-in slide-in-from-bottom-1 duration-300">
                                            <div className="bg-white dark:bg-zinc-800 px-4 py-3 rounded-2xl rounded-tl-none border border-zinc-100 dark:border-zinc-700/50 shadow-sm flex gap-1 items-center">
                                                <div className="flex gap-1">
                                                    <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce"></span>
                                                    <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                                                    <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                                                </div>
                                            </div>
                                            <span className="text-[10px] text-zinc-400 mt-1.5 ml-1 font-semibold uppercase tracking-tighter">Typing...</span>
                                        </div>
                                    )}
                                </>
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

                        <form onSubmit={handleSendMessage} className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shrink-0">
                            <div className="max-w-4xl mx-auto flex gap-3 items-center">
                                <div className="flex-1 relative">
                                    <input
                                        type="text"
                                        value={newMessageText}
                                        onChange={handleInputChange}
                                        placeholder="Type a message..."
                                        className="w-full bg-zinc-100 dark:bg-zinc-800 border-none rounded-2xl px-5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:text-zinc-100 transition-all shadow-inner"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={!newMessageText.trim()}
                                    className="bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 h-11 w-11 flex items-center justify-center rounded-2xl hover:opacity-90 transition-all active:scale-95 disabled:opacity-30 shadow-lg shrink-0"
                                >
                                    <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                                    </svg>
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
