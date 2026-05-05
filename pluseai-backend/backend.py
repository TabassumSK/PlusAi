# ============================================================
# PulseAI — Complete FastAPI Backend (PostgreSQL Version)
# pip install fastapi uvicorn python-dotenv transformers torch
#             requests aiohttp sqlalchemy psycopg2-binary
#             python-jose passlib python-multipart reportlab
# Run: uvicorn backend:app --reload --port 8000
# ============================================================

from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Optional
import torch
import requests
import os
import re
import json
import time
from datetime import datetime, timedelta
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from dotenv import load_dotenv
from collections import Counter
from jose import JWTError, jwt
from passlib.context import CryptContext
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
from sqlalchemy import create_engine, text

load_dotenv()

# ── Config ───────────────────────────────────────────────────
NEWS_API_KEY = os.getenv("NEWS_API_KEY")
MODEL_PATH   = os.getenv("MODEL_PATH", "models/bert_sentiment")
SECRET_KEY   = os.getenv("SECRET_KEY", "pulseai-secret-key-change-in-production")
ALGORITHM    = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24

# ── PostgreSQL ───────────────────────────────────────────────
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:Sona#6046po@localhost:3000/pulseai")
engine = create_engine(DATABASE_URL)

def init_db():
    with engine.connect() as conn:
        conn.execute(text('''CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            hashed_password TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )'''))
        conn.execute(text('''CREATE TABLE IF NOT EXISTS searches (
            id SERIAL PRIMARY KEY,
            username TEXT,
            query TEXT NOT NULL,
            pos_pct REAL,
            neg_pct REAL,
            total INTEGER,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )'''))
        conn.execute(text('''CREATE TABLE IF NOT EXISTS contacts (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            subject TEXT,
            message TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )'''))
        conn.commit()

init_db()

