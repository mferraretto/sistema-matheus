// Importa a versão correta do Tesseract que fornece o método `createWorker`
import { createWorker } from 'https://cdn.jsdelivr.net/npm/tesseract.js@5.0.4/dist/tesseract.min.js';

export async function createOcrWorker() {
  const worker = await createWorker({ logger: m => console.log('[OCR]', m) });
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
