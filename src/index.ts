import OpenAI from 'openai';
import { Hono } from 'hono';
import { cors } from 'hono/cors';

type Bindings = {
	OPEN_AI_KEY: string;
	AI: Ai;
}

const app = new Hono<{ Bindings: Bindings }>();

app.use(
	'/*',
	cors({
		origin: '*',
		allowHeaders: ['Content-Type', 'X-Custom-Header', 'Upgrade-Insecure-Requests'],
		allowMethods: ['GET', 'POST', 'OPTIONS', 'PUT'],
		exposeHeaders: ['Content-Length','X-Kuma-Revision'],
		maxAge: 600,
		credentials: true,
	})
);

app.get('/', (c) => {
	return c.text('Welcome to the the notion-clone cloudflare worker!');
});

app.post('/translateDocument', async (c) => {
	const { documentData, targetLang } = await c.req.json();

	const summaryResponse = await c.env.AI.run('@cf/facebook/bart-large-cnn', {
		input_text: documentData,
		max_length: 1000,
	});

	const response = await c.env.AI.run('@cf/meta/m2m100-1.2b', {
		text: summaryResponse.summary,
		source_lang: 'english',
		target_lang: targetLang,
	});

	return new Response(JSON.stringify(response));
});

app.post('/chatToDocument', async (c)=> {
	const openai = new OpenAI({
        apiKey: c.env.OPEN_AI_KEY
    });

    const { documentData, question } = await c.req.json();
    
    const chatCompletion = await openai.chat.completions.create({
        messages: [
            {
                role: 'system',
                content:
                    "You are an assistant helping the user to chat to a document, I am providing a JSON file of the markdown \
                    for the document. Using this, answer the user's question in the clearest way possible. \
                    The document is about " + documentData,
            },
            {
                role: 'user',
                content: 'My question is:' + question,
            },
            
        ],
        model: 'gpt-3.5-turbo',
        temperature: 0.5
    });

    const response = chatCompletion.choices[0].message.content;

    return c.json({ message: response });
});

export default app;