# GlowOS Broker

The GlowOS Broker is a high-performance WebSocket relay service that connects local OpenClaw instances (or Pi agents) to external Web/PWA clients. Built with Fastify, it enables secure, bidirectional, on-demand connections between mainstream end-users and their personal AI agents without requiring complex local networking setups.

## 🚀 Vision: The Mainstream Pi Coding Agent

**Next Evolution of GlowOS:** We are transitioning GlowOS from a general-purpose AI OS into a highly accessible **Pi coding agent for mainstream users**. The goal is to provide powerful, automated agentic coding capabilities directly to non-technical users. 

**Monetization Strategy:** To ensure sustainable scalability and healthy profit margins, GlowOS will utilize LLMs with a 24-hour usage reset model. This cap controls costs while giving users consistent daily access to their Pi agent.

## ⚙️ Architecture

- Maintains a persistent WebSocket broker connection.
- When the broker signals a PWA client connection, it spawns a fresh OpenClaw/Pi WebSocket connection.
- Relays payloads bidirectionally.
- The PWA securely handles the handshake (`connect.challenge` -> `connect`).
- Injects local auth tokens automatically.
- Instantly cleans up OpenClaw sockets upon PWA disconnection.

## 🛠 Prerequisites & Installation

- Node.js (v18+)
- PostgreSQL (if using the main broker server)

```bash
# Clone the repository
git clone https://github.com/camster91/glowos-broker.git

# Install dependencies
npm install
```

## 🚀 Running the Connector

The Gateway Connector (`glowos-connector.js`) links a local agent to the remote broker. Ensure you set the appropriate environment variables:

```bash
export GLOWOS_BROKER_URL="wss://api.getglowos.com/gateway/connect"
export GLOWOS_GATEWAY_TOKEN="your_gateway_token"
export OPENCLAW_URL="ws://127.0.0.1:18789"
export OPENCLAW_TOKEN="your_local_token"

node glowos-connector.js
```

## 🖥 Running the Broker API (Main Server)

```bash
npm run dev
# or
npm start
```

## 📄 License & Future Roadmap

This repository is part of the Nexus AI ecosystem, driving towards an accessible, monetizable agentic future. Future updates will deeply integrate the Pi CLI agent capabilities, streamline the usage-reset billing model, and prepare the broker for massive concurrent PWA connections.
