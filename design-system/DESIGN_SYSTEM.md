# Sistema de Diseño — Cárnicos Gustavo (v2)

> **Para:** Claude Code, al diseñar/implementar **nuevas interfaces** de la plataforma.
> **Qué es:** la fuente de verdad del lenguaje visual. **Evolución** del diseño actual
> (`cg-*.jsx`): mismo ADN de marca, más limpio y consistente.
> **Stack objetivo:** **React + Vite** (JSX con estilos; mismo patrón que `ui-CarnicosGustavo`).

## Cómo usar este documento (regla para Claude Code)
1. **Nunca uses colores/medidas “a mano”.** Usa siempre los **tokens** (§2). El color
   sale de `window.CG.color` (objeto vivo que cambia con el tema) o de variables CSS.
2. Respeta las **3 familias tipográficas** y su rol (§3). Números y dinero → **mono**.
3. Reusa los **componentes** del catálogo (§5) y los **patrones** (§6) antes de inventar.
4. Toda pantalla empieza con **`ScreenHead`** (título display + descripción).
5. Mantén el **shell**: rail oscuro de iconos + TopBar con Ramón. No lo reinventes.

---

## 1. Principios
- **Cálido y artesanal, no corporativo.** Fondos crema/papel, no blancos puros.
- **Operativo y táctil.** Pensado para tablet/báscula: objetivos grandes, jerarquía clara.
- **Dato al frente.** Números grandes en fuente display/mono; el color comunica estado.
- **Marca viva.** Rojo Gustavo como acento de acción; Ramón (cerdo) como indicador.
- **Consistencia > creatividad por pantalla.** Mismos componentes y espaciados en todo.

### Qué evoluciona en v2 (manteniendo el ADN)
- **Escala de espaciado de 4px** unificada (antes había 6/7/9/11/13… sueltos) → §4.
- **Foco accesible**: anillo visible (`focus-visible`) en todo control interactivo.
- **Sombras más sutiles y un solo token** por tema (`shadow`).
- **Radios normalizados** a 4 pasos (sm/md/lg/pill) → §4.
- **Contraste AA** garantizado en texto sobre crema (usar `ink`/`ink80`, no `inkFaint` para texto largo).

---

## 2. Color (tokens)

4 temas: **Cálida** y **Neutra**, cada uno en **claro** y **oscuro**. El tema activo
muta `window.CG.color`. **Tema canónico = “Cálida · claro”:**

| Token | Valor | Uso |
|---|---|---|
| `bg` | `#ECE5D8` | Fondo de la app (detrás de todo) |
| `paper` | `#FBF7EF` | Superficie de tarjetas/menús |
| `paper2` | `#F4EEE1` | Superficie secundaria (inputs, headers de tabla, chips) |
| `cream` | `#F1E7D6` | Hero/acentos cálidos |
| `ink` | `#211C19` | Texto principal |
| `ink80` | `#3A332D` | Texto fuerte secundario |
| `inkSoft` | `#6B625A` | Texto secundario / labels |
| `inkFaint` | `#9A9087` | Texto terciario / placeholders (NO para texto largo) |
| `line` | `rgba(33,28,25,.12)` | Bordes |
| `lineSoft` | `rgba(33,28,25,.07)` | Separadores de filas |
| `red` / `redDeep` / `redSoft` | `#9E3326` / `#7E2A20` / `#C04A38` | **Acción/marca**, hover, suave |
| `redWash` | `#F3E0DB` | Fondo de alerta/acento rojo |
| `green` / `greenWash` | `#3F7D54` / `#E2ECDF` | OK/pagado/contado |
| `amber` / `amberWash` | `#C0851F` / `#F2E7CE` | Pendiente/por pesar |
| `blue` / `blueWash` | `#3C6E8F` / `#DFE9EE` | En proceso/info/frío |
| `tan` / `tanWash` | `#B7A88B` / `#E7DFCD` | Neutro de marca (gráficas) |
| `chrome` / `chromeFg` / `chrome2` | `#211C19` / `#F1E7D6` / `#2C2621` | **Rail/superficies oscuras** y su texto |
| `shadow` (derivado) | `0 18px 50px -22px rgba(33,28,25,.38)` | Sombra de tarjetas |

> **Oscuro / Neutra:** mismos nombres de token, distintos valores (el tema los reescribe).
> Diseña SIEMPRE por token, nunca por hex, para que claro/oscuro funcionen solos.

### Paleta semántica (qué significa cada color)
| Significado | Token |
|---|---|
| Acción primaria / marca / eliminar / saldo | **rojo** |
| Pagado / OK / contado / abono / peso válido | **verde** |
| Pendiente / por pesar | **ámbar** |
| En proceso / estimado / info / inventario frío | **azul** |
| Superficies oscuras (rail, velos, modo báscula) | **chrome** |

