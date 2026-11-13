# Auditoría técnica de Quanty — noviembre 2026

## Alcance y método

- Lectura completa de `src/` (dominio, stores, repositorios, hooks, rutas, componentes propios), `supabase/migrations`, `supabase/functions/send-quote-email`, configuración del proyecto y los reportes QA previos en `TEST/errors`.
- Ejecución de `tsc --noEmit`, `eslint .` y `vite build` como línea base.
- Revisión de los avisos de seguridad y rendimiento del proyecto Supabase activo (`dnhpjwyaotdyhpialqlk`, el que usa `.env`), solo lectura.

Línea base antes de los cambios:

| Verificación   | Resultado                                                                              |
| -------------- | -------------------------------------------------------------------------------------- |
| `tsc --noEmit` | 11 errores de tipos (el build no los detecta porque Vite no comprueba tipos)           |
| `eslint .`     | 14.934 problemas; 14.884 son de Prettier causados por finales de línea CRLF en Windows |
| `vite build`   | Compila                                                                                |

## Hallazgos

Severidad: **Crítica** (pérdida de datos o seguridad explotable), **Alta** (comportamiento incorrecto visible), **Media** (deuda que causa bugs), **Baja** (calidad/estilo).

### Seguridad

| #   | Sev.    | Hallazgo                                                                                                                                                                                                     | Ubicación                                      |
| --- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------- |
| S1  | Crítica | `.env` está versionado en git (3 commits) e incluye `RESEND_API_KEY`. `.gitignore` no ignora `.env`. Los reportes QA anteriores afirmaban lo contrario.                                                      | `.env`, `.gitignore`                           |
| S2  | Alta    | La función `send-quote-email` interpola sin escapar nombre de cliente, notas, folio, nombre del negocio y nombres de ítems dentro del HTML del correo (inyección HTML / phishing desde tu dominio de envío). | `supabase/functions/send-quote-email/index.ts` |
| S3  | Alta    | La función de correo no valida quién la llama ni el destinatario: cualquiera con un token válido puede enviar correos arbitrarios usando tu cuenta de Resend.                                                | mismo archivo                                  |
| S4  | Media   | El cliente envía el objeto `Quote` completo a la función de correo (ids internos, mano de obra, etc.).                                                                                                       | `src/lib/sendQuoteEmail.ts`                    |
| S5  | Media   | Todas las funciones `SECURITY DEFINER` (incluidas las de triggers y `approve_quote`) son ejecutables por `anon` vía `/rest/v1/rpc`.                                                                          | avisos Supabase                                |
| S6  | Media   | El parámetro `redirect` de `/auth` se usa sin validar en `navigate` (posible redirección abierta).                                                                                                           | `src/routes/auth.tsx`                          |
| S7  | Baja    | El avatar acepta cualquier `image/*`, incluido SVG, en un bucket público.                                                                                                                                    | `AvatarUploader.tsx`                           |
| S8  | Baja    | La migración `20260421011904` confirmó a la fuerza todos los correos de `auth.users`.                                                                                                                        | migraciones                                    |
| S9  | Baja    | Protección contra contraseñas filtradas desactivada en Supabase Auth.                                                                                                                                        | panel Supabase                                 |
| S10 | Baja    | Las consultas de listado dependen solo de RLS (sin filtro `user_id` explícito). RLS está bien configurado; el filtro añade defensa en profundidad y permite usar los índices por `user_id`.                  | repositorios                                   |

### Integridad de datos y lógica de negocio

