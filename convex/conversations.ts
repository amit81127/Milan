import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const create = mutation({
    args: {
        participantIds: v.array(v.id("users")),
        isGroup: v.boolean(),
        name: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Unauthorized");

        const currentUser = await ctx.db
            .query("users")
            .withIndex("by_token", (q) =>
                q.eq("tokenIdentifier", identity.tokenIdentifier)
            )
            .unique();

        if (!currentUser) throw new Error("User not found");

        // For 1-on-1 chats, check if it already exists
        if (!args.isGroup && args.participantIds.length === 1) {
            const otherUserId = args.participantIds[0];

            // Find conversations where both are members
            const myMemberships = await ctx.db
                .query("conversationMembers")
                .withIndex("by_user", (q) => q.eq("userId", currentUser._id))
                .collect();

            for (const membership of myMemberships) {
                const conversation = await ctx.db.get(membership.conversationId);
                if (conversation && !conversation.isGroup) {
                    const otherMember = await ctx.db
                        .query("conversationMembers")
                        .withIndex("by_conversation_user", (q) =>
                            q.eq("conversationId", conversation._id).eq("userId", otherUserId)
                        )
                        .unique();
                    if (otherMember) return conversation._id;
                }
            }
        }

        const conversationId = await ctx.db.insert("conversations", {
            isGroup: args.isGroup,
            name: args.name,
        });

        await ctx.db.insert("conversationMembers", {
            conversationId,
            userId: currentUser._id,
        });

        for (const userId of args.participantIds) {
            await ctx.db.insert("conversationMembers", {
                conversationId,
                userId,
            });
        }

        return conversationId;
    },
});

export const list = query({
    args: {},
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) return [];

        const user = await ctx.db
            .query("users")
            .withIndex("by_token", (q) =>
                q.eq("tokenIdentifier", identity.tokenIdentifier)
            )
            .unique();

        if (!user) return [];

        const memberships = await ctx.db
            .query("conversationMembers")
            .withIndex("by_user", (q) => q.eq("userId", user._id))
            .collect();

        const conversations = await Promise.all(
            memberships.map(async (m) => {
                const conbo = await ctx.db.get(m.conversationId);
                if (!conbo) return null;

                // Get other members
                const allMembers = await ctx.db
                    .query("conversationMembers")
                    .withIndex("by_conversation", (q) => q.eq("conversationId", conbo._id))
                    .collect();

                const memberProfiles = await Promise.all(
                    allMembers
                        .filter((om) => om.userId !== user._id)
                        .map((om) => ctx.db.get(om.userId))
                );

                // Get last message
                const lastMessage = conbo.lastMessageId ? await ctx.db.get(conbo.lastMessageId) : null;

                // Count unread
                const unreadMessages = await ctx.db
                    .query("messages")
                    .withIndex("by_conversation", (q) => q.eq("conversationId", conbo._id))
                    .collect();

                const unreadCount = unreadMessages.filter(msg => msg._creationTime > (m.lastReadTime ?? 0)).length;

                return {
                    ...conbo,
                    userId: user._id, // Include current user's ID
                    otherMember: memberProfiles[0],
                    memberProfiles,
                    lastMessage,
                    unreadCount,
                    memberCount: allMembers.length,
                };
            })
        );

        return conversations
            .filter((c): c is NonNullable<typeof c> => c !== null)
            .sort((a, b) => {
                const aTime = a.lastMessage?._creationTime ?? a._creationTime;
                const bTime = b.lastMessage?._creationTime ?? b._creationTime;
                return bTime - aTime;
            });
    },
});

export const markRead = mutation({
    args: { conversationId: v.id("conversations") },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) return;

        const user = await ctx.db
            .query("users")
            .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
            .unique();

        if (!user) return;

        const membership = await ctx.db
            .query("conversationMembers")
            .withIndex("by_conversation_user", (q) =>
                q.eq("conversationId", args.conversationId).eq("userId", user._id)
            )
            .unique();

        if (membership) {
            await ctx.db.patch(membership._id, { lastReadTime: Date.now() });
        }
    },
});

export const updateName = mutation({
    args: {
        conversationId: v.id("conversations"),
        name: v.string(),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Unauthorized");

        const user = await ctx.db
            .query("users")
            .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
            .unique();

        if (!user) throw new Error("User not found");

        // Check if user is a member
        const membership = await ctx.db
            .query("conversationMembers")
            .withIndex("by_conversation_user", (q) =>
                q.eq("conversationId", args.conversationId).eq("userId", user._id)
            )
            .unique();

        if (!membership) throw new Error("Not a member of this conversation");

        await ctx.db.patch(args.conversationId, {
            name: args.name,
        });
    },
});
