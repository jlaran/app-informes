import { CognitoJwtVerifier } from 'aws-jwt-verify';

/**
 * Verificador de JWT de Cognito (cachea las JWKS internamente). Se construye
 * una sola vez si el pool está configurado. Usamos el ID token porque lleva
 * `email` y el atributo personalizado `custom:tenant_id`.
 */
let verifier: ReturnType<typeof CognitoJwtVerifier.create> | null = null;

export function getVerifier() {
  const userPoolId = process.env.COGNITO_USER_POOL_ID;
  const clientId = process.env.COGNITO_CLIENT_ID;
  if (!userPoolId || !clientId) return null;
  if (!verifier) {
    verifier = CognitoJwtVerifier.create({ userPoolId, clientId, tokenUse: 'id' });
  }
  return verifier;
}

export interface CognitoClaims {
  sub: string;
  email: string;
  tenantId: string;
}

export async function verifyIdToken(token: string): Promise<CognitoClaims | null> {
  const v = getVerifier();
  if (!v) return null;
  try {
    const payload = await v.verify(token);
    const tenantId = (payload['custom:tenant_id'] as string | undefined) ?? '';
    const email = (payload.email as string | undefined) ?? '';
    if (!tenantId) return null;
    return { sub: payload.sub, email, tenantId };
  } catch {
    return null;
  }
}
