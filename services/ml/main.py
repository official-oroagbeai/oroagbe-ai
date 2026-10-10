import os
import unicodedata
from contextlib import asynccontextmanager
from typing import List, Optional

import torch
import torch.nn.functional as F
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool
from transformers import AutoModel, AutoTokenizer

MODEL_NAME = os.getenv("EMBEDDING_MODEL_NAME", "intfloat/multilingual-e5-small")

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
tokenizer = None
model = None


def average_pool(last_hidden_states: torch.Tensor, attention_mask: torch.Tensor) -> torch.Tensor:
    last_hidden = last_hidden_states.masked_fill(~attention_mask[..., None].bool(), 0.0)
    return last_hidden.sum(dim=1) / attention_mask.sum(dim=1)[..., None]


@torch.inference_mode()
def compute_embeddings(texts: List[str], is_query: bool = False) -> List[List[float]]:
    if not texts:
        return []

    prefix = "query: " if is_query else "passage: "
    prefixed_texts = [
        f"{prefix}{unicodedata.normalize('NFC', text).strip()}" for text in texts
    ]

    encoded = tokenizer(
        prefixed_texts,
        max_length=512,
        padding=True,
        truncation=True,
        return_tensors="pt"
    ).to(device)

    outputs = model(**encoded)
    pooled = average_pool(outputs.last_hidden_state, encoded["attention_mask"])
    normalized = F.normalize(pooled, p=2, dim=1)

    return normalized.cpu().tolist()


@asynccontextmanager
async def lifespan(app: FastAPI):
    global tokenizer, model
    print(f"Loading embedding model '{MODEL_NAME}' on device: {device}...")
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
    model = AutoModel.from_pretrained(MODEL_NAME).to(device)
    model.eval()
    print("Embedding model loaded successfully.")
    yield
    del model
    del tokenizer
    if torch.cuda.is_available():
        torch.cuda.empty_cache()


app = FastAPI(
    title="Oroagbe AI - Multilingual Embedding Service",
    description="High-throughput 384-dimensional multilingual vector generator for agricultural retrieval",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class EmbedRequest(BaseModel):
    text: Optional[str] = Field(None, description="Single text string to embed")
    texts: Optional[List[str]] = Field(None, description="List of text strings for batch embedding")
    is_query: bool = Field(False, description="True for user query retrieval, False for knowledge passages")


class EmbedResponse(BaseModel):
    embedding: Optional[List[float]] = None
    embeddings: Optional[List[List[float]]] = None
    dimensions: int


@app.get("/health")
def healthcheck():
    return {
        "status": "healthy",
        "model": MODEL_NAME,
        "device": str(device)
    }


@app.post("/embed", response_model=EmbedResponse)
async def embed(payload: EmbedRequest):
    if not payload.text and not payload.texts:
        raise HTTPException(status_code=400, detail="Must provide either 'text' or 'texts' field")

    input_texts = [payload.text] if payload.text else payload.texts

    vectors = await run_in_threadpool(
        compute_embeddings,
        texts=input_texts,
        is_query=payload.is_query
    )

    if not vectors:
        raise HTTPException(status_code=500, detail="Inference returned empty vectors")

    dimensions = len(vectors[0])

    if payload.text:
        return EmbedResponse(
            embedding=vectors[0],
            dimensions=dimensions
        )

    return EmbedResponse(
        embeddings=vectors,
        dimensions=dimensions
    )

if __name__ == "__main__":
    import uvicorn
    # Pass app instance directly and bind explicitly to 127.0.0.1
    uvicorn.run(app, host="127.0.0.1", port=8000)