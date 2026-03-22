import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Creates a new video call instance
 */
export const createCall = mutation({
    args: {
        conversationId: v.id("conversations"),
        participants: v.array(v.id("users")),
        type: v.union(v.literal("private"), v.literal("group")),
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

        // Ensure the caller is a participant in the call
        if (!args.participants.includes(user._id)) {
            throw new Error("You must be a participant to create a call");
        }

        // Generate a unique string ID for the call session
        const callId = crypto.randomUUID();

        await ctx.db.insert("calls", {
            callId,
            conversationId: args.conversationId,
            participants: args.participants,
            type: args.type,
            status: "ringing",
            createdAt: Date.now(),
        });

        return callId;
    },
});

/**
 * Sends a WebRTC signal (offer/answer/ice) to a specific call
 */
export const sendSignal = mutation({
    args: {
        callId: v.string(),
        type: v.union(v.literal("offer"), v.literal("answer"), v.literal("ice")),
        data: v.any(),
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

        // Fetch the existing call
        const call = await ctx.db
            .query("calls")
            .withIndex("by_callId", (q) => q.eq("callId", args.callId))
            .unique();

        if (!call) throw new Error("Call not found");

        // Security check: only allow call participants to send signals
        if (!call.participants.includes(user._id)) {
            throw new Error("Unauthorized: Only participants can send signals");
        }

        await ctx.db.insert("signals", {
            callId: args.callId,
            senderId: user._id,
            type: args.type,
            data: args.data,
            createdAt: Date.now(),
        });
    },
});

/**
 * Real-time subscription query to fetch all signals for a call
 */
export const getSignals = query({
    args: { callId: v.string() },
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

        // Fetch the existing call
        const call = await ctx.db
            .query("calls")
            .withIndex("by_callId", (q) => q.eq("callId", args.callId))
            .unique();

        if (!call) return [];

        // Security check: only allow call participants to view signals
        if (!call.participants.includes(user._id)) {
            throw new Error("Unauthorized: Only participants can view signals");
        }

        // Fetch and return the signals (Convex handles real-time reactively here)
        return await ctx.db
            .query("signals")
            .withIndex("by_callId", (q) => q.eq("callId", args.callId))
            .collect();
    },
});

/**
 * Updates the overall state of the call (e.g., ringing -> active -> ended)
 */
export const updateCallStatus = mutation({
    args: {
        callId: v.string(),
        status: v.union(v.literal("ringing"), v.literal("active"), v.literal("ended")),
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

        // Fetch the existing call
        const call = await ctx.db
            .query("calls")
            .withIndex("by_callId", (q) => q.eq("callId", args.callId))
            .unique();

        if (!call) throw new Error("Call not found");

        // Security check: only allow call participants to update status
        if (!call.participants.includes(user._id)) {
            throw new Error("Unauthorized: Only participants can update call status");
        }

        await ctx.db.patch(call._id, {
            status: args.status,
        });
    },
});

/**
 * Gets the currently active or ringing call for a conversation
 */
export const getActiveCall = query({
    args: { conversationId: v.id("conversations") },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) return null;

        const calls = await ctx.db
            .query("calls")
            .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
            .collect();

        // Return the most recent non-ended call
        return calls.filter(c => c.status !== "ended").pop() || null;
    }
});
