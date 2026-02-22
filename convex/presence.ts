import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const update = mutation({
    args: {},
    handler: async (ctx) => {
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
            .query("presence")
            .withIndex("by_user", (q) => q.eq("userId", user._id))
            .unique();

        if (existing) {
            await ctx.db.patch(existing._id, { updatedAt: Date.now() });
        } else {
            await ctx.db.insert("presence", { userId: user._id, updatedAt: Date.now() });
        }
    },
});

export const list = query({
    args: {},
    handler: async (ctx) => {
        return await ctx.db.query("presence").collect();
    },
});
