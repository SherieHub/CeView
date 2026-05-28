"""Structured logging for the compliance microservice. Each log record carries
a `trace_id` (set per-request by middleware) and an optional `code`."""

from __future__ import annotations

import logging
import sys

from app.middleware.trace import get_trace_id

LOG_FORMAT = (
    "%(asctime)s [%(levelname)s] %(name)s "
    "trace=%(trace_id)s code=%(code)s :: %(message)s"
)


class _ContextFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.trace_id = get_trace_id() or "no-trace"
        if not hasattr(record, "code"):
            record.code = "-"
        return True


def configure() -> None:
    root = logging.getLogger()
    root.setLevel(logging.INFO)
    for h in list(root.handlers):
        root.removeHandler(h)

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter(LOG_FORMAT))
    handler.addFilter(_ContextFilter())
    root.addHandler(handler)

    logging.getLogger("compliance").setLevel(logging.DEBUG)
