from fastapi import FastAPI, WebSocket

app = FastAPI()

@app.get("/")
async def root():
    return {"message": "ok"}

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    while True:
        data = await ws.receive_text()
        await ws.send_text(data)