FROM imbios/bun-node
WORKDIR /app

COPY . /app
RUN bun install
ENTRYPOINT ["bun", "run", "dev"]
