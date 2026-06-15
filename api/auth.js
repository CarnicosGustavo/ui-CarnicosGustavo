// Endpoint serverless de AUTENTICACIÓN — Supabase Auth (email + contraseña).
// Usa la ANON key (pública) para signInWithPassword / getUser. La SERVICE key
// nunca se usa aquí. El cliente guarda el access_token y lo manda en cada lectura
// protegida si se desea; el user_uid de la sesión puede sustituir a CG_USER_UID.
//
// Env: SUPABASE_URL, SUPABASE_ANON_KEY.
// Setup previo (una vez): crear los usuarios en Supabase → Authentication → Users.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://uajezdrnqujmutjokwfo.supabase.co";
const ANON_KEY = process.env.SUPABASE_ANON_KEY || "";

export default async function handler(req, res) {
	if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });
	if (!ANON_KEY) return res.status(503).json({ error: "Auth no configurada (falta SUPABASE_ANON_KEY)" });

	let body = req.body;
	if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
	const { op, ...p } = body || {};
	const db = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });

	try {
		switch (op) {
			case "auth.login": {
				if (!p.email || !p.password) return res.status(400).json({ error: "email y password requeridos" });
				const { data, error } = await db.auth.signInWithPassword({ email: p.email, password: p.password });
				if (error || !data?.session) return res.status(401).json({ error: "credenciales inválidas" });
				return res.status(200).json({
					ok: true,
					token: data.session.access_token,
					refresh: data.session.refresh_token,
					expiresAt: data.session.expires_at,
					user: { id: data.user.id, email: data.user.email },
				});
			}
			case "auth.verify": {
				if (!p.token) return res.status(400).json({ error: "token requerido" });
				const { data, error } = await db.auth.getUser(p.token);
				if (error || !data?.user) return res.status(401).json({ ok: false });
				return res.status(200).json({ ok: true, user: { id: data.user.id, email: data.user.email } });
			}
			case "auth.logout":
				return res.status(200).json({ ok: true });
			default:
				return res.status(400).json({ error: `Operación desconocida: ${op}` });
		}
	} catch (e) {
		console.error("auth", op, e?.message);
		return res.status(500).json({ error: e?.message || "Error de auth" });
	}
}
