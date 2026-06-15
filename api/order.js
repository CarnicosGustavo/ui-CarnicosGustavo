// Detalle de un pedido (Vercel) para editar líneas. GET /api/order?id=N
// Devuelve los items en la MISMA forma que usa el modal de pedido del cliente:
//   { id, cliente, customerId, lista, items:[{ n, precio, pz, kg, disp, cat, productId }] }
// unit_price (centavos)→pesos; quantity_kg (gramos)→kg.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
	process.env.SUPABASE_URL || "https://uajezdrnqujmutjokwfo.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const c2p = (c) => Math.round(Number(c || 0)) / 100;
const num = (x) => Number(x || 0);

export default async function handler(req, res) {
	res.setHeader("Cache-Control", "no-store");
	if (!SERVICE_KEY) return res.status(200).json({ _source: "mock" });
	const id = Number(req.query?.id || 0);
	if (!id) return res.status(400).json({ error: "id requerido" });

	const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
	try {
		const { data: order } = await db.from("orders")
			.select("id, customer_id, status, customers(name)").eq("id", id).single();
		if (!order) return res.status(404).json({ error: "pedido no encontrado" });
		const { data: its } = await db.from("order_items")
			.select("product_id, product_name, quantity_pieces, quantity_kg, unit_price, products(category, is_sellable_by_weight)").eq("order_id", id);
		const items = (its || []).map((it) => {
			const kg = num(it.quantity_kg) / 1000;
			const byWeight = !!it.products?.is_sellable_by_weight && !(num(it.quantity_pieces) > 0);
			return {
				productId: it.product_id || null, n: it.product_name || "—",
				precio: c2p(it.unit_price), pz: Math.max(1, num(it.quantity_pieces) || 1), kg,
				cat: it.products?.category || "Otros", disp: byWeight ? "pesaje" : "stock",
			};
		});
		return res.status(200).json({
			id: order.id, cliente: order.customers?.name || "", customerId: order.customer_id || null,
			status: order.status, items,
		});
	} catch (e) {
		console.error("order", e?.message);
		return res.status(500).json({ error: e?.message || "Error" });
	}
}