| #   | Sev.    | Hallazgo                                                                                                                                                                                                        | Ubicación                                             |
| --- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| D1  | Crítica | Los botones +/- de stock en Inventario solo cambian el estado local. Para productos remotos el cambio nunca llega a Supabase y se pierde en la siguiente sincronización.                                        | `routes/inventario.tsx`, `inventoryStore.adjustStock` |
| D2  | Alta    | Cambiar el estado de una cotización (enviada/rechazada) usa `updateQuote`, que borra todas las líneas y las vuelve a insertar en 4 llamadas no atómicas. Si falla la inserción, la cotización queda sin líneas. | `quotes.repository.ts`, `QuoteDetailModal.tsx`        |
| D3  | Alta    | La tasa de cambio solo se descarga al abrir Configuración y no se persiste. Con USD/EUR/MXN, tras recargar, todas las demás pantallas muestran montos en COP con símbolo de otra moneda.                        | `routes/configuracion.tsx`, `settingsStore`           |
| D4  | Alta    | El folio `COT-N` se calcula con las cotizaciones activas, pero la restricción única `(user_id, folio)` incluye las archivadas: en un navegador nuevo, si se archivó la última cotización, crear otra falla.     | `quotesStore.createQuoteOnRemote`                     |
| D5  | Media   | El formulario de cotización se reinicia mientras el usuario escribe si cambia `availableWorkers` (por ejemplo, al terminar una sincronización).                                                                 | `QuoteFormModal.tsx`                                  |
| D6  | Media   | `useProfile` crea una consulta y un estado independientes por cada componente (cabecera, dashboard, configuración, avatar). Cambiar el avatar o el nombre no se refleja en la cabecera hasta recargar.          | `hooks/useProfile.tsx`                                |
| D7  | Media   | Moneda e idioma solo se guardan en el navegador, aunque la tabla `profiles` tiene esas columnas.                                                                                                                | `configuracion.tsx`, `remote-bootstrap.ts`            |
| D8  | Media   | Las migraciones del persist de Zustand validan contra el esquema actual antes de migrar, por lo que un estado antiguo se descarta en lugar de migrarse.                                                         | `lib/persist-helpers.ts`                              |
| D9  | Media   | El gráfico de ingresos usa COP fijo en tooltip y eje.                                                                                                                                                           | `RevenueChart.tsx`                                    |
| D10 | Media   | Aprobar una cotización local (legacy) descuenta stock solo en memoria, igual que D1.                                                                                                                            | `quotesStore.approveQuote`                            |
| D11 | Baja    | GIF aceptado pero convertido a JPEG estático sin aviso.                                                                                                                                                         | `ProductFormModal.tsx`                                |
| D12 | Baja    | Las imágenes de producto se guardan como base64 en la columna `image_url` y en `localStorage` (hasta 2 MB por producto). Requiere migrar a Storage.                                                             | `ProductFormModal.tsx`, migración core                |

### Rendimiento

| #   | Sev.  | Hallazgo                                                                                                                                                                                   |
| --- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P1  | Media | Cada operación de repositorio llama a `supabase.auth.getUser()` (petición de red). Al arrancar se hacen 7 de estas llamadas en paralelo. Basta la sesión local; RLS valida en el servidor. |
| P2  | Media | `jspdf` + `jspdf-autotable` se cargan con el modal de cotización (chunk de ~459 kB) aunque el PDF casi nunca se descarga.                                                                  |
| P3  | Media | 31 políticas RLS evalúan `auth.uid()` por fila (`auth_rls_initplan`); faltan índices en 3 llaves foráneas.                                                                                 |
| P4  | Baja  | `useProfile` duplicado provoca 3 lecturas de `profiles` por carga de página.                                                                                                               |

### Calidad de código y mantenimiento

