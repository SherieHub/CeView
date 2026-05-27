import tensorflow as tf
import tf2onnx
import onnx

keras_path = "./models/complete_classifier_head.keras"
onnx_path = "./models/complete_classifier_head.onnx"

print("Loading Keras model...")
model = tf.keras.models.load_model(keras_path)

print("Converting to ONNX...")
spec = (tf.TensorSpec((None, 768), tf.float32, name="input"),) # Assumes E5 outputs 768 dims
model_proto, _ = tf2onnx.convert.from_keras(model, input_signature=spec, opset=13)

with open(onnx_path, "wb") as f:
    f.write(model_proto.SerializeToString())

print(f"Success! ONNX model saved to {onnx_path}")