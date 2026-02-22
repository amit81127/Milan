import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const store = mutation({
    args: {},
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Called storeUser without authentication identity");
        }

        // Check if we've already stored this user.
        const user = await ctx.db
            .query("users")
            .withIndex("by_token", (q) =>
                q.eq("tokenIdentifier", identity.tokenIdentifier)
            )
            .unique();

        if (user !== null) {
            // If we've seen this user before but their name or picture has changed, patch them.
            if (user.name !== identity.name || user.image !== (identity.picture as string | undefined)) {
                await ctx.db.patch(user._id, {
                    name: identity.name as string,
                    image: identity.picture as string | undefined,
                });
            }
            return user._id;
        }

        // If it's a new user, create them.
        return await ctx.db.insert("users", {
            name: (identity.name ?? identity.nickname ?? "Anonymous") as string,
            email: (identity.email ?? "") as string,
            image: identity.picture as string | undefined,
            tokenIdentifier: identity.tokenIdentifier,
        });
    },
});
export const list = query({
    args: { search: v.optional(v.string()) },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        const users = await ctx.db.query("users").collect();

        return users
            .filter((u) => u.tokenIdentifier !== identity?.tokenIdentifier)
            .filter((u) =>
                !args.search ||
                u.name.toLowerCase().includes(args.search.toLowerCase()) ||
                u.email.toLowerCase().includes(args.search.toLowerCase())
            );
    },
});
