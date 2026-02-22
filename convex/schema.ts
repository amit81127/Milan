import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
    messages: defineTable({
        authorId: v.optional(v.id("users")),
        authorName: v.string(),
        body: v.string(),
        conversationId: v.id("conversations"),
    }).index("by_conversation", ["conversationId"]),

    users: defineTable({
        name: v.string(),
        email: v.string(),
        image: v.optional(v.string()),
        tokenIdentifier: v.string(),
    }).index("by_token", ["tokenIdentifier"]),

    conversations: defineTable({
        name: v.optional(v.string()), // For group chats
        isGroup: v.boolean(),
        lastMessageId: v.optional(v.id("messages")),
    }),

    conversationMembers: defineTable({
        conversationId: v.id("conversations"),
        userId: v.id("users"),
        lastReadTime: v.optional(v.number()),
    })
        .index("by_conversation", ["conversationId"])
        .index("by_user", ["userId"])
        .index("by_conversation_user", ["conversationId", "userId"]),

    presence: defineTable({
        userId: v.id("users"),
        updatedAt: v.number(),
    }).index("by_user", ["userId"]),

    typing: defineTable({
        conversationId: v.id("conversations"),
        userId: v.id("users"),
        updatedAt: v.number(),
    }).index("by_conversation", ["conversationId"]),
});
