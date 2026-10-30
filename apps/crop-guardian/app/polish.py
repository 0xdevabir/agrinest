from __future__ import annotations

import httpx

from app.config import LLM_API_KEY, LLM_BASE, LLM_MODEL


def kb_polish(name_bn: str, steps_bn: list[str]) -> dict:
    summary = f"{name_bn}: {steps_bn[0]}" if steps_bn else name_bn
    return {"steps_bn": steps_bn, "summary_bn": summary, "source": "kb"}


async def polish_steps(name_bn: str, steps_bn: list[str], chemical_note_bn: str = "") -> dict:
    fallback = kb_polish(name_bn, steps_bn)
    if not LLM_API_KEY or not steps_bn:
        return fallback
    prompt = (
        "Rewrite these rice-disease steps into exactly 3 short Bangla lines a farmer can follow. "
        "Do not invent a pesticide dose. Keep the officer warning meaning. "
        f"Disease: {name_bn}\nSteps:\n" + "\n".join(f"- {step}" for step in steps_bn) + f"\nNote: {chemical_note_bn}"
    )
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.post(
                f"{LLM_BASE.rstrip('/')}/chat/completions",
                headers={"Authorization": f"Bearer {LLM_API_KEY}"},
                json={
                    "model": LLM_MODEL,
                    "temperature": 0.2,
                    "messages": [{"role": "user", "content": prompt}],
                },
            )
            response.raise_for_status()
            text = response.json()["choices"][0]["message"]["content"].strip()
        lines = [line.lstrip("-• ").strip() for line in text.splitlines() if line.strip()][:3]
        if len(lines) < 3:
            return fallback
        return {"steps_bn": lines, "summary_bn": f"{name_bn}: {lines[0]}", "source": "llm"}
    except Exception:
        return fallback
