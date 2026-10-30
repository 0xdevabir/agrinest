from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field

from app.classify import backup_classify, classify_leaf, resize_image_bytes
from app.config import THRESHOLD
from app.polish import polish_steps

app = FastAPI(title="AgriSathi Crop Guardian", version="0.1.0")


class PolishIn(BaseModel):
    name_bn: str
    steps_bn: list[str] = Field(default_factory=list)
    chemical_note_bn: str = ""


@app.get("/health")
def health():
    return {"status": "ok", "service": "crop-guardian"}


@app.post("/classify")
async def classify(
    file: UploadFile = File(...),
    force_disease: str | None = Form(default=None),
):
    raw = await file.read()
    if not raw:
        raise HTTPException(400, "ছবি খালি")
    if len(raw) > 8_000_000:
        raise HTTPException(400, "ছবি খুব বড়")
    if force_disease == "":
        force_disease = None
    resized = resize_image_bytes(raw, 512)
    result = classify_leaf(resized, filename=file.filename, force_disease=force_disease)
    if result["confidence"] < THRESHOLD or result["disease_id"] == "unknown":
        result = backup_classify(resized)
    polished = await polish_steps(result["name_bn"], result["steps_bn"], result["chemical_note_bn"])
    result["steps_bn"] = polished["steps_bn"]
    result["summary_bn"] = polished["summary_bn"]
    result["polish_source"] = polished["source"]
    result["service"] = "crop-guardian"
    return result


@app.post("/polish")
async def polish(body: PolishIn):
    return await polish_steps(body.name_bn, body.steps_bn, body.chemical_note_bn)
