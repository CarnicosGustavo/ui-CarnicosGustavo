# Sistema de Diseño — Cárnicos Gustavo (paquete para Claude Design)

Este paquete contiene el **sistema de diseño completo** para incorporarlo en Claude
Design (sección "añadir código y elementos de marca"). Es **basado en código** (no Figma).

## Empieza aquí
- **`DESIGN_SYSTEM.md`** — la **fuente de verdad**: principios, tokens de color (4 temas),
  tipografía, espaciado, catálogo de componentes con API y ejemplos, patrones, y checklist.
  Si solo vas a subir un archivo, sube este.

## /code — el sistema encarnado en código (React/JSX, estilos inline)
Orden de carga / rol:
1. `cg-data.jsx` — **tokens**: `CG.themes` (Cálida/Neutra × claro/oscuro), `CG.font`
   (Anton/Archivo/JetBrains Mono), colores de categoría. Define la marca.
2. `cg-ui.jsx` — **componentes base**: Card, Btn, Badge, Stat, Overline, ScreenHead,
   Menu, Kebab, SplitButton, Modal, FormField, TextInput, Icon (lucide).
3. `cg-antonella.jsx` — **patrón iAntonella**: Slot de sugerencias, chips (los de chat
   llevan flecha ↘), avatar y dock.
4. `cg-designsystem.jsx` — **catálogo visual** (muestra todos los componentes y estados).
5. `index.html` — clases CSS utilitarias, animaciones, máscara de **Ramón**, scrollbars,
   reglas responsive. Aquí se ve cómo se cargan los scripts y las fuentes.

## /brand — elementos de marca
- `logo-gustavo.png` — logo apilado (tarjeta de bienvenida del Panel).
- `logo-principal.png` — logo principal.
- `logo-gustavo-familia.png` — variante familia.
- `ramon-mask.png` — silueta de **Ramón** (máscara recoloreable del header).
- `gustavo-icono.png` — isotipo.
- `iantonella-rojo.png` — avatar de iAntonella.

## Identidad en una frase
Cálido y artesanal (cremas/papel, no blancos), operativo/táctil, dato al frente
(números en mono, color = estado), acento **rojo Gustavo**, **Ramón** como indicador.
Fuentes: **Anton** (display) · **Archivo** (UI) · **JetBrains Mono** (números/dinero).
