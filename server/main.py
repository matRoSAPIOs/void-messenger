from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
import json

from database import get_db, init_db
from models import User, Contact, Message
from auth import hash_password, verify_password, create_token, decode_token

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

connected_users: dict[str, WebSocket] = {}

async def broadcast_online_users():
    online_list = list(connected_users.keys())
    payload = json.dumps({"type": "online_users", "users": online_list})
    for ws in connected_users.values():
        try:
            await ws.send_text(payload)
        except:
            pass

@app.on_event("startup")
async def startup():
    await init_db()

@app.post("/register")
async def register(data: dict, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.username == data["username"]))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Пользователь уже существует")
    tag = data.get("tag", "").lower().strip()
    if not tag.startswith("@"):
        tag = "@" + tag
    existing_tag = await db.execute(select(User).where(User.tag == tag))
    if existing_tag.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Этот тег уже занят")
    user = User(
        username=data["username"],
        tag=tag,
        password_hash=hash_password(data["password"])
    )
    db.add(user)
    await db.commit()
    return {"token": create_token({"sub": data["username"]}), "username": data["username"], "tag": tag}

@app.post("/login")
async def login(data: dict, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username == data["username"]))
    user = result.scalar_one_or_none()
    if not user or not verify_password(data["password"], user.password_hash):
        raise HTTPException(status_code=401, detail="Неверный логин или пароль")
    return {"token": create_token({"sub": user.username}), "username": user.username, "tag": user.tag}

@app.get("/search")
async def search_user(tag: str, db: AsyncSession = Depends(get_db)):
    if not tag.startswith("@"):
        tag = "@" + tag
    result = await db.execute(select(User).where(User.tag == tag))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    return {"id": user.id, "username": user.username, "tag": user.tag}

@app.post("/contacts")
async def add_contact(data: dict, db: AsyncSession = Depends(get_db)):
    token = data.get("token")
    username = decode_token(token)
    if not username:
        raise HTTPException(status_code=401, detail="Не авторизован")
    owner = await db.execute(select(User).where(User.username == username))
    owner = owner.scalar_one_or_none()
    contact = await db.execute(select(User).where(User.id == data["contact_id"]))
    contact = contact.scalar_one_or_none()
    if not owner or not contact:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    existing = await db.execute(select(Contact).where(
        and_(Contact.owner_id == owner.id, Contact.contact_id == contact.id)
    ))
    if existing.scalar_one_or_none():
        return {"ok": True}
    db.add(Contact(owner_id=owner.id, contact_id=contact.id))
    await db.commit()
    return {"ok": True}

@app.get("/contacts")
async def get_contacts(token: str, db: AsyncSession = Depends(get_db)):
    username = decode_token(token)
    if not username:
        raise HTTPException(status_code=401, detail="Не авторизован")
    owner = await db.execute(select(User).where(User.username == username))
    owner = owner.scalar_one_or_none()
    if not owner:
        raise HTTPException(status_code=404, detail="Не найден")
    contacts = await db.execute(select(Contact).where(Contact.owner_id == owner.id))
    contacts = contacts.scalars().all()
    result = []
    for c in contacts:
        user = await db.execute(select(User).where(User.id == c.contact_id))
        user = user.scalar_one_or_none()
        if user:
            result.append({"id": user.id, "username": user.username, "tag": user.tag})
    return result

@app.websocket("/ws/{token}")
async def websocket_endpoint(websocket: WebSocket, token: str, db: AsyncSession = Depends(get_db)):
    username = decode_token(token)
    if not username:
        await websocket.close()
        return

    await websocket.accept()
    connected_users[username] = websocket
    await broadcast_online_users()

    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)

            result = await db.execute(select(User).where(User.username == username))
            sender = result.scalar_one_or_none()

            result2 = await db.execute(select(User).where(User.username == msg["to"]))
            recipient = result2.scalar_one_or_none()

            if sender and recipient:
                message = Message(
                    content=msg["content"],
                    author_id=sender.id,
                    recipient_id=recipient.id
                )
                db.add(message)
                await db.commit()

                payload = json.dumps({"from": username, "to": msg["to"], "content": msg["content"]})

                if msg["to"] in connected_users:
                    await connected_users[msg["to"]].send_text(payload)
                await websocket.send_text(payload)

    except WebSocketDisconnect:
        connected_users.pop(username, None)
        await broadcast_online_users()