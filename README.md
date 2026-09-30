# Lomax SA — Plataforma de Catálogo de Productos Tecnológicos

Plataforma web desarrollada para Lomax SA para gestionar y publicar un catálogo de productos tecnológicos.

El sistema permite registrar productos, almacenar sus atributos variables, gestionar imágenes, generar miniaturas y mostrar únicamente productos completos y publicados en el catálogo.

## Integrantes

| Integrante                      | Rol / participación                                                    |
| ------------------------------- | ---------------------------------------------------------------------- |
| Brenda Michelle Alanoca Challco | Desarrollo backend, integración, Docker y despliegue en Kubernetes/EKS |
| Aldira Mamani Sanga             | Base de datos, documentación y colaboración en el proyecto             |

## Funcionalidades

* Registro de productos.
* Validación de datos.
* Validación de precio no negativo.
* Validación de categoría existente.
* Control de códigos de producto únicos.
* Registro de atributos variables.
* Carga de imágenes.
* Procesamiento de imágenes mediante Lambda.
* Generación automática de miniaturas de máximo 300×300 px.
* Reprocesamiento de productos incompletos.
* Publicación únicamente cuando el producto cumple las condiciones requeridas.
* Catálogo de productos publicados.
* Vista de detalle de producto.
* Persistencia de información.
* Contenedorización mediante Docker.
* Despliegue mediante Kubernetes/EKS.

## Arquitectura

La solución utiliza los siguientes componentes:

* Frontend: React + Vite.
* Backend: Node.js + Express.
* Base de datos relacional: MySQL mediante RDS.
* Base de datos NoSQL: DynamoDB.
* Almacenamiento de imágenes: Amazon S3.
* Procesamiento de imágenes: AWS Lambda.
* Registro de imágenes: ECR.
* Contenedores: Docker.
* Orquestación: Kubernetes/EKS.
* Proxy inverso: Nginx.
* Entorno de desarrollo: FLOCI.

## Flujo principal

1. El usuario registra un producto.
2. El backend valida los datos.
3. El producto se registra inicialmente como `PENDIENTE`.
4. Los atributos variables se almacenan en DynamoDB.
5. La imagen original se almacena en S3.
6. Lambda procesa la imagen.
7. Se genera una miniatura proporcional.
8. Se actualiza el estado del procesamiento.
9. Cuando toda la información requerida está disponible, el producto pasa a `PUBLICADO`.
10. El producto publicado aparece en el catálogo.

## Estructura del proyecto

```text
lomax-catalogo/
├── backend/                 # API Node.js + Express
├── database/                # Scripts y evidencias de base de datos
├── frontend/                # Aplicación React
├── kubernetes/              # Manifiestos de despliegue
├── lambda/                  # Función de procesamiento de imágenes
├── proxy/                   # Configuración Nginx
├── README.md
└── .gitignore
```

## Backend

El backend proporciona endpoints para:

* Consultar categorías.
* Registrar productos.
* Consultar productos publicados.
* Consultar el detalle de un producto.
* Registrar imágenes.
* Procesar/reprocesar imágenes.
* Validar datos de productos.

## Base de datos

### MySQL

Se utiliza para almacenar:

* Categorías.
* Productos.
* Código único.
* Nombre.
* Descripción.
* Precio.
* Estado.
* Fecha de creación.

### DynamoDB

Se utiliza para almacenar:

* Atributos variables.
* Clave de imagen original.
* Clave de miniatura.
* Estado del procesamiento.

## Imágenes

Las imágenes originales se almacenan en S3 y Lambda genera automáticamente una miniatura manteniendo la proporción original y con un tamaño máximo de 300×300 píxeles.

## Docker

El proyecto contiene imágenes Docker para:

* Backend.
* Frontend.
* Proxy.
* Lambda.

## Kubernetes

El directorio `kubernetes/` contiene los manifiestos utilizados para desplegar:

* `lomax-backend`
* `lomax-frontend`
* `lomax-proxy`

## Ejecución local

### Backend

```powershell
cd backend
npm install
npm start
```

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

## Evidencias

El proyecto contiene archivos de prueba y evidencias correspondientes a:

* Validación de productos.
* Código duplicado.
* Precio negativo.
* Categoría inexistente.
* Procesamiento de imágenes.
* Generación de miniaturas.
* Reprocesamiento.
* Despliegue de contenedores.
* Kubernetes.

## Repositorio

Repositorio oficial:

https://github.com/brendachallco7-spec/lomax-catalogo
