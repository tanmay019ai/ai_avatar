import { exec } from 'child_process';
import cors from 'cors';
import dotenv from 'dotenv';
// @ts-ignore
import voice from 'elevenlabs-node';
import express from 'express';
// eslint-disable-next-line n/no-unsupported-features/node-builtins
import { promises as fs } from 'fs';
import { GoogleGenerativeAI } from '@google/generative-ai';

const CONTEXT_FILE = 'context.json';
const voiceID = '9BWtsMINqrJLrRacOk9x';
dotenv.config();

async function parse(file_path: string) {
  const data = await fs.readFile(file_path);
  const parsed = JSON.parse(data.toString());
  return parsed;
}

async function gemini_chat(query: string): Promise<string> {
  // This could be streamed, i preffer streaming
  // TODO: Boundary it with error check as it is js not ts
  if (!process.env.GEMINI_API_KEY) {
    return 'Gemini api key not defined';
  }
  console.log(`user: ${query}`);
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '-');
  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    systemInstruction: `
      You are a chat bot of galgotias university who provides details about an event taking place in our college.
        take recent info from context given. don't include * in text
        You will always reply with a JSON array of messages. With a maximum of 3 messages. and don't quote it with \`\`\`json 
        Each message has a text, facialExpression, and animation property.
        The different facial expressions are: smile, sad, angry, surprised, funnyFace, and default.
        The different animations are: Talking_0, Talking_1, Talking_2, Crying, Laughing, Rumba, Idle, Terrified, and Angry.
        `,
  });
  const jsonctx = await parse(CONTEXT_FILE);
  const chat = model.startChat({
    history: jsonctx,
  });
  let resp;
  try {
    const result = await chat.sendMessage(query);
    resp = result.response.text();
  } catch {
    resp = "Sorry can't help you with that";
  }
  console.log(`gemini: ${resp}`);
  return resp;
}

const elevenLabsApiKey = process.env.ELEVEN_LABS_API_KEY;

const app = express();
app.use(express.json());
app.use(cors());
const port = 3000;

app.get('/voices', async (req, res) => {
  res.send(await voice.getVoices(elevenLabsApiKey));
});

const execCommand = (command: string) => {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, _) => {
      if (error) reject(error);
      resolve(stdout);
    });
  });
};

const lipSyncMessage = async (message: string) => {
  const time = new Date().getTime();
  console.log(`Starting conversion for message ${message}`);
  await execCommand(
    `ffmpeg -y -i audios/message_${message}.mp3 audios/message_${message}.wav`,
    // -y to overwrite the file
  );
  console.log(`Conversion done in ${new Date().getTime() - time}ms`);
  await execCommand(
    `./bin/rhubarb -f json -o audios/message_${message}.json audios/message_${message}.wav -r phonetic`,
  );
  // -r phonetic is faster but less accurate
  console.log(`Lip sync done in ${new Date().getTime() - time}ms`);
};

// app.get('/', (_, res) => {
//   res.send('Hello World!');
// });

app.post('/chat', async (req, res) => {
  /*
    This endpoint returns response like following
  {
    text: "text which model will speak",
    facialExpression: "smile,etc",
    animation: "animation name",
    audio: "Base64 file",
    lipsync: {metadata: {}, mouthCues: []}
  }
  */
  const userMessage = req.body.message;
  if (!userMessage) {
    res.send({
      messages: [
        {
          text: 'Hey dear... How was your day?',
          audio: await audioFileToBase64('audios/intro_0.wav'),
          lipsync: await readJsonTranscript('audios/intro_0.json'),
          facialExpression: 'smile',
          animation: 'Talking_1',
        },
        {
          text: "I missed you so much... Please don't go for so long!",
          audio: await audioFileToBase64('audios/intro_1.wav'),
          lipsync: await readJsonTranscript('audios/intro_1.json'),
          facialExpression: 'sad',
          animation: 'Crying',
        },
      ],
    });
    return;
  }
  if (!elevenLabsApiKey || process.env.GEMINI_API_KEY === '-') {
    res.send({
      messages: [
        {
          text: "Please my dear, don't forget to add your API keys!",
          audio: await audioFileToBase64('audios/api_0.wav'),
          lipsync: await readJsonTranscript('audios/api_0.json'),
          facialExpression: 'angry',
          animation: 'Angry',
        },
        {
          text: "You don't want to ruin Wawa Sensei with a crazy ChatGPT and ElevenLabs bill, right?",
          audio: await audioFileToBase64('audios/api_1.wav'),
          lipsync: await readJsonTranscript('audios/api_1.json'),
          facialExpression: 'smile',
          animation: 'Laughing',
        },
      ],
    });
    return;
  }

  interface GeminiResponse {
    text: string;
    audio: string;
    lipsync: string;
  }

  const gtxt = await gemini_chat(userMessage);
  const messages: GeminiResponse[] = JSON.parse(gtxt); //  this parsing is done because the ai is instructed to return json
  // here parsing can go wrong an explicit fallback should be backing it

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];

    // generate audio file
    const fileName = `audios/message_${i}.mp3`;
    const textInput = message.text;
    await voice.textToSpeech(elevenLabsApiKey, voiceID, fileName, textInput);

    // generate lipsync
    await lipSyncMessage(i.toString());
    message.audio = await audioFileToBase64(fileName);
    message.lipsync = await readJsonTranscript(`audios/message_${i}.json`);
  }

  res.send({ messages });
});

const readJsonTranscript = async (file: string) => {
  const data = await fs.readFile(file, 'utf8');
  return JSON.parse(data);
};

const audioFileToBase64 = async (file: string) => {
  const data = await fs.readFile(file);
  return data.toString('base64');
};

app.listen(port, () => {
  console.log(`Backend on port ${port}`);
});
