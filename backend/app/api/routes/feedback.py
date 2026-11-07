from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from app.api.deps import ReadyUser, SessionDep
from app.models import Progress, Resource, Review
from app.models.base import ProgressStatus
from app.schemas.resources import ProgressIn, ProgressOut, RatingOut, ReviewIn
from app.services.resources import upsert_resource

router = APIRouter(tags=["feedback"])


@router.put("/progress/{url_hash}")
async def set_progress(url_hash: str, body: ProgressIn, user: ReadyUser, session: SessionDep) -> ProgressOut:
    if body.status == ProgressStatus.COMPLETED and body.percent != 100:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT,
                            "A completed resource is at 100%.")
    if body.status == ProgressStatus.NOT_STARTED and body.percent != 0:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT,
                            "A resource you haven't started is at 0%.")
    resource_id = await session.scalar(select(Resource.id).where(Resource.url_hash == url_hash))
    if resource_id is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND,
                            "Save this resource to a workspace first.")
    await session.execute(
        insert(Progress)
        .values(user_id=user.id, resource_id=resource_id, status=body.status, percent=body.percent)
        .on_conflict_do_update(
            index_elements=[Progress.user_id, Progress.resource_id],
            set_={"status": body.status, "percent": body.percent,
                  "updated_at": func.now()},
        )
    )
    await session.commit()
    return ProgressOut(status=body.status, percent=body.percent)


@router.post("/reviews")
async def rate(body: ReviewIn, user: ReadyUser, session: SessionDep) -> RatingOut:
    resource = await upsert_resource(session, body.resource, user.id)
    await session.execute(
        insert(Review)
        .values(user_id=user.id, resource_id=resource.id, rating=body.rating, text_=body.text.strip())
        .on_conflict_do_update(
            index_elements=[Review.user_id, Review.resource_id],
            set_={"rating": body.rating, "text": body.text.strip(),
                  "updated_at": func.now()},
        )
    )
    average, count = (
        await session.execute(
            select(func.avg(Review.rating), func.count()).where(
                Review.resource_id == resource.id)
        )
    ).one()
    resource.avg_rating = round(average, 2)
    resource.review_count = count
    await session.commit()
    return RatingOut(avg_rating=float(resource.avg_rating), review_count=count)
