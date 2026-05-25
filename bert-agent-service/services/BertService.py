from model.model import BertModel

class BertService:
    threshold: float = 0.5
    def predict_text_categories(self, user_text: str) -> dict:
        """
        Takes raw text, generates embeddings, predicts classes, and formats the output.
        """
        
        classifier_model = BertModel.get_classifier_model()
        encoder = BertModel.get_encoder_model()
        vector = encoder.encode([user_text])
        raw_probabilities = classifier_model.predict(vector, verbose=0)[0]
        percentage_breakdown = {}
        triggered_labels = []
        
        for i, decimal_prob in enumerate(raw_probabilities):
            class_number = i + 1 # Shifting 0-6 back to 1-7
            percentage_val = decimal_prob * 100
            
            percentage_breakdown[f"class_number"] = f"{percentage_val:.2f}%"
            
            if decimal_prob >= self.threshold:
                triggered_labels.append(class_number)
                
        return {
            "status": "success",
            "triggered_labels": triggered_labels,
            "probabilities": percentage_breakdown
        }