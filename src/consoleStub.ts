// Suppress routine internal Firestore gRPC idle stream disconnect logs.
// Must run universally on both Node.js and Browser environments.
const originalWarn = console.warn;
const originalError = console.error;

function isIgnored(msg: string) {
  if (!msg) return false;
  const s = msg.toLowerCase();
  return (
    s.includes('disconnecting idle stream') || 
    s.includes('timed out waiting for new targets') || 
    s.includes("listen' stream") ||
    s.includes('grpcconnection rpc') ||
    s.includes('maximum backoff delay') ||
    s.includes('resource-exhausted') ||
    s.includes('quota limit exceeded') ||
    (s.includes('firestore') && s.includes('stream') && s.includes('cancelled'))
  );
}

console.warn = (...args: any[]) => {
  const msg = args.map(arg => {
    if (arg && typeof arg === 'object') {
      try { return JSON.stringify(arg); } catch { return String(arg); }
    }
    return String(arg);
  }).join(' ');

  if (isIgnored(msg)) return;
  originalWarn.apply(console, args);
};

console.error = (...args: any[]) => {
  const msg = args.map(arg => {
    if (arg && typeof arg === 'object') {
      try { return JSON.stringify(arg); } catch { return String(arg); }
    }
    return String(arg);
  }).join(' ');

  if (isIgnored(msg)) return;
  originalError.apply(console, args);
};