| #   | Sev.  | Hallazgo                                                                                                                                                                                                                                                                          |
| --- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | Alta  | 11 errores de TypeScript (tipos de Supabase sin relaciones, búsqueda de `/auth` mal tipada, claves duplicadas en `quotesStore`, migración de settings mal tipada).                                                                                                                |
| C2  | Alta  | Lint inutilizable: 14.884 errores de Prettier por CRLF. No hay `.gitattributes`.                                                                                                                                                                                                  |
| C3  | Media | Cinco repositorios copian el mismo regex UUID, `formatSupabaseError`, `mapUnknownError` y `requireAuthUserId`.                                                                                                                                                                    |
| C4  | Media | El envío de correo y la búsqueda del email del cliente están duplicados en 3 sitios; `handleCreate` está duplicado en Dashboard y Cotizaciones.                                                                                                                                   |
| C5  | Media | Ningún componente de `src/components/ui` (46 archivos shadcn) se usa en la app, y unas 35 dependencias solo existen por ellos. `@tanstack/react-query`, `react-hook-form`, `@hookform/resolvers` y `date-fns` tampoco se usan, aunque `AGENTS.md` los lista como parte del stack. |
| C6  | Media | Código muerto: `PageStub`, `use-mobile`, `client.server.ts`, `auth-middleware.ts`, `integrations/supabase/types.ts`, `fmtCOP`, `fmtNumber`, `selectLowStock`, `selectLowStockCount`, `quotesStore.createQuote`, `inventoryStore.addProduct`.                                      |
| C7  | Baja  | Comentarios y emojis en el código contra la norma de `AGENTS.md`.                                                                                                                                                                                                                 |
| C8  | Baja  | `supabase/config.toml` apunta a un proyecto (`jcmbvgukanravmxquvui`) distinto del que usa `.env` (`dnhpjwyaotdyhpialqlk`).                                                                                                                                                        |
| C9  | Baja  | Funciones visibles que no hacen nada: idioma "English", interruptores de notificaciones, búsqueda y exportar (estos dos ya marcados "Próximamente").                                                                                                                              |
| C10 | Baja  | La función de correo envía desde `onboarding@resend.dev`; en modo sandbox Resend solo entrega al dueño de la cuenta, así que los clientes reales no reciben correos hasta verificar un dominio.                                                                                   |
| C11 | Baja  | Se usan `alert`/`confirm` nativos y varios `<label>` sin `htmlFor`.                                                                                                                                                                                                               |

## Plan de limpieza

Principio: ningún cambio debe requerir una acción externa (aplicar migraciones, desplegar funciones) para que la app siga funcionando. Lo que necesita al servidor se entrega como archivo listo para aplicar.

1. **Herramientas**: `.gitattributes` con LF, normalizar finales de línea, ignorar `.env*` y `supabase/.temp`, añadir `.env.example` y script `typecheck`, ajustar ESLint para TanStack Router.
2. **Tipos**: dejar `tsc` sin errores en el código propio.
3. **Datos críticos**: persistir ajustes de stock (D1, D10), actualizar estado de cotización con una sola escritura (D2), cargar y persistir la tasa de cambio desde el arranque (D3), reintentar folio ante colisión (D4).
4. **Seguridad**: escapar HTML y exigir sesión en la función de correo, enviar solo los campos necesarios (S2–S4), validar `redirect` (S6), limitar tipos de avatar (S7), filtro `user_id` explícito (S10).
5. **Estado compartido**: `useProfile` como proveedor único sincronizado con `settingsStore`, moneda e idioma en la nube (D6, D7).
6. **Formularios**: los modales se montan al abrirse en vez de reiniciarse con efectos (D5).
7. **Duplicación y rendimiento**: helpers compartidos de repositorio con sesión local (C3, P1), notificación de correo centralizada (C4), PDF cargado bajo demanda (P2), gráfico con moneda del usuario (D9), migraciones de persist correctas (D8).
8. **Código muerto y estilo**: quitar funciones y exportaciones sin uso, comentarios y emojis (C6, C7).
9. **Base de datos**: migración nueva (sin aplicar) que revoca `EXECUTE` a `anon`, reescribe las políticas con `(select auth.uid())` y crea los índices faltantes (S5, P3).

### Requiere decisión o acción tuya

- Rotar `RESEND_API_KEY` en Resend: ya está en el historial de git.
- Dejar de versionar `.env` (`git rm --cached .env`) y hacer commit.
- Aplicar la migración nueva y desplegar la función `send-quote-email`.
- Hecho: se borraron los 46 componentes de `src/components/ui` sin uso y los 36 paquetes que solo ellos usaban (las dependencias pasaron de 57 a 21). Siguen sin uso `@tanstack/react-query` y `date-fns`, y los archivos `PageStub`, `use-mobile`, `client.server.ts`, `auth-middleware.ts` e `integrations/supabase/types.ts`.
- Activar protección de contraseñas filtradas en Supabase Auth.
- Pendientes de producto: almacenamiento de imágenes en Storage (D12), dominio verificado en Resend (C10), y si los trabajadores asignados a cotizaciones aprobadas deberían liberarse.
