# Configuration

## Environment Variables

### API Server

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | API server port |
| `HOST` | `0.0.0.0` | API server host |
| `API_PORT` | `3000` | Alternative port setting |
| `LOG_LEVEL` | `info` | Logging level (error/warn/info/debug) |

### OCR Worker

| Variable | Default | Description |
|----------|---------|-------------|
| `OCR_WORKER_PORT` | `8081` | OCR worker server port |
| `OCR_WORKER_HOST` | `0.0.0.0` | OCR worker host |

### Ollama (LLM)

| Variable | Default | Description |
|----------|---------|-------------|
| `OLLAMA_BASE_URL` | `http://127.0.0.1:11434` | Ollama server URL |
| `OLLAMA_MODEL` | `gemma3:4b` | LLM model to use |

### Pipeline

| Variable | Default | Description |
|----------|---------|-------------|
| `DOCUMENT_CONCURRENCY` | `3` | Max concurrent documents |
| `LLM_ENRICHMENT_MIN_TEXT_LENGTH` | `100` | Min text length for LLM |
| `MAX_OBSERVATIONS_PER_REPORT` | `50` | Max observations per report |

### Tracing

| Variable | Default | Description |
|----------|---------|-------------|
| `LLM_FALLBACK_TRACE_PATH` | `/tmp/llm-fallback-output.ndjson` | LLM trace output |
| `LOG_LEVEL` | `info` | Log verbosity |

## Configuration Files

### packages/config/src/index.js

Central configuration module containing:

- Hospital templates
- Default settings
- Shared token sets (title tokens, invalid tokens)
- Document type mappings

## Usage

```javascript
const { getConfig, getHospitalTemplate } = require('./packages/config/src/index');

const config = getConfig();
const template = getHospitalTemplate();
```

## Docker Environment

```yaml
# docker-compose.yml
services:
  api:
    environment:
      - PORT=3000
      - LOG_LEVEL=info
      - OLLAMA_BASE_URL=http://ollama:11434

  ocr-worker:
    environment:
      - OCR_WORKER_PORT=8081

  ollama:
    image: ollama/ollama
    environment:
      - OLLAMA_MODEL=gemma3:4b
```
