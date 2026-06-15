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

// === Fase 2: despiece físico (réplica de products.processDisassembly / convertToVariant) ===
// OJO: la capa serverless NO tiene transacciones. Por eso se VALIDAN padre y
// recetas ANTES de escribir; aun así la operación no es 100% atómica.
const norPieces = (v) => (v > 50 ? v / 1000 : v);
const norRatio = (v) => (v > 1 ? v / 1000 : v);

async function disassemble(db, args) {
	const qty = Math.round(Number(args.quantityToProcess) || 0);
	const type = args.transformationType || "BASE";
	if (!args.parentProductId || qty <= 0) return { error: "parentProductId y quantityToProcess>0 requeridos" };
	const { data: parent } = await db.from("products")
		.select("id, name, stock_pieces, weighed_pieces, stock_kg").eq("id", args.parentProductId).single();
	if (!parent) return { error: "producto padre no encontrado" };
	if (Number(parent.stock_pieces) < qty) return { error: `stock insuficiente: hay ${parent.stock_pieces} canales, se piden ${qty}` };
	// recetas efectivas: BASE + tipo, dedup por hijo (el tipo específico gana)
	const types = type === "BASE" ? ["BASE"] : ["BASE", type];
	const { data: recs } = await db.from("product_transformations")
		.select("child_product_id, yield_quantity_pieces, yield_weight_ratio, transformation_type")
		.eq("parent_product_id", parent.id).in("transformation_type", types).eq("is_active", true);
	const eff = new Map();
	for (const r of recs || []) if (r.transformation_type === "BASE") eff.set(r.child_product_id, r);
	for (const r of recs || []) if (r.transformation_type === type) eff.set(r.child_product_id, r);
	if (eff.size === 0) return { error: `no hay recetas activas para despiezar ${parent.name} (${type})` };
	// peso por pieza del padre (real)
	const stockKg = Number(parent.stock_kg || 0);
	const parentAvg = Number(parent.stock_pieces) > 0 ? stockKg / Number(parent.stock_pieces) : 0;
	const kgToRemove = qty * parentAvg;
	// 1) descontar el padre
	const nextPieces = Number(parent.stock_pieces) - qty;
	const nextWeighed = Math.max(0, Math.min(Number(parent.weighed_pieces || 0), nextPieces));
	await db.from("products").update({
		stock_pieces: nextPieces, weighed_pieces: nextWeighed,
		stock_kg: Math.max(0, stockKg - kgToRemove).toFixed(3),
	}).eq("id", parent.id);
	await db.from("inventory_transactions").insert({
		product_id: parent.id, quantity_change_pieces: -qty,
		quantity_change_kg: kgToRemove ? (-kgToRemove).toFixed(3) : null,
		transaction_type: "DESPIECE", reference_id: parent.id,
		notes: `Salida por despiece ${type}`,
	});
	// 2) sumar los hijos
	let children = 0;
	for (const r of eff.values()) {
		const cp = Math.round(qty * norPieces(Number(r.yield_quantity_pieces)));
		const ck = qty * norRatio(Number(r.yield_weight_ratio)) * parentAvg;
		const { data: child } = await db.from("products").select("stock_pieces, stock_kg").eq("id", r.child_product_id).single();
		if (!child) continue;
		await db.from("products").update({
			stock_pieces: Number(child.stock_pieces) + cp,
			stock_kg: (Number(child.stock_kg || 0) + ck).toFixed(3),
		}).eq("id", r.child_product_id);
		await db.from("inventory_transactions").insert({
			product_id: r.child_product_id, quantity_change_pieces: cp,
			quantity_change_kg: ck ? ck.toFixed(3) : null,
			transaction_type: "DESPIECE", reference_id: parent.id,
			notes: `Entrada por despiece ${type} de ${parent.name}`,
		});
		children++;
	}
	return { parentProductId: parent.id, processed: qty, childrenCreated: children };
}

