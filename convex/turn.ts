import { action } from "./_generated/server";

export const getIceServers = action({
    args: {},
    handler: async (ctx) => {
        // 1. Authenticate the user to prevent malicious actors from draining our TURN bandwidth
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Unauthorized to access TURN servers");
        }

        // 2. Fetch authenticated ephemereal TURN credentials from a provider (Twilio or Metered.ca)
        // Here, we provide an example using Metered.ca which provides a stable scalable global TURN network
        const METERED_DOMAIN = process.env.METERED_DOMAIN; 
        const METERED_SECRET_KEY = process.env.METERED_SECRET_KEY;

        if (METERED_DOMAIN && METERED_SECRET_KEY) {
            try {
                const response = await fetch(`https://${METERED_DOMAIN}/api/v1/turn/credentials?apiKey=${METERED_SECRET_KEY}`);
                const iceServers = await response.json();
                
                // Returns an array containing both stunned public routes and authenticated symmetric TURN routes
                return iceServers; 
            } catch (err) {
                console.error("Failed to fetch Metered TURN credentials:", err);
            }
        }

        // 3. Fallback: If no premium TURN server is configured, use public Google STUN.
        // Public STUN works for ~80% of standard home networks, but fails entirely on strict symmetric corporate firewalls.
        return [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" },
        ];
    },
});
