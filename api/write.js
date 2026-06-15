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

// === Fase 0: integridad de inventario (réplica de la lógica de M1) ===

// Descuenta inventario por una venta. Por cada order_item con product_id baja
// stock_pieces y stock_kg y registra una transacción VENTA. OJO: en ui-CG
// order_items.quantity_kg está en GRAMOS (kg×1000); stock_kg está en kg.
async function deductInventoryForOrder(db, orderId) {
	const { data: items } = await db
		.from("order_items")
		.select("product_id, quantity_pieces, quantity_kg")
		.eq("order_id", orderId);
	for (const it of items || []) {
		if (!it.product_id) continue;
		const { data: prod } = await db
			.from("products")
			.select("stock_pieces, weighed_pieces, stock_kg")
			.eq("id", it.product_id)
			.single();
		if (!prod) continue;
		const kg = it.quantity_kg ? Number(it.quantity_kg) / 1000 : 0; // gramos→kg
		const pieces = it.quantity_pieces ? Number(it.quantity_pieces) : 0;
		const nextPieces = pieces ? Number(prod.stock_pieces || 0) - pieces : Number(prod.stock_pieces || 0);
		const nextWeighed = Math.max(0, Math.min(Number(prod.weighed_pieces || 0), nextPieces));
		const nextKg = Number(prod.stock_kg || 0) - kg; // puede quedar negativo: se compensa al despiezar
		await db.from("products").update({
			stock_pieces: nextPieces,
			weighed_pieces: nextWeighed,
			stock_kg: nextKg.toFixed(3),
		}).eq("id", it.product_id);
		await db.from("inventory_transactions").insert({
			product_id: it.product_id,
			quantity_change_pieces: pieces ? -pieces : null,
			quantity_change_kg: kg > 0 ? (-kg).toFixed(3) : null,
			transaction_type: "VENTA",
			reference_id: orderId,
			notes: `Venta pedido #${orderId}`,
		});
	}
}

