import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
    args: { conversationId: v.id("conversations") },
    handler: async (ctx, args) => {
        const messages = await ctx.db
            .query("messages")
            .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
            .collect();

        // Get all members to calculate read status
        const allMembers = await ctx.db
            .query("conversationMembers")
            .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
            .collect();

        const readStatus = allMembers.map(m => ({
            userId: m.userId,
            lastReadTime: m.lastReadTime ?? 0
        }));

        return await Promise.all(
            messages.map(async (message) => {
                const reactions = await ctx.db
                    .query("reactions")
                    .withIndex("by_message", (q) => q.eq("messageId", message._id))
                    .collect();

                // Get replied message content
                let repliedMessage = null;
                if (message.replyTo) {
                    const original = await ctx.db.get(message.replyTo);
                    if (original) {
                        repliedMessage = {
                            body: original.body,
                            authorName: original.authorName,
                            deleted: original.deleted,
                        };
                    }
                }

                // Group reactions by emoji
                const emojiCounts: Record<string, { count: number; userIds: string[] }> = {};
                reactions.forEach((r) => {
                    if (!emojiCounts[r.emoji]) {
                        emojiCounts[r.emoji] = { count: 0, userIds: [] };
                    }
                    emojiCounts[r.emoji].count++;
                    emojiCounts[r.emoji].userIds.push(r.userId);
                });

                return {
                    ...message,
                    body: message.deleted ? "This message was deleted" : message.body,
                    reactions: Object.entries(emojiCounts).map(([emoji, data]) => ({
                        emoji,
                        ...data
                    })),
                    readBy: readStatus,
                    repliedTo: repliedMessage,
                };
            })
        );
    },
});

export const send = mutation({
    args: {
        body: v.string(),
        conversationId: v.id("conversations"),
        replyTo: v.optional(v.id("messages")),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Unauthorized");

        const user = await ctx.db
            .query("users")
            .withIndex("by_token", (q) =>
                q.eq("tokenIdentifier", identity.tokenIdentifier)
            )
            .unique();

        if (!user) throw new Error("User not found");

        const messageId = await ctx.db.insert("messages", {
            authorId: user._id,
            authorName: user.name,
            body: args.body,
            conversationId: args.conversationId,
            replyTo: args.replyTo,
        });

        await ctx.db.patch(args.conversationId, {
            lastMessageId: messageId,
        });
    },
});

export const remove = mutation({
    args: { id: v.id("messages") },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Unauthorized");

        const message = await ctx.db.get(args.id);
        if (!message) return;

        const user = await ctx.db
            .query("users")
            .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
            .unique();

        if (!user || message.authorId !== user._id) {
            throw new Error("You can only delete your own messages");
        }

        await ctx.db.patch(args.id, { deleted: true });
    },
});

export const update = mutation({
    args: { id: v.id("messages"), body: v.string() },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Unauthorized");

        const message = await ctx.db.get(args.id);
        if (!message) throw new Error("Message not found");

        const user = await ctx.db
            .query("users")
            .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
            .unique();

        if (!user || message.authorId !== user._id) {
            throw new Error("Unauthorized");
        }

        await ctx.db.patch(args.id, {
            body: args.body,
            edited: true,
            updatedAt: Date.now()
        });
    },
});
