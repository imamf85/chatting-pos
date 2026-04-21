import { useState, useRef, useEffect } from 'react';
import { parseOrder, applyMissingVarian } from '../../lib/parser';
import { parseWithAI, convertAIResultToItems, isAIEnabled } from '../../lib/aiParser';
import { VARIAN_OPTIONS, VARIAN_LABELS, UKURAN_OPTIONS, UKURAN_LABELS, DAGING_LABELS } from '../../lib/menu';
import type { ParsedItem, Varian, Ukuran, OrderItem, PaymentMethod } from '../../types';

// Completed order info for chat display
export interface CompletedOrder {
  id: string;
  txNumber: number;
  namaCustomer: string;
  items: OrderItem[];
  total: number;
  bayar: number;
  kembalian: number;
  paymentMethod: PaymentMethod | null;
  createdAt: string;
}

interface OrderChatProps {
  onOrderParsed: (items: ParsedItem[], namaCustomer: string) => void;
  completedOrders?: CompletedOrder[];
}

type ChatState = 'idle' | 'waitingVarian' | 'waitingUkuran' | 'parsing';

interface Message {
  id: string;
  type: 'user' | 'system' | 'order-complete';
  text: string;
  order?: CompletedOrder;
}

export default function OrderChat({ onOrderParsed, completedOrders = [] }: OrderChatProps) {
  const [input, setInput] = useState('');
  const [chatState, setChatState] = useState<ChatState>('idle');
  const [pendingItems, setPendingItems] = useState<ParsedItem[]>([]);
  const [pendingNama, setPendingNama] = useState('');
  const [conversationMessages, setConversationMessages] = useState<Message[]>([]);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevOrderCountRef = useRef(0);

  // Build messages from completed orders + conversation
  const buildOrderMessages = (): Message[] => {
    // Sort orders by createdAt (oldest first)
    const sortedOrders = [...completedOrders].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    return sortedOrders.map((order) => ({
      id: `order-${order.id}`,
      type: 'order-complete' as const,
      text: '',
      order,
    }));
  };

  // Combine order history with conversation messages
  const allMessages: Message[] = [
    // Welcome message
    {
      id: 'welcome',
      type: 'system',
      text: completedOrders.length > 0
        ? 'Ketik pesanan baru di bawah 👇'
        : 'Halo! Ketik pesanan seperti di WhatsApp ya 👋\n\nContoh:\n• "2 sig jumbo pedas"\n• "PESENAN A.N BUDI: ori 3 sedang & 2 pedas"',
    },
    // Order history
    ...buildOrderMessages(),
    // Current conversation
    ...conversationMessages,
  ];

  // Auto-scroll when new orders are added
  useEffect(() => {
    if (completedOrders.length > prevOrderCountRef.current) {
      // New order was added, scroll to bottom
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
    prevOrderCountRef.current = completedOrders.length;
  }, [completedOrders.length]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversationMessages]);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + 'px';
    }
  }, [input]);

  const addMessage = (type: 'user' | 'system', text: string) => {
    setConversationMessages((prev) => [
      ...prev,
      { id: Date.now().toString(), type, text },
    ]);
  };

  // Clear conversation when new orders are added (they'll show in order history)
  useEffect(() => {
    if (completedOrders.length > 0) {
      setConversationMessages([]);
    }
  }, [completedOrders.length]);

  // Format rupiah for display
  const formatRupiah = (ribuan: number) => {
    return `Rp ${(ribuan * 1000).toLocaleString('id-ID')}`;
  };

  // Format time for display
  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleSubmit = () => {
    const text = input.trim();
    if (!text || chatState === 'parsing') return;

    addMessage('user', text);
    setInput('');

    if (chatState === 'waitingVarian') {
      handleVarianResponse(text);
    } else if (chatState === 'waitingUkuran') {
      handleUkuranResponse(text);
    } else {
      handleNewOrder(text);
    }

    inputRef.current?.focus();
  };

  // Check what clarification is needed and show appropriate message
  const checkAndAskClarification = (items: ParsedItem[], namaCustomer: string) => {
    const hasMissingVarian = items.some((i) => !i.varian);
    const hasMissingUkuran = items.some((i) => i.missing?.includes('ukuran'));

    if (hasMissingVarian) {
      const missingCount = items.filter((i) => !i.varian).length;
      setPendingItems(items);
      setPendingNama(namaCustomer);
      setChatState('waitingVarian');
      addMessage(
        'system',
        `Ada ${missingCount} item yang variannya belum jelas 🧐\n\nMau pakai varian apa?\n• Original\n• Signature\n• Cheesy`
      );
    } else if (hasMissingUkuran) {
      const missingCount = items.filter((i) => i.missing?.includes('ukuran')).length;
      setPendingItems(items);
      setPendingNama(namaCustomer);
      setChatState('waitingUkuran');
      addMessage(
        'system',
        `Ada ${missingCount} item yang ukurannya belum dipilih 📏\n\nMau pakai ukuran apa?\n• Small\n• Reguler\n• Jumbo`
      );
    } else {
      setChatState('idle');
      onOrderParsed(items, namaCustomer);
    }
  };

  const handleNewOrder = async (text: string) => {
    // Try AI parser first if enabled
    if (isAIEnabled()) {
      setChatState('parsing');
      addMessage('system', 'Sedang memproses pesanan... ⏳');

      try {
        const aiResult = await parseWithAI(text);

        if (aiResult && aiResult.items.length > 0) {
          const { items, namaCustomer } = convertAIResultToItems(aiResult);

          // Remove the "processing" message
          setConversationMessages((prev) => prev.slice(0, -1));

          checkAndAskClarification(items, namaCustomer);
          return;
        }
      } catch (error) {
        console.error('AI parsing failed, falling back to regex:', error);
        // Remove the "processing" message and continue with fallback
        setConversationMessages((prev) => prev.slice(0, -1));
      }
    }

    // Fallback to regex parser
    setChatState('idle');
    const result = parseOrder(text);

    if (result.items.length === 0) {
      addMessage(
        'system',
        'Hmm, tidak menemukan item pesanan 🤔\n\nCoba tulis ulang ya, contoh:\n"sig 2 pedas" atau "ori jumbo 3"'
      );
      return;
    }

    checkAndAskClarification(result.items, result.namaCustomer);
  };

  const handleVarianResponse = (text: string) => {
    const normalized = text.toLowerCase().trim();

    let selectedVarian: Varian | null = null;

    if (normalized.includes('ori') || normalized.includes('original')) {
      selectedVarian = 'original';
    } else if (normalized.includes('sig') || normalized.includes('signature')) {
      selectedVarian = 'signature';
    } else if (normalized.includes('cheese') || normalized.includes('cheesy')) {
      selectedVarian = 'cheesy';
    }

    if (!selectedVarian) {
      addMessage(
        'system',
        'Pilih salah satu varian ya:\n• Original\n• Signature\n• Cheesy'
      );
      return;
    }

    const updatedItems = applyMissingVarian(pendingItems, selectedVarian);
    // Check if ukuran also needs clarification
    checkAndAskClarification(updatedItems, pendingNama);
  };

  const handleUkuranResponse = (text: string) => {
    const normalized = text.toLowerCase().trim();

    let selectedUkuran: Ukuran | null = null;

    if (normalized.includes('small') || normalized.includes('kecil')) {
      selectedUkuran = 'small';
    } else if (normalized.includes('reg') || normalized.includes('reguler')) {
      selectedUkuran = 'reguler';
    } else if (normalized.includes('jumbo') || normalized.includes('besar') || normalized.includes('gede')) {
      selectedUkuran = 'jumbo';
    }

    if (!selectedUkuran) {
      addMessage(
        'system',
        'Pilih salah satu ukuran ya:\n• Small\n• Reguler\n• Jumbo'
      );
      return;
    }

    // Apply ukuran to items missing it
    const updatedItems = pendingItems.map((item) => {
      if (item.missing?.includes('ukuran')) {
        return {
          ...item,
          ukuran: selectedUkuran!,
          missing: item.missing.filter((m) => m !== 'ukuran'),
        };
      }
      return item;
    });

    setChatState('idle');
    setPendingItems([]);
    onOrderParsed(updatedItems, pendingNama);
    setPendingNama('');
  };

  // Enter = new line only, tidak submit
  // Submit hanya via tombol send
  const handleKeyDown = (_e: React.KeyboardEvent) => {
    // Allow default behavior (Enter = new line)
  };

  // Quick varian buttons
  const handleQuickVarian = (varian: Varian) => {
    addMessage('user', VARIAN_LABELS[varian]);
    const updatedItems = applyMissingVarian(pendingItems, varian);
    checkAndAskClarification(updatedItems, pendingNama);
  };

  // Quick ukuran buttons
  const handleQuickUkuran = (ukuran: Ukuran) => {
    addMessage('user', UKURAN_LABELS[ukuran]);
    const updatedItems = pendingItems.map((item) => {
      if (item.missing?.includes('ukuran')) {
        return {
          ...item,
          ukuran,
          missing: item.missing.filter((m) => m !== 'ukuran'),
        };
      }
      return item;
    });
    setChatState('idle');
    setPendingItems([]);
    onOrderParsed(updatedItems, pendingNama);
    setPendingNama('');
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-emerald-50 to-white dark:from-gray-800 dark:to-gray-900">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {allMessages.map((msg) => (
          <div key={msg.id}>
            {/* Regular messages (user/system) */}
            {(msg.type === 'user' || msg.type === 'system') && (
              <div className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] px-4 py-3 whitespace-pre-wrap text-[15px] leading-relaxed ${
                    msg.type === 'user'
                      ? 'bg-emerald-500 text-white rounded-2xl rounded-br-md shadow-sm'
                      : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-2xl rounded-bl-md shadow-md border border-gray-100 dark:border-gray-700'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            )}

            {/* Completed order bubble */}
            {msg.type === 'order-complete' && msg.order && (
              <div className="flex justify-end">
                <div className="max-w-[90%] rounded-2xl rounded-br-md shadow-lg overflow-hidden">
                  {/* Order Header */}
                  <div className={`px-4 py-2 flex items-center justify-between gap-3 ${
                    msg.order.paymentMethod === 'qris'
                      ? 'bg-gradient-to-r from-purple-500 to-indigo-500'
                      : 'bg-gradient-to-r from-green-500 to-emerald-500'
                  }`}>
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-white font-semibold">
                        #TX-{String(msg.order.txNumber).padStart(3, '0')}
                      </span>
                      {msg.order.namaCustomer && (
                        <span className="text-white/80 text-sm">
                          • {msg.order.namaCustomer}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-white/80 text-xs">
                        {formatTime(msg.order.createdAt)}
                      </span>
                      {msg.order.paymentMethod && (
                        <span className="px-2 py-0.5 bg-white/20 rounded-full text-white text-xs font-medium">
                          {msg.order.paymentMethod === 'qris' ? 'QRIS' : 'CASH'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Order Items */}
                  <div className="bg-white dark:bg-gray-800 px-4 py-3">
                    <div className="space-y-2">
                      {msg.order.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-start text-sm">
                          <div>
                            <span className="text-gray-900 dark:text-white font-medium">
                              {item.qty}x {VARIAN_LABELS[item.varian]} {UKURAN_LABELS[item.ukuran]}
                            </span>
                            <div className="text-gray-500 dark:text-gray-400 text-xs">
                              {DAGING_LABELS[item.daging]} • {item.kepedasan}
                            </div>
                          </div>
                          <span className="text-gray-600 dark:text-gray-300 font-medium">
                            {formatRupiah(item.subtotal)}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Total */}
                    <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center">
                      <span className="text-gray-500 dark:text-gray-400 text-sm">Total</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                        {formatRupiah(msg.order.total)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Varian Buttons */}
      {chatState === 'waitingVarian' && (
        <div className="px-4 pb-2">
          <div className="flex gap-2">
            {VARIAN_OPTIONS.map((varian) => (
              <button
                key={varian}
                onClick={() => handleQuickVarian(varian)}
                className="flex-1 py-3 bg-white dark:bg-gray-800 border-2 border-emerald-200 dark:border-emerald-700 text-emerald-600 dark:text-emerald-400 font-semibold
                           rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:border-emerald-300 dark:hover:border-emerald-600 transition-all
                           active:scale-95 shadow-sm"
              >
                {VARIAN_LABELS[varian]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Quick Ukuran Buttons */}
      {chatState === 'waitingUkuran' && (
        <div className="px-4 pb-2">
          <div className="flex gap-2">
            {UKURAN_OPTIONS.map((ukuran) => (
              <button
                key={ukuran}
                onClick={() => handleQuickUkuran(ukuran)}
                className="flex-1 py-3 bg-white dark:bg-gray-800 border-2 border-emerald-200 dark:border-emerald-700 text-emerald-600 dark:text-emerald-400 font-semibold
                           rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:border-emerald-300 dark:hover:border-emerald-600 transition-all
                           active:scale-95 shadow-sm"
              >
                {UKURAN_LABELS[ukuran]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Area - Fixed at bottom */}
      <div className="sticky bottom-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-4 py-3 shadow-lg">
        <div className="flex gap-3 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              chatState === 'waitingVarian'
                ? 'Atau ketik varian...'
                : chatState === 'waitingUkuran'
                ? 'Atau ketik ukuran...'
                : 'Ketik pesanan di sini...'
            }
            rows={1}
            className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 border-0 rounded-2xl resize-none
                       focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white dark:focus:bg-gray-600
                       text-[16px] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 transition-all"
            style={{ minHeight: '48px', maxHeight: '120px' }}
          />
          <button
            onClick={handleSubmit}
            disabled={!input.trim()}
            className="w-12 h-12 flex items-center justify-center bg-emerald-500 text-white
                       rounded-full shadow-lg hover:bg-emerald-600 transition-all
                       disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
