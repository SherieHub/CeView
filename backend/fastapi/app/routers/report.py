from __future__ import annotations

import io

from fastapi import APIRouter
from fastapi.responses import Response

from app.services import gemini_client

router = APIRouter()


@router.post("/generate")
def generate(payload: dict) -> dict:
    return gemini_client.performance_report(payload.get("metrics", {}))


@router.post("/pdf")
def pdf(payload: dict) -> Response:
    """Minimal PDF stream so the frontend's 'Download PDF' button works.
    Real layout (WeasyPrint) is a follow-up — this returns a valid
    one-page PDF placeholder so the file download succeeds."""
    buf = io.BytesIO()
    buf.write(_MINIMAL_PDF.encode("latin-1"))
    return Response(content=buf.getvalue(), media_type="application/pdf")


# Smallest valid one-page PDF. Replace with WeasyPrint output once layout is designed.
_MINIMAL_PDF = (
    "%PDF-1.4\n"
    "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
    "2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n"
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n"
    "4 0 obj<</Length 55>>stream\n"
    "BT /F1 18 Tf 72 720 Td (CeView Prescriptive Report) Tj ET\n"
    "endstream endobj\n"
    "5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n"
    "xref\n0 6\n0000000000 65535 f \n0000000010 00000 n \n0000000053 00000 n \n0000000098 00000 n \n0000000183 00000 n \n0000000280 00000 n \n"
    "trailer<</Size 6/Root 1 0 R>>\nstartxref\n344\n%%EOF\n"
)
