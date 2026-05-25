import numpy as np
import tensorflow as tf
import os
import numpy as np
import tensorflow as tf
from sentence_transformers import SentenceTransformer
from pydantic import BaseModel

class BertModel:
    instance = None
    def __init__(self):
        self.__MODEL_NAME = "intfloat/multilingual-e5-base"
        self.__SAVED_MODEL_PATH = "./model/complete_classifier_head.keras"

        try:
            self.__encoder = SentenceTransformer(self.__MODEL_NAME)
            
            print(f"Loading Keras classifier from {self.__SAVED_MODEL_PATH}...")
            self.__classifier_model = tf.keras.models.load_model(self.__SAVED_MODEL_PATH)
            
        except Exception as e:
            print(f"❌ Failed to load models on startup: {e}")
            raise e
        
    @classmethod
    def get_classifier_model(cls):
        if cls.instance is None:
            cls.instance = BertModel()

        return cls.instance.__classifier_model
    
    @classmethod
    def get_encoder_model(cls):
        if cls.instance is None:
            cls.instance = BertModel()

        return cls.instance.__encoder
    
    @classmethod
    def get_model(cls):
        if cls.instance is None:
            cls.instance = BertModel()
        return cls.instance
    
BertModel.get_model()