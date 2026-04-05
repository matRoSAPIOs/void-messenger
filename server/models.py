from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text, Boolean
from datetime import datetime
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    username = Column(String, unique=True, nullable=False)
    tag = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    avatar = Column(Text, nullable=True)
    bio = Column(String, nullable=True)
    aura_color = Column(String, nullable=True, default="#7850ff")
    aura_style = Column(String, nullable=True, default="solid")
    banner = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class Contact(Base):
    __tablename__ = "contacts"

    id = Column(Integer, primary_key=True)
    owner_id = Column(Integer, ForeignKey("users.id"))
    contact_id = Column(Integer, ForeignKey("users.id"))

class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True)
    content = Column(String, nullable=False)
    author_id = Column(Integer, ForeignKey("users.id"))
    recipient_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    is_read = Column(Boolean, default=False)
    is_deleted = Column(Boolean, default=False)
    edited_at = Column(DateTime, nullable=True)
    reply_to_id = Column(Integer, ForeignKey("messages.id"), nullable=True)
    reactions = Column(Text, nullable=True)  # JSON: {"👍": ["user1"], "❤️": ["user2"]}