// Recalcula el stock de los canales: comprado (todas las fechas) − despiezado.
// Idempotente: re-guardar la compra no genera doble conteo. Réplica de M1.
async function syncCanalStock(db, uid) {
	const { data: purch } = await db
		.from("channel_purchases")
		.select("qty_americano, qty_nacional")
		.eq("user_uid", uid);
	let amer = 0, nac = 0;
	for (const r of purch || []) { amer += Number(r.qty_americano) || 0; nac += Number(r.qty_nacional) || 0; }
	const { data: canales } = await db
		.from("products")
		.select("id, name, avg_weight_per_piece_kg")
		.eq("user_uid", uid)
		.eq("is_parent_product", true)
		.ilike("name", "CANAL%");
	if (!canales || !canales.length) return;
	const { data: used } = await db
		.from("inventory_transactions")
		.select("product_id, quantity_change_pieces")
		.eq("transaction_type", "DESPIECE");
	const usedMap = {};
	for (const u of used || []) {
		const pid = Number(u.product_id);
		usedMap[pid] = (usedMap[pid] || 0) + (-(Number(u.quantity_change_pieces) || 0));
	}
	for (const c of canales) {
		const n = String(c.name).toUpperCase();
		const purchased = n.includes("AMERICANO") ? amer : n.includes("NACIONAL") ? nac : 0;
		const stock = purchased - (usedMap[Number(c.id)] || 0);
		const avg = Number(c.avg_weight_per_piece_kg) || 0;
		await db.from("products").update({
			stock_pieces: stock,
			stock_kg: (stock * avg).toFixed(3),
		}).eq("id", c.id);
	}
}

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

			// ---------- PEDIDOS: editar cabecera (estado/total/cliente/notas) ----------
			// total_amount entra en PESOS y se guarda en CENTAVOS (convención ui-CG).
			case "order.update": {
				if (!p.id) return fail("id requerido");
				const patch = {};
				if (p.status !== undefined) patch.status = p.status;
				if (p.total_amount !== undefined) patch.total_amount = Math.round(Number(p.total_amount) * 100);
				if (p.customerId !== undefined) patch.customer_id = p.customerId;
				if (p.notes !== undefined) patch.notes = p.notes;
				if (!Object.keys(patch).length) return fail("nada que actualizar");
				const { error } = await db.from("orders").update(patch).eq("id", p.id);
				if (error) throw error;
				return ok({ id: p.id });
			}

			// ---------- PEDIDOS: eliminar (items + cabecera) ----------
			case "order.delete": {
				if (!p.id) return fail("id requerido");
				const { error: e1 } = await db.from("order_items").delete().eq("order_id", p.id);
				if (e1) throw e1;
				const { error } = await db.from("orders").delete().eq("id", p.id);
				if (error) throw error;
				return ok({ id: p.id });
			}

			// ---------- PEDIDOS: reemplazar renglones (edición completa) ----------
			// Réplica de orders.replaceItems de M1: borra los renglones, recrea desde
			// items[], recalcula total/estado/requires_weighing y sincroniza el monto
			// de un cargo a crédito o transacción ya asociados al pedido.
			case "order.replaceItems": {
				if (!p.orderId || !Array.isArray(p.items)) return fail("orderId e items[] requeridos");
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
				const needWeigh = rows.some((r) => r.status === "PENDIENTE_PESAJE");
				const { error: ed } = await db.from("order_items").delete().eq("order_id", p.orderId);
				if (ed) throw ed;
				for (const r of rows) {
					const { error: ie } = await db.from("order_items").insert({ ...r, order_id: p.orderId });
					if (ie) throw ie;
				}
				const upd = { total_amount: total, requires_weighing: needWeigh };
				upd.status = p.status !== undefined ? p.status : (needWeigh ? "PENDIENTE_PESAJE" : "LISTA_PARA_COBRO");
				if (p.customerId !== undefined) upd.customer_id = p.customerId;
				if (p.notes !== undefined) upd.notes = p.notes;
				const { error } = await db.from("orders").update(upd).eq("id", p.orderId);
				if (error) throw error;
				// Mantener consistentes montos ya cobrados/cargados de este pedido.
				await db.from("credit_charges").update({ amount: (total / 100).toFixed(2) }).eq("order_id", p.orderId);
				await db.from("transactions").update({ amount: total }).eq("order_id", p.orderId);
				return ok({ orderId: p.orderId, total, status: upd.status });
			}

			// ---------- COMPRA DEL DÍA (channel_purchases) ----------
			// Reemplaza las compras de HOY del usuario y RE-SINCRONIZA el stock de
			// canales (comprado − despiezado), idéntico a M1. Idempotente.
			case "purchases.save": {
				if (!Array.isArray(p.rows)) return fail("rows[] requerido");
				const d = today();
				await db.from("channel_purchases").delete().eq("user_uid", USER_UID).eq("purchase_date", d);
				for (const r of p.rows) {
					const { error } = await db.from("channel_purchases").insert({
						supplier: r.supplier || null,
						qty_americano: Math.round(Number(r.americanos) || 0),
						qty_nacional: Math.round(Number(r.nacionales) || 0),
						num_medias: Math.round(Number(r.canales) || 0),
						total_kg: Number(r.kgPie || 0).toFixed(3),
						price_per_kg: r.precioKg != null ? Number(r.precioKg).toFixed(2) : null,
						purchase_date: d, user_uid: USER_UID,
					});
					if (error) throw error;
				}
				await syncCanalStock(db, USER_UID);
				return ok({ saved: p.rows.length });
			}

			// ---------- PRODUCTOS (catálogo) ----------
			case "product.create": {
				if (!p.name) return fail("name requerido");
				const { data, error } = await db.from("products").insert({
					name: p.name, category: p.category || null, user_uid: USER_UID,
					is_parent_product: !!p.is_parent_product,
					price_per_kg: p.price_per_kg != null ? Number(p.price_per_kg).toFixed(2) : null,
					stock_pieces: p.stock_pieces != null ? Math.round(Number(p.stock_pieces)) : 0,
				}).select("id").single();
				if (error) throw error;
				return ok({ id: data.id });
			}
			case "product.update": {
				if (!p.id) return fail("id requerido");
				const patch = {};
				if (p.name !== undefined) patch.name = p.name;
				if (p.category !== undefined) patch.category = p.category;
				if (p.price_per_kg !== undefined) patch.price_per_kg = p.price_per_kg != null ? Number(p.price_per_kg).toFixed(2) : null;
				if (p.stock_pieces !== undefined) patch.stock_pieces = Math.round(Number(p.stock_pieces));
				if (p.is_parent_product !== undefined) patch.is_parent_product = !!p.is_parent_product;
				const { error } = await db.from("products").update(patch).eq("id", p.id);
				if (error) throw error;
				return ok({});
			}
			case "product.delete": {
				if (!p.id) return fail("id requerido");
				const { error } = await db.from("products").delete().eq("id", p.id);
				if (error) throw error;
				return ok({});
			}

			// ---------- BÁSCULA: registrar peso de un artículo ----------
			case "order.weighItem": {
				if (!p.orderItemId || !(Number(p.kg) > 0)) return fail("orderItemId y kg>0 requeridos");
				const { data: it, error: e1 } = await db.from("order_items")
					.select("order_id, unit_price").eq("id", p.orderItemId).single();
				if (e1) throw e1;
				const grams = Math.round(Number(p.kg) * 1000);
				const subtotal = Math.round(Number(it.unit_price || 0) * Number(p.kg)); // centavos
				const { error: e2 } = await db.from("order_items")
					.update({ quantity_kg: grams, subtotal, status: "COMPLETADO" }).eq("id", p.orderItemId);
				if (e2) throw e2;
				// recalcular total + estado del pedido
				const { data: items } = await db.from("order_items").select("subtotal, status").eq("order_id", it.order_id);
				const total = (items || []).reduce((s, r) => s + Number(r.subtotal || 0), 0);
				const pend = (items || []).some((r) => r.status === "PENDIENTE_PESAJE");
				await db.from("orders").update({
					total_amount: total, status: pend ? "PENDIENTE_PESAJE" : "LISTA_PARA_COBRO", requires_weighing: pend,
				}).eq("id", it.order_id);
				return ok({ orderId: it.order_id, done: !pend });
			}

			// ---------- COBRO: fijar precios y cobrar ----------
			// Versión segura: aplica precios, marca COMPLETADA y crea transacción
			// (contado) o cargo a crédito. NO descuenta inventario (a validar).
			case "order.priceAndCharge": {
				if (!p.orderId || !Array.isArray(p.items) || !p.items.length)
					return fail("orderId e items[] requeridos");
				// Estado previo: si ya estaba COMPLETADA, NO se vuelve a descontar
				// inventario (evita doble baja en re-cobros).
				const { data: ordPrev } = await db.from("orders")
					.select("status, customer_id").eq("id", p.orderId).single();
				const alreadyCharged = ordPrev?.status === "COMPLETADA";
				let total = 0;
				for (const it of p.items) {
					const { data: oi } = await db.from("order_items")
						.select("quantity_kg, quantity_pieces").eq("id", it.orderItemId).single();
					const kg = oi?.quantity_kg ? Number(oi.quantity_kg) / 1000 : 0;
					const unit = Math.round(Number(it.pricePerKg || 0) * 100); // centavos por kg/pza
					const sub = kg > 0 ? Math.round(unit * kg) : unit * (oi?.quantity_pieces || 0);
					total += sub;
					await db.from("order_items").update({ unit_price: unit, subtotal: sub, status: "COMPLETADO" }).eq("id", it.orderItemId);
				}
				// Descuento de inventario (réplica de M1 completeOrderPayment).
				if (!alreadyCharged) await deductInventoryForOrder(db, p.orderId);
				await db.from("orders").update({ total_amount: total, status: "COMPLETADA" }).eq("id", p.orderId);
				if (p.paymentType === "credito") {
					if (ordPrev?.customer_id) await db.from("credit_charges").insert({
						customer_id: ordPrev.customer_id, amount: (total / 100).toFixed(2),
						concept: `Pedido #${p.orderId}`, source: "pedido", order_id: p.orderId, charge_date: today(),
					});
				} else {
					await db.from("transactions").insert({
						description: `Cobro pedido #${p.orderId}`, amount: total, type: "income",
						category: "Ventas", status: "completed", user_uid: USER_UID, order_id: p.orderId,
					});
				}
				return ok({ orderId: p.orderId, total, inventoryDeducted: !alreadyCharged });
			}

			default:
				return fail(`Operación desconocida: ${op}`, 400);
		}
	} catch (e) {
		console.error("write", op, e?.message);
		return res.status(500).json({ error: e?.message || "Error de escritura" });
	}
}

export { deductInventoryForOrder, syncCanalStock };
