const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const config = require('../src/config/env');
const shiprocket = require('../src/services/shiprocketService');

async function testConnection() {
  console.log('Testing Shiprocket API integration...');
  console.log(`Configured Email: ${config.shiprocket.email}`);
  console.log(`Password length: ${config.shiprocket.password ? config.shiprocket.password.length : 0} characters`);

  try {
    console.log('\n1. Attempting login to Shiprocket (POST /v1/external/auth/login)...');
    const token = await shiprocket.getToken();
    console.log('✅ Shiprocket login successful!');
    console.log(`Token received: ${token.substring(0, 15)}... (length: ${token.length})`);

    console.log('\n2. Fetching registered pickup locations...');
    const pickupRes = await shiprocket.getPickupLocations();
    const addresses = pickupRes.data?.shipping_address || [];
    console.log(`✅ Found ${addresses.length} pickup location(s):`);
    addresses.forEach((loc) => {
      console.log(`  - Location: "${loc.pickup_location}" (City: ${loc.city}, Pin: ${loc.pin_code}, Primary: ${loc.is_primary_location ? 'Yes' : 'No'})`);
    });

    console.log('\n3. Testing courier serviceability check (Coimbatore 641104 -> Chennai 600001)...');
    const res = await shiprocket.checkServiceability({
      pickupPostcode: 641104,
      deliveryPostcode: 600001,
      weight: 0.5,
      cod: 0,
    });
    console.log('✅ Serviceability check successful!');
    const couriers = res.data?.available_courier_companies || [];
    console.log(`Available couriers count: ${couriers.length}`);
    if (couriers.length) {
      console.log('Sample courier rates:');
      couriers.slice(0, 3).forEach((c) => {
        console.log(`  - ${c.courier_name} (Rate: ₹${c.rate}, ETA: ${c.etd})`);
      });
    }

    console.log('\n🎉 ALL SHIPROCKET TESTS PASSED! Integration is 100% active and working.');
  } catch (err) {
    console.error('\n❌ Shiprocket test failed:');
    console.error(`Message: ${err.message}`);
    if (err.details) {
      console.error('Details from Shiprocket:', JSON.stringify(err.details, null, 2));
    }
    process.exit(1);
  }
}

testConnection();
