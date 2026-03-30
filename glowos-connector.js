#!/usr/bin/env node
/**
 * GlowOS Gateway Connector v5
 *
 * Architecture: On-demand OpenClaw connections.
 * - Maintains persistent broker connection
 * - When broker signals a PWA client wants to connect, creates a fresh
 *   OpenClaw WebSocket and relays bidirectionally
 * - The PWA handles the OpenClaw handshake (connect.challenge → connect)
 * - Connector injects the local auth token into the connect request
 * - When PWA disconnects, the OpenClaw socket is closed
 *
 * Broker protocol extension:
 * - broker.client.connected → create new OpenClaw socket
 * - broker.client.disconnected → close OpenClaw socket
 * - All other messages → relay to/from OpenClaw
 */

import WebSocket from 'ws';

const BROKER_URL = process.env.GLOWOS_BROKER_URL || 'wss://api.getglowos.com/gateway/connect';
const GATEWAY_TOKEN = process.env.GLOWOS_GATEWAY_TOKEN || '';
const LOCAL_GW = process.env.OPENCLAW_URL || 'ws://127.0.0.1:18789';
const OC_TOKEN = process.env.OPENCLAW_TOKEN || '';

let brokerWs = null;
let localWs = null;
let brokerReconnectDelay = 1000;
let localActive = false;

const log = m => console.log(`[glowos] ${new Date().toISOString()} ${m}`);

// ── Broker ──
function connectBroker() {
  if (brokerWs?.readyState === WebSocket.OPEN) return;
  log('Broker: connecting...');

  try { brokerWs = new WebSocket(`${BROKER_URL}?token=${GATEWAY_TOKEN}`); }
  catch (e) { log(`Broker: failed - ${e.message}`); scheduleBrokerReconnect(); return; }

  brokerWs.on('open', () => {
    log('Broker: connected (waiting for PWA clients)');
    brokerReconnectDelay = 1000;
  });

  brokerWs.on('message', raw => {
    const msg = raw.toString();
    let data;
    try { data = JSON.parse(msg); } catch {}

    // Ignore broker protocol messages
    if (data?.type?.startsWith('broker.')) return;

    // If we get any OpenClaw protocol message from PWA, ensure local is connected
    if (!localWs || localWs.readyState !== WebSocket.OPEN) {
      connectLocal(() => forwardToLocal(msg, data));
      return;
    }

    forwardToLocal(msg, data);
  });

  brokerWs.on('close', code => {
    log(`Broker: disconnected (${code})`);
    brokerWs = null;
    closeLocal();
    scheduleBrokerReconnect();
  });

  brokerWs.on('error', e => log(`Broker: error - ${e.message}`));
}

function scheduleBrokerReconnect() {
  setTimeout(connectBroker, brokerReconnectDelay);
  brokerReconnectDelay = Math.min(brokerReconnectDelay * 2, 30000);
}

function forwardToLocal(msg, data) {
  // Intercept connect requests to inject local token
  if (data?.type === 'req' && data.method === 'connect' && data.params?.auth) {
    data.params.auth.token = OC_TOKEN;
    msg = JSON.stringify(data);
  }

  if (localWs?.readyState === WebSocket.OPEN) {
    localWs.send(msg);
  }
}

// ── Local OpenClaw (on-demand) ──
function connectLocal(onReady) {
  if (localWs?.readyState === WebSocket.OPEN) { if (onReady) onReady(); return; }

  log('OpenClaw: connecting...');
  try {
    localWs = new WebSocket(LOCAL_GW, {
      headers: { Origin: 'http://127.0.0.1:18789' }
    });
  } catch (e) {
    log(`OpenClaw: failed - ${e.message}`);
    return;
  }

  const pending = [];
  if (onReady) pending.push(onReady);

  localWs.on('open', () => {
    log('OpenClaw: connected');
    localActive = true;
    for (const fn of pending) fn();
  });

  // All OpenClaw messages → broker → PWA
  localWs.on('message', raw => {
    if (brokerWs?.readyState === WebSocket.OPEN) {
      brokerWs.send(raw.toString());
    }
  });

  localWs.on('close', code => {
    log(`OpenClaw: disconnected (${code})`);
    localWs = null;
    localActive = false;
  });

  localWs.on('error', e => log(`OpenClaw: error - ${e.message}`));
}

function closeLocal() {
  if (localWs) {
    try { localWs.close(); } catch {}
    localWs = null;
    localActive = false;
  }
}

// ── Self-healing (broker only — local is on-demand) ──
setInterval(() => {
  if (!brokerWs || brokerWs.readyState !== WebSocket.OPEN) connectBroker();
}, 10000);

// ── Start ──
log('GlowOS Connector v5 (on-demand relay)');
connectBroker();

function shutdown() {
  log('Shutdown');
  closeLocal();
  if (brokerWs) { try { brokerWs.close(); } catch {} brokerWs = null; }
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
