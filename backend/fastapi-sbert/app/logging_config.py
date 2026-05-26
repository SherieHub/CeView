"""Structured logging for the AI microservice. Each log record carries a
`trace_id` (set per-request by middleware) and an optional `code` so a single
request can be traced across this service, Spring Boot, and the browser."""

from __future__ import annotations

import logging
import sys

from app.middleware.trace import get_trace_id

LOG_FORMAT = (
    "%(asctime)s [%(levelname)s] %(name)s "
    "trace=%(trace_id)s code=%(code)s :: %(message)s"
)


class _ContextFilter(logging.Filter):
    """Injects trace_id from the request context and a default code when
    the caller did not pass `extra={"code": ...}`."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.trace_id = get_trace_id() or "no-trace"
        if not hasattr(record, "code"):
            record.code = "-"
        return True


def configure() -> None:
    root = logging.getLogger()
    root.setLevel(logging.INFO)
    # Remove any default handlers that Uvicorn may have already attached so
    # we control formatting end-to-end.
    for h in list(root.handlers):
        root.removeHandler(h)

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter(LOG_FORMAT))
    handler.addFilter(_ContextFilter())
    root.addHandler(handler)

    # Module-3 loggers get a more verbose level during development.
    logging.getLogger("module3").setLevel(logging.DEBUG)
