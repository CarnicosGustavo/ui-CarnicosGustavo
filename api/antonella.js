// iAntonella (Vercel) — chat del asistente. Llama a la API de Anthropic si
// ANTHROPIC_API_KEY está configurada; si no, responde { _source:"mock" } y el
// cliente usa su respuesta de ejemplo (la app nunca se rompe).
//
// Env: ANTHROPIC_API_KEY (secreto), ANTONELLA_MODEL (opcional).

const KEY = process.env.ANTHROPIC_API_KEY || "";
const MODEL = process.env.ANTONELLA_MODEL || "claude-haiku-4-5-20251001";

const SYSTEM =
	"Eres iAntonella, el asistente del sistema de Cárnicos Gustavo, un CEDIS de carne de " +
	"cerdo. Respondes en español, de forma breve, concreta y práctica. Dominas inventario, " +
	"despiece (canales→piezas con recetas), pedidos, báscula, cobro, cobranza a crédito y " +
	"rendimiento. Si te piden ejecutar una acción, explica el paso a seguir en la interfaz; " +
	"no inventes cifras que no te den.";

export default async function handler(req, res) {
	if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });
	if (!KEY) return res.status(200).json({ _source: "mock" });

	let body = req.body;
	if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
	const question = String((body && body.question) || "").slice(0, 2000);
	const moduleId = String((body && body.module) || "panel");
	const context = String((body && body.context) || "").slice(0, 1500);
	if (!question) return res.status(400).json({ error: "question requerida" });

	let system = SYSTEM + ` Módulo actual del usuario: ${moduleId}.`;
	if (context) {
		system += "\n\nESTADO ACTUAL DEL SISTEMA (datos reales del día — úsalos para responder con " +
			"cifras concretas; no inventes otras):\n" + context;
	}

	try {
		const r = await fetch("https://api.anthropic.com/v1/messages", {
			method: "POST",
			headers: { "content-type": "application/json", "x-api-key": KEY, "anthropic-version": "2023-06-01" },
			body: JSON.stringify({
				model: MODEL, max_tokens: 600,
				system,
				messages: [{ role: "user", content: question }],
			}),
		});
		const data = await r.json();
		const text = data?.content?.[0]?.text || null;
		if (!text) return res.status(200).json({ _source: "mock" });
		return res.status(200).json({ text });
	} catch (e) {
		console.error("antonella", e?.message);
		return res.status(200).json({ _source: "mock" });
	}
}
