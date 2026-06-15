// Función serverless (Vercel) — Hito 2.
// Lee Supabase con la SERVICE-ROLE key (lado servidor; el secreto nunca llega al
// navegador) y devuelve un JSON con la MISMA forma que CG.* del prototipo.
// El cliente (cg-data.jsx) hace deep-merge sobre los datos mock: cualquier
// sección que aquí falle o no se mapee, conserva su mock — la app nunca se rompe.
//
// Convenciones de dinero (del backend M1):
//   orders.total_amount / order_items.* / transactions.amount  → CENTAVOS (÷100)
//   credit_charges.amount / credit_payments.amount             → PESOS (directo)
//   products.price_per_kg / price_list_items.* / customer_prices.* → PESOS
//
// Variables de entorno requeridas en Vercel:
//   SUPABASE_URL                 https://uajezdrnqujmutjokwfo.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY    (secreto)
//   CG_USER_UID                  (opcional) filtra por dueño; si no, lee todo.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
	process.env.SUPABASE_URL || "https://uajezdrnqujmutjokwfo.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const USER_UID = process.env.CG_USER_UID || null;

const c2p = (c) => Math.round(Number(c || 0)) / 100; // centavos → pesos
const num = (x) => Number(x || 0);
const COLORS = ["red", "tan", "amber", "green", "blue"];

function estadoLabel(s) {
	switch (s) {
		case "COMPLETADA": case "completed": return "Pagada";
		case "LISTA_PARA_COBRO": return "Lista para cobro";
		case "PROCESANDO_PAGO": return "Procesando pago";
		case "PENDIENTE_PESAJE": return "Por pesar";
		case "PARCIAL_DISPONIBLE": return "Parcial";
		case "cancelled": case "CANCELADA": return "Cancelada";
		default: return "Pendiente";
	}
}
function fechaCorta(d) {
	if (!d) return "";
	return new Date(d).toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit" });
}
function dispOf(p) {
	const sp = num(p.stock_pieces), sk = num(p.stock_kg);
	if (sp > 0 || sk > 0) return p.is_sellable_by_weight ? "pesaje" : "stock";
	return "faltante";
}

