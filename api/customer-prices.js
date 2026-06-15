// Lectura por cliente (Vercel) — precios efectivos de un cliente.
// GET /api/customer-prices?customerId=N
// Devuelve { items:[{ productId, n, cat, kg, pz, hasCustom }] } con la prioridad
// del M1: precio propio del cliente → lista asignada → precio base del producto.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
	process.env.SUPABASE_URL || "https://uajezdrnqujmutjokwfo.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const USER_UID = process.env.CG_USER_UID || null;
const num = (x) => Number(x || 0);

export default async function handler(req, res) {
	res.setHeader("Cache-Control", "s-maxage=10, stale-while-revalidate=60");
	if (!SERVICE_KEY) return res.status(200).json({ items: [], _source: "mock" });
	const customerId = Number(req.query?.customerId || 0);
	if (!customerId) return res.status(400).json({ error: "customerId requerido" });

	const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
	const scoped = (q) => (USER_UID ? q.eq("user_uid", USER_UID) : q);
	try {
		const { data: products } = await scoped(
			db.from("products").select("id, name, category, price_per_kg, price_per_piece"),
		).order("name");
		const { data: own } = await db.from("customer_prices")
			.select("product_id, price_per_kg, price_per_piece").eq("customer_id", customerId);
		const ownMap = new Map((own || []).map((o) => [o.product_id, o]));
		const { data: cust } = await db.from("customers")
			.select("price_list_id").eq("id", customerId).single();
		let listMap = new Map();
		if (cust?.price_list_id) {
			const { data: li } = await db.from("price_list_items")
				.select("product_id, unit_price_per_kg, unit_price_per_piece")
				.eq("price_list_id", cust.price_list_id);
			listMap = new Map((li || []).map((x) => [x.product_id, x]));
		}
		const items = (products || []).map((p) => {
			const o = ownMap.get(p.id);
			const l = listMap.get(p.id);
			const kg = o?.price_per_kg ?? l?.unit_price_per_kg ?? p.price_per_kg;
			const pz = o?.price_per_piece ?? l?.unit_price_per_piece ?? p.price_per_piece;
			return {
				productId: p.id, n: p.name, cat: p.category || "Otros",
				kg: kg != null ? num(kg) : 0,
				pz: pz != null ? num(pz) : null,
				hasCustom: !!o && (o.price_per_kg != null || o.price_per_piece != null),
			};
		});
		return res.status(200).json({ items });
	} catch (e) {
		console.error("customer-prices", e?.message);
		return res.status(500).json({ error: e?.message || "Error" });
	}
}
