from fastapi import APIRouter, Depends
from database.database import SessionDep
from models.video import VideoClip

router = APIRouter()

@router.post("/he")
async def test(db: SessionDep):
    clip = VideoClip(
        video_id="dQw4w9WgXcQ",
        video_url="https://youtube.com/watch?v=dQw4w9WgXcQ",
        title="Test Video",
        start_time=10.5,
        end_time=25.0,
        note="test note"
    )
    db.add(clip)
    await db.commit()
    await db.refresh(clip)

    return {"id": clip.id, "created_at": clip.created_at}