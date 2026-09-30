const express = require("express");
const cors = require("cors");
const multer = require("multer");

const {
    DynamoDBClient
} = require("@aws-sdk/client-dynamodb");

const {
    DynamoDBDocumentClient,
    PutCommand,
    GetCommand,
    UpdateCommand
} = require("@aws-sdk/lib-dynamodb");

const {
    S3Client,
    PutObjectCommand,
    GetObjectCommand
} = require("@aws-sdk/client-s3");

const {
    LambdaClient,
    InvokeCommand
} = require("@aws-sdk/client-lambda");

const { pool, probarConexion } = require("./db");

require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

const AWS_ENDPOINT_URL =
    process.env.AWS_ENDPOINT_URL || "http://localhost:4566";

const AWS_REGION =
    process.env.AWS_REGION || "us-east-1";

const DYNAMODB_TABLE =
    process.env.DYNAMODB_TABLE || "ProductoAtributos";

const ORIGINAL_BUCKET =
    process.env.ORIGINAL_BUCKET || "lomax-originales";

const THUMBNAIL_BUCKET =
    process.env.THUMBNAIL_BUCKET || "lomax-miniaturas";

const LAMBDA_FUNCTION =
    process.env.LAMBDA_FUNCTION || "lomax-thumbnail";

const awsConfig = {
    region: AWS_REGION,
    endpoint: AWS_ENDPOINT_URL,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "test",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "test"
    }
};

const dynamoClient = new DynamoDBClient(awsConfig);
const dynamoDB = DynamoDBDocumentClient.from(dynamoClient);

const s3 = new S3Client({
    ...awsConfig,
    forcePathStyle: true
});

const lambda = new LambdaClient(awsConfig);

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024
    }
});

app.use(cors());
app.use(express.json());


// =====================================================
// GET /
// =====================================================

app.get("/", (req, res) => {
    res.json({
        proyecto: "Lomax SA",
        servicio: "Backend API",
        estado: "ACTIVO"
    });
});


// =====================================================
// GET /categorias
// =====================================================

app.get("/categorias", async (req, res) => {
    try {
        const [categorias] = await pool.query(`
            SELECT
                categoria_id,
                nombre,
                descripcion
            FROM categorias
            ORDER BY categoria_id
        `);

        res.status(200).json(categorias);

    } catch (error) {
        console.error("Error obteniendo categorías:", error.message);

        res.status(500).json({
            error: "No se pudieron obtener las categorías"
        });
    }
});


// =====================================================
// POST /productos
// =====================================================

app.post("/productos", async (req, res) => {

    const {
        codigo,
        nombre,
        descripcion,
        precio,
        categoria_id,
        attributes
    } = req.body;

    if (
        !codigo ||
        !nombre ||
        precio === undefined ||
        precio === null ||
        !categoria_id ||
        !attributes
    ) {
        return res.status(400).json({
            error: "Faltan datos obligatorios"
        });
    }

    const precioNumero = Number(precio);

    if (!Number.isFinite(precioNumero)) {
        return res.status(400).json({
            error: "El precio debe ser numérico"
        });
    }

    if (precioNumero < 0) {
        return res.status(400).json({
            error: "El precio no puede ser negativo"
        });
    }

    if (
        typeof attributes !== "object" ||
        Array.isArray(attributes)
    ) {
        return res.status(400).json({
            error: "attributes debe ser un objeto"
        });
    }

    let connection;
    let producto_id;

    try {

        connection = await pool.getConnection();

        const [categorias] = await connection.query(
            `
            SELECT categoria_id
            FROM categorias
            WHERE categoria_id = ?
            `,
            [categoria_id]
        );

        if (categorias.length === 0) {

            connection.release();

            return res.status(400).json({
                error: "La categoría no existe"
            });
        }

        const [resultado] = await connection.query(
            `
            INSERT INTO productos
            (
                codigo,
                nombre,
                descripcion,
                precio,
                categoria_id,
                estado
            )
            VALUES (?, ?, ?, ?, ?, 'PENDIENTE')
            `,
            [
                codigo,
                nombre,
                descripcion || null,
                precioNumero,
                categoria_id
            ]
        );

        producto_id = resultado.insertId;

        await dynamoDB.send(
            new PutCommand({
                TableName: DYNAMODB_TABLE,
                Item: {
                    producto_id: Number(producto_id),
                    atributos: attributes
                }
            })
        );

        connection.release();

        res.status(201).json({
            mensaje: "Producto creado correctamente",
            producto_id,
            estado: "PENDIENTE"
        });

    } catch (error) {

        if (connection) {
            connection.release();
        }

        console.error(
            "Error creando producto:",
            error.message
        );

        if (error.code === "ER_DUP_ENTRY") {

            return res.status(409).json({
                error: "El código del producto ya existe"
            });
        }

        if (producto_id) {

            try {

                await pool.query(
                    `
                    DELETE FROM productos
                    WHERE producto_id = ?
                    `,
                    [producto_id]
                );

            } catch (rollbackError) {

                console.error(
                    "Error realizando rollback:",
                    rollbackError.message
                );
            }
        }

        res.status(500).json({
            error: "No se pudo crear el producto"
        });
    }
});


