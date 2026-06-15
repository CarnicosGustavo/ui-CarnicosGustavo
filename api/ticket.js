// Ticket de un pedido (Vercel) — réplica de tickets.generateTicket de M1.
// GET /api/ticket?orderId=N
// Montos: orders.total_amount / order_items.subtotal / unit_price en CENTAVOS → pesos.
//         order_items.quantity_kg en GRAMOS → kg.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
	process.env.SUPABASE_URL || "https://uajezdrnqujmutjokwfo.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const c2p = (c) => Math.round(Number(c || 0)) / 100;
const num = (x) => Number(x || 0);
const pad6 = (n) => String(n).padStart(6, "0");

export default async function handler(req, res) {
	res.setHeader("Cache-Control", "s-maxage=10, stale-while-revalidate=60");
	if (!SERVICE_KEY) return res.status(200).json({ _source: "mock" });
	const orderId = Number(req.query?.orderId || 0);
	if (!orderId) return res.status(400).json({ error: "orderId requerido" });

	const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
	try {
		const { data: order } = await db.from("orders")
			.select("id, total_amount, status, created_at, customer_id, customers(name, phone, whatsapp_phone)")
			.eq("id", orderId).single();
		if (!order) return res.status(404).json({ error: "pedido no encontrado" });
		const { data: its } = await db.from("order_items")
			.select("product_name, quantity_pieces, quantity_kg, unit_price, subtotal").eq("order_id", orderId);
		const items = (its || []).map((it) => ({
			productName: it.product_name || "—",
			quantityPieces: num(it.quantity_pieces),
			quantityKg: num(it.quantity_kg) / 1000,
			unitPrice: c2p(it.unit_price),
			subtotal: c2p(it.subtotal),
		}));
		const totalKg = items.reduce((s, it) => s + it.quantityKg, 0);
		const totalAmount = c2p(order.total_amount);
		// estado de pago: transacción income (pagado) / cargo a crédito / pendiente
		const [{ data: tx }, { data: ch }] = await Promise.all([
			db.from("transactions").select("id").eq("order_id", orderId).eq("type", "income").limit(1),
			db.from("credit_charges").select("id").eq("order_id", orderId).limit(1),
		]);
		const paymentStatus = (tx && tx[0]) ? "PAGADO" : (ch && ch[0]) ? "CREDITO" : "PENDIENTE";
		return res.status(200).json({
			ticketNumber: pad6(order.id), orderNumber: order.id,
			customerName: order.customers?.name || null,
			customerPhone: order.customers?.whatsapp_phone || order.customers?.phone || null,
			date: order.created_at, status: order.status,
			items, totalKg: +totalKg.toFixed(3), totalAmount, paymentStatus,
		});
	} catch (e) {
		console.error("ticket", e?.message);
		return res.status(500).json({ error: e?.message || "Error" });
	}
}
