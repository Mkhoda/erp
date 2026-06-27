# AI Server — راهنمای کامل API

## اطلاعات سرور

```
Server IP:     192.168.30.13
Dashboard:     http://192.168.30.13:8888
```

---

## سرویس‌ها و endpoint ها

### 1. Ollama — LLM Inference
```
Base URL: http://192.168.30.13:11434
```

**لیست مدل‌های نصب‌شده:**
```bash
curl http://192.168.30.13:11434/api/tags
```

**Chat (streaming):**
```bash
curl http://192.168.30.13:11434/api/chat -d '{
  "model": "llama3",
  "messages": [{"role": "user", "content": "سلام"}],
  "stream": false
}'
```

**Generate (ساده‌تر):**
```bash
curl http://192.168.30.13:11434/api/generate -d '{
  "model": "llama3",
  "prompt": "سلام، چطوری؟",
  "stream": false
}'
```

**OpenAI-compatible (برای کتابخونه‌های OpenAI):**
```bash
curl http://192.168.30.13:11434/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3",
    "messages": [{"role": "user", "content": "سلام"}]
  }'
```

**Python:**
```python
# با openai library
from openai import OpenAI

client = OpenAI(
    base_url="http://192.168.30.13:11434/v1",
    api_key="ollama"  # هر چیزی
)

response = client.chat.completions.create(
    model="llama3",
    messages=[{"role": "user", "content": "سلام"}]
)
print(response.choices[0].message.content)
```

---

### 2. Whisper — Speech-to-Text فارسی
```
Base URL: http://192.168.30.13:8001
Endpoint: POST /asr
```

**تبدیل صدا به متن فارسی:**
```bash
curl -X POST "http://192.168.30.13:8001/asr?language=fa&output=json" \
  -F "audio_file=@/path/to/audio.wav"
```

**Response:**
```json
{"text": "متن فارسی transcribe شده"}
```

**Python:**
```python
import requests

def transcribe_persian(audio_path: str) -> str:
    with open(audio_path, "rb") as f:
        r = requests.post(
            "http://192.168.30.13:8001/asr",
            params={"language": "fa", "output": "json"},
            files={"audio_file": f}
        )
    return r.json()["text"]

text = transcribe_persian("audio.wav")
print(text)
```

**پارامترهای مفید:**
```
language=fa          # فارسی
language=en          # انگلیسی
output=json          # خروجی JSON
output=txt           # خروجی متن ساده
output=srt           # زیرنویس SRT
vad_filter=true      # حذف سکوت (بهتر برای صداهای طولانی)
word_timestamps=true # timestamp هر کلمه
```

---

### 3. Qdrant — Vector Database (RAG)
```
Base URL: http://192.168.30.13:6333
Dashboard: http://192.168.30.13:6333/dashboard
```

**لیست collection ها:**
```bash
curl http://192.168.30.13:6333/collections
```

**ساخت collection جدید:**
```bash
curl -X PUT "http://192.168.30.13:6333/collections/my_docs" \
  -H "Content-Type: application/json" \
  -d '{"vectors": {"size": 384, "distance": "Cosine"}}'
```

**Python با qdrant-client:**
```python
from qdrant_client import QdrantClient

client = QdrantClient(host="192.168.30.13", port=6333)
collections = client.get_collections()
print(collections)
```

---

### 4. OpenWebUI
```
URL: http://192.168.30.13:3000
```
رابط کاربری چت — مستقیم از مرورگر باز کن.

---

### 5. Dashboard — مدیریت سرویس‌ها
```
URL:  http://192.168.30.13:8888
```

**API داشبورد (با admin token):**
```bash
TOKEN="توکن-ادمین-تو"

# وضعیت سیستم
curl http://192.168.30.13:8888/api/system \
  -H "Authorization: Bearer $TOKEN"

# لیست کانتینرها
curl http://192.168.30.13:8888/api/containers \
  -H "Authorization: Bearer $TOKEN"

# restart یه سرویس
curl -X POST http://192.168.30.13:8888/api/containers/whisper/restart \
  -H "Authorization: Bearer $TOKEN"

# ساخت API key جدید
curl -X POST http://192.168.30.13:8888/api/keys \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "trading-app"}'
```

**تأیید API key (برای اپ‌هات):**
```bash
curl http://192.168.30.13:8888/api/verify \
  -H "X-Api-Key: sk-ai-xxxx..."
# {"valid": true}
```

---

## وصل کردن به اپ‌هات

### Trading Platform (Python/FastAPI)

```python
# config.py
AI_SERVER = "http://192.168.30.13"

OLLAMA_URL    = f"{AI_SERVER}:11434"
WHISPER_URL   = f"{AI_SERVER}:8001"
QDRANT_URL    = f"{AI_SERVER}:6333"
DASHBOARD_URL = f"{AI_SERVER}:8888"

# برای LLM
from openai import AsyncOpenAI

llm_client = AsyncOpenAI(
    base_url=f"{OLLAMA_URL}/v1",
    api_key="ollama"
)

# برای STT
async def transcribe(audio_bytes: bytes, lang="fa") -> str:
    import httpx
    async with httpx.AsyncClient() as client:
        r = await client.post(
            f"{WHISPER_URL}/asr",
            params={"language": lang, "output": "json"},
            files={"audio_file": ("audio.wav", audio_bytes)}
        )
        return r.json()["text"]
```

### apnelec (Next.js)

```typescript
// lib/ai.ts
const AI_SERVER = process.env.AI_SERVER_IP  // از .env.local

export async function transcribePersian(audioBlob: Blob): Promise<string> {
  const form = new FormData()
  form.append("audio_file", audioBlob, "audio.wav")
  
  const res = await fetch(
    `http://${AI_SERVER}:8001/asr?language=fa&output=json`,
    { method: "POST", body: form }
  )
  const data = await res.json()
  return data.text
}

export async function chat(message: string): Promise<string> {
  const res = await fetch(`http://${AI_SERVER}:11434/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "llama3",
      messages: [{ role: "user", content: message }]
    })
  })
  const data = await res.json()
  return data.choices[0].message.content
}
```

---

## خلاصه پورت‌ها

| سرویس | پورت | کاربرد |
|---|---|---|
| OpenWebUI | 3000 | چت UI |
| Ollama | 11434 | LLM API |
| Whisper | 8001 | STT فارسی |kd
| Qdrant | 6333 | Vector DB |
| Dashboard | 8888 | مانیتورینگ |


api-key jadid = "sk-ai-9f29b108409d1560da0e56dff0b22aa68f46f8af"