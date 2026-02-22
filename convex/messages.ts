import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
    args: { conversationId: v.id("conversations") },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("messages")
            .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
            .order("desc")
            .take(100);
    },
});

export const send = mutation({
    args: {
        body: v.string(),
        conversationId: v.id("conversations")
    },
    handler: async (ctx, { body, conversationId }) => {
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
            authorName: user.name ?? "Anonymous User",
            body,
            conversationId,
        });

        await ctx.db.patch(conversationId, {
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

        await ctx.db.delete(args.id);
    },
});
