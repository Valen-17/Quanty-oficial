# Quanty - Aplicación Oficial

Bienvenid@s al repositorio central de **Quanty**. Esta es la aplicación oficial y de producción de nuestra plataforma de gestión diseñada especialmente para microempresas, pequeñas empresas y contratistas independientes.

El núcleo de esta aplicación ha sido desarrollado implementando arquitecturas robustas y tipado estricto, consolidando los conocimientos de nuestro grupo de estudio **SoftGirls** en Ingeniería de Software 2 y Herramientas de Programación III.

**Aplicación publicada:** https://quanty-oficial.vercel.app/

## Integrantes

- Isabella Aristizabal Díaz
- Daniela Montoya Quintero

## Descripción del dominio

**Quanty** resuelve la administración diaria de un pequeño negocio sin hojas de cálculo:

| Módulo        | Qué permite                                                                                              |
| ------------- | -------------------------------------------------------------------------------------------------------- |
| Inventario    | Productos con precio, stock y umbral de alerta; búsqueda, filtros, orden, paginación y exportación a CSV |
| Cotizaciones  | Cotizaciones con insumos del inventario y mano de obra; al aprobar se descuenta el stock                 |
| Clientes      | Directorio conectado a las cotizaciones                                                                  |
| Balance       | Gastos fijos y variables frente a ingresos aprobados                                                     |
| Agenda        | Compromisos con fecha, hora, cliente y estado                                                            |
| Configuración | Perfil, moneda, tema e integraciones con apps externas                                                   |

Los datos se guardan en Supabase (PostgreSQL) y se mantienen en `localStorage` como caché, por lo que sobreviven a recargar la página.

## Cómo ejecutarlo