// =====================================================
// POST /productos/:id/imagen
// =====================================================

app.post(
    "/productos/:id/imagen",
    upload.single("imagen"),
    async (req, res) => {

        const producto_id = Number(req.params.id);

        if (!Number.isInteger(producto_id)) {
            return res.status(400).json({
                error: "producto_id inválido"
            });
        }

        if (!req.file) {
            return res.status(400).json({
                error: "Debe enviar una imagen"
            });
        }

        if (
            req.file.mimetype !== "image/jpeg" &&
            req.file.mimetype !== "image/png"
        ) {
            return res.status(415).json({
                error: "Solo se permiten imágenes JPEG o PNG"
            });
        }

        try {

            const [productos] = await pool.query(
                `
                SELECT producto_id, estado
                FROM productos
                WHERE producto_id = ?
                `,
                [producto_id]
            );

            if (productos.length === 0) {
                return res.status(404).json({
                    error: "Producto no encontrado"
                });
            }

            const extension =
                req.file.mimetype === "image/png"
                    ? "png"
                    : "jpg";

            const originalKey =
                `originales/${producto_id}/producto-${producto_id}.${extension}`;

            // Guardar imagen original
            await s3.send(
                new PutObjectCommand({
                    Bucket: ORIGINAL_BUCKET,
                    Key: originalKey,
                    Body: req.file.buffer,
                    ContentType: req.file.mimetype
                })
            );

            // Guardar referencia inicial en DynamoDB
            await dynamoDB.send(
                new UpdateCommand({
                    TableName: DYNAMODB_TABLE,
                    Key: {
                        producto_id
                    },
                    UpdateExpression: `
                        SET imagen_original_key = :original,
                            estado_procesamiento = :estado
                    `,
                    ExpressionAttributeValues: {
                        ":original": originalKey,
                        ":estado": "PENDIENTE"
                    }
                })
            );

            // Invocar Lambda
            const payload = {
                producto_id: String(producto_id),
                bucket: ORIGINAL_BUCKET,
                original_key: originalKey
            };

            const lambdaResponse = await lambda.send(
                new InvokeCommand({
                    FunctionName: LAMBDA_FUNCTION,
                    InvocationType: "RequestResponse",
                    Payload: Buffer.from(JSON.stringify(payload))
                })
            );

            const lambdaResult =
                JSON.parse(
                    Buffer.from(
                        lambdaResponse.Payload || "{}"
                    ).toString()
                );

            if (
                lambdaResult.statusCode !== 200 ||
                lambdaResult.estado !== "LISTA"
            ) {

                return res.status(400).json({
                    error: "La imagen no pudo ser procesada",
                    detalle: lambdaResult
                });
            }

            // Verificar atributos
            const dynamoResult =
                await dynamoDB.send(
                    new GetCommand({
                        TableName: DYNAMODB_TABLE,
                        Key: {
                            producto_id
                        }
                    })
                );

            const item = dynamoResult.Item;

            if (
                !item ||
                !item.atributos ||
                !item.miniatura_key ||
                item.estado_procesamiento !== "LISTA"
            ) {

                return res.status(409).json({
                    error: "El producto permanece PENDIENTE"
                });
            }

            // Publicar producto
            await pool.query(
                `
                UPDATE productos
                SET estado = 'PUBLICADO'
                WHERE producto_id = ?
                `,
                [producto_id]
            );

            res.status(200).json({
                mensaje: "Imagen procesada correctamente",
                producto_id,
                estado: "PUBLICADO",
                imagen_original_key:
                    item.imagen_original_key,
                miniatura_key:
                    item.miniatura_key
            });

        } catch (error) {

            console.error(
                "Error procesando imagen:",
                error.message
            );

            res.status(502).json({
                error: "Error procesando la imagen",
                detalle: error.message
            });
        }
    }
);


