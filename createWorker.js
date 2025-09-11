// Importa a build ESM do Tesseract que expõe `createWorker`
import { createWorker } from 'https://cdn.jsdelivr.net/npm/tesseract.js@5.0.4/dist/tesseract.esm.min.js';
import logger from './logger.js';

export async function createOcrWorker() {
  const worker = await createWorker({ logger: m => logger.log('[OCR]', m) });
  await worker.loadLanguage('por+eng');
  await worker.initialize('por+eng');
  await worker.setParameters({
    tessedit_pageseg_mode: '6',
    preserve_interword_spaces: '1',
    user_defined_dpi: '300',
    tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789- xX'
  });
  return worker;
}
