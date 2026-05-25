import numpy as np
from model.model import BertModel

class BertService:
    threshold: float = 0.5

    def predict_text_categories(self, user_text: str) -> dict:
        """
        Takes raw text, generates embeddings, predicts classes, and formats the output.
        """
        classifier_model = BertModel.get_classifier_model()
        encoder = BertModel.get_encoder_model()
        
        # Generate embeddings
        vector = encoder.encode([user_text])
        
        # CRITICAL FIX: Keras returns a numpy array. We extract index 0 
        # and convert it immediately into a native Python list of floats.
        raw_predictions = classifier_model.predict(vector, verbose=0)[0]
        raw_probabilities = raw_predictions.tolist() 
        
        # Normalize the native Python list
        normalized_probs = self.even_probabilities(raw_probabilities)
        
        percentage_breakdown = {}
        triggered_labels = []
        
        for i, decimal_prob in enumerate(normalized_probs):
            class_number = i + 1  # Shifting 0-6 back to 1-7
            percentage_val = decimal_prob * 100
            
            percentage_breakdown[f"class_{class_number}"] = f"{percentage_val:.2f}%"
            
            if decimal_prob >= self.threshold:
                triggered_labels.append(class_number)
                
        return {
            "status": "success",
            "triggered_labels": triggered_labels,
            "probabilities": percentage_breakdown
        }
    
    def even_probabilities(self, prob: list) -> list:
        # Utilizing numpy sum is safer, but native sum works fine now that 'prob' is a true list
        total = sum(prob)
        if total == 0: 
            return [0.0 for x in prob]
        return [round(float(x) / total, 4) for x in prob]