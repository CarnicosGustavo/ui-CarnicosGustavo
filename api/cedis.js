// CEDIS — compras de canales del día (Vercel). GET /api/cedis?date=YYYY-MM-DD
// Devuelve proveedores con ids REALES de channel_purchases para poder guardar la
// verificación (cedis.save). Restaura medias ya capturadas desde cedis_detail.
// Pesos en kg.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
	process.env.SUPABASE_URL || "https://uajezdrnqujmutjokwfo.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const USER_UID = process.env.CG_USER_UID || null;
const num = (x) => Number(x || 0);

export default async function handler(req, res) {
	res.setHeader("Cache-Control", "no-store");
	if (!SERVICE_KEY) return res.status(200).json({ _source: "mock" });
	const date = String(req.query?.date || "").slice(0, 10) || new Date().toISOString().slice(0, 10);

	const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
	const scoped = (q) => (USER_UID ? q.eq("user_uid", USER_UID) : q);
	try {
		const { data: rows } = await scoped(db.from("channel_purchases")
			.select("id, supplier, total_kg, num_medias, verified_kg, verified_canales, cedis_detail, purchase_date"))
			.eq("purchase_date", date).order("id");
		const proveedores = (rows || []).map((r) => {
			const det = r.cedis_detail || {};
			const weights = Array.isArray(det.weights) ? det.weights : [];
			const tara = num(det.tara);
			const medias = weights.map((w) => ({ kg: num(w), bruto: num(w) + tara, tara }));
			const pesoReal = r.verified_kg != null ? num(r.verified_kg) : medias.reduce((s, m) => s + m.kg, 0);
			return {
				id: r.id, nombre: r.supplier || "Proveedor",
				pesoEsperado: num(r.total_kg), pesoReal, medias,
				mode: det.mode || "canal", tara,
			};
		});
		return res.status(200).json({ date, proveedores });
	} catch (e) {
		console.error("cedis", e?.message);
		return res.status(500).json({ error: e?.message || "Error" });
	}
}
