import { useState, useEffect } from 'react';
import { X, Package } from 'lucide-react';
import { Field } from './ui';

export default function VariantModal({
  open,
  onClose,
  onSave,
  initialVariant = null,
  productDefaults = {},
}) {
  const [label, setLabel] = useState('');
  const [sku, setSku] = useState('');
  const [price, setPrice] = useState('');
  const [comparePrice, setComparePrice] = useState('');
  const [stock, setStock] = useState('');
  const [packageLength, setPackageLength] = useState('');
  const [packageBreadth, setPackageBreadth] = useState('');
  const [packageHeight, setPackageHeight] = useState('');
  const [packageWeight, setPackageWeight] = useState('');
  const [error, setError] = useState('');

  // Reset or initialize when modal opens
  useEffect(() => {
    if (!open) return;
    if (initialVariant) {
      setLabel(initialVariant.label || '');
      setSku(initialVariant.sku || '');
      setPrice(initialVariant.price != null && initialVariant.price !== '' ? String(initialVariant.price) : '');
      setComparePrice(initialVariant.compare_price != null && initialVariant.compare_price !== '' ? String(initialVariant.compare_price) : '');
      setStock(initialVariant.stock != null && initialVariant.stock !== '' ? String(initialVariant.stock) : '');
      setPackageLength(initialVariant.package_length != null && initialVariant.package_length !== '' ? String(initialVariant.package_length) : '');
      setPackageBreadth(initialVariant.package_breadth != null && initialVariant.package_breadth !== '' ? String(initialVariant.package_breadth) : '');
      setPackageHeight(initialVariant.package_height != null && initialVariant.package_height !== '' ? String(initialVariant.package_height) : '');
      setPackageWeight(initialVariant.package_weight != null && initialVariant.package_weight !== '' ? String(initialVariant.package_weight) : '');
    } else {
      // Clean empty fields for new variant — user types everything fresh
      setLabel('');
      setSku('');
      setPrice('');
      setComparePrice('');
      setStock('');
      setPackageLength('');
      setPackageBreadth('');
      setPackageHeight('');
      setPackageWeight('');
    }
    setError('');
  }, [open, initialVariant]);

  if (!open) return null;

  const handleSave = (e) => {
    e.preventDefault();
    if (!label.trim()) {
      setError('Please enter an option name (e.g. 250g, 500g, 1Kg)');
      return;
    }
    if (price === '' || Number(price) <= 0) {
      setError('Enter a valid selling price above ₹0');
      return;
    }
    if (stock === '' || Number(stock) < 0) {
      setError('Enter available stock quantity (0 or more)');
      return;
    }
    if (packageWeight === '' || Number(packageWeight) <= 0) {
      setError('Enter package weight in kg (above 0)');
      return;
    }
    if (packageLength === '' || Number(packageLength) <= 0) {
      setError('Enter package length in cm (above 0)');
      return;
    }
    if (packageBreadth === '' || Number(packageBreadth) <= 0) {
      setError('Enter package breadth in cm (above 0)');
      return;
    }
    if (packageHeight === '' || Number(packageHeight) <= 0) {
      setError('Enter package height in cm (above 0)');
      return;
    }

    onSave({
      id: initialVariant?.id,
      label: label.trim(),
      sku: sku.trim(),
      price: Number(price),
      compare_price: comparePrice !== '' && Number(comparePrice) > 0 ? Number(comparePrice) : null,
      stock: parseInt(stock, 10) || 0,
      package_length: Number(packageLength),
      package_breadth: Number(packageBreadth),
      package_height: Number(packageHeight),
      package_weight: Number(packageWeight),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-ink-950/50 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-sand-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-sand-200 px-6 py-4 bg-sand-50/50">
          <div>
            <h2 className="font-display text-lg font-bold text-ink-900">
              {initialVariant ? 'Edit Variant' : 'Add Variant'}
            </h2>
            <p className="text-xs text-ink-500">
              Product: <span className="font-medium text-ink-800">{productDefaults.name || 'Current Product'}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-400 hover:bg-sand-100 hover:text-ink-700 transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-5 max-h-[78vh] overflow-y-auto" noValidate>
          {error && (
            <div className="rounded-lg bg-clay-50 border border-clay-200 p-3 text-xs text-clay-700 font-medium">
              {error}
            </div>
          )}

          {/* Option Name Input */}
          <Field
            label="Option / Variant Name"
            placeholder="e.g. 250g, 500g, 1Kg, Bottle · 30ml, Small"
            value={label}
            onChange={(e) => {
              setLabel(e.target.value);
              setError('');
            }}
            hint="Type the size, weight, or option label shown to customers in the store."
            required
            autoFocus
          />

          {/* SKU Code */}
          <Field
            label="SKU Code (Optional)"
            placeholder="e.g. TEA-CD-250G"
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            hint="Stock Keeping Unit code. If left blank, Shiprocket will use an automatic SKU."
          />

          {/* Pricing (INR ₹) */}
          <div className="rounded-xl border border-sand-200 p-4 space-y-3 bg-sand-50/30">
            <span className="text-[11px] font-bold tracking-wider uppercase text-ink-600">
              Pricing (INR ₹)
            </span>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                label="Selling Price (₹)"
                type="number"
                min="0"
                step="0.01"
                prefix="₹"
                required
                placeholder="e.g. 180"
                value={price}
                onChange={(e) => {
                  setPrice(e.target.value);
                  setError('');
                }}
                hint="Customer price in INR"
              />
              <Field
                label="MRP / Compare Price (₹)"
                type="number"
                min="0"
                step="0.01"
                prefix="₹"
                placeholder="e.g. 200"
                value={comparePrice}
                onChange={(e) => setComparePrice(e.target.value)}
                hint="Shown struck through (optional)"
              />
            </div>
          </div>

          {/* Stock Quantity */}
          <div className="rounded-xl border border-sand-200 p-4 space-y-3">
            <span className="text-[11px] font-bold tracking-wider uppercase text-ink-600">
              Inventory &amp; Stock
            </span>
            <Field
              label="Stock Quantity"
              type="number"
              min="0"
              step="1"
              required
              placeholder="e.g. 50"
              value={stock}
              onChange={(e) => {
                setStock(e.target.value);
                setError('');
              }}
              hint="Units available for sale"
            />
          </div>

          {/* Shipping Package & Weight for Shiprocket (All Required) */}
          <div className="rounded-xl border border-sand-200 p-4 space-y-3 bg-sand-50/40">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold tracking-wider uppercase text-brand-800 flex items-center gap-1.5">
                <Package className="size-4 text-brand-700" />
                Shipping Package for this Variant (Shiprocket)
              </span>
              {packageLength && packageBreadth && packageHeight && (
                <span className="text-[11px] font-medium text-ink-500">
                  Vol: {((Number(packageLength) * Number(packageBreadth) * Number(packageHeight)) / 5000).toFixed(2)} kg
                </span>
              )}
            </div>
            <p className="text-[11px] text-ink-500">
              Box dimensions (L × B × H) &amp; packed weight for this specific option. All fields required for courier live rate calculation.
            </p>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Field
                label="Weight (kg)"
                type="number"
                min="0.01"
                step="0.01"
                required
                placeholder="e.g. 0.25"
                value={packageWeight}
                onChange={(e) => {
                  setPackageWeight(e.target.value);
                  setError('');
                }}
              />
              <Field
                label="Length (cm)"
                type="number"
                min="1"
                step="0.1"
                required
                placeholder="e.g. 10"
                value={packageLength}
                onChange={(e) => {
                  setPackageLength(e.target.value);
                  setError('');
                }}
              />
              <Field
                label="Breadth (cm)"
                type="number"
                min="1"
                step="0.1"
                required
                placeholder="e.g. 10"
                value={packageBreadth}
                onChange={(e) => {
                  setPackageBreadth(e.target.value);
                  setError('');
                }}
              />
              <Field
                label="Height (cm)"
                type="number"
                min="1"
                step="0.1"
                required
                placeholder="e.g. 5"
                value={packageHeight}
                onChange={(e) => {
                  setPackageHeight(e.target.value);
                  setError('');
                }}
              />
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-sand-200">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-sand-300 px-5 py-2.5 text-sm font-semibold text-ink-700 hover:bg-sand-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-xl bg-ink-900 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-ink-800 transition-colors"
            >
              {initialVariant ? 'Save Variant Changes' : 'Save Variant'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
