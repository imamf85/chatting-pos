/**
 * Receipt Formatter untuk AL Bewok POS
 * Generate struk thermal dengan ESC/POS commands
 * Lebar kertas: 58mm (32 karakter)
 */

import type { OrderItem, Transaksi } from '../types';

// ESC/POS Commands untuk printer thermal
const ESC_POS = {
  // Printer hardware
  HW_INIT: '\x1b\x40', // Initialize printer

  // Feed control
  CTL_LF: '\x0a', // Line feed

  // Text formatting
  TXT_NORMAL: '\x1b\x21\x00', // Normal text
  TXT_2HEIGHT: '\x1b\x21\x10', // Double height
  TXT_2WIDTH: '\x1b\x21\x20', // Double width
  TXT_BOLD_ON: '\x1b\x45\x01', // Bold on
  TXT_BOLD_OFF: '\x1b\x45\x00', // Bold off
  TXT_ALIGN_LEFT: '\x1b\x61\x00', // Left alignment
  TXT_ALIGN_CENTER: '\x1b\x61\x01', // Center alignment
  TXT_ALIGN_RIGHT: '\x1b\x61\x02', // Right alignment

  // Paper cutting
  PAPER_PART_CUT: '\x1d\x56\x01', // Partial cut
};

class ReceiptFormatter {
  private readonly paperWidth = 32; // Standard 58mm thermal printer width (32 chars)

  /** Pad text with alignment */
  private padText(text: string, width: number, align: 'left' | 'center' | 'right' = 'left'): string {
    const str = String(text);
    if (str.length > width) {
      return str.substring(0, width);
    }

    const padding = width - str.length;
    if (align === 'center') {
      const leftPad = Math.floor(padding / 2);
      const rightPad = padding - leftPad;
      return ' '.repeat(leftPad) + str + ' '.repeat(rightPad);
    } else if (align === 'right') {
      return ' '.repeat(padding) + str;
    } else {
      return str + ' '.repeat(padding);
    }
  }

  /** Format two columns (left & right aligned) */
  private formatColumns(left: string, right: string): string {
    const rightLen = right.length;
    const leftWidth = this.paperWidth - rightLen - 1;
    const leftTruncated = left.length > leftWidth ? left.substring(0, leftWidth) : left;
    return this.padText(leftTruncated, leftWidth) + ' ' + right;
  }

  /** Create separator line */
  private separator(char = '-'): string {
    return char.repeat(this.paperWidth);
  }

  /** Format currency - harga dalam ribuan, display dalam ribuan */
  private formatCurrency(amountInThousands: number): string {
    const fullAmount = amountInThousands * 1000;
    return `Rp ${fullAmount.toLocaleString('id-ID')}`;
  }

  /** Format currency short - untuk display ringkas */
  private formatCurrencyShort(amountInThousands: number): string {
    return `Rp${amountInThousands}k`;
  }

  /** Format date time */
  private formatDateTime(date: Date = new Date()): string {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${day}/${month}/${year}  ${hours}:${minutes}`;
  }

  /** Format tx number dengan padding */
  private formatTxNumber(txNumber: number): string {
    return `#TX-${txNumber.toString().padStart(3, '0')}`;
  }

  /** Capitalize first letter */
  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /** Format daging untuk display */
  private formatDaging(daging: string): string {
    if (daging === 'chicken') return 'Chicken';
    if (daging === 'beef klasik') return 'Beef Klasik';
    if (daging === 'beef premium') return 'Beef Premium';
    return daging;
  }

  /** Format kepedasan untuk display */
  private formatKepedasan(kepedasan: string): string {
    if (kepedasan === 'tidak pedas') return 'Tidak Pedas';
    return this.capitalize(kepedasan);
  }

