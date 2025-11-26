import os
from sqlalchemy import create_engine, Column, Integer, String, Text, Float, DateTime
from sqlalchemy.sql import func
from sqlalchemy.orm import sessionmaker, declarative_base

ROOT = os.path.abspath(os.path.dirname(__file__))
DATABASE_URL = os.environ.get('DATABASE_URL') or f"sqlite:///{os.path.join(ROOT, 'feedback.db')}"

# SQLite needs special connect args
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith('sqlite') else {}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class Feedback(Base):
    __tablename__ = 'feedback'
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    skin_type = Column(String, nullable=False)
    confidence = Column(Float, nullable=False)
    user_feedback = Column(Text)
    helpful = Column(String)


def init_db():
    Base.metadata.create_all(bind=engine)


if __name__ == '__main__':
    init_db()
