import asyncio
import websockets

async def test_connection():
    uri = "ws://localhost:8000/ws"
    try:
        async with websockets.connect(uri) as websocket:
            print(f"Connected to {uri}")
            await websocket.send("Hello")
            print("Sent Hello")
            # Wait a bit
            await asyncio.sleep(1)
    except Exception as e:
        print(f"Connection failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_connection())