  /**
   * Generate struk untuk dapur (kitchen receipt)
   * Fokus pada item & opsi tanpa harga
   */
  generateKitchenReceipt(
    transaksi: Transaksi,
    items: OrderItem[],
    lapakNama?: string
  ): string {
    let receipt = '';

    // Initialize printer
    receipt += ESC_POS.HW_INIT;

    // Header
    receipt += ESC_POS.TXT_ALIGN_CENTER;
    receipt += ESC_POS.TXT_2HEIGHT;
    receipt += `AL BEWOK ${this.formatTxNumber(transaksi.tx_number)}\n`;
    receipt += ESC_POS.TXT_NORMAL;
    if (lapakNama) {
      receipt += `${lapakNama}\n`;
    }
    receipt += this.separator() + '\n';

    // Order info
    receipt += ESC_POS.TXT_ALIGN_LEFT;
    receipt += `Waktu: ${this.formatDateTime(new Date(transaksi.created_at))}\n`;
    if (transaksi.nama_customer) {
      receipt += ESC_POS.TXT_BOLD_ON;
      receipt += `A.n.: ${transaksi.nama_customer}\n`;
      receipt += ESC_POS.TXT_BOLD_OFF;
    }
    receipt += this.separator() + '\n';

    // Items
    receipt += ESC_POS.TXT_BOLD_ON;
    receipt += 'ITEMS:\n';
    receipt += ESC_POS.TXT_BOLD_OFF;

    items.forEach((item) => {
      receipt += ESC_POS.TXT_BOLD_ON;
      receipt += `${item.qty}x ${this.capitalize(item.varian)} ${this.capitalize(item.ukuran)}\n`;
      receipt += ESC_POS.TXT_BOLD_OFF;
      receipt += `   ${this.formatDaging(item.daging)}\n`;
      receipt += `   ${this.formatKepedasan(item.kepedasan)}\n`;

      if (item.toppings && item.toppings.length > 0) {
        receipt += `   +${item.toppings.join(', ')}\n`;
      }
      if (item.catatan) {
        receipt += `   Note: ${item.catatan}\n`;
      }
      receipt += '\n';
    });

    // Footer
    receipt += this.separator() + '\n';
    receipt += ESC_POS.TXT_ALIGN_CENTER;
    receipt += ESC_POS.TXT_BOLD_ON;
    receipt += 'SEGERA DISIAPKAN\n';
    receipt += ESC_POS.TXT_BOLD_OFF;

    // Feed and cut
    receipt += '\n\n\n';
    receipt += ESC_POS.PAPER_PART_CUT;

    return receipt;
  }

