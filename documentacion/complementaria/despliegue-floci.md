# Despliegue en FLOCI — Lomax S.A.

## 1. Introducción

La solución de **Lomax S.A.** se desarrolla y despliega utilizando **FLOCI** como entorno local para trabajar con los servicios de AWS requeridos por el proyecto.

El despliegue integra contenedores Docker, imágenes almacenadas en ECR y componentes ejecutados mediante Kubernetes en EKS, manteniendo los servicios de persistencia y almacenamiento fuera de los Pods de aplicación.

Este documento complementa el documento principal describiendo la organización del despliegue y la relación entre sus componentes.

---

## 2. Entorno FLOCI

FLOCI proporciona el entorno local utilizado para desarrollar, probar y desplegar los componentes de la solución.

Dentro de este entorno se trabajan los servicios necesarios para el proyecto, entre ellos:

* Amazon RDS.
* DynamoDB.
* Amazon S3.
* AWS Lambda.
* Amazon ECR.
* Amazon EKS.

El objetivo es poder comprobar localmente el funcionamiento de la arquitectura antes y durante el despliegue de los componentes mediante Kubernetes.

```text
┌──────────────────────────────────────────────┐
│                    FLOCI                     │
│                                              │
│  ┌──────────────┐      ┌─────────────────┐  │
│  │   Servicios  │      │   Kubernetes    │  │
│  │     AWS      │      │      / EKS      │  │
│  │              │      │                 │  │
│  │ RDS          │      │ Frontend Pod    │  │
│  │ DynamoDB     │      │ Backend Pod     │  │
│  │ S3           │      │ Proxy           │  │
│  │ Lambda       │      │                 │  │
│  │ ECR          │      │                 │  │
│  └──────────────┘      └─────────────────┘  │
│                                              │
└──────────────────────────────────────────────┘
```

---

## 3. Contenedorización

El frontend y el backend de la solución se preparan como imágenes Docker.

Cada imagen contiene los elementos necesarios para ejecutar su respectivo componente de manera independiente del entorno donde se despliegue.

### Backend

La imagen del backend contiene:

* Código de la API.
* Dependencias necesarias.
* Configuración de ejecución.
* Dockerfile correspondiente.

### Frontend

La imagen del frontend contiene:

* Aplicación web.
* Dependencias de construcción.
* Archivos necesarios para servir la interfaz.
* Dockerfile correspondiente.

La utilización de imágenes permite mantener una versión reproducible de la aplicación y facilita su posterior publicación en ECR.

---

## 4. Registro de imágenes en ECR

Una vez construidas las imágenes Docker, estas se publican en los repositorios correspondientes de **Amazon ECR**.

La solución utiliza repositorios separados para:

```text
ECR
├── frontend
└── backend
```

El flujo general es:

```text
Código fuente
     │
     ▼
Dockerfile
     │
     ▼
docker build
     │
     ▼
Imagen Docker
     │
     ▼
Etiquetado
     │
     ▼
ECR
     │
     ├── Imagen frontend
     │
     └── Imagen backend
```

La versión de las imágenes debe estar relacionada con el commit correspondiente a la entrega, permitiendo identificar qué versión del código fue publicada.

---

## 5. Ejecución mediante EKS

En la etapa de despliegue, las imágenes publicadas en ECR son utilizadas por Kubernetes para ejecutar los componentes de la aplicación.

La organización general es:

```text
                 EKS
                  │
        ┌─────────┼─────────┐
        │         │         │
        ▼         ▼         ▼
    Frontend    Backend    Proxy
      Pod        Pod(s)     │
                             │
                             ▼
                           API
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
             RDS          DynamoDB          S3
                                             │
                                           Lambda
```

Los Pods de aplicación son considerados componentes reemplazables. La información persistente no debe depender del ciclo de vida de estos Pods.

---

## 6. Persistencia fuera de los Pods

Los componentes de aplicación ejecutados en Kubernetes no almacenan de manera permanente la información principal del sistema.

La persistencia se encuentra distribuida en los servicios correspondientes:

| Servicio | Información                               |
| -------- | ----------------------------------------- |
| RDS      | Productos y categorías                    |
| DynamoDB | Atributos variables y estados/referencias |
| S3       | Fotografías originales y miniaturas       |

Esto permite que la eliminación o recreación de un Pod no provoque la pérdida de los productos registrados.

```text
              Kubernetes
                  │
          ┌───────┴───────┐
          │               │
       Backend         Frontend
          │
          │
          ▼
   Servicios persistentes
          │
    ┌─────┼─────┐
    ▼     ▼     ▼
   RDS  DynamoDB S3
```

---

## 7. Conectividad de los componentes

El despliegue requiere comunicación entre los componentes de la aplicación y los servicios utilizados por el backend.

El backend debe poder comunicarse con:

* RDS.
* DynamoDB.
* S3.
* Lambda.

El frontend se comunica con el backend mediante el punto de entrada definido por el proxy.

```text
Usuario
   │
   ▼
Proxy
   │
   ▼
Frontend / API
   │
   ├────► RDS
   ├────► DynamoDB
   ├────► S3
   └────► Lambda
```

Las direcciones, puertos y variables de entorno utilizados durante el despliegue deben corresponder a la configuración real del entorno FLOCI.

