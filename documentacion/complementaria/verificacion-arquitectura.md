# Verificación de la arquitectura — Lomax S.A.

## 1. Introducción

La arquitectura propuesta para **Lomax S.A.** se verifica mediante la implementación progresiva de los componentes definidos en las diferentes etapas del proyecto.

El objetivo de esta verificación es comprobar que los componentes representados en el diagrama corresponden con los recursos utilizados durante el desarrollo y despliegue de la solución.

Las evidencias detalladas de cada prueba se encuentran en el documento principal del proyecto.

---

## 2. Relación entre arquitectura y etapas

La arquitectura se implementa progresivamente de acuerdo con las etapas definidas para el proyecto.

| Etapa   | Componentes principales                              | Verificación |
| ------- | ---------------------------------------------------- | ------------ |
| Etapa 1 | Frontend, proxy, API, redes y arquitectura AWS/FLOCI | E1           |
| Etapa 2 | RDS y DynamoDB                                       | E2           |
| Etapa 3 | S3 y Lambda                                          | E3           |
| Etapa 4 | Backend y API                                        | E4           |
| Etapa 5 | Frontend y catálogo                                  | E5           |
| Etapa 6 | ECR                                                  | E6           |
| Etapa 7 | EKS                                                  | E7           |

La implementación de cada etapa permite comprobar progresivamente la arquitectura planteada.

---

## 3. Verificación de la arquitectura inicial — E1

La primera verificación corresponde al funcionamiento general de la solución mediante el diagrama de arquitectura.

Se identifican los principales componentes:

* Usuario.
* Frontend.
* Reverse Proxy.
* API / Backend.
* RDS.
* DynamoDB.
* S3.
* Lambda.
* ECR.
* EKS.
* FLOCI.
* Redes y comunicaciones.

El flujo general definido es:

```text id="x7w0qz"
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
   ├────► RDS
   ├────► DynamoDB
   ├────► S3
   └────► Lambda
```

Posteriormente, frontend y backend son empaquetados mediante Docker y sus imágenes pueden ser almacenadas en ECR y ejecutadas mediante EKS.

---

## 4. Verificación de persistencia — E2

La segunda etapa permite comprobar la separación entre los datos estructurados y los atributos variables.

### RDS

Se verifica:

* Inserción de productos válidos.
* Rechazo de códigos duplicados.
* Rechazo de precios negativos.
* Rechazo de categorías inexistentes.
* Ausencia de registros parciales cuando una operación es inválida.
* Persistencia de los datos después de reiniciar los componentes correspondientes.

### DynamoDB

Se verifica:

* Almacenamiento mediante `producto_id`.
* Recuperación mediante `producto_id`.
* Productos con diferentes conjuntos de atributos.
* Correspondencia entre el identificador utilizado en DynamoDB y el producto almacenado en RDS.

La relación conceptual es:

```text id="j0c3l7"
          producto_id
               │
       ┌───────┴───────┐
       ▼               ▼
      RDS          DynamoDB
       │               │
Datos principales   Atributos
       │               │
       └───────┬───────┘
               ▼
          Mismo producto
```

---

## 5. Verificación de imágenes — E3

La tercera etapa verifica la integración entre S3, Lambda y DynamoDB.

Se comprueba que:

1. La imagen original se almacene en S3.
2. Lambda reciba la información necesaria para procesarla.
3. Se genere una miniatura proporcional.
4. La miniatura tenga como máximo 300 × 300 píxeles.
5. La referencia de la miniatura sea almacenada en DynamoDB.
6. El archivo generado pueda recuperarse desde S3.
7. Repetir el procesamiento no genere objetos adicionales.
8. Una imagen inválida produzca un estado de error y no una miniatura válida.

El flujo verificado es:

```text id="az1tly"
Imagen original
      │
      ▼
     S3
      │
      ▼
   Lambda
      │
      ▼
Miniatura
      │
      ├────► S3
      │
      └────► DynamoDB
              │
              └── Referencia + estado
```

