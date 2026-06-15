// Transpila cada cg-*.jsx a un script CLÁSICO (no-módulo) en public/cg/.
// Se conserva el JSX IDÉNTICO: solo se compila JSX→JS y se baja a ES5 para que
// las declaraciones top-level (function/var) queden globales y compartidas entre
// archivos — exactamente como hacía Babel-en-navegador, pero ahora en build.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import babel from "@babel/core";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Orden de carga (idéntico al index.html original del prototipo).
const FILES = [
	"cg-data",
	"cg-ui",
	"cg-antonella",
	"cg-ai-kit",
	"cg-cold",
	"cg-secure-dashboard",
	"cg-flows",
	"cg-screens-prof",
	"cg-screens-a",
	"cg-screens-b",
	"cg-screens-c",
	"cg-screens-d",
	"cg-reset-modals",
	"cg-config-antonella",
	"cg-cedis",
	"cg-validacion-saldos",
	"cg-recetas",
	"cg-config",
	"cg-designsystem",
	"cg-notifs", "cg-pin",
	"cg-app",
];

const outDir = resolve(root, "public/cg");
mkdirSync(outDir, { recursive: true });

for (const f of FILES) {
	const src = readFileSync(resolve(root, `${f}.jsx`), "utf8");
	const { code } = babel.transformSync(src, {
		filename: `${f}.jsx`,
		babelrc: false,
		configFile: false,
		presets: [
			// targets ie11 ⇒ const/let → var (globales compartidas), sin módulos.
			["@babel/preset-env", { targets: { ie: "11" }, modules: false }],
			["@babel/preset-react", { runtime: "classic" }],
		],
	});
	writeFileSync(resolve(outDir, `${f}.js`), code, "utf8");
	console.log(`✓ ${f}.jsx → public/cg/${f}.js`);
}

console.log(`\nListo: ${FILES.length} archivos transpilados.`);
