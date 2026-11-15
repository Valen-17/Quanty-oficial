# Normas de codificación de Quanty

Guía corta que sigue todo el equipo. Prettier y ESLint revisan la mayoría de estas reglas de forma automática.

## Nombres

| Elemento                | Convención                | Ejemplo                                 |
| ----------------------- | ------------------------- | --------------------------------------- |
| Variables y funciones   | camelCase                 | `totalValue`, `applyStockDelta`         |
| Componentes de React    | PascalCase                | `ProductFormModal`, `TablePagination`   |
| Tipos e interfaces      | PascalCase                | `Product`, `RepoResult`                 |
| Constantes fijas        | MAYÚSCULAS con guion bajo | `MAX_ITEMS`, `DEFAULT_THRESHOLD`        |
| Archivos de componentes | PascalCase                | `ApiKeysPanel.tsx`                      |
| Otros archivos          | camelCase o kebab-case    | `quotesStore.ts`, `remote-bootstrap.ts` |
| Rutas (páginas)         | En español, minúsculas    | `inventario.tsx`, `cotizaciones.tsx`    |

## Formato

- Sangría de 2 espacios, punto y coma, comillas dobles y coma final en listas (`bun run format`).
- Máximo 100 caracteres por línea.
- Finales de línea LF en todos los sistemas (`.gitattributes`).

## Comentarios

- En español, cortos y simples: una línea arriba de un módulo, una función exportada o un bloque que no se entiende solo.
- No se comenta lo que el código ya dice, ni se deja código comentado o TODO.

## Estilos (CSS)

El proyecto usa Tailwind CSS v4 en lugar de clases BEM: los estilos se escriben como clases utilitarias en el componente y los colores salen de variables en `src/styles.css` (`bg-primary`, `text-muted-foreground`). Así no hay archivos CSS por componente ni nombres de clase que mantener.

## Arquitectura por capas

| Capa      | Carpeta                          | Responsabilidad                                                                                                                                   |
| --------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Modelo    | `src/domain/`                    | Entidades y reglas de validación con Zod                                                                                                          |
| Datos     | `src/repositories/`              | Lectura y escritura en Supabase                                                                                                                   |
| Estado    | `src/stores/`                    | Estado de la app con Zustand y caché en `localStorage`                                                                                            |
| Servicios | `src/lib/`                       | APIs externas (tasa de cambio, correo, PDF) y utilidades                                                                                          |
| Vista     | `src/components/`, `src/routes/` | Pantallas y componentes; leen el estado de los stores y no guardan datos. Solo el inicio de sesión y la foto de perfil usan Supabase directamente |

## Buenas prácticas

- Los datos del usuario se muestran como texto en JSX (React los escapa); nunca con `dangerouslySetInnerHTML`.
- Toda llamada a una API usa `async`/`await`, `try`/`catch` y revisa `response.ok`.
- Nada de `console.log` de prueba; `console.error` solo para errores reales.
- Ninguna clave o secreto se sube al repositorio (`.env` está en `.gitignore`).
- Antes de subir cambios: `bun run typecheck`, `bun run lint` y `bun run build` sin errores.
