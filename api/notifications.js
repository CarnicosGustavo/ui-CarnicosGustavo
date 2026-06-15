// Endpoint serverless de NOTIFICACIONES (avisos de iAntonella) — Hito notif.
// Computa avisos reales del negocio desde Supabase (service-role) con la MISMA
// forma que consume el NotificationCenter del diseño: { id, tipo, titulo, desc,
// href, time }. tipo ∈ alerta|aviso|info. href = id de módulo para __cgGo.
// Réplica de la lógica de antonella.notifications de M1.
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://uajezdrnqujmutjokwfo.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const mny = (n) => "$" + Number(n || 0).toLocaleString("es-MX", { maximumFractionDigits: 0 });

export default async function handler(req, res) {
	if (!SERVICE_KEY) return res.status(200).json({ _source: "mock", count: 0, items: [] });
	const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
	const items = [];

	// 1) Cobranza pendiente (saldo = cargos − abonos por cliente)
	try {
		const [{ data: ch }, { data: pa }] = await Promise.all([
			db.from("credit_charges").select("customer_id, amount"),
			db.from("credit_payments").select("customer_id, amount"),
		]);
		const bal = {};
		for (const c of ch || []) bal[c.customer_id] = (bal[c.customer_id] || 0) + Number(c.amount || 0);
		for (const p of pa || []) bal[p.customer_id] = (bal[p.customer_id] || 0) - Number(p.amount || 0);
		const deudores = Object.values(bal).filter((v) => v > 0.5);
		const total = deudores.reduce((s, v) => s + v, 0);
		if (deudores.length) items.push({
			id: "cobranza", tipo: total > 2000 ? "alerta" : "aviso", titulo: "Cobranza pendiente",
			desc: `${deudores.length} cliente(s) con saldo por cobrar (${mny(total)}).`, href: "cobranza", time: "hoy",
		});
	} catch (e) { console.error("notif.cobranza", e?.message); }

	// 2) Pedidos por pesar / por cobrar
	try {
		const { data: orders } = await db.from("orders").select("status");
		const porPesar = (orders || []).filter((o) => ["PENDIENTE_PESAJE", "PARCIAL_DISPONIBLE"].includes(o.status)).length;
		const porCobrar = (orders || []).filter((o) => ["LISTA_PARA_COBRO", "PROCESANDO_PAGO"].includes(o.status)).length;
		if (porPesar) items.push({ id: "pesaje", tipo: "aviso", titulo: "Pedidos por pesar", desc: `${porPesar} pedido(s) esperan pesaje antes de cobrar.`, href: "bascula", time: "hoy" });
		if (porCobrar) items.push({ id: "cobro", tipo: "info", titulo: "Pedidos por cobrar", desc: `${porCobrar} pedido(s) listos para cobro.`, href: "cobro", time: "hoy" });
	} catch (e) { console.error("notif.pedidos", e?.message); }

	// 3) Despiece sugerido (demanda viva: piezas pedidas pendientes de pesaje)
	try {
		const { data: its } = await db.from("order_items").select("quantity_pieces").eq("status", "PENDIENTE_PESAJE");
		const pzs = (its || []).reduce((s, it) => s + (Number(it.quantity_pieces) || 0), 0);
		if (pzs > 0) items.push({ id: "despiece", tipo: "info", titulo: "Despiece sugerido", desc: `${pzs} pieza(s) pedidas por producir. iAntonella puede calcular el despiece.`, href: "despiece", time: "hoy" });
	} catch (e) { console.error("notif.despiece", e?.message); }

	// 4) Despiece realizado recientemente (últimas 6 h) → confirma la acción
	try {
		const since = new Date(Date.now() - 6 * 3600 * 1000).toISOString();
		const { data: dz } = await db.from("inventory_transactions")
			.select("quantity_change_pieces, created_at").eq("transaction_type", "DESPIECE").gte("created_at", since);
		const prod = (dz || []).filter((t) => Number(t.quantity_change_pieces) > 0).reduce((s, t) => s + Number(t.quantity_change_pieces), 0);
		if (prod > 0) items.push({ id: "despiece-ok", tipo: "info", titulo: "Despiece realizado", desc: `Se produjeron ${prod} pieza(s) por despiece recientemente.`, href: "despiece", time: "hoy" });
	} catch (e) { console.error("notif.despiece-ok", e?.message); }

	return res.status(200).json({ _source: "supabase", count: items.length, items });
}
