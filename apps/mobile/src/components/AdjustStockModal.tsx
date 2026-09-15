/**
 * AdjustStockModal — reusable stock adjustment modal.
 * Self-contained: passes `product` and callbacks.
 */

import React, {useEffect, useState} from 'react';
import {type ProductDto} from '@munim/core';
import {useAdjustStock} from '@munim/query';
import {successFeedback, errorFeedback} from '../lib/haptics';
import {Button, Field, ModalSheet} from './ui';

type AdjustStockModalProps = {
  visible: boolean;
  onClose: () => void;
  onSaved?: () => void;
  product: ProductDto | null;
};

export function AdjustStockModal({visible, onClose, onSaved, product}: AdjustStockModalProps) {
  const adjustStock = useAdjustStock();
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) {
      setAdjustQty('');
      setAdjustReason('');
    }
  }, [visible]);

  async function handleAdjust() {
    if (!product) return;
    const qty = Math.round(Number(adjustQty));
    if (!qty) return;
    setBusy(true);
    try {
      await adjustStock.mutateAsync({id: product.id, values: {adjustment: qty, reason: adjustReason.trim() || undefined}});
      successFeedback(`Stock adjusted for ${product.name}`);
      onClose();
      onSaved?.();
    } catch {
      errorFeedback('Stock adjustment failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalSheet visible={visible} title={`Adjust stock — ${product?.name ?? ''}`} onClose={onClose} dismissable={!busy} centered scrollable>
      <Field label="Quantity (+/−)" value={adjustQty} onChangeText={setAdjustQty} keyboardType="numeric" placeholder="e.g. 10 or -2" />
      <Field label="Reason (optional)" value={adjustReason} onChangeText={setAdjustReason} multiline placeholder="e.g. Restocked, damaged…" />
      <Button title="Adjust" onPress={handleAdjust} loading={busy} />
    </ModalSheet>
  );
}
