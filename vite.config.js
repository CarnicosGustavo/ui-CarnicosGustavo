import { defineConfig } from "vite";

// Las pantallas (cg-*.jsx) se transpilan a scripts clásicos en public/cg/ por
// scripts/build-cg.mjs (lifecycle predev/prebuild) y se cargan vía <script src>
// en index.html. Vite las sirve/copia tal cual desde public/. No se bundlean
// como módulos para conservar el patrón de globales del prototipo original.
export default defineConfig({
	build: {
		outDir: "dist",
		chunkSizeWarningLimit: 3000,
	},
});
