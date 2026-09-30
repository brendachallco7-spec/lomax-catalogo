# Arquitectura de la solución — Lomax S.A.

## 1. Descripción general

La solución propuesta para Lomax S.A. implementa una arquitectura distribuida orientada al registro, procesamiento y consulta de un catálogo centralizado de productos.

La arquitectura integra un frontend para la interacción con los usuarios, un reverse proxy como punto de entrada, una API backend para la lógica de negocio y diferentes servicios de AWS para el almacenamiento, procesamiento y ejecución de los componentes.

El entorno de desarrollo y despliegue utilizado para la práctica es **FLOCI**, mientras que los componentes de la aplicación son empaquetados mediante Docker y preparados para su ejecución mediante Kubernetes en Amazon EKS.

## 2. Diagrama de arquitectura

![Diagrama de arquitectura de Lomax S.A.](./diagrama-arquitectura-lomax.png)

## 3. Componentes principales

### Frontend

Proporciona la interfaz utilizada para registrar productos, consultar el catálogo y visualizar el detalle de cada producto.

Incluye:

* Formulario de registro.
* Catálogo de productos.
* Tarjetas de productos.
* Vista de detalle.
* Visualización de fotografías y atributos.

### Reverse Proxy

Actúa como punto de entrada para las solicitudes de los usuarios y permite dirigir el tráfico hacia el frontend o hacia la API backend según la ruta solicitada.

También permite centralizar el acceso a los componentes de la aplicación.

### API Backend

La API concentra la lógica de negocio y coordina la comunicación con las diferentes bases de datos y servicios de almacenamiento.

Sus principales responsabilidades son:

* Validar los datos recibidos.
* Registrar productos.
* Consultar productos.
* Gestionar atributos variables.
* Cargar fotografías.
* Invocar Lambda para el procesamiento de imágenes.
* Verificar que la información necesaria esté disponible antes de publicar un producto.

### Amazon RDS

RDS almacena la información estructurada y permanente de los productos y categorías.

La entidad producto contempla información como:

* `producto_id`
* código único
* nombre
* descripción
* precio
* categoría
* fecha
* estado

El estado permite diferenciar productos `PENDIENTE` de productos `PUBLICADO`.

### Amazon DynamoDB

DynamoDB almacena información flexible asociada a cada producto.

Se utiliza para manejar:

* Atributos variables según la categoría.
* `imagen_original_key`
* `miniatura_key`
* Estado del procesamiento de la imagen.

El `producto_id` utilizado en DynamoDB corresponde al identificador del producto registrado en RDS. La relación entre ambos servicios es controlada por la API y no mediante una clave foránea.

### Amazon S3

S3 proporciona almacenamiento de objetos para las fotografías.

La solución contempla dos buckets:

1. Bucket de fotografías originales.
2. Bucket de miniaturas.

Separar ambos tipos de archivos permite diferenciar los objetos originales de las imágenes optimizadas para consulta.

### AWS Lambda

Lambda realiza el procesamiento de las fotografías.

Después de almacenar una imagen original, la API invoca la función de forma síncrona.

La función:

1. Recibe la referencia de la fotografía.
2. Valida el archivo.
3. Procesa la imagen.
4. Genera una miniatura de hasta 300 × 300 píxeles conservando su proporción.
5. Almacena la miniatura.
6. Actualiza DynamoDB con la clave de la miniatura y el estado correspondiente.

Los estados de procesamiento contemplan `LISTA` o `ERROR`.

### Amazon ECR

Amazon Elastic Container Registry almacena las imágenes Docker utilizadas por la aplicación.

Se contemplan imágenes independientes para:

* Frontend.
* Backend.

Estas imágenes sirven como artefactos de despliegue para Kubernetes.

### Amazon EKS

Amazon Elastic Kubernetes Service proporciona el entorno administrado para ejecutar Kubernetes.

