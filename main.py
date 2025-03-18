import backend.api.main as api
import logging

logging.basicConfig(
    level=logging.CRITICAL,
    handlers=[
        logging.StreamHandler()
    ]
)

api.start_server()