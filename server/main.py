from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import json

from database import get_db, init_db
from models import User, Message
from auth import hash_password, verify_password, create_token, decode_token

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

connected_users: dict[str, WebSocket] = {}

@app.on_event("startup")
async def startup():
    await init_db()

@app.post("/register")
async def register(data: dict, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.username == data["username"]))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Пользователь уже существует")
    user = User(username=data["username"], password_hash=hash_password(data["password"]))
    db.add(user)
    await db.commit()
    return {"token": create_token({"sub": data["username"]})}

@app.post("/login")
async def login(data: dict, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username == data["username"]))
    user = result.scalar_one_or_none()
    if not user or not verify_password(data["password"], user.password_hash):
        raise HTTPException(status_code=401, detail="Неверный логин или пароль")
    return {"token": create_token({"sub": user.username})}

@app.get("/users")
async def get_users(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User))
    users = result.scalars().all()
    return [{"id": u.id, "username": u.username} for u in users]

@app.websocket("/ws/{token}")
async def websocket_endpoint(websocket: WebSocket, token: str, db: AsyncSession = Depends(get_db)):
    username = decode_token(token)
    if not username:
        await websocket.close()
        return
    await websocket.accept()
    connected_users[username] = websocket
    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            result = await db.execute(select(User).where(User.username == username))
            sender = result.scalar_one_or_none()
            result2 = await db.execute(select(User).where(User.username == msg["to"]))
            recipient = result2.scalar_one_or_none()
            if sender and recipient:
                message = Message(content=msg["content"], author_id=sender.id, recipient_id=recipient.id)
                db.add(message)
                await db.commit()
                payload = {"from": username, "content": msg["content"]}
                if msg["to"] in connected_users:
                    await connected_users[msg["to"]].send_text(json.dumps(payload))
                await websocket.send_text(json.dumps(payload))
    except WebSocketDisconnect:
        connected_users.pop(username, None)
