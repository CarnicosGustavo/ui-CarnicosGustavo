// Ficha 360° de un cliente (Vercel) — réplica de customers.getDetail de M1.
// GET /api/customer?id=N
// Devuelve datos del cliente, pedidos recientes y totales (gastado, saldo, precios propios).
// orders.total_amount en CENTAVOS → pesos; credit_* en PESOS.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
	process.env.SUPABASE_URL || "https://uajezdrnqujmutjokwfo.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const c2p = (c) => Math.round(Number(c || 0)) / 100;
const num = (x) => Number(x || 0);
const PAID = ["COMPLETADA", "completed"];

export default async function handler(req, res) {
	res.setHeader("Cache-Control", "no-store");
	if (!SERVICE_KEY) return res.status(200).json({ _source: "mock" });
	const id = Number(req.query?.id || 0);
	if (!id) return res.status(400).json({ error: "id requerido" });

	const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
	try {
		const { data: c } = await db.from("customers")
			.select("id, name, contact_name, email, phone, whatsapp_phone, address, status, price_list_id").eq("id", id).single();
		if (!c) return res.status(404).json({ error: "cliente no encontrado" });
		const [{ data: orders }, { data: charges }, { data: payments }, { data: own }, { data: acct }] = await Promise.all([
			db.from("orders").select("id, status, total_amount, created_at").eq("customer_id", id).order("id", { ascending: false }).limit(50),
			db.from("credit_charges").select("amount").eq("customer_id", id),
			db.from("credit_payments").select("amount").eq("customer_id", id),
			db.from("customer_prices").select("product_id").eq("customer_id", id),
			db.from("credit_accounts").select("credit_limit, terms_days").eq("customer_id", id).limit(1),
		]);
		const ordersOut = (orders || []).map((o) => ({ id: o.id, status: o.status, total: c2p(o.total_amount), fecha: o.created_at }));
		const totalSpent = (orders || []).filter((o) => PAID.includes(o.status)).reduce((s, o) => s + c2p(o.total_amount), 0);
		const totalCargos = (charges || []).reduce((s, r) => s + num(r.amount), 0);
		const totalAbonos = (payments || []).reduce((s, r) => s + num(r.amount), 0);
		return res.status(200).json({
			customer: {
				id: c.id, name: c.name, contact: c.contact_name, email: c.email,
				phone: c.phone || c.whatsapp_phone, address: c.address, status: c.status,
			},
			orders: ordersOut, totalOrders: (orders || []).length,
			totalSpent: +totalSpent.toFixed(2),
			balance: +(totalCargos - totalAbonos).toFixed(2),
			customPriceCount: (own || []).length,
			account: acct && acct[0] ? { creditLimit: num(acct[0].credit_limit), termsDays: num(acct[0].terms_days) } : null,
		});
	} catch (e) {
		console.error("customer", e?.message);
		return res.status(500).json({ error: e?.message || "Error" });
	}
}
