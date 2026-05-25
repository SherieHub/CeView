from fastapi import FastAPI
from routes.BertRouter import bert_router

app = FastAPI()

@app.get('/')
def start_program():
    return {"status": "successfull", "message": "bert-agent microservice working properly"}

app.include_router(bert_router, prefix="/classification")