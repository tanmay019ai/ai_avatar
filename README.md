# University AI Chatbot

This project is an AI-powered chatbot designed for university environments, featuring a ReactJS frontend and a TypeScript backend. The chatbot is containerized using Docker Compose, making setup straightforward. Just replace the environment variable `GEMINI_API_KEY` in the `docker-compose.yml` file, and you're ready to go.

## Steps to Set Up
1. Replace `GEMINI_API_KEY` with your own key in the `docker-compose.yml` file.
2. Run the following command:
   ```bash
   sudo docker-compose up -d
   ```
3. Wait for the TTS container to start the web server.

> **Important:** Currently, this setup only supports Linux. For Windows, you'll need to host the TTS server manually and adjust some code in the backend.

## Audio and Lip-Sync Tools
This project uses:
- [Coqui TTS](https://github.com/coqui-ai/TTS) for generating audio responses.
- [Rhubarb Lip Sync](https://github.com/DanielSWolf/rhubarb-lip-sync) for creating lip-sync animations to match audio output.

## Acknowledgments
Special thanks to the contributors who supported this project:
- [NixSkye](https://github.com/NixSkye)
- [tanmay019ai](https://github.com/tanmay019ai)
- [appledog632](https://github.com/appledog632)

