// Smoke test sin navegador: monta la app (cg-*.js transpilados) en jsdom y
// verifica que <App/> renderiza contenido en #root sin lanzar errores.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import React from "react";
import * as ReactDOMClient from "react-dom/client";
import ReactDOM from "react-dom";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FILES = [
	"cg-data", "cg-ui", "cg-antonella", "cg-ai-kit", "cg-cold",
	"cg-secure-dashboard", "cg-flows", "cg-screens-prof", "cg-screens-a",
	"cg-screens-b", "cg-screens-c", "cg-screens-d",
	"cg-reset-modals",
	"cg-config-antonella",
	"cg-cedis",
	"cg-validacion-saldos", "cg-recetas", "cg-config",
	"cg-designsystem", "cg-app",
];

const dom = new JSDOM(
	`<!DOCTYPE html><html><body><div id="root"></div></body></html>`,
	{ url: "http://localhost/", pretendToBeVisual: true, runScripts: "dangerously" },
);
const { window } = dom;

// react-dom (CJS de npm) lee `window`/`document` del scope global de node;
// se los apuntamos a los de jsdom para que el reconciler funcione en el test.
globalThis.window = window;
globalThis.document = window.document;

// Globales que el JSX original espera (como las UMD en el navegador)
window.React = React;
window.ReactDOM = Object.assign({}, ReactDOM, { createRoot: ReactDOMClient.createRoot });
window.lucide = { createIcons: () => {} };
if (!window.matchMedia)
	window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });

const errors = [];
window.addEventListener("error", (e) => errors.push(e.error?.message || String(e.message)));

function runScript(code, name) {
	const el = window.document.createElement("script");
	el.textContent = code;
	try {
		window.document.body.appendChild(el);
	} catch (err) {
		errors.push(`[${name}] ${err.message}`);
	}
}

for (const f of FILES) {
	runScript(readFileSync(resolve(root, `public/cg/${f}.js`), "utf8"), f);
}

// Dar un tick para que createRoot pinte
await new Promise((r) => setTimeout(r, 100));

const rootEl = window.document.getElementById("root");
const html = rootEl ? rootEl.innerHTML : "";
const len = html.length;

console.log(`#root innerHTML: ${len} chars`);
console.log(`globales definidos: App=${typeof window.App}, Card=${typeof window.Card}, CG=${typeof window.CG}`);
if (errors.length) {
	console.log(`\n❌ ${errors.length} error(es):`);
	for (const e of errors.slice(0, 10)) console.log("  -", e);
	process.exit(1);
}
if (len < 200) {
	console.log("\n⚠️  #root casi vacío — la app no montó contenido.");
	process.exit(2);
}
console.log("\n✅ La app monta y renderiza contenido sin errores.");
