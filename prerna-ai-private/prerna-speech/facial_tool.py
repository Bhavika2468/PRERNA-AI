"""
Facial Expression Analysis Tool
Adapted for PRERNA AI — uses OpenCV + MediaPipe + DeepFace locally.
No external API calls. All weights run on CPU.
"""

import cv2
import numpy as np
import json
import mediapipe as mp
from deepface import DeepFace


def analyze_facial_expressions(video_path: str) -> str:
    """
    Analyzes facial expressions in a video to detect emotions and engagement.
    Processes every 5th frame for performance on 4GB RAM.

    Returns JSON string with:
    - emotion_timeline: list of {timestamp, emotion}
    - engagement_metrics: {eye_contact_frequency, smile_frequency}
    """
    mp_face_mesh = mp.solutions.face_mesh
    face_mesh = mp_face_mesh.FaceMesh(
        static_image_mode=False,
        max_num_faces=1,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5
    )

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return json.dumps({
            "error": "Could not open video file",
            "emotion_timeline": [],
            "engagement_metrics": {"eye_contact_frequency": 0, "smile_frequency": 0}
        })

    emotion_timeline = []
    eye_contact_count = 0
    smile_count = 0
    frame_count = 0
    processed_count = 0

    fps = cap.get(cv2.CAP_PROP_FPS) or 25
    frame_interval = 5  # Process 1 in every 5 frames — saves RAM

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        frame_count += 1
        if frame_count % frame_interval != 0:
            continue

        processed_count += 1

        # Resize to 640x480 for faster processing
        frame = cv2.resize(frame, (640, 480))
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

        results = face_mesh.process(rgb_frame)

        if results.multi_face_landmarks:
            for face_landmarks in results.multi_face_landmarks:
                h, w, _ = frame.shape
                lc = [(int(lm.x * w), int(lm.y * h)) for lm in face_landmarks.landmark]

                # ── Emotion Detection via DeepFace ──
                try:
                    analysis = DeepFace.analyze(
                        frame,
                        actions=['emotion'],
                        enforce_detection=False,
                        silent=True
                    )
                    emotion = analysis[0]['dominant_emotion']
                    if emotion == "happy":
                        smile_count += 1
                    timestamp = round(frame_count / fps, 2)
                    emotion_timeline.append({"timestamp": timestamp, "emotion": emotion})
                except Exception:
                    pass  # Skip frame if detection fails

                # ── Eye Contact Estimation via MediaPipe Landmarks ──
                # Upper/lower eyelid landmarks
                try:
                    left_upper  = lc[159]
                    left_lower  = lc[145]
                    right_upper = lc[386]
                    right_lower = lc[374]

                    left_opening  = np.linalg.norm(np.array(left_upper)  - np.array(left_lower))
                    right_opening = np.linalg.norm(np.array(right_upper) - np.array(right_lower))
                    avg_opening   = (left_opening + right_opening) / 2

                    # Threshold: eyes wide open = looking at camera
                    if avg_opening > 5:
                        eye_contact_count += 1
                except (IndexError, Exception):
                    pass

    cap.release()
    face_mesh.close()

    safe_total = max(processed_count, 1)

    return json.dumps({
        "emotion_timeline": emotion_timeline,
        "engagement_metrics": {
            "eye_contact_frequency": round(eye_contact_count / safe_total, 3),
            "smile_frequency": round(smile_count / safe_total, 3),
        },
        "frames_processed": processed_count,
    })
