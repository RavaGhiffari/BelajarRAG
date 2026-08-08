import os

import uvicorn

port = int(os.getenv('RAG_PORT', '8001'))
uvicorn.run('main:app', host='127.0.0.1', port=port)