  /**
   * Generate struk untuk customer
   * Format sesuai CLAUDE.md
   */
  generateCustomerReceipt(
    transaksi: Transaksi,
    items: OrderItem[],
    lapakNama?: string
  ): string {
    let receipt = '';

    // Initialize printer
    receipt += ESC_POS.HW_INIT;

    // Header - centered
    receipt += ESC_POS.TXT_ALIGN_CENTER;
    receipt += ESC_POS.TXT_2HEIGHT;
    receipt += 'AL BEWOK KEBAB\n';
    receipt += ESC_POS.TXT_NORMAL;
    receipt += 'Rasa Nikmat, Harga Bersahabat\n';
    receipt += this.separator() + '\n';

    // Order info - left aligned
    receipt += ESC_POS.TXT_ALIGN_LEFT;
    receipt += `No  : ${this.formatTxNumber(transaksi.tx_number)}\n`;
    receipt += `Tgl : ${this.formatDateTime(new Date(transaksi.created_at))}\n`;
    if (transaksi.nama_customer) {
      receipt += `A.n.: ${transaksi.nama_customer}\n`;
    }
    if (lapakNama) {
      receipt += `Lapak: ${lapakNama}\n`;
    }
    receipt += this.separator() + '\n';

    // Items
    items.forEach((item) => {
      // Item name line
      receipt += `Kebab ${this.capitalize(item.varian)} ${this.capitalize(item.ukuran)}\n`;
      // Details line
      receipt += `  ${this.formatDaging(item.daging)} - ${this.formatKepedasan(item.kepedasan)}\n`;

      // Toppings if any
      if (item.toppings && item.toppings.length > 0) {
        receipt += `  +${item.toppings.join(', ')}\n`;
      }
      // Notes if any
      if (item.catatan) {
        receipt += `  (${item.catatan})\n`;
      }

      // Price line: qty x price = subtotal
      const priceStr = this.formatCurrencyShort(item.harga_satuan);
      const subtotalStr = this.formatCurrencyShort(item.subtotal);
      receipt += this.formatColumns(`${item.qty}x${priceStr}`, subtotalStr) + '\n';
    });

    receipt += this.separator() + '\n';

    // Totals
    receipt += ESC_POS.TXT_BOLD_ON;
    receipt += this.formatColumns('TOTAL', this.formatCurrency(transaksi.total)) + '\n';
    receipt += ESC_POS.TXT_BOLD_OFF;

    if (transaksi.bayar > 0) {
      receipt += this.formatColumns('BAYAR', this.formatCurrency(transaksi.bayar)) + '\n';
      if (transaksi.kembalian > 0) {
        receipt += this.formatColumns('KEMBALIAN', this.formatCurrency(transaksi.kembalian)) + '\n';
      }
    }

    receipt += this.separator() + '\n';

    // Footer
    receipt += ESC_POS.TXT_ALIGN_CENTER;
    receipt += '\n';
    receipt += 'Terima kasih sudah jajan!\n';
    receipt += 'Sering-sering ya :)\n';

    // Feed and cut
    receipt += '\n\n\n';
    receipt += ESC_POS.PAPER_PART_CUT;

    return receipt;
  }

  /**
   * Generate struk ringkas (tanpa detail kepedasan/daging)
   * Untuk print cepat
   */
  generateSimpleReceipt(
    transaksi: Transaksi,
    items: OrderItem[]
  ): string {
    let receipt = '';

    receipt += ESC_POS.HW_INIT;

    // Header
    receipt += ESC_POS.TXT_ALIGN_CENTER;
    receipt += ESC_POS.TXT_BOLD_ON;
    receipt += `AL BEWOK ${this.formatTxNumber(transaksi.tx_number)}\n`;
    receipt += ESC_POS.TXT_BOLD_OFF;
    receipt += ESC_POS.TXT_NORMAL;
    receipt += this.formatDateTime(new Date(transaksi.created_at)) + '\n';
    if (transaksi.nama_customer) {
      receipt += `A.n. ${transaksi.nama_customer}\n`;
    }
    receipt += this.separator() + '\n';

    // Items - simple format
    receipt += ESC_POS.TXT_ALIGN_LEFT;
    items.forEach((item) => {
      const itemName = `${item.qty}x ${this.capitalize(item.varian)} ${this.capitalize(item.ukuran)}`;
      receipt += this.formatColumns(itemName, this.formatCurrencyShort(item.subtotal)) + '\n';
    });

    receipt += this.separator() + '\n';

    // Total
    receipt += ESC_POS.TXT_BOLD_ON;
    receipt += this.formatColumns('TOTAL', this.formatCurrency(transaksi.total)) + '\n';
    receipt += ESC_POS.TXT_BOLD_OFF;

    if (transaksi.bayar > 0 && transaksi.kembalian > 0) {
      receipt += this.formatColumns('Bayar', this.formatCurrency(transaksi.bayar)) + '\n';
      receipt += this.formatColumns('Kembali', this.formatCurrency(transaksi.kembalian)) + '\n';
    }

    // Feed and cut
    receipt += '\n\n\n';
    receipt += ESC_POS.PAPER_PART_CUT;

    return receipt;
  }
}

// Export singleton instance
const receiptFormatter = new ReceiptFormatter();

export default receiptFormatter;
