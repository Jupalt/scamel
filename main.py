"""
Assembly Line Balancing Tool
Author: Julian Tecklenborg
Version: 1.0
"""

import backend.api.main as api
import logging

logging.basicConfig(
    level=logging.CRITICAL,
    handlers=[
        logging.StreamHandler()
    ]
)

api.start_server()