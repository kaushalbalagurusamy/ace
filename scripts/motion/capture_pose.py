"""Motion capture from reference video: MediaPipe Pose Landmarker (heavy) on every frame, world and image landmarks.

Usage: python capture_pose.py <video> <model.task> <out.json> [first_frame] [last_frame] [slow]
`slow` multiplies the timestamps fed to the tracker (the clip is played slowed, so its temporal filter lags less on fast motion).
Output: {fps, frames: [{n, world: [[x,y,z,vis]*33] | null, image: [[u,v,z,vis]*33] | null}]}. Reference video is never shipped;
only the retargeted curves derived from this file are (scripts/motion/retarget.py).
"""
import json, sys
import cv2
import mediapipe as mp
from mediapipe.tasks.python import vision, BaseOptions

video, model, out = sys.argv[1:4]
first = int(sys.argv[4]) if len(sys.argv) > 4 else 0
last = int(sys.argv[5]) if len(sys.argv) > 5 else 10**9
slow = float(sys.argv[6]) if len(sys.argv) > 6 else 4.0
cap = cv2.VideoCapture(video); fps = cap.get(cv2.CAP_PROP_FPS) or 30
opts = vision.PoseLandmarkerOptions(base_options=BaseOptions(model_asset_path=model), running_mode=vision.RunningMode.VIDEO,
                                    num_poses=1, min_pose_detection_confidence=0.3, min_tracking_confidence=0.3)
frames = []
r4 = lambda p: [round(p.x, 4), round(p.y, 4), round(p.z, 4), round(p.visibility or 0, 3)]
with vision.PoseLandmarker.create_from_options(opts) as lm:
    n = -1
    while True:
        ok, img = cap.read(); n += 1
        if not ok or n > last: break
        if n < first: continue
        rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        r = lm.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb), int((n - first) * 1000 * slow / fps))
        frames.append({'n': n, 'world': [r4(p) for p in r.pose_world_landmarks[0]] if r.pose_world_landmarks else None,
                       'image': [r4(p) for p in r.pose_landmarks[0]] if r.pose_landmarks else None})
        if n % 100 == 0: print(n, 'ok' if frames[-1]['world'] else 'none', flush=True)
json.dump({'fps': fps, 'width': int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), 'height': int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)), 'frames': frames}, open(out, 'w'))
print('frames', len(frames), 'detected', sum(1 for f in frames if f['world']))
