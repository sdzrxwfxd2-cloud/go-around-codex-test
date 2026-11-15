// /sitestatus-data: still not ported to Cloudflare (use /admin-sitestatus inside Zalaota). Private: 401 without a session.
import { requireAdmin, json } from "../lib/admin_session.mjs";
export async function onRequest({ request, env }) {
  const g = await requireAdmin(request, env);
  if (!g.ok) return g.res;
  return json({ error: "not on the Cloudflare copy yet", see: "/admin-sitestatus" }, 501);
}
