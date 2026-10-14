# Rene Pose Model

A lightweight browser-based pose classification demo that uses TensorFlow.js and Teachable Machine to detect body pose in real time from a webcam.

The app is trained to classify two states:

- `natural`
- `rene`

When the model strongly recognizes the `rene` pose, the app can trigger a sound alert and highlight the prediction with the highest confidence.

## Features

- Live webcam pose detection
- Real-time skeleton overlay
- Confidence bars for each detected class
- Toggle for skeleton visibility
- Toggle for sound alert
- FPS display for performance feedback

## Project structure

```text
rene-model/
├── README.md
└── my-pose-model/
    ├── app.js
    ├── index.html
    ├── metadata.json
    ├── model.json
    ├── styles.css
    ├── weights.bin
    └── mama-by-rene.mp3
```

## How to run

From the project root:

```bash
cd my-pose-model
python -m http.server 8000
```

Then open this in your browser:

```text
http://localhost:8000
```

Allow camera access when prompted. The model is loaded locally from `model.json` and `metadata.json`.

## Notes

- This is a static web app, so it is best served through a small local web server rather than opening the HTML file directly.
- Webcam access is required for live detection.
- The app uses the TensorFlow.js CDN and Teachable Machine Pose library from a browser CDN.

## Files

- `index.html` – page structure and scripts
- `app.js` – webcam setup, prediction loop, and UI logic
- `model.json` – model graph and metadata
- `metadata.json` – model labels and configuration
- `weights.bin` – trained model weights
- `styles.css` – styling for the interface
- `mama-by-rene.mp3` – optional alert sound triggered when the model detects `rene` with high confidence

## License

This project is provided as a local demo and is not a formal package release. If you plan to reuse or redistribute it, make sure you have the rights to the model, media, and any associated assets before publishing.