async function toVariant(db, args) {
	const pieces = Math.round(Number(args.pieces) || 0);
	if (!args.baseProductId || !args.variantProductId || pieces <= 0)
		return { error: "baseProductId, variantProductId y pieces>0 requeridos" };
	const { data: tr } = await db.from("product_transformations")
		.select("yield_weight_ratio").eq("parent_product_id", args.baseProductId)
		.eq("child_product_id", args.variantProductId).eq("is_variant", true).limit(1);
	const ratio = tr && tr[0] ? (Number(tr[0].yield_weight_ratio) || 1) : 1;
	const { data: base } = await db.from("products").select("stock_pieces, stock_kg, avg_weight_per_piece_kg").eq("id", args.baseProductId).single();
	const { data: variant } = await db.from("products").select("stock_pieces, stock_kg").eq("id", args.variantProductId).single();
	if (!base || !variant) return { error: "producto base o variante no encontrado" };
	const baseAvg = Number(base.stock_pieces) > 0 ? Number(base.stock_kg) / Number(base.stock_pieces) : Number(base.avg_weight_per_piece_kg || 0);
	const kgBase = pieces * baseAvg;
	const kgVar = kgBase * ratio;
	await db.from("products").update({ stock_pieces: Number(base.stock_pieces) - pieces, stock_kg: (Number(base.stock_kg) - kgBase).toFixed(3) }).eq("id", args.baseProductId);
	await db.from("products").update({ stock_pieces: Number(variant.stock_pieces) + pieces, stock_kg: (Number(variant.stock_kg) + kgVar).toFixed(3) }).eq("id", args.variantProductId);
	await db.from("inventory_transactions").insert({ product_id: args.baseProductId, quantity_change_pieces: -pieces, quantity_change_kg: kgBase ? (-kgBase).toFixed(3) : null, transaction_type: "VARIANTE", reference_id: args.variantProductId, notes: "Conversión a variante" });
	await db.from("inventory_transactions").insert({ product_id: args.variantProductId, quantity_change_pieces: pieces, quantity_change_kg: kgVar ? kgVar.toFixed(3) : null, transaction_type: "VARIANTE", reference_id: args.baseProductId, notes: "Conversión a variante" });
	return { baseProductId: args.baseProductId, variantProductId: args.variantProductId, pieces };
}

