/**
 * Utility functions for computing parcel shipping weight and packaging dimensions
 * for Shiprocket courier calculation and shipment creation.
 */

/**
 * Extracts weight in kilograms from strings like "200g", "1.5 kg", "500gm", "100ml", "1L".
 */
function extractWeightInKg(text) {
  if (!text || typeof text !== 'string') return null;
  const s = text.toLowerCase();

  // match kg (e.g. 1kg, 1.5 kg, 2 kilo, 1.5kgs)
  const kgMatch = s.match(/(\d+(?:\.\d+)?)\s*(?:kg|kilo|kilogram)s?\b/);
  if (kgMatch) return parseFloat(kgMatch[1]);

  // match g / gm / gram (e.g. 200g, 250 gm, 500 grams, 150gms)
  const gMatch = s.match(/(\d+(?:\.\d+)?)\s*(?:g|gm|gms|gram|grams)\b/);
  if (gMatch) return parseFloat(gMatch[1]) / 1000;

  // match l / ltr / litre (e.g. 1L, 1 litre, 2 ltr)
  const lMatch = s.match(/(\d+(?:\.\d+)?)\s*(?:l|ltr|liter|litre)s?\b/);
  if (lMatch) return parseFloat(lMatch[1]);

  // match ml / milliliter (e.g. 10ml, 30ml, 100ml, 500ml)
  const mlMatch = s.match(/(\d+(?:\.\d+)?)\s*(?:ml|milliliter)s?\b/);
  if (mlMatch) return parseFloat(mlMatch[1]) / 1000;

  return null;
}

/**
 * Calculates outer parcel dimensions and billable chargeable weight for a list of items and quantities.
 *
 * Shiprocket and courier companies (Delhivery, DTDC, Blue Dart) calculate billing based on:
 *   chargeableWeight = Math.max(0.5, deadWeight, volumetricWeight)
 * where volumetricWeight = (Length x Breadth x Height in cm) / 5000.
 */
function calculatePackage(items) {
  const safeItems = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!safeItems.length) {
    return {
      weight: 0.5,
      length: 10,
      breadth: 10,
      height: 10,
      deadWeight: 0.5,
      volWeight: 0.2,
    };
  }

  let totalGrossWeight = 0;
  let totalVolume = 0;
  let maxL = 10;
  let maxB = 10;

  for (const item of safeItems) {
    const qty = Math.max(1, parseInt(item.quantity || item.units, 10) || 1);
    const label = item.variantLabel || item.variant_label || '';
    const name = item.name || '';
    const dbWeight = item.packageWeight || item.package_weight;

    const parsedWeight =
      extractWeightInKg(label) ??
      (dbWeight && Number(dbWeight) > 0 ? Number(dbWeight) : null) ??
      extractWeightInKg(name) ??
      0.25;

    // Unit weight including inner container/packaging tare (e.g. tin, pouch, jar, glass bottle)
    const unitGrossWeight = Math.max(0.08, parsedWeight + 0.05);
    totalGrossWeight += unitGrossWeight * qty;

    const dbL = item.packageLength || item.package_length;
    const dbB = item.packageBreadth || item.package_breadth;
    const dbH = item.packageHeight || item.package_height;

    const l = Math.max(10, Number(dbL) || 10);
    const b = Math.max(10, Number(dbB) || 10);
    const h = Math.max(5, Number(dbH) || 5);
    totalVolume += (l * b * h) * qty;

    if (l > maxL) maxL = l;
    if (b > maxB) maxB = b;
  }

  // Box dimensions capped to standard courier limits (100cm max side)
  const pkgLength = Math.max(10, Math.min(100, Math.round(maxL)));
  const pkgBreadth = Math.max(10, Math.min(100, Math.round(maxB)));
  // Calculate outer carton box height required to accommodate the stacked volume
  const pkgHeight = Math.max(5, Math.min(100, Math.ceil(totalVolume / (pkgLength * pkgBreadth))));

  // IATA volumetric weight formula: (L x W x H in cm) / 5000
  const volWeight = (pkgLength * pkgBreadth * pkgHeight) / 5000;
  // Outer corrugated shipping box tare weight ~ 50g
  const deadWeight = totalGrossWeight + 0.05;
  // Chargeable weight: couriers bill on greater of dead weight vs volumetric weight, minimum 0.5kg
  const chargeableWeight = Math.max(0.5, Math.round(Math.max(deadWeight, volWeight) * 100) / 100);

  return {
    weight: chargeableWeight,
    length: pkgLength,
    breadth: pkgBreadth,
    height: pkgHeight,
    deadWeight: Math.round(deadWeight * 100) / 100,
    volWeight: Math.round(volWeight * 100) / 100,
  };
}

module.exports = {
  extractWeightInKg,
  calculatePackage,
};
