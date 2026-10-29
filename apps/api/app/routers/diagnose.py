from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import get_db
from app.models import Event, Field
from app.schemas import DiagnoseResult, EventOut
from app.services import disease as disease_svc

router = APIRouter(tags=["crop-guardian"])


@router.post("/fields/{field_id}/diagnose", response_model=DiagnoseResult)
async def diagnose(
    field_id: str,
    file: UploadFile = File(...),
    force_disease: str | None = Form(default=None),
    db: AsyncSession = Depends(get_db),
):
    field = await db.get(Field, field_id)
    if not field:
        raise HTTPException(404, "জমি পাওয়া যায়নি")

    if force_disease == "":
        force_disease = None

    raw = await file.read()
    if not raw:
        raise HTTPException(400, "ছবি খালি")
    if len(raw) > 8_000_000:
        raise HTTPException(400, "ছবি খুব বড়")

    resized = disease_svc.resize_image_bytes(raw, 512)
    photo_path = disease_svc.save_photo(field_id, resized)

    result = disease_svc.classify_leaf(resized, filename=file.filename, force_disease=force_disease)
    if result["confidence"] < settings.disease_conf_threshold or result["disease_id"] == "unknown":
        result = disease_svc.backup_classify(resized)

    payload = {
        **result,
        "photo_path": str(photo_path.name),
    }
    event = Event(field_id=field_id, type="diagnosis", payload=payload)
    db.add(event)
    await db.commit()
    await db.refresh(event)

    return DiagnoseResult(
        disease_id=result["disease_id"],
        name_bn=result["name_bn"],
        name_en=result["name_en"],
        confidence=result["confidence"],
        source=result["source"],
        steps_bn=result["steps_bn"],
        chemical_note_bn=result["chemical_note_bn"],
        event=EventOut.model_validate(event),
    )


@router.post("/fields/{field_id}/treatment-logged", response_model=EventOut)
async def log_treatment(field_id: str, db: AsyncSession = Depends(get_db)):
    field = await db.get(Field, field_id)
    if not field:
        raise HTTPException(404, "জমি পাওয়া যায়নি")
    event = Event(
        field_id=field_id,
        type="treatment_logged",
        payload={"note_bn": "চিকিৎসা সম্পন্ন হয়েছে"},
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)
    return event

