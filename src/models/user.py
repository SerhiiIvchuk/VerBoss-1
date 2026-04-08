from sqlalchemy.orm import declarative_base, Mapped, mapped_column
from database.database import Base

class user(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    google_id: Mapped[str] = mapped_column(unique=True, nullable=False)
    email: Mapped[str] = mapped_column(unique=True, index=True, nullable=False)
    full_name: Mapped[str] = mapped_column(nullable=True)
    picture: Mapped[str] = mapped_column(nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True)