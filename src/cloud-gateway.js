/**
 * Cloud Gateway - shared OpenClaw instance for users without their own computer.
 * Uses Cameron's Ollama API key as the default provider.
 * This is the free/trial tier — limited but functional.
 */

// The cloud gateway is Cameron's OpenClaw on WSL2, connected via the connector.
// Users who sign up without installing locally get routed to this shared instance.
// In production, this would be isolated VPS instances per user.

// For now, this module just marks whether a user is using cloud or local.
import { query } from './db/client.js';

export async function setGatewayMode(userId, mode) {
  await query('UPDATE gateways SET version = $1 WHERE user_id = $2', [mode, userId]);
}

export async function getGatewayMode(userId) {
  const result = await query('SELECT version FROM gateways WHERE user_id = $1 LIMIT 1', [userId]);
  return result.rows[0]?.version || 'local';
}