export default async function handler(req, res) {
	res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=120");
	if (!SERVICE_KEY) {
		return res.status(200).json({ _source: "mock", _note: "SUPABASE_SERVICE_ROLE_KEY no configurada" });
	}
	const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
	const scoped = (q) => (USER_UID ? q.eq("user_uid", USER_UID) : q);
	const out = { _source: "supabase", data: {}, config: {}, ops: {} };

	// Cargamos productos una vez (los reusan varias secciones)
	let products = [];
	try {
		const { data } = await scoped(db.from("products").select("*")).order("name");
		products = data || [];
	} catch (e) { console.error("products", e?.message); }

	// ---------- config.productos ----------
	try {
		if (products.length) out.config.productos = products.map((p) => ({
			id: p.id,
			n: p.name,
			tipo: p.is_parent_product ? "Padre" : "Hijo",
			rend: null,
			precio: num(p.price_per_kg ?? p.price_per_piece),
			stock: num(p.stock_pieces),
		}));
	} catch (e) { console.error("config.productos", e?.message); }

	// ---------- config.cold ----------
	try {
		const cold = products
			.filter((p) => num(p.stock_kg) || num(p.stock_pieces) || num(p.stock_kg_frozen) || num(p.stock_pieces_frozen))
			.slice(0, 30)
			.map((p) => ({
				id: p.id,
				n: p.name,
				fresco: [num(p.stock_kg), num(p.stock_pieces)],
				frio: [num(p.stock_kg_frozen), num(p.stock_pieces_frozen)],
			}));
		if (cold.length) out.config.cold = cold;
	} catch (e) { console.error("config.cold", e?.message); }

	// ---------- config.payment ----------
	try {
		const { data } = await db.from("payment_methods").select("name").order("id");
		if (data?.length) out.config.payment = data.map((m) => m.name);
	} catch (e) { console.error("config.payment", e?.message); }

	// ---------- config.caja (transactions) ----------
	try {
		const { data } = await scoped(db.from("transactions").select("id, description, category, type, amount, created_at"))
			.order("id", { ascending: false }).limit(50);
		if (data?.length) out.config.caja = data.map((t) => ({
			id: t.id, desc: t.description || "—", cat: t.category || "General",
			tipo: t.type === "expense" ? "Egreso" : "Ingreso",
			fecha: fechaCorta(t.created_at), importe: c2p(t.amount),
		}));
	} catch (e) { console.error("config.caja", e?.message); }

	// ---------- ops.pos ----------
	try {
		const { data: lists } = await scoped(db.from("price_lists").select("name")).order("name");
		const listas = lists?.length ? lists.map((l) => l.name) : ["Mayoreo contado"];
		const catalogo = products
			.filter((p) => p.is_sellable_by_unit || p.is_sellable_by_weight)
			.slice(0, 40)
			.map((p) => ({
				id: p.id,
				n: p.name,
				precio: num(p.price_per_kg ?? p.price_per_piece),
				disp: dispOf(p),
				stock: `${num(p.stock_pieces)} pz / ${num(p.stock_kg)} kg`,
				cat: p.category || "Otros",
			}));
		out.ops.pos = { listas, catalogo, carrito: [] };
	} catch (e) { console.error("ops.pos", e?.message); }

	// ---------- config.precios (lista por defecto) ----------
	try {
		const { data: pl } = await scoped(db.from("price_lists").select("id, name, is_default"))
			.order("is_default", { ascending: false });
		const list = pl && pl[0];
		if (list) {
			const { data: items } = await db.from("price_list_items")
				.select("unit_price_per_kg, unit_price_per_piece, products(name, category)")
				.eq("price_list_id", list.id);
			const lista = (items || []).map((it) => ({
				n: it.products?.name || "—",
				cat: it.products?.category || "Otros",
				kg: num(it.unit_price_per_kg),
				pz: it.unit_price_per_piece != null ? num(it.unit_price_per_piece) : null,
			}));
			if (lista.length) out.config.precios = { cliente: list.name, lista };
		}
	} catch (e) { console.error("config.precios", e?.message); }

	// ---------- clientes (con saldos) ----------
	let customers = [];
	try {
		const { data } = await scoped(db.from("customers").select("id, name, phone, whatsapp_phone, status"));
		customers = data || [];
	} catch (e) { console.error("customers", e?.message); }
	let chMap = new Map(), paMap = new Map();
	try {
		if (customers.length) {
			const ids = customers.map((c) => c.id);
			const [{ data: charges }, { data: payments }] = await Promise.all([
				db.from("credit_charges").select("customer_id, amount").in("customer_id", ids),
				db.from("credit_payments").select("customer_id, amount").in("customer_id", ids),
			]);
			const sum = (rows) => { const m = new Map(); for (const r of rows || []) m.set(r.customer_id, (m.get(r.customer_id) || 0) + num(r.amount)); return m; };
			chMap = sum(charges); paMap = sum(payments);
			out.ops.clientes = customers.map((c) => ({
				id: c.id, nombre: c.name, tel: c.phone || c.whatsapp_phone || "",
				saldo: (chMap.get(c.id) || 0) - (paMap.get(c.id) || 0),
				estado: c.status === "inactive" ? "Inactivo" : "Activo", pedidos: 0, gastado: 0,
			}));
			out.ops.cobranza = out.ops.clientes
				.filter((c) => c.saldo > 0.005)
				.map((c) => ({ id: c.id, cliente: c.nombre, cargos: chMap.get(c.id) || 0, abonos: paMap.get(c.id) || 0, saldo: c.saldo, dias: 0 }))
				.sort((a, b) => b.saldo - a.saldo);
		}
	} catch (e) { console.error("cobranza", e?.message); }

	// ---------- ops.pedidos ----------
	let orders = [];
	try {
		const { data } = await scoped(db.from("orders").select("id, total_amount, status, created_at, requires_weighing, customer_id, customers(name)"))
			.order("id", { ascending: false }).limit(40);
		orders = data || [];
		// conteo real de artículos por pedido
		const _oids = orders.map((o) => o.id);
		const _cnt = {};
		if (_oids.length) {
			const { data: _oi } = await db.from("order_items").select("order_id").in("order_id", _oids);
			for (const r of _oi || []) _cnt[r.order_id] = (_cnt[r.order_id] || 0) + 1;
		}
		if (orders.length) out.ops.pedidos = orders.map((o) => ({
			id: o.id, cliente: o.customers?.name || `Cliente #${o.id}`,
			total: c2p(o.total_amount), estado: estadoLabel(o.status), fecha: fechaCorta(o.created_at), items: _cnt[o.id] || 0,
		}));
	} catch (e) { console.error("ops.pedidos", e?.message); }

	// ---------- data.panel ----------
	try {
		const ingresos = orders.filter((o) => ["Pagada"].includes(estadoLabel(o.status))).reduce((s, o) => s + c2p(o.total_amount), 0);
		// gastos: compra de canales (total_kg * price_per_kg)
		const { data: ch } = await scoped(db.from("channel_purchases").select("total_kg, price_per_kg"));
		const gastos = (ch || []).reduce((s, r) => s + num(r.total_kg) * num(r.price_per_kg), 0);
		const ganancia = ingresos - gastos;
		const margen = ingresos > 0 ? Math.round((ganancia / ingresos) * 100) : 0;
		// ingresos por categoría (order_items.subtotal en centavos)
		const { data: items } = await db.from("order_items").select("subtotal, products(category)").limit(2000);
		const byCat = new Map();
		for (const it of items || []) {
			const cat = it.products?.category || "Otros";
			byCat.set(cat, (byCat.get(cat) || 0) + c2p(it.subtotal));
		}
		const ingresosCat = [...byCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
			.map(([n, v], i) => ({ n, v: Math.round(v), c: COLORS[i % COLORS.length] }));
		// flujo: últimos 12 días por total de pedidos
		const byDay = new Map();
		for (const o of orders) { const d = (o.created_at || "").slice(0, 10); if (d) byDay.set(d, (byDay.get(d) || 0) + c2p(o.total_amount)); }
		const days = [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-12).map((e) => e[1]);
		const maxD = Math.max(1, ...days);
		const flujo = days.length ? days.map((v) => Math.max(6, Math.round((v / maxD) * 100))) : undefined;
		out.data.panel = {
			ingresos: Math.round(ingresos), gastos: Math.round(gastos), ganancia: Math.round(ganancia), margen,
			...(ingresosCat.length ? { ingresosCat } : {}),
			...(flujo ? { flujo } : {}),
		};
	} catch (e) { console.error("data.panel", e?.message); }

	// ---------- data.compra ----------
	try {
		const { data: ch } = await scoped(db.from("channel_purchases").select("*"))
			.order("purchase_date", { ascending: false }).limit(20);
		if (ch?.length) {
			const proveedores = ch.map((r) => ({
				nombre: r.supplier || "Proveedor", americanos: num(r.qty_americano), nacionales: num(r.qty_nacional),
				canales: num(r.num_medias), kgPie: num(r.total_kg), precioKg: num(r.price_per_kg),
				kgCanal: num(r.num_medias) ? num(r.total_kg) / num(r.num_medias) : 0,
			}));
			const sum = (k) => proveedores.reduce((s, p) => s + p[k], 0);
			out.data.compra = {
				fecha: ch[0].purchase_date ? new Date(ch[0].purchase_date).toLocaleDateString("es-MX") : "",
				americanos: sum("americanos"), nacionales: sum("nacionales"), canales: sum("canales"),
				kgPie: sum("kgPie"), kgCanal: sum("canales") ? +(sum("kgPie") / sum("canales")).toFixed(1) : 0,
				proveedores,
			};
		}
	} catch (e) { console.error("data.compra", e?.message); }

	// ---------- data.despiece ----------
	try {
		const parents = products.filter((p) => p.is_parent_product);
		const canalOf = (p) => {
			const u = (p.name || "").toUpperCase();
			const id = u.includes("AMERICAN") ? "ame" : u.includes("ESPILOMO") ? "esp" : u.includes("LOMO") ? "lom" : "p" + p.id;
			return { id, nombre: p.name, disp: num(p.stock_pieces), kg: num(p.avg_weight_per_piece_kg) || (num(p.stock_pieces) ? num(p.stock_kg) / num(p.stock_pieces) : 105), pid: p.id };
		};
		const canales = parents.filter((p) => (p.name || "").toUpperCase().includes("CANAL")).map(canalOf);
		canales.forEach((c, i) => { c.tono = ["red", "blue", "green"][i % 3]; });
		const main = canales[0];
		let piezas = [];
		if (main) {
			const { data: tr } = await db.from("product_transformations")
				.select("yield_quantity_pieces, yield_weight_ratio, is_variant, child_product_id, products!product_transformations_child_product_id_fkey(name, category, is_parent_product)")
				.eq("parent_product_id", main.pid).eq("is_active", true);
			piezas = (tr || []).filter((t) => !t.is_variant).map((t) => ({
				n: t.products?.name || "—",
				pz: num(t.yield_quantity_pieces),
				pct: +(num(t.yield_weight_ratio) * 100).toFixed(2),
				ped: 0,
				...(t.products?.is_parent_product ? { hijo: true } : {}),
			}));
		}
		if (canales.length) out.data.despiece = { canales, piezas };
	} catch (e) { console.error("data.despiece", e?.message); }

	// ---------- data.bascula / data.cobro ----------
	try {
		const { data: pend } = await scoped(db.from("orders")
			.select("id, total_amount, status, customer_id, customers(name)"))
			.in("status", ["PENDIENTE_PESAJE", "PARCIAL_DISPONIBLE"]).order("id").limit(1);
		const o = pend && pend[0];
		if (o) {
			const { data: its } = await db.from("order_items")
				.select("id, product_name, quantity_kg, products(category)").eq("order_id", o.id);
			const list = its || [];
			const first = list[0];
			out.data.bascula = {
				pedido: { id: o.id, cliente: o.customers?.name || `#${o.id}`, total: c2p(o.total_amount) },
				item: { nombre: first?.product_name || "—", cat: first?.products?.category || "—", idx: 1, total: list.length || 1 },
				items: list.map((it) => ({ orderItemId: it.id, nombre: it.product_name, cat: it.products?.category || "—", solicitadoKg: num(it.quantity_kg) / 1000 })),
			};
		}
	} catch (e) { console.error("data.bascula", e?.message); }
	try {
		const { data: cobro } = await scoped(db.from("orders")
			.select("id, status, customer_id, customers(name)"))
			.in("status", ["LISTA_PARA_COBRO", "PROCESANDO_PAGO"]).order("id").limit(10);
		if (cobro?.length) {
			const first = cobro[0];
			const { data: its } = await db.from("order_items")
				.select("id, product_id, product_name, quantity_kg, unit_price").eq("order_id", first.id);
			out.data.cobro = {
				cola: cobro.map((o) => ({ id: o.id, cliente: o.customers?.name || `#${o.id}`, items: 0 })),
				pedido: {
					id: first.id, cliente: first.customers?.name || `#${first.id}`,
					lineas: (its || []).map((it) => ({
						orderItemId: it.id, productId: it.product_id, producto: it.product_name,
						kg: num(it.quantity_kg) / 1000, precio: c2p(it.unit_price),
					})),
				},
			};
		}
	} catch (e) { console.error("data.cobro", e?.message); }

	// ---------- ops.rendimiento (última hoja) ----------
	try {
		const { data: sheets } = await scoped(db.from("yield_sheets").select("*")).order("id", { ascending: false }).limit(1);
		const sh = sheets && sheets[0];
		if (sh) {
			const { data: its } = await db.from("yield_sheet_items").select("product_name, pieces, kg_total").eq("sheet_id", sh.id).order("sort_order");
			const piezas = (its || []).map((it) => ({ n: it.product_name, pz: num(it.pieces), est: num(it.kg_total), real: num(it.kg_total) }));
			const totReal = piezas.reduce((s, p) => s + p.real, 0);
			const rend = num(sh.kg_comprado) ? +((totReal / num(sh.kg_comprado)) * 100).toFixed(1) : 0;
			out.ops.rendimiento = {
				proveedor: sh.supplier || "—", canales: num(sh.num_canales), kgComprado: num(sh.kg_comprado),
				rend, rendEst: 90, piezas,
			};
		}
	} catch (e) { console.error("ops.rendimiento", e?.message); }

	return res.status(200).json(out);
}
