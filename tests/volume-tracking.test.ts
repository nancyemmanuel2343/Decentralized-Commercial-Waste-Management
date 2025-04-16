import { describe, it, expect, beforeEach } from 'vitest';

// Mock principals
const business1 = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG';
const business2 = 'ST2JHG361ZXG51QTKY2NQCVBPPRRE2KZB1HR05NNC';
const collector = 'ST3AM1A56AK2C1XAFJ4115ZSV26EB49BVQ10MGCS0';

// Mock contract state
let wasteRecords = new Map();
let businessTotals = new Map();

// Mock contract functions
function recordWasteVolume(caller, business, date, general, recyclable, organic, hazardous) {
  // Record the waste volumes for this pickup
  const key = `${business}-${date}`;
  wasteRecords.set(key, {
    general,
    recyclable,
    organic,
    hazardous,
    collector: caller,
    timestamp: 300 // Mock block height
  });
  
  // Update business totals
  const existingTotals = businessTotals.get(business) || {
    'general-total': 0,
    'recyclable-total': 0,
    'organic-total': 0,
    'hazardous-total': 0,
    'last-updated': 0
  };
  
  businessTotals.set(business, {
    'general-total': existingTotals['general-total'] + general,
    'recyclable-total': existingTotals['recyclable-total'] + recyclable,
    'organic-total': existingTotals['organic-total'] + organic,
    'hazardous-total': existingTotals['hazardous-total'] + hazardous,
    'last-updated': 300 // Mock block height
  });
  
  return { type: 'ok', value: true };
}

function getWasteRecord(business, date) {
  const key = `${business}-${date}`;
  return wasteRecords.has(key)
      ? { type: 'ok', value: wasteRecords.get(key) }
      : { type: 'ok', value: null };
}

function getBusinessTotals(business) {
  return businessTotals.has(business)
      ? { type: 'ok', value: businessTotals.get(business) }
      : { type: 'ok', value: {
          'general-total': 0,
          'recyclable-total': 0,
          'organic-total': 0,
          'hazardous-total': 0,
          'last-updated': 0
        }
      };
}

function getTotalWaste(business) {
  const totals = businessTotals.get(business) || {
    'general-total': 0,
    'recyclable-total': 0,
    'organic-total': 0,
    'hazardous-total': 0
  };
  
  return {
    type: 'ok',
    value: totals['general-total'] +
        totals['recyclable-total'] +
        totals['organic-total'] +
        totals['hazardous-total']
  };
}

function getRecyclingPercentage(business) {
  const totals = businessTotals.get(business) || {
    'general-total': 0,
    'recyclable-total': 0,
    'organic-total': 0,
    'hazardous-total': 0
  };
  
  const totalWaste = totals['general-total'] +
      totals['recyclable-total'] +
      totals['organic-total'] +
      totals['hazardous-total'];
  
  if (totalWaste === 0) {
    return { type: 'ok', value: 0 };
  }
  
  return {
    type: 'ok',
    value: Math.floor((totals['recyclable-total'] * 10000) / totalWaste)
  };
}

// Tests
describe('Volume Tracking Contract', () => {
  beforeEach(() => {
    wasteRecords = new Map();
    businessTotals = new Map();
  });
  
  describe('record-waste-volume', () => {
    it('should record waste volumes for a business', () => {
      const result = recordWasteVolume(
          collector,
          business1,
          20230501,
          1000, // 10 cubic meters (x100)
          500,  // 5 cubic meters
          200,  // 2 cubic meters
          50    // 0.5 cubic meters
      );
      
      expect(result.type).toBe('ok');
      expect(wasteRecords.size).toBe(1);
      
      const record = wasteRecords.get(`${business1}-20230501`);
      expect(record.general).toBe(1000);
      expect(record.recyclable).toBe(500);
      expect(record.organic).toBe(200);
      expect(record.hazardous).toBe(50);
    });
    
    it('should update business totals when recording waste', () => {
      recordWasteVolume(collector, business1, 20230501, 1000, 500, 200, 50);
      recordWasteVolume(collector, business1, 20230508, 800, 400, 100, 30);
      
      const totals = businessTotals.get(business1);
      expect(totals['general-total']).toBe(1800);
      expect(totals['recyclable-total']).toBe(900);
      expect(totals['organic-total']).toBe(300);
      expect(totals['hazardous-total']).toBe(80);
    });
  });
  
  describe('get-total-waste', () => {
    it('should return the total waste for a business', () => {
      recordWasteVolume(collector, business1, 20230501, 1000, 500, 200, 50);
      
      const result = getTotalWaste(business1);
      
      expect(result.type).toBe('ok');
      expect(result.value).toBe(1750); // 1000 + 500 + 200 + 50
    });
    
    it('should return zero for a business with no records', () => {
      const result = getTotalWaste(business2);
      
      expect(result.type).toBe('ok');
      expect(result.value).toBe(0);
    });
  });
  
  describe('get-recycling-percentage', () => {
    it('should calculate the recycling percentage correctly', () => {
      recordWasteVolume(collector, business1, 20230501, 1000, 500, 200, 50);
      
      const result = getRecyclingPercentage(business1);
      
      expect(result.type).toBe('ok');
      // (500 * 10000) / 1750 = 2857.14... which floors to 2857
      expect(result.value).toBe(2857);
    });
    
    it('should return zero for a business with no waste', () => {
      const result = getRecyclingPercentage(business2);
      
      expect(result.type).toBe('ok');
      expect(result.value).toBe(0);
    });
  });
});