### Colores de categoría (productos)
`Lomos` hsl(43 74% 49%) · `Jamones` hsl(350 70% 55%) · `Pulpas` hsl(320 55% 55%) ·
`Cueros` hsl(25 50% 45%) · `Visceras` hsl(265 55% 58%) · `Huesos` hsl(197 45% 42%) ·
`Otros` hsl(215 16% 47%) · `Canales` hsl(222 47% 30%) · `Compra` hsl(150 45% 38%).

---

## 3. Tipografía
3 familias (Google Fonts), cada una con un rol fijo:

| Rol | Fuente | Uso |
|---|---|---|
| **display** | `Anton` | Títulos de pantalla, números hero (`Stat`), cifras grandes. Peso 400, tracking `0.01em`. |
| **ui** | `Archivo` | Todo el texto de interfaz (labels, botones, párrafos). Pesos 400–800. |
| **mono** | `JetBrains Mono` | **Números, dinero, kg, IDs, fechas.** Da alineación tabular. |

### Escala (line-height 1 salvo párrafos)
| Token | px | Uso |
|---|---|---|
| display-xl | 34–40 | número hero / título grande |
| display-lg | 30 | título de pantalla (`ScreenHead`) |
| h3 | 16 | título de tarjeta |
| body | 14 | texto base (lh 1.5 en párrafos) |
| sm | 13 | secundario |
| xs | 12 | labels |
| overline | 11 · **uppercase** · tracking `0.05–0.06em` | encabezados de sección/tabla |

> **Regla:** títulos y cifras = `display`; números/dinero = `mono`; lo demás = `ui`.

---

## 4. Espaciado, radios, sombras, capas

**Espaciado — escala base 4px** (usar SOLO estos): `4, 8, 12, 16, 20, 24, 32, 40, 48`.
- Padding de tarjeta: **20** (compacta 16). Gap entre tarjetas: **14–16**. Gap interno: **8–12**.

**Radios:** `sm 8` (chips/inputs pequeños) · `md 10–12` (inputs/botones) · `lg 16` (tarjetas/modales) · `pill 999` (badges, toggles).

**Sombra:** un solo token `shadow` por tema (tarjetas/menús). Modales: sombra más profunda.

**Capas (z-index):** contenido `0` · sticky/topbar `30` · dropdown/menu `40–50` · modal `1000` · toast `1100`.

**Motion:** transiciones `.15s` (hover) / `.45s` (cambios de estado). Respeta
`prefers-reduced-motion`. Entrada de modal: `cgModalIn .26s cubic-bezier(.22,1,.36,1)`.

---

## 5. Componentes (catálogo)

> Ejemplos en el patrón de `ui-CarnicosGustavo`: función + estilos inline leyendo
> `C = window.CG.color`, `F = window.CG.font`. (En un proyecto con Tailwind, mapear los
> tokens a variables CSS y usar clases — mismas reglas.)

### Icon
`lucide`. `<Icon name="scale" size={18} color={C.inkSoft} />`. Tamaños 13–22.

### Card — superficie base
Props: `pad=20`, `onClick`, `style`. `paper` + `1px line` + `radius 16` + `shadow`.
```jsx
<Card><Overline>Total por cobrar</Overline><Stat value={mny(total)} color={C.red} /></Card>
```

### Btn — acción
`kind`: **primary** (rojo), **dark** (chrome), **green**, **outline**, **ghost**.
`size`: `sm | md | lg | xl`. Props: `icon`, `block`, `onClick`.
- **primary** = acción principal de la pantalla. **green** = confirmar/cobrar.
  **dark** = acción fuerte alterna. **outline/ghost** = secundarias.
- Un solo `primary`/`green` por bloque. Botones de báscula/cobro: `lg`/`xl`, `block`.
```jsx
<Btn kind="green" size="lg" icon="check" block onClick={cobrar}>Cobrar {mny(total)}</Btn>
```

### Badge — estado (píldora uppercase)
`tone`: `red | green | amber | blue | tan | ink | ghost`. `icon` opcional.
```jsx
<Badge tone="amber" icon="scale">Por pesar</Badge>
```

### Stat — cifra hero (display)
`value`, `prefix`, `suffix`, `color`, `size=34`.
```jsx
<Stat value="88.2" suffix="%" color={C.blue} size={40} />
```

### Overline — encabezado de sección (uppercase, inkFaint)
```jsx
<Overline>Detalles de la venta</Overline>
```

### ScreenHead — encabezado de pantalla (OBLIGATORIO)
`title` (display), `desc`, `right` (acciones).
```jsx
<ScreenHead title="Cobranza" desc="Cuentas por cobrar…" right={<Btn kind="outline" icon="plus">Capturar ticket viejo</Btn>} />
```

### FormField + TextInput — formularios
`FormField({label, hint})` envuelve. `TextInput({value,onChange,placeholder,type,right})`.
```jsx
<FormField label="Monto"><TextInput value={m} onChange={e=>setM(e.target.value)} right={<span>$</span>} /></FormField>
```

