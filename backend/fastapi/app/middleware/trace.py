"""Per-request X-Trace-Id propagation. Spring Boot sets the header on its
outbound calls; for direct hits we generate a UUID4 so every request still has
a traceable id. The id is stored in a ContextVar so the logging filter can
attach it to every log record emitted while handling the request."""

from __future__ import annotations

import contextvars
import uuid

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

HEADER_NAME = "X-Trace-Id"

_trace_id_var: contextvars.ContextVar[str] = contextvars.ContextVar("trace_id", default="")


def get_trace_id() -> str:
    return _trace_id_var.get()


class TraceIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        trace_id = request.headers.get(HEADER_NAME) or uuid.uuid4().hex[:12]
        token = _trace_id_var.set(trace_id)
        try:
            response: Response = await call_next(request)
        finally:
            _trace_id_var.reset(token)
        response.headers[HEADER_NAME] = trace_id
        return response
