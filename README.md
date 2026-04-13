backend cmd ->
pip install -r requirements.txt

pip install fastapi==0.108.0 uvicorn==0.25.0 python-dotenv==1.0.0 transformers==4.36.2 torch requests python-jose[cryptography] passlib[bcrypt] python-multipart reportlab

PS C:\Users\Admin\Desktop\PlusAi> python -c "
>> from transformers import AutoTokenizer
>> tokenizer = AutoTokenizer.from_pretrained('cardiffnlp/twitter-roberta-base-sentiment-latest')
>> tokenizer.save_pretrained('models/bert_sentiment')
>> print('Tokenizer saved!')
>> "

PS C:\Users\Admin\Desktop\PlusAi> python -m uvicorn backend:app --reload --port 8000


frontend cmd ->
cd C:\Users\Admin\Desktop >> npx create-react-app pulseai-frontend
npm install axios recharts
npm start









