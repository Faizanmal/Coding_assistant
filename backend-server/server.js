const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fetch = global.fetch;
require('dotenv').config();

const app = express();
const PORT = 5000;

app.use(cors());
app.use(bodyParser.json());

app.post('/complete', async (req, res) => {
  const { prompt } = req.body;

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Invalid or missing prompt' });
  }

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama3-8b-8192',
        messages: [
          { role: 'system', content: 'You are a helpful code assistant.Provide only the code, no explanation, no markdown formatting.And comments in comments'},
//          { role: 'system', content: 'You are a helpful code assistant.'},
          { role: 'user', content: prompt }

        ],
        temperature: 0.6,
        max_tokens: 500,
      }),
    });

    const data = await response.json();
    const raw = data?.choices?.[0]?.message?.content;
    const completion = extractCodeFromMarkdown(raw);

    if (!completion) {
      return res.status(500).json({ error: 'No completion returned from Groq' });
    }

    res.json({ completion: completion.trim() });
  } catch (err) {
    console.error('Groq API error:', err);
    res.status(500).json({ error: 'Failed to fetch completion' });
  }
});

app.listen(PORT, () => {
  console.log(`✅ server listening on http://localhost:${PORT}`);
});

function extractCodeFromMarkdown(text) {
  const codeBlockMatch = text.match(/```[a-zA-Z]*\n([\s\S]*?)```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  return text.trim();
}