---

## 8. Variables de configuración

Los componentes deben utilizar configuración externa para evitar colocar valores específicos del entorno directamente dentro del código.

Entre los valores que pueden requerirse se encuentran:

* Host de RDS.
* Puerto de RDS.
* Nombre de la base de datos.
* Nombre de tabla DynamoDB.
* Nombre de bucket de originales.
* Nombre de bucket de miniaturas.
* Identificador o nombre de la función Lambda.
* Dirección de ECR.
* Configuración utilizada por Kubernetes.

Se recomienda utilizar archivos de configuración de ejemplo para documentar las variables requeridas sin almacenar credenciales reales.

---

## 9. Escalamiento del backend

Una de las verificaciones de la etapa de EKS consiste en demostrar que el backend puede ejecutarse con múltiples réplicas.

El flujo esperado es:

```text
Backend
   │
   ├── Pod 1
   │
   ├── Pod 2
   │
   └── Pod 3
```

Las tres réplicas deben encontrarse en estado **Ready** y poder atender solicitudes.

La aplicación puede utilizar los logs o un identificador de instancia para demostrar qué Pod atendió una determinada solicitud.

El escalamiento no debe modificar los datos persistentes, ya que estos se encuentran en RDS, DynamoDB y S3.

---

## 10. Recuperación de Pods

Kubernetes también permite verificar el mecanismo de recuperación de componentes.

Cuando un Pod del backend es eliminado, Kubernetes debe crear un reemplazo para recuperar el número de réplicas configurado.

```text
Antes

Backend
├── Pod A
├── Pod B
└── Pod C

       │
       │ eliminar Pod B
       ▼

Kubernetes detecta la ausencia
       │
       ▼
Crea nuevo Pod
       │
       ▼

Después

Backend
├── Pod A
├── Pod C
└── Pod D
```

El nuevo Pod puede tener un UID diferente al Pod eliminado, pero debe utilizar la misma imagen y recuperar el funcionamiento de la aplicación.

La información registrada anteriormente debe permanecer disponible porque la persistencia está fuera del Pod.

---

## 11. Actualización y versionado

Las imágenes utilizadas por Kubernetes deben estar asociadas a una versión identificable.

El flujo recomendado es:

```text
Commit
   │
   ▼
Construcción de imagen
   │
   ▼
Tag de versión
   │
   ▼
Push a ECR
   │
   ▼
Deployment en EKS
```

Esto permite relacionar:

* Código fuente.
* Commit.
* Imagen Docker.
* Repositorio ECR.
* Versión desplegada en EKS.

De esta forma, la versión ejecutada puede ser identificada durante la verificación de la entrega.

---

## 12. Integración del despliegue

El despliegue completo puede representarse de la siguiente manera:

```text
                    FLOCI
                      │
          ┌───────────┴───────────┐
          │                       │
          ▼                       ▼
         ECR                     EKS
          │                       │
     ┌────┴────┐          ┌───────┼───────┐
     │         │          │       │       │
 Frontend   Backend    Frontend Backend  Proxy
     │         │          │       │
     └─────────┘          │       │
                          │       │
                          └───┬───┘
                              │
                              ▼
                    Servicios AWS
                  ┌──────┬──────┬──────┐
                  ▼      ▼      ▼      ▼
                 RDS  DynamoDB   S3  Lambda
```

Este modelo permite separar la ejecución de la aplicación de los servicios que mantienen los datos y archivos.

---

## 13. Relación con las etapas del proyecto

La configuración descrita se relaciona principalmente con las últimas etapas del proyecto:

| Etapa   | Relación con el despliegue                                      |
| ------- | --------------------------------------------------------------- |
| Etapa 4 | Construcción del backend y Dockerfile                           |
| Etapa 5 | Construcción del frontend y su contenedor                       |
| Etapa 6 | Construcción, etiquetado y publicación de imágenes en ECR       |
| Etapa 7 | Ejecución de las imágenes mediante EKS                          |
| E7      | Escalamiento, recuperación de Pods y validación de persistencia |

Las evidencias específicas de estas actividades se encuentran en el documento principal del proyecto.

---

## 14. Consideraciones de persistencia

La arquitectura está diseñada para que los Pods de aplicación sean reemplazables sin perder la información del sistema.

Por esta razón:

* Los productos se almacenan en RDS.
* Los atributos variables se almacenan en DynamoDB.
* Las fotografías se almacenan en S3.
* EKS ejecuta los componentes de aplicación.
* ECR conserva las imágenes necesarias para desplegar los componentes.

Esta separación permite comprobar que la recreación de Pods no implica volver a registrar los productos.

---

## 15. Resumen

El despliegue de Lomax S.A. utiliza FLOCI como entorno de trabajo y validación de la arquitectura.

La solución utiliza Docker para empaquetar frontend y backend, ECR para almacenar las imágenes y EKS para ejecutar y administrar los componentes mediante Kubernetes.

Los servicios de persistencia y almacenamiento permanecen fuera de los Pods, permitiendo comprobar escalamiento, eliminación y recreación de componentes sin perder la información registrada.

Las capturas, comandos y resultados de las verificaciones correspondientes a cada etapa se encuentran documentados en el documento principal.
