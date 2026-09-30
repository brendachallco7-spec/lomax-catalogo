# Flujos del sistema — Lomax S.A.

## 1. Introducción

La solución desarrollada para **Lomax S.A.** permite registrar productos, almacenar su información en servicios de persistencia, procesar sus fotografías y publicar únicamente aquellos productos que cumplen con las condiciones requeridas.

El funcionamiento integra el frontend, el proxy, la API y los servicios de AWS ejecutados o simulados mediante **FLOCI**, manteniendo la información persistente fuera de los contenedores de aplicación.

Este documento describe los principales flujos funcionales y técnicos de la solución.

---

## 2. Flujo general de la solución

El flujo general comienza cuando un usuario utiliza el frontend para registrar o consultar un producto.

```text
Usuario
   │
   ▼
Frontend
   │
   ▼
Reverse Proxy
   │
   ▼
API / Backend
   │
   ├──────────────► RDS
   │                 │
   │                 └── Productos y categorías
   │
   ├──────────────► DynamoDB
   │                 │
   │                 └── Atributos variables y estado de imagen
   │
   └──────────────► S3
                     │
                     ├── Imagen original
                     │
                     └── Miniatura
                              │
                              ▼
                           Lambda
                              │
                              ▼
                         DynamoDB
```

La comunicación entre estos componentes permite separar las responsabilidades de presentación, procesamiento, persistencia y almacenamiento de archivos.

---

## 3. Flujo de registro de un producto

El registro de un producto comienza desde el formulario disponible en el frontend.

El usuario proporciona:

* Código del producto.
* Nombre.
* Descripción.
* Precio.
* Categoría.
* Atributos variables según la categoría.

La API valida los datos recibidos antes de realizar las operaciones de persistencia.

### Flujo

```text
Frontend
   │
   │ POST /productos
   ▼
API
   │
   ├── Validar datos
   │
   ├── Verificar código
   │
   ├── Verificar categoría
   │
   ├── Validar precio
   │
   ▼
RDS
   │
   │ Crear producto
   ▼
Producto PENDIENTE
   │
   ▼
DynamoDB
   │
   │ Guardar atributos
   ▼
Registro preparado para imagen
```

El producto se crea inicialmente con estado **PENDIENTE**, ya que todavía puede faltar la fotografía o su procesamiento.

---

## 4. Flujo de almacenamiento de atributos

Los datos principales del producto se almacenan en **RDS**, mientras que los atributos variables se almacenan en **DynamoDB**.

### RDS

Contiene información estructurada como:

* `producto_id`
* código
* nombre
* descripción
* precio
* categoría
* fecha
* estado

### DynamoDB

Utiliza `producto_id` como identificador para asociar los atributos variables y la información relacionada con el procesamiento de imágenes.

De esta manera, diferentes categorías pueden manejar atributos distintos sin modificar constantemente la estructura relacional.

```text
                    producto_id
                         │
             ┌───────────┴───────────┐
             ▼                       ▼
           RDS                   DynamoDB
             │                       │
       Datos principales       Atributos variables
             │                       │
             └───────────┬───────────┘
                         │
                  Mismo producto
```

La API es responsable de verificar que el identificador utilizado en DynamoDB corresponda al producto esperado en RDS.

---

## 5. Flujo de carga y procesamiento de imágenes

Después de crear el producto, el usuario puede cargar una fotografía desde el frontend.

La API recibe el archivo y valida:

* Formato JPEG o PNG.
* Tamaño máximo permitido de 5 MB.

Si el archivo es válido, se almacena el original en el bucket correspondiente de **S3**.

Posteriormente se solicita el procesamiento mediante **AWS Lambda**.

```text
Frontend
   │
   │ POST /productos/{id}/imagen
   ▼
API
   │
   ├── Validar formato
   ├── Validar tamaño
   │
   ▼
S3
   │
   │ Imagen original
   ▼
Lambda
   │
   ├── Validar imagen
   ├── Generar miniatura
   └── Mantener proporción
   │
   ▼
S3
   │
   │ Miniatura
   ▼
DynamoDB
   │
   └── Guardar referencia y estado
```

La miniatura debe tener como dimensión máxima **300 × 300 píxeles**, manteniendo la proporción original.

Por ejemplo:

```text
Original:    1200 × 800
Miniatura:    300 × 200
```

---

## 6. Flujo de publicación del producto

Un producto no debe aparecer en el catálogo únicamente porque haya sido creado en RDS.

La publicación depende de que la información requerida esté completa y validada.

El flujo esperado es:

```text
Producto creado
      │
      ▼
   PENDIENTE
      │
      ├── Datos válidos
      │
      ├── Atributos disponibles
      │
      └── Miniatura disponible
              │
              ▼
          PUBLICADO
              │
              ▼
          Catálogo
```

Si alguna condición no se cumple, el producto permanece en estado **PENDIENTE**.

Esto permite conservar la información registrada y completar posteriormente el proceso sin crear nuevamente el producto.

---

## 7. Flujo de error y reintento

La solución contempla errores durante el registro o procesamiento de imágenes.

