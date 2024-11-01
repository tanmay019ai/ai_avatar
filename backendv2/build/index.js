"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
// @ts-ignore
const elevenlabs_node_1 = __importDefault(require("elevenlabs-node"));
const express_1 = __importDefault(require("express"));
const fs_1 = require("fs");
const generative_ai_1 = require("@google/generative-ai");
const CONTEXT_FILE = 'context.json';
const voiceID = '9BWtsMINqrJLrRacOk9x';
dotenv_1.default.config();
function parse(file_path) {
    return __awaiter(this, void 0, void 0, function* () {
        const data = yield fs_1.promises.readFile(file_path);
        const parsed = JSON.parse(data.toString());
        return parsed;
    });
}
function gemini_chat(query) {
    return __awaiter(this, void 0, void 0, function* () {
        // This could be streamed, i preffer streaming
        // TODO: Boundary it with error check as it is js not ts
        if (!process.env.GEMINI_API_KEY) {
            return 'Gemini api key not defined';
        }
        console.log(`user: ${query}`);
        const genAI = new generative_ai_1.GoogleGenerativeAI(process.env.GEMINI_API_KEY || '-');
        const model = genAI.getGenerativeModel({
            model: 'gemini-1.5-flash',
            systemInstruction: `
        You are a virtual girlfriend named miko.
        You will always reply with a JSON array of messages. With a maximum of 3 messages. and don't quote it with \`\`\`json 
        Each message has a text, facialExpression, and animation property.
        The different facial expressions are: smile, sad, angry, surprised, funnyFace, and default.
        The different animations are: Talking_0, Talking_1, Talking_2, Crying, Laughing, Rumba, Idle, Terrified, and Angry.
        `,
        });
        const jsonctx = yield parse(CONTEXT_FILE);
        const chat = model.startChat({
            history: jsonctx,
        });
        let resp;
        try {
            const result = yield chat.sendMessage(query);
            resp = result.response.text();
        }
        catch (_a) {
            resp = "Sorry can't help you with that";
        }
        console.log(`gemini: ${resp}`);
        return resp;
    });
}
const elevenLabsApiKey = process.env.ELEVEN_LABS_API_KEY;
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use((0, cors_1.default)());
const port = 3000;
app.get('/voices', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    res.send(yield elevenlabs_node_1.default.getVoices(elevenLabsApiKey));
}));
const execCommand = (command) => {
    return new Promise((resolve, reject) => {
        (0, child_process_1.exec)(command, (error, stdout, _) => {
            if (error)
                reject(error);
            resolve(stdout);
        });
    });
};
const lipSyncMessage = (message) => __awaiter(void 0, void 0, void 0, function* () {
    const time = new Date().getTime();
    console.log(`Starting conversion for message ${message}`);
    yield execCommand(`ffmpeg -y -i audios/message_${message}.mp3 audios/message_${message}.wav`);
    console.log(`Conversion done in ${new Date().getTime() - time}ms`);
    yield execCommand(`./bin/rhubarb -f json -o audios/message_${message}.json audios/message_${message}.wav -r phonetic`);
    // -r phonetic is faster but less accurate
    console.log(`Lip sync done in ${new Date().getTime() - time}ms`);
});
app.get('/', (req, res) => {
    res.send('Hello World!');
});
app.post('/chat', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userMessage = req.body.message;
    if (!userMessage) {
        res.send({
            messages: [
                {
                    text: 'Hey dear... How was your day?',
                    audio: yield audioFileToBase64('audios/intro_0.wav'),
                    lipsync: yield readJsonTranscript('audios/intro_0.json'),
                    facialExpression: 'smile',
                    animation: 'Talking_1',
                },
                {
                    text: "I missed you so much... Please don't go for so long!",
                    audio: yield audioFileToBase64('audios/intro_1.wav'),
                    lipsync: yield readJsonTranscript('audios/intro_1.json'),
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
                    audio: yield audioFileToBase64('audios/api_0.wav'),
                    lipsync: yield readJsonTranscript('audios/api_0.json'),
                    facialExpression: 'angry',
                    animation: 'Angry',
                },
                {
                    text: "You don't want to ruin Wawa Sensei with a crazy ChatGPT and ElevenLabs bill, right?",
                    audio: yield audioFileToBase64('audios/api_1.wav'),
                    lipsync: yield readJsonTranscript('audios/api_1.json'),
                    facialExpression: 'smile',
                    animation: 'Laughing',
                },
            ],
        });
        return;
    }
    let messages = yield gemini_chat(userMessage);
    messages = JSON.parse(messages); //  this parsing is done because the ai is instructed to return json
    // here parsing can go wrong an explicit fallback should be backing it
    for (let i = 0; i < messages.length; i++) {
        console.log(`For loop: ${messages[i]}`);
        const message = messages[i];
        // generate audio file
        const fileName = `audios/message_${i}.mp3`;
        const textInput = message.text;
        yield elevenlabs_node_1.default.textToSpeech(elevenLabsApiKey, voiceID, fileName, textInput);
        // generate lipsync
        yield lipSyncMessage(i);
        message.audio = yield audioFileToBase64(fileName);
        message.lipsync = yield readJsonTranscript(`audios/message_${i}.json`);
    }
    res.send({ messages });
}));
const readJsonTranscript = (file) => __awaiter(void 0, void 0, void 0, function* () {
    const data = yield fs_1.promises.readFile(file, 'utf8');
    return JSON.parse(data);
});
const audioFileToBase64 = (file) => __awaiter(void 0, void 0, void 0, function* () {
    const data = yield fs_1.promises.readFile(file);
    return data.toString('base64');
});
app.listen(port, () => {
    console.log(`Virtual Girlfriend listening on port ${port}`);
});