app = FastAPI(title="PulseAI API", version="2.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Load BERT model ──────────────────────────────────────────
print(f"Loading BERT model from {MODEL_PATH}...")
tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
model     = AutoModelForSequenceClassification.from_pretrained(MODEL_PATH)
model.eval()
print("✅ Model loaded and ready!")

# ── Auth ─────────────────────────────────────────────────────
pwd_context   = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login", auto_error=False)

def hash_password(password): return pwd_context.hash(password)
def verify_password(plain, hashed): return pwd_context.verify(plain, hashed)

def create_token(data: dict):
    to_encode = data.copy()
    to_encode["exp"] = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(token: str = Depends(oauth2_scheme)):
    if not token:
        return None
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload.get("sub")
    except JWTError:
        return None

# ── BERT prediction ──────────────────────────────────────────
STOPWORDS = {'the','a','an','is','it','this','that','was','are','be',
             'to','of','and','or','in','on','for','with','as','at','by',
             'have','has','had','will','would','could','should','from'}

def clean_text(text: str) -> str:
    text = re.sub(r'http\S+', '', str(text))
    text = re.sub(r'[^a-zA-Z\s]', ' ', text)
    return re.sub(r'\s+', ' ', text).strip().lower()

def predict(text: str) -> dict:
    cleaned = clean_text(text)
    if not cleaned.strip():
        return {"label": "Neutral", "score": 0, "confidence": 0.0, "prob_pos": 0.0, "prob_neg": 0.0}
    enc = tokenizer(cleaned, return_tensors='pt', max_length=128,
                    truncation=True, padding='max_length')
    with torch.no_grad():
        logits = model(**enc).logits
    probs = torch.softmax(logits, dim=1).squeeze().tolist()
    pred  = int(torch.argmax(logits))
    confidence = round(max(probs), 4)

    # If confidence is low, classify as Neutral
    if confidence < 0.65:
        label = "Neutral"
        score = 0
    elif pred == 1:
        label = "Positive"
        score = 1
    else:
        label = "Negative"
        score = -1

    return {
        "label":      label,
        "score":      score,
        "confidence": confidence,
        "prob_pos":   round(probs[1], 4),
        "prob_neg":   round(probs[0], 4),
    }

def extract_keywords(texts: list, n=15) -> list:
    words = []
    for t in texts:
        words.extend([w for w in clean_text(t).split()
                      if w not in STOPWORDS and len(w) > 3])
    return [{"word": w, "count": c} for w, c in Counter(words).most_common(n)]

def get_aspect_sentiment(texts: list, aspects: dict) -> dict:
    results = {}
    for aspect, keywords in aspects.items():
        relevant = [t for t in texts if any(k in t.lower() for k in keywords)]
        if not relevant:
            results[aspect] = {"pos_pct": 50, "neg_pct": 50, "total": 0}
            continue
        preds = [predict(t) for t in relevant[:30]]
        pos   = sum(1 for p in preds if p["score"] == 1)
        total = len(preds)
        results[aspect] = {
            "pos_pct": round(pos/total*100, 1),
            "neg_pct": round((total-pos)/total*100, 1),
            "total":   total
        }
    return results

# ── Data fetchers ────────────────────────────────────────────
def fetch_newsapi(query: str, limit: int = 30) -> list:
    try:
        url = f"https://newsapi.org/v2/everything?q={query}&language=en&pageSize={limit}&sortBy=publishedAt&apiKey={NEWS_API_KEY}"
        res = requests.get(url, timeout=10).json()
        articles = res.get("articles", [])
        return [{
            "id":     a.get("url", ""),
            "title":  a.get("title", ""),
            "text":   f"{a.get('title','')} {a.get('description','')}",
            "source": a.get("source", {}).get("name", "NewsAPI"),
            "url":    a.get("url", ""),
            "time":   a.get("publishedAt", ""),
            "type":   "news"
        } for a in articles if a.get("title")]
    except Exception as e:
        print(f"NewsAPI error: {e}")
        return []

def fetch_hackernews(query: str, limit: int = 30) -> list:
    try:
        url = f"https://hn.algolia.com/api/v1/search?query={query}&tags=story&hitsPerPage={limit}"
        res = requests.get(url, timeout=10).json()
        hits = res.get("hits", [])
        return [{
            "id":     h.get("objectID", ""),
            "title":  h.get("title", ""),
            "text":   h.get("title", ""),
            "source": "HackerNews",
            "url":    h.get("url", f"https://news.ycombinator.com/item?id={h.get('objectID')}"),
            "time":   h.get("created_at", ""),
            "type":   "hackernews"
        } for h in hits if h.get("title")]
    except Exception as e:
        print(f"HackerNews error: {e}")
        return []

# ── Pydantic models ──────────────────────────────────────────
class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str

class AnalyzeRequest(BaseModel):
    query: str
    limit: Optional[int] = 40

class CompareRequest(BaseModel):
    query1: str
    query2: str

class SingleRequest(BaseModel):
    text: str

class ContactRequest(BaseModel):
    name: str
    email: str
    subject: Optional[str] = ""
    message: str

class ResetPasswordRequest(BaseModel):
    username: str
    new_password: str
    
# ═══════════════════════════════════════════════════════════
# AUTH ENDPOINTS
# ═══════════════════════════════════════════════════════════

@app.post("/register")
def register(req: RegisterRequest):
    try:
        with engine.connect() as conn:
            conn.execute(
                text("INSERT INTO users (username, email, hashed_password) VALUES (:u, :e, :p)"),
                {"u": req.username, "e": req.email, "p": hash_password(req.password)}
            )
            conn.commit()
        return {"message": "Account created successfully"}
    except Exception:
        raise HTTPException(400, "Username or email already exists")

@app.post("/login")
def login(form: OAuth2PasswordRequestForm = Depends()):
    with engine.connect() as conn:
        row = conn.execute(
            text("SELECT hashed_password FROM users WHERE username=:u"),
            {"u": form.username}
        ).fetchone()
    if not row or not verify_password(form.password, row[0]):
        raise HTTPException(401, "Invalid credentials")
    token = create_token({"sub": form.username})
    return {"access_token": token, "token_type": "bearer"}

@app.get("/me")
def me(username: str = Depends(get_current_user)):
    if not username:
        raise HTTPException(401, "Not authenticated")
    with engine.connect() as conn:
        row = conn.execute(
            text("SELECT username, email, created_at FROM users WHERE username=:u"),
            {"u": username}
        ).fetchone()
    return {"username": row[0], "email": row[1], "created_at": row[2]}

# ═══════════════════════════════════════════════════════════
# CORE ANALYSIS ENDPOINTS
# ═══════════════════════════════════════════════════════════

@app.post("/analyze")
def analyze(req: AnalyzeRequest, username: str = Depends(get_current_user)):
    """Main endpoint — fetch from both sources, run BERT, return full analysis."""
    limit_each = req.limit // 2

    news_posts = fetch_newsapi(req.query, limit_each)
    hn_posts   = fetch_hackernews(req.query, limit_each)
    all_posts  = news_posts + hn_posts

    if not all_posts:
        raise HTTPException(404, f"No data found for: {req.query}")

    analyzed = []
    for p in all_posts:
        sentiment = predict(p["text"])
        analyzed.append({**p, **sentiment})

    pos     = [p for p in analyzed if p["label"] == "Positive"]
    neg     = [p for p in analyzed if p["label"] == "Negative"]
    neutral = [p for p in analyzed if p["label"] == "Neutral"]
    total   = len(analyzed)

    pos_pct     = round(len(pos)/total*100, 1)
    neg_pct     = round(len(neg)/total*100, 1)
    neutral_pct = round(len(neutral)/total*100, 1)

    aspects = {
        "Performance": ["fast", "speed", "performance", "slow", "lag", "smooth"],
        "Price":       ["price", "cost", "expensive", "cheap", "value", "worth"],
        "Quality":     ["quality", "build", "design", "premium", "cheap", "solid"],
        "Features":    ["feature", "update", "new", "added", "missing", "support"],
        "Support":     ["support", "service", "help", "fix", "bug", "issue"],
    }
    aspect_results = get_aspect_sentiment([p["text"] for p in analyzed], aspects)

    pos_keywords = extract_keywords([p["text"] for p in pos])
    neg_keywords = extract_keywords([p["text"] for p in neg])

    if username:
        with engine.connect() as conn:
            conn.execute(
                text("INSERT INTO searches (username, query, pos_pct, neg_pct, total) VALUES (:u, :q, :pp, :np, :t)"),
                {"u": username, "q": req.query, "pp": pos_pct, "np": neg_pct, "t": total}
            )
            conn.commit()

    return {
    "query":   req.query,
    "total":   total,
    "sources": {"newsapi": len(news_posts), "hackernews": len(hn_posts)},
    "summary": {
        "positive":        len(pos),
        "negative":        len(neg),
        "neutral":         len(neutral),
        "pos_pct":         pos_pct,
        "neg_pct":         neg_pct,
        "neutral_pct":     neutral_pct,
        "avg_confidence":  round(sum(p["confidence"] for p in analyzed)/total, 4),
        "sentiment_score": pos_pct,
    },
    "aspects":      aspect_results,
    "posts":        analyzed[:30],
    "pos_keywords": pos_keywords,
    "neg_keywords": neg_keywords,
}

@app.post("/compare")
def compare(req: CompareRequest, username: str = Depends(get_current_user)):
    """Compare sentiment of two products side by side."""
    r1 = analyze(AnalyzeRequest(query=req.query1, limit=30), username)
    r2 = analyze(AnalyzeRequest(query=req.query2, limit=30), username)
    return {"product1": r1, "product2": r2}

@app.post("/predict")
def predict_single(req: SingleRequest):
    """Predict sentiment of a single text."""
    return predict(req.text)

@app.post("/reset-password")
def reset_password(req: ResetPasswordRequest):
    if len(req.new_password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")
    with engine.connect() as conn:
        row = conn.execute(
            text("SELECT id FROM users WHERE username=:u"),
            {"u": req.username}
        ).fetchone()
        if not row:
            raise HTTPException(404, "Username not found")
        conn.execute(
            text("UPDATE users SET hashed_password=:p WHERE username=:u"),
            {"p": hash_password(req.new_password), "u": req.username}
        )
        conn.commit()
    return {"message": "Password updated successfully"}

@app.get("/history")
def history(username: str = Depends(get_current_user)):
    """Get user's search history."""
    if not username:
        raise HTTPException(401, "Login required")
    with engine.connect() as conn:
        rows = conn.execute(
            text("SELECT query, pos_pct, neg_pct, total, created_at FROM searches WHERE username=:u ORDER BY created_at DESC LIMIT 20"),
            {"u": username}
        ).fetchall()
    return [{"query": r[0], "pos_pct": r[1], "neg_pct": r[2],
             "total": r[3], "created_at": r[4]} for r in rows]

@app.get("/trending")
def trending():
    """Get top searched queries."""
    with engine.connect() as conn:
        rows = conn.execute(
            text("SELECT query, COUNT(*) as count FROM searches GROUP BY query ORDER BY count DESC LIMIT 10")
        ).fetchall()
    return [{"query": r[0], "count": r[1]} for r in rows]

@app.get("/export/{query}")
def export_pdf(query: str, username: str = Depends(get_current_user)):
    """Generate and download PDF report."""
    try:
        result = analyze(AnalyzeRequest(query=query, limit=20), username)
        filename = f"pulseai_report_{query.replace(' ','_')}.pdf"
        doc    = SimpleDocTemplate(filename, pagesize=letter)
        styles = getSampleStyleSheet()
        story  = []
        story.append(Paragraph("PulseAI Sentiment Report", styles['Title']))
        story.append(Paragraph(f"Query: {query}", styles['Heading2']))
        story.append(Paragraph(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}", styles['Normal']))
        story.append(Spacer(1, 12))
        story.append(Paragraph(f"Total posts analyzed: {result['total']}", styles['Normal']))
        story.append(Paragraph(f"Positive: {result['summary']['pos_pct']}%", styles['Normal']))
        story.append(Paragraph(f"Negative: {result['summary']['neg_pct']}%", styles['Normal']))
        story.append(Spacer(1, 12))
        story.append(Paragraph("Aspect Analysis", styles['Heading2']))
        for aspect, data in result['aspects'].items():
            story.append(Paragraph(f"{aspect}: {data['pos_pct']}% positive ({data['total']} mentions)", styles['Normal']))
        story.append(Spacer(1, 12))
        story.append(Paragraph("Top Positive Keywords", styles['Heading2']))
        pos_words = ", ".join([k['word'] for k in result['pos_keywords'][:10]])
        story.append(Paragraph(pos_words, styles['Normal']))
        doc.build(story)
        return FileResponse(filename, media_type='application/pdf', filename=filename)
    except Exception as e:
        raise HTTPException(500, str(e))

@app.get("/health")
def health():
    return {"status": "ok", "model": MODEL_PATH, "version": "2.0.0"}

@app.post("/contact")
def contact(req: ContactRequest):
    if not req.name or not req.email or not req.message:
        raise HTTPException(400, "Name, email and message are required")
    with engine.connect() as conn:
        conn.execute(
            text("INSERT INTO contacts (name, email, subject, message) VALUES (:n, :e, :s, :m)"),
            {"n": req.name, "e": req.email, "s": req.subject, "m": req.message}
        )
        conn.commit()
    return {"message": "Message sent successfully"}