import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
    messages: defineTable({
        authorId: v.optional(v.id("users")),
        authorName: v.string(),
        body: v.string(),
        conversationId: v.id("conversations"),
        deleted: v.optional(v.boolean()),
        replyTo: v.optional(v.id("messages")),
        edited: v.optional(v.boolean()),
        updatedAt: v.optional(v.number()),
    }).index("by_conversation", ["conversationId"]),

    reactions: defineTable({
        messageId: v.id("messages"),
        userId: v.id("users"),
        emoji: v.string(),
    })
        .index("by_message", ["messageId"])
        .index("by_message_emoji", ["messageId", "emoji"])
        .index("by_message_user", ["messageId", "userId"]),

    users: defineTable({
        name: v.string(),
        email: v.string(),
        image: v.optional(v.string()),
        tokenIdentifier: v.string(),
        isOnline: v.optional(v.boolean()),
        lastSeen: v.optional(v.number()),
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
