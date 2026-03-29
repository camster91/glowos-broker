import { SignJWT, jwtVerify } from 'jose';
import config from '../config.js';

const secret = new TextEncoder().encode(config.jwtSecret);

export async function signToken(payload, expiresIn = '7d') {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret);
}

export async function verifyToken(token) {
  const { payload } = await jwtVerify(token, secret);
  return payload;
}
