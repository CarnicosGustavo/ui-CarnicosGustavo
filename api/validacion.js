// Validación de saldos legacy (migración 2022) — lectura + acción "Validar".
// Lee de las vistas public.v_validacion_saldos / v_validacion_docs (que exponen
// staging.legacy_credit_*) con service-role, y valida vía RPC validar_saldo_legacy.
// GET  /api/validacion           → { clientes:[...], total, conSaldo }
// POST /api/validacion {op:"validate", customerId, usuario?}
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://uajezdrnqujmutjokwfo.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const num = (x) => Number(x || 0);

// Estado legible del documento a partir de saldo/importe/vencimiento.
function docEstado(importe, saldo, venc) {
	const s = num(saldo), i = num(importe);
	if (s <= 0) return "Aplicado";
	if (s < i) return "Parcial";
	if (venc && new Date(venc) < new Date()) return "Vencido";
	return "Pendiente";
}

export default async function handler(req, res) {
	if (!SERVICE_KEY) return res.status(200).json({ _source: "mock", clientes: [] });
	const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

	// Acción Validar
	if (req.method === "POST") {
		let body = req.body;
		if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
		const { op, customerId, usuario } = body || {};
		if (op !== "validate" || !customerId) return res.status(400).json({ error: "op:'validate' y customerId requeridos" });
		const { error } = await db.rpc("validar_saldo_legacy", { p_customer_id: Number(customerId), p_usuario: usuario || "sistema" });
		if (error) return res.status(500).json({ error: error.message });
		return res.status(200).json({ ok: true, customerId });
	}

	// Lectura
	try {
		const [{ data: cli }, { data: docs }] = await Promise.all([
			db.from("v_validacion_saldos").select("*"),
			db.from("v_validacion_docs").select("*"),
		]);
		const byCust = {};
		for (const d of docs || []) {
			(byCust[d.customer_id] = byCust[d.customer_id] || []).push({
				fecha: d.fecha, venc: d.venc, tipo: d.tipo, ref: d.ref,
				importe: num(d.importe), saldo: num(d.saldo),
				estado: docEstado(d.importe, d.saldo, d.venc), obs: d.obs || "",
			});
		}
		const clientes = (cli || [])
			.map((c) => ({
				id: c.id, customerId: c.customer_id, nombre: c.nombre,
				saldo: num(c.saldo), limite: num(c.limite), dias: num(c.dias),
				ndoc: num(c.ndoc), validado: !!c.validado,
				validadoPor: c.validado_por || null, validadoAt: c.validado_at || null,
				docs: (byCust[c.customer_id] || []).sort((a, b) => String(a.fecha).localeCompare(String(b.fecha))),
			}))
			.sort((a, b) => b.saldo - a.saldo); // mayores adeudos primero
		const conSaldo = clientes.filter((c) => c.saldo > 0).length;
		return res.status(200).json({ _source: "supabase", total: clientes.length, conSaldo, clientes });
	} catch (e) {
		console.error("validacion", e?.message);
		return res.status(500).json({ error: e?.message || "Error" });
	}
}
