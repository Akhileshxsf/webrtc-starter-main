import asyncio
import websockets
import json
import base64
import numpy as np
import cv2
import onnxruntime as ort
import time

session = ort.InferenceSession('models/ssd_mobilenet_v1_10.onnx')

labels = ['person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck', 'boat', 'traffic light', 'fire hydrant', 'stop sign', 'parking meter', 'bench', 'bird', 'cat', 'dog', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra', 'giraffe', 'backpack', 'umbrella', 'handbag', 'tie', 'suitcase', 'frisbee', 'skis', 'snowboard', 'sports ball', 'kite', 'baseball bat', 'baseball glove', 'skateboard', 'surfboard', 'tennis racket', 'bottle', 'wine glass', 'cup', 'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple', 'sandwich', 'orange', 'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake', 'chair', 'couch', 'potted plant', 'bed', 'dining table', 'toilet', 'tv', 'laptop', 'mouse', 'remote', 'keyboard', 'cell phone', 'microwave', 'oven', 'toaster', 'sink', 'refrigerator', 'book', 'clock', 'vase', 'scissors', 'teddy bear', 'hair drier', 'toothbrush']

async def handler(websocket):
    while True:
        message = await websocket.recv()
        data = json.loads(message)
        image_b64 = data['image'].split(',')[1]
        image_bytes = base64.b64decode(image_b64)
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        img = cv2.resize(img, (300, 300))
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB).transpose((2, 0, 1)).astype(np.float32) / 255.0
        img = np.expand_dims(img, axis=0)
        outputs = session.run(None, {'image': img})
        num = outputs[0][0]
        boxes = outputs[1][0]
        scores = outputs[3][0]
        classes = outputs[2][0]
        detections = []
        for i in range(int(num)):
            if scores[i] > 0.5:
                detections.append({
                    'label': labels[int(classes[i]) - 1],
                    'score': float(scores[i]),
                    'xmin': float(boxes[i][1]),
                    'ymin': float(boxes[i][0]),
                    'xmax': float(boxes[i][3]),
                    'ymax': float(boxes[i][2])
                })
        inference_ts = int(time.time() * 1000)
        response = {
            'frame_id': data['frame_id'],
            'capture_ts': data['capture_ts'],
            'recv_ts': data['recv_ts'],
            'inference_ts': inference_ts,
            'detections': detections
        }
        await websocket.send(json.dumps(response))

start_server = websockets.serve(handler, '0.0.0.0', 8000)
asyncio.get_event_loop().run_until_complete(start_server)
asyncio.get_event_loop().run_forever()