Dentro del clúster se ejecutan los componentes contenedorizados de la aplicación mediante Pods administrados por Deployments y expuestos mediante Services según las necesidades de comunicación.

## 4. Kubernetes

La aplicación utiliza los siguientes elementos principales de Kubernetes:

| Recurso       | Función                                                               |
| ------------- | --------------------------------------------------------------------- |
| Cluster       | Agrupa y administra los recursos de Kubernetes.                       |
| Pod           | Ejecuta los contenedores de la aplicación.                            |
| Deployment    | Mantiene y administra las réplicas de los Pods.                       |
| Service       | Proporciona un punto estable de comunicación con los Pods.            |
| Ingress/Proxy | Gestiona el acceso y direccionamiento del tráfico cuando corresponda. |

La cantidad de réplicas y los recursos utilizados serán definidos de acuerdo con las necesidades del despliegue.

## 5. Redes y comunicación

La comunicación entre los componentes se realiza mediante protocolos de red apropiados para cada servicio.

De forma general:

```text
Usuario
   │
   │ HTTPS
   ▼
Reverse Proxy
   │
   ├──────────────► Frontend
   │
   └──────────────► API
                       │
             ┌─────────┼─────────┐
             ▼         ▼         ▼
            RDS    DynamoDB     S3
                       │
                       ▼
                    Lambda
```

Los puertos utilizados deberán corresponder a los definidos realmente en el despliegue de FLOCI, Docker y Kubernetes. No se consideran puertos adicionales que no sean necesarios para la implementación.

## 6. Almacenamiento

La información se distribuye de acuerdo con el tipo de dato:

| Información                      | Servicio |
| -------------------------------- | -------- |
| Categorías                       | RDS      |
| Datos principales de productos   | RDS      |
| Atributos variables              | DynamoDB |
| Fotografía original              | S3       |
| Miniatura                        | S3       |
| Claves y estado de procesamiento | DynamoDB |
| Imágenes Docker                  | ECR      |

## 7. Flujo de registro

El registro de un producto sigue el siguiente proceso:

```text
Usuario
   ↓
Frontend
   ↓
Reverse Proxy
   ↓
API
   ↓
RDS
Producto = PENDIENTE
   ↓
DynamoDB
Atributos
   ↓
S3
Imagen original
   ↓
Lambda
Validación y miniatura
   ↓
DynamoDB
Estado de imagen
   ↓
API verifica información completa
   ↓
RDS
Producto = PUBLICADO
```

El producto permanece como `PENDIENTE` mientras no se hayan completado y validado los elementos requeridos.

## 8. Flujo de consulta

Cuando un usuario consulta el catálogo:

```text
Usuario
   ↓
Frontend
   ↓
Reverse Proxy
   ↓
API
   ├──► RDS
   ├──► DynamoDB
   └──► S3
          ↓
       Imágenes
          ↓
       Frontend
```

La API combina la información almacenada en RDS y DynamoDB y obtiene las fotografías correspondientes desde S3 para construir la respuesta presentada al usuario.

## 9. Integración con FLOCI

FLOCI constituye el entorno utilizado para realizar la práctica y simular los servicios necesarios para el desarrollo y despliegue de la solución.

Los componentes propios de la aplicación se empaquetan mediante Docker y las imágenes son preparadas para su almacenamiento en ECR y posterior ejecución mediante EKS.

La configuración definitiva de recursos, redes, puertos y réplicas se verificará contra los recursos efectivamente desplegados.

## 10. Criterio de publicación

La arquitectura establece una separación entre el registro inicial y la publicación del producto.

Un producto se registra inicialmente como:

```text
PENDIENTE
```

Solo después de verificar que los datos obligatorios, atributos y miniatura se encuentran disponibles, la API actualiza su estado a:

```text
PUBLICADO
```

Este mecanismo evita mostrar en el catálogo productos que todavía tengan información incompleta o recursos de imagen que no hayan sido procesados correctamente.
