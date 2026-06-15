// Estado de cuenta detallado de un cliente (Vercel) — réplica de collections.getStatement de M1.
// GET /api/statement?customerId=N
// Devuelve { ledger:[{ tipo:"cargo"|"abono", id, fecha, concepto, cargo, abono, orderId, source }],
//            totalCargos, totalAbonos, balance, account:{ creditLimit, termsDays } }
// Montos en PESOS (credit_charges/credit_payments.amount son numeric(12,2)).

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
	process.env.SUPABASE_URL || "https://uajezdrnqujmutjokwfo.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const num = (x) => Number(x || 0);

export default async function handler(req, res) {
	res.setHeader("Cache-Control", "s-maxage=10, stale-while-revalidate=60");
	if (!SERVICE_KEY) return res.status(200).json({ ledger: [], _source: "mock" });
	const customerId = Number(req.query?.customerId || 0);
	if (!customerId) return res.status(400).json({ error: "customerId requerido" });

	const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
	try {
		const [{ data: charges }, { data: payments }, { data: acct }] = await Promise.all([
			db.from("credit_charges").select("id, amount, concept, charge_date, order_id, source").eq("customer_id", customerId),
			db.from("credit_payments").select("id, amount, method, notes, payment_date").eq("customer_id", customerId),
			db.from("credit_accounts").select("credit_limit, terms_days").eq("customer_id", customerId).limit(1),
		]);
		const ledger = [];
		let totalCargos = 0, totalAbonos = 0;
		for (const c of charges || []) {
			totalCargos += num(c.amount);
			ledger.push({ tipo: "cargo", id: c.id, fecha: c.charge_date, concepto: c.concept || "Cargo", cargo: num(c.amount), abono: 0, orderId: c.order_id || null, source: c.source || "ticket_viejo" });
		}
		for (const p of payments || []) {
			totalAbonos += num(p.amount);
			ledger.push({ tipo: "abono", id: p.id, fecha: p.payment_date, concepto: p.notes || (p.method ? `Abono (${p.method})` : "Abono"), cargo: 0, abono: num(p.amount), orderId: null, source: "abono" });
		}
		ledger.sort((a, b) => String(a.fecha || "").localeCompare(String(b.fecha || "")));
		const account = acct && acct[0] ? { creditLimit: num(acct[0].credit_limit), termsDays: num(acct[0].terms_days) } : null;
		return res.status(200).json({
			ledger, totalCargos: +totalCargos.toFixed(2), totalAbonos: +totalAbonos.toFixed(2),
			balance: +(totalCargos - totalAbonos).toFixed(2), account,
		});
	} catch (e) {
		console.error("statement", e?.message);
		return res.status(500).json({ error: e?.message || "Error" });
	}
}