### Menu / Kebab — acciones contextuales
`Menu({trigger, items:[{label,icon,onClick,danger,sep}], align})`. `Kebab({items})` = menú ⋮.
> **Dropdowns reales** (no “ciclar” opciones): selección libre con lista desplegable.

### SplitButton — acción + variantes
Botón principal + ▾ con `items`. Ej. “Nuevo pedido” (mostrador/crédito/pesar/importar).

### Modal — diálogo
`Modal({open,onClose,title,subtitle,icon,footer,width=560})`. Header con ícono en `redWash`,
botón cerrar, `footer` con acciones (outline + primary/green).

### Tabla — patrón (no componente)
- `thead` con fondo `paper2`, headers **overline** (11px uppercase, `inkFaint`).
- Filas separadas por `lineSoft`. Números/dinero alineados a la derecha en **mono**.
- Acciones de fila: iconos en botón `34×34` `radius 8` o `Kebab`.

---

## 6. Patrones de la plataforma

### Shell (layout global)
- **Rail** izquierdo **oscuro** (`chrome`): solo iconos (con tooltip al hover), activo = `red`.
  Sin logo/isotipo arriba (se quitó en v2).
- **TopBar**: izquierda = **Ramón** (ícono-máscara recoloreable, clic→Panel) + nombre del
  módulo (display); centro = wordmark “CÁRNICOS / GUSTAVO”; derecha = notificaciones, tema, perfil.
- **Ramón** = indicador de estado: `ink` idle · `red` alerta · `green` con pulso al entrar pedido.
- **main** scrollable, contenido centrado `max-width ~1180`, padding `22px clamp(16,3vw,32)`.

### Pantalla tipo
`ScreenHead` → (opcional `Slot` de iAntonella) → KPIs en `Card` → contenido (tabla/grid).

### Badges de estado de pedido (mapa fijo)
`Pagada`→green · `Lista para cobro`/`Procesando pago`→blue · `Por pesar`/`Parcial`→amber ·
`Cancelada`→red · default→amber.

### iAntonella (asistente)
- **Slot** contextual arriba de la pantalla: avatar + sugerencia + **chips**.
- **Chips que envían al chat** llevan una **flecha ↘ (`corner-down-right`)** indicando que
  van a iAntonella. Chips de **navegación/acción** ejecutan y **no** abren el chat.
- **Dock** flotante (launcher) abajo a la derecha; el chat es un drawer.
- Acciones protegidas (despiece/borrar): **tarjeta de confirmación** ámbar antes de ejecutar.

### Modo báscula / oscuro
Superficies `chrome`, input de peso gigante (display/mono), botones `xl`. Pensado táctil.

### Dinero y unidades
Siempre **mono**. Formato MXN `$1,234.50`. Internamente: pedidos/transacciones en
**centavos**; cobranza/precios en **pesos** (ver `docs/IMPLEMENTACION_DESDE_M1.md`).

---

## 7. Accesibilidad y responsive
- **Foco visible** en todo control (anillo `red`/`blue` 2px). No quitar outline sin reemplazo.
- Contraste AA: texto largo con `ink`/`ink80`; `inkFaint` solo para hints/placeholders.
- Objetivos táctiles ≥ 40px en flujo operativo (báscula, POS, cobro).
- Breakpoints: `≤600` móvil (oculta columnas no esenciales), `≤880` colapsa rail a barra
  inferior y grids a 1 columna (`cg-two-col`, `cg-recetas-grid`).
- `prefers-reduced-motion`: desactiva animaciones no esenciales.

---

## 8. Implementación en React + Vite
- **Tokens vivos:** un objeto `CG.color`/`CG.font` (o variables CSS `--cg-*`) que el tema
  muta; los componentes lo leen en cada render. No hardcodear hex.
- **Fuentes:** preconnect + `@import` de Anton/Archivo/JetBrains Mono.
- **Temas:** `applyTheme(palette, mode)` reescribe los tokens + persiste en `localStorage`
  (`cg_palette`, `cg_mode`); aplicar antes del primer paint para evitar flash.
- **Componentes:** reusar el catálogo (§5). Mantener la API de props mostrada.
- **Assets:** en `public/assets/` (servidos en `/assets/...`).
- Referencia viva de componentes: `cg-ui.jsx`, `cg-designsystem.jsx`; tokens: `cg-data.jsx`.

---

## 9. Checklist al diseñar una pantalla nueva
- [ ] Empieza con `ScreenHead` (título display + descripción).
- [ ] Solo tokens de color; números/dinero en mono.
- [ ] Un solo botón primary/green por bloque; secundarias outline/ghost.
- [ ] Estados con `Badge` (mapa semántico) y vacíos/carga/ error contemplados.
- [ ] Dropdowns reales; modales con `Modal`; acciones de fila con `Kebab`.
- [ ] iAntonella: chips de chat con flecha ↘; acciones que ejecutan no abren chat.
- [ ] Responsive (≤880 colapsa) + foco visible + reduced-motion.
- [ ] Respeta el shell (rail oscuro + TopBar + Ramón).