// =====================================================
// POST /productos/:id/reprocesar
// =====================================================

app.post(
    "/productos/:id/reprocesar",
    async (req, res) => {

        const producto_id = Number(req.params.id);

        if (!Number.isInteger(producto_id)) {
            return res.status(400).json({
                error: "producto_id inválido"
            });
        }

        try {

            const result =
                await dynamoDB.send(
                    new GetCommand({
                        TableName: DYNAMODB_TABLE,
                        Key: {
                            producto_id
                        }
                    })
                );

            const item = result.Item;

            if (
                !item ||
                !item.imagen_original_key
            ) {

                return res.status(409).json({
                    error: "El producto no tiene imagen original"
                });
            }

            const payload = {
                producto_id: String(producto_id),
                bucket: ORIGINAL_BUCKET,
                original_key:
                    item.imagen_original_key
            };

            const lambdaResponse =
                await lambda.send(
                    new InvokeCommand({
                        FunctionName: LAMBDA_FUNCTION,
                        InvocationType: "RequestResponse",
                        Payload: Buffer.from(
                            JSON.stringify(payload)
                        )
                    })
                );

            const lambdaResult =
                JSON.parse(
                    Buffer.from(
                        lambdaResponse.Payload || "{}"
                    ).toString()
                );

            if (
                lambdaResult.statusCode !== 200 ||
                lambdaResult.estado !== "LISTA"
            ) {

                return res.status(400).json({
                    error: "El reprocesamiento falló",
                    detalle: lambdaResult
                });
            }

            const actualizado =
                await dynamoDB.send(
                    new GetCommand({
                        TableName: DYNAMODB_TABLE,
                        Key: {
                            producto_id
                        }
                    })
                );

            const actualizadoItem =
                actualizado.Item;

            if (
                actualizadoItem &&
                actualizadoItem.atributos &&
                actualizadoItem.miniatura_key &&
                actualizadoItem.estado_procesamiento === "LISTA"
            ) {

                await pool.query(
                    `
                    UPDATE productos
                    SET estado = 'PUBLICADO'
                    WHERE producto_id = ?
                    `,
                    [producto_id]
                );

                return res.status(200).json({
                    mensaje: "Producto reprocesado correctamente",
                    producto_id,
                    estado: "PUBLICADO",
                    miniatura_key:
                        actualizadoItem.miniatura_key
                });
            }

            res.status(409).json({
                error: "El producto permanece PENDIENTE"
            });

        } catch (error) {

            console.error(
                "Error reprocesando:",
                error.message
            );

            res.status(502).json({
                error: "Error durante el reprocesamiento",
                detalle: error.message
            });
        }
    }
);


// =====================================================
// GET /productos
// =====================================================

