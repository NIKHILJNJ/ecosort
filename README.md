# 🌱 EcoSort — AI-Powered Real-Time Waste Classification System

EcoSort classifies waste into 10 material categories from a photo or live webcam feed, using a fine-tuned MobileNetV2 model served through a FastAPI backend and a React frontend — pointing every item toward the recycling stream it actually belongs in, in real time.

**🔗 Live demo:** [ecosort-liart.vercel.app](https://ecosort-liart.vercel.app/)
**🔗 API:** [nj30sep-ecosort-backend.hf.space](https://nj30sep-ecosort-backend.hf.space)

This was my first end-to-end project — every part of it, from the model training to the cloud architecture to the web app, was designed and built by me. The AWS data pipeline in particular was my own idea: I wanted EcoSort to be more than a classifier bolted onto a demo, and designed a real data engineering backbone for it from the ground up.

---

## The Problem

Only 9% of all plastic ever produced has been recycled. A large part of that failure comes down to manual sorting — slow, error-prone, and impossible to scale. Misclassified waste contaminates entire recycling streams, sending recoverable material to landfill. EcoSort exists to make accurate, automated sorting available to anyone with a browser and a camera.

## Architecture

EcoSort is built in three phases:

```
PHASE 1                    PHASE 2                   PHASE 3
AWS Data Pipeline    →     Model Training       →     Web Deployment
(designed, see below)      Google Colab               FastAPI (HF Spaces)
                            MobileNetV2                React (Vercel)
                            90.52% train / 89.62% val
```

**What's live right now:** the trained MobileNetV2 model, served via FastAPI on Hugging Face Spaces, with a React frontend on Vercel — upload or webcam an image, get a classification back in ~200ms.

**What's designed, not yet running:** the full AWS ingestion pipeline described below. I built this out as a complete architecture — every service, every data hop, every transformation — as the intended path for scaling EcoSort past a single-model demo into a real data platform. It hasn't been deployed to a live AWS account yet (that's next), but the design is complete and is the part of this project I'm proudest of.

## 🧠 The AWS Data Pipeline — My Design

Most student ML projects stop at "train a model, wrap it in an API." I wanted EcoSort to have a real data engineering layer behind it — something that could actually ingest, clean, and catalog waste imagery at scale, the way a production system would. This pipeline is the piece I designed myself, end to end:

```
Raw Data (Internet / Kaggle)
        │
        ▼
   Amazon DynamoDB  ──────────  NoSQL store for image metadata
        │                       (image_id, timestamp, url, user_id, label)
        ▼
 Kinesis Data Streams  ───────  Real-time ingestion, 2 shards, fans out to:
        │
   ┌────┴────┐
   ▼         ▼
AWS Lambda   Kinesis Firehose
(JSON→CSV)   (batched delivery to S3)
   │         │
   └────┬────┘
        ▼
  Amazon S3 (raw bucket)  ─────  Landing zone for unprocessed CSV data
        │
        ▼
  AWS Glue Data Catalog  ──────  Auto-discovers schema, hourly crawl
        │
        ▼
  AWS Glue ETL (PySpark)  ─────  Dedup, null-strip, label standardization
        │
        ▼
  Amazon S3 (clean bucket)  ───  Analysis-ready data lake
        │
   ┌────┴────┐
   ▼         ▼
 Amazon      Amazon SageMaker
 Athena      (future: managed model
 (SQL for     serving & retraining)
 analytics)
```

**Why this design, specifically:**

- **DynamoDB as the entry point** — single-digit-millisecond writes for image metadata as it's uploaded, with DynamoDB Streams triggering everything downstream. No polling, no batch jobs waiting on a cron schedule.
- **Kinesis fanning out to two consumers** — Lambda handles the JSON→CSV transformation while Firehose independently handles delivery to S3, so a slowdown in one path doesn't block the other.
- **A dual-bucket S3 layout (raw → clean)** — I kept raw and cleaned data in separate buckets on purpose. It preserves lineage: if my cleaning logic in the Glue ETL job ever needs to change, I can re-run it against the untouched raw data instead of having already destroyed the originals.
- **Glue re-cataloging after cleaning** — schemas can shift after an ETL pass (new columns, changed types), so the catalog gets re-crawled rather than assumed static.
- **Athena and SageMaker as the next step, not the current one** — this is genuinely future work: Athena would let me run SQL directly over the clean data lake for class-distribution monitoring, and SageMaker would replace the current local/HF-Spaces inference with managed, autoscaling model serving. I'm building toward this, but I want to be upfront that it isn't deployed yet.

## Model

- **Architecture:** MobileNetV2 (Transfer Learning), pre-trained on ImageNet
- **Training:** Two-phase — frozen-base feature extraction, then fine-tuning the top 50 layers — on Google Colab (free GPU)
- **Dataset:** 19,762 images across 10 classes (Battery, Biological, Cardboard, Clothes, Glass, Metal, Paper, Plastic, Shoes, Trash), 80/20 train/val split
- **Results:** 90.52% training accuracy · 89.62% validation accuracy · ~200ms inference time
- **Model size:** ~14MB (.h5), ~4MB (TFLite, float16 quantized)

## Features

- 📤 **Upload mode** — classify any JPG/PNG/WebP image
- 📷 **Live camera mode** — real-time classification from a webcam feed
- 🎯 **Top-3 predictions** with confidence scores
- ♻️ **Category-specific recycling tips** for each of the 10 classes
- 📱 Responsive — tested on Chrome desktop and mobile
- 🕓 Session history of recent classifications

## Tech Stack

| Layer | Technology |
|---|---|
| ML Framework | TensorFlow / Keras, MobileNetV2 |
| Data Pipeline (designed) | DynamoDB, Kinesis, Lambda, Firehose, S3, Glue, Athena, SageMaker |
| Backend | FastAPI (Python), Uvicorn |
| Frontend | React.js, MediaDevices Webcam API |
| Model Training | Google Colab (free GPU) |
| Backend Hosting | Hugging Face Spaces (Docker) |
| Frontend Hosting | Vercel |

## API

| Endpoint | Method | Description |
|---|---|---|
| `/predict` | POST | Classify an uploaded image, returns label, confidence, tip, top-3 |
| `/health` | GET | Service + model load status |
| `/categories` | GET | List of supported waste categories |

## Getting Started

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm start
```

## Testing

Black-box functional testing was performed on the live deployed app across Chrome (desktop and mobile) — covering image upload, live camera classification, confidence display, recycling tip accuracy, session history, and API health checks. All test cases passed.

## Future Scope

- Deploy the AWS pipeline above to a live account (DynamoDB → Kinesis → Glue → S3), and connect it as the real ingestion path
- Full migration to Amazon SageMaker for managed, auto-scaling model serving
- Offline mobile app (Flutter/React Native + bundled TFLite model)
- Physical IoT smart bin prototype (Raspberry Pi + servo-actuated bins)
- Expanded categories (e-waste, hazardous, medical waste)
- Municipal dashboard integration for real-time waste analytics

## Author

**Nikhil Jain**
BCA (Honours), Bundelkhand University, Jhansi
First end-to-end project — model, pipeline design, and full-stack build.

## License

MIT
