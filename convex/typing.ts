import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const update = mutation({
    args: { conversationId: v.id("conversations") },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) return;

        const user = await ctx.db
            .query("users")
            .withIndex("by_token", (q) =>
                q.eq("tokenIdentifier", identity.tokenIdentifier)
            )
            .unique();

        if (!user) return;

        const existing = await ctx.db
            .query("typing")
            .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
            .filter((q) => q.eq(q.field("userId"), user._id))
            .unique();

        if (existing) {
            await ctx.db.patch(existing._id, { updatedAt: Date.now() });
        } else {
            await ctx.db.insert("typing", {
                conversationId: args.conversationId,
                userId: user._id,
                updatedAt: Date.now(),
            });
        }
    },
});

export const remove = mutation({
    args: { conversationId: v.id("conversations") },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) return;

        const user = await ctx.db
            .query("users")
            .withIndex("by_token", (q) =>
                q.eq("tokenIdentifier", identity.tokenIdentifier)
            )
            .unique();

        if (!user) return;

        const existing = await ctx.db
            .query("typing")
            .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
            .filter((q) => q.eq(q.field("userId"), user._id))
            .unique();

        if (existing) {
            await ctx.db.delete(existing._id);
        }
    },
});

export const list = query({
    args: { conversationId: v.id("conversations") },
    handler: async (ctx, args) => {
        const typing = await ctx.db
            .query("typing")
            .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
            .collect();

        // Only return users who typed in the last 5 seconds
        const activeTyping = typing.filter((t) => Date.now() - t.updatedAt < 5000);

        return await Promise.all(
            activeTyping.map(async (t) => {
                const user = await ctx.db.get(t.userId);
                return user?.name || "Someone";
            })
        );
    },
});
