import { v } from "convex/values";
import { mutation } from "./_generated/server";

export const toggle = mutation({
    args: {
        messageId: v.id("messages"),
        emoji: v.string(),
    },
    handler: async (ctx, { messageId, emoji }) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Unauthorized");

        const user = await ctx.db
            .query("users")
            .withIndex("by_token", (q) =>
                q.eq("tokenIdentifier", identity.tokenIdentifier)
            )
            .unique();

        if (!user) throw new Error("User not found");

        const existing = await ctx.db
            .query("reactions")
            .withIndex("by_message_user", (q) =>
                q.eq("messageId", messageId).eq("userId", user._id)
            )
            .filter((q) => q.eq(q.field("emoji"), emoji))
            .unique();

        if (existing) {
            await ctx.db.delete(existing._id);
        } else {
            await ctx.db.insert("reactions", {
                messageId,
                userId: user._id,
                emoji,
            });
        }
    },
});
