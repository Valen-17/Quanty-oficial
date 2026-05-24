# Quanty - Aplicación Oficial

Bienvenidas al repositorio central de **Quanty** Esta es la aplicación oficial y de producción de nuestra plataforma de gestión diseñada especialmente para microempresas, pequeñas empresas y contratistas independientes. 

El núcleo de esta aplicación ha sido desarrollado implementando arquitecturas robustas y tipado estricto, consolidando los conocimientos avanzados de nuestro grupo de estudio **SoftGirls** y en colaboración de nuestra asignatura de Ingeniería de Software 2.

**Ya está en línea** Puedes ver la aplicación en producción aquí: https://quanty-oficial.vercel.app/

---

## Sobre el Proyecto

**Quanty** es una solución de software integral que resuelve los dolores de cabeza administrativos de los pequeños negocios. Permite llevar el control de costos, presupuestos, flujos de trabajo y administración general de manera intuitiva, eliminando la necesidad de hojas de cálculo complejas.

Este repositorio contiene la lógica del negocio, la interfaz de usuario interactiva y la integración con la capa de persistencia de datos y procedimientos almacenados.

---

## Tecnologías y Composición del Stack

El proyecto está construido bajo un enfoque moderno, seguro y altamente eficiente. La distribución del código en el repositorio se compone de:

* **TypeScript:** Utilizado como el lenguaje principal para todo el desarrollo de la aplicación, garantizando un tipado estricto, menor cantidad de errores en tiempo de ejecución y una arquitectura altamente escalable.
* **PLpgSQL:** Lógica avanzada directamente en la base de datos (PostgreSQL). Implementamos funciones, triggers y procedimientos almacenados optimizados para el manejo seguro y rápido de cálculos financieros y agregaciones de Quanty.
* **CSS & JavaScript:** Estilos personalizados para la interfaz de usuario y scripts específicos de configuración o compatibilidad.

---

## Características Principales

* **Tipado Robusto:** Arquitectura basada en interfaces y tipos de TypeScript para un flujo de datos predecible.
* **Lógica de Base de Datos Optimizada:** Consultas pesadas y procesamiento de datos delegados al motor de base de datos mediante PLpgSQL para maximizar el rendimiento.
* **Interfaz Modular:** Componentes dinámicos y reutilizables.
* **Despliegue Continuo (CI/CD):** Integrado completamente con **Vercel** para actualizaciones automáticas y un rendimiento óptimo en producción.

---

## Configuración del Entorno Local

Si deseas clonar el proyecto para contribuir o probarlo en tu entorno local, sigue estas instrucciones:

### Prerrequisitos
* Node.js (versión 18 o superior recomendada)
* Instancia de PostgreSQL (para ejecutar los scripts PLpgSQL)

### Pasos para la instalación

1. **Clona el repositorio:**
   ```bash
   git clone [https://github.com/tu-usuario/quanty-core.git]
