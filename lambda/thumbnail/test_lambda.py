def lambda_handler(event, context):
    return {
        "statusCode": 200,
        "mensaje": "Lambda funciona correctamente",
        "pillow": "prueba sin Pillow"
    }
