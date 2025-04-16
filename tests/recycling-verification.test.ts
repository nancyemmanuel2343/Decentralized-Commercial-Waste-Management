import { describe, it, expect, beforeEach } from 'vitest';

// Mock principals
const admin = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
const business1 = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG';
const business2 = 'ST2JHG361ZXG51QTKY2NQCVBPPRRE2KZB1HR05NNC';

// Mock contract state
let recyclingClaims = new Map();
let businessRecyclingStats = new Map();
let claimCounter = 0;
let currentAdmin = admin;

// Mock contract functions
function submitRecyclingClaim(caller, date, wasteType, volume, recycledVolume, evidenceHash) {
  if (recycledVolume > volume) {
    return { type: 'err', value: 2 };
  }
  
  const claimId = ++claimCounter;
  
  recyclingClaims.set(claimId, {
    business: caller,
    date,
    'waste-type': wasteType,
    volume,
    'recycled-volume': recycledVolume,
    status: 0,
    verifier: null,
    'verification-time': 0,
    'evidence-hash': evidenceHash
  });
  
  return { type: 'ok', value: true };
}

function verifyRecyclingClaim(caller, claimId) {
  if (!recyclingClaims.has(claimId)) {
    return { type: 'err', value: 404 };
  }
  
  if (caller !== currentAdmin) {
    return { type: 'err', value: 403 };
  }
  
  const claim = recyclingClaims.get(claimId);
  const business = claim.business;
  const volume = claim.volume;
  const recycledVolume = claim['recycled-volume'];
  
  // Update the claim status
  claim.status = 1;
  claim.verifier = caller;
  claim['verification-time'] = 400; // Mock block height
  recyclingClaims.set(claimId, claim);
  
  // Update business stats
  const stats = businessRecyclingStats.get(business) || {
    'total-waste': 0,
    'total-recycled': 0,
    'diversion-rate': 0,
    'carbon-offset': 0,
    'last-updated': 0
  };
  
  const newTotalWaste = stats['total-waste'] + volume;
  const newTotalRecycled = stats['total-recycled'] + recycledVolume;
  
  businessRecyclingStats.set(business, {
    'total-waste': newTotalWaste,
    'total-recycled': newTotalRecycled,
    'diversion-rate': newTotalWaste === 0 ? 0 : Math.floor((newTotalRecycled * 10000) / newTotalWaste),
    'carbon-offset': stats['carbon-offset'] + (recycledVolume * 120), // 1.2 kg CO2e per unit
    'last-updated': 400 // Mock block height
  });
  
  return { type: 'ok', value: true };
}

function rejectRecyclingClaim(caller, claimId) {
  if (!recyclingClaims.has(claimId)) {
    return { type: 'err', value: 404 };
  }
  
  if (caller !== currentAdmin) {
    return { type: 'err', value: 403 };
  }
  
  const claim = recyclingClaims.get(claimId);
  claim.status = 2;
  claim.verifier = caller;
  claim['verification-time'] = 400; // Mock block height
  recyclingClaims.set(claimId, claim);
  
  return { type: 'ok', value: true };
}

function getRecyclingClaim(claimId) {
  return recyclingClaims.has(claimId)
      ? { type: 'ok', value: recyclingClaims.get(claimId) }
      : { type: 'ok', value: null };
}

function getBusinessRecyclingStats(business) {
  return businessRecyclingStats.has(business)
      ? { type: 'ok', value: businessRecyclingStats.get(business) }
      : { type: 'ok', value: {
          'total-waste': 0,
          'total-recycled': 0,
          'diversion-rate': 0,
          'carbon-offset': 0,
          'last-updated': 0
        }
      };
}

function transferAdmin(caller, newAdmin) {
  if (caller !== currentAdmin) {
    return { type: 'err', value: 403 };
  }
  
  currentAdmin = newAdmin;
  return { type: 'ok', value: true };
}

// Tests
describe('Recycling Verification Contract', () => {
  beforeEach(() => {
    recyclingClaims = new Map();
    businessRecyclingStats = new Map();
    claimCounter = 0;
    currentAdmin = admin;
  });
  
  describe('submit-recycling-claim', () => {
    it('should submit a valid recycling claim', () => {
      const evidenceHash = new Uint8Array(32).fill(1);
      const result = submitRecyclingClaim(
          business1,
          20230501,
          'paper',
          1000,
          800,
          evidenceHash
      );
      
      expect(result.type).toBe('ok');
      expect(recyclingClaims.size).toBe(1);
      
      const claim = recyclingClaims.get(1);
      expect(claim.business).toBe(business1);
      expect(claim.date).toBe(20230501);
      expect(claim['waste-type']).toBe('paper');
      expect(claim.volume).toBe(1000);
      expect(claim['recycled-volume']).toBe(800);
      expect(claim.status).toBe(0);
    });
    
    it('should reject claims where recycled volume exceeds total volume', () => {
      const evidenceHash = new Uint8Array(32).fill(1);
      const result = submitRecyclingClaim(
          business1,
          20230501,
          'paper',
          1000,
          1200,
          evidenceHash
      );
      
      expect(result.type).toBe('err');
      expect(result.value).toBe(2);
      expect(recyclingClaims.size).toBe(0);
    });
  });
  
  describe('verify-recycling-claim', () => {
    it('should verify a claim and update business stats', () => {
      const evidenceHash = new Uint8Array(32).fill(1);
      submitRecyclingClaim(business1, 20230501, 'paper', 1000, 800, evidenceHash);
      
      const result = verifyRecyclingClaim(admin, 1);
      
      expect(result.type).toBe('ok');
      expect(recyclingClaims.get(1).status).toBe(1);
      expect(recyclingClaims.get(1).verifier).toBe(admin);
      
      const stats = businessRecyclingStats.get(business1);
      expect(stats['total-waste']).toBe(1000);
      expect(stats['total-recycled']).toBe(800);
      expect(stats['diversion-rate']).toBe(8000); // 80%
      expect(stats['carbon-offset']).toBe(96000); // 800 * 120
    });
    
    it('should fail if claim does not exist', () => {
      const result = verifyRecyclingClaim(admin, 999);
      
      expect(result.type).toBe('err');
      expect(result.value).toBe(404);
    });
    
    it('should fail if caller is not admin', () => {
      const evidenceHash = new Uint8Array(32).fill(1);
      submitRecyclingClaim(business1, 20230501, 'paper', 1000, 800, evidenceHash);
      
      const result = verifyRecyclingClaim(business2, 1);
      
      expect(result.type).toBe('err');
      expect(result.value).toBe(403);
      expect(recyclingClaims.get(1).status).toBe(0);
    });
  });
  
  describe('reject-recycling-claim', () => {
    it('should reject a claim', () => {
      const evidenceHash = new Uint8Array(32).fill(1);
      submitRecyclingClaim(business1, 20230501, 'paper', 1000, 800, evidenceHash);
      
      const result = rejectRecyclingClaim(admin, 1);
      
      expect(result.type).toBe('ok');
      expect(recyclingClaims.get(1).status).toBe(2);
      expect(recyclingClaims.get(1).verifier).toBe(admin);
    });
  });
});
