(function () {
  const emailUidCache = new Map();

  function normalizeEmail(email) {
    return typeof email === 'string' ? email.trim().toLowerCase() : '';
  }

  async function resolveUidsByEmail(db, emails) {
    if (!db || !Array.isArray(emails) || !emails.length) return [];
    const results = [];
    const seen = new Set();

    for (const rawEmail of emails) {
      const trimmed = typeof rawEmail === 'string' ? rawEmail.trim() : '';
      if (!trimmed) continue;
      const key = normalizeEmail(trimmed);
      if (seen.has(key)) continue;
      seen.add(key);

      if (emailUidCache.has(key)) {
        const cached = emailUidCache.get(key);
        if (cached) results.push(cached);
        continue;
      }

      try {
        const snap = await db
          .collection('uid')
          .where('email', '==', trimmed)
          .limit(1)
          .get();
        if (!snap.empty) {
          const uid = snap.docs[0].id;
          emailUidCache.set(key, uid);
          results.push(uid);
        } else {
          emailUidCache.set(key, null);
        }
      } catch (err) {
        console.error(
          '[ExpedicaoNotifier] Erro ao buscar UID para',
          trimmed,
          err,
        );
      }
    }

    return results.filter(Boolean);
  }

  async function notifyNovaEtiqueta(options = {}) {
    const { db, firebase, currentUser } = options;
    if (!db || !firebase || !firebase.firestore || !currentUser) {
      console.warn('[ExpedicaoNotifier] Parâmetros obrigatórios ausentes.');
      return;
    }

    try {
      const emails = Array.isArray(options.destinatarioEmails)
        ? options.destinatarioEmails
            .map((email) => (typeof email === 'string' ? email.trim() : ''))
            .filter(Boolean)
        : [];
      const extraUids = Array.isArray(options.destinatarioUids)
        ? options.destinatarioUids.filter(
            (uid) => typeof uid === 'string' && uid,
          )
        : [];

      const emailUids = await resolveUidsByEmail(db, emails);
      const destinatarios = Array.from(
        new Set(
          [...emailUids, ...extraUids].filter(
            (uid) => uid && uid !== currentUser.uid,
          ),
        ),
      );

      if (!destinatarios.length) return;

      const payload = {
        tipo: 'nova-etiqueta',
        origem: options.origem || 'Sistema de etiquetas',
        arquivoNome: options.arquivoNome || '',
        targetUrl: options.targetUrl || 'expedicao.html',
        destinatarios,
        autorUid: currentUser.uid,
        autorEmail: currentUser.email || '',
        autorNome: currentUser.displayName || currentUser.email || '',
        gestorEmails: emails,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      };

      if (Number.isFinite(options.totalEtiquetas)) {
        payload.totalEtiquetas = Number(options.totalEtiquetas);
      }
      if (Number.isFinite(options.totalPaginas)) {
        payload.totalPaginas = Number(options.totalPaginas);
      }
      if (typeof options.foraHorario === 'boolean') {
        payload.foraHorario = options.foraHorario;
      }
      if (options.pdfDocId) {
        payload.pdfDocId = options.pdfDocId;
      }
      if (
        options.additionalData &&
        typeof options.additionalData === 'object'
      ) {
        Object.assign(payload, options.additionalData);
      }

      await db.collection('expedicaoNotificacoes').add(payload);
    } catch (err) {
      console.error('[ExpedicaoNotifier] Erro ao registrar notificação:', err);
    }
  }

  window.ExpedicaoNotifier = window.ExpedicaoNotifier || {};
  window.ExpedicaoNotifier.notifyNovaEtiqueta = notifyNovaEtiqueta;
})();