app.get("/productos", async (req, res) => {

    try {

        const [productos] = await pool.query(`
            SELECT
                p.producto_id,
                p.codigo,
                p.nombre,
                p.descripcion,
                p.precio,
                p.categoria_id,
                c.nombre AS categoria,
                p.fecha_creacion,
                p.estado
            FROM productos p
            INNER JOIN categorias c
                ON p.categoria_id = c.categoria_id
            WHERE p.estado = 'PUBLICADO'
            ORDER BY p.producto_id
        `);

        const productosCompletos = [];

        for (const producto of productos) {

            const result =
                await dynamoDB.send(
                    new GetCommand({
                        TableName: DYNAMODB_TABLE,
                        Key: {
                            producto_id:
                                producto.producto_id
                        }
                    })
                );

            const item = result.Item;

            if (
                item &&
                item.atributos &&
                item.miniatura_key
            ) {

                productosCompletos.push({
                    ...producto,
                    atributos: item.atributos,
                    miniatura_key:
                        item.miniatura_key
                });
            }
        }

        res.status(200).json(productosCompletos);

    } catch (error) {

        console.error(
            "Error obteniendo productos:",
            error.message
        );

        res.status(500).json({
            error: "No se pudieron obtener los productos"
        });
    }
});


// =====================================================
// GET /productos/:id
// =====================================================

app.get("/productos/:id", async (req, res) => {

    const producto_id = Number(req.params.id);

    try {

        const [productos] = await pool.query(
            `
            SELECT
                p.producto_id,
                p.codigo,
                p.nombre,
                p.descripcion,
                p.precio,
                p.categoria_id,
                c.nombre AS categoria,
                p.fecha_creacion,
                p.estado
            FROM productos p
            INNER JOIN categorias c
                ON p.categoria_id = c.categoria_id
            WHERE p.producto_id = ?
            `,
            [producto_id]
        );

        if (productos.length === 0) {

            return res.status(404).json({
                error: "Producto no encontrado"
            });
        }

        const producto = productos[0];

        const result =
            await dynamoDB.send(
                new GetCommand({
                    TableName: DYNAMODB_TABLE,
                    Key: {
                        producto_id
                    }
                })
            );

        res.status(200).json({
            ...producto,
            atributos:
                result.Item?.atributos || {},
            imagen_original_key:
                result.Item?.imagen_original_key || null,
            miniatura_key:
                result.Item?.miniatura_key || null,
            estado_procesamiento:
                result.Item?.estado_procesamiento || "PENDIENTE"
        });

    } catch (error) {

        console.error(
            "Error obteniendo detalle:",
            error.message
        );

        res.status(500).json({
            error: "No se pudo obtener el producto"
        });
    }
});


// =====================================================
// GET /productos/:id/imagen
// =====================================================

app.get(
    "/productos/:id/imagen",
    async (req, res) => {

        const producto_id = Number(req.params.id);

        try {

            const result =
                await dynamoDB.send(
                    new GetCommand({
                        TableName: DYNAMODB_TABLE,
                        Key: {
                            producto_id
                        }
                    })
                );

            const item = result.Item;

            if (
                !item ||
                !item.miniatura_key
            ) {

                return res.status(404).json({
                    error: "Miniatura no disponible"
                });
            }

            const object =
                await s3.send(
                    new GetObjectCommand({
                        Bucket: THUMBNAIL_BUCKET,
                        Key: item.miniatura_key
                    })
                );

            res.setHeader(
                "Content-Type",
                object.ContentType || "image/jpeg"
            );

            const chunks = [];

            for await (const chunk of object.Body) {
                chunks.push(chunk);
            }

            res.send(Buffer.concat(chunks));

        } catch (error) {

            console.error(
                "Error obteniendo imagen:",
                error.message
            );

            res.status(404).json({
                error: "Imagen no disponible"
            });
        }
    }
);


// =====================================================
// MANEJO DE ERRORES DE MULTER
// =====================================================

app.use((error, req, res, next) => {

    if (error instanceof multer.MulterError) {

        if (error.code === "LIMIT_FILE_SIZE") {

            return res.status(413).json({
                error: "La imagen supera el límite de 5 MB"
            });
        }

        return res.status(400).json({
            error: error.message
        });
    }

    next(error);
});


// =====================================================
// INICIAR SERVIDOR
// =====================================================

app.listen(PORT, async () => {

    console.log(
        `Backend Lomax ejecutándose en http://localhost:${PORT}`
    );

    await probarConexion();
});