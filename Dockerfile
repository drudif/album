FROM node:20-bookworm-slim

WORKDIR /app

# Instala dependencias primeiro para aproveitar cache de camadas.
# (driver 'pg' e JavaScript puro — sem toolchain de compilacao.)
COPY package*.json ./
RUN npm install --omit=dev

# Copia o restante do codigo.
COPY . .

ENV NODE_ENV=production
EXPOSE 3000

CMD ["npm", "start"]
