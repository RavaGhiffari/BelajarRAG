from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from rag_engine import RAGEngine

engine = RAGEngine()


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        engine.load()
    except Exception:
        pass
    yield


app = FastAPI(
    title='RAG Inference API',
    description='Backend inference dari qnaRAG (FAISS + phi3 via Ollama).',
    lifespan=lifespan,
)


class QueryRequest(BaseModel):
    question: str = Field(..., min_length=1)
    k: int = Field(5, ge=1, le=20)
    use_cache: bool = True


class RetrieveRequest(BaseModel):
    question: str = Field(..., min_length=1)
    k: int = Field(5, ge=1, le=20)


class Source(BaseModel):
    chunk: str
    source_id: int
    chunk_idx: int
    score: float


class QueryResponse(BaseModel):
    question: str
    answer: str
    from_cache: bool
    sources: list[Source]


def require_engine():
    if engine.index is None:
        raise HTTPException(
            status_code=503,
            detail='Engine belum dimuat. Pastikan chunks.json/faiss_index.bin ada dan Ollama aktif.',
        )


@app.get('/health')
def health():
    return {
        'status': 'ok' if engine.index is not None else 'engine_not_loaded',
        'engine_loaded': engine.index is not None,
        **engine.stats(),
    }


@app.post('/query', response_model=QueryResponse)
def query(req: QueryRequest):
    require_engine()
    try:
        answer, from_cache, sources = engine.generate(req.question, req.k, req.use_cache)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f'Gagal generate jawaban: {exc}')

    return QueryResponse(
        question=req.question,
        answer=answer,
        from_cache=from_cache,
        sources=sources,
    )


@app.post('/retrieve')
def retrieve(req: RetrieveRequest):
    require_engine()
    return {'results': engine.retrieve(req.question, req.k)}


@app.get('/cache')
def get_cache():
    answers = engine.get_cache()
    return {'count': len(answers), 'answers': answers}


@app.delete('/cache')
def delete_cache():
    engine.clear_cache()
    return {'status': 'cache jawaban dibersihkan'}
