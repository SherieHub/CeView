"""The app boots and answers /healthz with the encoder load stubbed out.

Runs in a fresh interpreter. In-process, the result depended on test order: once any
earlier test had imported ``app.main``, the patch below never saw the import-time
encoder load, so "no model was loaded" passed only by accident (and failed when this
file ran alone).

The encoder IS requested at import - ``ml_classifier`` loads it eagerly by design so
the first request does not pay the load. What this test guarantees is that booting
needs nothing beyond that one stubbed call: no download, no network.

Run with: pytest tests/integration -v
"""

import subprocess
import sys
from pathlib import Path

SERVICE_ROOT = Path(__file__).resolve().parents[2]

_SCRIPT = (
    "from unittest.mock import patch\n"
    "from fastapi.testclient import TestClient\n"
    "with patch('app.core.BertModel._BertModel.get', return_value=None) as get_model:\n"
    "    from app.main import app\n"
    "    with TestClient(app) as client:\n"
    "        response = client.get('/healthz')\n"
    "print('RESULT', response.status_code, response.json() == {'status': 'ok'}, get_model.call_count)\n"
)


def test_healthz_returns_ok_with_the_encoder_load_stubbed():
    completed = subprocess.run(
        [sys.executable, "-c", _SCRIPT],
        cwd=SERVICE_ROOT,
        capture_output=True,
        text=True,
        timeout=240,
    )
    assert completed.returncode == 0, completed.stderr[-2000:]
    result = [line for line in completed.stdout.splitlines() if line.startswith("RESULT ")][
        -1
    ].split()
    _, status, body_ok, calls = result
    assert status == "200"
    assert body_ok == "True"
    # Eager load: the encoder is requested at import, and only through the patched getter.
    assert int(calls) >= 1