---

## 6. Verificación del backend — E4

La cuarta etapa verifica la comunicación de la API con los servicios de persistencia y almacenamiento.

Entre los endpoints verificados se encuentran:

| Endpoint                          | Función                        |
| --------------------------------- | ------------------------------ |
| `GET /categorias`                 | Consultar categorías           |
| `POST /productos`                 | Registrar producto             |
| `POST /productos/{id}/imagen`     | Cargar y procesar imagen       |
| `POST /productos/{id}/reprocesar` | Reintentar procesamiento       |
| `GET /productos`                  | Consultar productos publicados |
| `GET /productos/{id}`             | Consultar detalle              |
| `GET /productos/{id}/imagen`      | Recuperar miniatura            |

Las pruebas deben comprobar tanto la respuesta HTTP como el resultado real en los servicios utilizados.

Por ejemplo:

```text id="m6pk5d"
Solicitud HTTP
     │
     ▼
    API
     │
     ├────► RDS
     ├────► DynamoDB
     └────► S3
     │
     ▼
Respuesta HTTP
```

De esta manera se evita considerar suficiente únicamente una respuesta HTTP exitosa cuando la operación interna no se completó correctamente.

---

## 7. Verificación del frontend — E5

La quinta etapa comprueba el funcionamiento de la solución desde la interfaz de usuario.

Las vistas principales son:

* Registro de producto.
* Catálogo.
* Detalle del producto.

La prueba de registro debe comprobar el flujo completo:

```text id="8o8pbb"
Formulario
    │
    ▼
Frontend
    │
    ▼
API
    │
    ├──► RDS
    ├──► DynamoDB
    └──► S3 / Lambda
             │
             ▼
         PUBLICADO
             │
             ▼
          Catálogo
```

También se verifican situaciones inválidas como:

* Código duplicado.
* Archivo de imagen inválido.
* Producto incompleto.

Los productos que no cumplen las condiciones de publicación no deben aparecer en el catálogo.

---

## 8. Verificación de imágenes en ECR — E6

La sexta etapa comprueba que las imágenes Docker propias del proyecto sean publicadas correctamente en ECR.

El proceso general es:

```text id="5n9taw"
Código
  │
  ▼
Docker build
  │
  ▼
Imagen
  │
  ▼
Tag
  │
  ▼
Docker push
  │
  ▼
ECR
```

Se verifican los repositorios correspondientes al:

* Frontend.
* Backend.

Además del `push`, se comprueba que las imágenes puedan ser consultadas mediante las operaciones de ECR y descargadas nuevamente mediante `docker pull`.

La ejecución posterior de las imágenes permite comprobar que contienen la aplicación correspondiente a la versión publicada.

---

## 9. Verificación del despliegue en EKS — E7

La última etapa verifica que las imágenes almacenadas en ECR puedan ser utilizadas por EKS para ejecutar la aplicación.

El flujo es:

```text id="tq6vzt"
ECR
 │
 │ Imagen frontend/backend
 ▼
EKS
 │
 ├── Frontend Pod
 │
 ├── Backend Pod
 │
 └── Proxy
 │
 ▼
Servicios AWS
```

Se comprueba:

* Existencia de los Pods.
* Estado `Ready`.
* Uso de las imágenes publicadas en ECR.
* Comunicación con RDS.
* Comunicación con DynamoDB.
* Comunicación con S3.
* Acceso a Lambda.
* Funcionamiento del catálogo.

---

## 10. Verificación de escalamiento

El backend debe poder escalar desde una réplica hasta tres réplicas.

```text id="d5x9ap"
              Backend
                 │
       ┌─────────┼─────────┐
       ▼         ▼         ▼
     Pod 1     Pod 2     Pod 3
    Ready      Ready      Ready
```

La verificación debe demostrar que las tres réplicas se encuentran disponibles y pueden atender solicitudes.

