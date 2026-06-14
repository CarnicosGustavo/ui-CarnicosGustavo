// Función serverless (Vercel) — Hito 2.
// Lee Supabase con la SERVICE-ROLE key (lado servidor; el secreto nunca llega al
// navegador) y devuelve un JSON con la MISMA forma que CG.* del prototipo.
// El cliente (cg-data.jsx) hace deep-merge sobre los datos mock: cualquier
// sección que aquí falle o no se mapee, conserva su mock — la app nunca se rompe.
//
// Variables de entorno requeridas en Vercel (Production/Preview/Development):
//   SUPABASE_URL                 https://uajezdrnqujmutjokwfo.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY    (secreto; NUNCA en el cliente)
//   CG_USER_UID                  (opcional) filtra por dueño; si no, lee todo.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
	process.env.SUPABASE_URL || "https://uajezdrnqujmutjokwfo.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const USER_UID = process.env.CG_USER_UID || null;

const money = (cents) => Math.round(Number(cents || 0)) / 100;

// Mapea estados internos del backend a las etiquetas del prototipo.
function estadoLabel(s) {
	switch (s) {
		case "COMPLETADA":
		case "completed":
			return "Pagada";
		case "LISTA_PARA_COBRO":
			return "Lista para cobro";
		case "PROCESANDO_PAGO":
			return "Procesando pago";
		case "PENDIENTE_PESAJE":
			return "Por pesar";
		case "PARCIAL_DISPONIBLE":
			return "Parcial";
		case "cancelled":
		case "CANCELADA":
			return "Cancelada";
		default:
			return "Pendiente";
	}
}

function scoped(query) {
	return USER_UID ? query.eq("user_uid", USER_UID) : query;
}

export default async function handler(req, res) {
	res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=120");

	if (!SERVICE_KEY) {
		// Sin credenciales: el cliente seguirá con los datos mock.
		return res
			.status(200)
			.json({ _source: "mock", _note: "SUPABASE_SERVICE_ROLE_KEY no configurada" });
	}

	const db = createClient(SUPABASE_URL, SERVICE_KEY, {
		auth: { persistSession: false },
	});
	const out = { _source: "supabase", config: {}, ops: {} };

	// --- config.productos ---
	try {
		const { data } = await scoped(
			db
				.from("products")
				.select(
					"name, is_parent_product, price_per_kg, price_per_piece, stock_pieces",
				),
		).order("name");
		if (data?.length) {
			out.config.productos = data.map((p) => ({
				n: p.name,
				tipo: p.is_parent_product ? "Padre" : "Hijo",
				rend: null,
				precio: Number(p.price_per_kg ?? p.price_per_piece ?? 0),
				stock: Number(p.stock_pieces ?? 0),
			}));
		}
	} catch (e) {
		console.error("productos", e?.message);
	}

	// --- ops.clientes ---
	try {
		const { data: custs } = await scoped(
			db.from("customers").select("id, name, phone, whatsapp_phone, status"),
		);
		if (custs?.length) {
			// Saldos por cliente (cargos − abonos)
			const ids = custs.map((c) => c.id);
			const [{ data: charges }, { data: payments }] = await Promise.all([
				db.from("credit_charges").select("customer_id, amount").in("customer_id", ids),
				db.from("credit_payments").select("customer_id, amount").in("customer_id", ids),
			]);
			const sum = (rows) => {
				const m = new Map();
				for (const r of rows ?? [])
					m.set(r.customer_id, (m.get(r.customer_id) ?? 0) + Number(r.amount || 0));
				return m;
			};
			const ch = sum(charges);
			const pa = sum(payments);
			out.ops.clientes = custs.map((c) => ({
				id: c.id,
				nombre: c.name,
				tel: c.phone ?? c.whatsapp_phone ?? "",
				saldo: (ch.get(c.id) ?? 0) - (pa.get(c.id) ?? 0),
				estado: c.status === "inactive" ? "Inactivo" : "Activo",
				pedidos: 0,
				gastado: 0,
			}));

			// --- ops.cobranza (solo los que deben) ---
			out.ops.cobranza = out.ops.clientes
				.filter((c) => c.saldo > 0.005)
				.map((c) => ({
					cliente: c.nombre,
					cargos: ch.get(c.id) ?? 0,
					abonos: pa.get(c.id) ?? 0,
					saldo: c.saldo,
					dias: 0,
				}))
				.sort((a, b) => b.saldo - a.saldo);
		}
	} catch (e) {
		console.error("clientes/cobranza", e?.message);
	}

	// --- ops.pedidos ---
	try {
		const { data } = await scoped(
			db
				.from("orders")
				.select("id, total_amount, status, created_at, customers(name)"),
		)
			.order("id", { ascending: false })
			.limit(40);
		if (data?.length) {
			out.ops.pedidos = data.map((o) => ({
				id: o.id,
				cliente: o.customers?.name ?? `Cliente #${o.id}`,
				total: money(o.total_amount),
				estado: estadoLabel(o.status),
				fecha: o.created_at
					? new Date(o.created_at).toLocaleDateString("es-MX", {
							day: "2-digit",
							month: "2-digit",
						})
					: "",
				items: 0,
			}));
		}
	} catch (e) {
		console.error("pedidos", e?.message);
	}

	return res.status(200).json(out);
}
