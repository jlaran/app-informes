// Puntos de entrada para AWS Lambda / ECS. Cada handler se empaqueta por separado.
export { handler as downloadHandler } from './handlers/download.js';
export { handler as parseHandler } from './handlers/parse.js';
export { handler as matchHandler } from './handlers/match.js';

export { parseBoletin } from './parser/index.js';
export { matchNotices } from './matcher/alert-matcher.js';
export { notifyMatches } from './matcher/notifier.js';
