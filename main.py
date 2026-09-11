from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import tensorflow as tf
import numpy as np
from PIL import Image
import io
import json
import os
import h5py

app = FastAPI(title="EcoSort API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_PATH = "ecosort_model.h5"
CLASS_NAMES_PATH = "class_names.json"

model = None
class_names = []

def fix_h5_metadata(filepath):
    """
    Scans the H5 metadata and removes keywords that cause crashes 
    on older Keras versions (axis lists and the 'groups' tag).
    """
    if not os.path.exists(filepath):
        return
    
    try:
        with h5py.File(filepath, 'a') as f:
            if 'model_config' in f.attrs:
                config_str = f.attrs['model_config']
                if isinstance(config_str, bytes):
                    config_str = config_str.decode('utf-8')
                
                config = json.loads(config_str)
                
                def repair_config(obj):
                    if isinstance(obj, dict):
                        # Fix 1: Convert axis list [3] to integer 3
                        if 'axis' in obj and isinstance(obj['axis'], list):
                            obj['axis'] = obj['axis'][0]
                        
                        # Fix 2: Remove 'groups' keyword which causes DepthwiseConv2D to crash
                        if 'groups' in obj:
                            del obj['groups']
                        
                        # Fix 3: Remove 'quantization_config' if it exists
                        if 'quantization_config' in obj:
                            del obj['quantization_config']

                        for k, v in obj.items():
                            repair_config(v)
                    elif isinstance(obj, list):
                        for item in obj:
                            repair_config(item)
                
                repair_config(config)
                f.attrs['model_config'] = json.dumps(config).encode('utf-8')
                print("🛠️ Successfully patched H5 metadata (Axis, Groups, and Quantization).")
    except Exception as e:
        print(f"⚠️ Metadata patch note: {e}")

@app.on_event("startup")
def startup_event():
    global model, class_names
    
    fix_h5_metadata(MODEL_PATH)

    if os.path.exists(CLASS_NAMES_PATH):
        try:
            with open(CLASS_NAMES_PATH) as f:
                class_names = json.load(f)
            print(f"✅ Classes loaded: {class_names}")
        except Exception as e:
            print(f"❌ Class load error: {e}")

    if os.path.exists(MODEL_PATH):
        try:
            model = tf.keras.models.load_model(MODEL_PATH, compile=False)
            print("✅ Model loaded successfully!")
        except Exception as e:
            print(f"❌ Final load error: {e}")
    else:
        print("⚠️ Waiting for ecosort_model.h5...")

# ... (The rest of the code for Tips, Preprocess, and Predict stays the same as before) ...

TIPS = {
    "plastic":    "♻️ Rinse plastic before recycling. Remove caps and labels if possible.",
    "paper":      "📄 Keep paper dry. Wet or greasy paper cannot be recycled.",
    "cardboard":  "📦 Flatten cardboard boxes to save space in the bin.",
    "glass":      "🍾 Rinse glass jars. Do not mix broken glass with recyclables.",
    "metal":      "🥫 Crush cans to save space. Remove food residue first.",
    "biological": "🌱 Compost biological waste. Great for garden fertilizer.",
    "battery":    "🔋 Never bin batteries! Drop at a designated battery collection point.",
    "shoes":      "👟 Donate usable shoes. Worn-out shoes go to textile recycling.",
    "clothes":    "👕 Donate clothes in good condition. Others go to textile recycling.",
    "trash":      "🗑️ This item goes to general waste. Try to reduce single-use items.",
}

def get_tip(class_name):
    for key in TIPS:
        if key in class_name.lower():
            return TIPS[key]
    return "🗑️ Dispose of this item responsibly."

def preprocess_image(image_bytes):
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img = img.resize((224, 224))
    arr = np.array(img) / 255.0
    return np.expand_dims(arr, axis=0)

@app.get("/")
def root():
    return {"message": "EcoSort API is running 🌿"}

@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    if model is None:
        return JSONResponse(status_code=503, content={"error": "Model not loaded yet."})
    try:
        contents = await file.read()
        input_tensor = preprocess_image(contents)
        predictions = model.predict(input_tensor)[0]
        top_index = int(np.argmax(predictions))
        confidence = float(predictions[top_index]) * 100
        label = class_names[top_index] if class_names else f"Class {top_index}"
        top3_indices = np.argsort(predictions)[::-1][:3]
        top3 = [{"label": class_names[i], "confidence": round(float(predictions[i]) * 100, 2)} for i in top3_indices]
        return {"label": label, "confidence": round(confidence, 2), "tip": get_tip(label), "top3": top3}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})