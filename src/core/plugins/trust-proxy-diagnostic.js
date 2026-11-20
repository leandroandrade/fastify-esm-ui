import fp from 'fastify-plugin';

// The TCP peer is the only evidence of who actually opened the connection, and the range a
// hosting provider's edge uses is often neither documented nor promised stable. That leaves
// two operational gaps, both covered here:
//
// 1. Discovery: TRUSTED_PROXY_DEBUG logs the peer of every request, so the real address can
//    be read from the deployment log and only then put in TRUSTED_PROXY_IPS.
// 2. Drift: if the range changes, the peer stops matching the list and Fastify goes back to
//    ignoring X-Forwarded-For with no error at all — the rate limiter then keys everyone on
//    the edge's address, a single shared bucket. The warning turns that silent failure into
//    a log line.
async function trustProxyDiagnosticPlugin(fastify) {
  let driftAlreadyWarned = false;

  async function checkPeer(req) {
    const peer = req.socket.remoteAddress;
    if (!peer) {
      return;
    }

    const forwardedFor = req.headers['x-forwarded-for'];

    if (fastify.config.TRUSTED_PROXY_DEBUG) {
      fastify.log.info({ peer, forwardedFor, ip: req.ip }, 'trust-proxy-diagnostic-plugin: connection peer');
    }

    // With no header nobody claimed to be forwarding, so there is no drift to detect.
    if (!forwardedFor) {
      return;
    }

    // A trusted peer makes req.ip come from the header, different from the socket address.
    // Equal with the header present means the peer was left out of TRUSTED_PROXY_IPS.
    const isPeerOutsideTheList = req.ip === peer;
    if (!isPeerOutsideTheList) {
      return;
    }

    // Once per process: the condition repeats on every request, and repeating the line
    // would drown the log of the very deployment that is broken.
    if (driftAlreadyWarned) {
      return;
    }

    driftAlreadyWarned = true;

    fastify.log.warn({ peer, forwardedFor }, 'trust-proxy-diagnostic-plugin: X-Forwarded-For came from a peer outside TRUSTED_PROXY_IPS; req.ip is falling back to the socket address');
  }

  fastify.addHook('onRequest', checkPeer);
}

export default fp(trustProxyDiagnosticPlugin, {
  name: 'trust-proxy-diagnostic',
  dependencies: ['env']
});
