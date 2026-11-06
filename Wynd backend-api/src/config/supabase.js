const { createClient } = require("@supabase/supabase-js");

let client = null;

function getStorage() {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
        throw new Error("Supabase environment variables are not set.");
    }
    if (!client) {
        client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
            auth: { persistSession: false, autoRefreshToken: false }
        });
    }
    return { client, bucket: process.env.SUPABASE_BUCKET || "wynd-assets" };
}

module.exports = { getStorage };