# 🌱 EcoSort — AI-Powered Real-Time Waste Classification System

EcoSort classifies waste into 10 material categories from a photo or live webcam feed, using a fine-tuned MobileNetV2 model served through a FastAPI backend and a React frontend — helping route items to the correct recycling stream in real time.

**🔗 Live demo:** [ecosort-liart.vercel.app](https://ecosort-liart.vercel.app/)
**🔗 API:** [nj30sep-ecosort-backend.hf.space](https://nj30sep-ecosort-backend.hf.space)

---

## Overview

Manual waste sorting is slow, error-prone, and doesn't scale — misclassified items contaminate entire recycling streams. EcoSort addresses this with a lightweight deep learning model that classifies a waste item from an image in ~200ms, deployable as a browser-based app with no installation.

This project was built as a BCA (Honours) final year project at Bundelkhand University, Jhansi, under the supervision of Dr. Anil Kewat.

## Features

- 📤 **Upload mode** — classify any JPG/PNG/WebP image
- 📷 **Live camera mode** — real-time classification from a webcam feed
- 🎯 **Top-3 predictions** with confidence scores
- ♻️ **Category-specific recycling tips** for each of the 10 classes
- 📱 Responsive — tested on Chrome desktop and mobile
- 🕓 Session history of recent classifications

## Waste Categories

Battery · Biological · Cardboard · Clothes · Glass · Metal · Paper · Plastic · Shoes · Trash

## Model

- **Architecture:** MobileNetV2 (Transfer Learning), pre-trained on ImageNet
- **Training:** Two-phase — frozen-base feature extraction, then fine-tuning the top 50 layers — on Google Colab (free GPU)
- **Dataset:** 19,762 images across 10 classes (80/20 train/val split)
- **Results:** 90.52% training accuracy · 89.62% validation accuracy · ~200ms inference time
- **Model size:** ~14MB (.h5), ~4MB (TFLite, float16 quantized)

## Tech Stack

| Layer | Technology |
|---|---|
| ML Framework | TensorFlow / Keras, MobileNetV2 |
| Backend | FastAPI (Python), Uvicorn |
| Frontend | React.js, MediaDevices Webcam API |
| Model Training | Google Colab (free GPU) |
| Backend Hosting | Hugging Face Spaces (Docker) |
| Frontend Hosting | Vercel |

## Architecture

EcoSort's current, live implementation is a straightforward pipeline:

```
Google Colab (train MobileNetV2) → .h5 model
        ↓
FastAPI backend (Hugging Face Spaces) ←→ React frontend (Vercel)
        ↓                                      ↓
   runs inference                     upload / webcam capture
   ~200ms response                    displays result + tip
```

**Planned / future-facing architecture:** the project is also designed around a full AWS data engineering pipeline (DynamoDB → Kinesis → Lambda/Firehose → S3 → Glue ETL → Athena/SageMaker) intended for a future phase where ingestion, cataloguing, and model retraining move fully into the cloud. This is a design/roadmap component, not part of the current running system — see [Future Scope](#future-scope) below.

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

- Full AWS cloud deployment (Amazon SageMaker for managed, auto-scaling model serving)
- Offline mobile app (Flutter/React Native + bundled TFLite model)
- Physical IoT smart bin prototype (Raspberry Pi + servo-actuated bins)
- Expanded categories (e-waste, hazardous, medical waste)
- Municipal dashboard integration for real-time waste analytics

## Author

**Nikhil Jain**
BCA (Honours), Bundelkhand University, Jhansi

## License

MIT
