import type { OrderItem } from '../types';
import { VARIAN_LABELS, DAGING_LABELS } from './menu';

interface PrintReceiptData {
  txNumber: number;
  namaCustomer: string;
  items: OrderItem[];
  total: number;
  bayar: number;
  kembalian: number;
  createdAt: Date;
}

export function printReceipt(data: PrintReceiptData) {
  const { txNumber, namaCustomer, items, total, bayar, kembalian, createdAt } = data;

  const formatRupiah = (ribuan: number) => {
    return `Rp ${(ribuan * 1000).toLocaleString('id-ID')}`;
  };

  const formatShort = (ribuan: number) => {
    return `Rp ${ribuan}k`;
  };

  const pad = (str: string, len: number, char = ' ') => {
    return str.padEnd(len, char);
  };

  const center = (str: string, len: number) => {
    const padding = Math.max(0, len - str.length);
    const leftPad = Math.floor(padding / 2);
    return ' '.repeat(leftPad) + str + ' '.repeat(padding - leftPad);
  };

  const line = '-'.repeat(32);
  const date = createdAt.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const time = createdAt.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });

  let receipt = `
${center('AL BEWOK KEBAB', 32)}
${center('Rasa Nikmat, Harga Bersahabat', 32)}
${line}
No  : #TX-${String(txNumber).padStart(3, '0')}
Tgl : ${date}  ${time}
${namaCustomer ? `A.n.: ${namaCustomer}` : ''}
${line}
`;

  // Items
  items.forEach((item) => {
    const varianLabel = VARIAN_LABELS[item.varian];
    const ukuranLabel = item.ukuran.charAt(0).toUpperCase() + item.ukuran.slice(1);
    const dagingLabel = DAGING_LABELS[item.daging];
    const kepedasan = item.kepedasan.charAt(0).toUpperCase() + item.kepedasan.slice(1);

    receipt += `Kebab ${varianLabel} ${ukuranLabel}\n`;
    receipt += `  ${dagingLabel} - ${kepedasan}\n`;
    receipt += `${item.qty}x${formatShort(item.harga_satuan)}${pad('', 14)}${formatShort(item.subtotal).padStart(6)}\n`;
  });

  receipt += `${line}
${pad('TOTAL', 18)}${formatRupiah(total).padStart(14)}
${pad('BAYAR', 18)}${formatRupiah(bayar).padStart(14)}
${pad('KEMBALIAN', 18)}${formatRupiah(kembalian).padStart(14)}
${line}

${center('Terima kasih sudah jajan!', 32)}
${center('Sering-sering ya :)', 32)}
`;

  // Create print window
  const printWindow = window.open('', '_blank', 'width=300,height=600');
  if (!printWindow) {
    alert('Popup blocked. Please allow popups for this site.');
    return;
  }

  printWindow.document.write(`
<!DOCTYPE html>
<html>
<head>
  <title>Struk #TX-${String(txNumber).padStart(3, '0')}</title>
  <style>
    @page {
      margin: 0;
      size: 58mm auto;
    }
    @media print {
      body {
        margin: 0;
        padding: 4mm;
      }
    }
    body {
      font-family: 'Courier New', monospace;
      font-size: 11px;
      line-height: 1.3;
      width: 58mm;
      margin: 0 auto;
      padding: 4mm;
      white-space: pre;
    }
  </style>
</head>
<body>${receipt}</body>
</html>
  `);

  printWindow.document.close();

  // Wait for content to load then print
  printWindow.onload = () => {
    printWindow.print();
  };

  // Fallback if onload doesn't fire
  setTimeout(() => {
    printWindow.print();
  }, 500);
}
