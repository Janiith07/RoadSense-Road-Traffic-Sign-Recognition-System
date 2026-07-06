import os
import json
import numpy as np
from flask import Flask, request, jsonify, render_template
from PIL import Image
import tensorflow as tf
from tensorflow import keras

app = Flask(__name__)

# ── Config
UPLOAD_FOLDER = 'uploads'
IMG_SIZE      = 64
MAX_FILE_SIZE = 10 * 1024 * 1024   # 10 MB
ALLOWED_EXT   = {'png', 'jpg', 'jpeg', 'bmp', 'webp'}

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# ── Load model and class names once at startup
print("Loading model...")
model = keras.models.load_model('best_model.keras')

with open('class_names.json') as f:
    data        = json.load(f)
    CLASS_NAMES = data['classes']

print(f"Model loaded. Classes: {len(CLASS_NAMES)}")

# ── Friendly display names for each class
DISPLAY_NAMES = {
    "exitleft":          "Exit Left",
    "exitright":         "Exit Right",
    "giveway":           "Give Way",
    "noentry":           "No Entry",
    "noovertaking":      "No Overtaking",
    "oneway":            "One Way",
    "pedestrian":        "Pedestrian",
    "roundabout":        "Roundabout",
    "speedlimit100":     "Speed Limit 100",
    "speedlimit20":      "Speed Limit 20",
    "speedlimit60":      "Speed Limit 60",
    "stop":              "Stop",
    "trafficsignalahead":"Traffic Signal Ahead",
    "turnleft":          "Turn Left",
    "turnright":         "Turn Right",
}


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXT


def preprocess_image(pil_image):
    """Resize and normalise a PIL image for model input."""
    img   = pil_image.convert('RGB').resize((IMG_SIZE, IMG_SIZE))
    arr   = np.array(img, dtype=np.float32) / 255.0
    return np.expand_dims(arr, 0)   # (H,W,3) -> (1,H,W,3)


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/predict', methods=['POST'])
def predict():
    if 'image' not in request.files:
        return jsonify({'error': 'No image file provided'}), 400

    file = request.files['image']

    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400

    if not allowed_file(file.filename):
        return jsonify({'error': 'File type not supported. Use PNG, JPG, JPEG, BMP or WEBP.'}), 400

    if request.content_length and request.content_length > MAX_FILE_SIZE:
        return jsonify({'error': 'File too large. Maximum size is 10 MB.'}), 400

    try:
        img        = Image.open(file.stream)
        batch      = preprocess_image(img)
        probs      = model.predict(batch, verbose=0)[0]   # shape: (15,)
        top5_idx   = np.argsort(probs)[::-1][:5]

        top5 = [
            {
                'class':        CLASS_NAMES[i],
                'display_name': DISPLAY_NAMES.get(CLASS_NAMES[i], CLASS_NAMES[i]),
                'confidence':   round(float(probs[i]) * 100, 2),
            }
            for i in top5_idx
        ]

        return jsonify({
            'prediction':  top5[0]['display_name'],
            'class':       top5[0]['class'],
            'confidence':  top5[0]['confidence'],
            'top5':        top5,
        })

    except Exception as e:
        return jsonify({'error': f'Prediction failed: {str(e)}'}), 500


if __name__ == '__main__':
    app.run(debug=True, port=5000)
