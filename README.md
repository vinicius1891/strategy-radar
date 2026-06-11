# Strategy Radar (MVP V1)

SaaS de estrategias quantitativas orientado por demanda. O usuario escolhe **um ativo**
e a plataforma responde: **"Quais estrategias identificam oportunidades neste ativo agora?"**

Nao ha varredura global de mercado: toda analise acontece apenas quando um ativo e consultado,
com cache agressivo em todas as camadas.

## Stack

| Camada    | Tecnologia |
|-----------|------------|
| Frontend  | Next.js 15, TypeScript, Tailwind 4, TanStack Query, Lightweight Charts |
| Backend   | NestJS 11, TypeScript |
| Banco     | PostgreSQL + Prisma (ou modo demo em memoria) |
| Cache     | Redis via ioredis (ou fallback LRU em memoria) |
| Infra     | Docker Compose, AWS-ready |

## Rodando em modo demo (sem Docker, sem banco)

Funciona imediatamente nesta maquina — persistencia em memoria, cache em memoria e
dados de mercado sinteticos deterministicos:

```bash
npm run install:all      # instala apps/api e apps/web
npm run dev:api          # API em http://localhost:3001
npm run dev:web          # Web em http://localhost:3000
```

Login demo: `demo@strategyradar.app` / `demo1234`

## Rodando com PostgreSQL + Redis (producao local)

```bash
docker compose up -d postgres redis
copy .env.example apps\api\.env       # ajuste DATABASE_URL/REDIS_URL
npm run prisma:migrate                 # cria as tabelas
npm run prisma:seed                    # usuario demo + 10 ativos + 10 estrategias
npm run dev:api
npm run dev:web
```

Ou tudo via Docker: `docker compose up --build`.

### Dados reais da B3

Defina no ambiente da API:

```
MARKET_DATA_PROVIDER=brapi
BRAPI_TOKEN=<seu token de https://brapi.dev>
```

Sem isso, o provider `synthetic` gera series OHLCV deterministicas por ticker (dev/demo).

## Arquitetura

```
apps/
  api/                       NestJS
    src/core/                Nucleo quantitativo (puro, sem IO)
      indicators.ts          SMA, EMA, RSI, MACD, ATR, ADX/DI, Bollinger, Donchian...
      rule-engine.ts         Interpreta StrategyConfig (JSON) dinamicamente
      backtest.ts            Motor de backtest long-only com metricas e equity
      strategy-definitions.ts  As 10 estrategias V1 como objetos de configuracao
    src/modules/
      cache/                 Redis ou LRU em memoria, mesma interface
      market-data/           Providers plugaveis (brapi | synthetic) + cache
      persistence/           Repositorios Prisma/Postgres ou memoria (demo)
      auth/                  JWT (register, login, me)
      assets/                Busca, cotacao, candles (cadastro sob demanda)
      radar/                 Nucleo do produto: avalia estrategias de UM ativo
      strategies/            Listagem e ajuste de parametros (PATCH /params)
      backtest/              POST /backtest com cache por versao da estrategia
  web/                       Next.js (App Router)
    app/asset/[ticker]/      Radar do ativo: cotacao, grafico, cards de setup
    app/backtest/            Metricas, curva de capital, lista de trades
    app/strategies/          Catalogo das estrategias e parametros
```

### Motor de regras

Estrategias **nao tem codigo proprio**. Cada uma e um `StrategyConfig` JSON com:

- `entry` / `exit` / `invalidation`: arvore de condicoes (`compare`, `cross`, grupos AND/OR)
- Operandos: preco (com offset), indicador (com parametros), valor, parametro nomeado,
  expressao aritmetica e referencia a nivel ja calculado (ex.: alvo = entrada + 2x risco)
- `levels`: entrada, stop, alvo e gatilho como expressoes
- `params`: todos os numeros editaveis sem tocar na definicao

Classificacao do radar:

| Status          | Regra |
|-----------------|-------|
| `ACTIVE`        | Todas as condicoes de entrada atendidas no ultimo candle |
| `ARMING`        | Filtros completos, faltando apenas o gatilho (ou >= 2/3 das condicoes) |
| `NO_SETUP`      | Condicoes ausentes |
| `INVALIDATED`   | Condicao de invalidacao atendida |

### Politica de cache

| Chave                                  | TTL    | Invalidacao extra |
|----------------------------------------|--------|-------------------|
| `quote:{ticker}`                       | 60s    | — |
| `candles:{ticker}:{tf}:{range}`        | 300s   | — |
| `radar:{ticker}:{tf}`                  | 60s    | Prefixo `radar:` ao alterar estrategia |
| `backtest:{id}:{updatedAt}:{...}`      | 600s   | Automatica (updatedAt na chave) |

### Endpoints principais

```
POST /auth/register | /auth/login        GET /auth/me
GET  /assets/search?q=                   GET /assets/:ticker
GET  /assets/:ticker/candles?timeframe=&range=
GET  /radar/:ticker?timeframe=1d|1wk
GET  /strategies                         GET /strategies/:idOrSlug
PATCH /strategies/:idOrSlug/params       { "params": { "rsiPeriod": 10 } }
POST /backtest                           { strategy, ticker, timeframe, rangeDays, initialCapital }
```

## Verificacao

```bash
npm run test:core    # indicadores, motor de regras, 10 estrategias, backtest
npm run build        # compila API e Web
```

## Nota sobre filesystem (Windows/exFAT)

Este repositorio pode rodar em drives sem suporte a symlink (exFAT). Por isso:
- os apps sao instalados separadamente (sem npm workspaces);
- `apps/web/scripts/fs-readlink-patch.cjs` corrige o comportamento de `fs.readlink`
  apenas quando o defeito do filesystem e detectado (no-op em NTFS/ext4/Docker).

## Compliance

A plataforma exibe *setups detectados* por regras tecnicas configuraveis — nunca
recomendacoes de compra/venda, previsoes ou promessas de retorno. As decisoes sao
do usuario.
