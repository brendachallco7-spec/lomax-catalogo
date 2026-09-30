import json
import os
import io

import boto3
from botocore.config import Config
from PIL import Image


s3 = boto3.client(
    "s3",
    endpoint_url=os.environ.get(
        "AWS_ENDPOINT_URL",
        "http://localhost:4566"
    ),
    region_name=os.environ.get(
        "AWS_REGION",
        "us-east-1"
    ),
    config=Config(
        s3={"addressing_style": "path"}
    )
)

dynamodb = boto3.client(
    "dynamodb",
    endpoint_url=os.environ.get(
        "AWS_ENDPOINT_URL",
        "http://localhost:4566"
    ),
    region_name=os.environ.get(
        "AWS_REGION",
        "us-east-1"
    )
)


ORIGINAL_BUCKET = os.environ.get(
    "ORIGINAL_BUCKET",
    "lomax-originales"
)

THUMBNAIL_BUCKET = os.environ.get(
    "THUMBNAIL_BUCKET",
    "lomax-miniaturas"
)

DYNAMODB_TABLE = os.environ.get(
    "DYNAMODB_TABLE",
    "ProductoAtributos"
)

MAX_FILE_SIZE = 5 * 1024 * 1024
MAX_SIZE = (300, 300)


def lambda_handler(event, context):

    producto_id = str(event["producto_id"])
    original_bucket = event.get(
        "bucket",
        ORIGINAL_BUCKET
    )
    original_key = event["original_key"]

    try:

        # 1. Obtener imagen original
        response = s3.get_object(
            Bucket=original_bucket,
            Key=original_key
        )

        content_type = response.get(
            "ContentType",
            ""
        ).lower()

        body = response["Body"].read()

        # 2. Validar tamaño
        if len(body) > MAX_FILE_SIZE:
            raise ValueError(
                "La imagen supera el limite de 5 MB"
            )

        # 3. Validar formato
        if content_type not in (
            "image/jpeg",
            "image/png"
        ):
            raise ValueError(
                "Formato no soportado. Solo JPEG y PNG"
            )

        # 4. Abrir imagen
        image = Image.open(
            io.BytesIO(body)
        )

        image.verify()

        image = Image.open(
            io.BytesIO(body)
        )

        original_format = image.format

        if original_format not in (
            "JPEG",
            "PNG"
        ):
            raise ValueError(
                "La imagen no es JPEG ni PNG"
            )

        # 5. Crear miniatura proporcional
        image.thumbnail(
            MAX_SIZE,
            Image.Resampling.LANCZOS
        )

        # JPEG no soporta RGBA
        if original_format == "JPEG":
            if image.mode != "RGB":
                image = image.convert("RGB")

        # 6. Preparar salida
        output = io.BytesIO()

        output_format = (
            "JPEG"
            if original_format == "JPEG"
            else "PNG"
        )

        image.save(
            output,
            format=output_format,
            quality=90
        )

        output.seek(0)

        # 7. Clave determinística
        filename = os.path.basename(
            original_key
        )

        thumbnail_key = (
            f"miniaturas/{producto_id}/{filename}"
        )

        # 8. Guardar miniatura
        s3.put_object(
            Bucket=THUMBNAIL_BUCKET,
            Key=thumbnail_key,
            Body=output.getvalue(),
            ContentType=content_type
        )

        # 9. Actualizar DynamoDB
        dynamodb.update_item(
            TableName=DYNAMODB_TABLE,
            Key={
                "producto_id": {
                    "N": producto_id
                }
            },
            UpdateExpression="""
                SET
                    imagen_original_key = :original,
                    miniatura_key = :thumbnail,
                    estado_procesamiento = :estado
            """,
            ExpressionAttributeValues={
                ":original": {
                    "S": original_key
                },
                ":thumbnail": {
                    "S": thumbnail_key
                },
                ":estado": {
                    "S": "LISTA"
                }
            }
        )

        return {
            "statusCode": 200,
            "producto_id": int(producto_id),
            "estado": "LISTA",
            "imagen_original_key": original_key,
            "miniatura_key": thumbnail_key,
            "width": image.width,
            "height": image.height
        }

    except Exception as error:

        # Registrar ERROR en DynamoDB
        try:
            dynamodb.update_item(
                TableName=DYNAMODB_TABLE,
                Key={
                    "producto_id": {
                        "N": producto_id
                    }
                },
                UpdateExpression="""
                    SET
                        imagen_original_key = :original,
                        estado_procesamiento = :estado
                """,
                ExpressionAttributeValues={
                    ":original": {
                        "S": original_key
                    },
                    ":estado": {
                        "S": "ERROR"
                    }
                }
            )
        except Exception:
            pass

        return {
            "statusCode": 400,
            "producto_id": int(producto_id),
            "estado": "ERROR",
            "error": str(error)
        }