Cuando ocurre un error que impide completar el producto, la información existente se conserva y el producto permanece pendiente.

Ejemplos:

* Código duplicado.
* Categoría inexistente.
* Precio inválido.
* Archivo mayor a 5 MB.
* Formato de imagen no permitido.
* Error durante el procesamiento de Lambda.
* Falta de imagen original para reprocesar.

El flujo de recuperación es:

```text
Producto PENDIENTE
       │
       ▼
   Detectar error
       │
       ▼
Conservar información
       │
       ▼
Corregir / Reintentar
       │
       ▼
Procesar nuevamente
       │
       ├── Correcto ──► PUBLICADO
       │
       └── Error ─────► PENDIENTE / ERROR
```

El reprocesamiento utiliza una clave de salida determinista para evitar la generación de miniaturas duplicadas cuando una misma imagen se procesa nuevamente.

---

## 8. Flujo de consulta del catálogo

El catálogo muestra únicamente productos publicados.

Cuando el usuario consulta el catálogo, el frontend solicita la información a través del proxy y la API.

```text
Usuario
   │
   ▼
Frontend
   │
   ▼
Reverse Proxy
   │
   ▼
API
   │
   ├──► RDS
   │      └── Datos principales
   │
   └──► DynamoDB
          └── Atributos y referencia de miniatura
   │
   ▼
API combina la información
   │
   ▼
Frontend
   │
   └── Mostrar catálogo
```

Cada elemento del catálogo puede mostrar:

* Miniatura.
* Nombre.
* Precio.
* Categoría.

Los productos que permanecen pendientes no deben aparecer en esta consulta.

---

## 9. Flujo de consulta del detalle

La consulta de detalle permite obtener la información completa de un producto.

```text
GET /productos/{id}
        │
        ▼
       API
        │
        ├──► RDS
        │
        └──► DynamoDB
                │
                ▼
        Combinar información
                │
                ▼
             Frontend
```

El detalle puede incluir:

* Datos principales.
* Descripción.
* Categoría.
* Precio.
* Atributos variables.
* Estado del producto.

La referencia de la miniatura se obtiene de la información asociada al producto.

---

## 10. Flujo de recuperación de la miniatura

La miniatura almacenada en S3 puede ser solicitada mediante el endpoint correspondiente.

```text
Frontend
   │
   │ GET /productos/{id}/imagen
   ▼
API
   │
   ▼
S3
   │
   │ Obtener miniatura
   ▼
API
   │
   │ Content-Type correspondiente
   ▼
Frontend
```

Si la miniatura no está disponible, la API debe informar el estado correspondiente en lugar de devolver una imagen inexistente.

---

## 11. Relación entre los servicios

La solución distribuye las responsabilidades de la siguiente manera:

| Componente    | Responsabilidad                                |
| ------------- | ---------------------------------------------- |
| Frontend      | Registro y consulta del catálogo               |
| Reverse Proxy | Punto de entrada y direccionamiento            |
| API / Backend | Lógica de negocio y comunicación con servicios |
| RDS           | Productos y categorías                         |
| DynamoDB      | Atributos variables y estados/referencias      |
| S3            | Fotografías originales y miniaturas            |
| Lambda        | Validación y generación de miniaturas          |
| ECR           | Almacenamiento de imágenes Docker              |
| EKS           | Ejecución y orquestación de la aplicación      |
| FLOCI         | Entorno local para los servicios y despliegue  |

---

## 12. Flujo completo

El flujo completo de la solución puede resumirse de la siguiente manera:

```text
                 USUARIO
                    │
                    ▼
                FRONTEND
                    │
                    ▼
             REVERSE PROXY
                    │
                    ▼
                  API
                    │
          ┌─────────┼─────────┐
          │         │         │
          ▼         ▼         ▼
         RDS    DynamoDB      S3
          │         │         │
          │         │         ▼
          │         │      LAMBDA
          │         │         │
          │         ◄─────────┘
          │
          └─────────┬─────────┐
                    │         │
                    ▼         ▼
               INFORMACIÓN  IMAGEN
                    │         │
                    └────┬────┘
                         ▼
                     CATÁLOGO
```

El flujo garantiza que la información principal, los atributos variables y las fotografías se mantengan asociados mediante el `producto_id`.

---

## 13. Integración con las etapas del proyecto

Los flujos descritos se relacionan con las diferentes etapas de implementación:

| Etapa   | Componentes relacionados                              |
| ------- | ----------------------------------------------------- |
| Etapa 1 | Arquitectura, frontend, proxy, API, redes y servicios |
| Etapa 2 | RDS y DynamoDB                                        |
| Etapa 3 | S3 y Lambda                                           |
| Etapa 4 | Backend y endpoints                                   |
| Etapa 5 | Frontend y catálogo                                   |
| Etapa 6 | ECR                                                   |
| Etapa 7 | EKS y despliegue final                                |

Las evidencias específicas de cada etapa, incluyendo capturas de pantalla, consultas, resultados de pruebas y verificaciones, se encuentran documentadas en el **documento principal del proyecto**.

Este archivo funciona como complemento técnico para comprender la interacción entre los componentes y el flujo de información de la solución.