La existencia de varias réplicas no debe generar registros duplicados ni afectar la persistencia del catálogo.

---

## 11. Verificación de recuperación

También se comprueba el mecanismo de recuperación de Kubernetes.

Se registra el UID del Pod antes de eliminarlo y posteriormente se verifica el UID del nuevo Pod creado por Kubernetes.

```text id="3sm0gp"
Pod original
     │
     │ eliminar
     ▼
Kubernetes detecta la ausencia
     │
     ▼
Crea reemplazo
     │
     ▼
Nuevo Pod
```

Aunque el nuevo Pod tenga un UID diferente, la aplicación debe continuar funcionando y el número esperado de réplicas debe recuperarse.

---

## 12. Verificación de persistencia durante el reemplazo

Una de las comprobaciones importantes consiste en demostrar que reemplazar Pods no elimina los productos registrados.

La información permanece almacenada en:

```text id="l0q4a5"
Pod
 │
 │ reemplazable
 ▼
┌──────────────────────────────┐
│ Servicios persistentes       │
│                              │
│ RDS                          │
│ DynamoDB                     │
│ S3                           │
└──────────────────────────────┘
```

Por lo tanto, después de recrear Pods se deben poder consultar nuevamente:

* Los datos del producto.
* Sus atributos.
* Su referencia de imagen.
* Su miniatura.
* Su aparición en el catálogo.

---

## 13. Contraste entre el diagrama y los recursos desplegados

La verificación final consiste en comparar los elementos representados en el diagrama con los recursos efectivamente utilizados.

| Elemento del diagrama | Recurso o componente verificado                       |
| --------------------- | ----------------------------------------------------- |
| Frontend              | Aplicación frontend contenedorizada                   |
| Reverse Proxy         | Componente de entrada definido en la arquitectura     |
| API                   | Backend de la aplicación                              |
| RDS                   | Base de datos relacional                              |
| DynamoDB              | Tabla para atributos y estados                        |
| S3                    | Buckets de imágenes                                   |
| Lambda                | Función de procesamiento                              |
| ECR                   | Repositorios de imágenes                              |
| EKS                   | Clúster y recursos Kubernetes                         |
| FLOCI                 | Entorno donde se desarrollan y verifican los recursos |

Este contraste permite comprobar que el diagrama representa los componentes que forman parte de la solución implementada.

Si durante el despliegue se modifica algún componente, nombre, recurso, puerto o mecanismo de comunicación respecto al diseño inicial, el diagrama debe actualizarse para mantener correspondencia con la implementación final.

---

## 14. Correspondencia general

La correspondencia entre diseño, implementación y verificación puede resumirse así:

```text id="5a5mda"
             DISEÑO
               │
               ▼
       Diagrama de arquitectura
               │
               ▼
        IMPLEMENTACIÓN
               │
       ┌───────┼────────┐
       ▼       ▼        ▼
      RDS    DynamoDB   S3
                         │
                       Lambda
       │       │        │
       └───────┼────────┘
               ▼
             API
               │
               ▼
           Frontend
               │
               ▼
             ECR
               │
               ▼
             EKS
               │
               ▼
          VERIFICACIÓN
               │
               ▼
          E1 ─── E7
```

---

## 15. Conclusión

La arquitectura de Lomax S.A. se verifica progresivamente mediante las etapas del proyecto.

Las primeras etapas permiten comprobar la persistencia, el almacenamiento y el procesamiento de imágenes, mientras que las etapas posteriores integran la API, el frontend, las imágenes Docker, ECR y finalmente EKS.

La comparación entre el diagrama y los recursos utilizados permite validar que la arquitectura documentada corresponde con la solución implementada.

Las evidencias detalladas de las pruebas E1 a E7 se encuentran en el documento principal del proyecto, mientras que este archivo proporciona una visión complementaria de la relación entre el diseño, la implementación y la verificación.
