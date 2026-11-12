from flask import Flask, request, jsonify, render_template_string
from flask_cors import CORS
# Import your answer generation function from llama_ai.py
from llama_ai import generate_answer

app = Flask(__name__)
CORS(app)

# HTML User Interface
HTML_TEMPLATE = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Texas Capitol Legislative Assistant</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; }
        .chat-box { border: 1px solid #ccc; padding: 20px; min-height: 300px; max-height: 500px; overflow-y: auto; margin-bottom: 20px; border-radius: 5px; }
        .input-group { display: flex; gap: 10px; }
        input[type="text"] { flex: 1; padding: 10px; font-size: 16px; }
        button { padding: 10px 20px; font-size: 16px; cursor: pointer; }
        .msg { margin-bottom: 15px; }
        .user { color: #0056b3; font-weight: bold; }
        .bot { color: #28a745; font-weight: bold; }
    </style>
</head>
<body>
    <h2>Texas Capitol Legislative Assistant (Hybrid RAG)</h2>
    <div class="chat-box" id="chat"></div>
    <div class="input-group">
        <input type="text" id="query" placeholder="e.g., How many bills were filed by Harrison?" onkeydown="if(event.key==='Enter') sendQuery()">
        <button onclick="sendQuery()">Send</button>
    </div>

    <script>
        async function sendQuery() {
            const input = document.getElementById('query');
            const chat = document.getElementById('chat');
            const userMsg = input.value.trim();
            if (!userMsg) return;

            chat.innerHTML += `<div class="msg"><span class="user">You:</span> ${userMsg}</div>`;
            input.value = '';

            try {
                const response = await fetch('/api/query', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: userMsg })
                });
                const data = await response.json();
                chat.innerHTML += `<div class="msg"><span class="bot">AI:</span> ${data.answer}</div>`;
            } catch (err) {
                chat.innerHTML += `<div class="msg"><span class="bot" style="color:red;">Error connecting to server.</span></div>`;
            }
            chat.scrollTop = chat.scrollHeight;
        }
    </script>
</body>
</html>
"""

@app.route('/')
def index():
    return render_template_string(HTML_TEMPLATE)

@app.route('/api/query', methods=['POST'])
def query_endpoint():
    data = request.json
    user_query = data.get('query', '')
    
    # Run query through your pipeline logic
    answer = generate_answer(user_query)
    return jsonify({"answer": answer})

if __name__ == '__main__':
    # Listen on all interfaces on port 5000
    app.run(host='0.0.0.0', port=5000, debug=True)