// === Fase 3: rendimiento / calibración (réplica de yields.calibrateFromDay de M1) ===
// Recalcula product_transformations.yield_weight_ratio con pesos REALES del día.
// En ui-CG las piezas pesadas quedan en order_items.status="COMPLETADO" y
// quantity_kg está en GRAMOS (kg×1000). Raíz: ratio = kgPieza/kgCanalTotal;
// sub-pieza: ratio = kgPieza/kgPadre. Solo toca piezas con peso ese día.
async function calibrateYields(db, date) {
	const { data: buys } = await db.from("channel_purchases").select("total_kg, verified_kg, purchase_date").eq("purchase_date", date);
	const totalCanalKg = (buys || []).reduce((a, b) => a + (b.verified_kg != null ? Number(b.verified_kg) : Number(b.total_kg) || 0), 0);
	if (!(totalCanalKg > 0)) return { error: "sin compra de canales para esa fecha" };
	const { data: ords } = await db.from("orders").select("id, created_at");
	const dayOids = (ords || []).filter((o) => (o.created_at || "").slice(0, 10) === date).map((o) => o.id);
	const realW = new Map();
	if (dayOids.length) {
		const { data: ois } = await db.from("order_items").select("product_id, quantity_kg, status").in("order_id", dayOids);
		for (const it of ois || []) if (it.product_id != null && it.status === "COMPLETADO")
			realW.set(it.product_id, (realW.get(it.product_id) || 0) + Number(it.quantity_kg || 0) / 1000);
	}
	if (realW.size === 0) return { error: "no hay piezas pesadas (COMPLETADO) ese día" };
	const { data: txns } = await db.from("product_transformations").select("id, parent_product_id, child_product_id").eq("is_active", true);
	const childIds = new Set((txns || []).map((t) => t.child_product_id));
	const isRoot = (pid) => !childIds.has(pid);
	let updated = 0;
	for (const t of txns || []) {
		const childKg = realW.get(t.child_product_id);
		if (!childKg || childKg <= 0) continue;
		let newRatio;
		if (isRoot(t.parent_product_id)) newRatio = childKg / totalCanalKg;
		else { const parentKg = realW.get(t.parent_product_id); if (!parentKg || parentKg <= 0) continue; newRatio = childKg / parentKg; }
		await db.from("product_transformations").update({ yield_weight_ratio: newRatio.toFixed(4) }).eq("id", t.id);
		updated++;
	}
	return { updated, totalCanalKg: +totalCanalKg.toFixed(3), piezasPesadas: realW.size };
}

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
	const scopedW = (q) => (USER_UID ? q.eq("user_uid", USER_UID) : q.gte("id", 0));

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

			// edición/eliminación de cargos y abonos (montos en PESOS)
			case "charge.update": {
				if (!p.id) return fail("id requerido");
				const patch = {};
				if (p.amount !== undefined) patch.amount = Number(p.amount).toFixed(2);
				if (p.concept !== undefined) patch.concept = p.concept;
				if (p.date !== undefined) patch.charge_date = p.date;
				const { error } = await db.from("credit_charges").update(patch).eq("id", p.id);
				if (error) throw error;
				return ok({});
			}
			case "charge.delete": {
				if (!p.id) return fail("id requerido");
				const { error } = await db.from("credit_charges").delete().eq("id", p.id);
				if (error) throw error;
				return ok({});
			}
			case "payment.updateAmount": {
				if (!p.id) return fail("id requerido");
				const patch = {};
				if (p.amount !== undefined) patch.amount = Number(p.amount).toFixed(2);
				if (p.method !== undefined) patch.method = p.method;
				if (p.date !== undefined) patch.payment_date = p.date;
				if (p.notes !== undefined) patch.notes = p.notes;
				const { error } = await db.from("credit_payments").update(patch).eq("id", p.id);
				if (error) throw error;
				return ok({});
			}
			case "payment.deleteAbono": {
				if (!p.id) return fail("id requerido");
				const { error } = await db.from("credit_payments").delete().eq("id", p.id);
				if (error) throw error;
				return ok({});
			}
			case "account.set": {
				if (!p.customerId) return fail("customerId requerido");
				const row = { customer_id: p.customerId, credit_limit: Number(p.creditLimit || 0).toFixed(2), terms_days: Math.round(Number(p.termsDays) || 0) };
				const { data: ex } = await db.from("credit_accounts").select("id").eq("customer_id", p.customerId).limit(1);
				if (ex && ex[0]) await db.from("credit_accounts").update({ ...row, updated_at: new Date().toISOString() }).eq("id", ex[0].id);
				else await db.from("credit_accounts").insert(row);
				return ok({});
			}

			// ---------- RESETS (zona de peligro; requieren confirm "RESET") ----------
			case "reset.stock": {
				if (p.confirm !== "RESET") return fail("confirmación 'RESET' requerida");
				const adminPw = process.env.ADMIN_RESET_PASSWORD || process.env.SEED_TOKEN || "";
				if (adminPw && p.adminPassword !== adminPw) return fail("contraseña de administrador inválida", 401);
				const { data: prods } = await scopedW(db.from("products").select("id"));
				const { error } = await scopedW(db.from("products").update({
					stock_pieces: 0, weighed_pieces: 0, stock_kg: "0.000",
					stock_pieces_frozen: 0, stock_kg_frozen: "0.000",
				}));
				if (error) throw error;
				return ok({ productsReset: (prods || []).length });
			}
			case "reset.customers": {
				if (p.confirm !== "RESET") return fail("confirmación 'RESET' requerida");
				const adminPw = process.env.ADMIN_RESET_PASSWORD || process.env.SEED_TOKEN || "";
				if (adminPw && p.adminPassword !== adminPw) return fail("contraseña de administrador inválida", 401);
				const { data: custs } = await scopedW(db.from("customers").select("id"));
				const cids = (custs || []).map((c) => c.id);
				const { data: ords } = await scopedW(db.from("orders").select("id"));
				const oids = (ords || []).map((o) => o.id);
				if (oids.length) await db.from("order_items").delete().in("order_id", oids);
				if (cids.length) {
					await db.from("credit_payments").delete().in("customer_id", cids);
					await db.from("credit_charges").delete().in("customer_id", cids);
					await db.from("customer_prices").delete().in("customer_id", cids);
					await db.from("credit_accounts").delete().in("customer_id", cids);
				}
				if (oids.length) await db.from("orders").delete().in("id", oids);
				if (cids.length) await db.from("customers").delete().in("id", cids);
				await scopedW(db.from("transactions").delete());
				return ok({ deletedCustomers: cids.length, deletedOrders: oids.length });
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

			// ---------- PEDIDOS: actualizar estado / eliminar ----------
			case "order.update": {
				if (!p.id) return fail("id requerido");
				const patch = {};
				if (p.status !== undefined) patch.status = p.status; // p.ej. "cancelled"
				if (p.total_amount !== undefined) patch.total_amount = Math.round(Number(p.total_amount));
				const { error } = await db.from("orders").update(patch).eq("id", p.id);
				if (error) throw error;
				return ok({});
			}
			case "order.delete": {
				if (!p.id) return fail("id requerido");
				await db.from("order_items").delete().eq("order_id", p.id);
				const { error } = await db.from("orders").delete().eq("id", p.id);
				if (error) throw error;
				return ok({});
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

			// ---------- DESPIECE FÍSICO ----------
			case "despiece.process": {
				const r = await disassemble(db, p);
				if (r.error) return fail(r.error);
				return ok(r);
			}
			case "despiece.toVariant": {
				const r = await toVariant(db, p);
				if (r.error) return fail(r.error);
				return ok(r);
			}

			// ---------- RECETAS (product_transformations) ----------
			case "recipe.upsert": {
				if (!p.parentProductId || !p.childProductId || !p.transformationType)
					return fail("parentProductId, childProductId y transformationType requeridos");
				const row = {
					parent_product_id: p.parentProductId,
					child_product_id: p.childProductId,
					yield_quantity_pieces: Number(p.yieldQuantityPieces ?? 0).toFixed(2),
					yield_weight_ratio: Number(p.yieldWeightRatio ?? 0).toFixed(4),
					transformation_type: p.transformationType,
					is_active: p.isActive !== false,
				};
				let id = p.id;
				if (id) {
					const { error } = await db.from("product_transformations").update(row).eq("id", id);
					if (error) throw error;
				} else {
					// upsert por (parent, child, type)
					const { data: ex } = await db.from("product_transformations").select("id")
						.eq("parent_product_id", p.parentProductId).eq("child_product_id", p.childProductId)
						.eq("transformation_type", p.transformationType).limit(1);
					if (ex && ex[0]) { id = ex[0].id; await db.from("product_transformations").update(row).eq("id", id); }
					else { const { data, error } = await db.from("product_transformations").insert(row).select("id").single(); if (error) throw error; id = data.id; }
				}
				// marcar al padre como despiezable
				await db.from("products").update({ is_parent_product: true }).eq("id", p.parentProductId);
				return ok({ id });
			}
			case "recipe.quickUpdate": {
				if (!p.id) return fail("id requerido");
				const set = {};
				if (p.yieldQuantityPieces !== undefined) set.yield_quantity_pieces = Number(p.yieldQuantityPieces).toFixed(2);
				if (p.yieldWeightRatio !== undefined) set.yield_weight_ratio = Number(p.yieldWeightRatio).toFixed(4);
				if (p.isVariant !== undefined) set.is_variant = !!p.isVariant;
				if (!Object.keys(set).length) return fail("nada que actualizar");
				const { error } = await db.from("product_transformations").update(set).eq("id", p.id);
				if (error) throw error;
				return ok({ id: p.id });
			}
			case "recipe.setActive": {
				if (!p.id || p.isActive === undefined) return fail("id e isActive requeridos");
				const { error } = await db.from("product_transformations").update({ is_active: !!p.isActive }).eq("id", p.id);
				if (error) throw error;
				return ok({ id: p.id });
			}
			case "recipe.setRefWeight": {
				if (!p.productId) return fail("productId requerido");
				const kg = Number(p.kg) || 0;
				const { error } = await db.from("products").update({ avg_weight_per_piece_kg: kg > 0 ? kg.toFixed(3) : null }).eq("id", p.productId);
				if (error) throw error;
				return ok({ productId: p.productId });
			}
			case "recipe.classifyOrphan": {
				if (!p.productId || !["purchased", "duplicate"].includes(p.action)) return fail("productId y action(purchased|duplicate) requeridos");
				const category = p.action === "purchased" ? "Compra" : "Duplicado";
				const { error } = await db.from("products").update({ category }).eq("id", p.productId);
				if (error) throw error;
				return ok({ productId: p.productId, category });
			}

			// ---------- RENDIMIENTO / YIELDS ----------
			case "yield.save": {
				// Inserta una hoja de rendimiento + sus piezas (kg en KILOS, no gramos).
				const { data: sheet, error: e1 } = await db.from("yield_sheets").insert({
					sheet_date: p.sheetDate || today(),
					num_canales: Math.round(Number(p.numCanales) || 0),
					kg_comprado: Number(p.kgComprado || 0).toFixed(3),
					supplier: p.supplier || null, notes: p.notes || null, user_uid: USER_UID,
				}).select("id").single();
				if (e1) throw e1;
				const items = Array.isArray(p.items) ? p.items : [];
				if (items.length) {
					const rows = items.map((it, i) => ({
						sheet_id: sheet.id, product_id: it.productId ?? null,
						product_name: it.productName || "—", pieces: Math.round(Number(it.pieces) || 0),
						kg_total: Number(it.kgTotal || 0).toFixed(3), weighed: !!it.weighed, sort_order: it.sortOrder ?? i,
					}));
					const { error: e2 } = await db.from("yield_sheet_items").insert(rows);
					if (e2) throw e2;
				}
				return ok({ id: sheet.id });
			}
			case "yield.calibrate": {
				const r = await calibrateYields(db, p.date || today());
				if (r.error) return fail(r.error);
				return ok(r);
			}

			// ---------- CEDIS (verificación de canales recibidos) ----------
			case "cedis.addSupplier": {
				const { data, error } = await db.from("channel_purchases").insert({
					supplier: p.supplier || "Proveedor", purchase_date: p.date || today(), user_uid: USER_UID,
				}).select("id").single();
				if (error) throw error;
				return ok({ id: data.id });
			}
			case "cedis.save": {
				if (!Array.isArray(p.rows)) return fail("rows[] requerido");
				let count = 0;
				for (const r of p.rows) {
					if (!r.id) continue;
					const mode = r.mode === "total" ? "total" : "canal";
					const verifCanales = mode === "total" ? Math.round(Number(r.totalCanales) || 0) : (r.weights || []).length;
					const verifKg = mode === "total" ? Number(r.totalKg || 0) : (r.weights || []).reduce((a, b) => a + (Number(b) || 0), 0);
					await db.from("channel_purchases").update({
						verified_canales: verifCanales > 0 ? verifCanales : null,
						verified_kg: verifKg > 0 ? verifKg.toFixed(3) : null,
						cedis_detail: { mode, tara: Number(r.tara) || 0, weights: r.weights || [], totalKg: Number(r.totalKg) || 0, totalCanales: Math.round(Number(r.totalCanales) || 0) },
					}).eq("id", r.id);
					count++;
				}
				return ok({ count });
			}

			// ---------- COMPRA A PROVEEDOR (productos directos; NO idempotente) ----------
			case "purchase.recordSupplier": {
				const items = (Array.isArray(p.items) ? p.items : []).filter((it) => Number(it.pieces) > 0 || Number(it.kg) > 0);
				if (!items.length) return ok({ count: 0 });
				let count = 0;
				for (const it of items) {
					const { data: prod } = await db.from("products").select("stock_pieces, stock_kg").eq("id", it.productId).single();
					if (!prod) continue;
					await db.from("products").update({
						stock_pieces: Number(prod.stock_pieces || 0) + Math.round(Number(it.pieces) || 0),
						stock_kg: (Number(prod.stock_kg || 0) + Number(it.kg || 0)).toFixed(3),
					}).eq("id", it.productId);
					await db.from("inventory_transactions").insert({
						product_id: it.productId, quantity_change_pieces: Math.round(Number(it.pieces) || 0) || null,
						quantity_change_kg: Number(it.kg) > 0 ? Number(it.kg).toFixed(3) : null,
						transaction_type: "COMPRA", reference_id: null,
						notes: `Compra a proveedor${p.supplier ? ` ${p.supplier}` : ""} (${p.date || today()})${it.pricePerKg ? ` · $${it.pricePerKg}/kg` : ""}`,
					});
					count++;
				}
				return ok({ count });
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

export { deductInventoryForOrder, syncCanalStock, disassemble, toVariant, calibrateYields };
