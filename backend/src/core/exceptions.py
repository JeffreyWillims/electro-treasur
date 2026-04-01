"""
Global Exception Shield.

Intercepts standard Exceptions and HTTPExceptions to sanitize
output and prevent stack trace leaks. Generates error_ids
for telemetry tracing in the JSON logs.
"""
from __future__ import annotations

import logging
import traceback
import uuid
from datetime import datetime
from fastapi import Request, FastAPI
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

def setup_exception_handlers(app: FastAPI) -> None:

    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        error_id = f"aura_err_{int(datetime.now().timestamp())}_{uuid.uuid4().hex[:6]}"
        
        # Log the full traceback with the error_id for observability
        logging.getLogger("uvicorn.error").error(
            f"❌ Geodetic Trap [{error_id}]: Unhandled Exception in {request.method} {request.url.path}\n{traceback.format_exc()}"
        )
        
        # Return sanitized JSON to client
        return JSONResponse(
            status_code=500,
            content={"detail": "Внутренняя ошибка сервера", "error_id": error_id},
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail},
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content={"detail": "Ошибка валидации данных", "errors": exc.errors()},
        )
