// Endpoint serverless de ESCRITURA (Vercel) — Hito 3.
// Recibe { op, ...params } y ejecuta la mutación contra Supabase con service-role.
// Solo operaciones de bajo riesgo (inserts/updates directos). El flujo de pedidos
// (create/weigh/charge) que toca inventario va en endpoints aparte y validados.
//
// Convenciones (ver docs/IMPLEMENTACION_DESDE_M1.md §0):
//   transactions.amount  → CENTAVOS (int)
//   credit_charges/payments.amount → PESOS
//   precios de producto/cliente → PESOS
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CG_USER_UID (dueño de los inserts).

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
	process.env.SUPABASE_URL || "https://uajezdrnqujmutjokwfo.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const USER_UID = process.env.CG_USER_UID || "system";

const today = () => new Date().toISOString().slice(0, 10);

export default async function handler(req, res) {
	if (req.method !== "POST")
		return res.status(405).json({ error: "Método no permitido" });
	if (!SERVICE_KEY)
		return res.status(503).json({ error: "Escritura no configurada (falta SUPABASE_SERVICE_ROLE_KEY)" });

	let body = req.body;
	if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; }
	}
	const { op, ...p } = body || {};
	if (!op) return res.status(400).json({ error: "Falta 'op'" });

	const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
	const ok = (data) => res.status(200).json({ ok: true, ...data });
	const fail = (msg, code = 400) => res.status(code).json({ error: msg });

	try {
		switch (op) {
			// ---------- COBRANZA ----------
			case "abono": {
				if (!p.customerId || !(p.amount > 0)) return fail("customerId y amount>0 requeridos");
				const { data, error } = await db.from("credit_payments").insert({
					customer_id: p.customerId, amount: Number(p.amount).toFixed(2),
					method: p.method || null, notes: p.notes || null, payment_date: p.date || today(),
				}).select("id").single();
				if (error) throw error;
				return ok({ id: data.id });
			}
			case "cargo": {
				if (!p.customerId || !(p.amount > 0)) return fail("customerId y amount>0 requeridos");
				const { data, error } = await db.from("credit_charges").insert({
					customer_id: p.customerId, amount: Number(p.amount).toFixed(2),
					concept: p.concept || null, source: p.source || "ticket_viejo",
					order_id: p.orderId || null, charge_date: p.date || today(),
				}).select("id").single();
				if (error) throw error;
				return ok({ id: data.id });
			}

			// ---------- CLIENTES ----------
			case "customer.create": {
				if (!p.name) return fail("name requerido");
				const email = p.email || `${String(p.name).toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "")}.${Date.now()}@cedis.local`;
				const { data, error } = await db.from("customers").insert({
					name: p.name, email, contact_name: p.contact_name || null,
					phone: p.phone || null, whatsapp_phone: p.whatsapp_phone || null,
					address: p.address || null, notes: p.notes || null,
					status: p.status || "active", user_uid: USER_UID,
					price_list_id: p.price_list_id ?? null,
				}).select("id").single();
				if (error) throw error;
				if (p.credit_limit != null) {
					await db.from("credit_accounts").insert({
						customer_id: data.id, credit_limit: Number(p.credit_limit).toFixed(2),
						terms_days: p.terms_days ?? 0,
					});
				}
				return ok({ id: data.id });
			}
			case "customer.update": {
				if (!p.id) return fail("id requerido");
				const patch = {};
				for (const k of ["name", "contact_name", "phone", "whatsapp_phone", "address", "notes", "status", "price_list_id"])
					if (p[k] !== undefined) patch[k] = p[k];
				const { error } = await db.from("customers").update(patch).eq("id", p.id);
				if (error) throw error;
				return ok({});
			}
			case "customer.delete": {
				if (!p.id) return fail("id requerido");
				const { error } = await db.from("customers").delete().eq("id", p.id);
				if (error) throw error;
				return ok({});
			}

			// ---------- CAJA (transactions; amount en CENTAVOS) ----------
			case "tx.create": {
				if (!p.description || !(p.amount > 0)) return fail("description y amount>0 requeridos");
				const { data, error } = await db.from("transactions").insert({
					description: p.description, amount: Math.round(Number(p.amount)),
					type: p.type === "expense" ? "expense" : "income",
					category: p.category || null, status: p.status || "completed", user_uid: USER_UID,
				}).select("id").single();
				if (error) throw error;
				return ok({ id: data.id });
			}
			case "tx.update": {
				if (!p.id) return fail("id requerido");
				const patch = {};
				if (p.description !== undefined) patch.description = p.description;
				if (p.amount !== undefined) patch.amount = Math.round(Number(p.amount));
				if (p.type !== undefined) patch.type = p.type;
				if (p.category !== undefined) patch.category = p.category;
				if (p.status !== undefined) patch.status = p.status;
				const { error } = await db.from("transactions").update(patch).eq("id", p.id);
				if (error) throw error;
				return ok({});
			}
			case "tx.delete": {
				if (!p.id) return fail("id requerido");
				const { error } = await db.from("transactions").delete().eq("id", p.id);
				if (error) throw error;
				return ok({});
			}

			// ---------- MÉTODOS DE PAGO ----------
			case "payment.create": {
				if (!p.name) return fail("name requerido");
				const { data, error } = await db.from("payment_methods").insert({ name: p.name }).select("id").single();
				if (error) throw error;
				return ok({ id: data.id });
			}
			case "payment.update": {
				if (!p.name || !p.newName) return fail("name y newName requeridos");
				const { error } = await db.from("payment_methods").update({ name: p.newName }).eq("name", p.name);
				if (error) throw error;
				return ok({});
			}
			case "payment.delete": {
				if (!p.name) return fail("name requerido");
				const { error } = await db.from("payment_methods").delete().eq("name", p.name);
				if (error) throw error;
				return ok({});
			}

			// ---------- INVENTARIO FRÍO (transfer fresco↔congelado) ----------
			case "cold.toFrozen":
			case "cold.toFresh": {
				if (!p.productId) return fail("productId requerido");
				const kg = Number(p.kg) || 0, pz = Number(p.pieces) || 0;
				const { data: prod, error: e1 } = await db.from("products")
					.select("stock_kg, stock_pieces, stock_kg_frozen, stock_pieces_frozen").eq("id", p.productId).single();
				if (e1) throw e1;
				const toFrozen = op === "cold.toFrozen";
				const sk = Number(prod.stock_kg || 0), sp = Number(prod.stock_pieces || 0);
				const fk = Number(prod.stock_kg_frozen || 0), fp = Number(prod.stock_pieces_frozen || 0);
				const patch = toFrozen
					? { stock_kg: Math.max(0, sk - kg).toFixed(3), stock_pieces: Math.max(0, sp - pz), stock_kg_frozen: (fk + kg).toFixed(3), stock_pieces_frozen: fp + pz }
					: { stock_kg: (sk + kg).toFixed(3), stock_pieces: sp + pz, stock_kg_frozen: Math.max(0, fk - kg).toFixed(3), stock_pieces_frozen: Math.max(0, fp - pz) };
				const { error } = await db.from("products").update(patch).eq("id", p.productId);
				if (error) throw error;
				return ok({});
			}

			// ---------- PRECIOS POR CLIENTE ----------
			case "prices.bulkUpsert": {
				if (!p.customerId || !Array.isArray(p.items)) return fail("customerId e items[] requeridos");
				let saved = 0;
				for (const it of p.items) {
					if (it.pricePerKg == null && it.pricePerPiece == null) continue;
					// upsert manual por (customer_id, product_id)
					const { data: ex } = await db.from("customer_prices").select("id")
						.eq("customer_id", p.customerId).eq("product_id", it.productId).limit(1);
					const row = {
						customer_id: p.customerId, product_id: it.productId,
						price_per_kg: it.pricePerKg != null ? Number(it.pricePerKg).toFixed(2) : null,
						price_per_piece: it.pricePerPiece != null ? Number(it.pricePerPiece).toFixed(2) : null,
						updated_at: new Date().toISOString(),
					};
					if (ex && ex[0]) await db.from("customer_prices").update(row).eq("id", ex[0].id);
					else await db.from("customer_prices").insert(row);
					saved++;
				}
				return ok({ saved });
			}

			// ---------- PEDIDOS: crear (POS / Nuevo pedido) ----------
			// Inserta order + order_items. NO descuenta inventario (eso ocurre al
			// cobrar). Estado: PENDIENTE_PESAJE si hay piezas por pesar, si no
			// LISTA_PARA_COBRO. Montos en centavos.
			case "order.create": {
				if (!p.customerId || !Array.isArray(p.items) || !p.items.length)
					return fail("customerId e items[] requeridos");
				const needWeigh = p.items.some((it) => it.byWeight && !(Number(it.kg) > 0));
				const rows = p.items.map((it) => {
					const unit = Math.round(Number(it.price || 0) * 100); // centavos
					const pieces = Math.max(0, parseInt(it.pieces || 0, 10));
					const kg = Number(it.kg || 0);
					const itemWeigh = it.byWeight && !(kg > 0);
					const sub = kg > 0 ? Math.round(unit * kg) : unit * pieces;
					return {
						product_id: it.productId || null,
						product_name: it.productName || "Producto",
						quantity_pieces: pieces || null,
						quantity_kg: kg > 0 ? Math.round(kg * 1000) : null, // gramos
						unit_price: unit,
						subtotal: sub,
						status: itemWeigh ? "PENDIENTE_PESAJE" : "COMPLETADO",
					};
				});
				const total = rows.reduce((s, r) => s + r.subtotal, 0);
				const { data: ord, error } = await db.from("orders").insert({
					customer_id: p.customerId,
					status: needWeigh ? "PENDIENTE_PESAJE" : "LISTA_PARA_COBRO",
					total_amount: total,
					user_uid: USER_UID,
					requires_weighing: needWeigh,
				}).select("id").single();
				if (error) throw error;
				for (const r of rows) {
					const { error: ie } = await db.from("order_items").insert({ ...r, order_id: ord.id });
					if (ie) throw ie;
				}
				return ok({ id: ord.id, status: needWeigh ? "PENDIENTE_PESAJE" : "LISTA_PARA_COBRO" });
			}

			default:
				return fail(`Operación desconocida: ${op}`, 400);
		}
	} catch (e) {
		console.error("write", op, e?.message);
		return res.status(500).json({ error: e?.message || "Error de escritura" });
	}
}
