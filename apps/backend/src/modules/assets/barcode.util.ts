import bwipjs from 'bwip-js';
import QRCode from 'qrcode';

export async function generateCode128Png(text: string): Promise<Buffer> {
  return bwipjs.toBuffer({
    bcid: 'code128',
    text,
    scale: 3,
    height: 10,
    includetext: true,
    textxalign: 'center',
  });
}

export function generateQrPng(text: string): Promise<Buffer> {
  return QRCode.toBuffer(text, { type: 'png', scale: 6, margin: 1 });
}
