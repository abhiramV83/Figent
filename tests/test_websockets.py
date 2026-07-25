import asyncio
import websockets
import json

async def test_ws():
    uri = "ws://localhost:8000/api/ws/review"
    async with websockets.connect(uri) as ws:
        # Send start event
        await ws.send(json.dumps({
            "repo_url": "https://github.com/abhiramV83/figent-test-repo",
            "token": "test_token_123"
        }))
        print("Sent repo URL, waiting for events...\n")

        # Listen for streaming events
        while True:
            try:
                msg = await asyncio.wait_for(ws.recv(), timeout=600)
                data = json.loads(msg)
                print(f"[{data.get('type','?').upper()}] {data.get('message','')}")
                if data.get('type') == 'complete':
                    print("Review complete!")
                    break
                elif data.get('type') == 'error':
                    print(f"Error: {data.get('message')}")
                    break
                elif data.get('type') == 'keepalive':
                    print(f"[KEEPALIVE] {data.get('message')}")
                    # don't break — keep waiting
            except websockets.exceptions.ConnectionClosed as e:
                print(f"Connection closed: {e}")
                break
            except asyncio.TimeoutError:
                print("Timeout waiting for events")
                break

asyncio.run(test_ws())