Requisitos: Node.js 18 o superior, [pnpm](https://pnpm.io/) y [Bun](https://bun.sh/).

```bash
git clone https://github.com/Valen-17/Quanty-oficial.git
cd Quanty-oficial
pnpm install
```

Copia `.env.example` como `.env` y completa las claves públicas de Supabase (pídelas al equipo; nunca se suben al repositorio). Luego:

```bash
bun run dev
```

La app abre en http://localhost:8080. Otros comandos: `bun run build`, `bun run lint`, `bun run typecheck` y `bun run format`.

## Estructura por capas

```text
src/
├── domain/        Modelo: entidades y validaciones con Zod
├── repositories/  Datos: lectura y escritura en Supabase
├── stores/        Estado de la app (Zustand) con caché en localStorage
├── lib/           Servicios: tasa de cambio, correo, PDF, tablas y utilidades
├── hooks/         Lógica reutilizable de React (sesión, perfil, tema, moneda)
├── components/    Vista: componentes de la interfaz
└── routes/        Vista: una página por archivo
supabase/
├── migrations/    Esquema de la base de datos, seguridad (RLS) y funciones SQL
└── functions/     Funciones del servidor (correo e importación de catálogo)
docs/              Auditoría, normas de codificación e integración
```

Las normas del equipo están en [docs/normas-de-codificacion.md](docs/normas-de-codificacion.md).

## APIs usadas

### 1. Tasa de cambio (ExchangeRate-API)

Convierte los montos, guardados en pesos colombianos, a la moneda elegida en Configuración.

| Campo      | Valor                                                                     |
| ---------- | ------------------------------------------------------------------------- |
| URL base   | `https://api.exchangerate-api.com/v4`                                     |
| Endpoint   | `/latest/COP`                                                             |
| Método     | `GET`                                                                     |
| Parámetros | La moneda base va en la ruta (`COP`); no pide clave                       |
| Código     | `src/lib/exchangeRate.ts` (servicio) y `src/hooks/useExchangeRateSync.ts` |

Respuesta de ejemplo (resumida a 4 de las 166 monedas):

```json
{
  "provider": "https://www.exchangerate-api.com",
  "base": "COP",
  "date": "2026-11-15",
  "time_last_updated": 1794700802,
  "rates": { "COP": 1, "USD": 0.000304, "EUR": 0.000275, "MXN": 0.00567 }
}
```

La petición usa `fetch` dentro de una función `async`, revisa `response.ok` y atrapa errores con `try`/`catch`. Si falla o no hay internet, Quanty conserva la última tasa guardada. La API anuncia que la versión v4 será reemplazada por la v6.

### 2. Importación de catálogo (API propia)

Permite que apps externas, como la tienda Bruma Café, envíen productos y contactos a Quanty con una clave de API que el usuario genera en **Configuración → Integraciones**.

| Campo       | Valor                                                                  |
| ----------- | ---------------------------------------------------------------------- |
| URL         | `https://dnhpjwyaotdyhpialqlk.supabase.co/functions/v1/catalog-import` |
| Métodos     | `GET` (probar la clave) y `POST` (importar)                            |
| Encabezados | `x-api-key` y `Content-Type: application/json`                         |
| Código      | `supabase/functions/catalog-import/index.ts`                           |

El contrato completo, con campos, ejemplos y errores, está en [docs/integracion-bruma-cafe.md](docs/integracion-bruma-cafe.md).

### 3. Supabase

Autenticación, base de datos PostgreSQL con seguridad por filas (RLS), almacenamiento de avatares y funciones del servidor. El acceso está en `src/repositories/` y `src/integrations/supabase/`.

## Métodos de arreglos

| Método   | Dónde                                                     | Para qué                                           |
| -------- | --------------------------------------------------------- | -------------------------------------------------- |
| `filter` | `src/routes/inventario.tsx`                               | Combinar búsqueda y filtro de disponibilidad       |
| `sort`   | `src/lib/table.ts` (`sortRows`)                           | Ordenar la tabla por columna                       |
| `map`    | `src/routes/inventario.tsx` (`exportCsv`)                 | Convertir productos en filas de CSV                |
| `reduce` | `src/stores/selectors.ts`, `src/stores/inventoryStore.ts` | Totales de ingresos, gastos y valor del inventario |
| `find`   | `src/lib/sendQuoteEmail.ts` (`findClientEmail`)           | Buscar el cliente de una cotización                |

## Documentación consultada

| Fuente                                                                                                                                                                                                                                                       | Para qué sirvió                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| [MDN: Using the Fetch API](https://developer.mozilla.org/es/docs/Web/API/Fetch_API/Using_Fetch)                                                                                                                                                              | Peticiones a la API de tasa de cambio e importación |
| [MDN: Response.ok](https://developer.mozilla.org/en-US/docs/Web/API/Response/ok)                                                                                                                                                                             | Detectar respuestas con error antes de leer el JSON |
| [MDN: async function](https://developer.mozilla.org/es/docs/Web/JavaScript/Reference/Statements/async_function) y [try...catch](https://developer.mozilla.org/es/docs/Web/JavaScript/Reference/Statements/try...catch)                                       | Manejo de llamadas asíncronas y sus errores         |
| [MDN: Array.prototype.sort](https://developer.mozilla.org/es/docs/Web/JavaScript/Reference/Global_Objects/Array/sort) y [String.prototype.localeCompare](https://developer.mozilla.org/es/docs/Web/JavaScript/Reference/Global_Objects/String/localeCompare) | Ordenar la tabla respetando tildes y mayúsculas     |
| [MDN: Blob](https://developer.mozilla.org/es/docs/Web/API/Blob) y [URL.createObjectURL](https://developer.mozilla.org/es/docs/Web/API/URL/createObjectURL_static)                                                                                            | Descargar el CSV desde el navegador                 |
| [MDN: SubtleCrypto.digest](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest) y [Crypto.getRandomValues](https://developer.mozilla.org/es/docs/Web/API/Crypto/getRandomValues)                                                            | Generar claves de API y guardar solo su hash        |
| [MDN: Intl.NumberFormat](https://developer.mozilla.org/es/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat)                                                                                                                                    | Mostrar montos en COP, USD, EUR o MXN               |
| [MDN: Window.localStorage](https://developer.mozilla.org/es/docs/Web/API/Window/localStorage)                                                                                                                                                                | Caché local de los datos por usuario                |
| [ExchangeRate-API](https://www.exchangerate-api.com/docs/free)                                                                                                                                                                                               | Endpoint de tasas de cambio sin clave               |
| [Supabase Docs](https://supabase.com/docs)                                                                                                                                                                                                                   | Autenticación, RLS y Edge Functions                 |

## Librerías

React, TanStack Start y TanStack Router, Zustand, Zod, Tailwind CSS, lucide-react (íconos), Recharts (gráficos), jsPDF y jspdf-autotable (PDF), Supabase JS y Resend (envío de correos). Las versiones exactas están en `package.json`.

## Uso de inteligencia artificial

Hicimos una limpieza del código original de Quanty para dejarlo como debe ser: ordenado, seguro y fácil de mantener. Para esa limpieza nos apoyamos en herramientas de inteligencia artificial.

**Para qué la usamos**

- Auditar el código y detectar errores, código repetido y riesgos de seguridad. El resultado está en [docs/auditoria-2026-11.md](docs/auditoria-2026-11.md).
- Corregir los errores de tipos y de lint, y unificar el código repetido de los repositorios.
- Reforzar la seguridad de la función de correo y de las políticas de la base de datos.
- Construir la integración con Bruma Café y las funciones de la tabla de Inventario (orden, paginación y CSV).

**Cómo lo verificamos**

- Cada cambio pasó `bun run typecheck`, `bun run lint` y `bun run build` sin errores.
- Probamos la app en el navegador y el endpoint de importación con peticiones reales.
- Contrastamos las soluciones con la documentación oficial citada en este README (MDN, Supabase y ExchangeRate-API).
