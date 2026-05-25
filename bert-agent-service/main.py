from fastapi import FastAPI
from services import BertService

app = FastAPI()

@app.get('/')
def start_program():
    return {"status": "successfull", "message": "bert-agent microservice working properly"}

