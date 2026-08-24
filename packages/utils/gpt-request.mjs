import OpenAI from "openai";

const clientCache = new Map();

function getOpenAIClient({ baseURL, apiKey }) {
  const cacheKey = `${baseURL}::${apiKey}`;
  let client = clientCache.get(cacheKey);
  if (!client) {
    client = new OpenAI({ baseURL, apiKey });
    clientCache.set(cacheKey, client);
  }
  return client;
}

export async function completes(
  {
    baseURL,
    apiKey,
    model
  },
  messages,
  {
    max_tokens = 100,
    temperature = 0,
    response_format
  } = {}
) {
  const openai = getOpenAIClient({ baseURL, apiKey });

  const createParams = {
    messages,
    model,
    frequency_penalty: 0,
    max_tokens,
    temperature
  };
  if (response_format) {
    createParams.response_format = response_format;
  }

  const completion = await openai.chat.completions.create(createParams);

  console.log(completion.choices[0].message.content);
  return completion;
}