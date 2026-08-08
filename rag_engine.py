import json
import os
import threading
import time

import faiss
import httpx
from langchain_ollama import ChatOllama
from sentence_transformers import SentenceTransformer

CHUNKS_FILE = 'chunks.json'
FAISS_FILE = 'faiss_index.bin'
ANSWERS_FILE = 'answers.json'
OLLAMA_URL = 'http://127.0.0.1:11434'
EMBED_MODEL = 'BAAI/bge-small-en-v1.5'
LLM_MODEL = 'phi3:latest'


def wait_for_ollama(timeout=30):
    for _ in range(int(timeout / 2)):
        try:
            httpx.get(OLLAMA_URL + '/api/tags', timeout=2)
            return
        except Exception:
            time.sleep(2)
    raise RuntimeError(
        "Ollama tidak bisa dihubungi. Pastikan Ollama berjalan (tray atau 'ollama serve')."
    )


class RAGEngine:

    def __init__(self):
        self.chunks = []
        self.index = None
        self.embedder = None
        self.llm = None
        self._answers = {}
        self._lock = threading.Lock()

    def load(self):
        wait_for_ollama()

        with open(CHUNKS_FILE, 'r', encoding='utf-8') as f:
            self.chunks = json.load(f)

        self.index = faiss.read_index(FAISS_FILE)
        self.embedder = SentenceTransformer(EMBED_MODEL)
        self.llm = ChatOllama(
            model=LLM_MODEL,
            temperature=0.1,
            base_url=OLLAMA_URL,
            num_ctx=2048,
        )

        self._answers = self._load_answers()

    def _load_answers(self):
        if os.path.exists(ANSWERS_FILE):
            with open(ANSWERS_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        return {}

    def _save_answers(self):
        with open(ANSWERS_FILE, 'w', encoding='utf-8') as f:
            json.dump(self._answers, f, indent=2)

    def retrieve(self, question, k=5):
        vec = self.embedder.encode([question])
        faiss.normalize_L2(vec)
        scores, idxs = self.index.search(vec, k)

        results = []
        for i, score in zip(idxs[0], scores[0]):
            results.append({
                **self.chunks[i],
                'score': float(score),
            })
        return results

    def generate(self, question, k=5, use_cache=True):
        with self._lock:
            if use_cache and question in self._answers:
                return self._answers[question], True, []

        sources = self.retrieve(question, k)
        context = '\n\n'.join(r['chunk'] for r in sources)

        prompt = f"""Jawab pertanyaan berikut HANYA menggunakan context.
Kalau context tidak memuat jawabannya, jawab "Saya tidak tahu".

Context:
{context}

Question: {question}

Answer:"""

        answer = self.llm.invoke(prompt).content

        if use_cache:
            with self._lock:
                self._answers[question] = answer
                self._save_answers()

        return answer, False, sources

    def get_cache(self):
        with self._lock:
            return dict(self._answers)

    def clear_cache(self):
        with self._lock:
            self._answers = {}
            if os.path.exists(ANSWERS_FILE):
                os.remove(ANSWERS_FILE)

    def stats(self):
        try:
            resp = httpx.get(OLLAMA_URL + '/api/tags', timeout=2)
            ollama_ok = resp.status_code == 200
        except Exception:
            ollama_ok = False

        return {
            'chunks': len(self.chunks),
            'index_size': self.index.ntotal if self.index is not None else 0,
            'answers_cached': len(self._answers),
            'ollama_ok': ollama_ok,
        }
